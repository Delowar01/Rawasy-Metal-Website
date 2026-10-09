import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/components/admin/AuthForms";
import { authDeps } from "@/server/admin/context";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetRequestPage() {
  const mail = authDeps().mailer.configured;
  return (
    <>
      <div className="adm-entry-head">
        <h1>Reset your password</h1>
        <p className="adm-muted">
          {mail
            ? "Enter the email address of your admin account. If it is an active account, we send a link to choose a new password."
            : "Password reset by email is not available yet: this site does not send email."}
        </p>
      </div>
      {mail ? (
        <ResetRequestForm />
      ) : (
        <div className="adm-alert is-info">
          <p>Ask an Owner to reset your access. An Owner who cannot sign in uses the server&apos;s recovery command (README).</p>
        </div>
      )}
      <div className="adm-entry-foot">
        <Link href="/admin/login">Back to sign-in</Link>
      </div>
    </>
  );
}
