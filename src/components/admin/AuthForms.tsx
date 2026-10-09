"use client";
/** The sign-in pages' forms: password, second factor, reset request, and choosing a password (invitation or reset). */
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  acceptInvitationAction,
  completeResetAction,
  requestResetAction,
  signInAction,
  signOutAction,
  verifySecondFactorAction,
} from "@/server/admin/actions/auth";
import { idle } from "@/server/admin/actions/state";
import { Field, FormAlert, PASSWORD_HINT, SubmitButton } from "./forms";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, idle);
  return (
    <form action={action} className="adm-form" noValidate>
      <FormAlert state={state} />
      <Field label="Email" name="email" type="email" autoComplete="username" required defaultValue={state.fields?.email} autoFocus />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <SubmitButton pending="Signing in…" block>
        Sign in
      </SubmitButton>
    </form>
  );
}

export function VerifyForm({ next }: { next?: string }) {
  const [state, action] = useActionState(verifySecondFactorAction, idle);
  const [method, setMethod] = useState<"totp" | "recovery">("totp");
  return (
    <div className="adm-form">
      <form action={action} className="adm-form" noValidate>
        <FormAlert state={state} />
        <input type="hidden" name="method" value={method} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {method === "totp" ? (
          <Field
            key="totp"
            label="Authentication code"
            name="code"
            className="is-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            hint="The 6-digit code from your authenticator app."
          />
        ) : (
          <Field
            key="recovery"
            label="Recovery code"
            name="code"
            className="is-code"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
            required
            autoFocus
            hint="One of the recovery codes you saved when you set up two-factor authentication (xxxxx-xxxxx). Each works once."
          />
        )}
        <SubmitButton pending="Checking…" block>
          Verify
        </SubmitButton>
      </form>
      <button type="button" className="adm-link-btn" onClick={() => setMethod(method === "totp" ? "recovery" : "totp")}>
        {method === "totp" ? "Use a recovery code instead" : "Use the authenticator app instead"}
      </button>
    </div>
  );
}

export function SignOutButton({ label = "Sign out", variant = "secondary" }: { label?: string; variant?: "secondary" | "link" }) {
  return (
    <form action={signOutAction}>
      {variant === "link" ? (
        <button type="submit" className="adm-link-btn">
          {label}
        </button>
      ) : (
        <SubmitButton variant="secondary" pending="Signing out…">
          {label}
        </SubmitButton>
      )}
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestResetAction, idle);
  if (state.status === "ok") {
    return (
      <div className="adm-form">
        <FormAlert state={state} />
        <Link href="/admin/login">Back to sign-in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="adm-form" noValidate>
      <FormAlert state={state} />
      <Field label="Email" name="email" type="email" autoComplete="username" required autoFocus />
      <SubmitButton pending="Sending…" block>
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function SetPasswordForm({ token, purpose, email }: { token: string; purpose: "invitation" | "reset"; email: string }) {
  const [state, action] = useActionState(purpose === "reset" ? completeResetAction : acceptInvitationAction, idle);
  return (
    <form action={action} className="adm-form" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      {/* Lets password managers save the new password with the right account. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint={PASSWORD_HINT} autoFocus />
      <Field label="Repeat the new password" name="confirm" type="password" autoComplete="new-password" required />
      <SubmitButton pending="Saving…" block>
        {purpose === "reset" ? "Set new password" : "Set password and activate"}
      </SubmitButton>
    </form>
  );
}
