/** Sign-in: success, enumeration resistance, account states, lockout, per-address throttle, rehash, evidence. */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, asc, eq } from "drizzle-orm";
import { signIn } from "../../src/server/auth/sign-in.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditEvents, loginAttempts, sessions, users } from "../../src/server/db/schema.ts";
import { createPasswordHasher } from "../../src/server/security/password.ts";
import { sha256 } from "../../src/server/security/ids.ts";
import { createUser, meta, setupTestEnv, strongPassword, type TestEnv } from "./helpers.ts";

const MIN = 60_000;
let env: TestEnv;
before(async () => {
  env = await setupTestEnv("signin");
});
after(async () => env?.close());

describe("password sign-in", () => {
  test("an active user with the right password gets a full session (stored as a hash only)", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const result = await signIn(env.deps, { email: `  ${user.email.toUpperCase()} `, password: user.password }, meta());
    assert.equal(result.kind, "signed_in");
    if (result.kind !== "signed_in") return;
    assert.match(result.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(result.enrolmentRequired, false);
    const [row] = await dbFor(env.pool).select().from(sessions).where(eq(sessions.id, result.session.id));
    assert.deepEqual(row.tokenHash, sha256(result.token));
    assert.equal(row.absoluteExpiresAt.getTime() - row.createdAt.getTime(), 12 * 60 * MIN);
    assert.equal(row.idleExpiresAt.getTime() - row.createdAt.getTime(), 2 * 60 * MIN);
    const [u] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    assert.equal(u.failedLoginCount, 0);
    assert.ok(u.lastLoginAt);
  });

  test("Owner and Admin without 2FA must enrol before anything else", async () => {
    const admin = await createUser(env, { roles: ["admin"] });
    const result = await signIn(env.deps, { email: admin.email, password: admin.password }, meta());
    assert.equal(result.kind, "signed_in");
    assert.equal(result.kind === "signed_in" && result.enrolmentRequired, true);
  });

  test("unknown email, wrong password, disabled and invited accounts all fail the same way", async () => {
    const active = await createUser(env, { roles: ["reviewer"] });
    const disabled = await createUser(env, { roles: ["reviewer"], status: "disabled" });
    const invited = await createUser(env, { roles: ["reviewer"], status: "invited" });
    const results = [
      await signIn(env.deps, { email: "nobody@example.test", password: "whatever password 123" }, meta()),
      await signIn(env.deps, { email: active.email, password: `${active.password}x` }, meta()),
      await signIn(env.deps, { email: disabled.email, password: disabled.password }, meta()),
      await signIn(env.deps, { email: invited.email, password: "anything at all 1234" }, meta()),
      await signIn(env.deps, { email: "not an email", password: "" }, meta()),
    ];
    for (const result of results) assert.deepEqual(result, { kind: "failed" });
  });

  test("an unknown email takes about as long as a wrong password (a dummy hash is verified)", async () => {
    const user = await createUser(env, { roles: ["reviewer"] });
    const time = async (email: string) => {
      const start = performance.now();
      await signIn(env.deps, { email, password: "a wrong password 1234" }, meta("198.51.100.77"));
      return performance.now() - start;
    };
    await time("warm-up@example.test");
    const unknown: number[] = [];
    const wrong: number[] = [];
    for (let i = 0; i < 3; i++) {
      unknown.push(await time(`nobody-${i}@example.test`));
      wrong.push(await time(user.email));
    }
    const median = (xs: number[]) => xs.sort((a, b) => a - b)[1];
    // Both paths verify one Argon2id hash (tens of milliseconds); the difference is a few database writes.
    assert.ok(median(unknown) > 15, `unknown-email path too fast: ${median(unknown).toFixed(1)} ms`);
    assert.ok(Math.abs(median(unknown) - median(wrong)) < Math.max(median(wrong), median(unknown)) * 0.6);
  });
});

