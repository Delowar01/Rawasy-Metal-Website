/**
 * Database building blocks of the Core CMS (A3), shared by every content type: the change transaction (which starts by
 * proving the acting user is still active and the acting session still live — A2's invariant), the root's lock and
 * version, the collections' orderings, ordered relations, the admin search index and the content audit events.
 *
 * Table and column names in the raw statements come from the code registry (`registry.ts`), never from input; values
 * are always bound parameters.
 */
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AnyMySqlColumn, AnyMySqlTable } from "drizzle-orm/mysql-core";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { recordAudit, type AuditOutcome } from "../audit/audit.ts";
import { lockActor } from "../auth/sessions.ts";
import { auditActorOf, type Actor, type RequestMeta } from "../auth/types.ts";
import { inTransaction, type Db } from "../db/client.ts";
import { dbErrorInfo } from "../db/pool.ts";
import { currentStore, noteLocked, runWithStore, setIntent, type ChangeStore } from "./changes.ts";
import { entityOrderingItems, entityOrderings, searchDocuments } from "../db/schema-cms.ts";
import { ENTITIES, LOCALES, type EntityInfo, type EntityType, type Locale, type OrderingKey } from "./registry.ts";
import { planMove, type MoveDirection } from "./reorder.ts";
import { normalizeForSearch } from "./text.ts";

export interface CmsDeps {
  pool: Pool;
  db: Db;
  clock: () => Date;
}

/** Field name (as the form names it) → message. */
export type FieldErrors = Record<string, string>;

export type SaveResult =
  | { kind: "ok"; id: string; lockVersion: number; summary: string }
  | { kind: "invalid"; errors: FieldErrors }
  | { kind: "stale" }
  | { kind: "not_found" }
  | { kind: "archived" }
  | { kind: "denied"; message: string };

/** Rows of a raw SELECT (mysql2 returns [rows, fields] through Drizzle's execute). */
export async function rowsOf<T>(db: Db, query: SQL): Promise<T[]> {
  const [rows] = (await db.execute(query)) as unknown as [RowDataPacket[]];
  return rows as T[];
}

/**
 * A DATETIME of a raw query as an instant. Drizzle's mysql2 session reads DATETIME columns as text (it maps them itself
 * for its own selects), so raw rows hold "YYYY-MM-DD HH:MM:SS.fff" in UTC (every connection runs at UTC).
 */
