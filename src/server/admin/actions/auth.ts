"use server";
/**
 * Server Actions of the sign-in pages: sign in, second factor, sign out, password reset, invitation, step-up and the
 * periodic session rotation. Every action checks the request's origin first; responses never say whether an account
 * exists, and never echo a password, code or token.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { acceptInvitation } from "@/server/auth/invitations";
import { completePasswordReset, requestPasswordReset } from "@/server/auth/passwords";
import { reauthenticate, rotateIfDue, signIn, signOut, verifySecondFactor } from "@/server/auth/sign-in";
import { PASSWORD_MESSAGES } from "@/server/security/password-policy";
import { clearSessionCookie, getAdminState, guarded, writeSessionCookie } from "../context";
import { actionContext, failure, LOCKED_MESSAGE, publicActionContext, type ActionState } from "../guards";
import { safeNext } from "../paths";

const SIGN_IN_FAILED =
  "Sign-in failed. Check the email address and password. After several failed attempts, sign-in is paused for a while.";

const text = (max: number) => z.string().max(max).default("");

export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await publicActionContext();
  if (!ctx.ok) return ctx.state;
  const input = z.object({ email: text(320), password: text(1024), next: text(200) }).safeParse({
    email: form.get("email") ?? "",
    password: form.get("password") ?? "",
    next: form.get("next") ?? "",
  });
  if (!input.success) return failure(SIGN_IN_FAILED);
  const { email, password, next } = input.data;
  const result = await guarded(() => signIn(ctx.deps, { email, password }, ctx.meta));
  if (result.kind === "throttled") {
    return failure("Too many sign-in attempts from your network. Wait 15 minutes, then try again.", { fields: { email } });
  }
  if (result.kind === "failed") return failure(SIGN_IN_FAILED, { fields: { email } });
  await writeSessionCookie(result.token);
  const target = safeNext(next);
  if (result.kind === "mfa_required") redirect(target === "/admin" ? "/admin/login/verify" : `/admin/login/verify?next=${encodeURIComponent(target)}`);
  redirect(result.enrolmentRequired ? "/admin/login/enrol" : target);
}

export async function verifySecondFactorAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await publicActionContext();
  if (!ctx.ok) return ctx.state;
  const state = await getAdminState();
  if (state.status !== "mfa_pending") redirect("/admin/login");
  const input = z
    .object({ method: z.enum(["totp", "recovery"]), code: text(64), next: text(200) })
    .safeParse({ method: form.get("method") ?? "totp", code: form.get("code") ?? "", next: form.get("next") ?? "" });
  if (!input.success) return failure("Enter the code.");
  const { method, code, next } = input.data;
  const result = await guarded(() =>
    verifySecondFactor(ctx.deps, state, method === "recovery" ? { recoveryCode: code } : { code }, ctx.meta),
  );
  if (result.kind === "unavailable") {
    return failure("Two-factor verification is unavailable right now. Use a recovery code, or contact the site Owner.");
  }
  if (result.kind === "failed") {
    if (result.locked) {
      await clearSessionCookie();
      redirect("/admin/login?ended=1");
    }
    return failure(
      method === "recovery"
        ? "That recovery code didn't work. Each code works once."
        : "That code didn't work. Use the current code from your authenticator app (each code works once).",
    );
  }
  await writeSessionCookie(result.token);
  const target = safeNext(next);
  const remaining = result.remainingRecoveryCodes;
  redirect(remaining !== undefined ? `/admin?recovery=${remaining}` : target);
}

/** Signs out (any session state: also "cancel" on the second-factor and required set-up pages). */
export async function signOutAction(): Promise<void> {
  const ctx = await publicActionContext();
  if (!ctx.ok) redirect("/admin");
  const state = await getAdminState();
  if (state.status !== "anonymous") {
    const current =
      state.status === "mfa_pending"
        ? { session: state.session, user: state.user, roles: [] as string[] }
        : { session: state.actor.session, user: state.actor.user, roles: state.actor.roles };
    await guarded(() => signOut(ctx.deps, current, ctx.meta));
  }
  await clearSessionCookie();
  redirect("/admin/login?signed_out=1");
}

