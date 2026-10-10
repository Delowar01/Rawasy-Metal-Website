/**
 * Two-factor authentication: enrolment, recovery codes, disabling, key rotation and the emergency reset
 * (A1-SECURITY-RBAC §3.6, §12.2–§12.4). Required for Owner and Admin, optional for Editor and Reviewer (A2 default).
 *
 * The TOTP secret is encrypted with the active AUTH_ENCRYPTION_KEY (AES-256-GCM, bound to the user's row) and stamped
 * with the key's version; it is shown to the user once, at enrolment, as a QR code and a text key, and is never logged.
 * Recovery codes (`security/recovery-codes.ts`): 10 single-use codes of 20 characters (100 random bits each, since
 * A2 Correction 1), shown once, stored as SHA-256.
 *
 * A set-up in progress is not stored: the new secret travels to the browser and back sealed (AES-256-GCM with the same
 * key, bound to the user, the session, its 10-minute expiry and whether it replaces an authenticator), and the
 * `user_mfa` row is written only when a first valid code confirms it. Until then the current authenticator (if any)
 * keeps working, so an abandoned replacement never leaves the account without its second factor.
 */
import { asc, eq, ne, sql } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import type { KeyRing } from "../config/env.ts";
import { inTransaction, type Db } from "../db/client.ts";
import { userMfa, userRecoveryCodes, users } from "../db/schema.ts";
import { mailTemplates, sendQuietly } from "../mail/mailer.ts";
import { decryptSecret, encryptSecret } from "../security/encryption.ts";
import { ulid } from "../security/ids.ts";
import { generateRecoveryCodes, normalizeRecoveryCode, RECOVERY_CODE_COUNT, recoveryCodeHash } from "../security/recovery-codes.ts";
import { generateTotpSecret, otpauthUri, base32Encode, verifyTotp } from "../security/totp.ts";
import { mfaStateOf, type UserRow } from "./accounts.ts";
import { adminLink, type AuthDeps } from "./deps.ts";
import { clearCredentialChecks, reserveCredentialCheck } from "./rate-limit.ts";
import { isAccountLocked, registerFailure } from "./sign-in.ts";
import { lockActingSession, revokeUserSessions, rotateSession, type SessionRow } from "./sessions.ts";
import { issueToken, TOKEN_LIFETIME_MS } from "./tokens.ts";
import { auditActorOf, type RequestMeta } from "./types.ts";

export const associatedData = (userId: string) => `user_mfa:${userId}`;

/** Replaces a user's recovery codes with 10 new ones; only their hashes are stored, the codes go back to be shown once. */
async function replaceRecoveryCodes(tx: Db, userId: string, now: Date): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
  await tx.insert(userRecoveryCodes).values(
    codes.map((code) => ({
      id: ulid(now.getTime()),
      userId,
      codeHash: recoveryCodeHash(normalizeRecoveryCode(code) as string),
      usedAt: null,
      createdAt: now,
    })),
  );
  return codes;
}

interface Current {
  session: SessionRow;
  user: UserRow;
  roles: string[];
}

// ---------------------------------------------------------------------------------------------------------------------
// The sealed set-up in progress

/** How long a started set-up can be confirmed. */
export const PENDING_ENROLMENT_MS = 10 * 60 * 1000;

const SEALED = /^(\d{1,3})\.(\d{13})\.([01])\.([A-Za-z0-9_-]{64})$/;

interface PendingBinding {
  userId: string;
  sessionId: string;
}

const pendingData = (bind: PendingBinding, expiresAt: number, replace: boolean) =>
  `mfa_pending:${bind.userId}:${bind.sessionId}:${expiresAt}:${replace ? 1 : 0}`;

/** Seals a new secret for the browser: "<key version>.<expiry ms>.<replace 0|1>.<base64url of iv | tag | ciphertext>". */
export function sealPendingEnrolment(ring: KeyRing, secret: Buffer, bind: PendingBinding, now: Date, replace: boolean): string {
  const expiresAt = now.getTime() + PENDING_ENROLMENT_MS;
  const { blob, version } = encryptSecret(ring, secret, pendingData(bind, expiresAt, replace));
  return `${version}.${expiresAt}.${replace ? 1 : 0}.${blob.toString("base64url")}`;
}

/**
 * Opens a sealed set-up: null when it is malformed, expired, tampered with, sealed for another user or session, or its
 * key version is no longer configured.
 */
