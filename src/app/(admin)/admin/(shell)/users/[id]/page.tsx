import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { ResendInvitation, UserRolesForm, type RoleOption } from "@/components/admin/UserForms";
import { resetUserMfaAction, revokeUserSessionsAction, setUserStatusAction, unlockUserAction } from "@/server/admin/actions/users";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { getUserDetail } from "@/server/auth/user-admin";
import { canGrantRoles, isOwner } from "@/server/policy/rbac";
import { ROLES } from "@/server/policy/registry";
import { describeAgent, Forbidden, formatTime, PageHeader, RIYADH_NOTE, RoleBadges, StatusBadge, StepUpGate } from "../../../_components/parts";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireActor();
  if (!actor.permissions.has("users.view")) return <Forbidden />;
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) notFound();
  const user = await guarded(() => getUserDetail(authDeps(), actor, id));
  if (!user) notFound();
  const can = (key: string) => user.manageable && actor.permissions.has(key);
  const roles: RoleOption[] = ROLES.map((role) => ({ ...role, grantable: canGrantRoles(actor, [role.key]) }));
  const anyAction = can("users.edit") || can("users.disable") || can("users.sessions_revoke") || can("users.invite");
  return (
    <>
      <PageHeader title={user.displayName} crumbs={[{ label: "Users & access", href: "/admin/users" }, { label: user.displayName }]} lead={user.email} />
      <section className="adm-card" aria-labelledby="user-state">
        <h2 id="user-state">Account</h2>
        <dl className="adm-dl">
          <dt>Status</dt>
          <dd>
            <StatusBadge status={user.status} locked={Boolean(user.lockedUntil)} />
            {user.lockedUntil ? <span className="adm-muted"> until {formatTime(user.lockedUntil)}</span> : null}
          </dd>
          <dt>Roles</dt>
          <dd>
            <RoleBadges roles={user.roles} />
          </dd>
          <dt>Two-factor</dt>
          <dd>{user.mfaEnabled ? "On" : "Off"}</dd>
          <dt>Last sign-in</dt>
          <dd>{formatTime(user.lastLoginAt)}</dd>
          <dt>Failed attempts</dt>
          <dd>{user.failedLoginCount} since the last successful sign-in</dd>
          <dt>Password changed</dt>
          <dd>{formatTime(user.passwordChangedAt)}</dd>
          <dt>Account since</dt>
          <dd>{formatTime(user.createdAt)}</dd>
        </dl>
        <p className="adm-hint">{RIYADH_NOTE}</p>
      </section>

      {user.id === actor.user.id ? (
        <p className="adm-alert is-info">This is your own account: manage it under My account. Your roles and status are changed by another Owner.</p>
      ) : !user.manageable ? (
        <p className="adm-alert is-info">This user&apos;s role is equal to or above yours, so only an Owner can manage them.</p>
      ) : anyAction ? (
        <StepUpGate reason="Managing users is a sensitive action.">
          {can("users.edit") ? (
            <section className="adm-card" aria-labelledby="user-roles">
              <h2 id="user-roles">Roles</h2>
              <UserRolesForm userId={user.id} roles={roles} selected={user.roles} />
            </section>
          ) : null}
          <section className="adm-card" aria-labelledby="user-actions">
            <h2 id="user-actions">Access</h2>
            <div className="adm-actions">
              {can("users.disable") && user.status !== "disabled" ? (
                <ConfirmAction
                  action={setUserStatusAction}
                  label="Disable account"
                  title={`Disable ${user.displayName}?`}
                  confirmLabel="Disable"
                  fields={{ user: user.id, status: "disabled" }}
                  danger
                >
                  <p>They are signed out everywhere at once and cannot sign in until the account is enabled again. Nothing is deleted.</p>
                </ConfirmAction>
              ) : null}
              {can("users.disable") && user.status === "disabled" ? (
                <ConfirmAction
                  action={setUserStatusAction}
                  label="Enable account"
                  title={`Enable ${user.displayName}?`}
                  confirmLabel="Enable"
                  fields={{ user: user.id, status: "active" }}
                >
                  <p>They can sign in again with their password (an account that never accepted its invitation needs a new invitation link).</p>
                </ConfirmAction>
              ) : null}
              {can("users.edit") && user.lockedUntil ? (
                <ConfirmAction action={unlockUserAction} label="Unlock" title="Unlock sign-in?" confirmLabel="Unlock" fields={{ user: user.id }}>
                  <p>The pause after repeated failed sign-ins ends now.</p>
                </ConfirmAction>
              ) : null}
              {can("users.sessions_revoke") && user.liveSessions > 0 ? (
                <ConfirmAction
                  action={revokeUserSessionsAction}
                  label="Sign out everywhere"
                  title={`Sign ${user.displayName} out everywhere?`}
                  confirmLabel="Sign out"
                  fields={{ user: user.id }}
                  danger
                >
                  <p>All {user.liveSessions} active session(s) end at once.</p>
                </ConfirmAction>
              ) : null}
              {isOwner(actor) && actor.permissions.has("users.edit") && user.mfaEnabled ? (
                <ConfirmAction
                  action={resetUserMfaAction}
                  label="Reset two-factor"
                  title="Reset two-factor authentication?"
                  confirmLabel="Reset"
                  fields={{ user: user.id }}
                  danger
                >
                  <p>
                    Confirm the person&apos;s identity outside the admin first (in person or by phone). Their authenticator and recovery codes stop working,
                    they are signed out, and they set up two-factor authentication again at their next sign-in.
                  </p>
                </ConfirmAction>
              ) : null}
            </div>
            {can("users.invite") && user.status === "invited" ? <ResendInvitation userId={user.id} email={user.email} /> : null}
          </section>
          {can("users.sessions_revoke") && user.sessions.length ? (
            <section className="adm-card" aria-labelledby="user-sessions">
              <h2 id="user-sessions">Active sessions</h2>
              <ul className="adm-list">
                {user.sessions.map((session) => (
                  <li key={session.id}>
                    <span>
                      <strong>{describeAgent(session.userAgent)}</strong>
                      <br />
                      <span className="adm-muted">
                        {session.ip ?? "Address unknown"} · last active {formatTime(session.lastSeenAt)}
                      </span>
                    </span>
                    <ConfirmAction
                      action={revokeUserSessionsAction}
                      label="Sign out"
                      title="Sign out this session?"
                      confirmLabel="Sign it out"
                      fields={{ user: user.id, session: session.id }}
                      small
                    >
                      <p>This session ends at once.</p>
                    </ConfirmAction>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </StepUpGate>
      ) : null}

      <section className="adm-card" aria-labelledby="user-events">
        <div className="adm-card-head">
          <h2 id="user-events">Recent security events</h2>
          <span className="adm-hint">{RIYADH_NOTE}</span>
        </div>
        {user.recentEvents.length === 0 ? (
          <p className="adm-empty">No events recorded.</p>
        ) : (
          <ul className="adm-list">
            {user.recentEvents.map((event, i) => (
              <li key={i}>
                <span>{event.summary}</span>
                <span className="adm-muted">
                  {formatTime(event.occurredAt)}
                  {event.outcome !== "success" ? <span className="adm-badge is-warning">{event.outcome}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
