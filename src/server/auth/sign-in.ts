/**
 * Signing in, the second-factor step, step-up re-authentication and signing out (A1-SECURITY-RBAC §3.3–§3.7).
 *
 * Enumeration resistance: an unknown email, a wrong password, a locked, disabled or invited account all give the same
 * `failed` result, and each path verifies one password hash (a dummy one when there is no usable account), so the time
 * taken does not tell them apart either. Only the per-address throttle answers differently ("too many attempts from
 * this network"), which says nothing about any account.
 *
 * Lockout: 5 failed passwords or codes for an account within 15 minutes (counted since its last successful sign-in or
 * the end of its last lock) lock it for 15 minutes, doubling with each further lock before a successful sign-in, a
 * password reset or an unlock (at most 24 hours).
 * Before any password hash (A2 Correction 1): each password check takes one of 5 credential-check slots of the
 * normalised email — known or not — reserved atomically before the account is looked up; with all 5 taken (in the last
 * 15 minutes) nothing is hashed and the answer is the usual `failed`. Concurrent wrong passwords therefore cannot all be
 * hashed before the account's lock is written: at most 5 checks start in any 15 minutes, in any number of processes. A
 * successful password check, a password reset and an unlock free the slots again.
 * Per address: 30 attempts per 15 minutes. Failures are counted in `login_attempts` (evidence) inside a transaction
 * that holds the user row, so concurrent failures are counted once each. A second factor is checked inside that same
 * transaction, after the lock is read under the row lock, so concurrent codes are checked one at a time and none gets
 * past a lock that another one set (at most 5 codes per lock). In a signed-in session a password is not checked at
 * all while the account is locked, and a failure that locks the account, or that happens during a lock, ends the
 * session it came from.
 */
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import { inTransaction, type Db } from "../db/client.ts";
import { loginAttempts, LOGIN_FAILURE_REASONS, userMfa, userRecoveryCodes, users } from "../db/schema.ts";
import { DecryptionError, decryptSecret, KeyUnavailableError } from "../security/encryption.ts";
import { sha256 } from "../security/ids.ts";
import { dummyHash } from "../security/password.ts";
import { normalizeRecoveryCode, recoveryCodeHash } from "../security/recovery-codes.ts";
import { verifyTotp } from "../security/totp.ts";
import { findUserByEmail, isPlausibleEmail, mfaStateOf, normalizeEmail, rolesOf, type UserRow } from "./accounts.ts";
import type { AuthDeps } from "./deps.ts";
import { mailTemplates, sendQuietly } from "../mail/mailer.ts";
import { clearCredentialChecks, HOUR, hitRateLimit, LIMITS, MINUTE, reserveCredentialCheck } from "./rate-limit.ts";
import { createSession, isRotationDue, revokeSessionLineage, rotateSession, SessionEndedError, type SessionRow } from "./sessions.ts";
import { auditActorOf, type RequestMeta } from "./types.ts";

export const LOCKOUT = { failures: 5, windowMs: 15 * MINUTE, baseLockMs: 15 * MINUTE, maxLockMs: 24 * HOUR } as const;

type FailureReason = (typeof LOGIN_FAILURE_REASONS)[number];

export type SignInResult =
  | { kind: "signed_in"; token: string; session: SessionRow; user: UserRow; enrolmentRequired: boolean }
  | { kind: "mfa_required"; token: string; session: SessionRow }
  | { kind: "failed" }
  | { kind: "throttled" };

const clip = (value: string | null, max: number) => (value ? value.slice(0, max) : null);

async function recordAttempt(
  db: Db,
  now: Date,
  emailHash: Buffer,
  userId: string | null,
  meta: RequestMeta,
  succeeded: boolean,
  reason: FailureReason | null,
) {
  await db.insert(loginAttempts).values({
    attemptedAt: now,
    emailHash,
    userId,
    ip: clip(meta.ip, 45),
    succeeded,
    failureReason: reason,
    userAgent: clip(meta.userAgent, 255),
  });
}

