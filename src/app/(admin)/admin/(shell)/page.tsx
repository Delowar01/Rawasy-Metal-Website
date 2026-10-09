import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { countLiveSessions } from "@/server/auth/sessions";
import { remainingRecoveryCodes } from "@/server/auth/sign-in";
import { accountFacts } from "@/server/auth/user-admin";
import { auditEvents } from "@/server/db/schema";
import { formatTime, PageHeader, RIYADH_NOTE, RoleBadges } from "../_components/parts";

export const metadata: Metadata = { title: "Dashboard" };

/** Phase A2 facts only: the account, its security, sessions and recent sign-in events; user counts for managers. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actor, mfa } = await requireActor();
  const params = await searchParams;
  const deps = authDeps();
  const now = deps.clock();
  const [sessions, codes, events, facts] = await guarded(() =>
    Promise.all([
      countLiveSessions(deps.db, actor.user.id, now),
      mfa.enrolled ? remainingRecoveryCodes(deps.db, actor.user.id) : Promise.resolve(0),
      deps.db
        .select({ occurredAt: auditEvents.occurredAt, summary: auditEvents.summary, outcome: auditEvents.outcome, action: auditEvents.action })
        .from(auditEvents)
        .where(and(eq(auditEvents.entityType, "user"), eq(auditEvents.entityId, actor.user.id)))
        .orderBy(desc(auditEvents.id))
        .limit(8),
      actor.permissions.has("users.view") ? accountFacts(deps) : Promise.resolve(null),
    ]),
  );
  const usedRecovery = typeof params.recovery === "string" && /^\d+$/.test(params.recovery) ? Number(params.recovery) : null;
  return (
    <>
      <PageHeader title={`Welcome, ${actor.user.displayName}`} lead="RAWASY Metal website administration — accounts and access (Phase A2)." />
      {usedRecovery !== null ? (
        <div className={`adm-alert ${usedRecovery <= 3 ? "is-warning" : "is-info"}`} role="status">
          <p>
            You signed in with a recovery code. {usedRecovery} recovery code{usedRecovery === 1 ? "" : "s"} left.{" "}
            {usedRecovery <= 3 ? <Link href="/admin/account/security">Create new codes</Link> : null}
          </p>
        </div>
      ) : null}
      <div className="adm-grid">
        <section className="adm-card" aria-labelledby="dash-account">
          <h2 id="dash-account">Your account</h2>
          <dl className="adm-dl">
            <dt>Email</dt>
            <dd>{actor.user.email}</dd>
            <dt>Roles</dt>
            <dd>
              <RoleBadges roles={actor.roles} />
            </dd>
            <dt>Signed in</dt>
            <dd>{formatTime(actor.user.lastLoginAt)}</dd>
          </dl>
          <Link href="/admin/account">Profile and password</Link>
        </section>
        <section className="adm-card" aria-labelledby="dash-security">
          <h2 id="dash-security">Security</h2>
          <dl className="adm-dl">
            <dt>Two-factor</dt>
            <dd>
              {mfa.enrolled ? <span className="adm-badge is-success">On</span> : <span className="adm-badge is-warning">Off</span>}
              {mfa.required ? <span className="adm-muted"> (required for your role)</span> : null}
            </dd>
            {mfa.enrolled ? (
              <>
                <dt>Recovery codes</dt>
                <dd>{codes} of 10 left</dd>
              </>
            ) : null}
            <dt>Active sessions</dt>
            <dd>{sessions}</dd>
            <dt>This session ends</dt>
            <dd>{formatTime(actor.session.absoluteExpiresAt)} at the latest</dd>
          </dl>
          <div className="adm-actions">
            <Link href="/admin/account/security">Two-factor authentication</Link>
            <Link href="/admin/account/sessions">Sessions</Link>
          </div>
        </section>
        {facts ? (
          <section className="adm-card" aria-labelledby="dash-users">
            <h2 id="dash-users">Users</h2>
            <dl className="adm-dl">
              <dt>Active</dt>
              <dd>{facts.active}</dd>
              <dt>Invited</dt>
              <dd>{facts.invited}</dd>
              <dt>Disabled</dt>
              <dd>{facts.disabled}</dd>
              <dt>Locked now</dt>
              <dd>{facts.locked}</dd>
            </dl>
            <Link href="/admin/users">Users &amp; access</Link>
          </section>
        ) : null}
      </div>
      <section className="adm-card" aria-labelledby="dash-events">
        <div className="adm-card-head">
          <h2 id="dash-events">Recent activity on your account</h2>
          <span className="adm-hint">{RIYADH_NOTE}</span>
        </div>
        {events.length === 0 ? (
          <p className="adm-empty">No activity recorded yet.</p>
        ) : (
          <ul className="adm-list">
            {events.map((event, i) => (
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
      <section className="adm-card" aria-labelledby="dash-site">
        <h2 id="dash-site">Website</h2>
        <p className="adm-muted">
          The public website is served from its approved static release. Content editing, media and publishing arrive in later phases; nothing in
          this admin changes the public site yet.
        </p>
        <div className="adm-actions">
          <a className="adm-btn" href="/" target="_blank" rel="noopener">
            View website<span className="adm-sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </section>
    </>
  );
}
