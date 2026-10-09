import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/admin/AuthForms";
import { TwoFactorPanel } from "@/components/admin/TwoFactorPanel";
import { authDeps, getAdminState, guarded, signInPathFor } from "@/server/admin/context";
import { remainingRecoveryCodes } from "@/server/auth/sign-in";
import { isRecentlyAuthenticated } from "@/server/auth/sessions";

export const metadata: Metadata = { title: "Set up two-factor authentication" };

/** Owner and Admin accounts must set up two-factor authentication before anything else (A2 default). */
export default async function EnrolPage() {
  const state = await getAdminState();
  if (state.status === "anonymous") redirect(signInPathFor(state));
  if (state.status === "mfa_pending") redirect("/admin/login/verify");
  const { actor, mfa } = state;
  const deps = authDeps();
  const remaining = mfa.enrolled ? await guarded(() => remainingRecoveryCodes(deps.db, actor.user.id)) : 0;
  return (
    <>
      <div className="adm-entry-head">
        <h1>Set up two-factor authentication</h1>
        <p className="adm-muted">
          {mfa.required
            ? "Your role requires a second step at sign-in: a code from an authenticator app on your phone."
            : "Add a second step at sign-in: a code from an authenticator app on your phone."}
        </p>
      </div>
      <TwoFactorPanel
        enabled={mfa.enrolled}
        required={mfa.required}
        remaining={remaining}
        recentAuth={isRecentlyAuthenticated(actor.session, deps.clock())}
        continueHref="/admin"
      />
      <div className="adm-entry-foot">
        <SignOutButton label="Sign out" variant="link" />
      </div>
    </>
  );
}
