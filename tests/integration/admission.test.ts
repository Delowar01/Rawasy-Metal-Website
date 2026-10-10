/**
 * A2 Correction 1: the credential-check slots taken before any password hash. Concurrent wrong passwords against one
 * email — a known account, an unknown address, a disabled account — start at most 5 Argon2 verifications in 15 minutes
 * (the rest are refused before hashing, with the same answer), the account's lock ends up exactly as the policy says,
 * the pool stays within its limit, and a successful sign-in, a password reset or an unlock frees the slots again.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, asc, eq, inArray } from "drizzle-orm";
import { beginEnrolment } from "../../src/server/auth/mfa.ts";
import { changePassword, completePasswordReset, requestPasswordReset } from "../../src/server/auth/passwords.ts";
import { clearCredentialChecks, credentialKey, reserveCredentialCheck } from "../../src/server/auth/rate-limit.ts";
import { reauthenticate, signIn } from "../../src/server/auth/sign-in.ts";
import { unlockUser } from "../../src/server/auth/user-admin.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { loginAttempts, rateLimits, users } from "../../src/server/db/schema.ts";
import { sha256 } from "../../src/server/security/ids.ts";
import type { PasswordHasher } from "../../src/server/security/password.ts";
import { actorFor, createUser, linkToken, meta, setupTestEnv, strongPassword, type TestEnv } from "./helpers.ts";

const MIN = 60_000;
let env: TestEnv;
before(async () => {
  env = await setupTestEnv("admission");
});
after(async () => env?.close());

const db = () => dbFor(env.pool);

/** The test's services with a hasher that counts password verifications (the expensive step the slots guard). */
function counted() {
  const calls = { verify: 0 };
  const base = env.deps.hasher;
  const hasher: PasswordHasher = {
    kind: base.kind,
    hash: (password) => base.hash(password),
    needsRehash: (stored) => base.needsRehash(stored),
    async verify(stored, password) {
      calls.verify++;
      return base.verify(stored, password);
    },
  };
  return { deps: { ...env.deps, hasher }, calls };
}

/** The highest number of pool connections in use at once while `work` runs (the pool's limit is 4 here). */
async function peakConnections<T>(work: () => Promise<T>): Promise<{ result: T; peak: number }> {
  const core = (env.pool as unknown as { pool: { on(e: string, f: () => void): void; off(e: string, f: () => void): void } }).pool;
  let inUse = 0;
  let peak = 0;
  const acquire = () => {
    inUse++;
    peak = Math.max(peak, inUse);
  };
  const release = () => {
    inUse--;
  };
  core.on("acquire", acquire);
  core.on("release", release);
  try {
    return { result: await work(), peak };
  } finally {
    core.off("acquire", acquire);
    core.off("release", release);
  }
}

const attemptsOf = async (email: string) =>
  (
    await db()
      .select({ reason: loginAttempts.failureReason, userId: loginAttempts.userId })
      .from(loginAttempts)
      .where(eq(loginAttempts.emailHash, sha256(email.toLowerCase())))
      .orderBy(asc(loginAttempts.id))
  ).map((a) => a.reason);

const count = (list: (string | null)[], value: string) => list.filter((x) => x === value).length;

/** Credential-check slots of an email that are taken now. */
async function takenSlots(email: string): Promise<number> {
  const key = credentialKey(email.toLowerCase());
  const hashes = [0, 1, 2, 3, 4].map((slot) => sha256(`${key}#${slot}`));
  const rows = await db().select().from(rateLimits).where(inArray(rateLimits.keyHash, hashes));
  return rows.filter((r) => r.expiresAt.getTime() > env.clock.now.getTime()).length;
}

