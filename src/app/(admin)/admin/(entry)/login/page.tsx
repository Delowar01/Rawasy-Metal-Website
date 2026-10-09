import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/AuthForms";
import { getAdminState } from "@/server/admin/context";
import { safeNext } from "@/server/admin/paths";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, { tone: "info" | "success" | "warning"; text: string }> = {
  signed_out: { tone: "info", text: "You have signed out." },
  reset: { tone: "success", text: "Your password was changed. Sign in with the new password." },
  welcome: { tone: "success", text: "Your account is ready. Sign in with your new password." },
  ended: { tone: "warning", text: "Your sign-in could not be completed. Start again." },
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const next = safeNext(params.next, "");
  const state = await getAdminState();
  if (state.status === "active") redirect(next || "/admin");
  if (state.status === "mfa_pending") redirect("/admin/login/verify");
  if (state.status === "enrolment_required") redirect("/admin/login/enrol");
  const key = Object.keys(NOTICES).find((name) => params[name] !== undefined);
  const notice = key ? NOTICES[key] : null;
  return (
    <>
      <div className="adm-entry-head">
        <h1>Sign in</h1>
        <p className="adm-muted">Administration of the RAWASY Metal website.</p>
      </div>
      {notice ? (
        <div className={`adm-alert is-${notice.tone}`} role="status">
          <p>{notice.text}</p>
        </div>
      ) : null}
      <LoginForm next={next || undefined} />
      <div className="adm-entry-foot">
        <Link href="/admin/reset">Forgot your password?</Link>
        {/* A full page load into the public site's own root layout (a Link would prefetch it): */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">View website</a>
      </div>
    </>
  );
}
