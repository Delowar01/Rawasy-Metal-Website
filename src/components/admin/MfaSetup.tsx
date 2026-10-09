"use client";
/**
 * Setting up two-factor authentication: (1) confirm the password, (2) scan the QR code or type the key, enter a first
 * code. The recovery codes that result are handed to the parent panel, which shows them once.
 */
import { useActionState, useState } from "react";
import { beginEnrolmentAction, confirmEnrolmentAction, type EnrolmentState } from "@/server/admin/actions/account";
import { idle } from "@/server/admin/actions/state";
import { Field, FormAlert, SubmitButton } from "./forms";

export function MfaSetup({
  replace = false,
  onEnabled,
  onStepUp,
}: {
  replace?: boolean;
  onEnabled: (codes: string[]) => void;
  onStepUp?: () => void;
}) {
  // The parent learns the outcome from the action itself (no effect that copies state around).
  const [begun, begin] = useActionState(async (previous: EnrolmentState, form: FormData) => {
    const result = await beginEnrolmentAction(previous, form);
    if (result.stepUp) onStepUp?.();
    return result;
  }, idle as EnrolmentState);
  const [confirmed, confirm] = useActionState(async (previous: EnrolmentState, form: FormData) => {
    const result = await confirmEnrolmentAction(previous, form);
    if (result.status === "ok" && result.recoveryCodes) onEnabled(result.recoveryCodes);
    return result;
  }, idle as EnrolmentState);
  const [showKey, setShowKey] = useState(false);

  if (begun.status !== "ok" || !begun.qr || !begun.secret) {
    return (
      <form action={begin} className="adm-form" noValidate>
        <FormAlert state={begun} />
        <p>
          {replace
            ? "Replacing the authenticator app stops the current one at once. Confirm your password to start."
            : "Confirm your password to start. You will need an authenticator app (for example Google Authenticator, Microsoft Authenticator, 1Password or Bitwarden)."}
        </p>
        {replace ? <input type="hidden" name="replace" value="1" /> : null}
        <Field label="Password" name="password" type="password" autoComplete="current-password" required autoFocus />
        <div className="adm-actions">
          <SubmitButton pending="Checking…">Continue</SubmitButton>
        </div>
      </form>
    );
  }

  const { qr } = begun;
  return (
    <div className="adm-form">
      <ol className="adm-steps">
        <li>Open your authenticator app and add an account by scanning this QR code.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <svg
        className="adm-qr"
        viewBox={`-4 -4 ${qr.size + 8} ${qr.size + 8}`}
        role="img"
        aria-label="QR code for your authenticator app (the same key is available as text below)"
        shapeRendering="crispEdges"
      >
        <path d={qr.d} />
      </svg>
      <div>
        <button type="button" className="adm-link-btn" aria-expanded={showKey} onClick={() => setShowKey(!showKey)}>
          {showKey ? "Hide the key" : "Can't scan? Show the key to type in"}
        </button>
        {showKey ? (
          <p className="adm-secret" aria-label="Setup key">
            {begun.secret.replace(/(.{4})/g, "$1 ").trim()}
          </p>
        ) : null}
      </div>
      <form action={confirm} className="adm-form" noValidate>
        <FormAlert state={confirmed} />
        <Field
          label="6-digit code"
          name="code"
          className="is-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
        />
        <div className="adm-actions">
          <SubmitButton pending="Checking…">Turn on two-factor authentication</SubmitButton>
        </div>
      </form>
    </div>
  );
}
