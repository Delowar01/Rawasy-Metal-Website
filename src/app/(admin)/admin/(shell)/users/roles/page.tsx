import type { Metadata } from "next";
import { requireActor } from "@/server/admin/guards";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "@/server/policy/registry";
import { Forbidden, PageHeader } from "../../../_components/parts";

export const metadata: Metadata = { title: "Roles & permissions" };

/** The permission matrix as seeded (read-only in A2: roles are changed by migration, the Owner decides). */
export default async function RolesPage() {
  const { actor } = await requireActor();
  if (!actor.permissions.has("roles.view")) return <Forbidden />;
  const groups = new Map<string, typeof PERMISSIONS[number][]>();
  for (const permission of PERMISSIONS) groups.set(permission.resource, [...(groups.get(permission.resource) ?? []), permission]);
  return (
    <>
      <PageHeader
        title="Roles & permissions"
        crumbs={[{ label: "Users & access", href: "/admin/users" }, { label: "Roles & permissions" }]}
        lead="What each role may do. Permissions marked “confirm” need the password (and code) again within 10 minutes. Most areas arrive in later phases."
      />
      <div className="adm-grid">
        {ROLES.map((role) => (
          <section key={role.key} className="adm-card adm-stat" aria-label={role.name}>
            <h2>{role.name}</h2>
            <p className="adm-muted">{role.description}</p>
            <p>
              Rank {role.rank} · {ROLE_PERMISSIONS[role.key].length} permissions
            </p>
          </section>
        ))}
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table adm-matrix">
          <caption className="adm-sr-only">Permission matrix: rows are permissions, columns are roles.</caption>
          <thead>
            <tr>
              <th scope="col">Permission</th>
              {ROLES.map((role) => (
                <th key={role.key} scope="col">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([resource, permissions]) =>
              permissions.map((permission, i) => (
                <tr key={permission.key}>
                  <th scope="row">
                    {i === 0 ? <span className="adm-muted">{resource} · </span> : null}
                    <span className="adm-mono">{permission.key}</span>
                    {permission.isSensitive ? <span className="adm-badge is-warning">confirm</span> : null}
                    <br />
                    <span className="adm-hint">{permission.description}</span>
                  </th>
                  {ROLES.map((role) => {
                    const allowed = ROLE_PERMISSIONS[role.key].includes(permission.key);
                    return (
                      <td key={role.key}>
                        <span aria-hidden="true">{allowed ? "✓" : "—"}</span>
                        <span className="adm-sr-only">{allowed ? "allowed" : "not allowed"}</span>
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
