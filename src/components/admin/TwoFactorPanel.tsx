"use client";
/**
 * Two-factor authentication on "Security" and on the set-up required after an Owner's or Admin's first sign-in. One
 * client component holds the whole flow, so the page's refresh after a change (the session cookie rotates) does not
 * lose the recovery codes, which are shown only once.
 */
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState } from "react";
import { disableMfaAction, regenerateCodesAction, type EnrolmentState } from "@/server/admin/actions/account";
import { idle } from "@/server/admin/actions/state";
import { FormAlert, SubmitButton } from "./forms";
import { MfaSetup } from "./MfaSetup";
import { RecoveryCodes } from "./RecoveryCodes";
import { StepUpForm } from "./StepUp";

type Flow = "status" | "setup" | "replace" | "codes";

export function TwoFactorPanel({
  enabled,
  required,
  remaining,
  recentAuth,
  continueHref,
}: {
  enabled: boolean;
  required: boolean;
  remaining: number;
  recentAuth: boolean;
  /** Shown after set-up (the required set-up's way on to the dashboard). */
  continueHref?: string;
}) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>(enabled ? "status" : "setup");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [needStepUp, setNeedStepUp] = useState(false);
  const onEnabled = useCallback((fresh: string[]) => {
    setCodes(fresh);
    setFlow("codes");
  }, []);
  const onStepUp = useCallback(() => setNeedStepUp(true), []);

  const [regenerated, regenerate] = useActionState(async () => {
    const result = await regenerateCodesAction();
    if (result.stepUp) setNeedStepUp(true);
    if (result.status === "ok" && result.recoveryCodes) onEnabled(result.recoveryCodes);
    return result;
  }, idle as EnrolmentState);
  const [disabled, disable] = useActionState(async () => {
    const result = await disableMfaAction();
    if (result.stepUp) setNeedStepUp(true);
    if (result.status === "ok") {
      setFlow("setup");
      router.refresh();
    }
    return result;
  }, idle);

  if (flow === "codes" && codes) {
    return (
      <div className="adm-form">
        <div className="adm-alert is-success" role="status">
          <p>
            <strong>Two-factor authentication is on.</strong> Your other sessions were signed out.
          </p>
        </div>
        <RecoveryCodes codes={codes} />
        <div className="adm-actions">
          {continueHref ? (
            <a className="adm-btn is-primary" href={continueHref}>
              I saved them — continue
            </a>
          ) : (
            <button
              type="button"
              className="adm-btn is-primary"
              onClick={() => {
                setCodes(null);
                setFlow("status");
                router.refresh();
              }}
            >
              I saved them
            </button>
          )}
        </div>
      </div>
    );
  }

  const stepUp = needStepUp && !recentAuth ? <StepUpForm mfa={enabled} reason="Changing two-factor authentication is a sensitive action." /> : null;

  if (flow === "setup" || flow === "replace") {
    if (flow === "replace" && !recentAuth) {
      return (
        <div className="adm-form">
          <StepUpForm mfa reason="Replacing the authenticator app is a sensitive action." />
          <button type="button" className="adm-link-btn" onClick={() => setFlow("status")}>
            Cancel
          </button>
        </div>
      );
    }
    return (
      <div className="adm-form">
        {stepUp}
        <MfaSetup replace={flow === "replace"} onEnabled={onEnabled} onStepUp={onStepUp} />
        {flow === "replace" ? (
          <button type="button" className="adm-link-btn" onClick={() => setFlow("status")}>
            Cancel
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="adm-form">
      <div className="adm-alert is-success">
        <p>
          <strong>Two-factor authentication is on.</strong> {remaining} of 10 recovery codes left.
          {required ? " It is required for your role." : ""}
        </p>
      </div>
      {remaining <= 3 ? (
        <div className="adm-alert is-warning" role="status">
          <p>Few recovery codes are left. Create new ones and keep them safe.</p>
        </div>
      ) : null}
      {stepUp}
      <FormAlert state={regenerated.stepUp ? idle : regenerated} />
      <FormAlert state={disabled.stepUp ? idle : disabled} />
      <div className="adm-actions">
        <form action={regenerate}>
          <SubmitButton variant="secondary" pending="Creating…">
            Create new recovery codes
          </SubmitButton>
        </form>
        <button type="button" className="adm-btn" onClick={() => setFlow("replace")}>
          Replace authenticator app
        </button>
        {required ? null : (
          <form action={disable}>
            <SubmitButton variant="danger" pending="Turning off…">
              Turn off
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