describe("12 wrong passwords at once", () => {
  test("against a known account: exactly 5 are hashed, the account locks, 7 are refused before hashing, the pool holds", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const { deps, calls } = counted();
    const { result, peak } = await peakConnections(() =>
      Promise.allSettled(Array.from({ length: 12 }, (_, i) => signIn(deps, { email: user.email, password: `wrong password ${i} xyz` }, meta("192.0.2.80")))),
    );
    assert.equal(calls.verify, 5, "5 password verifications, never more");
    for (const r of result) assert.deepEqual(r, { status: "fulfilled", value: { kind: "failed" } });
    assert.ok(peak <= 4, `pool connections in use at once: ${peak}`);
    const [row] = await db().select().from(users).where(eq(users.id, user.id));
    assert.equal(row.failedLoginCount, 5);
    assert.equal(row.lockedUntil?.getTime(), env.clock.now.getTime() + 15 * MIN, "locked for 15 minutes");
    const reasons = await attemptsOf(user.email);
    assert.equal(count(reasons, "bad_credentials"), 5);
    assert.equal(count(reasons, "rate_limited"), 7, "7 refused before any hash");
    assert.equal(await takenSlots(user.email), 5);
  });

  test("against an unknown email: exactly 5 dummy verifications, the same answer, nothing else", async () => {
    const email = "nobody-at-all@example.test";
    const { deps, calls } = counted();
    const { result, peak } = await peakConnections(() =>
      Promise.allSettled(Array.from({ length: 12 }, (_, i) => signIn(deps, { email, password: `wrong password ${i} xyz` }, meta("192.0.2.81")))),
    );
    assert.equal(calls.verify, 5);
    for (const r of result) assert.deepEqual(r, { status: "fulfilled", value: { kind: "failed" } });
    assert.ok(peak <= 4);
    const reasons = await attemptsOf(email);
    assert.equal(count(reasons, "bad_credentials"), 5);
    assert.equal(count(reasons, "rate_limited"), 7);
  });

  test("against a disabled account: exactly 5 dummy verifications and the same answer", async () => {
    const user = await createUser(env, { roles: ["editor"], status: "disabled" });
    const { deps, calls } = counted();
    const results = await Promise.all(Array.from({ length: 12 }, () => signIn(deps, { email: user.email, password: user.password }, meta("192.0.2.82"))));
    assert.equal(calls.verify, 5);
    for (const r of results) assert.deepEqual(r, { kind: "failed" });
    const reasons = await attemptsOf(user.email);
    assert.equal(count(reasons, "disabled"), 5);
    assert.equal(count(reasons, "rate_limited"), 7);
  });

  test("a refused attempt answers exactly like a checked one, for a known, an unknown and a disabled email", async () => {
    const known = await createUser(env, { roles: ["reviewer"] });
    const disabled = await createUser(env, { roles: ["reviewer"], status: "disabled" });
    const answers: unknown[] = [];
    for (const email of [known.email, "missing-person@example.test", disabled.email]) {
      for (let i = 0; i < 7; i++) answers.push(await signIn(env.deps, { email, password: "a wrong password 1234" }, meta("192.0.2.83")));
    }
    // 7 per email: 5 checked, 2 refused before hashing — 21 identical answers.
    assert.equal(answers.length, 21);
    for (const a of answers) assert.deepEqual(a, { kind: "failed" });
  });

  test("the slots are per email: another account is not held back, and the per-address limit still applies first", async () => {
    const first = await createUser(env, { roles: ["editor"] });
    const second = await createUser(env, { roles: ["editor"] });
    await Promise.all(Array.from({ length: 6 }, () => signIn(env.deps, { email: first.email, password: "wrong wrong wrong 1" }, meta("192.0.2.84"))));
    assert.equal((await signIn(env.deps, { email: second.email, password: second.password }, meta("192.0.2.84"))).kind, "signed_in");
  });
});