export function openPendingEnrolment(ring: KeyRing, sealed: string, bind: PendingBinding, now: Date): { secret: Buffer; replace: boolean } | null {
  const match = SEALED.exec(sealed);
  if (!match) return null;
  const expiresAt = Number(match[2]);
  if (expiresAt <= now.getTime() || expiresAt > now.getTime() + PENDING_ENROLMENT_MS) return null;
  const replace = match[3] === "1";
  try {
    const secret = decryptSecret(ring, Buffer.from(match[4], "base64url"), Number(match[1]), pendingData(bind, expiresAt, replace));
    if (secret.length === 20) return { secret, replace };
    secret.fill(0);
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------

export type BeginEnrolmentResult =
  | { kind: "ok"; secret: string; uri: string; pending: string }
  | { kind: "failed"; locked: boolean }
  /** The account is locked: the password is not checked until the lock ends. */
  | { kind: "locked" }
  | { kind: "already_enrolled" };

/**
 * Starts enrolment after the password is confirmed (never checked while the account is locked): a new secret, shown
 * to the user and returned sealed, nothing stored. With `replace` (and a recent re-authentication checked by the
 * caller), it will replace a confirmed authenticator — which keeps working until the new one is confirmed.
 */
export async function beginEnrolment(
  deps: AuthDeps,
  current: Current,
  input: { password: string; replace?: boolean },
  meta: RequestMeta,
): Promise<BeginEnrolmentResult> {
  const now = deps.clock();
  const { user } = current;
  if (await isAccountLocked(deps.db, user.id, now)) return { kind: "locked" };
  if (!(await reserveCredentialCheck(deps.db, user.emailNormalized, now))) return { kind: "locked" };
  if (!user.passwordHash || !(await deps.hasher.verify(user.passwordHash, String(input.password ?? "")))) {
    const { locked } = await registerFailure(deps, user, "bad_credentials", meta, {
      action: "auth.reauth_failed",
      summary: "Two-factor set-up refused: wrong password.",
      revokeOnLock: current.session.id,
    });
    return { kind: "failed", locked };
  }
  await clearCredentialChecks(deps.db, user.emailNormalized);
  const state = await mfaStateOf(deps.db, user.id, current.roles);
  if (state.enrolled && !input.replace) return { kind: "already_enrolled" };
  const replace = state.enrolled;
  const secret = generateTotpSecret();
  const pending = sealPendingEnrolment(deps.keyRing(), secret, { userId: user.id, sessionId: current.session.id }, now, replace);
  await recordAudit(deps.db, {
    at: now,
    requestId: meta.requestId,
    actor: auditActorOf(current),
    ip: meta.ip,
    action: replace ? "auth.mfa_replacement_started" : "auth.mfa_enrolment_started",
    entity: { type: "user", id: user.id, label: userLabel(user) },
    outcome: "success",
    summary: replace
      ? "Started replacing the authenticator app (the current one keeps working until the new one is confirmed)."
      : "Started setting up two-factor authentication.",
  });
  const result = { kind: "ok" as const, secret: base32Encode(secret), uri: otpauthUri(secret, user.email), pending };
  secret.fill(0);
  return result;
}

export type ConfirmEnrolmentResult =
  | { kind: "ok"; recoveryCodes: string[]; token: string; session: SessionRow; replaced: boolean }
  | { kind: "invalid" }
  /** Nothing to confirm: the set-up expired, belongs to another session, or 2FA was set up elsewhere meanwhile. */
  | { kind: "none" };

/**
 * Confirms a sealed set-up with a first valid code. One transaction holding the user's row stores the new secret
 * (replacing the previous authenticator, if this set-up was started as a replacement), issues new recovery codes, signs
 * out the user's other sessions and rotates this one.
 */
export async function confirmEnrolment(
  deps: AuthDeps,
  current: Current,
  input: { code: string; pending: string },
  meta: RequestMeta,
): Promise<ConfirmEnrolmentResult> {
  const now = deps.clock();
  const { user } = current;
  const ring = deps.keyRing();
  const opened = openPendingEnrolment(ring, String(input.pending ?? ""), { userId: user.id, sessionId: current.session.id }, now);
  if (!opened) return { kind: "none" };
  const step = verifyTotp(opened.secret, String(input.code ?? ""), now.getTime(), null);
  if (step === null) {
    opened.secret.fill(0);
    return { kind: "invalid" };
  }
  const { blob, version } = encryptSecret(ring, opened.secret, associatedData(user.id));
  opened.secret.fill(0);
  const outcome = await inTransaction(deps.pool, async (tx) => {
    const [locked] = await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for("update");
    if (!locked) return null;
    const [existing] = await tx.select({ confirmedAt: userMfa.confirmedAt }).from(userMfa).where(eq(userMfa.userId, user.id));
    const replaced = Boolean(existing?.confirmedAt);
    // A first set-up never replaces an authenticator confirmed meanwhile (in another window): it must be started again.
    if (replaced && !opened.replace) return null;
    await tx.delete(userMfa).where(eq(userMfa.userId, user.id));
    await tx.insert(userMfa).values({ userId: user.id, totpSecretEnc: blob, keyVersion: version, confirmedAt: now, lastUsedStep: step, createdAt: now });
    const recoveryCodes = await replaceRecoveryCodes(tx, user.id, now);
    const others = await revokeUserSessions(tx, user.id, "revoked", now, current.session.id);
    const rotated = await rotateSession(tx, current.session, { now, ...meta, mfaVerified: true, reauthenticated: true });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf({ ...current, session: rotated.session }),
      ip: meta.ip,
      action: replaced ? "auth.mfa_replaced" : "auth.mfa_enabled",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: `${replaced ? "Authenticator app replaced" : "Two-factor authentication turned on"}; ${RECOVERY_CODE_COUNT} recovery codes issued; ${others} other session(s) signed out.`,
    });
    return { recoveryCodes, replaced, ...rotated };
  });
  if (!outcome) return { kind: "none" };
  await sendQuietly(
    deps.mailer,
    mailTemplates.securityNotice(
      user.email,
      user.displayName,
      outcome.replaced
        ? "The authenticator app of your account was replaced; the previous one no longer works."
        : "Two-factor authentication was turned on for your account.",
    ),
  );
  return { kind: "ok", ...outcome };
}

