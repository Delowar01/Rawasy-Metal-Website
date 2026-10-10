/**
 * A2 Correction 1, the focused security review: nothing granted by an old credential, and nothing asked for by a session
 * that has since been revoked, is completed after the change that should have stopped it.
 *  - Finding 1: a sign-in whose password was checked before a password reset, a password change, a disable or a lock
 *    never yields a session (the hasher here pauses after its check: the race window, held open); a session left from
 *    before a disable does not come back with a re-enable.
 *  - Finding 2: a change asked for by a session revoked after its request was authorised is not made, and the rank rule
 *    and the roles to change are decided against the target as it is under its row lock.
 *  - Finding 3: every spelling of an email address is one key (sign-in slots and account lookup alike).
 *  - Invitations sent by a user who is disabled or loses a role are withdrawn.
 *  - The third review: an invitation link carries its issuer's authority, never more — raising the invited account's
 *    roles withdraws it, acceptance checks the issuer against the account as it is then, a new link is decided under the
 *    account's row lock, and a re-enable retires a link left from around the disable.
 *  - The fourth review: a role change decided on an account that has changed since is refused; a role change withdraws
 *    pending reset links too; a request reads its session, roles and second factor in one snapshot; only the newest Owner
 *    setup link works, and none once an Owner is active.
 *  - The fifth review: every user-management change that can grant, restore or loosen access is decided on the account
 *    as its page showed it (the page's fingerprint); signing a session out also ends the session it rotated into; every
 *    connection reads at REPEATABLE READ; removing a second factor withdraws pending reset links; a change that signs a
 *    user out ends sessions already past their limit too; a recovery code used for a step-up is recorded and notified.
 *  - The sixth review: an unlock is decided on the lock and the attempts the page showed; the access fingerprint holds
 *    only what the decisions depend on, so the user's own password change or failed sign-ins never block an Owner.
 *  - The seventh review: a two-factor reset is also decided on the password and the lock the page showed (it hands the
 *    account to whoever holds the password); an unlock also on the status, roles and second factor.
 *  - The eighth review: a two-factor reset is decided on the password and the failed second steps only (wrong passwords
 *    alone, which anyone who knows the email can send, do not refuse it); the emergency reset takes the user's row first.
 *  - The ninth review: a two-factor reset also sees every sign-in that passed the password and every session rotated
 *    since the page was shown; the emergency reset reports a user it could not reset and goes on with the others.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Pool, PoolConnection } from "mysql2/promise";
import { activeOwnerIds } from "../../src/server/auth/accounts.ts";
import { bootstrapOwner, recoveryReset } from "../../src/server/auth/bootstrap.ts";
import { acceptInvitation, inspectInvitation, inviteUser, resendInvitation } from "../../src/server/auth/invitations.ts";
import { beginEnrolment, confirmEnrolment, disableMfa, emergencyMfaReset, regenerateRecoveryCodes } from "../../src/server/auth/mfa.ts";
import { changePassword, completePasswordReset, inspectResetToken, requestPasswordReset } from "../../src/server/auth/passwords.ts";
import { revokeOtherOwnSessions, revokeOwnSession } from "../../src/server/auth/self-service.ts";
import { readSessionState } from "../../src/server/auth/session-state.ts";
import { findSessionByToken, revokeSession, rotateSession, SessionEndedError } from "../../src/server/auth/sessions.ts";
import { reauthenticate, signIn, signOut, verifySecondFactor } from "../../src/server/auth/sign-in.ts";
import { issueToken } from "../../src/server/auth/tokens.ts";
import type { Actor } from "../../src/server/auth/types.ts";
import { getUserDetail, resetUserMfa, revokeSessionsOf, setUserRoles, setUserStatus, unlockUser } from "../../src/server/auth/user-admin.ts";
import { dbFor, inTransaction } from "../../src/server/db/client.ts";
import { CONNECTION_SETUP } from "../../src/server/db/pool.ts";
import { auditEvents, authTokens, loginAttempts, sessions, userMfa, userRecoveryCodes, userRoles, users } from "../../src/server/db/schema.ts";
import { sha256 } from "../../src/server/security/ids.ts";
import { createPasswordHasher, type PasswordHasher } from "../../src/server/security/password.ts";
import { recoveryCodeHash, normalizeRecoveryCode } from "../../src/server/security/recovery-codes.ts";
import { base32Decode, totpCode } from "../../src/server/security/totp.ts";
import { actorFor, codeFor, createUser, linkToken, meta, serverConnection, setupTestEnv, strongPassword, type TestEnv } from "./helpers.ts";

let env: TestEnv;
before(async () => {
  env = await setupTestEnv("review");
});
after(async () => env?.close());

const db = () => dbFor(env.pool);

/** A hasher that stops right after it has checked a password, until released. */
function paused(base: PasswordHasher) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let reached!: () => void;
  const checked = new Promise<void>((resolve) => (reached = resolve));
  const hasher: PasswordHasher = {
    kind: base.kind,
    hash: (password) => base.hash(password),
    needsRehash: (stored) => base.needsRehash(stored),
    async verify(stored, password) {
      const ok = await base.verify(stored, password);
      reached();
      await gate;
      return ok;
    },
  };
  return { deps: { ...env.deps, hasher }, checked, release };
}

/** A hasher that stops right after it has hashed a new password (an invitation being accepted), until released. */
function pausedHash(base: PasswordHasher, deps = env.deps) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let reached!: () => void;
  const hashed = new Promise<void>((resolve) => (reached = resolve));
  const hasher: PasswordHasher = {
    kind: base.kind,
    async hash(password) {
      const stored = await base.hash(password);
      reached();
      await gate;
      return stored;
    },
    needsRehash: (stored) => base.needsRehash(stored),
    verify: (stored, password) => base.verify(stored, password),
  };
  return { deps: { ...deps, hasher }, hashed, release };
}

/**
 * A pool whose first statement matching `pattern` waits until released — on the pool itself and on the connections it
 * hands out, so inside a transaction too (how Drizzle runs them: `query` / `execute` with the SQL text or `{ sql }`).
 */
function pausingPool(pool: Pool, pattern: RegExp) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let reached!: () => void;
  const atPause = new Promise<void>((resolve) => (reached = resolve));
  let armed = true;
  const sqlOf = (arg: unknown) => (typeof arg === "string" ? arg : String((arg as { sql?: unknown } | null)?.sql ?? ""));
  const pausing =
    (target: object, fn: (...args: unknown[]) => unknown) =>
    async (...args: unknown[]) => {
      if (armed && pattern.test(sqlOf(args[0]))) {
        armed = false;
        reached();
        await gate;
      }
      return fn.apply(target, args);
    };
  // Getters run on the real object (receiver = target): mysql2's objects read their own state through getters, and
  // with the proxy as receiver a connection's handshake went out of order (ER_NET_PACKETS_OUT_OF_ORDER). `extra` is
  // matched on its own keys only: `prop in extra` also matched `constructor`, Drizzle then took the wrapped connection
  // for a config object (`constructor.name === "Object"`) and opened a pool of its own from it.
  const wrap = <T extends object>(target: T, extra: Partial<Record<string | symbol, unknown>> = {}): T =>
    new Proxy(target, {
      get(object, prop) {
        if (Object.hasOwn(extra, prop)) return extra[prop];
        const value = Reflect.get(object, prop, object);
        if ((prop === "query" || prop === "execute") && typeof value === "function") return pausing(object, value as (...args: unknown[]) => unknown);
        return typeof value === "function" ? value.bind(object) : value;
      },
    });
  const wrapped = wrap(pool, { getConnection: async () => wrap<PoolConnection>(await pool.getConnection()) });
  return { pool: wrapped, reached: atPause, release };
}

/** Waits until `work` stops at the paused statement; fails, instead of waiting for ever, if it ends without reaching it. */
async function untilPaused(paused: { reached: Promise<void> }, work: Promise<unknown>) {
  const ended = work.then(
    () => "ended" as const,
    () => "ended" as const,
  );
  if ((await Promise.race([paused.reached.then(() => "paused" as const), ended])) === "ended") assert.fail("the request ended before the paused statement");
}

/** Sessions of a user that are not revoked. */
const unrevoked = async (userId: string) =>
  (await db().select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))).length;
const userRow = async (userId: string) => (await db().select().from(users).where(eq(users.id, userId)))[0];
const rolesNow = async (userId: string) =>
  (await db().select({ key: userRoles.roleKey }).from(userRoles).where(eq(userRoles.userId, userId)).orderBy(asc(userRoles.roleKey))).map((r) => r.key);
const lastReason = async (email: string) =>
  (await db().select({ reason: loginAttempts.failureReason }).from(loginAttempts).where(eq(loginAttempts.emailHash, sha256(email.toLowerCase()))).orderBy(asc(loginAttempts.id))).at(-1)
    ?.reason;
const resetLink = async (email: string) => {
  await requestPasswordReset(env.deps, { email }, meta("203.0.113.40"));
  const message = env.mail().filter((m) => m.to === email && m.kind === "password_reset").at(-1);
  assert.ok(message, "a reset link was sent (mail sink)");
  return linkToken(message.text, "reset");
};

