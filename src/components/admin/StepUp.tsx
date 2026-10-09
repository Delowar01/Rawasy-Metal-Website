"use client";
/** Confirm it's you (step-up): the password, and a code when two-factor authentication is on. Valid 10 minutes. */
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { reauthenticateAction } from "@/server/admin/actions/auth";
import { idle } from "@/server/admin/actions/state";
import { Field, FormAlert, SubmitButton } from "./forms";

export function StepUpForm({ mfa, reason }: { mfa: boolean; reason: string }) {
  const [state, action] = useActionState(reauthenticateAction, idle);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "ok") router.refresh();
  }, [state, router]);
  return (
    <section className="adm-card" aria-labelledby="stepup-title">
      <div className="adm-card-head">
        <h2 id="stepup-title">Confirm it&apos;s you</h2>
      </div>
      <p className="adm-muted">{reason} Your confirmation is valid for 10 minutes.</p>
      <form action={action} className="adm-form" noValidate>
        <FormAlert state={state} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        {mfa ? (
          <Field
            label="Authentication code"
            name="code"
            className="is-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            required
            hint="From your authenticator app (or a recovery code)."
          />
        ) : null}
        <div className="adm-actions">
          <SubmitButton pending="Checking…">Confirm</SubmitButton>
        </div>
      </form>
    </section>
  );
}
