/**
 * Managing other users (A1-SECURITY-RBAC §3.1, §5.2–§5.3): list and inspect, disable and enable, change roles, sign
 * out, unlock, and (Owner only) reset someone's two-factor authentication. Every function re-checks the permission and
 * the rank rule itself (never trusting the page that offered the action), refuses to act on oneself, keeps at least
 * one active Owner (checked under a row lock in the same transaction), and audits both successes and denials. The
 * caller checks the recent re-authentication that these sensitive permissions require. There is no permanent delete.
 */
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import { inTransaction } from "../db/client.ts";
import { auditEvents, sessions, userMfa, userRoles, users } from "../db/schema.ts";
import { mailTemplates, sendQuietly } from "../mail/mailer.ts";
import { canGrantRoles, canManageUser, isOwner } from "../policy/rbac.ts";
import { ROLE_KEYS } from "../policy/registry.ts";
import { activeOwnerIds, findUserById, rolesOf, rolesOfMany, type UserRow } from "./accounts.ts";
import type { AuthDeps } from "./deps.ts";
import { removeMfa } from "./mfa.ts";
import { clearCredentialChecks } from "./rate-limit.ts";
import { listLiveSessions, revokeSession, revokeUserSessions, type SessionRow } from "./sessions.ts";
import { retireTokens } from "./tokens.ts";
import { auditActorOf, type Actor, type RequestMeta } from "./types.ts";

export interface UserListItem {
  id: string;
  email: string;
  displayName: string;
  status: UserRow["status"];
  roles: string[];
  mfaEnabled: boolean;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  liveSessions: number;
  manageable: boolean;
}

export async function listUsers(deps: AuthDeps, actor: Actor): Promise<UserListItem[]> {
  const now = deps.clock();
  const rows = await deps.db.select().from(users).where(isNull(users.deletedAt)).orderBy(asc(users.displayName), asc(users.id));
  const roleMap = await rolesOfMany(
    deps.db,
    rows.map((r) => r.id),
  );
  const mfaRows = await deps.db.select({ userId: userMfa.userId, confirmedAt: userMfa.confirmedAt }).from(userMfa);
  const mfa = new Set(mfaRows.filter((r) => r.confirmedAt).map((r) => r.userId));
  const sessionCounts = await deps.db
    .select({ userId: sessions.userId, n: sql<number>`COUNT(*)` })
    .from(sessions)
    .where(and(isNull(sessions.revokedAt), gt(sessions.idleExpiresAt, now), gt(sessions.absoluteExpiresAt, now)))
    .groupBy(sessions.userId);
  const counts = new Map(sessionCounts.map((r) => [r.userId, Number(r.n)]));
  return rows.map((row) => {
    const roles = roleMap.get(row.id) ?? [];
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      status: row.status,
      roles,
      mfaEnabled: mfa.has(row.id),
      lockedUntil: row.lockedUntil && row.lockedUntil.getTime() > now.getTime() ? row.lockedUntil : null,
      lastLoginAt: row.lastLoginAt,
      liveSessions: counts.get(row.id) ?? 0,
      manageable: row.id !== actor.user.id && canManageUser(actor, { roles }),
    };
  });
}

export interface UserDetail extends UserListItem {
  createdAt: Date;
  passwordChangedAt: Date | null;
  failedLoginCount: number;
  disabledAt: Date | null;
  sessions: SessionRow[];
  recentEvents: { occurredAt: Date; action: string; outcome: string; summary: string; ip: string | null }[];
}

