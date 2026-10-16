import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { countLiveSessions } from "@/server/auth/sessions";
import { remainingRecoveryCodes } from "@/server/auth/sign-in";
import { accountFacts } from "@/server/auth/user-admin";
import { auditEvents } from "@/server/db/schema";
import { countItems, type TypeCounts } from "@/server/cms/list";
import { ENTITIES, type EntityType } from "@/server/cms/registry";
import { mediaStats, type MediaStats } from "@/server/media/list";
import { readLastReport, reportHasProblems, type MaintenanceReport } from "@/server/media/maintenance";
import { MEDIA_LIMITS } from "@/server/media/registry";
import { mediaStore } from "@/server/media/storage";
import { formatBytes } from "../_components/media";
import { formatTime, PageHeader, RIYADH_NOTE, RoleBadges } from "../_components/parts";

/** The content areas whose real counts the dashboard shows (A3 brief §16), in the navigation's order. */
const COUNTED: EntityType[] = ["page", "service", "project", "project_category", "machine", "industry", "client", "certificate"];

/** A count that links to the list filtered to exactly those items (when it is not zero). */
function CountLink({ type, value, query }: { type: EntityType; value: number; query: string }) {
  if (!value) return <>0</>;
  return <Link href={`${ENTITIES[type].path}?${query}`}>{value}</Link>;
}

