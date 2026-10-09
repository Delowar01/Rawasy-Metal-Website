/** Two-factor authentication: enrolment, the sign-in challenge, replay, recovery codes, disabling, resets, keys. */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, eq, isNull } from "drizzle-orm";
import {
  beginEnrolment,
  confirmEnrolment,
  disableMfa,
  emergencyMfaReset,
  mfaKeyVersions,
  PENDING_ENROLMENT_MS,
  reencryptMfaSecrets,
  regenerateRecoveryCodes,
} from "../../src/server/auth/mfa.ts";
import { changePassword } from "../../src/server/auth/passwords.ts";
import { findSessionByToken } from "../../src/server/auth/sessions.ts";
import { reauthenticate, registerFailure, signIn, verifySecondFactor } from "../../src/server/auth/sign-in.ts";
import { resetUserMfa } from "../../src/server/auth/user-admin.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditEvents, loginAttempts, sessions, userMfa, userRecoveryCodes, users } from "../../src/server/db/schema.ts";
import { decryptSecret, DecryptionError, encryptSecret, KeyUnavailableError } from "../../src/server/security/encryption.ts";
import { base32Decode, totpCode } from "../../src/server/security/totp.ts";
import {
  actorFor,
  codeFor,
  createUser,
  linkToken,
  meta,
  ringOf,
  setupTestEnv,
  strongPassword,
  testKey,
  type TestEnv,
  type TestUser,
} from "./helpers.ts";

let env: TestEnv;
before(async () => {
  env = await setupTestEnv("mfa");
});
after(async () => env?.close());

/** Signs in with the password and returns the pending session (the user has confirmed 2FA). */
async function pendingFor(user: TestUser, ip = "203.0.113.5") {
  const result = await signIn(env.deps, { email: user.email, password: user.password }, meta(ip));
  assert.equal(result.kind, "mfa_required");
  if (result.kind !== "mfa_required") throw new Error("unreachable");
  const found = await findSessionByToken(dbFor(env.pool), result.token, env.deps.clock());
  assert.ok(found);
  return found;
}

/** A well-formed code that is wrong at every step the check accepts (now ± 1). */
function wrongCode(secret: Buffer): string {
  const now = env.deps.clock().getTime();
  const valid = new Set([-1, 0, 1].map((offset) => totpCode(secret, now + offset * 30_000)));
  for (let n = 0; ; n++) {
    const code = String(n).padStart(6, "0");
    if (!valid.has(code)) return code;
  }
}

const mfaRow = async (userId: string) => (await dbFor(env.pool).select().from(userMfa).where(eq(userMfa.userId, userId)))[0];
const auditCount = async (action: string, userId: string) =>
  (await dbFor(env.pool).select().from(auditEvents).where(and(eq(auditEvents.action, action), eq(auditEvents.entityId, userId)))).length;
const codesChecked = async (userId: string) =>
  (await dbFor(env.pool).select().from(loginAttempts).where(and(eq(loginAttempts.userId, userId), eq(loginAttempts.failureReason, "mfa_failed"))))
    .length;

