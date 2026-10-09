import type { Metadata } from "next";
import Link from "next/link";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { listUsers } from "@/server/auth/user-admin";
import { Forbidden, formatTime, PageHeader, RIYADH_NOTE, RoleBadges, StatusBadge } from "../../_components/parts";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const { actor } = await requireActor();
  if (!actor.permissions.has("users.view")) return <Forbidden />;
  const users = await guarded(() => listUsers(authDeps(), actor));
  return (
    <>
      <PageHeader
        title="Users"
        crumbs={[{ label: "Users & access" }]}
        lead="Everyone who can sign in to the admin. Accounts are never deleted: disable them instead."
        actions={
          actor.permissions.has("users.invite") ? (
            <Link className="adm-btn is-primary" href="/admin/users/invite">
              Invite a user
            </Link>
          ) : null
        }
      />
      {users.length === 0 ? (
        <p className="adm-empty">No users yet.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table is-stack">
            <caption className="adm-sr-only">Users, their roles and state. {RIYADH_NOTE}</caption>
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Roles</th>
                <th scope="col">Status</th>
                <th scope="col">Two-factor</th>
                <th scope="col">Last sign-in</th>
                <th scope="col" className="is-num">
                  Sessions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <th scope="row">
                    <Link href={`/admin/users/${user.id}`}>{user.displayName}</Link>
                    {user.id === actor.user.id ? <span className="adm-muted"> (you)</span> : null}
                    <br />
                    <span className="adm-muted">{user.email}</span>
                  </th>
                  <td data-label="Roles">
                    <RoleBadges roles={user.roles} />
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={user.status} locked={Boolean(user.lockedUntil)} />
                  </td>
                  <td data-label="Two-factor">{user.mfaEnabled ? "On" : "Off"}</td>
                  <td data-label="Last sign-in">{formatTime(user.lastLoginAt)}</td>
                  <td data-label="Sessions" className="is-num">
                    {user.liveSessions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