describe("finding 1 — a password checked before the account changed never yields a session", () => {
  test("a password reset committed while the old password was being checked: refused, no session, not counted", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const race = paused(env.deps.hasher);
    const attempt = signIn(race.deps, { email: user.email, password: user.password }, meta("198.51.100.61"));
    await race.checked;
    const next = strongPassword();
    assert.deepEqual(await completePasswordReset(env.deps, { token: await resetLink(user.email), password: next }, meta()), { kind: "ok" });
    race.release();
    assert.deepEqual(await attempt, { kind: "failed" });
    assert.equal(await unrevoked(user.id), 0, "no session from the replaced password");
    // A race, not a wrong password: audited, never counted towards the lockout.
    assert.equal((await userRow(user.id)).failedLoginCount, 0);
    assert.equal(await lastReason(user.email), undefined, "no counted attempt recorded");
    const audited = await db().select().from(auditEvents).where(and(eq(auditEvents.action, "auth.login_failed"), eq(auditEvents.entityId, user.id)));
    assert.match(audited.at(-1)?.summary ?? "", /changed .* while the password was being checked/);
    // So 4 wrong passwords afterwards do not lock the account (with the race counted, they would make 5).
    for (let i = 0; i < 4; i++) await signIn(env.deps, { email: user.email, password: `wrong ${i} wrong wrong` }, meta("198.51.100.61"));
    assert.equal((await userRow(user.id)).lockedUntil, null);
    assert.equal((await signIn(env.deps, { email: user.email, password: next }, meta("198.51.100.61"))).kind, "signed_in");
  });

  test("two correct sign-ins while the stored hash is being upgraded: both get a session", async () => {
    const user = await createUser(env, { roles: ["editor"], hasher: createPasswordHasher("scrypt") });
    const race = paused(env.deps.hasher);
    const first = signIn(race.deps, { email: user.email, password: user.password }, meta("198.51.100.68"));
    await race.checked;
    // The other sign-in upgrades the stored hash meanwhile; the first one's own upgrade then finds it changed.
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta("198.51.100.68"))).kind, "signed_in");
    race.release();
    assert.equal((await first).kind, "signed_in", "the password still matches what is stored: not refused");
    assert.equal(await unrevoked(user.id), 2);
  });

  test("the same race on an account with two-factor authentication: no pending session either", async () => {
    const user = await createUser(env, { roles: ["admin"], mfa: true });
    const race = paused(env.deps.hasher);
    const attempt = signIn(race.deps, { email: user.email, password: user.password }, meta("198.51.100.62"));
    await race.checked;
    assert.deepEqual(await completePasswordReset(env.deps, { token: await resetLink(user.email), password: strongPassword() }, meta()), { kind: "ok" });
    race.release();
    assert.deepEqual(await attempt, { kind: "failed" });
    assert.equal(await unrevoked(user.id), 0);
  });

  test("a password change from the user's own session committed meanwhile: refused; only the changing session lives on", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const own = await actorFor(env, user);
    const race = paused(env.deps.hasher);
    const attempt = signIn(race.deps, { email: user.email, password: user.password }, meta("198.51.100.63"));
    await race.checked;
    const changed = await changePassword(env.deps, own, { currentPassword: user.password, newPassword: strongPassword() }, meta());
    assert.equal(changed.kind, "ok");
    race.release();
    assert.deepEqual(await attempt, { kind: "failed" });
    assert.equal(await unrevoked(user.id), 1, "the changing session's successor only");
  });

  test("a disable committed meanwhile: refused (disabled), and re-enabling the account brings no session back", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const user = await createUser(env, { roles: ["editor"] });
    const race = paused(env.deps.hasher);
    const attempt = signIn(race.deps, { email: user.email, password: user.password }, meta("198.51.100.64"));
    await race.checked;
    assert.equal((await setUserStatus(env.deps, ownerActor, user.id, "disabled", meta())).kind, "ok");
    race.release();
    assert.deepEqual(await attempt, { kind: "failed" });
    assert.equal(await lastReason(user.email), "disabled");
    assert.equal(await unrevoked(user.id), 0);
    env.clock.advance(60 * 60_000);
    assert.equal((await setUserStatus(env.deps, await actorFor(env, owner), user.id, "active", meta())).kind, "ok");
    assert.equal(await unrevoked(user.id), 0, "nothing comes back with the re-enable");
  });

  test("a lock committed meanwhile: refused (locked)", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const race = paused(env.deps.hasher);
    const attempt = signIn(race.deps, { email: user.email, password: user.password }, meta("198.51.100.65"));
    await race.checked;
    await db().update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + 15 * 60_000) }).where(eq(users.id, user.id));
    race.release();
    assert.deepEqual(await attempt, { kind: "failed" });
    assert.equal(await lastReason(user.email), "locked");
    assert.equal(await unrevoked(user.id), 0);
  });

  test("positive control: with nothing in between, the paused sign-in completes (full session, or pending with 2FA)", async () => {
    const plain = await createUser(env, { roles: ["editor"] });
    const race = paused(env.deps.hasher);
    const attempt = signIn(race.deps, { email: plain.email, password: plain.password }, meta("198.51.100.66"));
    await race.checked;
    race.release();
    assert.equal((await attempt).kind, "signed_in");
    const withCode = await createUser(env, { roles: ["admin"], mfa: true });
    const second = paused(env.deps.hasher);
    const pending = signIn(second.deps, { email: withCode.email, password: withCode.password }, meta("198.51.100.66"));
    await second.checked;
    second.release();
    assert.equal((await pending).kind, "mfa_required");
  });

  test("a session that outlived a disable (an inconsistent row, made here by hand) is signed out by the re-enable", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const user = await createUser(env, { roles: ["editor"] });
    await actorFor(env, user);
    await db().update(users).set({ status: "disabled" }).where(eq(users.id, user.id));
    assert.equal(await unrevoked(user.id), 1);
    assert.equal((await setUserStatus(env.deps, await actorFor(env, owner), user.id, "active", meta())).kind, "ok");
    assert.equal(await unrevoked(user.id), 0);
  });
});

describe("finding 2 — a session revoked after its request was authorised changes nothing", () => {
  test("new recovery codes: a session signed out by an authenticator replaced elsewhere receives none", async () => {
    const user = await createUser(env, { roles: ["admin"], mfa: true });
    const stale = await actorFor(env, user);
    const elsewhere = await actorFor(env, user);
    const begun = await beginEnrolment(env.deps, elsewhere, { password: user.password, replace: true }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    env.clock.advance(30_000);
    const code = totpCode(base32Decode(begun.secret), env.deps.clock().getTime());
    const replaced = await confirmEnrolment(env.deps, elsewhere, { code, pending: begun.pending }, meta());
    assert.equal(replaced.kind, "ok");
    if (replaced.kind !== "ok") return;
    // The stale session's request passed its checks before the replacement; it reaches the change only now.
    await assert.rejects(regenerateRecoveryCodes(env.deps, stale, meta()), SessionEndedError);
    const stored = (await db().select().from(userRecoveryCodes).where(eq(userRecoveryCodes.userId, user.id))).map((r) => r.codeHash.toString("hex")).sort();
    const issued = replaced.recoveryCodes.map((c) => recoveryCodeHash(normalizeRecoveryCode(c) as string).toString("hex")).sort();
    assert.deepEqual(stored, issued, "the codes issued with the replacement are still the only ones");
  });

  test("every other change by a revoked session is refused and leaves everything as it was", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const actor = await actorFor(env, owner);
    const otherOwnSession = await actorFor(env, owner);
    const target = await createUser(env, { roles: ["editor"], mfa: true });
    await actorFor(env, target);
    const invited = await createUser(env, { roles: ["reviewer"], status: "invited" });
    await db().update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + 15 * 60_000) }).where(eq(users.id, target.id));
    const tokensBefore = (await db().select().from(authTokens).where(eq(authTokens.userId, invited.id))).length;
    await revokeSession(db(), actor.session.id, "revoked", env.deps.clock());
    const attempts: [string, () => Promise<unknown>][] = [
      ["disable", () => setUserStatus(env.deps, actor, target.id, "disabled", meta())],
      ["roles", () => setUserRoles(env.deps, actor, target.id, ["reviewer"], meta())],
      ["sign the target out", () => revokeSessionsOf(env.deps, actor, target.id, null, meta())],
      ["unlock", () => unlockUser(env.deps, actor, target.id, meta())],
      ["reset 2FA", () => resetUserMfa(env.deps, actor, target.id, meta())],
      ["invite", () => inviteUser(env.deps, actor, { email: "late-invite@example.test", displayName: "Late Invite", roles: ["editor"] }, meta())],
      ["resend", () => resendInvitation(env.deps, actor, invited.id, meta())],
      ["sign out one own session", () => revokeOwnSession(env.deps, actor, otherOwnSession.session.id, meta())],
      ["sign out other own sessions", () => revokeOtherOwnSessions(env.deps, actor, meta())],
    ];
    for (const [label, run] of attempts) await assert.rejects(run(), SessionEndedError, label);
    const row = await userRow(target.id);
    assert.equal(row.status, "active");
    assert.ok(row.lockedUntil, "still locked");
    assert.deepEqual(await rolesNow(target.id), ["editor"]);
    assert.equal((await db().select().from(userMfa).where(eq(userMfa.userId, target.id))).length, 1, "2FA still set up");
    assert.equal(await unrevoked(target.id), 1, "the target is still signed in");
    assert.equal((await db().select().from(users).where(eq(users.emailNormalized, "late-invite@example.test"))).length, 0, "nobody invited");
    assert.equal((await db().select().from(authTokens).where(eq(authTokens.userId, invited.id))).length, tokensBefore, "no new invitation link");
    assert.equal((await db().select().from(sessions).where(and(eq(sessions.id, otherOwnSession.session.id), isNull(sessions.revokedAt)))).length, 1);
  });

  test("the rank rule is decided under the target's row lock: a promotion committed meanwhile wins (disable, unlock, sign out)", async () => {
    const changes: [string, (actor: Awaited<ReturnType<typeof actorFor>>, id: string) => Promise<unknown>][] = [
      ["disable", (actor, id) => setUserStatus(env.deps, actor, id, "disabled", meta())],
      ["unlock", (actor, id) => unlockUser(env.deps, actor, id, meta())],
      ["sign out", (actor, id) => revokeSessionsOf(env.deps, actor, id, null, meta())],
    ];
    for (const [label, change] of changes) {
      const admin = await createUser(env, { roles: ["admin"], mfa: true });
      const adminActor = await actorFor(env, admin);
      const target = await createUser(env, { roles: ["editor"] });
      await actorFor(env, target);
      await db().update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + 15 * 60_000) }).where(eq(users.id, target.id));
      const held = await env.pool.getConnection();
      try {
        await held.query("START TRANSACTION");
        await held.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [target.id]);
        await held.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'admin', UTC_TIMESTAMP(3))", [target.id]);
        // Authorised against the editor role it can still see; its transaction then waits for the target's row.
        const pending = change(adminActor, target.id);
        await new Promise((resolve) => setTimeout(resolve, 400));
        await held.query("COMMIT");
        assert.deepEqual(await pending, { kind: "denied", reason: "rank" }, label);
      } finally {
        held.release();
      }
      const row = await userRow(target.id);
      assert.equal(row.status, "active", `${label}: an Admin never disables an Admin`);
      assert.ok(row.lockedUntil, `${label}: nor unlocks one`);
      assert.equal(await unrevoked(target.id), 1, `${label}: nor signs one out`);
    }
  });

  test("the roles to change are decided under the target's row lock: a change committed meanwhile is not left behind", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const target = await createUser(env, { roles: ["editor"] });
    const held = await env.pool.getConnection();
    try {
      await held.query("START TRANSACTION");
      await held.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [target.id]);
      await held.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'admin', UTC_TIMESTAMP(3))", [target.id]);
      const changing = setUserRoles(env.deps, ownerActor, target.id, ["reviewer"], meta());
      await new Promise((resolve) => setTimeout(resolve, 400));
      await held.query("COMMIT");
      assert.equal((await changing).kind, "ok");
    } finally {
      held.release();
    }
    assert.deepEqual(await rolesNow(target.id), ["reviewer"], "exactly the roles asked for, not an Admin role left over");
  });
});