export async function getUserDetail(deps: AuthDeps, actor: Actor, userId: string): Promise<UserDetail | null> {
  const list = await listUsers(deps, actor);
  const item = list.find((u) => u.id === userId);
  const user = item ? await findUserById(deps.db, userId) : null;
  if (!item || !user) return null;
  const events = await deps.db
    .select({
      occurredAt: auditEvents.occurredAt,
      action: auditEvents.action,
      outcome: auditEvents.outcome,
      summary: auditEvents.summary,
      ip: auditEvents.ip,
    })
    .from(auditEvents)
    .where(and(eq(auditEvents.entityType, "user"), eq(auditEvents.entityId, userId)))
    .orderBy(desc(auditEvents.id))
    .limit(20);
  return {
    ...item,
    createdAt: user.createdAt,
    passwordChangedAt: user.passwordChangedAt,
    failedLoginCount: user.failedLoginCount,
    disabledAt: user.disabledAt,
    sessions: await listLiveSessions(deps.db, userId, deps.clock()),
    recentEvents: events,
  };
}

export type ManageResult =
  | { kind: "ok"; summary: string }
  | { kind: "denied"; reason: "permission" | "rank" | "self" | "owner_only" }
  | { kind: "last_owner" }
  | { kind: "not_found" }
  | { kind: "invalid" };

async function deny(
  deps: AuthDeps,
  actor: Actor,
  meta: RequestMeta,
  action: string,
  target: UserRow | null,
  reason: "permission" | "rank" | "self" | "owner_only",
): Promise<ManageResult> {
  const why = {
    permission: "missing permission",
    rank: "the user's rank is equal or higher",
    self: "one cannot do this to one's own account",
    owner_only: "only an Owner may do this",
  }[reason];
  await recordAudit(deps.db, {
    at: deps.clock(),
    requestId: meta.requestId,
    actor: auditActorOf(actor),
    ip: meta.ip,
    action,
    entity: target ? { type: "user", id: target.id, label: userLabel(target) } : { type: "user" },
    outcome: "denied",
    summary: `Refused: ${why}.`,
  });
  return { kind: "denied", reason };
}

/** Loads the target and applies the common checks; returns the target and its roles, or a refusal. */
async function authorize(deps: AuthDeps, actor: Actor, meta: RequestMeta, action: string, permission: string, targetId: string) {
  const target = await findUserById(deps.db, targetId);
  if (!actor.permissions.has(permission)) return { refusal: await deny(deps, actor, meta, action, target, "permission") };
  if (!target) return { refusal: { kind: "not_found" } as ManageResult };
  if (target.id === actor.user.id) return { refusal: await deny(deps, actor, meta, action, target, "self") };
  const roles = await rolesOf(deps.db, target.id);
  if (!canManageUser(actor, { roles })) return { refusal: await deny(deps, actor, meta, action, target, "rank") };
  return { target, roles };
}

/** Disables (signing the user out everywhere) or re-enables an account. */
export async function setUserStatus(
  deps: AuthDeps,
  actor: Actor,
  targetId: string,
  status: "active" | "disabled",
  meta: RequestMeta,
): Promise<ManageResult> {
  const action = status === "disabled" ? "user.disable" : "user.enable";
  const checked = await authorize(deps, actor, meta, action, "users.disable", targetId);
  if ("refusal" in checked) return checked.refusal as ManageResult;
  const { target, roles } = checked;
  const now = deps.clock();
  return inTransaction(deps.pool, async (tx) => {
    const [row] = await tx.select().from(users).where(eq(users.id, target.id)).for("update");
    if (!row) return { kind: "not_found" as const };
    if (status === "disabled") {
      if (row.status === "disabled") return { kind: "ok" as const, summary: "Already disabled." };
      if (roles.includes("owner") && row.status === "active") {
        const owners = await activeOwnerIds(tx, { lock: true });
        if (owners.filter((id) => id !== target.id).length === 0) return { kind: "last_owner" as const };
      }
      await tx.update(users).set({ status: "disabled", disabledAt: now, disabledBy: actor.user.id, updatedAt: now, updatedBy: actor.user.id }).where(eq(users.id, target.id));
      const revoked = await revokeUserSessions(tx, target.id, "user_disabled", now);
      await retireTokens(tx, target.id, ["invitation", "password_reset", "email_change", "owner_setup"], now);
      const summary = `Disabled ${userLabel(target)}; ${revoked} session(s) signed out.`;
      await recordAudit(tx, {
        at: now,
        requestId: meta.requestId,
        actor: auditActorOf(actor),
        ip: meta.ip,
        action,
        entity: { type: "user", id: target.id, label: userLabel(target) },
        outcome: "success",
        summary,
        changes: { status: { before: row.status, after: "disabled" } },
      });
      return { kind: "ok" as const, summary };
    }
    if (row.status !== "disabled") return { kind: "ok" as const, summary: "Already enabled." };
    // An account disabled before it accepted its invitation returns to "invited" (it has no password yet).
    const next = row.passwordHash ? "active" : "invited";
    await tx.update(users).set({ status: next, disabledAt: null, disabledBy: null, updatedAt: now, updatedBy: actor.user.id }).where(eq(users.id, target.id));
    const summary = `Enabled ${userLabel(target)} (${next}).`;
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action,
      entity: { type: "user", id: target.id, label: userLabel(target) },
      outcome: "success",
      summary,
      changes: { status: { before: "disabled", after: next } },
    });
    return { kind: "ok" as const, summary };
  });
}

