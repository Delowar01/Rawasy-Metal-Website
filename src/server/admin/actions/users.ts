"use server";
/**
 * Server Actions of "Users & access". Each one re-checks, on the server: the session, the request's origin, the
 * permission, a re-authentication within 10 minutes (these permissions are sensitive), and — inside the service — the
 * rank rule, self-protection and the last-Owner rule. Refusals are audited.
 */
import { z } from "zod";
import { inviteUser, resendInvitation } from "@/server/auth/invitations";
import { resetUserMfa, revokeSessionsOf, setUserRoles, setUserStatus, unlockUser, type ManageResult } from "@/server/auth/user-admin";
import { USER_STATUSES } from "@/server/db/schema";
import { ROLE_KEYS } from "@/server/policy/registry";
import { guarded } from "../context";
import { actionContext, failure, type ActionState } from "../guards";

const ULID = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

const REFUSALS: Record<string, string> = {
  permission: "You don't have permission to do this.",
  rank: "You can't manage a user whose role is equal to or above yours.",
  self: "You can't do this to your own account. Another Owner must do it.",
  owner_only: "Only an Owner can do this.",
  changed: "This account changed after you opened this page (for example, its invitation was accepted). Reload the page and check it before you try again.",
};

function outcome(result: ManageResult): ActionState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary };
    case "denied":
      return failure(REFUSALS[result.reason]);
    case "last_owner":
      return failure("At least one active Owner must remain. Make someone else an Owner first.");
    case "not_found":
      return failure("That user or session no longer exists.");
    case "invalid":
      return failure("Choose at least one role.");
  }
}

export type InviteState = ActionState & { link?: string | null; delivered?: boolean; email?: string };

export async function inviteUserAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const ctx = await actionContext("user.invite", { permission: "users.invite" });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const input = z
    .object({ email: z.string().max(320), displayName: z.string().max(200), roles: z.array(z.enum(ROLE_KEYS as [string, ...string[]])).max(4) })
    .safeParse({ email: form.get("email") ?? "", displayName: form.get("displayName") ?? "", roles: form.getAll("roles") });
  if (!input.success) return failure("Check the form: email, name and at least one role.");
  const fields = { email: input.data.email, displayName: input.data.displayName };
  const result = await guarded(() => inviteUser(deps, actor, input.data, meta));
  switch (result.kind) {
    case "invalid":
      return failure(
        result.field === "email" ? "Enter a valid email address." : result.field === "displayName" ? "Enter a name (up to 120 characters)." : "Choose at least one role.",
        { fields },
      );
    case "exists":
      return failure("An account with this email already exists.", { fields });
    case "denied":
      return failure("You can't grant these roles.", { fields });
    case "invited":
      return { status: "ok", delivered: result.delivered, link: result.link, email: input.data.email };
  }
}

export async function resendInvitationAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const ctx = await actionContext("user.invite_resend", { permission: "users.invite" });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const id = ULID.safeParse(form.get("user"));
  if (!id.success) return failure("Unknown user.");
  const result = await guarded(() => resendInvitation(deps, actor, id.data, meta));
  if (result.kind === "invited") return { status: "ok", delivered: result.delivered, link: result.link };
  return failure(result.kind === "denied" ? REFUSALS.rank : "This user is no longer waiting for an invitation.");
}

export async function setUserStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("user.status_change", { permission: "users.disable" });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const input = z.object({ user: ULID, status: z.enum(["active", "disabled"]) }).safeParse({ user: form.get("user"), status: form.get("status") });
  if (!input.success) return failure("Unknown user.");
  return outcome(await guarded(() => setUserStatus(deps, actor, input.data.user, input.data.status, meta)));
}

export async function setUserRolesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("user.roles_change", { permission: "users.edit" });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  // `status`: what the page showed when the roles were chosen; the change is refused if the account has moved on since.
  const input = z
    .object({ user: ULID, roles: z.array(z.enum(ROLE_KEYS as [string, ...string[]])).max(4), status: z.enum(USER_STATUSES) })
    .safeParse({ user: form.get("user"), roles: form.getAll("roles"), status: form.get("status") });
  if (!input.success) return failure("Choose valid roles.");
  const expected = { status: input.data.status };
  return outcome(await guarded(() => setUserRoles(deps, actor, input.data.user, input.data.roles, meta, expected)));
}

export async function revokeUserSessionsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("session.revoke", { permission: "users.sessions_revoke" });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const input = z.object({ user: ULID, session: ULID.optional() }).safeParse({ user: form.get("user"), session: form.get("session") || undefined });
  if (!input.success) return failure("Unknown user or session.");
  return outcome(await guarded(() => revokeSessionsOf(deps, actor, input.data.user, input.data.session ?? null, meta)));
}

export async function unlockUserAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("user.unlock", { permission: "users.edit" });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const id = ULID.safeParse(form.get("user"));
  if (!id.success) return failure("Unknown user.");
  return outcome(await guarded(() => unlockUser(deps, actor, id.data, meta)));
}

export async function resetUserMfaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("user.mfa_reset", { permission: "users.edit" });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const id = ULID.safeParse(form.get("user"));
  if (!id.success) return failure("Unknown user.");
  return outcome(await guarded(() => resetUserMfa(deps, actor, id.data, meta)));
}