describe("re-enabling an account", () => {
  test("a reset link issued around a disable (made here by hand) does not work after a re-enable", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const user = await createUser(env, { roles: ["editor"] });
    assert.equal((await setUserStatus(env.deps, ownerActor, user.id, "disabled", meta())).kind, "ok");
    const { token } = await issueToken(db(), { userId: user.id, purpose: "password_reset", now: env.deps.clock() });
    assert.equal((await setUserStatus(env.deps, ownerActor, user.id, "active", meta())).kind, "ok");
    assert.equal(await inspectResetToken(env.deps, token), null);
    assert.deepEqual(await completePasswordReset(env.deps, { token, password: strongPassword() }, meta()), { kind: "invalid" });
  });
});

describe("finding 3 — one key for every spelling of an address", () => {
  test("invited with a decomposed capital (J + combining caron), the account signs in with either spelling; the slots are shared", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const decomposed = "J̌osef.review@example.test";
    const composed = "ǰosef.review@example.test";
    const invited = await inviteUser(env.deps, await actorFor(env, owner), { email: decomposed, displayName: "Josef Review", roles: ["editor"] }, meta());
    assert.equal(invited.kind, "invited");
    const message = env.mail().filter((m) => m.kind === "invitation").at(-1);
    assert.ok(message);
    const password = strongPassword();
    assert.equal((await acceptInvitation(env.deps, { token: linkToken(message.text, "invite"), password }, meta())).kind, "ok");
    for (const spelling of [decomposed, composed, composed.toUpperCase(), ` ${decomposed} `]) {
      assert.equal((await signIn(env.deps, { email: spelling, password }, meta("198.51.100.70"))).kind, "signed_in", JSON.stringify(spelling));
    }
    // Wrong passwords under both spellings share the 5 checks: the 6th is refused before any hash.
    const base = env.deps.hasher;
    let verified = 0;
    const hasher: PasswordHasher = {
      kind: base.kind,
      hash: (p) => base.hash(p),
      needsRehash: (s) => base.needsRehash(s),
      verify: (s, p) => (verified++, base.verify(s, p)),
    };
    for (let i = 0; i < 6; i++) {
      await signIn({ ...env.deps, hasher }, { email: i % 2 ? composed : decomposed, password: `wrong ${i} wrong wrong` }, meta("198.51.100.71"));
    }
    assert.equal(verified, 5);
  });
});

describe("invitations are only as good as their inviter's authority", () => {
  async function invitedBy(inviter: Awaited<ReturnType<typeof actorFor>>, email: string) {
    const result = await inviteUser(env.deps, inviter, { email, displayName: "New Person", roles: ["editor"] }, meta());
    assert.equal(result.kind, "invited");
    const message = env.mail().filter((m) => m.to === email && m.kind === "invitation").at(-1);
    assert.ok(message);
    return linkToken(message.text, "invite");
  }

  test("disabling the inviter withdraws the invitations they sent (re-enabling does not revive them); an Owner can send them again", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const admin = await createUser(env, { roles: ["admin"], mfa: true });
    const email = "invited-by-admin@example.test";
    const token = await invitedBy(await actorFor(env, admin), email);
    assert.ok(await inspectInvitation(env.deps, token));
    assert.equal((await setUserStatus(env.deps, ownerActor, admin.id, "disabled", meta())).kind, "ok");
    assert.equal(await inspectInvitation(env.deps, token), null);
    assert.equal((await acceptInvitation(env.deps, { token, password: strongPassword() }, meta())).kind, "invalid");
    assert.equal((await setUserStatus(env.deps, ownerActor, admin.id, "active", meta())).kind, "ok");
    assert.equal(await inspectInvitation(env.deps, token), null, "not revived");
    const [invitedUser] = await db().select().from(users).where(eq(users.emailNormalized, email));
    assert.equal((await resendInvitation(env.deps, ownerActor, invitedUser.id, meta())).kind, "invited");
    const again = linkToken(env.mail().filter((m) => m.to === email && m.kind === "invitation").at(-1)!.text, "invite");
    assert.equal((await acceptInvitation(env.deps, { token: again, password: strongPassword() }, meta())).kind, "ok");
  });

  test("taking a role from the inviter withdraws their invitations; giving one does not", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const admin = await createUser(env, { roles: ["admin"], mfa: true });
    const kept = await invitedBy(await actorFor(env, admin), "kept-invite@example.test");
    assert.equal((await setUserRoles(env.deps, ownerActor, admin.id, ["admin", "reviewer"], meta())).kind, "ok");
    assert.ok(await inspectInvitation(env.deps, kept), "a role added: the invitation stands");
    assert.equal((await setUserRoles(env.deps, ownerActor, admin.id, ["reviewer"], meta())).kind, "ok");
    assert.equal(await inspectInvitation(env.deps, kept), null, "a role taken: the invitation is withdrawn");
  });
});

/** An Owner, and an Admin who invites a new Editor (the link read from the mail sink). */
/** The account as a user page shows it to `actor` (its fingerprint included): what a form on that page decides on. */
const pageOf = async (actor: Actor, userId: string) => {
  const detail = await getUserDetail(env.deps, actor, userId);
  assert.ok(detail, "the user page exists");
  return detail;
};

async function invitedByAdmin(email: string) {
  const owner = await createUser(env, { roles: ["owner"], mfa: true });
  const admin = await createUser(env, { roles: ["admin"], mfa: true });
  const adminActor = await actorFor(env, admin);
  assert.equal((await inviteUser(env.deps, adminActor, { email, displayName: "Invited Person", roles: ["editor"] }, meta())).kind, "invited");
  const message = env.mail().filter((m) => m.to === email && m.kind === "invitation").at(-1);
  assert.ok(message);
  const [invited] = await db().select().from(users).where(eq(users.emailNormalized, email));
  return { ownerActor: await actorFor(env, owner), adminActor, invited, token: linkToken(message.text, "invite") };
}

