/**
 * The media library's list, search and counts (A4 brief §37, §63, §64): server-side, state in the address, bound
 * parameters only, fixed column names. A person who may not know private items exist never sees one — not in the list,
 * the search, a count or a filter (the visibility condition is added in SQL, whatever the address says).
 *
 * Search: the item's titles, alt texts, captions, current file name and legacy key per language (the A3 search rows,
 * Arabic-normalized like A3's), its folder's name, and flag or status names typed as words ("restricted", "ai").
 */
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rowsOf } from "../cms/store.ts";
import { likePattern, normalizeForSearch } from "../cms/text.ts";
import { isUlid } from "../security/ids.ts";
import { canSeePrivate } from "./access.ts";
import { isBlockingMediaFlag, MEDIA_FLAG_KEYS, MEDIA_FLAGS, mediaFlagLabel, USAGE_STATUS_LABELS, type UsageStatus } from "./registry.ts";
import { usedSql } from "./usage.ts";

export const PAGE_SIZES = [12, 24, 48, 96] as const;
const SORTS = ["newest", "oldest", "name", "size"] as const;
const STATUSES = Object.keys(USAGE_STATUS_LABELS) as UsageStatus[];

export interface LibraryQuery {
  q: string;
  folder: string;
  kind: "" | "image" | "document";
  visibility: "" | "public" | "private";
  status: "" | UsageStatus;
  flag: string;
  processing: "" | "failed" | "processing";
  missingAlt: boolean;
  unused: boolean;
  uploader: string;
  trash: boolean;
  sort: (typeof SORTS)[number];
  view: "grid" | "list";
  page: number;
  pageSize: number;
}

type Params = Record<string, string | string[] | undefined>;
const one = (params: Params, key: string) => {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 200) ?? "";
};

/** The library's address, read strictly: unknown values fall back to defaults (never into SQL). */
export function parseLibraryQuery(params: Params): LibraryQuery {
  const pick = <T extends string>(value: string, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
  const folder = one(params, "folder");
  const uploader = one(params, "uploader");
  const flag = one(params, "flag");
  const pageSize = Number(one(params, "size"));
  const page = Number(one(params, "page"));
  return {
    q: one(params, "q").trim(),
    folder: folder === "none" || isUlid(folder) ? folder : "",
    kind: pick(one(params, "kind"), ["image", "document"] as const, "" as never) || "",
    visibility: pick(one(params, "visibility"), ["public", "private"] as const, "" as never) || "",
    status: pick(one(params, "status"), STATUSES, "" as never) || "",
    flag: flag === "blocking" || flag === "any" || (MEDIA_FLAG_KEYS as readonly string[]).includes(flag) ? flag : "",
    processing: pick(one(params, "processing"), ["failed", "processing"] as const, "" as never) || "",
    missingAlt: one(params, "missing") === "alt",
    unused: one(params, "unused") === "1",
    uploader: isUlid(uploader) ? uploader : "",
    trash: one(params, "trash") === "1",
    sort: pick(one(params, "sort"), SORTS, "newest"),
    view: one(params, "view") === "list" ? "list" : "grid",
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : 24,
  };
}

/** The address of a library view (defaults left out). */
export function libraryHref(query: Partial<LibraryQuery>, base = "/admin/media"): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | boolean | undefined, fallback: string | number | boolean) => {
    if (value === undefined || value === fallback || value === "") return;
    params.set(key, value === true ? (key === "missing" ? "alt" : "1") : String(value));
  };
  set("q", query.q, "");
  set("folder", query.folder, "");
  set("kind", query.kind, "");
  set("visibility", query.visibility, "");
  set("status", query.status, "");
  set("flag", query.flag, "");
  set("processing", query.processing, "");
  set("missing", query.missingAlt, false);
  set("unused", query.unused, false);
  set("uploader", query.uploader, "");
  set("trash", query.trash, false);
  set("sort", query.sort, "newest");
  set("view", query.view, "grid");
  set("size", query.pageSize, 24);
  set("page", query.page, 1);
  const text = params.toString();
  return text ? `${base}?${text}` : base;
}