/** Replaces a user's roles (at least one). Signs the user out everywhere. */
export async function setUserRoles(deps: AuthDeps, actor: Actor, targetId: string, nextRoles: string[], meta: RequestMeta): Promise<ManageResult> {
  const action = "user.roles_change";
  const roles = [...new Set(nextRoles)];
  if (roles.length === 0 || roles.some((r) => !ROLE_KEYS.includes(r as never))) return { kind: "invalid" };
  const checked = await authorize(deps, actor, meta, action, "users.edit", targetId);
  if ("refusal" in checked) return checked.refusal as ManageResult;
  const { target, roles: before } = checked;
  const added = roles.filter((r) => !before.includes(r));
  const removed = before.filter((r) => !roles.includes(r));
  if (added.length === 0 && removed.length === 0) return { kind: "ok", summary: "No change." };
  if (!canGrantRoles(actor, [...added, ...removed])) return deny(deps, actor, meta, action, target, isOwner(actor) ? "rank" : "owner_only");
  const now = deps.clock();
  return inTransaction(deps.pool, async (tx) => {
    const [row] = await tx.select().from(users).where(eq(users.id, target.id)).for("update");
    if (!row) return { kind: "not_found" as const };
    if (removed.includes("owner") && row.status === "active") {
      const owners = await activeOwnerIds(tx, { lock: true });
      if (owners.filter((id) => id !== target.id).length === 0) return { kind: "last_owner" as const };
    }
    if (removed.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, target.id), inArray(userRoles.roleKey, removed)));
    if (added.length) await tx.insert(userRoles).values(added.map((roleKey) => ({ userId: target.id, roleKey, grantedBy: actor.user.id, grantedAt: now })));
    await tx.update(users).set({ updatedAt: now, updatedBy: actor.user.id }).where(eq(users.id, target.id));
    const revoked = await revokeUserSessions(tx, target.id, "role_changed", now);
    const summary = `Roles of ${userLabel(target)}: ${before.join(", ") || "none"} → ${roles.join(", ")}; ${revoked} session(s) signed out.`;
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action,
      entity: { type: "user", id: target.id, label: userLabel(target) },
      outcome: "success",
      summary,
      changes: { roles: { before, after: roles } },
    });
    return { kind: "ok" as const, summary };
  });
}

