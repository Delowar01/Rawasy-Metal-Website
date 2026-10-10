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
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, asc, eq, isNull } from "drizzle-orm";
import { acceptInvitation, inspectInvitation, inviteUser, resendInvitation } from "../../src/server/auth/invitations.ts";
import { beginEnrolment, confirmEnrolment, regenerateRecoveryCodes } from "../../src/server/auth/mfa.ts";
import { changePassword, completePasswordReset, inspectResetToken, requestPasswordReset } from "../../src/server/auth/passwords.ts";
import { revokeOtherOwnSessions, revokeOwnSession } from "../../src/server/auth/self-service.ts";
import { revokeSession, SessionEndedError } from "../../src/server/auth/sessions.ts";
import { signIn } from "../../src/server/auth/sign-in.ts";
import { issueToken } from "../../src/server/auth/tokens.ts";
import { resetUserMfa, revokeSessionsOf, setUserRoles, setUserStatus, unlockUser } from "../../src/server/auth/user-admin.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditEvents, authTokens, loginAttempts, sessions, userMfa, userRecoveryCodes, userRoles, users } from "../../src/server/db/schema.ts";
import { sha256 } from "../../src/server/security/ids.ts";
import { createPasswordHasher, type PasswordHasher } from "../../src/server/security/password.ts";
import { recoveryCodeHash, normalizeRecoveryCode } from "../../src/server/security/recovery-codes.ts";
import { base32Decode, totpCode } from "../../src/server/security/totp.ts";
import { actorFor, createUser, linkToken, meta, setupTestEnv, strongPassword, type TestEnv } from "./helpers.ts";

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
function pausedHash(base: PasswordHasher) {
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
  return { deps: { ...env.deps, hasher }, hashed, release };
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

describe("third review — an invitation link carries its issuer's authority, never more", () => {
  /** An Owner, and an Admin who invites a new Editor (the link read from the mail sink). */
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
