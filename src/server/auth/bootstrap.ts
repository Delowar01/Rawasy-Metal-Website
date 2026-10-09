/**
 * The first Owner and the server-side recovery (A1-SECURITY-RBAC §3.9), behind `scripts/admin-bootstrap.mjs`.
 *
 * - `bootstrapOwner`: refuses while any active Owner exists; creates the person as `invited` with the Owner role (or
 *   renews the link of an Owner invited earlier who has not finished) and returns a single-use setup link valid 30
 *   minutes. No password is ever passed on a command line; only the token's hash is stored. Audited (`cli`).
 * - `recoveryReset`: for an existing active account when nobody can sign in — unlocks it, signs it out everywhere and
 *   returns a 30-minute password-reset link; optionally removes its second factor (lost device and recovery codes).
 */
import { and, eq, inArray } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import { inTransaction } from "../db/client.ts";
import { userRoles, users } from "../db/schema.ts";
import { ulid } from "../security/ids.ts";
import { activeOwnerIds, findUserByEmail, isPlausibleEmail, normalizeEmail } from "./accounts.ts";
import { adminLink, type AuthDeps } from "./deps.ts";
import { removeMfa } from "./mfa.ts";
import { revokeUserSessions } from "./sessions.ts";
import { issueToken, retireTokens, TOKEN_LIFETIME_MS } from "./tokens.ts";

export type BootstrapResult =
  | { kind: "created" | "renewed"; userId: string; link: string; expiresAt: Date }
  | { kind: "owner_exists" }
  | { kind: "email_in_use" }
  | { kind: "invalid"; field: "email" | "name" };

export async function bootstrapOwner(
  deps: AuthDeps,
  input: { email: string; displayName: string },
  operator: string,
): Promise<BootstrapResult> {
  const now = deps.clock();
  const enteredEmail = String(input.email ?? "").trim();
  const email = normalizeEmail(enteredEmail);
  const displayName = String(input.displayName ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!isPlausibleEmail(email)) return { kind: "invalid", field: "email" };
  if (!displayName || displayName.length > 120) return { kind: "invalid", field: "name" };
  const requestId = ulid(now.getTime());
  return inTransaction(deps.pool, async (tx) => {
    if ((await activeOwnerIds(tx, { lock: true })).length > 0) {
      await recordAudit(tx, {
        at: now,
        requestId,
        actor: { type: "cli", label: operator },
        action: "auth.bootstrap",
        entity: { type: "user", label: email },
        outcome: "denied",
        summary: "Bootstrap refused: an active Owner already exists.",
      });
      return { kind: "owner_exists" as const };
    }
    const [existing] = await tx.select().from(users).where(eq(users.emailNormalized, email)).for("update");
    let userId: string;
    let kind: "created" | "renewed";
    if (existing) {
      if (existing.status !== "invited" || existing.deletedAt) return { kind: "email_in_use" as const };
      userId = existing.id;
      kind = "renewed";
      await tx.insert(userRoles).ignore().values({ userId, roleKey: "owner", grantedBy: null, grantedAt: now });
      await retireTokens(tx, userId, ["invitation", "owner_setup"], now);
    } else {
      userId = ulid(now.getTime());
      kind = "created";
      await tx.insert(users).values({
        id: userId,
        email: enteredEmail,
        emailNormalized: email,
        displayName,
        status: "invited",
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(userRoles).values({ userId, roleKey: "owner", grantedBy: null, grantedAt: now });
    }
    const { token, row } = await issueToken(tx, { userId, purpose: "owner_setup", now });
    await recordAudit(tx, {
      at: now,
      requestId,
      actor: { type: "cli", label: operator },
      action: "auth.bootstrap",
      entity: { type: "user", id: userId, label: `${existing?.displayName ?? displayName} <${existing?.email ?? enteredEmail}>` },
      outcome: "success",
      summary:
        kind === "created"
          ? `First Owner invited from the server CLI; setup link valid ${TOKEN_LIFETIME_MS.owner_setup / 60_000} minutes.`
          : `Owner setup link renewed from the server CLI (valid ${TOKEN_LIFETIME_MS.owner_setup / 60_000} minutes).`,
    });
    return { kind, userId, link: adminLink(deps, `invite/${token}`), expiresAt: row.expiresAt };
  });
}

export type RecoveryResult =
  | { kind: "ok"; userId: string; link: string; expiresAt: Date; sessionsRevoked: number; mfaRemoved: boolean }
  | { kind: "not_found" }
  | { kind: "not_active"; status: string };

export async function recoveryReset(
  deps: AuthDeps,
  input: { email: string; removeMfa?: boolean },
  operator: string,
): Promise<RecoveryResult> {
  const now = deps.clock();
  const user = await findUserByEmail(deps.db, String(input.email ?? ""));
  if (!user) return { kind: "not_found" };
  if (user.status !== "active") return { kind: "not_active", status: user.status };
  const requestId = ulid(now.getTime());
  return inTransaction(deps.pool, async (tx) => {
    await tx.update(users).set({ lockedUntil: null, failedLoginCount: 0, updatedAt: now }).where(eq(users.id, user.id));
    const sessionsRevoked = input.removeMfa ? await removeMfa(tx, user.id, now) : await revokeUserSessions(tx, user.id, "revoked", now);
    await retireTokens(tx, user.id, ["password_reset", "email_change"], now);
    const { token, row } = await issueToken(tx, { userId: user.id, purpose: "password_reset", now });
    await recordAudit(tx, {
      at: now,
      requestId,
      actor: { type: "cli", label: operator },
      action: "auth.recovery_reset",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: `Recovery from the server CLI: account unlocked, ${sessionsRevoked} session(s) revoked, reset link issued${
        input.removeMfa ? ", two-factor authentication removed" : ""
      }.`,
    });
    return {
      kind: "ok" as const,
      userId: user.id,
      link: adminLink(deps, `reset/${token}`),
      expiresAt: row.expiresAt,
      sessionsRevoked,
      mfaRemoved: Boolean(input.removeMfa),
    };
  });
}

/** Whether any user holds the Owner role in a state that could still sign in (used by the CLI's messages). */
export async function ownerSummary(deps: AuthDeps) {
  const active = await activeOwnerIds(deps.db);
  const invited = await deps.db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.roleKey, "owner")))
    .where(inArray(users.status, ["invited"]));
  return { active: active.length, invited: invited.length };
}
