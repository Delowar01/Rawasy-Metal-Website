/**
 * Password change and password reset (A1-SECURITY-RBAC §3.2, §3.5).
 *
 * Reset: a request always gets the same answer whether or not the account exists. It is limited to 3 per account and
 * 10 per address an hour; when the account exists and is active, a single-use link valid 30 minutes is sent. With no
 * mail transport (A2 production default) no token is created at all, and the page says that email is not available —
 * it never claims that a message was sent. Completing a reset sets the password, clears a lock, revokes every session.
 */
import { eq } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import { inTransaction } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { mailTemplates, sendQuietly } from "../mail/mailer.ts";
import { sha256 } from "../security/ids.ts";
import { checkPassword, type PasswordProblem } from "../security/password-policy.ts";
import { findUserByEmail, isPlausibleEmail, mfaStateOf, normalizeEmail, type UserRow } from "./accounts.ts";
import { adminLink, type AuthDeps } from "./deps.ts";
import { hitRateLimit, LIMITS } from "./rate-limit.ts";
import { isAccountLocked, registerFailure } from "./sign-in.ts";
import { revokeUserSessions, rotateSession, type SessionRow } from "./sessions.ts";
import { consumeToken, findUsableToken, issueToken, retireTokens, TOKEN_LIFETIME_MS } from "./tokens.ts";
import { auditActorOf, type RequestMeta } from "./types.ts";

export type ChangePasswordResult =
  | { kind: "ok"; token: string; session: SessionRow; othersSignedOut: number }
  | { kind: "wrong_password"; locked: boolean }
  /** The account is locked: the current password is not checked until the lock ends. */
  | { kind: "locked" }
  | { kind: "weak"; problem: PasswordProblem }
  | { kind: "same" };

/**
 * Changes one's own password: the current one is required (never checked while the account is locked); other sessions
 * end; this one rotates. The new password counts as a re-authentication only for an account without two-factor
 * authentication: with an authenticator, the 10-minute window for sensitive actions still needs a code (A1 §3.7).
 */
export async function changePassword(
  deps: AuthDeps,
  current: { session: SessionRow; user: UserRow; roles: string[] },
  input: { currentPassword: string; newPassword: string },
  meta: RequestMeta,
): Promise<ChangePasswordResult> {
  const now = deps.clock();
  const { user } = current;
  if (await isAccountLocked(deps.db, user.id, now)) return { kind: "locked" };
  if (!user.passwordHash || !(await deps.hasher.verify(user.passwordHash, String(input.currentPassword ?? "")))) {
    const { locked } = await registerFailure(deps, user, "bad_credentials", meta, {
      action: "auth.reauth_failed",
      summary: "Password change refused: wrong current password.",
      revokeOnLock: current.session.id,
    });
    return { kind: "wrong_password", locked };
  }
  const next = String(input.newPassword ?? "");
  const problem = checkPassword(next, { email: user.email, name: user.displayName });
  if (problem) return { kind: "weak", problem };
  if (await deps.hasher.verify(user.passwordHash, next)) return { kind: "same" };
  const hash = await deps.hasher.hash(next);
  const mfa = await mfaStateOf(deps.db, user.id, current.roles);
  const result = await inTransaction(deps.pool, async (tx) => {
    await tx.update(users).set({ passwordHash: hash, passwordChangedAt: now, updatedAt: now, updatedBy: user.id }).where(eq(users.id, user.id));
    await retireTokens(tx, user.id, ["password_reset"], now);
    const othersSignedOut = await revokeUserSessions(tx, user.id, "password_changed", now, current.session.id);
    const rotated = await rotateSession(tx, current.session, { now, ...meta, reauthenticated: !mfa.enrolled });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf({ ...current, session: rotated.session }),
      ip: meta.ip,
      action: "auth.password_changed",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: `Password changed; ${othersSignedOut} other session(s) signed out.`,
    });
    return { ...rotated, othersSignedOut };
  });
  await sendQuietly(deps.mailer, mailTemplates.securityNotice(user.email, user.displayName, "The password of your account was changed."));
  return { kind: "ok", ...result };
}