describe("enrolment", () => {
  test("password first; then a secret shown once and sealed, nothing stored; a valid code activates it with 10 recovery codes", async () => {
    const user = await createUser(env, { roles: ["owner"] });
    const actor = await actorFor(env, user);
    assert.equal((await beginEnrolment(env.deps, actor, { password: "not the password 123" }, meta())).kind, "failed");
    const begun = await beginEnrolment(env.deps, actor, { password: user.password }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    assert.match(begun.secret, /^[A-Z2-7]{32}$/);
    assert.match(begun.uri, /^otpauth:\/\/totp\/RAWASY%20Admin:[^?]+\?secret=[A-Z2-7]{32}&issuer=RAWASY%20Admin&algorithm=SHA1&digits=6&period=30$/);
    const secret = base32Decode(begun.secret);
    // Nothing is stored until the first code confirms it; the set-up travels sealed (key version, expiry, flag, AES-GCM).
    assert.equal(await mfaRow(user.id), undefined);
    assert.match(begun.pending, /^1\.\d{13}\.0\.[A-Za-z0-9_-]{64}$/);
    assert.equal(Number(begun.pending.split(".")[1]), env.clock.now.getTime() + PENDING_ENROLMENT_MS);
    assert.ok(!Buffer.from(begun.pending.split(".")[3], "base64url").includes(secret), "secret sealed, not in clear");
    assert.equal((await confirmEnrolment(env.deps, actor, { code: wrongCode(secret), pending: begun.pending }, meta())).kind, "invalid");
    assert.equal(await mfaRow(user.id), undefined);
    const used = totpCode(secret, env.deps.clock().getTime());
    const confirmed = await confirmEnrolment(env.deps, actor, { code: used, pending: begun.pending }, meta());
    assert.equal(confirmed.kind, "ok");
    if (confirmed.kind !== "ok") return;
    assert.equal(confirmed.replaced, false);
    assert.equal(confirmed.recoveryCodes.length, 10);
    assert.equal(new Set(confirmed.recoveryCodes).size, 10);
    for (const code of confirmed.recoveryCodes) assert.match(code, /^[0-9a-hjkmnp-tv-z]{5}-[0-9a-hjkmnp-tv-z]{5}$/);
    assert.ok(confirmed.session.mfaVerifiedAt);
    const row = await mfaRow(user.id);
    assert.ok(row.confirmedAt);
    assert.equal(row.keyVersion, 1);
    assert.ok(!row.totpSecretEnc.includes(secret), "secret stored encrypted");
    assert.deepEqual(decryptSecret(env.deps.keyRing(), row.totpSecretEnc, row.keyVersion, `user_mfa:${user.id}`), secret);
    const stored = await dbFor(env.pool).select().from(userRecoveryCodes).where(eq(userRecoveryCodes.userId, user.id));
    assert.equal(stored.length, 10);
    assert.equal(env.mail().at(-1)?.subject, "Security change on your RAWASY admin account");
    assert.equal(await auditCount("auth.mfa_enrolment_started", user.id), 1);
    assert.equal(await auditCount("auth.mfa_enabled", user.id), 1);
    // The code that confirmed the set-up cannot sign in again (its step is stored).
    assert.deepEqual(await verifySecondFactor(env.deps, await pendingFor(user), { code: used }, meta()), { kind: "failed", locked: false });
    // Already enrolled: a second start is refused unless replacing.
    assert.equal((await beginEnrolment(env.deps, { ...actor, session: confirmed.session }, { password: user.password }, meta())).kind, "already_enrolled");
  });

  test("a sealed set-up confirms only for its own user and session, untampered, within 10 minutes", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    const begun = await beginEnrolment(env.deps, actor, { password: user.password }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    const secret = base32Decode(begun.secret);
    const code = () => totpCode(secret, env.deps.clock().getTime());
    const otherSession = await actorFor(env, user);
    const stranger = await actorFor(env, await createUser(env, { roles: ["editor"] }));
    assert.equal((await confirmEnrolment(env.deps, otherSession, { code: code(), pending: begun.pending }, meta())).kind, "none");
    assert.equal((await confirmEnrolment(env.deps, stranger, { code: code(), pending: begun.pending }, meta())).kind, "none");
    const [version, expiry, flag, body] = begun.pending.split(".");
    const flipped = Buffer.from(body, "base64url");
    flipped[flipped.length - 1] ^= 1;
    const tampered = [
      `${version}.${Number(expiry) - 1000}.${flag}.${body}`,
      `${version}.${Number(expiry) + 1000}.${flag}.${body}`,
      `${version}.${expiry}.1.${body}`,
      `${version}.${expiry}.${flag}.${flipped.toString("base64url")}`,
      `2.${expiry}.${flag}.${body}`,
      `${version}.${expiry}.${flag}.${body}x`,
      "",
      "not a sealed set-up",
    ];
    for (const pending of tampered) assert.equal((await confirmEnrolment(env.deps, actor, { code: code(), pending }, meta())).kind, "none", pending);
    env.clock.advance(PENDING_ENROLMENT_MS);
    assert.equal((await confirmEnrolment(env.deps, actor, { code: code(), pending: begun.pending }, meta())).kind, "none", "expired");
    assert.equal(await mfaRow(user.id), undefined);
    assert.equal(await mfaRow(stranger.user.id), undefined);
  });

  test("replacing: the current authenticator keeps working until the new one is confirmed; then only the new one works", async () => {
    const user = await createUser(env, { roles: ["admin"], mfa: true });
    const actor = await actorFor(env, user);
    const before = await mfaRow(user.id);
    const begun = await beginEnrolment(env.deps, actor, { password: user.password, replace: true }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    assert.equal(begun.pending.split(".")[2], "1");
    // Abandoned at this point: nothing changed, and the current app still completes a sign-in.
    assert.deepEqual(await mfaRow(user.id), before);
    assert.equal((await verifySecondFactor(env.deps, await pendingFor(user), { code: codeFor(env, user) }, meta())).kind, "signed_in");
    // Confirmed: the new secret replaces the old one, with new recovery codes; other sessions end.
    env.clock.advance(30_000);
    const fresh = base32Decode(begun.secret);
    const confirmed = await confirmEnrolment(env.deps, actor, { code: totpCode(fresh, env.deps.clock().getTime()), pending: begun.pending }, meta());
    assert.equal(confirmed.kind, "ok");
    if (confirmed.kind !== "ok") return;
    assert.equal(confirmed.replaced, true);
    assert.equal(await auditCount("auth.mfa_replacement_started", user.id), 1);
    assert.equal(await auditCount("auth.mfa_replaced", user.id), 1);
    assert.match(env.mail().at(-1)?.text ?? "", /authenticator app of your account was replaced/);
    env.clock.advance(30_000);
    assert.deepEqual(await verifySecondFactor(env.deps, await pendingFor(user), { code: codeFor(env, user) }, meta()), { kind: "failed", locked: false });
    assert.equal(
      (await verifySecondFactor(env.deps, await pendingFor(user), { code: totpCode(fresh, env.deps.clock().getTime()) }, meta())).kind,
      "signed_in",
    );
  });

  test("a first set-up never overwrites an authenticator confirmed meanwhile in another session", async () => {
    const user = await createUser(env, { roles: ["owner"] });
    const a = await actorFor(env, user);
    const b = await actorFor(env, user);
    const first = await beginEnrolment(env.deps, a, { password: user.password }, meta());
    const second = await beginEnrolment(env.deps, b, { password: user.password }, meta());
    assert.ok(first.kind === "ok" && second.kind === "ok");
    if (first.kind !== "ok" || second.kind !== "ok") return;
    const secretB = base32Decode(second.secret);
    const now = () => env.deps.clock().getTime();
    assert.equal((await confirmEnrolment(env.deps, b, { code: totpCode(secretB, now()), pending: second.pending }, meta())).kind, "ok");
    const secretA = base32Decode(first.secret);
    assert.equal((await confirmEnrolment(env.deps, a, { code: totpCode(secretA, now()), pending: first.pending }, meta())).kind, "none");
    const row = await mfaRow(user.id);
    assert.deepEqual(decryptSecret(env.deps.keyRing(), row.totpSecretEnc, row.keyVersion, `user_mfa:${user.id}`), secretB);
  });
});

describe("locks during a session", () => {
  test("while the account is locked no password is checked in a session (step-up, password change, 2FA set-up)", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    // Locked by failures elsewhere (e.g. five wrong passwords at the sign-in page).
    await dbFor(env.pool).update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + 15 * 60_000) }).where(eq(users.id, user.id));
    const attempts = async () => (await dbFor(env.pool).select().from(loginAttempts).where(eq(loginAttempts.userId, user.id))).length;
    const counted = await attempts();
    assert.deepEqual(await reauthenticate(env.deps, actor, { password: user.password }, meta()), { kind: "locked" });
    assert.deepEqual(await reauthenticate(env.deps, actor, { password: "a wrong guess 12345" }, meta()), { kind: "locked" });
    assert.deepEqual(await changePassword(env.deps, actor, { currentPassword: user.password, newPassword: strongPassword() }, meta()), { kind: "locked" });
    assert.deepEqual(await beginEnrolment(env.deps, actor, { password: user.password }, meta()), { kind: "locked" });
    assert.equal(await attempts(), counted, "nothing checked, nothing counted");
    assert.ok(await findSessionByToken(dbFor(env.pool), actor.token, env.deps.clock()), "the session itself goes on");
    env.clock.advance(15 * 60_000 + 1);
    assert.equal((await reauthenticate(env.deps, actor, { password: user.password }, meta())).kind, "ok");
  });

  test("a failure that comes during a lock (set by another request meanwhile) ends the session it came from", async () => {
    const user = await createUser(env, { roles: ["editor"] });
    const actor = await actorFor(env, user);
    await dbFor(env.pool).update(users).set({ lockedUntil: new Date(env.clock.now.getTime() + 15 * 60_000) }).where(eq(users.id, user.id));
    const [row] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    const result = await registerFailure(env.deps, row, "bad_credentials", meta(), {
      action: "auth.reauth_failed",
      summary: "Re-authentication failed: wrong password.",
      revokeOnLock: actor.session.id,
    });
    assert.deepEqual(result, { locked: true });
    assert.equal(await findSessionByToken(dbFor(env.pool), actor.token, env.deps.clock()), null);
  });
});

