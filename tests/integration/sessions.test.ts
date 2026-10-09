/** Sessions: creation, idle and absolute expiry, last-seen throttling, rotation, revocation and forced revocation. */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { changePassword } from "../../src/server/auth/passwords.ts";
import {
  createSession,
  findSessionByToken,
  listLiveSessions,
  revokeSession,
  rotateSession,
  touchSession,
} from "../../src/server/auth/sessions.ts";
import { rotateIfDue, signIn, signOut } from "../../src/server/auth/sign-in.ts";
import { setUserRoles, setUserStatus } from "../../src/server/auth/user-admin.ts";
import { dbFor, inTransaction } from "../../src/server/db/client.ts";
import { sessions, users } from "../../src/server/db/schema.ts";
import { actorFor, createUser, meta, setupTestEnv, strongPassword, type TestEnv } from "./helpers.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;
let env: TestEnv;
before(async () => {
  env = await setupTestEnv("sessions");
});
after(async () => env?.close());

const newSession = async (userId: string, extra: { pending?: boolean; mfaVerified?: boolean } = {}) =>
  createSession(dbFor(env.pool), { userId, now: env.deps.clock(), ip: "203.0.113.5", userAgent: "test", mfaVerified: false, ...extra });

describe("lifetimes", () => {
  test("idle expiry: 2 hours without activity ends the session", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const { token } = await newSession(user.id);
    env.clock.advance(2 * HOUR - 1);
    assert.ok(await findSessionByToken(dbFor(env.pool), token, env.deps.clock()));
    env.clock.advance(1);
    assert.equal(await findSessionByToken(dbFor(env.pool), token, env.deps.clock()), null);
  });

  test("activity moves the idle limit, but never past the absolute 12 hours", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const { token } = await newSession(user.id);
    for (let h = 0; h < 11; h++) {
      env.clock.advance(HOUR);
      const found = await findSessionByToken(dbFor(env.pool), token, env.deps.clock());
      assert.ok(found, `session alive after ${h + 1} h`);
      await touchSession(dbFor(env.pool), found.session, env.deps.clock());
    }
    env.clock.advance(HOUR - 1);
    assert.ok(await findSessionByToken(dbFor(env.pool), token, env.deps.clock()));
    env.clock.advance(1);
    assert.equal(await findSessionByToken(dbFor(env.pool), token, env.deps.clock()), null);
  });

  test("last_seen_at is written at most once a minute", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const { session } = await newSession(user.id);
    env.clock.advance(59_000);
    const same = await touchSession(dbFor(env.pool), session, env.deps.clock());
    assert.equal(same, session);
    env.clock.advance(1_000);
    const moved = await touchSession(dbFor(env.pool), session, env.deps.clock());
    assert.equal(moved.lastSeenAt.getTime(), env.clock.now.getTime());
    const [row] = await dbFor(env.pool).select().from(sessions).where(eq(sessions.id, session.id));
    assert.equal(row.lastSeenAt.getTime(), env.clock.now.getTime());
    assert.equal(row.idleExpiresAt.getTime(), env.clock.now.getTime() + 2 * HOUR);
  });

  test("a session waiting for the second factor lives 10 minutes and is not extended", async () => {
    const user = await createUser(env, { roles: ["editor"], mfa: true });
    const { token, session } = await newSession(user.id, { pending: true });
    assert.equal(session.absoluteExpiresAt.getTime() - session.createdAt.getTime(), 10 * MIN);
    env.clock.advance(5 * MIN);
    const found = await findSessionByToken(dbFor(env.pool), token, env.deps.clock());
    assert.ok(found);
    const touched = await touchSession(dbFor(env.pool), found.session, env.deps.clock());
    assert.equal(touched.idleExpiresAt.getTime(), session.idleExpiresAt.getTime());
    env.clock.advance(5 * MIN);
    assert.equal(await findSessionByToken(dbFor(env.pool), token, env.deps.clock()), null);
  });

  test("malformed or unknown tokens are rejected before any lookup", async () => {
    for (const bad of [undefined, "", "short", "x".repeat(43), "A".repeat(42) + "!", 42]) {
      assert.equal(await findSessionByToken(dbFor(env.pool), bad, env.deps.clock()), null);
    }
  });
});

