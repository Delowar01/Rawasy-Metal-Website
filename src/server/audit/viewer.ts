/**
 * The audit log viewer's queries (A8.5, A1-SECURITY-RBAC §11): `audit_events` read for holders of `audit.view` (Owner,
 * Admin), newest first, 25 a page (10–100), filtered by outcome, kind of record, the record itself (its history), who
 * acted, the action and a date range in Riyadh days; a free-text search over the summary, labels and action names that
 * never travels in an address (it is sealed in a cookie: `src/server/admin/audit-search.ts`). Bound parameters only;
 * filters are matched against fixed lists; LIKE wildcards in a search are taken literally.
 *
 * What it shows was written to be shown: summaries and labels carry references, ids, names of records and of people who
 * acted, never a password, token, code, enquiry content, message, note or file name (A2, A7 rules; `redactChanges`).
 * The stored `changes` are passed through `redactChanges` again before display. The table is append-only: nothing
 * here writes, edits or deletes an event.
 */
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { instantOf, rowsOf } from "../cms/store.ts";
import { redactChanges } from "./audit.ts";

export const AUDIT_OUTCOMES = ["success", "denied", "failed"] as const;
/** A kind of record (entity type) as the audit writers name them: a registry key, matched by its grammar. */
const ENTITY_TYPE = /^[a-z][a-z_]{0,31}$/;

export interface AuditQuery {
  q: string;
  outcome: (typeof AUDIT_OUTCOMES)[number] | "";
  type: string;
  entity: { type: string; id: string } | null;
  actor: string;
  action: string;
  from: string;
  to: string;
  page: number;
  size: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const ENTITY_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ACTION = /^[a-z_]{1,32}(\.[a-z_]{1,40})?$/;

const one = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const str = (value: unknown) => (typeof one(value) === "string" ? String(one(value)) : "");

/** Reads the address's filters (never the search) into a bounded query. */
export function parseAuditQuery(params: Record<string, unknown>, q: string): AuditQuery {
  const outcome = str(params.outcome);
  const type = str(params.type);
  const [entityType, entityId] = str(params.entity).split(":");
  const size = Number(str(params.size));
  const page = Number(str(params.page));
  const day = (v: string) => (DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : "");
  return {
    q: [...q].filter((ch) => !(ch.length === 1 && /[\uD800-\uDFFF]/.test(ch))).slice(0, 100).join(""), // code points; lone surrogates dropped
    outcome: (AUDIT_OUTCOMES as readonly string[]).includes(outcome) ? (outcome as AuditQuery["outcome"]) : "",
    type: ENTITY_TYPE.test(type) ? type : "",
    entity: entityType && entityId && ENTITY_TYPE.test(entityType) && ENTITY_ID.test(entityId) ? { type: entityType, id: entityId } : null,
    actor: ULID.test(str(params.actor)) ? str(params.actor) : "",
    action: ACTION.test(str(params.action)) ? str(params.action) : "",
    from: day(str(params.from)),
    to: day(str(params.to)),
    page: Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1,
    size: [10, 25, 50, 100].includes(size) ? size : 25,
  };
}

/** The address of a filtered view (filters only: the search is never in it). */
export function auditAddress(query: AuditQuery, page = query.page): string {
  const p = new URLSearchParams();
  if (query.outcome) p.set("outcome", query.outcome);
  if (query.type) p.set("type", query.type);
  if (query.entity) p.set("entity", `${query.entity.type}:${query.entity.id}`);
  if (query.actor) p.set("actor", query.actor);
  if (query.action) p.set("action", query.action);
  if (query.from) p.set("from", query.from);
  if (query.to) p.set("to", query.to);
  if (query.size !== 25) p.set("size", String(query.size));
  if (page > 1) p.set("page", String(page));
  return `/admin/audit${p.size ? `?${p}` : ""}`;
}

/** A Riyadh day (UTC+3 all year) as its UTC start. */
const riyadhDayStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 3 * 60 * 60 * 1000);

