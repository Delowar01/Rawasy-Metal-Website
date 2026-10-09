"use client";
/** "My account" forms: password change. */
import { useActionState } from "react";
import { changePasswordAction } from "@/server/admin/actions/account";
import { idle } from "@/server/admin/actions/state";
import { Field, FormAlert, PASSWORD_HINT, SubmitButton } from "./forms";

export function PasswordChangeForm({ email }: { email: string }) {
  const [state, action] = useActionState(changePasswordAction, idle);
  return (
    <form action={action} className="adm-form" noValidate key={state.status === "ok" ? state.message : "form"}>
      <FormAlert state={state} />
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
      <Field label="New password" name="next" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint={PASSWORD_HINT} />
      <Field label="Repeat the new password" name="confirm" type="password" autoComplete="new-password" required />
      <div className="adm-actions">
        <SubmitButton pending="Saving…">Change password</SubmitButton>
      </div>
      <p className="adm-hint">Changing the password signs out your other sessions.</p>
    </form>
  );
}