export interface LibraryRow {
  id: string;
  kind: "image" | "svg" | "document";
  visibility: "public" | "private";
  status: UsageStatus;
  legacyKey: string | null;
  title: { en: string | null; ar: string | null };
  alt: { en: string | null; ar: string | null };
  folderId: string | null;
  folderName: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  mime: string | null;
  storageArea: "release" | "originals" | "private" | null;
  processing: "uploaded" | "processing" | "ready" | "failed" | null;
  /** The current (ready) file; null while the first upload is processing, or after it failed. */
  currentFileId: string | null;
  flags: string[];
  blocking: boolean;
  createdAt: Date | null;
  uploader: string | null;
  deleted: boolean;
}

const NON_BLOCKING = MEDIA_FLAG_KEYS.filter((k) => !MEDIA_FLAGS[k].blocking);

/** The conditions of a query for this viewer (visibility first: never widened by the address). */
function conditions(query: LibraryQuery, permissions: ReadonlySet<string>): SQL[] {
  const where: SQL[] = [];
  if (!canSeePrivate(permissions)) where.push(sql`a.visibility = 'public'`);
  else if (query.visibility) where.push(sql`a.visibility = ${query.visibility}`);
  where.push(query.trash ? sql`a.deleted_at IS NOT NULL` : sql`a.deleted_at IS NULL`);
  if (query.status) where.push(sql`a.usage_status = ${query.status}`);
  if (query.kind) where.push(sql`a.kind = ${query.kind}`);
  if (query.folder === "none") where.push(sql`a.folder_id IS NULL`);
  else if (query.folder) where.push(sql`a.folder_id = ${query.folder}`);
  if (query.flag === "any") where.push(sql`EXISTS (SELECT 1 FROM media_flags x WHERE x.media_id = a.id)`);
  else if (query.flag === "blocking") {
    // Every flag the code does not list as informative blocks (unknown ones included).
    where.push(sql`EXISTS (SELECT 1 FROM media_flags x WHERE x.media_id = a.id AND x.flag NOT IN (${sql.join(NON_BLOCKING.map((k) => sql`${k}`), sql`, `)}))`);
  } else if (query.flag) where.push(sql`EXISTS (SELECT 1 FROM media_flags x WHERE x.media_id = a.id AND x.flag = ${query.flag})`);
  if (query.processing) where.push(sql`f.processing_status = ${query.processing}`);
  if (query.missingAlt) where.push(sql`a.kind = 'image' AND (te.alt_text IS NULL OR ta.alt_text IS NULL)`);
  if (query.unused) where.push(sql`NOT ${usedSql(sql`a.id`)}`);
  if (query.uploader) where.push(sql`a.created_by = ${query.uploader}`);
  const search = searchCondition(query.q);
  if (search) where.push(search);
  return where;
}

/**
 * The search part of a query: the item's search rows (titles, alt texts, captions, file names and legacy key, both
 * languages, Arabic-normalized), its folder's name, and flag or status names typed as words. Null for an empty query.
 */
function searchCondition(text: string): SQL | null {
  const q = normalizeForSearch(text);
  if (!q) return null;
  const pattern = likePattern(q);
  const raw = likePattern(text.toLowerCase());
  const words: SQL[] = [
    sql`EXISTS (SELECT 1 FROM search_documents s WHERE s.entity_type = 'media' AND s.entity_id = a.id AND s.scope = 'working' AND (s.title LIKE ${pattern} OR s.body LIKE ${pattern}))`,
    sql`mf.name LIKE ${raw}`,
  ];
  const flags = MEDIA_FLAG_KEYS.filter((k) => k.includes(q.replace(/\s+/g, "_")) || mediaFlagLabel(k).toLowerCase().includes(q));
  if (flags.length) words.push(sql`EXISTS (SELECT 1 FROM media_flags x WHERE x.media_id = a.id AND x.flag IN (${sql.join(flags.map((k) => sql`${k}`), sql`, `)}))`);
  const statuses = STATUSES.filter((s) => s.includes(q.replace(/\s+/g, "_")) || USAGE_STATUS_LABELS[s].toLowerCase().includes(q));
  if (statuses.length) words.push(sql`a.usage_status IN (${sql.join(statuses.map((s) => sql`${s}`), sql`, `)})`);
  return sql`(${sql.join(words, sql` OR `)})`;
}

