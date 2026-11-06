/**
 * A8 screens: the publishing panel shown on every editable item (state, the check of the working copy, review comments,
 * the steps this person may take, "Used by" from the reference index), the version history with restore and roll back,
 * the comparison of two versions field by field per language, and the audit log viewer. Server components; every
 * screen checks the session and its permission itself. Nothing here makes anything public: a publish writes the
 * database's public read model, which no public page reads before the A9 cutover.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Actor } from "@/server/auth/types";
import { authDeps, guarded } from "@/server/admin/context";
import { hasRecentAuth, requireActor } from "@/server/admin/guards";
import { SENSITIVE_PERMISSIONS } from "@/server/policy/registry";
import { StepUpForm } from "@/components/admin/StepUp";
import { currentAuditSearch } from "@/server/admin/audit-search";
import { clearAuditSearchAction, searchAuditAction } from "@/server/admin/actions/publishing";
import { auditActors, auditAddress, auditEntityTypes, listAudit, parseAuditQuery, AUDIT_OUTCOMES } from "@/server/audit/viewer";
import { SPECS } from "@/server/cms/kinds";
import { ENTITY_TYPES, ORDERING_KEYS, type EntityType } from "@/server/cms/registry";
import { MENU_SLOTS } from "@/server/site/registry";
import { changeLabel, diffSnapshots, displayValue, localesOf } from "@/server/publishing/compare";
import { adminPath, sourceLabel, usedBy } from "@/server/publishing/references";
import { AGGREGATES, allowed, displayedState, isAggregateType, workflowKeys, type AggregateType } from "@/server/publishing/registry";
import { listRevisions, readRevision, readRootStatus } from "@/server/publishing/revisions";
import { readSnapshot, type Snapshot } from "@/server/publishing/snapshot";
import { readPublishing } from "@/server/publishing/workflow";
import { RevisionButtons, WorkflowButtons } from "@/components/admin/publishing/Workflow";
import { Forbidden, formatTime, PageHeader, RIYADH_NOTE } from "./parts";

export type SearchParams = Record<string, string | string[] | undefined>;

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const RESTORABLE = new Set<AggregateType>([...ENTITY_TYPES, "reusable_section", "ordering", "menu", "site_settings", "form"]);
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Whether `id` names an aggregate of this type (its id grammar). */
export function validId(type: AggregateType, id: string): boolean {
  if (type === "ordering") return (ORDERING_KEYS as readonly string[]).includes(id);
  if (type === "menu") return MENU_SLOTS.some((s) => s.key === id);
  if (type === "site_settings") return id === "site";
  return ULID.test(id);
}

export const historyHref = (type: AggregateType, id: string) => `/admin/history/${type}/${id}`;

const KIND_LABELS: Record<string, string> = {
  save: "Saved",
  submit: "Submitted for review",
  publish: "Published",
  unpublish: "Unpublished",
  archive: "Archived",
  restore: "Restored",
  import: "Imported",
};

function StateLine({ publication, draft }: { publication: string; draft: string }) {
  const label = displayedState(publication, draft);
  const tone = publication === "published" ? (draft === "none" ? "is-success" : "is-warning") : publication === "archived" ? "" : draft === "in_review" ? "is-warning" : "";
  return <span className={`adm-badge ${tone}`.trim()}>{label}</span>;
}

