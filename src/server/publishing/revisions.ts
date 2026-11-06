/**
 * The revision engine (A8.1, A1-PUBLISHING-VERSIONS §1, §10): immutable snapshots of whole aggregates, written in the
 * transaction that changed them, numbered 1, 2, 3 … per aggregate. A revision is never edited: a restore writes a new
 * revision (kind `restore`, `restored_from_id`), a publish writes a sealed `publish` revision with `live_from`, and the
 * previous live version gets `live_until`. `save` revisions are unsealed (a later pruning policy, an Owner decision, may
 * remove old ones); every other kind is sealed.
 *
 * `closeRevisions` runs at the end of every content transaction (`contentTransaction`): for each aggregate root the
 * change locked and moved to a new version, one revision of the kind the service asked for (default `save`); a save
 * whose snapshot equals the latest revision's writes nothing (a version bump that changed no content).
 */
import { sql } from "drizzle-orm";
import type { Actor } from "../auth/types.ts";
import type { Db } from "../db/client.ts";
import { revisions } from "../db/schema-cms.ts";
import { ulid } from "../security/ids.ts";
import { instantOf, rowsOf } from "../cms/store.ts";
import { intentOf, markRecorded, type ChangeStore, type RevisionIntentKind } from "../cms/changes.ts";
import { ENTITIES, type EntityType } from "../cms/registry.ts";
import { AGGREGATES, CONTENT_AGGREGATES, PUBLISHING_LIMITS, SNAPSHOT_SCHEMA_VERSION, type AggregateType } from "./registry.ts";
import { canonical, canonicalJson, readSnapshot, sha256, type Snapshot } from "./snapshot.ts";
import { diffSnapshots, localesOf } from "./compare.ts";
import { referencesOfSnapshot, writeReferences } from "./references.ts";

/** Each aggregate's root table and key column (fixed names, never from input). */
export const ROOTS: Readonly<Record<AggregateType, { table: string; key: string; softDelete: boolean }>> = {
  ...(Object.fromEntries(CONTENT_AGGREGATES.map((t) => [t, { table: ENTITIES[t as EntityType].table, key: "id", softDelete: true }])) as Record<EntityType, { table: string; key: string; softDelete: boolean }>),
  reusable_section: { table: "reusable_sections", key: "id", softDelete: true },
  ordering: { table: "entity_orderings", key: "key", softDelete: false },
  menu: { table: "menus", key: "key", softDelete: false },
  site_settings: { table: "site_settings", key: "id", softDelete: false },
  form: { table: "forms", key: "id", softDelete: false },
};

const rootTable = (type: AggregateType) => sql.identifier(ROOTS[type].table);
const rootKey = (type: AggregateType) => sql.identifier(ROOTS[type].key);

export interface RootStatus {
  lockVersion: number;
  publicationStatus: "unpublished" | "published" | "archived";
  draftStatus: "none" | "draft" | "in_review";
  publishedRevisionId: string | null;
  currentRevisionId: string | null;
}

/** The root's publication columns (as this transaction sees them; `lock`: FOR UPDATE). */
export async function readRootStatus(db: Db, type: AggregateType, id: string, options: { lock?: boolean } = {}): Promise<RootStatus | null> {
  const lock = options.lock ? sql` FOR UPDATE` : sql``;
  const softDelete = ROOTS[type].softDelete ? sql` AND deleted_at IS NULL` : sql``;
  const [row] = await rowsOf<{ lock_version: number; publication_status: RootStatus["publicationStatus"]; draft_status: RootStatus["draftStatus"]; published_revision_id: string | null; current_revision_id: string | null }>(
    db,
    sql`SELECT lock_version, publication_status, draft_status, published_revision_id, current_revision_id FROM ${rootTable(type)} WHERE ${rootKey(type)} = ${id}${softDelete}${lock}`,
  );
  if (!row) return null;
  return {
    lockVersion: Number(row.lock_version),
    publicationStatus: row.publication_status,
    draftStatus: row.draft_status,
    publishedRevisionId: row.published_revision_id,
    currentRevisionId: row.current_revision_id,
  };
}

export interface LatestRevision {
  id: string;
  number: number;
  kind: RevisionIntentKind | "import";
  sha: Buffer;
  snapshot: Snapshot;
}

/**
 * The newest revision of an aggregate, through its root's `current_revision_id` (the root is locked FOR UPDATE by the
 * change, so its writers are serialized). Never a locking range scan of `revisions`: for an aggregate without a revision
 * yet it took a gap lock that two concurrent creates both held and then both inserted into — a deadlock (A8 review L3).
 */