describe("third review — an invitation link carries its issuer's authority, never more", () => {
  test("an Owner raising the invited account's roles withdraws the Admin's link: it activates no Owner or Admin; the Owner's new link does", async () => {
    for (const [i, raised] of [["owner"], ["admin", "editor"]].entries()) {
      const email = `raised-${i}@example.test`;
      const { ownerActor, invited, token } = await invitedByAdmin(email);
      assert.ok(await inspectInvitation(env.deps, token), "the link works before the change");
      const changed = await setUserRoles(env.deps, ownerActor, invited.id, raised, meta());
      assert.equal(changed.kind, "ok");
      assert.equal(await inspectInvitation(env.deps, token), null, `${raised}: the page offers nothing`);
      assert.deepEqual(await acceptInvitation(env.deps, { token, password: strongPassword() }, meta()), { kind: "invalid" }, `${raised}`);
      assert.equal((await userRow(invited.id)).status, "invited");
      assert.match(changed.kind === "ok" ? changed.summary : "", /their pending invitation link withdrawn/, "the Owner is told");
      // The Owner, who may grant the new roles, sends a new link: that one works (positive control).
      assert.equal((await resendInvitation(env.deps, ownerActor, invited.id, meta())).kind, "invited");
      const fresh = linkToken(env.mail().filter((m) => m.to === email && m.kind === "invitation").at(-1)!.text, "invite");
      assert.deepEqual((await inspectInvitation(env.deps, fresh))?.roles, [...raised].sort());
      assert.equal((await acceptInvitation(env.deps, { token: fresh, password: strongPassword() }, meta())).kind, "ok");
    }
  });

  test("acceptance decides again with the link and the account locked: a promotion committed while the password was being hashed wins", async () => {
    // Through a role change (which withdraws the link), and by hand (no withdrawal: the issuer's authority alone decides).
    for (const how of ["role change", "by hand"] as const) {
      const { ownerActor, invited, token } = await invitedByAdmin(`raced-${how.replace(" ", "-")}@example.test`);
      const race = pausedHash(env.deps.hasher);
      const accepting = acceptInvitation(race.deps, { token, password: strongPassword() }, meta());
      await race.hashed;
      if (how === "role change") assert.equal((await setUserRoles(env.deps, ownerActor, invited.id, ["owner"], meta())).kind, "ok");
      else await db().insert(userRoles).values({ userId: invited.id, roleKey: "owner", grantedAt: env.deps.clock() });
      race.release();
      assert.deepEqual(await accepting, { kind: "invalid" }, how);
      assert.equal((await userRow(invited.id)).status, "invited", how);
      assert.equal(await inspectInvitation(env.deps, token), null, how);
      if (how === "by hand") {
        // Refused inside the transaction: the link is withdrawn (it stays dead when the role goes again) and audited.
        await db().delete(userRoles).where(and(eq(userRoles.userId, invited.id), eq(userRoles.roleKey, "owner")));
        assert.equal(await inspectInvitation(env.deps, token), null, "withdrawn, not only refused");
        const audited = await db().select().from(auditEvents).where(and(eq(auditEvents.action, "user.invite_withdrawn"), eq(auditEvents.entityId, invited.id)));
        assert.equal(audited.length, 1);
      }
    }
  });

  test("a new link is decided under the invited account's row lock: a promotion committed meanwhile wins", async () => {
    const { adminActor, invited, token } = await invitedByAdmin("resend-raced@example.test");
    const held = await env.pool.getConnection();
    try {
      await held.query("START TRANSACTION");
      await held.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [invited.id]);
      await held.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'admin', UTC_TIMESTAMP(3))", [invited.id]);
      // Authorised against the editor role it can still see; its transaction then waits for the account's row.
      const resending = resendInvitation(env.deps, adminActor, invited.id, meta());
      await new Promise((resolve) => setTimeout(resolve, 400));
      await held.query("COMMIT");
      assert.deepEqual(await resending, { kind: "denied" });
    } finally {
      held.release();
    }
    const links = await db().select().from(authTokens).where(and(eq(authTokens.userId, invited.id), eq(authTokens.purpose, "invitation")));
    assert.equal(links.length, 1, "no new link issued");
    assert.equal(await inspectInvitation(env.deps, token), null, "and the Admin's first link no longer covers the account's roles");
  });

  test("re-enabling an invited account retires an invitation link left from around its disable", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const email = "reenabled-invite@example.test";
    assert.equal((await inviteUser(env.deps, ownerActor, { email, displayName: "Re Enabled", roles: ["editor"] }, meta())).kind, "invited");
    const [invited] = await db().select().from(users).where(eq(users.emailNormalized, email));
    assert.equal((await setUserStatus(env.deps, ownerActor, invited.id, "disabled", meta())).kind, "ok");
    // A link that slipped in around the disable (made here by hand).
    const { token } = await issueToken(db(), { userId: invited.id, purpose: "invitation", now: env.deps.clock(), createdBy: owner.id });
    assert.equal((await setUserStatus(env.deps, ownerActor, invited.id, "active", meta())).kind, "ok");
    assert.equal((await userRow(invited.id)).status, "invited");
    assert.equal(await inspectInvitation(env.deps, token), null);
    assert.deepEqual(await acceptInvitation(env.deps, { token, password: strongPassword() }, meta()), { kind: "invalid" });
  });
});

describe("fourth review — nothing decided on an older state of an account, and one snapshot per request", () => {
  test("a role change decided while the account was invited is refused once its invitation was accepted: the Owner reviews it first", async () => {
    const { ownerActor, invited, token } = await invitedByAdmin("claimed-before-save@example.test");
    // What the Owner's page showed when the Owner chose the new roles ...
    const shown = await pageOf(ownerActor, invited.id);
    assert.equal(shown.status, "invited");
    // ... before the Admin, who still holds the link, activated the account.
    assert.equal((await acceptInvitation(env.deps, { token, password: strongPassword() }, meta())).kind, "ok");
    assert.deepEqual(await setUserRoles(env.deps, ownerActor, invited.id, ["owner"], meta(), { version: shown.version }), { kind: "denied", reason: "changed" });
    assert.deepEqual(await rolesNow(invited.id), ["editor"]);
    // Decided on the account as it is now (active), the same change is the Owner's to make (positive control).
    const now = await pageOf(ownerActor, invited.id);
    assert.equal(now.status, "active");
    assert.equal((await setUserRoles(env.deps, ownerActor, invited.id, ["owner"], meta(), { version: now.version })).kind, "ok");
  });

  test("... decided again under the account's row lock: an activation committed while the change waits for it wins", async () => {
    const { ownerActor, invited } = await invitedByAdmin("claimed-under-lock@example.test");
    const shown = await pageOf(ownerActor, invited.id);
    const held = await env.pool.getConnection();
    try {
      await held.query("START TRANSACTION");
      await held.query("UPDATE users SET status = 'active' WHERE id = ?", [invited.id]);
      // Authorised against the invited account it can still see; its transaction then waits for the account's row.
      const changing = setUserRoles(env.deps, ownerActor, invited.id, ["owner"], meta(), { version: shown.version });
      await new Promise((resolve) => setTimeout(resolve, 400));
      await held.query("COMMIT");
      assert.deepEqual(await changing, { kind: "denied", reason: "changed" });
    } finally {
      held.release();
    }
    assert.deepEqual(await rolesNow(invited.id), ["editor"]);
  });

  test("a role change also withdraws a pending reset link: one minted for an Editor never sets an Admin's password", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const editor = await createUser(env, { roles: ["editor"] });
    // The server-side recovery hands an operator a reset link for the Editor.
    const recovery = await recoveryReset(env.deps, { email: editor.email, removeMfa: true }, "test-operator");
    assert.equal(recovery.kind, "ok");
    const token = linkToken(recovery.kind === "ok" ? recovery.link : "", "reset");
    assert.ok(await inspectResetToken(env.deps, token), "the link works before the change");
    const changed = await setUserRoles(env.deps, ownerActor, editor.id, ["admin"], meta());
    assert.equal(changed.kind, "ok");
    assert.equal(await inspectResetToken(env.deps, token), null);
    assert.deepEqual(await completePasswordReset(env.deps, { token, password: strongPassword() }, meta()), { kind: "invalid" });
    assert.match(changed.kind === "ok" ? changed.summary : "", /pending reset link withdrawn/);
  });

  test("one snapshot per request: a promotion committed between reading a session and its roles never shows the new roles to that session", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const editor = await createUser(env, { roles: ["editor"] });
    const editorActor = await actorFor(env, editor);
    // The request stops just before it reads the roles ...
    const paused = pausingPool(env.pool, /`user_roles`/);
    const reading = readSessionState({ ...env.deps, pool: paused.pool, db: dbFor(paused.pool) }, editorActor.token);
    await untilPaused(paused, reading);
    // ... while the Editor is made an Admin (which signs the Editor out).
    assert.equal((await setUserRoles(env.deps, ownerActor, editor.id, ["admin"], meta())).kind, "ok");
    paused.release();
    const state = await reading;
    const roles = state.kind === "active" || state.kind === "enrolment_required" ? state.principal.roles : [];
    assert.equal(roles.includes("admin"), false, `the revoked session saw the new roles (${state.kind}: ${roles.join(", ")})`);
    assert.equal((await readSessionState(env.deps, editorActor.token)).kind, "ended", "the next request: signed out");
  });

  test("one snapshot per request: a second factor removed while a password-only session is read never signs that session in", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const editor = await createUser(env, { roles: ["editor"], mfa: true });
    // A sign-in that stopped at the second factor: its session is password-only.
    const pending = await signIn(env.deps, { email: editor.email, password: editor.password }, meta("198.51.100.91"));
    assert.equal(pending.kind, "mfa_required");
    const token = pending.kind === "mfa_required" ? pending.token : "";
    // The request stops just before it reads the second factor ...
    const paused = pausingPool(env.pool, /`user_mfa`/);
    const reading = readSessionState({ ...env.deps, pool: paused.pool, db: dbFor(paused.pool) }, token);
    await untilPaused(paused, reading);
    // ... while an Owner resets the Editor's second factor (which signs the Editor out).
    assert.equal((await resetUserMfa(env.deps, ownerActor, editor.id, meta())).kind, "ok");
    paused.release();
    const state = await reading;
    assert.equal(state.kind === "active" || state.kind === "enrolment_required", false, `a password-only session was signed in (${state.kind})`);
    assert.equal((await readSessionState(env.deps, token)).kind, "ended", "the next request: signed out");
  });

  test("only the newest Owner setup link works, and none once an Owner is active", async () => {
    const isolated = await setupTestEnv("review_setup");
    try {
      const idb = dbFor(isolated.pool);
      const first = await bootstrapOwner(isolated.deps, { email: "typo-owner@example.test", displayName: "Typo Owner" }, "test-operator");
      const second = await bootstrapOwner(isolated.deps, { email: "real-owner@example.test", displayName: "Real Owner" }, "test-operator");
      assert.equal(first.kind, "created");
      assert.equal(second.kind, "created");
      const firstLink = linkToken(first.kind === "created" ? first.link : "", "invite");
      const secondLink = linkToken(second.kind === "created" ? second.link : "", "invite");
      assert.equal(await inspectInvitation(isolated.deps, firstLink), null, "the first run's link was retired by the second");
      // A setup link that slipped through anyway (made here by hand), accepted while the real Owner activates: refused
      // inside its own transaction once that Owner is active, withdrawn and audited.
      const [typo] = await idb.select().from(users).where(eq(users.emailNormalized, "typo-owner@example.test"));
      const { token: stray } = await issueToken(idb, { userId: typo.id, purpose: "owner_setup", now: isolated.deps.clock() });
      const race = pausedHash(isolated.deps.hasher, isolated.deps);
      const strayAccept = acceptInvitation(race.deps, { token: stray, password: strongPassword() }, meta());
      await race.hashed;
      assert.equal((await acceptInvitation(isolated.deps, { token: secondLink, password: strongPassword() }, meta())).kind, "ok");
      race.release();
      assert.deepEqual(await strayAccept, { kind: "invalid" });
      assert.deepEqual(await acceptInvitation(isolated.deps, { token: firstLink, password: strongPassword() }, meta()), { kind: "invalid" });
      assert.deepEqual(await activeOwnerIds(idb), [(await idb.select().from(users).where(eq(users.emailNormalized, "real-owner@example.test")))[0].id]);
      const withdrawn = await idb.select().from(auditEvents).where(eq(auditEvents.action, "auth.owner_setup_withdrawn"));
      assert.equal(withdrawn.length, 1);
    } finally {
      await isolated.close();
    }
  });

  test("a 2FA reset of an account removed meanwhile reports it gone and changes nothing", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const ownerActor = await actorFor(env, owner);
    const target = await createUser(env, { roles: ["editor"], mfa: true });
    const held = await env.pool.getConnection();
    try {
      await held.query("START TRANSACTION");
      await held.query("UPDATE users SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?", [target.id]);
      const resetting = resetUserMfa(env.deps, ownerActor, target.id, meta());
      await new Promise((resolve) => setTimeout(resolve, 400));
      await held.query("COMMIT");
      assert.deepEqual(await resetting, { kind: "not_found" });
    } finally {
      held.release();
    }
    const [factor] = await db().select({ confirmedAt: userMfa.confirmedAt }).from(userMfa).where(eq(userMfa.userId, target.id));
    assert.ok(factor?.confirmedAt, "its second factor is untouched");
  });
});

