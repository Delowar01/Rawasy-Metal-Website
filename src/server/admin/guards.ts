/**
 * Guards for admin pages and Server Actions. Pages redirect to the step they need (sign-in, second factor, required
 * 2FA set-up); actions check the same session, the request's origin, the permission and — for sensitive permissions —
 * a re-authentication within the last 10 minutes, and record refusals in the audit log.
 */
import "server-only";
import { redirect } from "next/navigation";
import { recordAudit } from "@/server/audit/audit";
import type { MfaState } from "@/server/auth/accounts";
import { isRecentlyAuthenticated } from "@/server/auth/sessions";
import { auditActorOf, type Actor, type RequestMeta } from "@/server/auth/types";
import type { AuthDeps } from "@/server/auth/deps";
import { SENSITIVE_PERMISSIONS } from "@/server/policy/registry";
import type { ActionState } from "./actions/state";
import { authDeps, getAdminState, guarded, isSameOriginRequest, requestMeta } from "./context";

/** The signed-in, fully verified user, or a redirect to the step that is missing. */
export async function requireActor(): Promise<{ actor: Actor; mfa: MfaState }> {
  const state = await getAdminState();
  if (state.status === "anonymous") redirect("/admin/login");
  if (state.status === "mfa_pending") redirect("/admin/login/verify");
  if (state.status === "enrolment_required") redirect("/admin/login/enrol");
  return state;
}

export const hasRecentAuth = (actor: Actor, deps: AuthDeps = authDeps()) => isRecentlyAuthenticated(actor.session, deps.clock());

export type { ActionState } from "./actions/state";
export { idle } from "./actions/state";
export const failure = (message: string, extra: Partial<ActionState> = {}): ActionState => ({ status: "error", message, ...extra });

export interface ActionContext {
  deps: AuthDeps;
  actor: Actor;
  meta: RequestMeta;
}

/**
 * The checks every authenticated admin mutation starts with. Returns the context, or the refusal to show. No session →
 * sign-in page. A refused origin, a missing permission or a missing re-authentication is audited.
 */
export async function actionContext(
  action: string,
  options: { permission?: string; stepUp?: boolean } = {},
): Promise<{ ok: true; context: ActionContext } | { ok: false; state: ActionState }> {
  const meta = await requestMeta();
  const deps = authDeps();
  const state = await getAdminState();
  if (state.status !== "active") redirect("/admin/login");
  const { actor } = state;
  const refuse = async (summary: string, message: string, extra: Partial<ActionState> = {}) => {
    await guarded(() =>
      recordAudit(deps.db, {
        at: deps.clock(),
        requestId: meta.requestId,
        actor: auditActorOf(actor),
        ip: meta.ip,
        action,
        entity: { type: "user", id: actor.user.id },
        outcome: "denied",
        summary,
      }),
    );
    return { ok: false as const, state: failure(message, extra) };
  };
  if (!(await isSameOriginRequest())) return refuse("Refused: the request did not come from the admin's own pages.", "This request was refused.");
  if (options.permission && !actor.permissions.has(options.permission)) {
    return refuse(`Refused: missing permission ${options.permission}.`, "You don't have permission to do this.");
  }
  const needsStepUp = options.stepUp ?? (options.permission ? SENSITIVE_PERMISSIONS.has(options.permission) : false);
  if (needsStepUp && !isRecentlyAuthenticated(actor.session, deps.clock())) {
    return refuse("Refused: a recent re-authentication is required.", "Confirm your identity first (it is valid for 10 minutes).", {
      stepUp: true,
    });
  }
  return { ok: true, context: { deps, actor, meta } };
}

/** For the unauthenticated forms (sign-in, invitation, reset): only the origin check. */
export async function publicActionContext(): Promise<{ ok: true; deps: AuthDeps; meta: RequestMeta } | { ok: false; state: ActionState }> {
  if (!(await isSameOriginRequest())) return { ok: false, state: failure("This request was refused.") };
  return { ok: true, deps: authDeps(), meta: await requestMeta() };
}