function ContentCounts({ counts }: { counts: TypeCounts[] }) {
  return (
    <section className="adm-card" aria-labelledby="dash-content">
      <div className="adm-card-head">
        <h2 id="dash-content">Content</h2>
        <span className="adm-hint">Working records only; nothing here is public yet.</span>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table is-stack adm-stat-table">
          <caption className="adm-sr-only">Content records by area</caption>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col" className="is-num">
                Drafts
              </th>
              <th scope="col" className="is-num">
                Archived
              </th>
              <th scope="col" className="is-num">
                English missing
              </th>
              <th scope="col" className="is-num">
                Arabic missing
              </th>
              <th scope="col" className="is-num">
                Needs review
              </th>
            </tr>
          </thead>
          <tbody>
            {counts.map((c) => (
              <tr key={c.type}>
                <th scope="row">
                  <Link href={ENTITIES[c.type].path}>{ENTITIES[c.type].many}</Link>
                  {c.restricted ? (
                    <>
                      {" "}
                      <Link className="adm-badge is-danger" href={`${ENTITIES[c.type].path}?restricted=1`}>
                        {c.restricted} restricted
                      </Link>
                    </>
                  ) : null}
                </th>
                <td data-label="Drafts" className="is-num">
                  {c.active}
                </td>
                <td data-label="Archived" className="is-num">
                  <CountLink type={c.type} value={c.archived} query="status=archived" />
                </td>
                <td data-label="English missing" className="is-num">
                  <CountLink type={c.type} value={c.enMissing} query="lang=en-missing" />
                </td>
                <td data-label="Arabic missing" className="is-num">
                  <CountLink type={c.type} value={c.arMissing} query="lang=ar-missing" />
                </td>
                <td data-label="Needs review" className="is-num">
                  <CountLink type={c.type} value={c.needsReview} query="lang=needs-review" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A media count that links to the library filtered to exactly those items (when it is not zero). */
function MediaLink({ value, query }: { value: number; query: string }) {
  if (!value) return <>0</>;
  return <Link href={`/admin/media?${query}`}>{value}</Link>;
}

/**
 * Genuine media facts (A4 brief §64): counts by status, problems, and storage split into today's release files and the
 * persistent uploads — no disk quota is invented. Owner and Admin also see the last maintenance report's integrity
 * counts (§62), never a file name or path.
 */
function MediaFacts({ stats, report, integrity }: { stats: MediaStats; report: MaintenanceReport | null; integrity: boolean }) {
  return (
    <section className="adm-card" aria-labelledby="dash-media">
      <div className="adm-card-head">
        <h2 id="dash-media">Media</h2>
        <span className="adm-hint">The library only; today&apos;s public site keeps its own files until the cutover (A9).</span>
      </div>
      <div className="adm-grid">
        <dl className="adm-dl">
          <dt>Items</dt>
          <dd>
            <MediaLink value={stats.total} query="" />
          </dd>
          <dt>Pending review</dt>
          <dd>
            <MediaLink value={stats.byStatus.pending_review} query="status=pending_review" />
          </dd>
          <dt>Approved</dt>
          <dd>
            <MediaLink value={stats.byStatus.approved} query="status=approved" />
          </dd>
          <dt>Restricted</dt>
          <dd>
            <MediaLink value={stats.byStatus.restricted} query="status=restricted" />
          </dd>
          <dt>Archived</dt>
          <dd>
            <MediaLink value={stats.byStatus.archived} query="status=archived" />
          </dd>
          {stats.private !== null ? (
            <>
              <dt>Private documents</dt>
              <dd>
                <MediaLink value={stats.private} query="visibility=private" />
              </dd>
            </>
          ) : null}
          <dt>In the Trash</dt>
          <dd>
            <MediaLink value={stats.trashed} query="trash=1" />
          </dd>
        </dl>
        <dl className="adm-dl">
          <dt>With a blocking flag</dt>
          <dd>
            <MediaLink value={stats.blocking} query="flag=blocking" />
          </dd>
          <dt>Alt text not decided</dt>
          <dd>
            <MediaLink value={stats.missingAlt} query="missing=alt" />
          </dd>
          <dt>Failed processing</dt>
          <dd>
            <MediaLink value={stats.failed} query="processing=failed" />
          </dd>
          <dt>Processing for over {Math.round(MEDIA_LIMITS.stuckProcessingMs / 60_000)} minutes</dt>
          <dd>{stats.stuck}</dd>
          <dt>Release files</dt>
          <dd>
            {stats.storage.releaseFiles} · {formatBytes(stats.storage.releaseBytes)}
          </dd>
          <dt>Uploaded storage</dt>
          <dd>
            {stats.storage.persistentFiles} files (originals and generated sizes) · {formatBytes(stats.storage.persistentBytes)}
          </dd>
        </dl>
      </div>
      <p className="adm-hint">Sizes are what the library recorded. The hosting account&apos;s disk quota is not known here, so none is shown.</p>
      {integrity ? (
        report ? (
          <div className={`adm-alert ${reportHasProblems(report) ? "is-warning" : "is-info"}`} role="note">
            <p>
              <strong>Storage check of {formatTime(new Date(report.at))}</strong> (npm run media:maintenance):{" "}
              {reportHasProblems(report)
                ? `${report.missing.length} missing file(s), ${report.orphans.length} unknown file(s) on disk, ${report.stuck.length} stuck upload(s), ${report.failed} failed, ${report.publicMediaDrift.length} delivery record(s) out of step. Nothing was deleted; run the tool to see the details.`
                : "no problems found."}{" "}
              {report.purgeCandidates.length} old version(s) are eligible for a future purge (never deleted automatically).
            </p>
          </div>
        ) : (
          <p className="adm-hint">No storage check has been run yet on this server (npm run media:maintenance).</p>
        )
      ) : null}
    </section>
  );
}

export const metadata: Metadata = { title: "Dashboard" };

/** The account, its security, sessions and recent sign-in events; user counts for managers; real content counts (A3). */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actor, mfa } = await requireActor();
  const params = await searchParams;
  const deps = authDeps();
  const now = deps.clock();
  const [sessions, codes, events, facts, counts, media] = await guarded(() =>
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
      actor.permissions.has("content.view") ? Promise.all(COUNTED.map((type) => countItems(deps.db, type))) : Promise.resolve(null),
      actor.permissions.has("media.view") ? mediaStats(deps.db, actor.permissions, now, MEDIA_LIMITS.stuckProcessingMs) : Promise.resolve(null),
    ]),
  );
  // The last storage check (Owner and Admin): read from the data folder when it is configured on this server.
  const integrity = actor.permissions.has("media.approve");
  const report = media && integrity ? await readLastReport(await mediaStore().catch(() => null)) : null;
  const usedRecovery = typeof params.recovery === "string" && /^\d+$/.test(params.recovery) ? Number(params.recovery) : null;
  return (
    <>
      <PageHeader title={`Welcome, ${actor.user.displayName}`} lead="RAWASY Metal website administration — accounts, access, content records and the media library (Phase A4)." />
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
      {counts ? <ContentCounts counts={counts} /> : null}
      {media ? <MediaFacts stats={media} report={report} integrity={integrity} /> : null}
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
          The public website is served from its approved static release. Content records are kept here as drafts and media in the library (Phases A3–A4);
          publishing arrives in a later phase, and nothing in this admin changes the public site yet.
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