/**
 * New recovery codes (the old ones stop working). The caller checks the recent re-authentication. Under the user's row
 * lock, the acting session must still be live and the authenticator still set up (A2 Correction 1, review): a session
 * signed out meanwhile — by a replaced or removed authenticator, say — never receives codes.
 */
export async function regenerateRecoveryCodes(deps: AuthDeps, current: Current, meta: RequestMeta): Promise<string[] | null> {
  const now = deps.clock();
  const state = await mfaStateOf(deps.db, current.user.id, current.roles);
  if (!state.enrolled) return null;
  const codes = await inTransaction(deps.pool, async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, current.user.id)).for("update");
    await lockActingSession(tx, current.session, now);
    const [confirmed] = await tx.select({ at: userMfa.confirmedAt }).from(userMfa).where(eq(userMfa.userId, current.user.id)).limit(1);
    if (!confirmed?.at) return null;
    const fresh = await replaceRecoveryCodes(tx, current.user.id, now);
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(current),
      ip: meta.ip,
      action: "auth.recovery_codes_regenerated",
      entity: { type: "user", id: current.user.id, label: userLabel(current.user) },
      outcome: "success",
      summary: `${RECOVERY_CODE_COUNT} new recovery codes issued; the previous codes no longer work.`,
    });
    return fresh;
  });
  if (!codes) return null;
  await sendQuietly(
    deps.mailer,
    mailTemplates.securityNotice(current.user.email, current.user.displayName, "New recovery codes were created for your account; the old ones no longer work."),
  );
  return codes;
}

export type DisableResult = { kind: "ok"; token: string; session: SessionRow } | { kind: "required" } | { kind: "none" };

/** Turns 2FA off (optional roles only). The caller checks the recent re-authentication (password + code). */
export async function disableMfa(deps: AuthDeps, current: Current, meta: RequestMeta): Promise<DisableResult> {
  const now = deps.clock();
  const state = await mfaStateOf(deps.db, current.user.id, current.roles);
  if (state.required) return { kind: "required" };
  if (!state.enrolled) return { kind: "none" };
  const result = await inTransaction(deps.pool, async (tx) => {
    // The user's row first, like the other two-factor changes (one order of locks, fewer deadlocks).
    await tx.select({ id: users.id }).from(users).where(eq(users.id, current.user.id)).for("update");
    await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, current.user.id));
    await tx.delete(userMfa).where(eq(userMfa.userId, current.user.id));
    const others = await revokeUserSessions(tx, current.user.id, "revoked", now, current.session.id);
    const rotated = await rotateSession(tx, current.session, { now, ...meta, mfaCleared: true });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf({ ...current, session: rotated.session }),
      ip: meta.ip,
      action: "auth.mfa_disabled",
      entity: { type: "user", id: current.user.id, label: userLabel(current.user) },
      outcome: "success",
      summary: `Two-factor authentication turned off; ${others} other session(s) signed out.`,
    });
    return rotated;
  });
  await sendQuietly(
    deps.mailer,
    mailTemplates.securityNotice(current.user.email, current.user.displayName, "Two-factor authentication was turned off for your account."),
  );
  return { kind: "ok", ...result };
}