describe("lockout", () => {
  test("5 failures in 15 minutes lock the account for 15 minutes; even the right password then fails", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const ip = "192.0.2.20";
    for (let i = 0; i < 5; i++) assert.equal((await signIn(env.deps, { email: user.email, password: "wrong password 1234" }, meta(ip))).kind, "failed");
    const [locked] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    assert.equal(locked.lockedUntil?.getTime(), env.clock.now.getTime() + 15 * MIN);
    assert.equal(locked.failedLoginCount, 5);
    assert.deepEqual(await signIn(env.deps, { email: user.email, password: user.password }, meta(ip)), { kind: "failed" });
    // The 6th attempt (the right password, during the lock) is refused before any password check: the email's 5
    // credential checks of the last 15 minutes are used (A2 Correction 1), so it is recorded before the account lookup.
    const attempts = await dbFor(env.pool)
      .select({ reason: loginAttempts.failureReason, ok: loginAttempts.succeeded })
      .from(loginAttempts)
      .where(eq(loginAttempts.emailHash, sha256(user.email.toLowerCase())))
      .orderBy(asc(loginAttempts.id));
    assert.deepEqual(
      attempts.map((a) => a.reason),
      ["bad_credentials", "bad_credentials", "bad_credentials", "bad_credentials", "bad_credentials", "rate_limited"],
    );
    env.clock.advance(15 * MIN + 1);
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta(ip))).kind, "signed_in");
  });

  test("failures spread over more than 15 minutes do not lock", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    for (let i = 0; i < 8; i++) {
      await signIn(env.deps, { email: user.email, password: "wrong password 1234" }, meta("192.0.2.21"));
      env.clock.advance(4 * MIN);
    }
    const [row] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    assert.equal(row.lockedUntil, null);
  });

  test("repeated locks double (15, 30, 60 minutes …) and never exceed 24 hours", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const durations: number[] = [];
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 5; i++) await signIn(env.deps, { email: user.email, password: "wrong password 1234" }, meta("192.0.2.22"));
      const [row] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
      durations.push(((row.lockedUntil?.getTime() ?? 0) - env.clock.now.getTime()) / MIN);
      env.clock.advance((row.lockedUntil?.getTime() ?? 0) - env.clock.now.getTime() + 1);
    }
    assert.deepEqual(durations, [15, 30, 60]);
    // A successful sign-in clears the escalation: the next lock is 15 minutes again.
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta("192.0.2.22"))).kind, "signed_in");
    env.clock.advance(1000);
    for (let i = 0; i < 5; i++) await signIn(env.deps, { email: user.email, password: "wrong password 1234" }, meta("192.0.2.22"));
    const [again] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    assert.equal(((again.lockedUntil?.getTime() ?? 0) - env.clock.now.getTime()) / MIN, 15);
    const lockouts = await dbFor(env.pool)
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "auth.lockout"), eq(auditEvents.entityId, user.id)));
    assert.equal(lockouts.length, 4);
  });

  test("the lock is capped at 24 hours", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    let last = 0;
    for (let round = 0; round < 9; round++) {
      for (let i = 0; i < 5; i++) await signIn(env.deps, { email: user.email, password: "wrong password 1234" }, meta(`192.0.2.${round + 1}`));
      const [row] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
      last = ((row.lockedUntil?.getTime() ?? 0) - env.clock.now.getTime()) / MIN;
      env.clock.advance(last * MIN + 1);
    }
    assert.equal(last, 24 * 60);
  });
});

describe("per-address throttle", () => {
  test("the 31st attempt from one address within 15 minutes is refused (whatever the account)", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const ip = "198.51.100.9";
    for (let i = 0; i < 30; i++) {
      const result = await signIn(env.deps, { email: `someone-${i}@example.test`, password: "nope nope nope 1" }, meta(ip));
      assert.equal(result.kind, "failed");
    }
    assert.deepEqual(await signIn(env.deps, { email: user.email, password: user.password }, meta(ip)), { kind: "throttled" });
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta("198.51.100.10"))).kind, "signed_in");
    env.clock.advance(15 * MIN);
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta(ip))).kind, "signed_in");
  });
});

describe("password hashes", () => {
  test("a hash made with older parameters or another algorithm is replaced at sign-in", async () => {
    const scrypt = createPasswordHasher("scrypt");
    const user = await createUser(env, { roles: ["reviewer"], hasher: scrypt });
    const [before] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    assert.match(before.passwordHash ?? "", /^\$scrypt\$/);
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta())).kind, "signed_in");
    const [afterRow] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    assert.match(afterRow.passwordHash ?? "", /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta())).kind, "signed_in");
    const audited = await dbFor(env.pool)
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "auth.password_rehashed"), eq(auditEvents.entityId, user.id)));
    assert.equal(audited.length, 1);
  });

  test("the rehash never overwrites a password changed while it was being computed", async () => {
    const user = await createUser(env, { roles: ["reviewer"], hasher: createPasswordHasher("scrypt") });
    const changed = await env.deps.hasher.hash(strongPassword());
    // A hasher whose rehash lets a password change (or reset) commit before the new hash is written.
    const base = env.deps.hasher;
    const hasher = {
      ...base,
      async hash(password: string) {
        const rehashed = await base.hash(password);
        await dbFor(env.pool).update(users).set({ passwordHash: changed }).where(eq(users.id, user.id));
        return rehashed;
      },
    };
    assert.equal((await signIn({ ...env.deps, hasher }, { email: user.email, password: user.password }, meta())).kind, "signed_in");
    const [row] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    assert.equal(row.passwordHash, changed);
    const audited = await dbFor(env.pool)
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "auth.password_rehashed"), eq(auditEvents.entityId, user.id)));
    assert.equal(audited.length, 0);
  });
});