describe("concurrent codes", () => {
  test("12 wrong codes at once at the second step: exactly 5 are checked, the lock refuses the rest", async () => {
    const user = await createUser(env, { roles: ["editor"], mfa: true });
    const ip = "198.51.100.60";
    const pendings = [];
    for (let i = 0; i < 12; i++) pendings.push(await pendingFor(user, ip));
    const wrong = wrongCode(user.totpSecret as Buffer);
    const results = await Promise.all(pendings.map((pending) => verifySecondFactor(env.deps, pending, { code: wrong }, meta(ip))));
    assert.equal(await codesChecked(user.id), 5);
    assert.equal(results.filter((r) => r.kind === "failed" && !r.locked).length, 4);
    assert.equal(results.filter((r) => r.kind === "failed" && r.locked).length, 8);
    assert.equal(await auditCount("auth.lockout", user.id), 1);
    // Every attempt that met the lock lost its pending session, the one that set it too.
    const live = await dbFor(env.pool).select().from(sessions).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    assert.equal(live.length, 4);
    // The right code is refused too until the lock ends.
    assert.deepEqual(await verifySecondFactor(env.deps, pendings[0], { code: codeFor(env, user) }, meta(ip)), { kind: "failed", locked: true });
  });

  test("12 step-ups at once with the right password and wrong codes: exactly 5 codes are checked", async () => {
    const user = await createUser(env, { roles: ["editor"], mfa: true });
    const actor = await actorFor(env, user);
    const wrong = wrongCode(user.totpSecret as Buffer);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => reauthenticate(env.deps, actor, { password: user.password, code: wrong }, meta("198.51.100.61"))),
    );
    assert.equal(await codesChecked(user.id), 5);
    assert.equal(results.filter((r) => r.kind === "failed" && !r.locked).length, 4);
    assert.equal(results.filter((r) => r.kind === "failed" && r.locked).length, 1);
    assert.equal(results.filter((r) => r.kind === "locked").length, 7);
    assert.equal(await findSessionByToken(dbFor(env.pool), actor.token, env.deps.clock()), null, "the lock ended the session");
  });
});