/** A DATE column's value as 'YYYY-MM-DD' (mysql2 gives a Date at UTC midnight on these connections, raw SQL a string). */
export function dateOnly(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

export function instantOf(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(value)) return null;
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function affected(db: Db, query: SQL): Promise<number> {
  const [result] = (await db.execute(query)) as unknown as [ResultSetHeader];
  return result.affectedRows;
}

const table = (info: EntityInfo) => sql.identifier(info.table);

/**
 * A content change: one transaction that first locks the acting user's row (still active) and the acting session (still
 * live) — a sign-out, a disabled account or a role change (which signs the user out) that commits first makes the
 * change fail with SessionEndedError instead of landing under an authority that is gone.
 *
 * Lock order everywhere (A3; A3 Correction 1):
 * 1. the acting user's row, then the acting session (`lockActor`);
 * 2. the item's root row, FOR UPDATE (`lockRoot`; an archive or restore, a save, a flag change);
 * 3. what the change links anew — a newly chosen reference, then each relation's newly added targets in the type's
 *    relation order — share-locked (`checkReference`, `targetStates(…, { lock: true })`);
 * 4. the cross-record pairs a relation's rule depends on, share-locked (`LOCK IN SHARE MODE`): a service's featured
 *    projects → their project_services rows; a project's removed services → their service_featured_projects rows;
 * 5. the item's own rows (translations, relation rows, children, search rows, audit) and then its collection's ordering.
 * InnoDB's foreign-key checks share-lock the target's root row for every relation row inserted, so a project's root row
 * (step 2 of its own save) is also the mutex of every (service, project) pair: no service can add a featured project
 * while that project's save holds it. Two saves of related items can still meet in opposite orders (each holds its own
 * root and wants the other's); InnoDB then ends one with a deadlock error, rolls it back whole, and `inTransaction`
 * retries it once — every attempt decides on locking reads, so the invariants hold whichever commits.
 */
export function contentTransaction<T>(deps: CmsDeps, actor: Actor, work: (tx: Db, now: Date) => Promise<T>): Promise<T> {
  // Re-entrant (A8): a service called inside an open content transaction of the same user joins it (a revision restore
  // replays a record's save and its layout's save as one change), instead of opening a connection that would wait on
  // this one's locks. The outer transaction already holds the actor's rows.
  const open = currentStore();
  if (open && open.actorId === actor.user.id) return work(open.tx as Db, open.now);
  const now = deps.clock();
  return inTransaction(deps.pool, async (tx) => {
    const store: ChangeStore = { tx, now, actorId: actor.user.id, noted: new Map(), intents: new Map() };
    return runWithStore(store, async () => {
      await lockActor(tx, actor, now);
      const result = await work(tx, now);
      // A8.1: one revision for every aggregate root this change moved (A1-PUBLISHING-VERSIONS §1, T2). Loaded on use,
      // after every module is evaluated (the revision engine reads the CMS kinds, which import this module).
      if (store.noted.size) {
        const { closeRevisions } = await import("../publishing/revisions.ts");
        await closeRevisions(tx, store, actor);
      }
      // The cache record is the last write of every change (A8 review L3).
      if (store.invalidations?.tags.size) {
        const { recordInvalidations } = await import("../publishing/cache.ts");
        await recordInvalidations(tx, [...store.invalidations.tags], store.invalidations.requestId, now);
      }
      return result;
    });
  });
}

export interface RootState {
  id: string;
  slug: string | null;
  lockVersion: number;
  publicationStatus: "unpublished" | "published" | "archived";
  draftStatus: "none" | "draft" | "in_review";
}

/** Locks an item's root row (FOR UPDATE); null when it does not exist or is in the Trash. */
export async function lockRoot(tx: Db, type: EntityType, id: string): Promise<RootState | null> {
  const [row] = await rowsOf<{ id: string; slug: string | null; lock_version: number; publication_status: RootState["publicationStatus"]; draft_status: RootState["draftStatus"] }>(
    tx,
    sql`SELECT id, slug, lock_version, publication_status, draft_status FROM ${table(ENTITIES[type])} WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`,
  );
  if (!row) return null;
  noteLocked(tx, type, id, Number(row.lock_version));
  return { id: row.id, slug: row.slug, lockVersion: Number(row.lock_version), publicationStatus: row.publication_status, draftStatus: row.draft_status };
}

/** The root's new version after a change: lock_version + 1, updated at/by. */
export async function bumpRoot(tx: Db, type: EntityType, id: string, actorId: string, now: Date): Promise<void> {
  await tx.execute(sql`UPDATE ${table(ENTITIES[type])} SET lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actorId} WHERE id = ${id}`);
}

/** Archive or restore (A1 T12 / T13): archived · none, or back to unpublished · draft. */
export async function setArchived(tx: Db, type: EntityType, id: string, archived: boolean, actorId: string, now: Date): Promise<void> {
  const t = table(ENTITIES[type]);
  if (archived) {
    // A8 (A1 T12): an archived item has no live version; the archive revision is written as the transaction closes.
    setIntent(tx, type, id, { kind: "archive" });
    const { takeOffline } = await import("../publishing/offline.ts");
    await takeOffline(tx, type, id, now);
  }
  await tx.execute(
    archived
      ? sql`UPDATE ${t} SET publication_status = 'archived', draft_status = 'none', published_revision_id = NULL, archived_at = ${now}, archived_by = ${actorId}, lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actorId} WHERE id = ${id}`
      : sql`UPDATE ${t} SET publication_status = 'unpublished', draft_status = 'draft', archived_at = NULL, archived_by = NULL, lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actorId} WHERE id = ${id}`,
  );
}

/** Whether another item of the same type already uses the slug (archived and trashed items keep theirs: A1 §3.7). */
export async function slugTaken(db: Db, type: EntityType, slug: string, exceptId: string | null): Promise<boolean> {
  const rows = await rowsOf<{ id: string }>(db, sql`SELECT id FROM ${table(ENTITIES[type])} WHERE slug = ${slug} LIMIT 1`);
  return rows.length > 0 && rows[0].id !== exceptId;
}

/** The unique index a duplicate-entry error names (an identifier only; the message itself is never shown or logged). */
export function duplicateKey(error: unknown): string | null {
  if (dbErrorInfo(error).errno !== 1062) return null;
  for (let current = error, depth = 0; current && typeof current === "object" && depth < 4; depth++) {
    const message = (current as { sqlMessage?: unknown }).sqlMessage;
    if (typeof message === "string") return /for key '(?:[A-Za-z0-9_]+\.)?([A-Za-z0-9_]+)'/.exec(message)?.[1] ?? "unknown";
    current = (current as { cause?: unknown }).cause;
  }
  return "unknown";
}

// --- Orderings --------------------------------------------------------------------------------------------------------

export async function lockOrdering(tx: Db, key: OrderingKey): Promise<{ lockVersion: number } | null> {
  const [row] = await tx.select({ lockVersion: entityOrderings.lockVersion }).from(entityOrderings).where(eq(entityOrderings.key, key)).for("update");
  if (row) noteLocked(tx, "ordering", key, Number(row.lockVersion));
  return row ? { lockVersion: Number(row.lockVersion) } : null;
}

/** A new version of a collection's order: any page that showed the order before this change is stale. */
export const touchOrdering = (tx: Db, key: OrderingKey, actorId: string, now: Date) =>
  tx
    .update(entityOrderings)
    .set({ lockVersion: sql`${entityOrderings.lockVersion} + 1`, updatedAt: now, updatedBy: actorId })
    .where(eq(entityOrderings.key, key));

/** Adds a new item at the end of its collection's order (the ordering's version moves on). */
export async function appendToOrdering(tx: Db, key: OrderingKey, entityId: string, actorId: string, now: Date): Promise<number> {
  const ordering = await lockOrdering(tx, key);
  if (!ordering) throw new Error(`The ordering ${key} is missing (seed migration 0003).`);
  // A locking read: the latest committed position. A plain read would answer from this transaction's snapshot, which
  // can predate another create that held the ordering's lock first (both then took the same position: A3 review, 4).
  const [last] = await rowsOf<{ max: number | null }>(tx, sql`SELECT MAX(position) AS max FROM entity_ordering_items WHERE ordering_key = ${key} FOR UPDATE`);
  const position = Number(last?.max ?? 0) + 1;
  await tx.insert(entityOrderingItems).values({ orderingKey: key, entityId, position });
  await touchOrdering(tx, key, actorId, now);
  return position;
}

export interface OrderEntry {
  id: string;
  position: number;
  active: boolean;
}

/** A collection's order with each item's state (archived items keep their place). */
export async function readOrder(db: Db, key: OrderingKey, type: EntityType): Promise<OrderEntry[]> {
  const rows = await rowsOf<{ id: string; position: number; active: number }>(
    db,
    sql`SELECT i.entity_id AS id, i.position, (r.publication_status <> 'archived') AS active
          FROM entity_ordering_items i JOIN ${table(ENTITIES[type])} r ON r.id = i.entity_id
         WHERE i.ordering_key = ${key} AND r.deleted_at IS NULL ORDER BY i.position`,
  );
  return rows.map((r) => ({ id: r.id, position: Number(r.position), active: Boolean(Number(r.active)) }));
}

export type MoveResult = { kind: "moved"; lockVersion: number; otherId: string } | { kind: "edge" } | { kind: "stale" } | { kind: "missing" };

/**
 * Moves an item one place up or down among the active items of its collection, decided on the order the page showed
 * (`expectedVersion`, the ordering's version): under the ordering's lock, a stale page changes nothing. The two items
 * exchange positions through a free position (0), so the unique (ordering, position) index never sees two at once.
 */
export async function moveInOrdering(
  tx: Db,
  key: OrderingKey,
  type: EntityType,
  entityId: string,
  direction: MoveDirection,
  expectedVersion: number,
  actorId: string,
  now: Date,
): Promise<MoveResult> {
  const ordering = await lockOrdering(tx, key);
  if (!ordering) return { kind: "missing" };
  if (ordering.lockVersion !== expectedVersion) return { kind: "stale" };
  const plan = planMove(await readOrder(tx, key, type), entityId, direction);
  if (plan.kind !== "swap") return plan.kind === "edge" ? { kind: "edge" } : { kind: "missing" };
  const at = (id: string, position: number) =>
    tx.update(entityOrderingItems).set({ position }).where(and(eq(entityOrderingItems.orderingKey, key), eq(entityOrderingItems.entityId, id)));
  await at(plan.a.id, 0);
  await at(plan.b.id, plan.a.position);
  await at(plan.a.id, plan.b.position);
  await touchOrdering(tx, key, actorId, now);
  return { kind: "moved", lockVersion: ordering.lockVersion + 1, otherId: plan.b.id };
}

export async function orderingVersion(db: Db, key: OrderingKey): Promise<number> {
  const [row] = await db.select({ lockVersion: entityOrderings.lockVersion }).from(entityOrderings).where(eq(entityOrderings.key, key));
  return Number(row?.lockVersion ?? 0);
}

// --- Ordered relations --------------------------------------------------------------------------------------------------

export interface RelationTable {
  table: AnyMySqlTable;
  owner: AnyMySqlColumn;
  target: AnyMySqlColumn;
  position: AnyMySqlColumn;
  /** A row for (owner, target, position) in the table's own property names. */
  row: (ownerId: string, targetId: string, position: number) => Record<string, unknown>;
}

/** The targets of an item's relation, in order. */
export async function readRelation(db: Db, relation: RelationTable, ownerId: string): Promise<string[]> {
  const rows = (await db
    .select({ target: relation.target })
    .from(relation.table)
    .where(eq(relation.owner, ownerId))
    .orderBy(asc(relation.position))) as { target: string }[];
  return rows.map((r) => r.target);
}

/**
 * Sets an item's relation to the given ordered targets (positions 1, 2, 3 …), written as a diff (A8.7, the A3/A4
 * hardening offered to the Owner): rows of targets that stay keep their row and only change position; only removed
 * targets are deleted and only added ones inserted. Before, every row was deleted and inserted again, so InnoDB's
 * foreign-key check share-locked every target's root late in the save — a project save and a service save that named
 * each other then waited on each other's roots and deadlocked whenever they overlapped (settled by one retry). Now a
 * save locks only the targets it adds (they are share-locked first anyway: `targetStates(…, { lock: true })`).
 * The item's own rows are read FOR UPDATE (its root lock is held already, so nobody else writes them).
 */
export async function replaceRelation(tx: Db, relation: RelationTable, ownerId: string, targetIds: readonly string[]): Promise<void> {
  const rows = (await tx
    .select({ target: relation.target, position: relation.position })
    .from(relation.table)
    .where(eq(relation.owner, ownerId))
    .for("update")) as { target: string; position: number }[];
  const before = new Map(rows.map((r) => [r.target, Number(r.position)]));
  const next = new Map(targetIds.map((id, i) => [id, i + 1]));
  const removed = [...before.keys()].filter((id) => !next.has(id));
  if (removed.length) await tx.delete(relation.table).where(and(eq(relation.owner, ownerId), inArray(relation.target, removed)));
  for (const [id, position] of next) {
    const was = before.get(id);
    if (was !== undefined && was !== position) {
      await tx
        .update(relation.table)
        .set({ [relationKey(relation, "position")]: position } as never)
        .where(and(eq(relation.owner, ownerId), eq(relation.target, id)));
    }
  }
  const added = targetIds.filter((id) => !before.has(id));
  if (added.length) {
    // The table is chosen from code (a fixed relation); Drizzle's insert typing cannot follow a table chosen at run time.
    await tx.insert(relation.table).values(added.map((id) => relation.row(ownerId, id, next.get(id)!)) as never);
  }
}

/** The table's own property name of one of a relation's columns (from its row builder). */
function relationKey(relation: RelationTable, column: "position"): string {
  const sample = relation.row("o", "t", 7);
  const key = Object.keys(sample).find((k) => sample[k] === 7);
  if (!key) throw new Error(`The relation has no ${column} property.`);
  return key;
}

/**
 * The state of candidate targets: which exist (not in the Trash) and which are archived. With `lock`, a locking read
 * (shared lock) of the latest committed rows: a target being archived at the same moment is then either seen archived,
 * or kept from being archived until this change commits — never linked anew while it is archived (A3 security review,
 * finding 3). A plain read would answer from the transaction's snapshot, which can predate that archive.
 */
export async function targetStates(db: Db, type: EntityType, ids: readonly string[], options: { lock?: boolean } = {}): Promise<Map<string, { archived: boolean }>> {
  if (ids.length === 0) return new Map();
  const rows = await rowsOf<{ id: string; archived: number }>(
    db,
    sql`SELECT id, (publication_status = 'archived') AS archived FROM ${table(ENTITIES[type])}
         WHERE deleted_at IS NULL AND id IN (${sql.join(
           ids.map((id) => sql`${id}`),
           sql`, `,
         )})${options.lock ? sql` LOCK IN SHARE MODE` : sql``}`,
  );
  return new Map(rows.map((r) => [r.id, { archived: Boolean(Number(r.archived)) }]));
}

/**
 * Checks a relation's new targets (A3 brief §32): each exists (never a target in the Trash), appears once, and — when it
 * was not linked before — is active (an archived item may stay linked, but is not linked anew). Returns a message or null.
 */
export async function checkTargets(
  db: Db,
  type: EntityType,
  next: readonly string[],
  before: readonly string[],
  options: { max: number; self?: string },
): Promise<string | null> {
  if (new Set(next).size !== next.length) return "An item is listed twice.";
  if (next.length > options.max) return `Choose at most ${options.max}.`;
  if (options.self && next.includes(options.self)) return "An item can't be related to itself.";
  // Targets newly linked by this change are read with a share lock (they must be active now); kept ones may be archived.
  const added = next.filter((id) => !before.includes(id));
  const states = new Map([...(await targetStates(db, type, next.filter((id) => before.includes(id)))), ...(await targetStates(db, type, added, { lock: true }))]);
  for (const id of next) {
    const state = states.get(id);
    if (!state) return "A chosen item no longer exists. Reload the page.";
    if (state.archived && !before.includes(id)) return "Archived items can stay linked, but can't be added again. Restore the item first.";
  }
  return null;
}

// --- Search index (A1 `search_documents`, working scope) -------------------------------------------------------------

export interface SearchEntry {
  locale: Locale;
  title: string;
  body: string;
}

/** Rewrites an item's working-scope search rows (one per language that has text). */
export async function rebuildSearch(tx: Db, type: EntityType, id: string, entries: readonly SearchEntry[], now: Date): Promise<void> {
  await tx.delete(searchDocuments).where(and(eq(searchDocuments.entityType, type), eq(searchDocuments.entityId, id), eq(searchDocuments.scope, "working")));
  const rows = entries
    .filter((e) => LOCALES.includes(e.locale))
    .map((e) => ({
      entityType: type,
      entityId: id,
      locale: e.locale,
      scope: "working" as const,
      title: [...normalizeForSearch(e.title)].slice(0, 255).join(""),
      body: [...normalizeForSearch(e.body)].slice(0, 20_000).join(""),
      updatedAt: now,
    }));
  if (rows.length) await tx.insert(searchDocuments).values(rows);
}

// --- Audit -------------------------------------------------------------------------------------------------------------

export interface ContentEvent {
  action: string;
  type: EntityType | "ordering";
  id: string;
  label?: string | null;
  outcome?: AuditOutcome;
  summary: string;
  changes?: Record<string, unknown>;
}

/** A content audit event (A1-SECURITY-RBAC §11): who, what, which item — never the item's long texts. */
export async function contentAudit(db: Db, actor: Actor, meta: RequestMeta, at: Date, event: ContentEvent): Promise<void> {
  await recordAudit(db, {
    at,
    requestId: meta.requestId,
    actor: auditActorOf(actor),
    ip: meta.ip,
    action: event.action,
    entity: { type: event.type, id: event.id, label: event.label ? event.label.slice(0, 120) : null },
    outcome: event.outcome ?? "success",
    summary: event.summary,
    changes: event.changes,
  });
}

/** A short label for summaries: “Title” (slug), at most 80 characters of the title. */
export const labelOf = (title: string | null | undefined, slug: string | null | undefined) => {
  const t = (title ?? "").trim();
  const clipped = [...t].length > 80 ? `${[...t].slice(0, 79).join("")}…` : t;
  return clipped ? `“${clipped}”${slug ? ` (${slug})` : ""}` : slug ? `(${slug})` : "(untitled)";
};