describe("fifth review — decided on the account as the page showed it; a sign-out follows the session it meant", () => {
  /** Two Owners, each signed in: O1 works on an older page while O2 changes the account. */
  async function twoOwners() {
    const o1 = await createUser(env, { roles: ["owner"], mfa: true });
    const o2 = await createUser(env, { roles: ["owner"], mfa: true });
    return { o1Actor: await actorFor(env, o1), o2Actor: await actorFor(env, o2) };
  }
  /** The other change happens a moment later (the test clock otherwise stands still). */
  const later = () => env.clock.advance(1000);

  test("a role another Owner has just taken away is not given back by a form that still showed it", async () => {
    const { o1Actor, o2Actor } = await twoOwners();
    const x = await createUser(env, { roles: ["admin"], mfa: true });
    // O1's page shows X as an Admin ...
    const shown = await pageOf(o1Actor, x.id);
    assert.deepEqual(shown.roles, ["admin"]);
    // ... while O2 demotes X to Editor.
    later();
    assert.equal((await setUserRoles(env.deps, o2Actor, x.id, ["editor"], meta())).kind, "ok");
    // O1, on the page that still shows Admin ticked, adds Reviewer and saves: refused, X stays an Editor.
    assert.deepEqual(await setUserRoles(env.deps, o1Actor, x.id, ["admin", "reviewer"], meta(), { version: shown.version }), { kind: "denied", reason: "changed" });
    assert.deepEqual(await rolesNow(x.id), ["editor"]);
    // Positive control: decided on the page as it is now.
    const now = await pageOf(o1Actor, x.id);
    assert.equal((await setUserRoles(env.deps, o1Actor, x.id, ["editor", "reviewer"], meta(), { version: now.version })).kind, "ok");
    assert.deepEqual(await rolesNow(x.id), ["editor", "reviewer"]);
  });

  test("... decided under the account's row lock: a demotion committed while the change waits for the row wins", async () => {
    const { o1Actor } = await twoOwners();
    const x = await createUser(env, { roles: ["admin"], mfa: true });
    const shown = await pageOf(o1Actor, x.id);
    const held = await env.pool.getConnection();
    try {
      // Another Owner's demotion, made as every role change is: the account's row first.
      await held.query("START TRANSACTION");
      await held.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [x.id]);
      await held.query("DELETE FROM user_roles WHERE user_id = ? AND role_key = 'admin'", [x.id]);
      await held.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'editor', UTC_TIMESTAMP(3))", [x.id]);
      const changing = setUserRoles(env.deps, o1Actor, x.id, ["admin", "reviewer"], meta(), { version: shown.version });
      await new Promise((resolve) => setTimeout(resolve, 400));
      await held.query("COMMIT");
      assert.deepEqual(await changing, { kind: "denied", reason: "changed" });
    } finally {
      held.release();
    }
    assert.deepEqual(await rolesNow(x.id), ["editor"]);
  });

  test("an enable decided on an earlier disable never undoes a newer one; disabling is never refused for it", async () => {
    const { o1Actor, o2Actor } = await twoOwners();
    const x = await createUser(env, { roles: ["editor"] });
    assert.equal((await setUserStatus(env.deps, o2Actor, x.id, "disabled", meta())).kind, "ok");
    // O1's page shows the account disabled (and offers "Enable account") ...
    const shown = await pageOf(o1Actor, x.id);
    assert.equal(shown.status, "disabled");
    // ... while O2 enables it again, then disables it once more (a compromise, say).
    later();
    assert.equal((await setUserStatus(env.deps, o2Actor, x.id, "active", meta())).kind, "ok");
    later();
    assert.equal((await setUserStatus(env.deps, o2Actor, x.id, "disabled", meta())).kind, "ok");
    assert.deepEqual(await setUserStatus(env.deps, o1Actor, x.id, "active", meta(), { version: shown.version }), { kind: "denied", reason: "changed" });
    assert.equal((await userRow(x.id)).status, "disabled");
    // Positive controls: an enable decided on the page as it is now goes through, and a disable from the older page too.
    later();
    const now = await pageOf(o1Actor, x.id);
    assert.equal((await setUserStatus(env.deps, o1Actor, x.id, "active", meta(), { version: now.version })).kind, "ok");
    later();
    assert.equal((await setUserStatus(env.deps, o1Actor, x.id, "disabled", meta(), { version: shown.version })).kind, "ok");
    assert.equal((await userRow(x.id)).status, "disabled");
  });

  test("an unlock decided on an earlier lock does not clear a newer one", async () => {
    const { o1Actor } = await twoOwners();
    const x = await createUser(env, { roles: ["editor"] });
    const lockFor = (minutes: number) => db().update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + minutes * 60_000) }).where(eq(users.id, x.id));
    await lockFor(15);
    const shown = await pageOf(o1Actor, x.id);
    assert.ok(shown.lockedUntil, "the page shows the lock");
    // The lock ends and more failed attempts lock the account again, for longer.
    env.clock.advance(16 * 60_000);
    await lockFor(30);
    const relocked = (await userRow(x.id)).lockedUntil;
    assert.deepEqual(await unlockUser(env.deps, o1Actor, x.id, meta(), { version: shown.unlockVersion }), { kind: "denied", reason: "changed" });
    assert.equal((await userRow(x.id)).lockedUntil?.getTime(), relocked?.getTime(), "the newer lock stays");
    const now = await pageOf(o1Actor, x.id);
    assert.equal((await unlockUser(env.deps, o1Actor, x.id, meta(), { version: now.unlockVersion })).kind, "ok");
    assert.equal((await userRow(x.id)).lockedUntil, null);
  });

  test("a 2FA reset decided on an earlier authenticator does not remove a newer one", async () => {
    const { o1Actor } = await twoOwners();
    const x = await createUser(env, { roles: ["editor"], mfa: true });
    const shown = await pageOf(o1Actor, x.id);
    assert.equal(shown.mfaEnabled, true);
    // X replaces the authenticator meanwhile (a newer confirmation).
    later();
    await db().update(userMfa).set({ confirmedAt: new Date(env.clock.now) }).where(eq(userMfa.userId, x.id));
    assert.deepEqual(await resetUserMfa(env.deps, o1Actor, x.id, meta(), { version: shown.mfaResetVersion }), { kind: "denied", reason: "changed" });
    const [factor] = await db().select({ confirmedAt: userMfa.confirmedAt }).from(userMfa).where(eq(userMfa.userId, x.id));
    assert.ok(factor?.confirmedAt, "the newer authenticator stays");
    const now = await pageOf(o1Actor, x.id);
    assert.equal((await resetUserMfa(env.deps, o1Actor, x.id, meta(), { version: now.mfaResetVersion })).kind, "ok");
  });

  test("a new invitation link is not issued for roles the page did not show", async () => {
    const { o2Actor } = await twoOwners();
    const { ownerActor, invited } = await invitedByAdmin("resend-stale@example.test");
    const shown = await pageOf(ownerActor, invited.id);
    later();
    assert.equal((await setUserRoles(env.deps, o2Actor, invited.id, ["admin"], meta())).kind, "ok");
    assert.deepEqual(await resendInvitation(env.deps, ownerActor, invited.id, meta(), { version: shown.version }), { kind: "changed" });
    const now = await pageOf(ownerActor, invited.id);
    assert.equal((await resendInvitation(env.deps, ownerActor, invited.id, meta(), { version: now.version })).kind, "invited");
  });

  test("signing out a session from the list also ends the session it rotated into after the list was shown", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const here = await actorFor(env, user);
    const there = await actorFor(env, user);
    // The other device's session rotates after the list was shown (its 30-minute rotation, a step-up …).
    const successor = await inTransaction(env.pool, (tx) => rotateSession(tx, there.session, { now: env.deps.clock(), ip: null, userAgent: null }));
    assert.equal(await revokeOwnSession(env.deps, here, there.session.id, meta()), true, "the list says it was signed out");
    assert.equal((await readSessionState(env.deps, successor.token)).kind, "ended", "the device's new session ended too");
    assert.equal((await readSessionState(env.deps, here.token)).kind, "active", "the session looking at the list lives on");
  });

  test("an Owner signing out one session of a user also ends the session it rotated into", async () => {
    const { o1Actor } = await twoOwners();
    const user = await createUser(env, { roles: ["editor"] });
    const session = await actorFor(env, user);
    const successor = await inTransaction(env.pool, (tx) => rotateSession(tx, session.session, { now: env.deps.clock(), ip: null, userAgent: null }));
    const result = await revokeSessionsOf(env.deps, o1Actor, user.id, session.session.id, meta());
    assert.equal(result.kind, "ok");
    assert.match(result.kind === "ok" ? result.summary : "", /out of 1 session/);
    assert.equal((await readSessionState(env.deps, successor.token)).kind, "ended");
  });

  test("a lockout ends the session the failing step-up came from, even when it rotated meanwhile", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    const current = { session: actor.session, user: actor.user, roles: actor.roles };
    for (let i = 0; i < 4; i++) assert.equal((await reauthenticate(env.deps, current, { password: `wrong-${i}` }, meta("198.51.100.60"))).kind, "failed");
    // A request on the same session rotates it while the fifth wrong password is being checked.
    const successor = await inTransaction(env.pool, (tx) => rotateSession(tx, actor.session, { now: env.deps.clock(), ip: null, userAgent: null }));
    assert.deepEqual(await reauthenticate(env.deps, current, { password: "wrong-4" }, meta("198.51.100.60")), { kind: "failed", locked: true });
    assert.equal((await readSessionState(env.deps, successor.token)).kind, "ended", "the session the guesses came from ended, successor included");
  });

  test("sign-out ends the session another tab's request rotated it into after this one read it", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const tab = await actorFor(env, user);
    const successor = await inTransaction(env.pool, (tx) => rotateSession(tx, tab.session, { now: env.deps.clock(), ip: null, userAgent: null }));
    await signOut(env.deps, { session: tab.session, user: tab.user, roles: tab.roles }, meta());
    assert.equal((await readSessionState(env.deps, successor.token)).kind, "ended");
  });

  test("every connection reads at REPEATABLE READ, whatever the server's default", async () => {
    const raw = await serverConnection(env.database);
    try {
      // A host whose default is READ COMMITTED: the connection setup puts it back.
      await raw.query("SET SESSION transaction_isolation = 'READ-COMMITTED'");
      await raw.query(CONNECTION_SETUP);
      const [rows] = await raw.query("SELECT @@SESSION.transaction_isolation AS level");
      assert.equal((rows as { level: string }[])[0].level, "REPEATABLE-READ");
    } finally {
      await raw.end();
    }
    const pooled = await env.pool.getConnection();
    try {
      const [rows] = await pooled.query("SELECT @@SESSION.transaction_isolation AS level");
      assert.equal((rows as { level: string }[])[0].level, "REPEATABLE-READ");
    } finally {
      pooled.release();
    }
  });

  test("removing a second factor withdraws pending reset links; the emergency reset's own new link still works", async () => {
    const { o1Actor } = await twoOwners();
    // The Owner's reset.
    const x = await createUser(env, { roles: ["editor"], mfa: true });
    const xLink = await issueToken(db(), { userId: x.id, purpose: "password_reset", now: env.deps.clock() });
    assert.ok(await inspectResetToken(env.deps, xLink.token), "the link works before");
    assert.equal((await resetUserMfa(env.deps, o1Actor, x.id, meta())).kind, "ok");
    assert.equal(await inspectResetToken(env.deps, xLink.token), null);
    assert.deepEqual(await completePasswordReset(env.deps, { token: xLink.token, password: strongPassword() }, meta()), { kind: "invalid" });
    // The user turning it off.
    const y = await createUser(env, { roles: ["editor"], mfa: true });
    const yActor = await actorFor(env, y);
    const yLink = await issueToken(db(), { userId: y.id, purpose: "password_reset", now: env.deps.clock() });
    assert.equal((await disableMfa(env.deps, { session: yActor.session, user: yActor.user, roles: yActor.roles }, meta())).kind, "ok");
    assert.equal(await inspectResetToken(env.deps, yLink.token), null);
    // Positive control: the emergency reset issues its link after removing the factor, and that link works.
    const z = await createUser(env, { roles: ["editor"], mfa: true });
    await emergencyMfaReset(env.deps, { userIds: [z.id] }, "test-operator", "emergency-test");
    const message = env.mail().filter((m) => m.to === z.email).at(-1);
    assert.ok(message, "the reset link was sent to the mail sink");
    assert.ok(await inspectResetToken(env.deps, linkToken(message.text, "reset")));
  });

  test("a change that signs a user out also ends sessions already past their limit by its clock", async () => {
    const { o1Actor } = await twoOwners();
    const x = await createUser(env, { roles: ["editor"] });
    const xActor = await actorFor(env, x);
    // X's session reaches its 12-hour limit between a slower request's clock and the clock of the change.
    await db().update(sessions).set({ absoluteExpiresAt: new Date(env.clock.now.getTime() + 1000) }).where(eq(sessions.id, xActor.session.id));
    env.clock.advance(2000);
    const changed = await setUserRoles(env.deps, o1Actor, x.id, ["admin"], meta());
    assert.equal(changed.kind, "ok");
    assert.match(changed.kind === "ok" ? changed.summary : "", /0 session\(s\) signed out/, "only live sessions are counted");
    // A request whose clock is behind (it read the time before it got its connection) finds the session ended.
    const behind = { ...env.deps, clock: () => new Date(env.clock.now.getTime() - 2000) };
    assert.equal((await readSessionState(behind, xActor.token)).kind, "ended");
  });

  test("a recovery code used for a step-up is recorded and notified, as at sign-in", async () => {
    const x = await createUser(env, { roles: ["editor"], mfa: true });
    const xActor = await actorFor(env, x);
    const current = { session: xActor.session, user: xActor.user, roles: xActor.roles };
    const codes = await regenerateRecoveryCodes(env.deps, current, meta());
    assert.ok(codes?.length);
    const before = env.mail().length;
    const result = await reauthenticate(env.deps, current, { password: x.password, code: codes[0] }, meta("198.51.100.61"));
    assert.equal(result.kind, "ok");
    const recorded = await db()
      .select({ summary: auditEvents.summary })
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "auth.recovery_code_used"), eq(auditEvents.entityId, x.id)));
    assert.equal(recorded.length, 1);
    assert.match(recorded[0].summary, /confirm identity/);
    const notices = env.mail().slice(before).filter((m) => m.to === x.email);
    assert.ok(notices.some((m) => /recovery code was just used/.test(m.text)), "the user is told");
  });
});