/** The publishing panel of one item (placed on its editor page). */
export async function PublishingPanel({ type, id, actor, label, anchor = "publishing", compact = false }: { type: AggregateType; id: string; actor: Actor; label: string; anchor?: string; compact?: boolean }) {
  const deps = authDeps();
  const [state, used, history] = await guarded(() => Promise.all([readPublishing(deps.db, actor, type, id), usedBy(deps.db, type, id), listRevisions(deps.db, type, id)]));
  if (!state) return null;
  const info = AGGREGATES[type];
  const live = history.rows.find((r) => r.id === state.publishedRevisionId) ?? null;
  const blocking = state.issues.filter((i) => i.blocking);
  const warnings = state.issues.filter((i) => !i.blocking);
  const others = used.filter((u) => !(u.sourceType === type && u.sourceId === id));
  const linkedFrom = others.filter((u) => u.scope === "published").length;
  const titleId = `${anchor}-title`;
  // A step that needs a sensitive key (a legal page's publish, unpublish and rollback: legal.publish) asks for a recent
  // re-authentication first; the service refuses it otherwise (A1-SECURITY-RBAC §3.7).
  const sensitive = (state.can.publish || state.can.unpublish) && workflowKeys(type, "publish", state.facts).some((key) => SENSITIVE_PERMISSIONS.has(key));
  const stepUp = sensitive && !hasRecentAuth(actor) ? (await requireActor()).mfa.enrolled : null;
  return (
    <>
      <section className="adm-card" id={anchor} aria-labelledby={titleId}>
        <h2 id={titleId}>{compact ? `Publishing: ${label}` : "Publishing"}</h2>
        <dl className="adm-dl">
          <dt>State</dt>
          <dd>
            <StateLine publication={state.publication} draft={state.draft} />
          </dd>
          <dt>Live version</dt>
          <dd>{live ? `Revision ${live.number}, published ${formatTime(live.liveFrom ?? live.createdAt)}${live.createdByName ? ` by ${live.createdByName}` : ""}` : "None"}</dd>
          <dt>Public website</dt>
          <dd>Unchanged: the public pages keep reading today&apos;s approved content until the content cutover (A9).</dd>
        </dl>
        {state.comments.filter((c) => c.status === "open").length ? (
          <div className="adm-alert is-warning" role="note">
            <p>
              <strong>Changes requested.</strong>
            </p>
            <ul className="adm-list">
              {state.comments
                .filter((c) => c.status === "open")
                .map((c) => (
                  <li key={c.id}>
                    <p className="adm-pre">{c.body}</p>
                    <p className="adm-hint">
                      {c.authorName ?? "A reviewer"}, {formatTime(c.createdAt)}
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        {state.publication !== "archived" && state.draft !== "none" ? (
          <div className={`adm-alert ${blocking.length ? "is-error" : "is-success"}`} role="status">
            <p>
              <strong>{blocking.length ? `Not ready to publish: ${blocking.length} problem${blocking.length === 1 ? "" : "s"}.` : "Ready to publish."}</strong>
            </p>
            {blocking.length || warnings.length ? (
              <ul className="adm-list">
                {blocking.map((issue) => (
                  <li key={`b-${issue.code}`}>{issue.message}</li>
                ))}
                {warnings.map((issue) => (
                  <li key={`w-${issue.code}`}>
                    <span className="adm-badge">Note</span> {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {stepUp !== null ? <StepUpForm mfa={stepUp} reason="Publishing, unpublishing or rolling back a legal page is a sensitive action." /> : null}
        <WorkflowButtons
          type={type}
          id={id}
          version={state.version}
          one={info.one}
          label={label}
          publication={state.publication}
          draft={state.draft}
          blocking={blocking.length}
          legal={state.facts.pageType === "legal"}
          review={info.review}
          linkedFrom={linkedFrom}
          can={state.can}
        />
        <p className="adm-hint">
          <Link href={historyHref(type, id)}>Version history ({history.total})</Link>
        </p>
      </section>
      {compact ? null : (
      <section className="adm-card" id={`${anchor}-references`} aria-labelledby={`${titleId}-refs`}>
        <h2 id={`${titleId}-refs`}>Used by (all content)</h2>
        {others.length ? (
          <ul className="adm-list">
            {others.map((u) => (
              <li key={`${u.sourceType}:${u.sourceId}:${u.scope}`}>
                {u.path ? <Link href={u.path}>{u.label}</Link> : u.label} <span className="adm-muted">({AGGREGATES[u.sourceType].one})</span>{" "}
                <span className={`adm-badge ${u.scope === "published" ? "is-success" : ""}`.trim()}>{u.scope === "published" ? "Live version" : "Working copy"}</span>
                {u.places > 1 ? <span className="adm-muted"> · {u.places} places</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-muted">Nothing else names it (pages, sections, menus, collections and settings included).</p>
        )}
      </section>
      )}
    </>
  );
}

function aggregateFrom(rawType: string, rawId: string): { type: AggregateType; id: string } {
  if (!isAggregateType(rawType) || !validId(rawType, rawId)) notFound();
  return { type: rawType, id: rawId };
}

/** The version history of one item. */
export async function HistoryScreen({ rawType, rawId, searchParams }: { rawType: string; rawId: string; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  const { type, id } = aggregateFrom(rawType, rawId);
  const deps = authDeps();
  const page = Math.max(1, Math.min(Number(one(searchParams.page)) || 1, 10_000));
  const [status, history, label, pageRow] = await guarded(() =>
    Promise.all([readRootStatus(deps.db, type, id), listRevisions(deps.db, type, id, page), sourceLabel(deps.db, type, id), readPublishing(deps.db, actor, type, id)]),
  );
  if (!status || !pageRow) notFound();
  const info = AGGREGATES[type];
  const facts = pageRow.facts;
  const canRestore = RESTORABLE.has(type) && allowed(actor.permissions, type, "restore", facts) && status.publicationStatus !== "archived";
  const canRollback = allowed(actor.permissions, type, "publish", facts) && status.publicationStatus !== "archived";
  const back = adminPath(type, id);
  const pages = Math.max(1, Math.ceil(history.total / 25));
  return (
    <>
      <PageHeader
        title={`History: ${label}`}
        crumbs={[...(back ? [{ label, href: back }] : [{ label }]), { label: "History" }]}
        lead={<StateLine publication={status.publicationStatus} draft={status.draftStatus} />}
      />
      <section className="adm-card" aria-labelledby="history-title">
        <h2 id="history-title">
          Versions of this {info.one} ({history.total})
        </h2>
        <p className="adm-hint">
          Every save leaves a version; a restore adds a new one and never rewrites the old. {RIYADH_NOTE}
          {RESTORABLE.has(type) ? " Restoring replays the version through the same checks as a save; it never publishes." : ""}
        </p>
        {history.rows.length ? (
          <table className="adm-table is-stack adm-history">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">What</th>
                <th scope="col">Who and when</th>
                <th scope="col">Compare</th>
                <th scope="col">
                  <span className="adm-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.rows.map((r, index) => {
                const previous = history.rows[index + 1];
                const isLive = r.id === status.publishedRevisionId;
                return (
                  <tr key={r.id}>
                    <th scope="row">
                      {r.number}
                      {isLive ? (
                        <>
                          {" "}
                          <span className="adm-badge is-success">Live</span>
                        </>
                      ) : null}
                    </th>
                    <td>
                      {KIND_LABELS[r.kind] ?? r.kind}
                      {r.restoredFromNumber ? ` (from version ${r.restoredFromNumber})` : ""}
                      {r.localesChanged.length ? <span className="adm-muted"> · {r.localesChanged.map((l) => (l === "en" ? "English" : "Arabic")).join(", ")}</span> : null}
                      {r.message ? <p className="adm-hint">{r.message}</p> : null}
                      {r.liveUntil ? <p className="adm-hint">Live until {formatTime(r.liveUntil)}</p> : null}
                    </td>
                    <td>
                      {r.createdByName ?? "Someone"}
                      <br />
                      <span className="adm-muted">{formatTime(r.createdAt)}</span>
                    </td>
                    <td>
                      <span className="adm-actions">
                        {previous ? (
                          <Link className="adm-btn is-small" href={`${historyHref(type, id)}/compare?a=${previous.id}&b=${r.id}`}>
                            With version {previous.number}
                          </Link>
                        ) : null}
                        <Link className="adm-btn is-small" href={`${historyHref(type, id)}/compare?a=${r.id}&b=working`}>
                          With the working copy
                        </Link>
                      </span>
                    </td>
                    <td>
                      <RevisionButtons type={type} id={id} version={status.lockVersion} revision={{ id: r.id, number: r.number, kind: r.kind }} canRestore={canRestore} canRollback={canRollback} legal={facts.pageType === "legal"} live={isLive} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="adm-muted">No version has been saved yet: the first save (or publish) records one.</p>
        )}
        {pages > 1 ? (
          <nav className="adm-actions" aria-label="Pages of versions">
            {page > 1 ? (
              <Link className="adm-btn is-small" href={`${historyHref(type, id)}?page=${page - 1}`}>
                Newer
              </Link>
            ) : null}
            <span className="adm-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="adm-btn is-small" href={`${historyHref(type, id)}?page=${page + 1}`}>
                Older
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}

/** Two versions side by side, field by field, per language. */
export async function CompareScreen({ rawType, rawId, searchParams }: { rawType: string; rawId: string; searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view")) return <Forbidden />;
  const { type, id } = aggregateFrom(rawType, rawId);
  const deps = authDeps();
  const pick = async (value: string): Promise<{ label: string; snapshot: Snapshot } | null> => {
    if (value === "working") {
      const snapshot = await readSnapshot(deps.db, type, id);
      return snapshot ? { label: "Working copy", snapshot: JSON.parse(JSON.stringify(snapshot)) as Snapshot } : null;
    }
    const revision = await readRevision(deps.db, type, id, value);
    return revision ? { label: `Version ${revision.number} (${KIND_LABELS[revision.kind] ?? revision.kind}, ${formatTime(revision.createdAt)})`, snapshot: revision.snapshot } : null;
  };
  const [a, b, label] = await guarded(() => Promise.all([pick(one(searchParams.a)), pick(one(searchParams.b) || "working"), sourceLabel(deps.db, type, id)]));
  if (!a || !b) notFound();
  const changes = diffSnapshots(a.snapshot, b.snapshot);
  const fieldLabel = (ENTITY_TYPES as readonly string[]).includes(type) ? (key: string) => SPECS[type as EntityType].fields.find((f) => f.key === key)?.label : undefined;
  const locales = localesOf(changes);
  const back = adminPath(type, id);
  return (
    <>
      <PageHeader title={`Compare: ${label}`} crumbs={[...(back ? [{ label, href: back }] : [{ label }]), { label: "History", href: historyHref(type, id) }, { label: "Compare" }]} />
      <section className="adm-card" aria-labelledby="compare-title">
        <h2 id="compare-title">
          {a.label} → {b.label}
        </h2>
        <p className="adm-hint">
          {changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"}` : "No difference"}
          {locales.length ? `; languages changed: ${locales.map((l) => (l === "en" ? "English" : "Arabic")).join(", ")}` : ""}.
        </p>
        {changes.length ? (
          <table className="adm-table is-stack adm-history">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Before</th>
                <th scope="col">After</th>
              </tr>
            </thead>
            <tbody>
              {changes.slice(0, 400).map((change, index) => {
                const arabic = change.path.includes("ar");
                return (
                  <tr key={`${change.path.join(".")}:${index}`}>
                    <th scope="row">
                      {changeLabel(change, { before: a.snapshot, after: b.snapshot, fieldLabel })}
                      {change.kind !== "changed" ? <span className="adm-muted"> ({change.kind})</span> : null}
                    </th>
                    <td {...(arabic ? { dir: "rtl", lang: "ar" } : {})} className="adm-pre">
                      {displayValue(change.before)}
                    </td>
                    <td {...(arabic ? { dir: "rtl", lang: "ar" } : {})} className="adm-pre">
                      {displayValue(change.after)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </section>
    </>
  );
}

/** The audit log (Owner, Admin): filters in the address, the search sealed in a cookie. */
export async function AuditScreen({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("audit.view")) return <Forbidden />;
  const deps = authDeps();
  const q = await currentAuditSearch(actor);
  const query = parseAuditQuery(searchParams, q);
  const [result, actors, types] = await guarded(() => Promise.all([listAudit(deps.db, query), auditActors(deps.db), auditEntityTypes(deps.db)]));
  return (
    <>
      <PageHeader title="Audit log" crumbs={[{ label: "Audit log" }]} lead={<span className="adm-muted">{result.total} event{result.total === 1 ? "" : "s"}</span>} />
      <section className="adm-card" aria-labelledby="audit-filter-title">
        <h2 id="audit-filter-title">Find events</h2>
        <form action={searchAuditAction} className="adm-filters" autoComplete="off">
          <div className="adm-field is-wide">
            <label className="adm-label" htmlFor="audit-q">Search summaries, records and people</label>
            <input id="audit-q" className="adm-input" name="q" type="search" maxLength={100} defaultValue={q} autoComplete="off" />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="audit-outcome">Outcome</label>
            <select id="audit-outcome" className="adm-input" name="outcome" defaultValue={query.outcome}>
              <option value="">Any</option>
              {AUDIT_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o === "success" ? "Succeeded" : o === "denied" ? "Denied (no permission)" : "Failed (refused)"}
                </option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="audit-type">Kind of record</label>
            <select id="audit-type" className="adm-input" name="type" defaultValue={query.type}>
              <option value="">Any</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="audit-actor">Who</label>
            <select id="audit-actor" className="adm-input" name="actor" defaultValue={query.actor}>
              <option value="">Anyone</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="audit-from">From (Riyadh date)</label>
            <input id="audit-from" className="adm-input" name="from" type="date" defaultValue={query.from} />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="audit-to">To (Riyadh date)</label>
            <input id="audit-to" className="adm-input" name="to" type="date" defaultValue={query.to} />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="audit-size">Per page</label>
            <select id="audit-size" className="adm-input" name="size" defaultValue={String(query.size)}>
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {query.action ? <input type="hidden" name="action" value={query.action} /> : null}
          {query.entity ? <input type="hidden" name="entity" value={`${query.entity.type}:${query.entity.id}`} /> : null}
          <div className="adm-actions">
            <button type="submit" className="adm-btn is-primary">
              Show events
            </button>
            {q ? (
              <button type="submit" className="adm-btn" formAction={clearAuditSearchAction}>
                Clear search
              </button>
            ) : null}
            {query.entity || query.action ? (
              <Link className="adm-btn" href="/admin/audit">
                Show all records
              </Link>
            ) : null}
          </div>
        </form>
        {query.entity ? <p className="adm-hint">The history of one record ({query.entity.type.replace(/_/g, " ")}).</p> : null}
        <p className="adm-hint">The search is kept for this session only and never appears in the page&apos;s address. {RIYADH_NOTE}</p>
      </section>
      <section className="adm-card" aria-labelledby="audit-list-title">
        <h2 id="audit-list-title">Events</h2>
        {result.rows.length ? (
          <table className="adm-table is-stack adm-history">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">What</th>
                <th scope="col">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const aggregate = row.entityType && isAggregateType(row.entityType) && row.entityId ? adminPath(row.entityType, row.entityId) : null;
                return (
                  <tr key={row.id}>
                    <td>{formatTime(row.occurredAt)}</td>
                    <td>
                      {row.actorLabel ?? (row.actorType === "cli" ? "Server tool" : row.actorType === "system" ? "System" : "Unknown")}
                      {row.actorRoles ? <span className="adm-muted"> · {row.actorRoles}</span> : null}
                    </td>
                    <td>
                      <p>{row.summary}</p>
                      <p className="adm-hint">
                        <code>{row.action}</code>
                        {row.entityType && row.entityId ? (
                          <>
                            {" · "}
                            {aggregate ? <Link href={aggregate}>{row.entityLabel ?? row.entityId}</Link> : <span>{row.entityLabel ?? row.entityType}</span>}
                            {" · "}
                            <Link href={auditAddress({ ...query, entity: { type: row.entityType, id: row.entityId }, page: 1 }, 1)}>this record&apos;s events</Link>
                          </>
                        ) : null}
                      </p>
                      {row.changes || row.ip ? (
                        <details>
                          <summary>Details</summary>
                          {row.ip ? <p className="adm-hint">Address: {row.ip}</p> : null}
                          {row.afterRevisionId && row.entityType && isAggregateType(row.entityType) && row.entityId ? (
                            <p className="adm-hint">
                              <Link href={historyHref(row.entityType, row.entityId)}>Version history</Link>
                            </p>
                          ) : null}
                          {row.changes ? <pre className="adm-pre">{JSON.stringify(row.changes, null, 1).slice(0, 2000)}</pre> : null}
                        </details>
                      ) : null}
                    </td>
                    <td>
                      <span className={`adm-badge ${row.outcome === "success" ? "is-success" : row.outcome === "denied" ? "is-error" : "is-warning"}`}>
                        {row.outcome === "success" ? "Succeeded" : row.outcome === "denied" ? "Denied" : "Failed"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="adm-muted">No event matches.</p>
        )}
        {result.pages > 1 ? (
          <nav className="adm-actions" aria-label="Pages of events">
            {result.page > 1 ? (
              <Link className="adm-btn is-small" href={auditAddress(query, result.page - 1)}>
                Newer
              </Link>
            ) : null}
            <span className="adm-muted">
              Page {result.page} of {result.pages}
            </span>
            {result.page < result.pages ? (
              <Link className="adm-btn is-small" href={auditAddress(query, result.page + 1)}>
                Older
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}