describe("freeing the slots", () => {
  test("a successful sign-in frees them: the next attempts are checked again", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const { deps, calls } = counted();
    for (let i = 0; i < 4; i++) await signIn(deps, { email: user.email, password: `nope ${i} nope nope` }, meta("192.0.2.85"));
    assert.equal(await takenSlots(user.email), 4);
    assert.equal((await signIn(deps, { email: user.email, password: user.password }, meta("192.0.2.85"))).kind, "signed_in");
    assert.equal(await takenSlots(user.email), 0, "freed by the success");
    assert.equal(calls.verify, 5);
    for (let i = 0; i < 5; i++) await signIn(deps, { email: user.email, password: `nope ${i} again nope` }, meta("192.0.2.85"));
    assert.equal(calls.verify, 10, "5 more checks after the success");
    // The 6th is refused before hashing (and the account is locked by the 5 failures).
    assert.deepEqual(await signIn(deps, { email: user.email, password: user.password }, meta("192.0.2.85")), { kind: "failed" });
    assert.equal(calls.verify, 10);
  });

  test("a completed password reset frees them (and the lock): the new password signs in at once", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    for (let i = 0; i < 5; i++) await signIn(env.deps, { email: user.email, password: `wrong ${i} wrong wrong` }, meta("192.0.2.86"));
    assert.equal(await takenSlots(user.email), 5);
    await requestPasswordReset(env.deps, { email: user.email }, meta("192.0.2.86"));
    const message = env.mail().filter((m) => m.to === user.email && m.kind === "password_reset").at(-1);
    assert.ok(message, "a reset link was sent (mail sink)");
    const next = strongPassword();
    assert.deepEqual(await completePasswordReset(env.deps, { token: linkToken(message.text, "reset"), password: next }, meta("192.0.2.86")), { kind: "ok" });
    assert.equal(await takenSlots(user.email), 0);
    assert.equal((await signIn(env.deps, { email: user.email, password: next }, meta("192.0.2.86"))).kind, "signed_in");
  });

  test("an unlock by an Admin frees them: the right password signs in at once", async () => {
    const admin = await createUser(env, { roles: ["admin"], mfa: true });
    const adminActor = await actorFor(env, admin);
    const user = await createUser(env, { roles: ["editor"] });
    for (let i = 0; i < 5; i++) await signIn(env.deps, { email: user.email, password: `wrong ${i} wrong wrong` }, meta("192.0.2.87"));
    assert.deepEqual(await signIn(env.deps, { email: user.email, password: user.password }, meta("192.0.2.87")), { kind: "failed" });
    assert.equal((await unlockUser(env.deps, adminActor, user.id, meta())).kind, "ok");
    assert.equal(await takenSlots(user.email), 0);
    assert.equal((await signIn(env.deps, { email: user.email, password: user.password }, meta("192.0.2.87"))).kind, "signed_in");
  });

  test("the slots free themselves 15 minutes after they were taken (a sliding window, not a fixed one)", async () => {
    const email = "sliding-window@example.test";
    const at = [0, 2, 4, 6, 8];
    const start = env.clock.now.getTime();
    for (const m of at) {
      env.clock.now = new Date(start + m * MIN);
      assert.equal(await reserveCredentialCheck(db(), email, env.deps.clock()), true);
    }
    env.clock.now = new Date(start + 14 * MIN);
    assert.equal(await reserveCredentialCheck(db(), email, env.deps.clock()), false, "5 taken in the last 15 minutes");
    env.clock.now = new Date(start + 15 * MIN);
    assert.equal(await reserveCredentialCheck(db(), email, env.deps.clock()), true, "the first one is free again");
    assert.equal(await reserveCredentialCheck(db(), email, env.deps.clock()), false);
    await clearCredentialChecks(db(), email);
    assert.equal(await takenSlots(email), 0);
  });

  test("slots freed while a reservation is between its insert and its claim are still there to claim", async () => {
    const email = "freed-mid-reservation@example.test";
    for (let i = 0; i < 5; i++) assert.equal(await reserveCredentialCheck(db(), email, env.deps.clock()), true);
    // A reservation held right before its first claim (its INSERT IGNORE already done) ...
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let reached!: () => void;
    const atClaim = new Promise<void>((resolve) => (reached = resolve));
    let first = true;
    const real = db();
    const held = new Proxy(real, {
      get(target, prop, receiver) {
        if (prop !== "update") return Reflect.get(target, prop, receiver);
        return (table: typeof rateLimits) => ({
          set: (values: Partial<typeof rateLimits.$inferInsert>) => ({
            where: async (condition: Parameters<ReturnType<ReturnType<typeof target.update>["set"]>["where"]>[0]) => {
              if (first) {
                first = false;
                reached();
                await gate;
              }
              return target.update(table).set(values).where(condition);
            },
          }),
        });
      },
    }) as typeof real;
    const reservation = reserveCredentialCheck(held, email, env.deps.clock());
    await atClaim;
    // ... while a successful check elsewhere frees every slot of the email: the held reservation takes one.
    await clearCredentialChecks(db(), email);
    release();
    assert.equal(await reservation, true, "a freed slot, not a refusal");
    assert.equal(await takenSlots(email), 1);
  });

  test("reservations and freeing at the same moment never deadlock: both take an email's rows in one order", async () => {
    // A2 Correction 1, third review: the reservation's INSERT IGNORE took the 5 rows in slot order and the freeing
    // UPDATE in key order, so the two could wait for each other (21 and 26 deadlocks in two probes of 600 such rounds).
    const failures: unknown[] = [];
    for (let round = 0; round < 300; round++) {
      const email = `same-moment-${round % 20}@example.test`;
      const work: Promise<unknown>[] = [];
      for (let i = 0; i < 6; i++) work.push(reserveCredentialCheck(db(), email, env.deps.clock()), clearCredentialChecks(db(), email));
      for (const outcome of await Promise.allSettled(work)) {
        if (outcome.status === "rejected") failures.push(outcome.reason?.cause?.code ?? outcome.reason?.code ?? String(outcome.reason));
      }
    }
    assert.deepEqual(failures, []);
  });
});

describe("password checks in a signed-in session", () => {
  test("step-up, password change and 2FA set-up hash nothing while the slots are taken (answer: temporarily locked)", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    for (let i = 0; i < 5; i++) assert.equal(await reserveCredentialCheck(db(), user.email, env.deps.clock()), true);
    const { deps, calls } = counted();
    assert.deepEqual(await reauthenticate(deps, actor, { password: user.password }, meta()), { kind: "locked" });
    assert.deepEqual(await changePassword(deps, actor, { currentPassword: user.password, newPassword: strongPassword() }, meta()), { kind: "locked" });
    assert.deepEqual(await beginEnrolment(deps, actor, { password: user.password }, meta()), { kind: "locked" });
    assert.equal(calls.verify, 0, "no password was hashed");
  });

  test("12 wrong step-up passwords at once from one session: at most 5 hashed", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    const { deps, calls } = counted();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => reauthenticate(deps, actor, { password: `wrong step-up ${i} pw` }, meta())),
    );
    assert.ok(calls.verify <= 5, `hashed ${calls.verify}`);
    for (const r of results) assert.equal(r.status, "fulfilled");
    const [row] = await db()
      .select()
      .from(users)
      .where(and(eq(users.id, user.id)));
    assert.ok(row.lockedUntil, "the failures locked the account");
  });
});