describe("rotation", () => {
  test("a rotated token is honoured for 30 seconds (resolving to its replacement), then refused", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const old = await newSession(user.id);
    const rotated = await inTransaction(env.pool, (tx) => rotateSession(tx, old.session, { now: env.deps.clock(), ip: null, userAgent: null }));
    assert.notEqual(rotated.token, old.token);
    assert.equal(rotated.session.absoluteExpiresAt.getTime(), old.session.absoluteExpiresAt.getTime());
    const viaOld = await findSessionByToken(dbFor(env.pool), old.token, env.deps.clock());
    assert.equal(viaOld?.session.id, rotated.session.id);
    const [row] = await dbFor(env.pool).select().from(sessions).where(eq(sessions.id, old.session.id));
    assert.equal(row.revokedReason, "rotated");
    assert.equal(row.replacedById, rotated.session.id);
    env.clock.advance(30_001);
    assert.equal(await findSessionByToken(dbFor(env.pool), old.token, env.deps.clock()), null);
    assert.equal((await findSessionByToken(dbFor(env.pool), rotated.token, env.deps.clock()))?.session.id, rotated.session.id);
  });

  test("the shell's periodic rotation happens after 30 minutes of use, not before", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const { session } = await newSession(user.id);
    env.clock.advance(29 * MIN);
    assert.equal(await rotateIfDue(env.deps, session, meta()), null);
    env.clock.advance(MIN);
    const rotated = await rotateIfDue(env.deps, session, meta());
    assert.ok(rotated);
    assert.equal(rotated.session.reauthenticatedAt.getTime(), session.reauthenticatedAt.getTime());
    // Rotation is not activity: it never moves the idle or absolute limits.
    assert.equal(rotated.session.idleExpiresAt.getTime(), session.idleExpiresAt.getTime());
    assert.equal(rotated.session.absoluteExpiresAt.getTime(), session.absoluteExpiresAt.getTime());
  });

  test("signing in always issues a new session (no session fixation)", async () => {
    const user = await createUser(env, { roles: ["reviewer"] });
    const a = await signIn(env.deps, { email: user.email, password: user.password }, meta());
    const b = await signIn(env.deps, { email: user.email, password: user.password }, meta());
    assert.ok(a.kind === "signed_in" && b.kind === "signed_in");
    if (a.kind === "signed_in" && b.kind === "signed_in") assert.notEqual(a.session.id, b.session.id);
  });
});

describe("revocation", () => {
  test("logout revokes the session; the cookie token stops working at once (no grace)", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    await signOut(env.deps, actor, meta());
    assert.equal(await findSessionByToken(dbFor(env.pool), actor.token, env.deps.clock()), null);
    const [row] = await dbFor(env.pool).select().from(sessions).where(eq(sessions.id, actor.session.id));
    assert.equal(row.revokedReason, "logout");
  });

  test("revoking one of several sessions leaves the others", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const a = await newSession(user.id);
    const b = await newSession(user.id);
    assert.equal(await revokeSession(dbFor(env.pool), a.session.id, "revoked", env.deps.clock()), true);
    assert.equal(await revokeSession(dbFor(env.pool), a.session.id, "revoked", env.deps.clock()), false);
    const live = await listLiveSessions(dbFor(env.pool), user.id, env.deps.clock());
    assert.deepEqual(
      live.map((s) => s.id),
      [b.session.id],
    );
  });

  test("a password change signs out every other session and rotates this one", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const other = await newSession(user.id);
    const actor = await actorFor(env, user);
    const result = await changePassword(env.deps, actor, { currentPassword: user.password, newPassword: strongPassword() }, meta());
    assert.equal(result.kind, "ok");
    assert.equal(await findSessionByToken(dbFor(env.pool), other.token, env.deps.clock()), null);
    if (result.kind === "ok") {
      assert.equal(result.othersSignedOut, 1);
      assert.ok(await findSessionByToken(dbFor(env.pool), result.token, env.deps.clock()));
    }
  });

  test("disabling a user and changing their roles revoke all their sessions", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const target = await createUser(env, { roles: ["editor"] });
    const s1 = await newSession(target.id);
    assert.equal((await setUserRoles(env.deps, ownerActor, target.id, ["reviewer"], meta())).kind, "ok");
    assert.equal(await findSessionByToken(dbFor(env.pool), s1.token, env.deps.clock()), null);
    const [r1] = await dbFor(env.pool).select().from(sessions).where(eq(sessions.id, s1.session.id));
    assert.equal(r1.revokedReason, "role_changed");
    const s2 = await newSession(target.id);
    assert.equal((await setUserStatus(env.deps, ownerActor, target.id, "disabled", meta())).kind, "ok");
    assert.equal(await findSessionByToken(dbFor(env.pool), s2.token, env.deps.clock()), null);
    const [r2] = await dbFor(env.pool).select().from(sessions).where(eq(sessions.id, s2.session.id));
    assert.equal(r2.revokedReason, "user_disabled");
    // Re-enabling does not bring old sessions back.
    assert.equal((await setUserStatus(env.deps, ownerActor, target.id, "active", meta())).kind, "ok");
    assert.equal(await findSessionByToken(dbFor(env.pool), s2.token, env.deps.clock()), null);
  });

  test("a session stops working as soon as its user is disabled, even before revocation", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const { token } = await newSession(user.id);
    await dbFor(env.pool).update(users).set({ status: "disabled" }).where(eq(users.id, user.id));
    assert.equal(await findSessionByToken(dbFor(env.pool), token, env.deps.clock()), null);
  });
});