export async function latestRevision(db: Db, type: AggregateType, id: string): Promise<LatestRevision | null> {
  const [root] = await rowsOf<{ current_revision_id: string | null }>(db, sql`SELECT current_revision_id FROM ${rootTable(type)} WHERE ${rootKey(type)} = ${id} FOR UPDATE`);
  if (!root?.current_revision_id) return null;
  const [row] = await rowsOf<{ id: string; revision_number: number; kind: LatestRevision["kind"]; snapshot_sha256: Buffer; snapshot: unknown }>(
    db,
    sql`SELECT id, revision_number, kind, snapshot_sha256, snapshot FROM revisions WHERE id = ${root.current_revision_id} AND entity_type = ${type} AND entity_id = ${id} LOCK IN SHARE MODE`,
  );
  if (!row) return null;
  return { id: row.id, number: Number(row.revision_number), kind: row.kind, sha: Buffer.from(row.snapshot_sha256), snapshot: jsonOf(row.snapshot) as Snapshot };
}

const jsonOf = (value: unknown): unknown => (typeof value === "string" ? JSON.parse(value) : value);

export interface WriteRevision {
  type: AggregateType;
  id: string;
  kind: RevisionIntentKind;
  actorId: string;
  now: Date;
  restoredFromId?: string | null;
  message?: string | null;
  /** A save that changed nothing is skipped; any other kind is always written (a submit, a publish…). */
  force?: boolean;
  /** Created in this transaction: it has no reference rows yet. */
  created?: boolean;
}

export interface WrittenRevision {
  id: string;
  number: number;
  snapshot: Snapshot;
  sha: Buffer;
  baseId: string | null;
}

/**
 * Writes one revision of the aggregate's current working copy (read in this transaction). Returns null for a save that
 * changed nothing, or when the aggregate no longer exists.
 */
export async function writeRevision(tx: Db, input: WriteRevision): Promise<WrittenRevision | null> {
  const snapshot = await readSnapshot(tx, input.type, input.id);
  if (!snapshot) return null;
  const json = canonicalJson(snapshot);
  const sha = sha256(json);
  const latest = await latestRevision(tx, input.type, input.id);
  if (input.kind === "save" && !input.force && latest && latest.sha.equals(sha)) return null;
  const changed = latest ? localesOf(diffSnapshots(latest.snapshot, canonical(snapshot) as Snapshot)) : ["en", "ar"];
  const id = ulid(input.now.getTime());
  const number = (latest?.number ?? 0) + 1;
  await tx.insert(revisions).values({
    id,
    entityType: input.type,
    entityId: input.id,
    revisionNumber: number,
    kind: input.kind,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshot: canonical(snapshot),
    snapshotSha256: sha,
    baseRevisionId: latest?.id ?? null,
    restoredFromId: input.restoredFromId ?? null,
    message: input.message ? input.message.slice(0, PUBLISHING_LIMITS.message) : null,
    localesChanged: changed.length ? changed.join(",") : null,
    liveFrom: input.kind === "publish" ? input.now : null,
    isSealed: input.kind !== "save",
    createdAt: input.now,
    createdBy: input.actorId,
  });
  await tx.execute(sql`UPDATE ${rootTable(input.type)} SET current_revision_id = ${id} WHERE ${rootKey(input.type)} = ${input.id}`);
  // A1: the working copy's references are rebuilt with every save, in the same transaction. The rows are the previous
  // revision's references (or none for a new aggregate), so unchanged or empty sets take no range lock (review L3).
  const previous = latest ? referencesOfSnapshot(input.type, latest.snapshot) : input.created ? [] : undefined;
  await writeReferences(tx, input.type, input.id, "working", referencesOfSnapshot(input.type, canonical(snapshot) as Snapshot), previous);
  return { id, number, snapshot: canonical(snapshot) as Snapshot, sha, baseId: latest?.id ?? null };
}

/**
 * The end of a content transaction: a revision for every aggregate whose version this change moved, unless the service
 * already wrote one at that version. A save of a published or reviewed aggregate puts it back in draft (A1 T2: an edit
 * withdraws a submission; the live version stays live until someone publishes).
 */
export async function closeRevisions(tx: Db, store: ChangeStore, actor: Actor): Promise<void> {
  for (const noted of store.noted.values()) {
    const status = await readRootStatus(tx, noted.type, noted.id);
    if (!status || status.lockVersion === noted.version || noted.recordedAt === status.lockVersion) continue;
    const intent = intentOf(store, noted.type, noted.id);
    const written = await writeRevision(tx, {
      type: noted.type,
      id: noted.id,
      kind: intent.kind,
      actorId: actor.user.id,
      now: store.now,
      restoredFromId: intent.restoredFromId,
      message: intent.message,
      force: intent.kind !== "save",
      created: noted.version === -1,
    });
    if (written && (intent.kind === "save" || intent.kind === "restore") && status.publicationStatus !== "archived") {
      const draft = intent.draft ?? "draft";
      if (status.draftStatus !== draft) await tx.execute(sql`UPDATE ${rootTable(noted.type)} SET draft_status = ${draft} WHERE ${rootKey(noted.type)} = ${noted.id}`);
    }
    markRecorded(tx, noted.type, noted.id, status.lockVersion);
  }
}

// --- Reading history ----------------------------------------------------------------------------------------------------