describe("the sign-in challenge", () => {
  test("a valid code completes the sign-in; the same code cannot be used twice (replay)", async () => {
    const user = await createUser(env, { roles: ["admin"], mfa: true });
    const pending = await pendingFor(user);
    assert.equal(pending.session.mfaVerifiedAt, null);
    const code = codeFor(env, user);
    const done = await verifySecondFactor(env.deps, pending, { code }, meta());
    assert.equal(done.kind, "signed_in");
    const replayed = await verifySecondFactor(env.deps, await pendingFor(user), { code }, meta());
    assert.deepEqual(replayed, { kind: "failed", locked: false });
    env.clock.advance(30_000);
    assert.equal((await verifySecondFactor(env.deps, await pendingFor(user), { code: codeFor(env, user) }, meta())).kind, "signed_in");
  });

  test("codes one step either side are accepted; two steps away are not", async () => {
    const user = await createUser(env, { roles: ["editor"], mfa: true });
    assert.equal((await verifySecondFactor(env.deps, await pendingFor(user), { code: codeFor(env, user, -1) }, meta())).kind, "signed_in");
    assert.equal((await verifySecondFactor(env.deps, await pendingFor(user), { code: codeFor(env, user, 1) }, meta())).kind, "signed_in");
    assert.equal((await verifySecondFactor(env.deps, await pendingFor(user), { code: codeFor(env, user, 3) }, meta())).kind, "failed");
  });

  test("a recovery code works once; failures count towards the lockout", async () => {
    const user = await createUser(env, { roles: ["owner"] });
    const actor = await actorFor(env, user);
    const begun = await beginEnrolment(env.deps, actor, { password: user.password }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    const confirmed = await confirmEnrolment(
      env.deps,
      actor,
      { code: totpCode(base32Decode(begun.secret), env.deps.clock().getTime()), pending: begun.pending },
      meta(),
    );
    assert.equal(confirmed.kind, "ok");
    if (confirmed.kind !== "ok") return;
    const recovery = confirmed.recoveryCodes[0];
    const first = await verifySecondFactor(env.deps, await pendingFor(user), { recoveryCode: recovery.toUpperCase() }, meta());
    assert.equal(first.kind, "signed_in");
    assert.equal(first.kind === "signed_in" && first.remainingRecoveryCodes, 9);
    env.clock.advance(1000);
    assert.deepEqual(await verifySecondFactor(env.deps, await pendingFor(user), { recoveryCode: recovery }, meta()), { kind: "failed", locked: false });
    const events = await dbFor(env.pool).select().from(auditEvents).where(and(eq(auditEvents.action, "auth.recovery_code_used"), eq(auditEvents.entityId, user.id)));
    assert.equal(events.length, 1);
    env.clock.advance(1000);
    // Four more failures (five in all) lock the account and end the pending session.
    let last: Awaited<ReturnType<typeof verifySecondFactor>> | undefined;
    let lastPending: Awaited<ReturnType<typeof pendingFor>> | undefined;
    for (let i = 0; i < 4; i++) {
      lastPending = await pendingFor(user, "198.51.100.40");
      last = await verifySecondFactor(env.deps, lastPending, { code: "123456" }, meta());
    }
    assert.deepEqual(last, { kind: "failed", locked: true });
    const [row] = await dbFor(env.pool).select().from(sessions).where(eq(sessions.id, lastPending?.session.id ?? ""));
    assert.ok(row.revokedAt);
    const [u] = await dbFor(env.pool).select().from(users).where(eq(users.id, user.id));
    assert.ok(u.lockedUntil && u.lockedUntil > env.clock.now);
  });
});

describe("step-up, disabling and resets", () => {
  test("step-up needs the password and, with 2FA, a fresh code", async () => {
    const user = await createUser(env, { roles: ["editor"], mfa: true });
    const actor = await actorFor(env, user);
    assert.equal((await reauthenticate(env.deps, actor, { password: user.password }, meta())).kind, "failed");
    env.clock.advance(60_000);
    const ok = await reauthenticate(env.deps, actor, { password: user.password, code: codeFor(env, user) }, meta());
    assert.equal(ok.kind, "ok");
    if (ok.kind === "ok") assert.equal(ok.session.reauthenticatedAt.getTime(), env.clock.now.getTime());
  });

  test("Editors and Reviewers may turn 2FA off; Owners and Admins may not", async () => {
    const editor = await createUser(env, { roles: ["editor"], mfa: true });
    const editorActor = await actorFor(env, editor);
    const off = await disableMfa(env.deps, editorActor, meta());
    assert.equal(off.kind, "ok");
    assert.equal((await dbFor(env.pool).select().from(userMfa).where(eq(userMfa.userId, editor.id))).length, 0);
    const admin = await createUser(env, { roles: ["admin"], mfa: true });
    assert.equal((await disableMfa(env.deps, await actorFor(env, admin), meta())).kind, "required");
  });

  test("new recovery codes replace the old ones", async () => {
    const user = await createUser(env, { roles: ["reviewer"], mfa: true });
    const actor = await actorFor(env, user);
    const first = await regenerateRecoveryCodes(env.deps, actor, meta());
    const second = await regenerateRecoveryCodes(env.deps, actor, meta());
    assert.ok(first && second);
    assert.equal(
      (await verifySecondFactor(env.deps, await pendingFor(user), { recoveryCode: first?.[0] }, meta())).kind,
      "failed",
    );
    assert.equal(
      (await verifySecondFactor(env.deps, await pendingFor(user), { recoveryCode: second?.[0] }, meta())).kind,
      "signed_in",
    );
  });

  test("an Owner can reset another user's 2FA (sessions revoked); an Admin cannot", async () => {
    const owner = await createUser(env, { roles: ["owner"], mfa: true });
    const admin = await createUser(env, { roles: ["admin"], mfa: true });
    const target = await createUser(env, { roles: ["editor"], mfa: true });
    const targetActor = await actorFor(env, target);
    assert.deepEqual(await resetUserMfa(env.deps, await actorFor(env, admin), target.id, meta()), { kind: "denied", reason: "owner_only" });
    const reset = await resetUserMfa(env.deps, await actorFor(env, owner), target.id, meta());
    assert.equal(reset.kind, "ok");
    assert.equal(await findSessionByToken(dbFor(env.pool), targetActor.token, env.deps.clock()), null);
    assert.equal((await dbFor(env.pool).select().from(userMfa).where(eq(userMfa.userId, target.id))).length, 0);
    const denied = await dbFor(env.pool).select().from(auditEvents).where(and(eq(auditEvents.action, "user.mfa_reset"), eq(auditEvents.outcome, "denied")));
    assert.ok(denied.length >= 1);
  });
});

describe("encryption keys", () => {
  test("AES-256-GCM with the row bound in: another row's ciphertext does not decrypt", () => {
    const ring = ringOf(1, { 1: testKey() });
    const secret = Buffer.from("12345678901234567890");
    const { blob, version } = encryptSecret(ring, secret, "user_mfa:A");
    assert.deepEqual(decryptSecret(ring, blob, version, "user_mfa:A"), secret);
    assert.throws(() => decryptSecret(ring, blob, version, "user_mfa:B"), DecryptionError);
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 1;
    assert.throws(() => decryptSecret(ring, tampered, version, "user_mfa:A"), DecryptionError);
    assert.throws(() => decryptSecret(ringOf(1, { 1: testKey() }), blob, version, "user_mfa:A"), DecryptionError);
    assert.throws(() => decryptSecret(ring, blob, 2, "user_mfa:A"), KeyUnavailableError);
  });

  test("rotation: retired versions still decrypt; rekey moves every row to the active version", async () => {
    const current = env.deps.keyRing();
    assert.equal(current.activeVersion, 1);
    const k1 = current.keys.get(1) as Buffer;
    const user = await createUser(env, { roles: ["editor"], mfa: true });
    const k2 = testKey();
    env.setKeyRing(ringOf(2, { 2: k2, 1: k1 }));
    assert.equal((await verifySecondFactor(env.deps, await pendingFor(user), { code: codeFor(env, user) }, meta())).kind, "signed_in");
    const before = (await mfaKeyVersions(dbFor(env.pool))).find((v) => v.version === 1);
    assert.ok(before && before.rows >= 1);
    const result = await reencryptMfaSecrets(env.deps);
    assert.ok(result.reencrypted >= 1);
    assert.deepEqual(result.unreadable, []);
    const versions = await mfaKeyVersions(dbFor(env.pool));
    assert.deepEqual(
      versions.map((v) => v.version),
      [2],
    );
    // Version 1 can now leave the environment: the user still verifies with version 2 alone.
    env.setKeyRing(ringOf(2, { 2: k2 }));
    env.clock.advance(30_000);
    assert.equal((await verifySecondFactor(env.deps, await pendingFor(user), { code: codeFor(env, user) }, meta())).kind, "signed_in");
  });

  test("a missing or wrong key makes TOTP unavailable (recovery codes still work), and is audited", async () => {
    const owner = await createUser(env, { roles: ["owner"] });
    const actor = await actorFor(env, owner);
    const begun = await beginEnrolment(env.deps, actor, { password: owner.password }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    const confirmed = await confirmEnrolment(
      env.deps,
      actor,
      { code: totpCode(base32Decode(begun.secret), env.deps.clock().getTime()), pending: begun.pending },
      meta(),
    );
    assert.equal(confirmed.kind, "ok");
    if (confirmed.kind !== "ok") return;
    const active = env.deps.keyRing();
    env.setKeyRing(ringOf(active.activeVersion + 1, { [active.activeVersion + 1]: testKey() }));
    env.clock.advance(30_000);
    assert.deepEqual(await verifySecondFactor(env.deps, await pendingFor(owner), { code: "123456" }, meta()), { kind: "unavailable" });
    env.setKeyRing(ringOf(active.activeVersion, { [active.activeVersion]: testKey() }));
    assert.deepEqual(await verifySecondFactor(env.deps, await pendingFor(owner), { code: "123456" }, meta()), { kind: "unavailable" });
    assert.equal(
      (await verifySecondFactor(env.deps, await pendingFor(owner), { recoveryCode: confirmed.recoveryCodes[3] }, meta())).kind,
      "signed_in",
    );
    const events = await dbFor(env.pool).select().from(auditEvents).where(and(eq(auditEvents.action, "auth.mfa_key_unavailable"), eq(auditEvents.entityId, owner.id)));
    assert.equal(events.length, 2);
    env.setKeyRing(active);
  });

  test("the emergency reset removes 2FA, revokes sessions and issues reset links", async () => {
    const user = await createUser(env, { roles: ["admin"], mfa: true });
    const actor = await actorFor(env, user);
    const result = await emergencyMfaReset(env.deps, { userIds: [user.id] }, "cli:test", "01JTESTREQUEST00000000000A");
    assert.equal(result.users.length, 1);
    assert.equal(result.users[0].delivered, true);
    assert.equal(result.users[0].sessionsRevoked, 1);
    assert.equal(await findSessionByToken(dbFor(env.pool), actor.token, env.deps.clock()), null);
    assert.equal((await dbFor(env.pool).select().from(userMfa).where(eq(userMfa.userId, user.id))).length, 0);
    const message = env.mail().at(-1);
    assert.equal(message?.to, user.email);
    assert.match(linkToken(message?.text ?? "", "reset"), /^[A-Za-z0-9_-]{43}$/);
    const unused = await dbFor(env.pool)
      .select()
      .from(userRecoveryCodes)
      .where(and(eq(userRecoveryCodes.userId, user.id), isNull(userRecoveryCodes.usedAt)));
    assert.equal(unused.length, 0);
  });
});
