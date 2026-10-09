/**
 * Invitations and the first Owner's setup link (A1-SECURITY-RBAC §3.1, §3.9). There is no public registration: an
 * account starts as `invited` with its roles, and a single-use link (invitation 72 hours, Owner setup 30 minutes) lets
 * the person choose a password, which activates it.
 *
 * Without a mail transport the invitation link is returned once to the inviting Owner or Admin, to pass on by a
 * channel they trust; the admin then says plainly that no email was sent.
 */
import { and, eq, inArray } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import { inTransaction } from "../db/client.ts";
import { userRoles, users } from "../db/schema.ts";
import { mailTemplates, sendQuietly } from "../mail/mailer.ts";
import { canGrantRoles, canManageUser } from "../policy/rbac.ts";
import { ROLE_KEYS } from "../policy/registry.ts";
import { ulid } from "../security/ids.ts";
import { checkPassword, type PasswordProblem } from "../security/password-policy.ts";
import { isPlausibleEmail, normalizeEmail, rolesOf } from "./accounts.ts";
import { adminLink, type AuthDeps } from "./deps.ts";
import { clearCredentialChecks } from "./rate-limit.ts";
import { consumeToken, findUsableToken, issueToken, TOKEN_LIFETIME_MS } from "./tokens.ts";
import { auditActorOf, type Actor, type RequestMeta } from "./types.ts";

export type InviteResult =
  | { kind: "invited"; userId: string; delivered: boolean; link: string | null }
  | { kind: "exists" }
  | { kind: "invalid"; field: "email" | "displayName" | "roles" }
  | { kind: "denied" };

const cleanName = (name: string) => name.normalize("NFKC").replace(/\s+/g, " ").trim();

async function deliverInvitation(deps: AuthDeps, user: { email: string; displayName: string }, token: string) {
  const link = adminLink(deps, `invite/${token}`);
  const { delivered } = await sendQuietly(
    deps.mailer,
    mailTemplates.invitation(user.email, user.displayName, link, TOKEN_LIFETIME_MS.invitation / 3_600_000),
  );
  return { delivered, link: delivered ? null : link };
}

/** Invites a new user with the given roles (users.invite; rank rule; only the Owner grants Admin or Owner). */
export async function inviteUser(
  deps: AuthDeps,
  actor: Actor,
  input: { email: string; displayName: string; roles: string[] },
  meta: RequestMeta,
): Promise<InviteResult> {
  const now = deps.clock();
  const enteredEmail = String(input.email ?? "").trim();
  const email = normalizeEmail(enteredEmail);
  const displayName = cleanName(String(input.displayName ?? ""));
  const roles = [...new Set(input.roles)].filter((r) => ROLE_KEYS.includes(r as never));
  if (!isPlausibleEmail(email)) return { kind: "invalid", field: "email" };
  if (!displayName || displayName.length > 120) return { kind: "invalid", field: "displayName" };
  if (roles.length === 0 || roles.length !== input.roles.length) return { kind: "invalid", field: "roles" };
  if (!actor.permissions.has("users.invite") || !canGrantRoles(actor, roles)) {
    await recordAudit(deps.db, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action: "user.invite",
      entity: { type: "user", label: email },
      outcome: "denied",
      summary: `Invitation refused: not allowed to grant ${roles.join(", ")}.`,
    });
    return { kind: "denied" };
  }
  const created = await inTransaction(deps.pool, async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.emailNormalized, email)).limit(1);
    if (existing) return null;
    const id = ulid(now.getTime());
    await tx.insert(users).values({
      id,
      email: enteredEmail,
      emailNormalized: email,
      displayName,
      status: "invited",
      createdAt: now,
      createdBy: actor.user.id,
      updatedAt: now,
      updatedBy: actor.user.id,
    });
    await tx.insert(userRoles).values(roles.map((roleKey) => ({ userId: id, roleKey, grantedBy: actor.user.id, grantedAt: now })));
    const { token } = await issueToken(tx, { userId: id, purpose: "invitation", now, createdBy: actor.user.id, createdIp: meta.ip });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action: "user.invite",
      entity: { type: "user", id, label: `${displayName} <${enteredEmail}>` },
      outcome: "success",
      summary: `Invited ${displayName} <${enteredEmail}> as ${roles.join(", ")}.`,
      changes: { roles },
    });
    return { id, token };
  });
  if (!created) return { kind: "exists" };
  const delivery = await deliverInvitation(deps, { email: enteredEmail, displayName }, created.token);
  return { kind: "invited", userId: created.id, ...delivery };
}