const FROM = sql`FROM media_assets a
  LEFT JOIN media_files f ON f.id = COALESCE(a.current_file_id, (SELECT lf.id FROM media_files lf WHERE lf.media_id = a.id ORDER BY lf.version DESC LIMIT 1))
  LEFT JOIN media_translations te ON te.media_id = a.id AND te.locale = 'en'
  LEFT JOIN media_translations ta ON ta.media_id = a.id AND ta.locale = 'ar'
  LEFT JOIN media_folders mf ON mf.id = a.folder_id
  LEFT JOIN users u ON u.id = a.created_by`;

const COLUMNS = sql`a.id, a.kind, a.visibility, a.usage_status, a.legacy_key, a.folder_id, a.created_at, a.deleted_at, a.current_file_id,
          f.original_filename, f.width, f.height, f.byte_size, f.mime_type, f.storage_area, f.processing_status,
          te.title AS title_en, ta.title AS title_ar, te.alt_text AS alt_en, ta.alt_text AS alt_ar,
          mf.name AS folder_name, u.display_name AS uploader,
          (SELECT GROUP_CONCAT(x.flag ORDER BY x.flag SEPARATOR ',') FROM media_flags x WHERE x.media_id = a.id) AS flags`;

const ORDER: Record<LibraryQuery["sort"], SQL> = {
  newest: sql`a.created_at DESC, a.id DESC`,
  oldest: sql`a.created_at ASC, a.id ASC`,
  name: sql`COALESCE(NULLIF(te.title, ''), NULLIF(ta.title, ''), a.legacy_key, f.original_filename) ASC, a.id ASC`,
  size: sql`f.byte_size DESC, a.id DESC`,
};

export async function listMedia(db: Db, permissions: ReadonlySet<string>, query: LibraryQuery): Promise<{ rows: LibraryRow[]; total: number }> {
  const where = sql.join(conditions(query, permissions), sql` AND `);
  const [count] = await rowsOf<{ n: number }>(db, sql`SELECT COUNT(*) AS n ${FROM} WHERE ${where}`);
  const total = Number(count?.n ?? 0);
  const offset = (query.page - 1) * query.pageSize;
  const rows = await rowsOf<Record<string, unknown>>(db, sql`SELECT ${COLUMNS} ${FROM} WHERE ${where} ORDER BY ${ORDER[query.sort]} LIMIT ${query.pageSize} OFFSET ${offset}`);
  return { rows: rows.map(toRow), total };
}

/** Usage statuses a content slot may newly take (A4 brief §53; `media-refs.ts` decides the same on save). */
const CHOOSABLE = ["pending_review", "approved", "restricted"] as const;

export interface PickerQuery {
  q: string;
  kinds: readonly ("image" | "document")[];
  page: number;
  pageSize: number;
  /** Only this item, if it may be chosen (an item just uploaded, or a duplicate the person chose to use). */
  id?: string;
}

/**
 * What a public content slot's picker offers (A4 brief §53): public-class items only — never a private one, whoever
 * asks — not in the Trash, pending review, approved or restricted (each non-approved one shown with its warning), with a
 * ready file, of the slot's kinds. Newest first.
 */