export interface ResetRequestResult {
  /** False when no mail transport is configured: nothing was (or could be) sent, whatever the email. */
  mailConfigured: boolean;
}

/** Asks for a reset link. The answer never depends on whether the account exists. */
export async function requestPasswordReset(deps: AuthDeps, input: { email: string }, meta: RequestMeta): Promise<ResetRequestResult> {
  if (!deps.mailer.configured) return { mailConfigured: false };
  const now = deps.clock();
  const email = normalizeEmail(String(input.email ?? "")).slice(0, 320);
  const perIp = await hitRateLimit(deps.db, `reset:ip:${meta.ip ?? "unknown"}`, LIMITS.resetPerIp, now);
  const perAccount = await hitRateLimit(deps.db, `reset:account:${sha256(email).toString("hex")}`, LIMITS.resetPerAccount, now);
  const user = isPlausibleEmail(email) ? await findUserByEmail(deps.db, email) : null;
  if (!perIp.allowed || !perAccount.allowed) {
    if (user) {
      await recordAudit(deps.db, {
        at: now,
        requestId: meta.requestId,
        actor: { type: "user", userId: user.id, label: userLabel(user) },
        ip: meta.ip,
        action: "auth.password_reset_throttled",
        entity: { type: "user", id: user.id, label: userLabel(user) },
        outcome: "denied",
        summary: "Password-reset request refused: too many requests.",
      });
    }
    return { mailConfigured: true };
  }
  if (!user || user.status !== "active") return { mailConfigured: true };
  const { token } = await inTransaction(deps.pool, async (tx) => {
    const issued = await issueToken(tx, { userId: user.id, purpose: "password_reset", now, createdIp: meta.ip });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: { type: "user", userId: user.id, label: userLabel(user) },
      ip: meta.ip,
      action: "auth.password_reset_requested",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: "Password-reset link sent.",
    });
    return issued;
  });
  const link = adminLink(deps, `reset/${token}`);
  void sendQuietly(deps.mailer, mailTemplates.passwordReset(user.email, user.displayName, link, TOKEN_LIFETIME_MS.password_reset / 60_000));
  return { mailConfigured: true };
}

/** Whether a reset link can still be used (for the page), without consuming it. */
export async function inspectResetToken(deps: AuthDeps, token: string): Promise<{ email: string } | null> {
  const found = await findUsableToken(deps.db, token, ["password_reset"], deps.clock());
  return found && found.user.status === "active" ? { email: found.user.email } : null;
}

export type CompleteResetResult = { kind: "ok" } | { kind: "invalid" } | { kind: "weak"; problem: PasswordProblem };

/** Sets a new password with a reset link: single use; clears a lock; every session of the account ends. */
export async function completePasswordReset(
  deps: AuthDeps,
  input: { token: string; password: string },
  meta: RequestMeta,
): Promise<CompleteResetResult> {
  const now = deps.clock();
  const found = await findUsableToken(deps.db, input.token, ["password_reset"], now);
  if (!found || found.user.status !== "active") return { kind: "invalid" };
  const { user } = found;
  const password = String(input.password ?? "");
  const problem = checkPassword(password, { email: user.email, name: user.displayName });
  if (problem) return { kind: "weak", problem };
  const hash = await deps.hasher.hash(password);
  const ok = await inTransaction(deps.pool, async (tx) => {
    const again = await findUsableToken(tx, input.token, ["password_reset"], now, { lock: true });
    if (!again || !(await consumeToken(tx, again.token.id, now))) return false;
    await tx
      .update(users)
      .set({ passwordHash: hash, passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null, updatedAt: now, updatedBy: user.id })
      .where(eq(users.id, user.id));
    await retireTokens(tx, user.id, ["password_reset"], now);
    const revoked = await revokeUserSessions(tx, user.id, "password_changed", now);
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: { type: "user", userId: user.id, label: userLabel(user) },
      ip: meta.ip,
      action: "auth.password_reset",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: `Password reset with an emailed link; ${revoked} session(s) signed out.`,
    });
    return true;
  });
  if (!ok) return { kind: "invalid" };
  await sendQuietly(deps.mailer, mailTemplates.securityNotice(user.email, user.displayName, "The password of your account was reset."));
  return { kind: "ok" };
}
