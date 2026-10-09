import type { Metadata } from "next";
import Link from "next/link";
import { SetPasswordForm } from "@/components/admin/AuthForms";
import { authDeps, guarded } from "@/server/admin/context";
import { inspectInvitation } from "@/server/auth/invitations";
import { ROLE_NAMES } from "../../../_components/parts";

export const metadata: Metadata = { title: "Accept invitation", referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await guarded(() => inspectInvitation(authDeps(), token));
  if (!invite) {
    return (
      <>
        <div className="adm-entry-head">
          <h1>This link is no longer valid</h1>
          <p className="adm-muted">Invitation links work once and expire. Ask the person who invited you for a new link.</p>
        </div>
        <Link href="/admin/login">Go to sign-in</Link>
      </>
    );
  }
  const owner = invite.purpose === "owner_setup";
  return (
    <>
      <div className="adm-entry-head">
        <h1>{owner ? "Set up the Owner account" : "Accept your invitation"}</h1>
        <p className="adm-muted">Choose a password to activate your account. You will then sign in.</p>
      </div>
      <dl className="adm-dl">
        <dt>Name</dt>
        <dd>{invite.displayName}</dd>
        <dt>Email</dt>
        <dd>{invite.email}</dd>
        <dt>Role</dt>
        <dd>{invite.roles.map((r) => ROLE_NAMES[r] ?? r).join(", ")}</dd>
      </dl>
      <SetPasswordForm token={token} purpose="invitation" email={invite.email} />
    </>
  );
}
