/**
 * Invitations and the first Owner's setup link (A1-SECURITY-RBAC §3.1, §3.9). There is no public registration: an
 * account starts as `invited` with its roles, and a single-use link (invitation 72 hours, Owner setup 30 minutes) lets
 * the person choose a password, which activates it.
 *
 * Without a mail transport the invitation link is returned once to the inviting Owner or Admin, to pass on by a
 * channel they trust; the admin then says plainly that no email was sent.
 *
 * An invitation link carries its issuer's authority, never more (A2 Correction 1, third review): it works only while the
 * person who issued it is still an active user who may invite, manage and grant every role the invited account holds
 * now. A role change of the invited account also withdraws its link (`setUserRoles`), and a new link is issued under the
 * invited account's row lock, so neither a promotion nor a disable can slip in between the check and the link. The Owner
 * setup link exists only to create the first Owner: it works only while no Owner is active (fourth review).
 */
import { and, eq, inArray } from "drizzle-orm";
import { recordAudit, userLabel } from "../audit/audit.ts";
import { inTransaction, type Db } from "../db/client.ts";
import { userRoles, users } from "../db/schema.ts";
import { mailTemplates, sendQuietly } from "../mail/mailer.ts";
import { canGrantRoles, canManageUser } from "../policy/rbac.ts";
import { permissionsOf, ROLE_KEYS } from "../policy/registry.ts";
import { ulid } from "../security/ids.ts";
import { checkPassword, type PasswordProblem } from "../security/password-policy.ts";
import { activeOwnerIds, findUserById, isPlausibleEmail, normalizeEmail, rolesOf } from "./accounts.ts";
import { adminLink, type AuthDeps } from "./deps.ts";
import { clearCredentialChecks } from "./rate-limit.ts";
import { lockActor } from "./sessions.ts";
import { consumeToken, findUsableToken, issueToken, TOKEN_LIFETIME_MS, type TokenRow } from "./tokens.ts";
import { auditActorOf, type Actor, type RequestMeta } from "./types.ts";
import { accountUnchanged, lockForChange, type Expected } from "./user-admin.ts";

/** May someone with these roles invite, manage and grant every role in `roles`? (The rule `inviteUser` applies.) */
const mayInvite = (inviterRoles: readonly string[], roles: readonly string[]) =>
  roles.length > 0 && permissionsOf(inviterRoles).has("users.invite") && canManageUser({ roles: inviterRoles }, { roles }) && canGrantRoles({ roles: inviterRoles }, roles);

/**
 * Why a usable link may still not be used for the account as it is now — or null when it may:
 * - an invitation (`issuer`): its issuer must be active and still allowed to invite into every role the account holds;
 *   an invitation without an issuer is refused;
 * - the Owner setup link of the server-side bootstrap (`owner_active`): only while no Owner is active (locked inside the
 *   accepting transaction, as the last-Owner checks lock them).
 */
async function linkRefusal(db: Db, token: TokenRow, invitedUserId: string, lock = false): Promise<"issuer" | "owner_active" | null> {
  if (token.purpose === "owner_setup") return (await activeOwnerIds(db, { lock })).length > 0 ? "owner_active" : null;
  if (!token.createdBy) return "issuer";
  const issuer = await findUserById(db, token.createdBy);
  if (!issuer || issuer.status !== "active") return "issuer";
  return mayInvite(await rolesOf(db, issuer.id), await rolesOf(db, invitedUserId)) ? null : "issuer";
}

export type InviteResult =
  | { kind: "invited"; userId: string; delivered: boolean; link: string | null }
  | { kind: "exists" }
  | { kind: "invalid"; field: "email" | "displayName" | "roles" }
  | { kind: "denied" }
  /** The account is no longer as the page that asked for a new link showed it (fifth review). */
  | { kind: "changed" };

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
    await lockActor(tx, actor, now);
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

/**
 * A new invitation link for an invited user (the old one stops working). Decided again inside the transaction, under the
 * invited account's row lock (A2 Correction 1, third review): a promotion or a disable committed meanwhile counts.
 */
