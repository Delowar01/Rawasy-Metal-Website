import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton, VerifyForm } from "@/components/admin/AuthForms";
import { getAdminState } from "@/server/admin/context";
import { safeNext } from "@/server/admin/paths";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const state = await getAdminState();
  if (state.status === "anonymous") redirect("/admin/login");
  if (state.status === "active") redirect("/admin");
  if (state.status === "enrolment_required") redirect("/admin/login/enrol");
  const next = safeNext(params.next, "");
  return (
    <>
      <div className="adm-entry-head">
        <h1>Two-factor authentication</h1>
        <p className="adm-muted">Signing in as {state.user.email}. Enter the code from your authenticator app.</p>
      </div>
      <VerifyForm next={next || undefined} />
      <div className="adm-entry-foot">
        <SignOutButton label="Cancel and sign out" variant="link" />
      </div>
    </>
  );
}
