"use client";
/** Confirm it's you (step-up): the password, and a code when two-factor authentication is on. Valid 10 minutes. */
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { reauthenticateAction } from "@/server/admin/actions/auth";
import { idle } from "@/server/admin/actions/state";
import { Field, FormAlert, SubmitButton } from "./forms";

export function StepUpForm({ mfa, reason }: { mfa: boolean; reason: string }) {
  const [state, action] = useActionState(reauthenticateAction, idle);
  const [method, setMethod] = useState<"totp" | "recovery">("totp");
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
        {mfa && method === "totp" ? (
          <Field
            key="totp"
            label="Authentication code"
            name="code"
            className="is-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            hint="The 6-digit code from your authenticator app."
          />
        ) : null}
        {mfa && method === "recovery" ? (
          <Field
            key="recovery"
            label="Recovery code"
            name="code"
            className="is-code"
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            required
            hint="One of the recovery codes you saved (xxxxx-xxxxx-xxxxx-xxxxx). Each works once."
          />
        ) : null}
        <div className="adm-actions">
          <SubmitButton pending="Checking…">Confirm</SubmitButton>
        </div>
      </form>
      {mfa ? (
        <button type="button" className="adm-link-btn" onClick={() => setMethod(method === "totp" ? "recovery" : "totp")}>
          {method === "totp" ? "Use a recovery code instead" : "Use the authenticator app instead"}
        </button>
      ) : null}
    </section>
  );
}