/** A new invitation link for an invited user (the old one stops working). */
export async function resendInvitation(deps: AuthDeps, actor: Actor, userId: string, meta: RequestMeta): Promise<InviteResult> {
  const now = deps.clock();
  const [user] = await deps.db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.status !== "invited") return { kind: "invalid", field: "email" };
  const roles = await rolesOf(deps.db, userId);
  if (!actor.permissions.has("users.invite") || !canManageUser(actor, { roles }) || !canGrantRoles(actor, roles)) {
    await recordAudit(deps.db, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action: "user.invite_resend",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "denied",
      summary: "New invitation link refused: rank rule.",
    });
    return { kind: "denied" };
  }
  const { token } = await inTransaction(deps.pool, async (tx) => {
    const issued = await issueToken(tx, { userId, purpose: "invitation", now, createdBy: actor.user.id, createdIp: meta.ip });
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action: "user.invite_resend",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: "New invitation link issued; the previous one no longer works.",
    });
    return issued;
  });
  const delivery = await deliverInvitation(deps, user, token);
  return { kind: "invited", userId, ...delivery };
}

/** What the invitation page shows before a password is chosen; null when the link cannot be used. */
export async function inspectInvitation(deps: AuthDeps, token: string) {
  const found = await findUsableToken(deps.db, token, ["invitation", "owner_setup"], deps.clock());
  if (!found || found.user.status !== "invited") return null;
  const roles = await rolesOf(deps.db, found.user.id);
  return { email: found.user.email, displayName: found.user.displayName, roles, purpose: found.token.purpose };
}

export type AcceptResult = { kind: "ok"; email: string } | { kind: "invalid" } | { kind: "weak"; problem: PasswordProblem };

/** Accepts an invitation (or the Owner setup link): the password is set and the account becomes active. */
export async function acceptInvitation(deps: AuthDeps, input: { token: string; password: string }, meta: RequestMeta): Promise<AcceptResult> {
  const now = deps.clock();
  const found = await findUsableToken(deps.db, input.token, ["invitation", "owner_setup"], now);
  if (!found || found.user.status !== "invited") return { kind: "invalid" };
  const { user } = found;
  const password = String(input.password ?? "");
  const problem = checkPassword(password, { email: user.email, name: user.displayName });
  if (problem) return { kind: "weak", problem };
  const hash = await deps.hasher.hash(password);
  const ok = await inTransaction(deps.pool, async (tx) => {
    const again = await findUsableToken(tx, input.token, ["invitation", "owner_setup"], now, { lock: true });
    if (!again || again.user.status !== "invited" || !(await consumeToken(tx, again.token.id, now))) return false;
    const [updated] = await tx
      .update(users)
      .set({ passwordHash: hash, passwordChangedAt: now, status: "active", updatedAt: now, updatedBy: user.id })
      .where(and(eq(users.id, user.id), inArray(users.status, ["invited"])));
    if (updated.affectedRows !== 1) return false;
    await recordAudit(tx, {
      at: now,
      requestId: meta.requestId,
      actor: { type: "user", userId: user.id, label: userLabel(user) },
      ip: meta.ip,
      action: again.token.purpose === "owner_setup" ? "auth.owner_setup_completed" : "user.invite_accepted",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "success",
      summary: again.token.purpose === "owner_setup" ? "Owner account set up; password chosen." : "Invitation accepted; password chosen.",
    });
    return true;
  });
  if (!ok) return { kind: "invalid" };
  // A new password set through the emailed link: earlier attempts on this email no longer hold its checks back.
  await clearCredentialChecks(deps.db, user.emailNormalized);
  return { kind: "ok", email: user.email };
}