export async function requestResetAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await publicActionContext();
  if (!ctx.ok) return ctx.state;
  const email = z.string().max(320).safeParse(form.get("email") ?? "");
  if (!email.success) return failure("Enter your email address.");
  const result = await guarded(() => requestPasswordReset(ctx.deps, { email: email.data }, ctx.meta));
  if (!result.mailConfigured) {
    return failure("Password reset by email is not available yet: this site does not send email. Ask an Owner to reset your access.");
  }
  return {
    status: "ok",
    message: "If an active account uses this address, a reset link is on its way. It works once and expires in 30 minutes.",
  };
}

export async function completeResetAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await publicActionContext();
  if (!ctx.ok) return ctx.state;
  const input = z.object({ token: text(64), password: text(1024), confirm: text(1024) }).safeParse({
    token: form.get("token") ?? "",
    password: form.get("password") ?? "",
    confirm: form.get("confirm") ?? "",
  });
  if (!input.success) return failure("Something is missing. Try again.");
  if (input.data.password !== input.data.confirm) return failure("The two passwords don't match.");
  const result = await guarded(() => completePasswordReset(ctx.deps, { token: input.data.token, password: input.data.password }, ctx.meta));
  if (result.kind === "weak") return failure(PASSWORD_MESSAGES[result.problem]);
  if (result.kind === "invalid") return failure("This reset link is no longer valid. Ask for a new one.");
  redirect("/admin/login?reset=1");
}

export async function acceptInvitationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await publicActionContext();
  if (!ctx.ok) return ctx.state;
  const input = z.object({ token: text(64), password: text(1024), confirm: text(1024) }).safeParse({
    token: form.get("token") ?? "",
    password: form.get("password") ?? "",
    confirm: form.get("confirm") ?? "",
  });
  if (!input.success) return failure("Something is missing. Try again.");
  if (input.data.password !== input.data.confirm) return failure("The two passwords don't match.");
  const result = await guarded(() => acceptInvitation(ctx.deps, { token: input.data.token, password: input.data.password }, ctx.meta));
  if (result.kind === "weak") return failure(PASSWORD_MESSAGES[result.problem]);
  if (result.kind === "invalid") return failure("This invitation link is no longer valid. Ask for a new one.");
  redirect("/admin/login?welcome=1");
}

/** Step-up: the password (and a code with 2FA) again, valid 10 minutes for sensitive actions. */
export async function reauthenticateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("auth.reauthenticate");
  if (!ctx.ok) return ctx.state;
  const { deps, actor, meta } = ctx.context;
  const input = z.object({ password: text(1024), code: text(64) }).safeParse({ password: form.get("password") ?? "", code: form.get("code") ?? "" });
  if (!input.success) return failure("Enter your password.");
  const result = await guarded(() => reauthenticate(deps, actor, input.data, meta));
  if (result.kind === "locked") return failure(LOCKED_MESSAGE);
  if (result.kind === "unavailable") return failure("Two-factor verification is unavailable right now. Use a recovery code.");
  if (result.kind === "failed") {
    if (result.locked) {
      await clearSessionCookie();
      redirect("/admin/login?ended=1");
    }
    return failure("That didn't match. Check your password and code.");
  }
  await writeSessionCookie(result.token);
  return { status: "ok", message: "Identity confirmed for 10 minutes." };
}

/** Called by the admin shell as the user moves between pages: a new session token every 30 minutes of use. */
export async function rotateSessionAction(): Promise<{ rotated: boolean; rotateAt: number | null }> {
  const ctx = await publicActionContext();
  if (!ctx.ok) return { rotated: false, rotateAt: null };
  const state = await getAdminState();
  if (state.status !== "active") return { rotated: false, rotateAt: null };
  const rotated = await guarded(() => rotateIfDue(ctx.deps, state.actor.session, ctx.meta));
  if (!rotated) return { rotated: false, rotateAt: state.actor.session.createdAt.getTime() + 30 * 60_000 };
  await writeSessionCookie(rotated.token);
  return { rotated: true, rotateAt: rotated.session.createdAt.getTime() + 30 * 60_000 };
}