describe("sixth review — each change is decided on exactly what it depends on, as the page showed it", () => {
  async function owner() {
    const o = await createUser(env, { roles: ["owner"], mfa: true });
    return actorFor(env, o);
  }

  test("an unlock is refused when more attempts were made after the page was shown, even without a newer lock", async () => {
    const ownerActor = await owner();
    const x = await createUser(env, { roles: ["editor"] });
    await db().update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + 15 * 60_000), failedLoginCount: 5 }).where(eq(users.id, x.id));
    const shown = await pageOf(ownerActor, x.id);
    assert.ok(shown.lockedUntil, "the page shows the lock");
    // The lock ends, and two more wrong passwords are counted (not enough for a new lock).
    env.clock.advance(16 * 60_000);
    for (const i of [1, 2]) assert.equal((await signIn(env.deps, { email: x.email, password: `wrong-${i}` }, meta("198.51.100.62"))).kind, "failed");
    assert.equal((await userRow(x.id)).failedLoginCount, 7);
    assert.equal((await userRow(x.id)).lockedUntil?.getTime(), shown.lockedUntil.getTime(), "no newer lock");
    assert.deepEqual(await unlockUser(env.deps, ownerActor, x.id, meta(), { version: shown.unlockVersion }), { kind: "denied", reason: "changed" });
    assert.equal((await userRow(x.id)).failedLoginCount, 7, "the attempts the Owner did not see stay counted");
    const now = await pageOf(ownerActor, x.id);
    assert.equal((await unlockUser(env.deps, ownerActor, x.id, meta(), { version: now.unlockVersion })).kind, "ok");
    assert.equal((await userRow(x.id)).failedLoginCount, 0);
  });

  test("the user's own password change or failed sign-ins do not block an Owner's change decided on the page", async () => {
    const ownerActor = await owner();
    const x = await createUser(env, { roles: ["editor"] });
    const xActor = await actorFor(env, x);
    const shown = await pageOf(ownerActor, x.id);
    env.clock.advance(1000);
    // X changes their password, and a wrong password is tried on X's address.
    const current = { session: xActor.session, user: xActor.user, roles: xActor.roles };
    assert.equal((await changePassword(env.deps, current, { currentPassword: x.password, newPassword: strongPassword() }, meta("198.51.100.63"))).kind, "ok");
    assert.equal((await signIn(env.deps, { email: x.email, password: "wrong-password-here" }, meta("198.51.100.64"))).kind, "failed");
    // The Owner's change, decided on the page, still goes through: neither affects what it was decided on.
    assert.equal((await setUserRoles(env.deps, ownerActor, x.id, ["editor", "reviewer"], meta(), { version: shown.version })).kind, "ok");
    assert.deepEqual(await rolesNow(x.id), ["editor", "reviewer"]);
  });
});