export async function pickerMedia(db: Db, query: PickerQuery): Promise<{ rows: LibraryRow[]; total: number }> {
  const conditions: SQL[] = [
    sql`a.visibility = 'public'`,
    sql`a.deleted_at IS NULL`,
    sql`a.current_file_id IS NOT NULL`,
    sql`a.usage_status IN (${sql.join(CHOOSABLE.map((s) => sql`${s}`), sql`, `)})`,
    sql`a.kind IN (${sql.join((query.kinds.length ? query.kinds : ["image"]).map((k) => sql`${k}`), sql`, `)})`,
  ];
  const search = searchCondition(query.q);
  if (search) conditions.push(search);
  if (query.id !== undefined) conditions.push(isUlid(query.id) ? sql`a.id = ${query.id}` : sql`FALSE`);
  const where = sql.join(conditions, sql` AND `);
  const [count] = await rowsOf<{ n: number }>(db, sql`SELECT COUNT(*) AS n ${FROM} WHERE ${where}`);
  const offset = (query.page - 1) * query.pageSize;
  const rows = await rowsOf<Record<string, unknown>>(db, sql`SELECT ${COLUMNS} ${FROM} WHERE ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ${query.pageSize} OFFSET ${offset}`);
  return { rows: rows.map(toRow), total: Number(count?.n ?? 0) };
}

/** Specific items by id, whatever their state (Trash included); the caller decides what the person may see. */
export async function mediaRowsByIds(db: Db, ids: readonly string[]): Promise<Map<string, LibraryRow>> {
  const unique = [...new Set(ids)].filter(isUlid);
  if (!unique.length) return new Map();
  const rows = await rowsOf<Record<string, unknown>>(db, sql`SELECT ${COLUMNS} ${FROM} WHERE a.id IN (${sql.join(unique.map((v) => sql`${v}`), sql`, `)})`);
  return new Map(rows.map(toRow).map((r) => [r.id, r]));
}

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toRow(r: Record<string, unknown>): LibraryRow {
  const flags = str(r.flags)?.split(",").filter(Boolean) ?? [];
  const created = str(r.created_at);
  return {
    id: String(r.id),
    kind: r.kind as LibraryRow["kind"],
    visibility: r.visibility as LibraryRow["visibility"],
    status: r.usage_status as UsageStatus,
    legacyKey: str(r.legacy_key),
    title: { en: str(r.title_en), ar: str(r.title_ar) },
    alt: { en: str(r.alt_en), ar: str(r.alt_ar) },
    folderId: str(r.folder_id),
    folderName: str(r.folder_name),
    filename: str(r.original_filename),
    width: num(r.width),
    height: num(r.height),
    byteSize: num(r.byte_size),
    mime: str(r.mime_type),
    storageArea: (str(r.storage_area) as LibraryRow["storageArea"]) ?? null,
    processing: (str(r.processing_status) as LibraryRow["processing"]) ?? null,
    currentFileId: str(r.current_file_id),
    flags,
    blocking: flags.some(isBlockingMediaFlag),
    createdAt: created ? new Date(`${created.replace(" ", "T")}Z`) : null,
    uploader: str(r.uploader),
    deleted: r.deleted_at !== null && r.deleted_at !== undefined,
  };
}

/** The people who uploaded something the viewer may see (the uploader filter's choices). */
export async function uploaders(db: Db, permissions: ReadonlySet<string>): Promise<{ id: string; name: string }[]> {
  const visible = canSeePrivate(permissions) ? sql`` : sql` AND a.visibility = 'public'`;
  return rowsOf<{ id: string; name: string }>(db, sql`SELECT DISTINCT u.id, u.display_name AS name FROM media_assets a JOIN users u ON u.id = a.created_by WHERE 1 = 1${visible} ORDER BY u.display_name LIMIT 200`);
}

// --- Dashboard (A4 brief §64) --------------------------------------------------------------------------------------------

