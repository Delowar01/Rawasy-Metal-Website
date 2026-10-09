"use server";
/**
 * Server Actions of "My account": password, two-factor authentication (also the set-up required after the first
 * sign-in of an Owner or Admin) and the user's own sessions.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { beginEnrolment, confirmEnrolment, disableMfa, regenerateRecoveryCodes } from "@/server/auth/mfa";
import { changePassword } from "@/server/auth/passwords";
import { revokeOtherOwnSessions, revokeOwnSession } from "@/server/auth/self-service";
import { isRecentlyAuthenticated } from "@/server/auth/sessions";
import type { Actor, RequestMeta } from "@/server/auth/types";
import { PASSWORD_MESSAGES } from "@/server/security/password-policy";
import { qrPath, type QrPath } from "@/server/security/qr";
import { authDeps, clearSessionCookie, getAdminState, guarded, isSameOriginRequest, requestMeta, signInPathFor, writeSessionCookie } from "../context";
import { actionContext, auditDenied, failure, LOCKED_MESSAGE, REFUSED, STEP_UP_MESSAGE, type ActionState } from "../guards";

const text = (max: number) => z.string().max(max).default("");

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("auth.password_change");
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const input = z.object({ current: text(1024), next: text(1024), confirm: text(1024) }).safeParse({
    current: form.get("current") ?? "",
    next: form.get("next") ?? "",
    confirm: form.get("confirm") ?? "",
  });
  if (!input.success) return failure("Something is missing. Try again.");
  if (input.data.next !== input.data.confirm) return failure("The two new passwords don't match.");
  const result = await guarded(() => changePassword(deps, actor, { currentPassword: input.data.current, newPassword: input.data.next }, meta));
  if (result.kind === "locked") return failure(LOCKED_MESSAGE);
  if (result.kind === "wrong_password") {
    if (result.locked) {
      await clearSessionCookie();
      redirect("/admin/login?ended=1");
    }
    return failure("The current password is not correct.");
  }
  if (result.kind === "weak") return failure(PASSWORD_MESSAGES[result.problem]);
  if (result.kind === "same") return failure("Choose a password you are not using now.");
  await writeSessionCookie(result.token);
  return {
    status: "ok",
    message:
      result.othersSignedOut > 0
        ? `Password changed. ${result.othersSignedOut} other session(s) were signed out.`
        : "Password changed.",
  };
}

/**
 * The signed-in user for enrolment: a full session, or one that must set up 2FA before anything else. A request from
 * outside the admin's own pages is refused and audited, like every other mutation (`actionContext`).
 */
async function enrolmentActor(action: string): Promise<{ ok: true; actor: Actor; meta: RequestMeta } | { ok: false; state: EnrolmentState }> {
  const state = await getAdminState();
  if (state.status !== "active" && state.status !== "enrolment_required") redirect(signInPathFor(state));
  const meta = await requestMeta();
  if (!(await isSameOriginRequest())) {
    await auditDenied(state.actor, action, REFUSED.origin, meta);
    return { ok: false, state: failure("This request was refused.") };
  }
  return { ok: true, actor: state.actor, meta };
}

export type EnrolmentState = ActionState & {
  secret?: string;
  uri?: string;
  qr?: QrPath;
  /** The set-up in progress, sealed by the server (sent back with the first code; nothing is stored until then). */
  pending?: string;
  /** The set-up can no longer be confirmed (expired after 10 minutes, or replaced): start again. */
  expired?: boolean;
  recoveryCodes?: string[];
  done?: boolean;
};

export async function beginEnrolmentAction(_prev: EnrolmentState, form: FormData): Promise<EnrolmentState> {
  const replace = form.get("replace") === "1";
  const action = replace ? "auth.mfa_replacement_started" : "auth.mfa_enrolment_started";
  const who = await enrolmentActor(action);
  if (!who.ok) return who.state;
  const deps = authDeps();
  if (replace && !isRecentlyAuthenticated(who.actor.session, deps.clock())) {
    await auditDenied(who.actor, action, REFUSED.stepUp, who.meta, deps);
    return failure(STEP_UP_MESSAGE, { stepUp: true });
  }
  const password = z.string().max(1024).safeParse(form.get("password") ?? "");
  if (!password.success) return failure("Enter your password.");
  const result = await guarded(() => beginEnrolment(deps, who.actor, { password: password.data, replace }, who.meta));
  if (result.kind === "already_enrolled") return failure("Two-factor authentication is already on.");
  if (result.kind === "locked") return failure(LOCKED_MESSAGE);
  if (result.kind === "failed") {
    if (result.locked) {
      await clearSessionCookie();
      redirect("/admin/login?ended=1");
    }
    return failure("The password is not correct.");
  }
  return { status: "ok", secret: result.secret, uri: result.uri, qr: qrPath(result.uri), pending: result.pending };
}

export async function confirmEnrolmentAction(prev: EnrolmentState, form: FormData): Promise<EnrolmentState> {
  const who = await enrolmentActor("auth.mfa_enabled");
  if (!who.ok) return who.state;
  const deps = authDeps();
  const input = z.object({ code: text(64), pending: text(200) }).safeParse({ code: form.get("code") ?? "", pending: form.get("pending") ?? "" });
  if (!input.success) return { ...prev, status: "error", message: "Enter the 6-digit code." };
  const result = await guarded(() => confirmEnrolment(deps, who.actor, input.data, who.meta));
  if (result.kind === "invalid") {
    return { ...prev, status: "error", message: "That code didn't work. Check the time on your phone and use the current code." };
  }
  if (result.kind === "none") {
    return { status: "error", expired: true, message: "This set-up can no longer be confirmed (it lasts 10 minutes). Start again." };
  }
  await writeSessionCookie(result.token);
  return { status: "ok", done: true, recoveryCodes: result.recoveryCodes };
}

export async function regenerateCodesAction(): Promise<EnrolmentState> {
  const ctx = await actionContext("auth.recovery_codes_regenerated", { stepUp: true });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const codes = await guarded(() => regenerateRecoveryCodes(deps, actor, meta));
  if (!codes) return failure("Two-factor authentication is not on.");
  return { status: "ok", recoveryCodes: codes };
}

export async function disableMfaAction(): Promise<ActionState> {
  const ctx = await actionContext("auth.mfa_disabled", { stepUp: true });
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const result = await guarded(() => disableMfa(deps, actor, meta));
  if (result.kind === "required") return failure("Your role requires two-factor authentication: it can be replaced, not turned off.");
  if (result.kind === "none") return failure("Two-factor authentication is not on.");
  await writeSessionCookie(result.token);
  return { status: "ok", message: "Two-factor authentication is off. Your other sessions were signed out." };
}

export async function revokeOwnSessionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("session.revoke");
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/).safeParse(form.get("session"));
  if (!id.success) return failure("Unknown session.");
  const done = await guarded(() => revokeOwnSession(deps, actor, id.data, meta));
  return done ? { status: "ok", message: "That session was signed out." } : failure("That session has already ended.");
}

export async function revokeOtherSessionsAction(): Promise<ActionState> {
  const ctx = await actionContext("session.revoke");
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const count = await guarded(() => revokeOtherOwnSessions(deps, actor, meta));
  return { status: "ok", message: count ? `Signed out of ${count} other session(s).` : "No other session was active." };
}