describe("seventh review — a two-factor reset and an unlock are decided on everything they depend on", () => {
  async function owner() {
    const o = await createUser(env, { roles: ["owner"], mfa: true });
    return actorFor(env, o);
  }
  const later = () => env.clock.advance(1000);
  /** A well-formed code that is wrong at every step the check accepts (now ± 1). */
  function wrongCode(secret: Buffer): string {
    const now = env.deps.clock().getTime();
    const valid = new Set([-1, 0, 1].map((offset) => totpCode(secret, now + offset * 30_000)));
    for (let n = 0; ; n++) {
      const code = String(n).padStart(6, "0");
      if (!valid.has(code)) return code;
    }
  }
  const secondFactorOf = async (userId: string) =>
    (await db().select({ confirmedAt: userMfa.confirmedAt }).from(userMfa).where(eq(userMfa.userId, userId)))[0]?.confirmedAt ?? null;

  test("a two-factor reset is refused once the password was replaced after the page was shown", async () => {
    const ownerActor = await owner();
    const x = await createUser(env, { roles: ["admin"], mfa: true });
    // The Owner opens X's page to reset the authenticator X reported lost ...
    const shown = await pageOf(ownerActor, x.id);
    assert.equal(shown.mfaEnabled, true);
    // ... while someone holding a reset link for X (X's mailbox, say) sets a new password.
    later();
    const { token } = await issueToken(db(), { userId: x.id, purpose: "password_reset", now: env.deps.clock() });
    assert.deepEqual(await completePasswordReset(env.deps, { token, password: strongPassword() }, meta("198.51.100.71")), { kind: "ok" });
    // The reset decided on the page is refused: the second factor stays, the only thing between that password and X's account.
    assert.deepEqual(await resetUserMfa(env.deps, ownerActor, x.id, meta(), { version: shown.mfaResetVersion }), { kind: "denied", reason: "changed" });
    assert.ok(await secondFactorOf(x.id), "the second factor stays");
    // Reloaded, the page shows the password change; a reset decided on that is the Owner's to make (positive control).
    const now = await pageOf(ownerActor, x.id);
    assert.notEqual(now.passwordChangedAt?.getTime(), shown.passwordChangedAt?.getTime());
    assert.equal((await resetUserMfa(env.deps, ownerActor, x.id, meta(), { version: now.mfaResetVersion })).kind, "ok");
    assert.equal(await secondFactorOf(x.id), null);
  });

  test("... and once second-factor codes failed after the page was shown (someone else has the password)", async () => {
    const ownerActor = await owner();
    const x = await createUser(env, { roles: ["admin"], mfa: true });
    const shown = await pageOf(ownerActor, x.id);
    // Someone with X's password signs in and tries a code: the failure is counted.
    later();
    const pending = await signIn(env.deps, { email: x.email, password: x.password }, meta("198.51.100.72"));
    assert.equal(pending.kind, "mfa_required");
    const found = await findSessionByToken(db(), pending.kind === "mfa_required" ? pending.token : "", env.deps.clock());
    assert.ok(found);
    assert.deepEqual(await verifySecondFactor(env.deps, found, { code: wrongCode(x.totpSecret as Buffer) }, meta("198.51.100.72")), { kind: "failed", locked: false });
    assert.equal((await userRow(x.id)).failedLoginCount, 1);
    assert.deepEqual(await resetUserMfa(env.deps, ownerActor, x.id, meta(), { version: shown.mfaResetVersion }), { kind: "denied", reason: "changed" });
    assert.ok(await secondFactorOf(x.id), "the second factor stays");
    const now = await pageOf(ownerActor, x.id);
    assert.equal(now.failedLoginCount, 1, "the reloaded page shows the failed attempt");
    assert.equal((await resetUserMfa(env.deps, ownerActor, x.id, meta(), { version: now.mfaResetVersion })).kind, "ok");
  });

  test("an unlock is refused once the second factor was reset or the account disabled after the page was shown", async () => {
    const o1Actor = await owner();
    const o2Actor = await owner();
    const x = await createUser(env, { roles: ["editor"], mfa: true });
    await db().update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + 15 * 60_000), failedLoginCount: 5 }).where(eq(users.id, x.id));
    const shown = await pageOf(o1Actor, x.id);
    assert.ok(shown.lockedUntil && shown.mfaEnabled, "the page shows a locked account with its second factor");
    // Another Owner resets X's second factor; the lock and the attempts stay as they were.
    later();
    assert.equal((await resetUserMfa(env.deps, o2Actor, x.id, meta())).kind, "ok");
    assert.equal((await userRow(x.id)).failedLoginCount, 5);
    // The unlock decided on the page that showed the second factor is refused: the lock stays on a password-only account.
    assert.deepEqual(await unlockUser(env.deps, o1Actor, x.id, meta(), { version: shown.unlockVersion }), { kind: "denied", reason: "changed" });
    assert.ok((await userRow(x.id)).lockedUntil, "the lock stays");
    // So does one decided before a disable.
    const again = await pageOf(o1Actor, x.id);
    later();
    assert.equal((await setUserStatus(env.deps, o2Actor, x.id, "disabled", meta())).kind, "ok");
    assert.deepEqual(await unlockUser(env.deps, o1Actor, x.id, meta(), { version: again.unlockVersion }), { kind: "denied", reason: "changed" });
    // Positive control: decided on the page as it is now.
    const now = await pageOf(o1Actor, x.id);
    assert.equal((await unlockUser(env.deps, o1Actor, x.id, meta(), { version: now.unlockVersion })).kind, "ok");
    assert.equal((await userRow(x.id)).lockedUntil, null);
  });
});