export async function resendInvitation(deps: AuthDeps, actor: Actor, userId: string, meta: RequestMeta, expected?: Expected): Promise<InviteResult> {
  const now = deps.clock();
  const [user] = await deps.db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.status !== "invited") return { kind: "invalid", field: "email" };
  const allowed = (roles: string[]) => actor.permissions.has("users.invite") && mayInvite(actor.roles, roles);
  const refuse = async (why: "rank" | "changed" = "rank"): Promise<InviteResult> => {
    await recordAudit(deps.db, {
      at: now,
      requestId: meta.requestId,
      actor: auditActorOf(actor),
      ip: meta.ip,
      action: "user.invite_resend",
      entity: { type: "user", id: user.id, label: userLabel(user) },
      outcome: "denied",
      summary: why === "rank" ? "New invitation link refused: rank rule." : "New invitation link refused: the account changed after the page was opened.",
    });
    return why === "rank" ? { kind: "denied" } : { kind: "changed" };
  };
  if (!allowed(await rolesOf(deps.db, userId))) return refuse();
  const issued = await inTransaction(deps.pool, async (tx) => {
    const locked = await lockForChange(tx, actor, userId, now);
    if (!locked || locked.target.status !== "invited") return { kind: "gone" as const };
    // A new link carries the account's roles as they are now: only when they are what the page showed.
    if (!(await accountUnchanged(tx, locked, expected))) return { kind: "changed" as const };
    if (!allowed(locked.roles)) return { kind: "refused" as const };
    const { token } = await issueToken(tx, { userId, purpose: "invitation", now, createdBy: actor.user.id, createdIp: meta.ip });
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
    return { kind: "issued" as const, token };
  });
  if (issued.kind === "gone") return { kind: "invalid", field: "email" };
  if (issued.kind === "changed") return refuse("changed");
  if (issued.kind === "refused") return refuse();
  const delivery = await deliverInvitation(deps, user, issued.token);
  return { kind: "invited", userId, ...delivery };
}

/** What the invitation page shows before a password is chosen; null when the link cannot be used. */
export async function inspectInvitation(deps: AuthDeps, token: string) {
  const found = await findUsableToken(deps.db, token, ["invitation", "owner_setup"], deps.clock());
  if (!found || found.user.status !== "invited") return null;
  if (await linkRefusal(deps.db, found.token, found.user.id)) return null;
  const roles = await rolesOf(deps.db, found.user.id);
  return { email: found.user.email, displayName: found.user.displayName, roles, purpose: found.token.purpose };
}

export type AcceptResult = { kind: "ok"; email: string } | { kind: "invalid" } | { kind: "weak"; problem: PasswordProblem };

/** Accepts an invitation (or the Owner setup link): the password is set and the account becomes active. */
export async function acceptInvitation(deps: AuthDeps, input: { token: string; password: string }, meta: RequestMeta): Promise<AcceptResult> {
  const now = deps.clock();
  const found = await findUsableToken(deps.db, input.token, ["invitation", "owner_setup"], now);
  if (!found || found.user.status !== "invited") return { kind: "invalid" };
  if (await linkRefusal(deps.db, found.token, found.user.id)) return { kind: "invalid" };
  const { user } = found;
  const password = String(input.password ?? "");
  const problem = checkPassword(password, { email: user.email, name: user.displayName });
  if (problem) return { kind: "weak", problem };
  const hash = await deps.hasher.hash(password);
  const ok = await inTransaction(deps.pool, async (tx) => {
    const again = await findUsableToken(tx, input.token, ["invitation", "owner_setup"], now, { lock: true });
    if (!again || again.user.status !== "invited") return false;
    // Decided again with the token and the account locked: a link whose issuer can no longer grant the account's roles,
    // or an Owner setup link once an Owner is active, is withdrawn here, whatever else left it in place.
    const refusal = await linkRefusal(tx, again.token, again.user.id, true);
    if (refusal) {
      await consumeToken(tx, again.token.id, now);
      await recordAudit(tx, {
        at: now,
        requestId: meta.requestId,
        actor: { type: "system", label: "Invitation check" },
        ip: meta.ip,
        action: refusal === "issuer" ? "user.invite_withdrawn" : "auth.owner_setup_withdrawn",
        entity: { type: "user", id: user.id, label: userLabel(user) },
        outcome: "denied",
        summary:
          refusal === "issuer"
            ? "Invitation link refused and withdrawn: the person who issued it may no longer grant this account's roles."
            : "Owner setup link refused and withdrawn: an Owner is already active.",
      });
      return false;
    }
    if (!(await consumeToken(tx, again.token.id, now))) return false;
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