/** Removes a user's second factor and signs them out everywhere (used by the Owner's reset and the CLIs). */
export async function removeMfa(tx: Db, userId: string, now: Date): Promise<number> {
  await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
  await tx.delete(userMfa).where(eq(userMfa.userId, userId));
  return revokeUserSessions(tx, userId, "revoked", now);
}

// ---------------------------------------------------------------------------------------------------------------------
// Key versions (A1 §12.2) and the emergency reset (§12.4)

export async function mfaKeyVersions(db: Db): Promise<{ version: number; rows: number }[]> {
  const rows = await db
    .select({ version: userMfa.keyVersion, rows: sql<number>`COUNT(*)` })
    .from(userMfa)
    .groupBy(userMfa.keyVersion)
    .orderBy(asc(userMfa.keyVersion));
  return rows.map((r) => ({ version: r.version, rows: Number(r.rows) }));
}

/**
 * Re-encrypts every TOTP secret stored under an older key version with the active key, one row per transaction.
 * Rows whose key version is not configured (or that do not decrypt) are listed, untouched: they need the emergency
 * reset. Returns counts only.
 */
export async function reencryptMfaSecrets(deps: AuthDeps): Promise<{ reencrypted: number; unreadable: { userId: string; version: number }[] }> {
  const ring = deps.keyRing();
  const stale = await deps.db
    .select({ userId: userMfa.userId, version: userMfa.keyVersion })
    .from(userMfa)
    .where(ne(userMfa.keyVersion, ring.activeVersion));
  let reencrypted = 0;
  const unreadable: { userId: string; version: number }[] = [];
  for (const { userId, version } of stale) {
    const done = await inTransaction(deps.pool, async (tx) => {
      const [row] = await tx.select().from(userMfa).where(eq(userMfa.userId, userId)).for("update");
      if (!row || row.keyVersion === ring.activeVersion) return true;
      let secret: Buffer;
      try {
        secret = decryptSecret(ring, row.totpSecretEnc, row.keyVersion, associatedData(userId));
      } catch {
        return false;
      }
      const { blob, version: active } = encryptSecret(ring, secret, associatedData(userId));
      secret.fill(0);
      await tx.update(userMfa).set({ totpSecretEnc: blob, keyVersion: active }).where(eq(userMfa.userId, userId));
      return true;
    });
    if (done) reencrypted++;
    else unreadable.push({ userId, version });
  }
  return { reencrypted, unreadable };
}

export interface EmergencyResetResult {
  users: { id: string; email: string; link: string | null; delivered: boolean; sessionsRevoked: number }[];
}

/**
 * The emergency 2FA reset (A1 §12.4), run from the server CLI: removes the second factor of the given users (or every
 * user who has one), revokes their sessions and issues each a 30-minute password-reset link — sent when mail works,
 * otherwise returned for the operator to pass on. Audited with actor type `cli`.
 */
export async function emergencyMfaReset(
  deps: AuthDeps,
  target: { all: true } | { userIds: string[] },
  operator: string,
  requestId: string,
): Promise<EmergencyResetResult> {
  const now = deps.clock();
  const ids =
    "all" in target ? (await deps.db.select({ id: userMfa.userId }).from(userMfa)).map((r) => r.id) : [...new Set(target.userIds)];
  const out: EmergencyResetResult["users"] = [];
  for (const id of ids) {
    const [user] = await deps.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) continue;
    const { revoked, token } = await inTransaction(deps.pool, async (tx) => {
      const count = await removeMfa(tx, id, now);
      const issued = user.status === "active" ? await issueToken(tx, { userId: id, purpose: "password_reset", now }) : null;
      await recordAudit(tx, {
        at: now,
        requestId,
        actor: { type: "cli", label: operator },
        action: "auth.mfa_emergency_reset",
        entity: { type: "user", id, label: userLabel(user) },
        outcome: "success",
        summary: `Two-factor authentication removed by the emergency reset; ${count} session(s) revoked${issued ? "; password-reset link issued" : ""}.`,
      });
      return { revoked: count, token: issued?.token ?? null };
    });
    const link = token ? adminLink(deps, `reset/${token}`) : null;
    const delivered = link
      ? (
          await sendQuietly(
            deps.mailer,
            mailTemplates.passwordReset(user.email, user.displayName, link, TOKEN_LIFETIME_MS.password_reset / 60_000),
          )
        ).delivered
      : false;
    out.push({ id, email: user.email, link: delivered ? null : link, delivered, sessionsRevoked: revoked });
  }
  return { users: out };
}
