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
import type { Actor } from "@/server/auth/types";
import { PASSWORD_MESSAGES } from "@/server/security/password-policy";
import { qrPath, type QrPath } from "@/server/security/qr";
import { authDeps, clearSessionCookie, getAdminState, guarded, isSameOriginRequest, requestMeta, writeSessionCookie } from "../context";
import { actionContext, failure, type ActionState } from "../guards";

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

/** The signed-in user for enrolment: a full session, or one that must set up 2FA before anything else. */
async function enrolmentActor(): Promise<{ actor: Actor; required: boolean } | null> {
  if (!(await isSameOriginRequest())) return null;
  const state = await getAdminState();
  if (state.status === "active") return { actor: state.actor, required: false };
  if (state.status === "enrolment_required") return { actor: state.actor, required: true };
  redirect("/admin/login");
}

export type EnrolmentState = ActionState & { secret?: string; uri?: string; qr?: QrPath; recoveryCodes?: string[]; done?: boolean };

export async function beginEnrolmentAction(_prev: EnrolmentState, form: FormData): Promise<EnrolmentState> {
  const who = await enrolmentActor();
  if (!who) return failure("This request was refused.");
  const deps = authDeps();
  const meta = await requestMeta();
  const replace = form.get("replace") === "1";
  if (replace && !isRecentlyAuthenticated(who.actor.session, deps.clock())) {
    return failure("Confirm your identity first (it is valid for 10 minutes).", { stepUp: true });
  }
  const password = z.string().max(1024).safeParse(form.get("password") ?? "");
  if (!password.success) return failure("Enter your password.");
  const result = await guarded(() => beginEnrolment(deps, who.actor, { password: password.data, replace }, meta));
  if (result.kind === "already_enrolled") return failure("Two-factor authentication is already on.");
  if (result.kind === "failed") {
    if (result.locked) {
      await clearSessionCookie();
      redirect("/admin/login?ended=1");
    }
    return failure("The password is not correct.");
  }
  return { status: "ok", secret: result.secret, uri: result.uri, qr: qrPath(result.uri) };
}

export async function confirmEnrolmentAction(prev: EnrolmentState, form: FormData): Promise<EnrolmentState> {
  const who = await enrolmentActor();
  if (!who) return failure("This request was refused.");
  const deps = authDeps();
  const meta = await requestMeta();
  const code = z.string().max(64).safeParse(form.get("code") ?? "");
  if (!code.success) return { ...prev, status: "error", message: "Enter the 6-digit code." };
  const result = await guarded(() => confirmEnrolment(deps, who.actor, { code: code.data }, meta));
  if (result.kind === "invalid") {
    return { ...prev, status: "error", message: "That code didn't work. Check the time on your phone and use the current code." };
  }
  if (result.kind === "none") return failure("Start the set-up again.");
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