export interface RevisionRow {
  id: string;
  number: number;
  kind: string;
  createdAt: Date;
  createdBy: string | null;
  createdByName: string | null;
  message: string | null;
  localesChanged: string[];
  liveFrom: Date | null;
  liveUntil: Date | null;
  restoredFromId: string | null;
  restoredFromNumber: number | null;
  isSealed: boolean;
}

/** An aggregate's history, newest first (25 a page). */
export async function listRevisions(db: Db, type: AggregateType, id: string, page = 1): Promise<{ rows: RevisionRow[]; total: number }> {
  const size = PUBLISHING_LIMITS.historyPage;
  const offset = (Math.max(1, Math.min(page, 10_000)) - 1) * size;
  const [count] = await rowsOf<{ n: number }>(db, sql`SELECT COUNT(*) AS n FROM revisions WHERE entity_type = ${type} AND entity_id = ${id}`);
  const rows = await rowsOf<{
    id: string;
    revision_number: number;
    kind: string;
    created_at: unknown;
    created_by: string | null;
    display_name: string | null;
    message: string | null;
    locales_changed: string | null;
    live_from: unknown;
    live_until: unknown;
    restored_from_id: string | null;
    restored_number: number | null;
    is_sealed: number;
  }>(
    db,
    sql`SELECT r.id, r.revision_number, r.kind, r.created_at, r.created_by, u.display_name, r.message, r.locales_changed, r.live_from, r.live_until,
               r.restored_from_id, src.revision_number AS restored_number, r.is_sealed
          FROM revisions r
          LEFT JOIN users u ON u.id = r.created_by
          LEFT JOIN revisions src ON src.id = r.restored_from_id
         WHERE r.entity_type = ${type} AND r.entity_id = ${id}
         ORDER BY r.revision_number DESC
         LIMIT ${size} OFFSET ${offset}`,
  );
  return {
    total: Number(count?.n ?? 0),
    rows: rows.map((r) => ({
      id: r.id,
      number: Number(r.revision_number),
      kind: r.kind,
      createdAt: instantOf(r.created_at) ?? new Date(0),
      createdBy: r.created_by,
      createdByName: r.display_name,
      message: r.message,
      localesChanged: r.locales_changed ? r.locales_changed.split(",") : [],
      liveFrom: instantOf(r.live_from),
      liveUntil: instantOf(r.live_until),
      restoredFromId: r.restored_from_id,
      restoredFromNumber: r.restored_number === null ? null : Number(r.restored_number),
      isSealed: Boolean(r.is_sealed),
    })),
  };
}

export interface StoredRevision {
  id: string;
  number: number;
  kind: string;
  schemaVersion: number;
  snapshot: Snapshot;
  createdAt: Date;
  createdBy: string | null;
  message: string | null;
}

/** One revision of this aggregate (never another aggregate's, whatever id is asked for); `lock`: share lock. */
export async function readRevision(db: Db, type: AggregateType, id: string, revisionId: string, options: { lock?: boolean } = {}): Promise<StoredRevision | null> {
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(revisionId)) return null;
  const lock = options.lock ? sql` LOCK IN SHARE MODE` : sql``;
  const [row] = await rowsOf<{ id: string; revision_number: number; kind: string; schema_version: number; snapshot: unknown; created_at: unknown; created_by: string | null; message: string | null }>(
    db,
    sql`SELECT id, revision_number, kind, schema_version, snapshot, created_at, created_by, message FROM revisions
         WHERE id = ${revisionId} AND entity_type = ${type} AND entity_id = ${id}${lock}`,
  );
  if (!row) return null;
  return {
    id: row.id,
    number: Number(row.revision_number),
    kind: row.kind,
    schemaVersion: Number(row.schema_version),
    snapshot: upcast(Number(row.schema_version), jsonOf(row.snapshot) as Snapshot),
    createdAt: instantOf(row.created_at) ?? new Date(0),
    createdBy: row.created_by,
    message: row.message,
  };
}

/**
 * Reads an older snapshot shape as the current one (A1 §10: upcasters, step by step). Version 1 is the only shape; a
 * newer one than this code knows is refused (never guessed).
 */
export function upcast(version: number, snapshot: Snapshot): Snapshot {
  if (version === SNAPSHOT_SCHEMA_VERSION) return snapshot;
  throw new RangeError(`Snapshot version ${version} is not readable by this code (it reads ${SNAPSHOT_SCHEMA_VERSION}).`);
}

/** Who submitted the version now in review: the author of the newest `submit` revision after the last publish. */
export async function submitterOf(db: Db, type: AggregateType, id: string): Promise<string | null> {
  const [row] = await rowsOf<{ created_by: string | null; kind: string }>(
    db,
    sql`SELECT created_by, kind FROM revisions WHERE entity_type = ${type} AND entity_id = ${id} AND kind IN ('submit', 'publish', 'unpublish', 'archive')
         ORDER BY revision_number DESC LIMIT 1`,
  );
  return row?.kind === "submit" ? row.created_by : null;
}

export const aggregateLabel = (type: AggregateType) => AGGREGATES[type].one;