const likeEscaped = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function whereOf(query: AuditQuery): SQL {
  const parts: SQL[] = [sql`1 = 1`];
  if (query.outcome) parts.push(sql`outcome = ${query.outcome}`);
  if (query.type) parts.push(sql`entity_type = ${query.type}`);
  if (query.entity) parts.push(sql`entity_type = ${query.entity.type} AND entity_id = ${query.entity.id}`);
  if (query.actor) parts.push(sql`actor_user_id = ${query.actor}`);
  if (query.action) parts.push(query.action.includes(".") ? sql`action = ${query.action}` : sql`action LIKE ${`${query.action}.%`}`);
  if (query.from) parts.push(sql`occurred_at >= ${riyadhDayStart(query.from)}`);
  if (query.to) parts.push(sql`occurred_at < ${new Date(riyadhDayStart(query.to).getTime() + 24 * 60 * 60 * 1000)}`);
  if (query.q) {
    const like = likeEscaped(query.q);
    parts.push(sql`(summary LIKE ${like} OR entity_label LIKE ${like} OR actor_label LIKE ${like} OR action LIKE ${like})`);
  }
  return sql.join(parts, sql` AND `);
}

export interface AuditRow {
  id: number;
  occurredAt: Date;
  actorType: string;
  actorUserId: string | null;
  actorLabel: string | null;
  actorRoles: string | null;
  ip: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  outcome: "success" | "denied" | "failed";
  summary: string;
  changes: unknown;
  beforeRevisionId: string | null;
  afterRevisionId: string | null;
}

export async function listAudit(db: Db, query: AuditQuery): Promise<{ rows: AuditRow[]; total: number; page: number; pages: number }> {
  const where = whereOf(query);
  const [count] = await rowsOf<{ n: number }>(db, sql`SELECT COUNT(*) AS n FROM audit_events WHERE ${where}`);
  const total = Math.min(Number(count?.n ?? 0), 1_000_000);
  const pages = Math.max(1, Math.ceil(total / query.size));
  const page = Math.min(query.page, pages);
  const rows = await rowsOf<{
    id: number;
    occurred_at: unknown;
    actor_type: string;
    actor_user_id: string | null;
    actor_label: string | null;
    actor_roles: string | null;
    ip: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    entity_label: string | null;
    outcome: AuditRow["outcome"];
    summary: string;
    changes: unknown;
    before_revision_id: string | null;
    after_revision_id: string | null;
  }>(
    db,
    sql`SELECT id, occurred_at, actor_type, actor_user_id, actor_label, actor_roles, ip, action, entity_type, entity_id, entity_label, outcome, summary, changes,
               before_revision_id, after_revision_id
          FROM audit_events WHERE ${where} ORDER BY id DESC LIMIT ${query.size} OFFSET ${(page - 1) * query.size}`,
  );
  return {
    total,
    page,
    pages,
    rows: rows.map((r) => ({
      id: Number(r.id),
      occurredAt: instantOf(r.occurred_at) ?? new Date(0),
      actorType: r.actor_type,
      actorUserId: r.actor_user_id,
      actorLabel: r.actor_label,
      actorRoles: r.actor_roles,
      ip: r.ip,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityLabel: r.entity_label,
      outcome: r.outcome,
      summary: r.summary,
      changes: r.changes === null ? null : redactChanges(typeof r.changes === "string" ? safeJson(r.changes) : r.changes),
      beforeRevisionId: r.before_revision_id,
      afterRevisionId: r.after_revision_id,
    })),
  };
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** The kinds of record the log holds events about (the "kind" filter's choices). */
export async function auditEntityTypes(db: Db): Promise<string[]> {
  const rows = await rowsOf<{ entity_type: string }>(db, sql`SELECT DISTINCT entity_type FROM audit_events WHERE entity_type IS NOT NULL ORDER BY entity_type LIMIT 100`);
  return rows.map((r) => r.entity_type).filter((t) => ENTITY_TYPE.test(t));
}

/** People who appear as actors (the "who" filter), by display name. */
export async function auditActors(db: Db): Promise<{ id: string; name: string }[]> {
  const rows = await rowsOf<{ id: string; display_name: string }>(db, sql`SELECT id, display_name FROM users WHERE deleted_at IS NULL ORDER BY display_name, id LIMIT 500`);
  return rows.map((r) => ({ id: r.id, name: r.display_name }));
}
