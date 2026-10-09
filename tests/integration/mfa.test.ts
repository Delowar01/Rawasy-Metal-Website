/** Two-factor authentication: enrolment, the sign-in challenge, replay, recovery codes, disabling, resets, keys. */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, eq, isNull } from "drizzle-orm";
import { beginEnrolment, confirmEnrolment, disableMfa, emergencyMfaReset, mfaKeyVersions, reencryptMfaSecrets, regenerateRecoveryCodes } from "../../src/server/auth/mfa.ts";
import { findSessionByToken } from "../../src/server/auth/sessions.ts";
import { reauthenticate, signIn, verifySecondFactor } from "../../src/server/auth/sign-in.ts";
import { resetUserMfa } from "../../src/server/auth/user-admin.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditEvents, sessions, userMfa, userRecoveryCodes, users } from "../../src/server/db/schema.ts";
import { decryptSecret, DecryptionError, encryptSecret, KeyUnavailableError } from "../../src/server/security/encryption.ts";
import { base32Decode, totpCode } from "../../src/server/security/totp.ts";
import { actorFor, codeFor, createUser, linkToken, meta, ringOf, setupTestEnv, testKey, type TestEnv, type TestUser } from "./helpers.ts";

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

describe("enrolment", () => {
  test("password first; then a secret shown once; a valid code activates it with 10 recovery codes", async () => {
    const user = await createUser(env, { roles: ["owner"] });
    const actor = await actorFor(env, user);
    assert.equal((await beginEnrolment(env.deps, actor, { password: "not the password 123" }, meta())).kind, "failed");
    const begun = await beginEnrolment(env.deps, actor, { password: user.password }, meta());
    assert.equal(begun.kind, "ok");
    if (begun.kind !== "ok") return;
    assert.match(begun.secret, /^[A-Z2-7]{32}$/);
    assert.match(begun.uri, /^otpauth:\/\/totp\/RAWASY%20Admin:[^?]+\?secret=[A-Z2-7]{32}&issuer=RAWASY%20Admin&algorithm=SHA1&digits=6&period=30$/);
    const [pending] = await dbFor(env.pool).select().from(userMfa).where(eq(userMfa.userId, user.id));
    assert.equal(pending.confirmedAt, null);
    assert.equal(pending.keyVersion, 1);
    assert.ok(!pending.totpSecretEnc.includes(base32Decode(begun.secret)), "secret stored encrypted");
    assert.equal((await confirmEnrolment(env.deps, actor, { code: "000000" }, meta())).kind, "invalid");
    const secret = base32Decode(begun.secret);
    const confirmed = await confirmEnrolment(env.deps, actor, { code: totpCode(secret, env.deps.clock().getTime()) }, meta());
    assert.equal(confirmed.kind, "ok");
    if (confirmed.kind !== "ok") return;
    assert.equal(confirmed.recoveryCodes.length, 10);
    assert.equal(new Set(confirmed.recoveryCodes).size, 10);
    for (const code of confirmed.recoveryCodes) assert.match(code, /^[0-9a-hjkmnp-tv-z]{5}-[0-9a-hjkmnp-tv-z]{5}$/);
    assert.ok(confirmed.session.mfaVerifiedAt);
    const stored = await dbFor(env.pool).select().from(userRecoveryCodes).where(eq(userRecoveryCodes.userId, user.id));
    assert.equal(stored.length, 10);
    assert.equal(env.mail().at(-1)?.subject, "Security change on your RAWASY admin account");
    // Already enrolled: a second start is refused unless replacing.
    assert.equal((await beginEnrolment(env.deps, { ...actor, session: confirmed.session }, { password: user.password }, meta())).kind, "already_enrolled");
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
    const confirmed = await confirmEnrolment(env.deps, actor, { code: totpCode(base32Decode(begun.secret), env.deps.clock().getTime()) }, meta());
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
    const confirmed = await confirmEnrolment(env.deps, actor, { code: totpCode(base32Decode(begun.secret), env.deps.clock().getTime()) }, meta());
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