const systemActor = (user?: UserRow | null) =>
  user ? { type: "user" as const, userId: user.id, label: userLabel(user) } : { type: "user" as const, label: "Unknown account" };

/** The account is locked now (`locked_until` in the future). */
export const isLocked = (user: Pick<UserRow, "lockedUntil">, now: Date) => Boolean(user.lockedUntil && user.lockedUntil.getTime() > now.getTime());

/** Reads the account's lock afresh (the request's copy of the user can be older than a lock set meanwhile). */
export async function isAccountLocked(db: Db, userId: string, now: Date): Promise<boolean> {
  const [row] = await db.select({ lockedUntil: users.lockedUntil }).from(users).where(eq(users.id, userId)).limit(1);
  return row ? isLocked(row, now) : false;
}

export interface FailureContext {
  action: string;
  summary: string;
  /** A session to end if this failure locks the account or comes during a lock (a session in progress). */
  revokeOnLock?: string;
}

/**
 * Records a failed password or code for a known account and locks it when the limit is reached. Run inside a
 * transaction that already holds the user's row (`SELECT … FOR UPDATE`); `row` is that locked, fresh copy.
 */
export async function registerFailureLocked(
  tx: Db,
  deps: Pick<AuthDeps, "clock">,
  row: UserRow,
  reason: "bad_credentials" | "mfa_failed",
  meta: RequestMeta,
  context: FailureContext,
): Promise<{ locked: boolean }> {
  const now = deps.clock();
  const emailHash = sha256(row.emailNormalized);
  await recordAttempt(tx, now, emailHash, row.id, meta, false, reason);
  await tx.update(users).set({ failedLoginCount: sql`LEAST(${users.failedLoginCount} + 1, 65535)` }).where(eq(users.id, row.id));
  const since = Math.max(
    now.getTime() - LOCKOUT.windowMs,
    row.lockedUntil && row.lockedUntil.getTime() <= now.getTime() ? row.lockedUntil.getTime() : 0,
    row.lastLoginAt?.getTime() ?? 0,
  );
  const [count] = await tx
    .select({ n: sql<number>`COUNT(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.emailHash, emailHash),
        eq(loginAttempts.succeeded, false),
        inArray(loginAttempts.failureReason, ["bad_credentials", "mfa_failed"]),
        gt(loginAttempts.attemptedAt, new Date(since)),
      ),
    );
  await recordAudit(tx, {
    at: now,
    requestId: meta.requestId,
    actor: systemActor(row),
    ip: meta.ip,
    action: context.action,
    entity: { type: "user", id: row.id, label: userLabel(row) },
    outcome: "failed",
    summary: context.summary,
  });
  if (isLocked(row, now)) {
    // A failure during a lock (another request locked the account while this one was checking): the session it came
    // from ends as well.
    if (context.revokeOnLock) await revokeSessionLineage(tx, context.revokeOnLock, "revoked", now);
    return { locked: true };
  }
  if (Number(count?.n ?? 0) < LOCKOUT.failures) return { locked: false };
  // Escalation: failures since the last successful sign-in (a success, a reset or an unlock clears the counter), so a
  // sustained attack doubles the lock each time — 15, 30, 60 … minutes — up to the 24-hour cap.
  const failures = Math.min(row.failedLoginCount + 1, 65535);
  const level = Math.max(0, Math.floor(failures / LOCKOUT.failures) - 1);
  const duration = Math.min(LOCKOUT.baseLockMs * 2 ** Math.min(level, 16), LOCKOUT.maxLockMs);
  await tx.update(users).set({ lockedUntil: new Date(now.getTime() + duration) }).where(eq(users.id, row.id));
  if (context.revokeOnLock) await revokeSessionLineage(tx, context.revokeOnLock, "revoked", now);
  await recordAudit(tx, {
    at: now,
    requestId: meta.requestId,
    actor: { type: "system", label: "Sign-in throttling" },
    ip: meta.ip,
    action: "auth.lockout",
    entity: { type: "user", id: row.id, label: userLabel(row) },
    outcome: "success",
    summary: `Account locked for ${Math.round(duration / MINUTE)} minutes after ${LOCKOUT.failures} failed attempts.`,
  });
  return { locked: true };
}

/** Records a failed password for a known account (its own transaction, holding the user row): see registerFailureLocked. */
export async function registerFailure(
  deps: AuthDeps,
  user: UserRow,
  reason: "bad_credentials" | "mfa_failed",
  meta: RequestMeta,
  context: FailureContext,
): Promise<{ locked: boolean }> {
  return inTransaction(deps.pool, async (tx) => {
    const [row] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
    return registerFailureLocked(tx, deps, row ?? user, reason, meta, context);
  });
}

/** Completes a sign-in: counters reset, attempt and audit recorded. Run inside a transaction. */
async function recordSuccess(tx: Db, user: UserRow, roles: string[], session: SessionRow, now: Date, meta: RequestMeta, how: string) {
  await tx.update(users).set({ failedLoginCount: 0, lastLoginAt: now, lockedUntil: null }).where(eq(users.id, user.id));
  await recordAttempt(tx, now, sha256(user.emailNormalized), user.id, meta, true, null);
  await recordAudit(tx, {
    at: now,
    requestId: meta.requestId,
    actor: auditActorOf({ user, roles, session }),
    ip: meta.ip,
    action: "auth.login",
    entity: { type: "user", id: user.id, label: userLabel(user) },
    outcome: "success",
    summary: `Signed in ${how}.`,
  });
}

/** Step 1: email and password. */
export async function signIn(deps: AuthDeps, input: { email: string; password: string }, meta: RequestMeta): Promise<SignInResult> {
  const now = deps.clock();
  const email = normalizeEmail(String(input.email ?? "")).slice(0, 320);
  const password = String(input.password ?? "").slice(0, 1024);
  const emailHash = sha256(email);

  const rate = await hitRateLimit(deps.db, `login:ip:${meta.ip ?? "unknown"}`, LIMITS.loginPerIp, now);
  if (!rate.allowed) {
    await recordAttempt(deps.db, now, emailHash, null, meta, false, "rate_limited");
    await recordAudit(deps.db, {
      at: now,
      requestId: meta.requestId,
      actor: { type: "user", label: "Unknown account" },
      ip: meta.ip,
      action: "auth.login_throttled",
      outcome: "denied",
      summary: "Sign-in refused: too many attempts from this address.",
    });
    return { kind: "throttled" };
  }

  // Before the account is looked up or any hash computed: one of the email's 5 credential-check slots (A2 Correction 1).
  if (!(await reserveCredentialCheck(deps.db, email, now))) {
    await recordAttempt(deps.db, now, emailHash, null, meta, false, "rate_limited");
    await recordAudit(deps.db, {
      at: now,
      requestId: meta.requestId,
      actor: { type: "user", label: "Unknown account" },
      ip: meta.ip,
      action: "auth.login_throttled",
      outcome: "denied",
      summary: "Sign-in refused before any password check: 5 checks for this email in the last 15 minutes.",
    });
    return { kind: "failed" };
  }

  const user = isPlausibleEmail(email) ? await findUserByEmail(deps.db, email) : null;
  const locked = Boolean(user && isLocked(user, now));
  if (!user || user.status !== "active" || !user.passwordHash || locked) {
    await deps.hasher.verify(await dummyHash(deps.hasher), password);
    const reason: FailureReason = !user ? "bad_credentials" : user.status === "disabled" ? "disabled" : locked ? "locked" : "bad_credentials";
    await recordAttempt(deps.db, now, emailHash, user?.id ?? null, meta, false, reason);
    await recordAudit(deps.db, {
      at: now,
      requestId: meta.requestId,
      actor: systemActor(user),
      ip: meta.ip,
      action: "auth.login_failed",
      entity: user ? { type: "user", id: user.id, label: userLabel(user) } : undefined,
      outcome: "failed",
      summary: !user
        ? "Sign-in failed: no account with that email."
        : reason === "disabled"
          ? "Sign-in refused: the account is disabled."
          : reason === "locked"
            ? "Sign-in refused: the account is locked."
            : "Sign-in refused: the account has not been activated.",
    });
    return { kind: "failed" };
  }

  if (!(await deps.hasher.verify(user.passwordHash, password))) {
    await registerFailure(deps, user, "bad_credentials", meta, { action: "auth.login_failed", summary: "Sign-in failed: wrong password." });
    return { kind: "failed" };
  }

  let verifiedHash = user.passwordHash;
  if (deps.hasher.needsRehash(user.passwordHash)) {
    const rehashed = await deps.hasher.hash(password);
    // Written only over the hash that was verified: a password changed or reset meanwhile is never overwritten.
    const [written] = await deps.db
      .update(users)
      .set({ passwordHash: rehashed })
      .where(and(eq(users.id, user.id), eq(users.passwordHash, user.passwordHash)));
    if (written.affectedRows === 1) {
      verifiedHash = rehashed;
      await recordAudit(deps.db, {
        at: now,
        requestId: meta.requestId,
        actor: systemActor(user),
        ip: meta.ip,
        action: "auth.password_rehashed",
        entity: { type: "user", id: user.id, label: userLabel(user) },
        outcome: "success",
        summary: `Password hash upgraded to the current ${deps.hasher.kind} parameters.`,
      });
    } else {
      // The stored hash changed meanwhile: another sign-in's upgrade (the password still matches it) or a real change
      // (it does not). The password is checked against what is stored now, and the session check below compares with that.
      const [stored] = await deps.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
      if (stored?.passwordHash && (await deps.hasher.verify(stored.passwordHash, password))) verifiedHash = stored.passwordHash;
    }
  }

  // The session is created under the user's row lock, and only while the account is exactly as it was checked: the
  // same password hash, active, not locked (A2 Correction 1, review). A password reset or change, a disable or a lock
  // that committed while the password was being hashed wins; one that commits later takes the same row lock first and
  // then signs this session out with the others. A password replaced meanwhile never yields a session.
  const outcome = await inTransaction(deps.pool, async (tx) => {
    const row = await lockUser(tx, user.id);
    if (!row || row.status !== "active" || row.deletedAt || row.passwordHash !== verifiedHash) {
      return { ok: false as const, reason: (row?.status === "disabled" ? "disabled" : "bad_credentials") as FailureReason };
    }
    if (isLocked(row, now)) return { ok: false as const, reason: "locked" as FailureReason };
    const roles = await rolesOf(tx, row.id);
    const mfa = await mfaStateOf(tx, row.id, roles);
    if (mfa.enrolled) {
      const { token, session } = await createSession(tx, { userId: row.id, now, ...meta, mfaVerified: false, pending: true });
      await recordAudit(tx, {
        at: now,
        requestId: meta.requestId,
        actor: auditActorOf({ user: row, roles, session }),
        ip: meta.ip,
        action: "auth.password_verified",
        entity: { type: "user", id: row.id, label: userLabel(row) },
        outcome: "success",
        summary: "Password accepted; waiting for the second factor.",
      });
      return { ok: true as const, result: { kind: "mfa_required" as const, token, session } };
    }
    const { token, session } = await createSession(tx, { userId: row.id, now, ...meta, mfaVerified: false });
    await recordSuccess(tx, row, roles, session, now, meta, mfa.required ? "with a password (two-factor set-up required)" : "with a password");
    return { ok: true as const, result: { kind: "signed_in" as const, token, session, user: row, enrolmentRequired: mfa.required } };
  });
  if (!outcome.ok) {
    // Refused like a wrong password, and never counted against the account (the password was right when it was checked):
    // recorded as an attempt only with a reason the lockout ignores (disabled, locked); a password replaced meanwhile is
    // in the audit log only.
    if (outcome.reason !== "bad_credentials") await recordAttempt(deps.db, now, emailHash, user.id, meta, false, outcome.reason);
    await recordAudit(deps.db, {
      at: now,
      requestId: meta.requestId,
      actor: systemActor(user),
      ip: meta.ip,
      action: "auth.login_failed",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "failed",
      summary: "Sign-in refused: the account changed (password, status or lock) while the password was being checked.",
    });
    return { kind: "failed" };
  }
  await clearCredentialChecks(deps.db, email);
  return outcome.result;
}

export type SecondFactorResult =
  | { kind: "signed_in"; token: string; session: SessionRow; remainingRecoveryCodes?: number }
  /** `locked`: the pending session has ended (the account is locked, or no longer active); sign in again. */
  | { kind: "failed"; locked: boolean }
  | { kind: "unavailable" };

/** Loads and decrypts a user's confirmed TOTP secret (`db`: the transaction that checks the code). */
export async function loadTotpSecret(deps: Pick<AuthDeps, "keyRing">, db: Db, userId: string) {
  const [row] = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
  if (!row || !row.confirmedAt) return null;
  const secret = decryptSecret(deps.keyRing(), row.totpSecretEnc, row.keyVersion, `user_mfa:${userId}`);
  return { row, secret };
}

/** Accepts a TOTP code once: the step is stored atomically, so a replay (or a concurrent second use) is refused. */
export async function consumeTotp(deps: Pick<AuthDeps, "keyRing" | "clock">, db: Db, userId: string, code: string): Promise<boolean> {
  const loaded = await loadTotpSecret(deps, db, userId);
  if (!loaded) return false;
  const step = verifyTotp(loaded.secret, code, deps.clock().getTime(), loaded.row.lastUsedStep);
  loaded.secret.fill(0);
  if (step === null) return false;
  const [result] = await db
    .update(userMfa)
    .set({ lastUsedStep: step })
    .where(and(eq(userMfa.userId, userId), or(isNull(userMfa.lastUsedStep), sql`${userMfa.lastUsedStep} < ${step}`)));
  return result.affectedRows === 1;
}

/** Uses one recovery code (single use, atomically). */
export async function consumeRecoveryCode(db: Db, userId: string, input: string, now: Date): Promise<boolean> {
  const normalized = normalizeRecoveryCode(input);
  if (!normalized) return false;
  const [result] = await db
    .update(userRecoveryCodes)
    .set({ usedAt: now })
    .where(and(eq(userRecoveryCodes.userId, userId), eq(userRecoveryCodes.codeHash, recoveryCodeHash(normalized)), isNull(userRecoveryCodes.usedAt)));
  return result.affectedRows === 1;
}

export async function remainingRecoveryCodes(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(userRecoveryCodes)
    .where(and(eq(userRecoveryCodes.userId, userId), isNull(userRecoveryCodes.usedAt)));
  return Number(row?.n ?? 0);
}

const keyProblem = (error: unknown): error is KeyUnavailableError | DecryptionError =>
  error instanceof KeyUnavailableError || error instanceof DecryptionError;

/** Locks the user's row for the rest of the transaction and returns its current state. */
async function lockUser(tx: Db, userId: string): Promise<UserRow | null> {
  const [row] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  return row ?? null;
}

/**
 * Step 2 (accounts with an authenticator): a TOTP code or a recovery code completes the sign-in. The lock, the code and
 * the outcome (a counted failure, or the completed sign-in) are one transaction holding the user's row.
 */
export async function verifySecondFactor(
  deps: AuthDeps,
  pending: { session: SessionRow; user: UserRow },
  input: { code?: string; recoveryCode?: string },
  meta: RequestMeta,
): Promise<SecondFactorResult> {
  const now = deps.clock();
  const usingRecovery = Boolean(input.recoveryCode && !input.code);
  const roles = await rolesOf(deps.db, pending.user.id);
  const result = await inTransaction(deps.pool, async (tx): Promise<SecondFactorResult> => {
    const user = await lockUser(tx, pending.user.id);
    if (!user || user.status !== "active" || user.deletedAt || isLocked(user, now)) {
      await revokeSessionLineage(tx, pending.session.id, "revoked", now);
      return { kind: "failed", locked: true };
    }
    let ok: boolean;
    try {
      ok = usingRecovery
        ? await consumeRecoveryCode(tx, user.id, String(input.recoveryCode), now)
        : await consumeTotp(deps, tx, user.id, String(input.code ?? ""));
    } catch (error) {
      if (!keyProblem(error)) throw error;
      await recordAudit(tx, {
        at: now,
        requestId: meta.requestId,
        actor: systemActor(user),
        ip: meta.ip,
        action: "auth.mfa_key_unavailable",
        entity: { type: "user", id: user.id, label: userLabel(user) },
        outcome: "failed",
        summary:
          error instanceof KeyUnavailableError
            ? `Two-factor secret cannot be read: key version ${error.version} is not configured.`
            : "Two-factor secret cannot be decrypted with the configured key.",
      });
      return { kind: "unavailable" };
    }
    if (!ok) {
      const { locked } = await registerFailureLocked(tx, deps, user, "mfa_failed", meta, {
        action: "auth.mfa_failed",
        summary: usingRecovery ? "Second factor failed: invalid or used recovery code." : "Second factor failed: wrong or reused code.",
        revokeOnLock: pending.session.id,
      });
      return { kind: "failed", locked };
    }
    const rotated = await rotateSession(tx, pending.session, { now, ...meta, mfaVerified: true, reauthenticated: true, fullLifetime: true });
    await recordSuccess(tx, user, roles, rotated.session, now, meta, usingRecovery ? "with a recovery code" : "with two-factor authentication");
    if (usingRecovery) {
      await recordAudit(tx, {
        at: now,
        requestId: meta.requestId,
        actor: auditActorOf({ user, roles, session: rotated.session }),
        ip: meta.ip,
        action: "auth.recovery_code_used",
        entity: { type: "user", id: user.id, label: userLabel(user) },
        outcome: "success",
        summary: "A recovery code was used to sign in.",
      });
    }
    return { kind: "signed_in", token: rotated.token, session: rotated.session };
  });
  if (result.kind !== "signed_in" || !usingRecovery) return result;
  const { user } = pending;
  await sendQuietly(deps.mailer, mailTemplates.securityNotice(user.email, user.displayName, "A recovery code was just used to sign in to your account."));
  return { ...result, remainingRecoveryCodes: await remainingRecoveryCodes(deps.db, user.id) };
}

export type ReauthResult =
  | { kind: "ok"; token: string; session: SessionRow }
  | { kind: "failed"; locked: boolean }
  /** The account is locked: no password or code is checked until the lock ends. */
  | { kind: "locked" }
  | { kind: "unavailable" };

/**
 * Step-up re-authentication for sensitive actions (A1 §3.7): the password, and a TOTP code when an authenticator is
 * set up. Refused while the account is locked or its 5 credential checks are taken (A2 Correction 1: nothing is hashed
 * then); failures count towards the lockout, and a lock ends this session. The code is checked like the sign-in's
 * second factor, in one transaction holding the user's row.
 */
export async function reauthenticate(
  deps: AuthDeps,
  current: { session: SessionRow; user: UserRow; roles: string[] },
  input: { password: string; code?: string },
  meta: RequestMeta,
): Promise<ReauthResult> {
  const now = deps.clock();
  const { user } = current;
  if (await isAccountLocked(deps.db, user.id, now)) return { kind: "locked" };
  if (!(await reserveCredentialCheck(deps.db, user.emailNormalized, now))) return { kind: "locked" };
  if (!user.passwordHash || !(await deps.hasher.verify(user.passwordHash, String(input.password ?? "")))) {
    const { locked } = await registerFailure(deps, user, "bad_credentials", meta, {
      action: "auth.reauth_failed",
      summary: "Re-authentication failed: wrong password.",
      revokeOnLock: current.session.id,
    });
    return { kind: "failed", locked };
  }
  await clearCredentialChecks(deps.db, user.emailNormalized);
  const mfa = await mfaStateOf(deps.db, user.id, current.roles);
  const code = String(input.code ?? "");
  // A recovery code given instead of the app's code is recorded and notified, as at sign-in (fifth review).
  const usingRecovery = mfa.enrolled && Boolean(normalizeRecoveryCode(code));
  const result = await inTransaction(deps.pool, async (tx): Promise<ReauthResult> => {
    const row = await lockUser(tx, user.id);
    if (!row || isLocked(row, now)) return { kind: "locked" };
    if (mfa.enrolled) {
      let ok: boolean;
      try {
        ok = usingRecovery ? await consumeRecoveryCode(tx, user.id, code, now) : await consumeTotp(deps, tx, user.id, code);
      } catch (error) {
        if (keyProblem(error)) return { kind: "unavailable" };
        throw error;
      }
      if (!ok) {
        const { locked } = await registerFailureLocked(tx, deps, row, "mfa_failed", meta, {
          action: "auth.reauth_failed",
          summary: "Re-authentication failed: wrong or reused code.",
          revokeOnLock: current.session.id,
        });
        return { kind: "failed", locked };
      }
    }
    const rotated = await rotateSession(tx, current.session, { now, ...meta, reauthenticated: true });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf({ user, roles: current.roles, session: rotated.session }),
      ip: meta.ip,
      action: "auth.reauthenticated",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: "Identity confirmed for sensitive actions (10 minutes).",
    });
    if (usingRecovery) {
      await recordAudit(tx, {
        at: now,
        requestId: meta.requestId,
        actor: auditActorOf({ user, roles: current.roles, session: rotated.session }),
        ip: meta.ip,
        action: "auth.recovery_code_used",
        entity: { type: "user", id: user.id, label: userLabel(user) },
        outcome: "success",
        summary: "A recovery code was used to confirm identity for sensitive actions.",
      });
    }
    return { kind: "ok", ...rotated };
  });
  if (result.kind === "ok" && usingRecovery) {
    await sendQuietly(
      deps.mailer,
      mailTemplates.securityNotice(user.email, user.displayName, "A recovery code was just used to confirm your identity for a sensitive action."),
    );
  }
  return result;
}

/**
 * Rotates a session that has been in use for 30 minutes (called by the admin shell; A1 §3.3). Best effort: when the
 * session was rotated or revoked by another request meanwhile there is nothing to do (null), and that request's
 * outcome stands.
 */
export async function rotateIfDue(deps: AuthDeps, session: SessionRow, meta: RequestMeta): Promise<{ token: string; session: SessionRow } | null> {
  const now = deps.clock();
  if (!isRotationDue(session, now)) return null;
  try {
    return await inTransaction(deps.pool, async (tx) => {
      // The user's row first, the order every revocation uses: a "sign out everywhere" at the same moment queues
      // instead of deadlocking with this claim and the new row's foreign key.
      await lockUser(tx, session.userId);
      return rotateSession(tx, session, { now, ...meta });
    });
  } catch (error) {
    if (error instanceof SessionEndedError) return null;
    throw error;
  }
}

/**
 * Ends the current session — with the session that replaced it, if another tab's request rotated it after this one read
 * it (A2 Correction 1, fifth review) — holding the user's row, the lock every rotation takes first.
 */
export async function signOut(deps: AuthDeps, current: { session: SessionRow; user: UserRow; roles: string[] }, meta: RequestMeta) {
  const now = deps.clock();
  await inTransaction(deps.pool, async (tx) => {
    await lockUser(tx, current.user.id);
    await revokeSessionLineage(tx, current.session.id, "logout", now);
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(current),
      ip: meta.ip,
      action: "auth.logout",
      entity: { type: "user", id: current.user.id, label: userLabel(current.user) },
      outcome: "success",
      summary: "Signed out.",
    });
  });
}