/** Signs a user out of one session or all of them. */
export async function revokeSessionsOf(deps: AuthDeps, actor: Actor, targetId: string, sessionId: string | null, meta: RequestMeta): Promise<ManageResult> {
  const action = "session.revoke";
  const checked = await authorize(deps, actor, meta, action, "users.sessions_revoke", targetId);
  if ("refusal" in checked) return checked.refusal as ManageResult;
  const { target } = checked;
  const now = deps.clock();
  let count: number;
  if (sessionId) {
    const [owned] = await deps.db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, target.id))).limit(1);
    if (!owned) return { kind: "not_found" };
    count = (await revokeSession(deps.db, sessionId, "revoked", now)) ? 1 : 0;
  } else {
    count = await revokeUserSessions(deps.db, target.id, "revoked", now);
  }
  const summary = `Signed ${userLabel(target)} out of ${count} session(s).`;
  await recordAudit(deps.db, {
    at: now,
    requestId: meta.requestId,
    actor: auditActorOf(actor),
    ip: meta.ip,
    action,
    entity: { type: "user", id: target.id, label: userLabel(target) },
    outcome: "success",
    summary,
  });
  return { kind: "ok", summary };
}

/** Clears a sign-in lock and the email's credential-check slots (A2 Correction 1). */
export async function unlockUser(deps: AuthDeps, actor: Actor, targetId: string, meta: RequestMeta): Promise<ManageResult> {
  const action = "user.unlock";
  const checked = await authorize(deps, actor, meta, action, "users.edit", targetId);
  if ("refusal" in checked) return checked.refusal as ManageResult;
  const { target } = checked;
  const now = deps.clock();
  await deps.db.update(users).set({ lockedUntil: null, failedLoginCount: 0, updatedAt: now, updatedBy: actor.user.id }).where(eq(users.id, target.id));
  await clearCredentialChecks(deps.db, target.emailNormalized);
  const summary = `Unlocked ${userLabel(target)}.`;
  await recordAudit(deps.db, {
    at: now,
    requestId: meta.requestId,
    actor: auditActorOf(actor),
    ip: meta.ip,
    action,
    entity: { type: "user", id: target.id, label: userLabel(target) },
    outcome: "success",
    summary,
  });
  return { kind: "ok", summary };
}

/** Owner only: removes another user's second factor (after confirming their identity outside the system). */
export async function resetUserMfa(deps: AuthDeps, actor: Actor, targetId: string, meta: RequestMeta): Promise<ManageResult> {
  const action = "user.mfa_reset";
  const target = await findUserById(deps.db, targetId);
  if (!isOwner(actor) || !actor.permissions.has("users.edit")) return deny(deps, actor, meta, action, target, "owner_only");
  if (!target) return { kind: "not_found" };
  if (target.id === actor.user.id) return deny(deps, actor, meta, action, target, "self");
  const now = deps.clock();
  const revoked = await inTransaction(deps.pool, async (tx) => {
    const count = await removeMfa(tx, target.id, now);
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action,
      entity: { type: "user", id: target.id, label: userLabel(target) },
      outcome: "success",
      summary: `Two-factor authentication of ${userLabel(target)} reset by an Owner; ${count} session(s) signed out.`,
    });
    return count;
  });
  await sendQuietly(
    deps.mailer,
    mailTemplates.securityNotice(target.email, target.displayName, "An Owner reset the two-factor authentication of your account. Set it up again at your next sign-in."),
  );
  return { kind: "ok", summary: `Two-factor authentication reset; ${revoked} session(s) signed out.` };
}

/** Facts for the dashboard (A2 only): accounts by status, locked accounts, pending invitations. */
export async function accountFacts(deps: AuthDeps) {
  const now = deps.clock();
  const [counts] = await deps.db
    .select({
      active: sql<number>`SUM(${users.status} = 'active')`,
      invited: sql<number>`SUM(${users.status} = 'invited')`,
      disabled: sql<number>`SUM(${users.status} = 'disabled')`,
      locked: sql<number>`SUM(${users.lockedUntil} > ${now})`,
    })
    .from(users)
    .where(isNull(users.deletedAt));
  return {
    active: Number(counts?.active ?? 0),
    invited: Number(counts?.invited ?? 0),
    disabled: Number(counts?.disabled ?? 0),
    locked: Number(counts?.locked ?? 0),
  };
}

