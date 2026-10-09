import type { Metadata } from "next";
import { TwoFactorPanel } from "@/components/admin/TwoFactorPanel";
import { authDeps, guarded } from "@/server/admin/context";
import { hasRecentAuth, requireActor } from "@/server/admin/guards";
import { remainingRecoveryCodes } from "@/server/auth/sign-in";
import { PageHeader } from "../../../_components/parts";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function SecurityPage() {
  const { actor, mfa } = await requireActor();
  const deps = authDeps();
  const remaining = mfa.enrolled ? await guarded(() => remainingRecoveryCodes(deps.db, actor.user.id)) : 0;
  return (
    <>
      <PageHeader
        title="Two-factor authentication"
        crumbs={[{ label: "My account", href: "/admin/account" }, { label: "Two-factor authentication" }]}
        lead={mfa.required ? "Required for your role (Owner or Admin)." : "Optional for your role, and recommended."}
      />
      <section className="adm-card" aria-label="Two-factor authentication">
        <TwoFactorPanel enabled={mfa.enrolled} required={mfa.required} remaining={remaining} recentAuth={hasRecentAuth(actor, deps)} />
      </section>
    </>
  );
}
