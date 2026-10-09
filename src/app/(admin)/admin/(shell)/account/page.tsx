import type { Metadata } from "next";
import { PasswordChangeForm } from "@/components/admin/AccountForms";
import { requireActor } from "@/server/admin/guards";
import { formatTime, PageHeader, RoleBadges } from "../../_components/parts";

export const metadata: Metadata = { title: "Profile & password" };

export default async function AccountPage() {
  const { actor } = await requireActor();
  return (
    <>
      <PageHeader title="Profile & password" crumbs={[{ label: "My account" }]} />
      <section className="adm-card" aria-labelledby="profile-title">
        <h2 id="profile-title">Profile</h2>
        <dl className="adm-dl">
          <dt>Name</dt>
          <dd>{actor.user.displayName}</dd>
          <dt>Email</dt>
          <dd>{actor.user.email}</dd>
          <dt>Roles</dt>
          <dd>
            <RoleBadges roles={actor.roles} />
          </dd>
          <dt>Account since</dt>
          <dd>{formatTime(actor.user.createdAt)}</dd>
          <dt>Password changed</dt>
          <dd>{formatTime(actor.user.passwordChangedAt)}</dd>
        </dl>
        <p className="adm-hint">Your name and email are changed by an Owner or Admin.</p>
      </section>
      <section className="adm-card" aria-labelledby="password-title">
        <h2 id="password-title">Change password</h2>
        <PasswordChangeForm email={actor.user.email} />
      </section>
    </>
  );
}
