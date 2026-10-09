import type { Metadata } from "next";
import Link from "next/link";
import { SetPasswordForm } from "@/components/admin/AuthForms";
import { authDeps, guarded } from "@/server/admin/context";
import { inspectResetToken } from "@/server/auth/passwords";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await guarded(() => inspectResetToken(authDeps(), token));
  if (!reset) {
    return (
      <>
        <div className="adm-entry-head">
          <h1>This link is no longer valid</h1>
          <p className="adm-muted">Reset links work once and expire after 30 minutes.</p>
        </div>
        <Link href="/admin/reset">Ask for a new link</Link>
      </>
    );
  }
  return (
    <>
      <div className="adm-entry-head">
        <h1>Choose a new password</h1>
        <p className="adm-muted">For {reset.email}. All signed-in sessions of this account end when the password changes.</p>
      </div>
      <SetPasswordForm token={token} purpose="reset" email={reset.email} />
    </>
  );
}