export interface MediaStats {
  total: number;
  byStatus: Record<UsageStatus, number>;
  /** Private items (only for those who may know them; null otherwise). */
  private: number | null;
  trashed: number;
  failed: number;
  stuck: number;
  missingAlt: number;
  blocking: number;
  storage: { releaseFiles: number; releaseBytes: number; persistentFiles: number; persistentBytes: number };
}

export async function mediaStats(db: Db, permissions: ReadonlySet<string>, now: Date, stuckAfterMs: number): Promise<MediaStats> {
  const visible = canSeePrivate(permissions) ? sql`1 = 1` : sql`a.visibility = 'public'`;
  const statusRows = await rowsOf<{ s: UsageStatus; n: number }>(db, sql`SELECT a.usage_status AS s, COUNT(*) AS n FROM media_assets a WHERE ${visible} AND a.deleted_at IS NULL GROUP BY a.usage_status`);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<UsageStatus, number>;
  for (const row of statusRows) byStatus[row.s] = Number(row.n);
  const [counts] = await rowsOf<Record<string, number | null>>(
    db,
    sql`SELECT
          SUM(a.deleted_at IS NULL) AS total,
          SUM(a.deleted_at IS NOT NULL) AS trashed,
          SUM(a.visibility = 'private' AND a.deleted_at IS NULL) AS private_items,
          SUM(a.deleted_at IS NULL AND a.kind = 'image' AND a.visibility = 'public'
              AND (NOT EXISTS (SELECT 1 FROM media_translations t WHERE t.media_id = a.id AND t.locale = 'en' AND t.alt_text IS NOT NULL)
                OR NOT EXISTS (SELECT 1 FROM media_translations t WHERE t.media_id = a.id AND t.locale = 'ar' AND t.alt_text IS NOT NULL))) AS missing_alt,
          SUM(a.deleted_at IS NULL AND EXISTS (SELECT 1 FROM media_flags x WHERE x.media_id = a.id AND x.flag NOT IN (${sql.join(NON_BLOCKING.map((k) => sql`${k}`), sql`, `)}))) AS blocking
        FROM media_assets a WHERE ${visible}`,
  );
  const stuckBefore = new Date(now.getTime() - stuckAfterMs);
  const [files] = await rowsOf<Record<string, number | null>>(
    db,
    sql`SELECT
          SUM(f.processing_status = 'failed') AS failed,
          SUM(f.processing_status IN ('uploaded', 'processing') AND f.uploaded_at < ${stuckBefore}) AS stuck,
          SUM(f.storage_area = 'release') AS release_files,
          COALESCE(SUM(CASE WHEN f.storage_area = 'release' THEN f.byte_size END), 0) AS release_bytes,
          SUM(f.storage_area <> 'release' AND f.processing_status = 'ready') AS persistent_files,
          COALESCE(SUM(CASE WHEN f.storage_area <> 'release' AND f.processing_status = 'ready' THEN f.byte_size END), 0) AS persistent_bytes
        FROM media_files f JOIN media_assets a ON a.id = f.media_id WHERE ${visible}`,
  );
  const [variants] = await rowsOf<Record<string, number | null>>(
    db,
    sql`SELECT COUNT(*) AS n, COALESCE(SUM(v.byte_size), 0) AS bytes FROM media_variants v JOIN media_files f ON f.id = v.file_id JOIN media_assets a ON a.id = f.media_id WHERE ${visible}`,
  );
  const n = (v: unknown) => Number(v ?? 0);
  return {
    total: n(counts?.total),
    byStatus,
    private: canSeePrivate(permissions) ? n(counts?.private_items) : null,
    trashed: n(counts?.trashed),
    failed: n(files?.failed),
    stuck: n(files?.stuck),
    missingAlt: n(counts?.missing_alt),
    blocking: n(counts?.blocking),
    storage: {
      releaseFiles: n(files?.release_files),
      releaseBytes: n(files?.release_bytes),
      persistentFiles: n(files?.persistent_files) + n(variants?.n),
      persistentBytes: n(files?.persistent_bytes) + n(variants?.bytes),
    },
  };
}
