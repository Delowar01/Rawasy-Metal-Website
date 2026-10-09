/**
 * Two-factor authentication: enrolment, recovery codes, disabling, key rotation and the emergency reset
 * (A1-SECURITY-RBAC §3.6, §12.2–§12.4). Required for Owner and Admin, optional for Editor and Reviewer (A2 default).
 *
 * The TOTP secret is encrypted with the active AUTH_ENCRYPTION_KEY (AES-256-GCM, bound to the user's row) and stamped
 * with the key's version; it is shown to the user once, at enrolment, as a QR code and a text key, and is never logged.
 * Recovery codes: 10 single-use codes of 10 characters (50 random bits each), shown once, stored as SHA-256.
 */
import { randomInt } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import { inTransaction, type Db } from "../db/client.ts";
import { userMfa, userRecoveryCodes, users } from "../db/schema.ts";
import { mailTemplates, sendQuietly } from "../mail/mailer.ts";
import { decryptSecret, encryptSecret } from "../security/encryption.ts";
import { ulid } from "../security/ids.ts";
import { generateTotpSecret, otpauthUri, base32Encode, verifyTotp } from "../security/totp.ts";
import { mfaStateOf, type UserRow } from "./accounts.ts";
import { adminLink, type AuthDeps } from "./deps.ts";
import { registerFailure, recoveryCodeHash } from "./sign-in.ts";
import { revokeUserSessions, rotateSession, type SessionRow } from "./sessions.ts";
import { issueToken, TOKEN_LIFETIME_MS } from "./tokens.ts";
import { auditActorOf, type RequestMeta } from "./types.ts";

export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export const associatedData = (userId: string) => `user_mfa:${userId}`;

/** 10 new recovery codes, formatted "xxxxx-xxxxx". */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    let code = "";
    for (let i = 0; i < 10; i++) code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}

async function replaceRecoveryCodes(tx: Db, userId: string, now: Date): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
  await tx.insert(userRecoveryCodes).values(
    codes.map((code) => ({
      id: ulid(now.getTime()),
      userId,
      codeHash: recoveryCodeHash(code.replace("-", "")),
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

export type BeginEnrolmentResult =
  | { kind: "ok"; secret: string; uri: string }
  | { kind: "failed"; locked: boolean }
  | { kind: "already_enrolled" };

/**
 * Starts enrolment after the password is confirmed: a new secret, stored encrypted and unconfirmed, replacing any
 * earlier unconfirmed one. With `replace` (and a recent re-authentication checked by the caller), a confirmed
 * authenticator is replaced too — it stops working at once, and the new one must be confirmed.
 */
export async function beginEnrolment(
  deps: AuthDeps,
  current: Current,
  input: { password: string; replace?: boolean },
  meta: RequestMeta,
): Promise<BeginEnrolmentResult> {
  const now = deps.clock();
  const { user } = current;
  if (!user.passwordHash || !(await deps.hasher.verify(user.passwordHash, String(input.password ?? "")))) {
    const { locked } = await registerFailure(deps, user, "bad_credentials", meta, {
      action: "auth.reauth_failed",
      summary: "Two-factor set-up refused: wrong password.",
      revokeOnLock: current.session.id,
    });
    return { kind: "failed", locked };
  }
  const state = await mfaStateOf(deps.db, user.id, current.roles);
  if (state.enrolled && !input.replace) return { kind: "already_enrolled" };
  const ring = deps.keyRing();
  const secret = generateTotpSecret();
  const { blob, version } = encryptSecret(ring, secret, associatedData(user.id));
  await inTransaction(deps.pool, async (tx) => {
    await tx.delete(userMfa).where(eq(userMfa.userId, user.id));
    await tx.insert(userMfa).values({ userId: user.id, totpSecretEnc: blob, keyVersion: version, confirmedAt: null, lastUsedStep: null, createdAt: now });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(current),
      ip: meta.ip,
      action: state.enrolled ? "auth.mfa_replacement_started" : "auth.mfa_enrolment_started",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: state.enrolled
        ? "Started replacing the authenticator app (the previous one no longer works)."
        : "Started setting up two-factor authentication.",
    });
  });
  const result = { kind: "ok" as const, secret: base32Encode(secret), uri: otpauthUri(secret, user.email) };
  secret.fill(0);
  return result;
}

export type ConfirmEnrolmentResult =
  | { kind: "ok"; recoveryCodes: string[]; token: string; session: SessionRow }
  | { kind: "invalid" }
  | { kind: "none" };

/** Confirms enrolment with a first valid code: activates 2FA, issues recovery codes, signs out other sessions. */
export async function confirmEnrolment(deps: AuthDeps, current: Current, input: { code: string }, meta: RequestMeta): Promise<ConfirmEnrolmentResult> {
  const now = deps.clock();
  const { user } = current;
  const [row] = await deps.db.select().from(userMfa).where(eq(userMfa.userId, user.id)).limit(1);
  if (!row || row.confirmedAt) return { kind: "none" };
  const secret = decryptSecret(deps.keyRing(), row.totpSecretEnc, row.keyVersion, associatedData(user.id));
  const step = verifyTotp(secret, String(input.code ?? ""), now.getTime(), null);
  secret.fill(0);
  if (step === null) return { kind: "invalid" };
  const outcome = await inTransaction(deps.pool, async (tx) => {
    const [updated] = await tx
      .update(userMfa)
      .set({ confirmedAt: now, lastUsedStep: step })
      .where(and(eq(userMfa.userId, user.id), sql`${userMfa.confirmedAt} IS NULL`));
    if (updated.affectedRows !== 1) return null;
    const recoveryCodes = await replaceRecoveryCodes(tx, user.id, now);
    const others = await revokeUserSessions(tx, user.id, "revoked", now, current.session.id);
    const rotated = await rotateSession(tx, current.session, { now, ...meta, mfaVerified: true, reauthenticated: true });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf({ ...current, session: rotated.session }),
      ip: meta.ip,
      action: "auth.mfa_enabled",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: `Two-factor authentication turned on; ${RECOVERY_CODE_COUNT} recovery codes issued; ${others} other session(s) signed out.`,
    });
    return { recoveryCodes, ...rotated };
  });
  if (!outcome) return { kind: "none" };
  await sendQuietly(deps.mailer, mailTemplates.securityNotice(user.email, user.displayName, "Two-factor authentication was turned on for your account."));
  return { kind: "ok", ...outcome };
}

/** New recovery codes (the old ones stop working). The caller checks the recent re-authentication. */
export async function regenerateRecoveryCodes(deps: AuthDeps, current: Current, meta: RequestMeta): Promise<string[] | null> {
  const now = deps.clock();
  const state = await mfaStateOf(deps.db, current.user.id, current.roles);
  if (!state.enrolled) return null;
  const codes = await inTransaction(deps.pool, async (tx) => {
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
