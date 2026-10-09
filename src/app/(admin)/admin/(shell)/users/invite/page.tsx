import type { Metadata } from "next";
import { InviteUserForm, type RoleOption } from "@/components/admin/UserForms";
import { requireActor } from "@/server/admin/guards";
import { canGrantRoles } from "@/server/policy/rbac";
import { ROLES } from "@/server/policy/registry";
import { Forbidden, PageHeader, StepUpGate } from "../../../_components/parts";

export const metadata: Metadata = { title: "Invite a user" };

export default async function InvitePage() {
  const { actor } = await requireActor();
  if (!actor.permissions.has("users.invite")) return <Forbidden />;
  const roles: RoleOption[] = ROLES.map((role) => ({ ...role, grantable: canGrantRoles(actor, [role.key]) }));
  return (
    <>
      <PageHeader
        title="Invite a user"
        crumbs={[{ label: "Users & access", href: "/admin/users" }, { label: "Invite" }]}
        lead="The person receives a single-use link (valid 72 hours) to choose a password. There is no public sign-up."
      />
      <StepUpGate reason="Inviting users is a sensitive action.">
        <section className="adm-card" aria-label="Invitation">
          <InviteUserForm roles={roles} />
        </section>
      </StepUpGate>
    </>
  );
}