describe("eighth review — a two-factor reset decided on who may hold the password; the emergency reset takes the user's row first", () => {
  async function owner() {
    const o = await createUser(env, { roles: ["owner"], mfa: true });
    return actorFor(env, o);
  }
  const secondFactorOf = async (userId: string) =>
    (await db().select({ confirmedAt: userMfa.confirmedAt }).from(userMfa).where(eq(userMfa.userId, userId)))[0]?.confirmedAt ?? null;

  test("wrong passwords alone (anyone who knows the email can send them) do not refuse a two-factor reset decided on the page", async () => {
    const ownerActor = await owner();
    const x = await createUser(env, { roles: ["editor"], mfa: true });
    const shown = await pageOf(ownerActor, x.id);
    env.clock.advance(1000);
    for (const i of [1, 2]) {
      assert.equal((await signIn(env.deps, { email: x.email, password: `not-the-password-${i}` }, meta("198.51.100.81"))).kind, "failed");
    }
    assert.equal((await userRow(x.id)).failedLoginCount, 2);
    assert.equal((await userRow(x.id)).lockedUntil, null, "no lock");
    assert.equal((await resetUserMfa(env.deps, ownerActor, x.id, meta(), { version: shown.mfaResetVersion })).kind, "ok");
    assert.equal(await secondFactorOf(x.id), null);
  });

  test("the emergency two-factor reset touches nothing while another change holds the user's row", async () => {
    const x = await createUser(env, { roles: ["editor"], mfa: true });
    const held = await env.pool.getConnection();
    const probe = await env.pool.getConnection();
    let resetting: Promise<unknown> | undefined;
    try {
      // A change decided under the user's row lock (an Owner's on the user page, say) is under way ...
      await held.query("START TRANSACTION");
      await held.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [x.id]);
      let done = false;
      const running = emergencyMfaReset(env.deps, { userIds: [x.id] }, "test-operator", "review-8");
      resetting = running.finally(() => (done = true));
      await new Promise((resolve) => setTimeout(resolve, 400));
      // ... and the emergency reset waits for it (still running) before it touches the second factor (its row is free).
      assert.equal(done, false, "the reset waits for the user's row");
      await probe.query("START TRANSACTION");
      const [rows] = await probe.query("SELECT user_id FROM user_mfa WHERE user_id = ? FOR UPDATE NOWAIT", [x.id]);
      assert.equal((rows as unknown[]).length, 1, "the second factor is there and free");
      await probe.query("ROLLBACK");
      await held.query("COMMIT");
      const result = await running;
      assert.equal(result.users.length, 1);
    } finally {
      await probe.query("ROLLBACK").catch(() => {});
      await held.query("ROLLBACK").catch(() => {});
      held.release();
      probe.release();
      await resetting?.catch(() => {});
    }
    assert.equal(await secondFactorOf(x.id), null, "removed once the row was free");
  });
});

/** A pool whose first statement matching `match` fails with a database error the code does not retry. */
function failingPool(pool: Pool, match: (text: string) => boolean) {
  let armed = true;
  const textOf = (args: unknown[]) =>
    JSON.stringify(args, (_key, value) => (typeof value === "function" ? undefined : typeof value === "bigint" ? String(value) : value)) ?? "";
  const failing =
    (target: object, fn: (...args: unknown[]) => unknown) =>
    async (...args: unknown[]) => {
      if (armed && match(textOf(args))) {
        armed = false;
        throw Object.assign(new Error("simulated lock wait timeout"), { code: "ER_LOCK_WAIT_TIMEOUT", errno: 1205 });
      }
      return fn.apply(target, args);
    };
  // As pausingPool: getters on the real object, overrides matched on their own keys only.
  const wrap = <T extends object>(target: T, extra: Partial<Record<string | symbol, unknown>> = {}): T =>
    new Proxy(target, {
      get(object, prop) {
        if (Object.hasOwn(extra, prop)) return extra[prop];
        const value = Reflect.get(object, prop, object);
        if ((prop === "query" || prop === "execute") && typeof value === "function") return failing(object, value as (...args: unknown[]) => unknown);
        return typeof value === "function" ? value.bind(object) : value;
      },
    });
  return wrap(pool, { getConnection: async () => wrap<PoolConnection>(await pool.getConnection()) });
}

describe("ninth review — a two-factor reset sees every use of the password after the page; the emergency reset reports each user", () => {
  async function owner() {
    const o = await createUser(env, { roles: ["owner"], mfa: true });
    return actorFor(env, o);
  }
  const secondFactorOf = async (userId: string) =>
    (await db().select({ confirmedAt: userMfa.confirmedAt }).from(userMfa).where(eq(userMfa.userId, userId)))[0]?.confirmedAt ?? null;
  /** A well-formed code that is wrong at every step the check accepts (now ± 1). */
  function wrongCode(secret: Buffer): string {
    const now = env.deps.clock().getTime();
    const valid = new Set([-1, 0, 1].map((offset) => totpCode(secret, now + offset * 30_000)));
    for (let n = 0; ; n++) {
      const code = String(n).padStart(6, "0");
      if (!valid.has(code)) return code;
    }
  }
  async function pendingOf(user: { email: string; password: string }, ip: string) {
    const pending = await signIn(env.deps, { email: user.email, password: user.password }, meta(ip));
    assert.equal(pending.kind, "mfa_required");
    const found = await findSessionByToken(db(), pending.kind === "mfa_required" ? pending.token : "", env.deps.clock());
    assert.ok(found);
    return found;
  }

  test("a sign-in that passed the password after the page was shown refuses a two-factor reset, even one that tried no code", async () => {
    const ownerActor = await owner();
    const x = await createUser(env, { roles: ["admin"], mfa: true });
    const shown = await pageOf(ownerActor, x.id);
    env.clock.advance(1000);
    await pendingOf(x, "198.51.100.91");
    assert.deepEqual(await resetUserMfa(env.deps, ownerActor, x.id, meta(), { version: shown.mfaResetVersion }), { kind: "denied", reason: "changed" });
    assert.ok(await secondFactorOf(x.id), "the second factor stays");
    // ... and so does a complete sign-in (the second factor passed).
    const again = await pageOf(ownerActor, x.id);
    env.clock.advance(1000);
    const pending = await pendingOf(x, "198.51.100.92");
    assert.equal((await verifySecondFactor(env.deps, pending, { code: codeFor(env, x) }, meta("198.51.100.92"))).kind, "signed_in");
    assert.deepEqual(await resetUserMfa(env.deps, ownerActor, x.id, meta(), { version: again.mfaResetVersion }), { kind: "denied", reason: "changed" });
    // Positive control: decided on the page as it is now.
    const now = await pageOf(ownerActor, x.id);
    assert.equal((await resetUserMfa(env.deps, ownerActor, x.id, meta(), { version: now.mfaResetVersion })).kind, "ok");
  });

  test("a wrong recovery code at sign-in or a wrong step-up code after the page was shown refuses it; a lock from wrong passwords alone does not", async () => {
    const ownerActor = await owner();
    // A wrong recovery code in a sign-in that passed the password before the page was shown.
    const a = await createUser(env, { roles: ["editor"], mfa: true });
    const pending = await pendingOf(a, "198.51.100.93");
    const shownA = await pageOf(ownerActor, a.id);
    env.clock.advance(1000);
    assert.equal((await verifySecondFactor(env.deps, pending, { recoveryCode: "AAAAA-BBBBB-CCCCC-DDDDD" }, meta("198.51.100.93"))).kind, "failed");
    assert.deepEqual(await resetUserMfa(env.deps, ownerActor, a.id, meta(), { version: shownA.mfaResetVersion }), { kind: "denied", reason: "changed" });
    // A wrong code at a step-up in a session of the account.
    const b = await createUser(env, { roles: ["editor"], mfa: true });
    const bActor = await actorFor(env, b);
    const shownB = await pageOf(ownerActor, b.id);
    env.clock.advance(1000);
    const current = { session: bActor.session, user: bActor.user, roles: bActor.roles };
    assert.equal((await reauthenticate(env.deps, current, { password: b.password, code: wrongCode(b.totpSecret as Buffer) }, meta("198.51.100.94"))).kind, "failed");
    assert.deepEqual(await resetUserMfa(env.deps, ownerActor, b.id, meta(), { version: shownB.mfaResetVersion }), { kind: "denied", reason: "changed" });
    // A lock from five wrong passwords (anyone who knows the email): the reset decided on the page still goes through.
    const c = await createUser(env, { roles: ["editor"], mfa: true });
    const shownC = await pageOf(ownerActor, c.id);
    env.clock.advance(1000);
    for (const i of [1, 2, 3, 4, 5]) {
      assert.equal((await signIn(env.deps, { email: c.email, password: `not-it-${i}` }, meta("198.51.100.95"))).kind, "failed");
    }
    assert.ok((await userRow(c.id)).lockedUntil, "the account is locked");
    assert.equal((await resetUserMfa(env.deps, ownerActor, c.id, meta(), { version: shownC.mfaResetVersion })).kind, "ok");
  });

  test("the emergency reset reports a user it could not reset and goes on with the others", async () => {
    const a = await createUser(env, { roles: ["editor"], mfa: true });
    const b = await createUser(env, { roles: ["editor"], mfa: true });
    const c = await createUser(env, { roles: ["editor"], mfa: true });
    // B's reset fails at its first statement (as a second deadlock or a lock wait timeout would).
    const pool = failingPool(env.pool, (text) => /for update/i.test(text) && text.includes(b.id));
    const result = await emergencyMfaReset({ ...env.deps, pool, db: dbFor(pool) }, { userIds: [a.id, b.id, c.id] }, "test-operator", "review-9");
    assert.deepEqual(
      result.users.map((u) => [u.id, Boolean(u.link || u.delivered), u.error ?? null]),
      [
        [a.id, true, null],
        [b.id, false, "ER_LOCK_WAIT_TIMEOUT"],
        [c.id, true, null],
      ],
    );
    assert.equal(result.users[1].email, b.email, "the operator is told which account");
    assert.equal(await secondFactorOf(a.id), null);
    assert.ok(await secondFactorOf(b.id), "nothing was changed for the account that failed");
    assert.equal(await secondFactorOf(c.id), null);
  });
});
