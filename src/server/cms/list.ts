/**
 * The list screens' queries (A3 brief §17, §42–§44): server-side search, filters and pagination, never unlimited rows.
 * The state lives in the address's query parameters (bookmarkable); unknown or out-of-range values fall back to the
 * defaults. Search compares Arabic-normalized text (A1 `search_documents`) and the slug; language states are computed
 * in SQL with the same required fields the editor uses, so a filter and a badge never disagree.
 *
 * Table and column names come from this file's fixed maps; every value is a bound parameter.
 */
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import type { LocaleState } from "./completeness.ts";
import { ENTITIES, LIMITS, PROJECT_FLAGS, type EntityType, type Locale } from "./registry.ts";
import { instantOf, rowsOf } from "./store.ts";
import { likePattern, normalizeForSearch } from "./text.ts";

interface ChildRule {
  table: string;
  parent: string;
  tr: string;
  trParent: string;
}

/** Required translated columns per type (the same as the editor's `required` fields). */
const REQUIRED: Record<EntityType, { title: string; text: string[]; rich?: string[]; children?: ChildRule }> = {
  page: { title: "title", text: ["title"] },
  service: { title: "name", text: ["name", "tagline", "summary"], rich: ["body"] },
  machine: {
    title: "name",
    text: ["name", "short_name", "category", "capability"],
    children: { table: "machine_attributes", parent: "machine_id", tr: "machine_attribute_translations", trParent: "attribute_id" },
  },
  project: { title: "title", text: ["title", "summary"] },
  project_category: { title: "label", text: ["label"] },
  industry: { title: "name", text: ["name", "description"] },
  client: { title: "name", text: ["name"] },
  certificate: {
    title: "title",
    text: ["title", "issuer"],
    children: { table: "certificate_facts", parent: "certificate_id", tr: "certificate_fact_translations", trParent: "fact_id" },
  },
};

const id = (name: string) => sql.identifier(name);

/** The state of one language of the root `r`, as SQL (missing / incomplete / draft / complete / needs_review). */
export function localeStateSql(type: EntityType, alias: string, locale: Locale): SQL {
  const rule = REQUIRED[type];
  const t = id(alias);
  const parent = id(ENTITIES[type].trParent);
  const filled = [
    ...rule.text.map((c) => sql`${t}.${id(c)} <> ''`),
    ...(rule.rich ?? []).map((c) => sql`JSON_LENGTH(${t}.${id(c)}, '$.content') > 0`),
    ...(rule.children
      ? [
          sql`NOT EXISTS (SELECT 1 FROM ${id(rule.children.table)} c LEFT JOIN ${id(rule.children.tr)} ct
                ON ct.${id(rule.children.trParent)} = c.id AND ct.locale = ${locale}
               WHERE c.${id(rule.children.parent)} = r.id AND (ct.${id(rule.children.trParent)} IS NULL OR ct.label = '' OR ct.value = ''))`,
        ]
      : []),
  ];
  return sql`CASE WHEN ${t}.${parent} IS NULL THEN 'missing' WHEN NOT (${sql.join(filled, sql` AND `)}) THEN 'incomplete' ELSE ${t}.translation_status END`;
}

const NON_BLOCKING_FLAGS = Object.entries(PROJECT_FLAGS)
  .filter(([, f]) => !f.blocking)
  .map(([k]) => k);

/** Extra columns a type's list shows. */
function extraColumns(type: EntityType): SQL {
  switch (type) {
    case "page":
      return sql`, r.page_type, r.system_key, r.requires_legal_review`;
    case "service":
      return sql`, r.service_group`;
    case "machine":
      return sql`, r.power_watts`;
    case "project":
      return sql`, r.is_featured, r.gallery_ref,
        (SELECT COUNT(*) FROM project_flags f WHERE f.project_id = r.id) AS flag_count,
        (SELECT COUNT(*) FROM project_flags f WHERE f.project_id = r.id AND f.flag NOT IN (${sql.join(
          NON_BLOCKING_FLAGS.map((k) => sql`${k}`),
          sql`, `,
        )})) AS blocking_count`;
    case "client":
      return sql`, r.is_featured, r.website_url`;
    case "industry":
      return sql`, r.classification`;
    case "certificate":
      return sql`, r.expires_on`;
    default:
      return sql``;
  }
}

/** The base rows of a type: every item not in the Trash, with titles, language states, order and attribution. */
function baseQuery(type: EntityType): SQL {
  const info = ENTITIES[type];
  const rule = REQUIRED[type];
  const tr = id(info.trTable);
  const parent = id(info.trParent);
  const ordering = info.orderingKey
    ? sql`LEFT JOIN entity_ordering_items oi ON oi.ordering_key = ${info.orderingKey} AND oi.entity_id = r.id`
    : sql``;
  return sql`SELECT r.id, r.slug, r.publication_status, r.lock_version, r.created_at, r.updated_at,
      u.display_name AS updated_by_name,
      te.${id(rule.title)} AS title_en, ta.${id(rule.title)} AS title_ar,
      ${localeStateSql(type, "te", "en")} AS state_en, ${localeStateSql(type, "ta", "ar")} AS state_ar,
      ${info.orderingKey ? sql`oi.position` : sql`NULL`} AS position
      ${extraColumns(type)}
    FROM ${id(info.table)} r
    LEFT JOIN ${tr} te ON te.${parent} = r.id AND te.locale = 'en'
    LEFT JOIN ${tr} ta ON ta.${parent} = r.id AND ta.locale = 'ar'
    LEFT JOIN users u ON u.id = r.updated_by
    ${ordering}
    WHERE r.deleted_at IS NULL`;
}

// --- Parameters ---------------------------------------------------------------------------------------------------------

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const LANG_FILTERS = {
  "ar-missing": "Arabic missing",
  "en-missing": "English missing",
  "ar-incomplete": "Arabic not complete",
  "en-incomplete": "English not complete",
  "needs-review": "Needs review",
} as const;
export type LangFilter = keyof typeof LANG_FILTERS;

export const SORTS = { order: "Site order", updated: "Recently updated", title: "Title (A–Z)", slug: "Slug (A–Z)" } as const;
export type SortKey = keyof typeof SORTS;

export interface ListParams {
  q: string;
  status: "active" | "archived" | "all";
  lang: LangFilter | null;
  featured: boolean;
  restricted: boolean;
  category: string | null;
  classification: "profile_sector" | "website_classification" | null;
  pageType: "home" | "system" | "legal" | "generic" | "template" | null;
  group: "metal" | "scaffolding" | null;
  sort: SortKey;
  /** The type's default order (left out of list addresses). */
  defaultSort: SortKey;
  page: number;
  size: number;
}

/** Reads the list's query parameters; anything unknown or out of range takes the default. */
export function parseListParams(type: EntityType, raw: Record<string, string | string[] | undefined>): ListParams {
  const ordered = Boolean(ENTITIES[type].orderingKey);
  const q = String(first(raw.q) ?? "").slice(0, LIMITS.searchQuery).trim();
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
  const int = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(first(value));
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  const category = String(first(raw.category) ?? "");
  return {
    q,
    status: pick(first(raw.status), ["active", "archived", "all"], "active"),
    lang: (Object.keys(LANG_FILTERS) as LangFilter[]).includes(first(raw.lang) as LangFilter) ? (first(raw.lang) as LangFilter) : null,
    featured: (type === "project" || type === "client") && first(raw.featured) === "1",
    restricted: type === "project" && first(raw.restricted) === "1",
    category: type === "project" && ULID.test(category) ? category : null,
    classification: type === "industry" ? (pick(first(raw.classification), ["profile_sector", "website_classification", ""], "") || null) as ListParams["classification"] : null,
    pageType: type === "page" ? (pick(first(raw.type), ["home", "system", "legal", "generic", "template", ""], "") || null) as ListParams["pageType"] : null,
    group: type === "service" ? (pick(first(raw.group), ["metal", "scaffolding", ""], "") || null) as ListParams["group"] : null,
    sort: pick(first(raw.sort), ordered ? ["order", "updated", "title", "slug"] : ["updated", "title", "slug"], ordered ? "order" : "updated"),
    defaultSort: ordered ? "order" : "updated",
    page: int(raw.page, 1, 1, 100_000),
    size: int(raw.size, LIMITS.page.defaultSize, LIMITS.page.minSize, LIMITS.page.maxSize),
  };
}

// --- Query --------------------------------------------------------------------------------------------------------------

export interface ListRow {
  id: string;
  slug: string | null;
  archived: boolean;
  lockVersion: number;
  title: Record<Locale, string | null>;
  state: Record<Locale, LocaleState>;
  position: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  extra: Record<string, unknown>;
}

export interface ListResult {
  rows: ListRow[];
  total: number;
  params: ListParams;
  pages: number;
}

function filters(type: EntityType, p: ListParams): SQL[] {
  const where: SQL[] = [];
  if (p.status === "active") where.push(sql`b.publication_status <> 'archived'`);
  if (p.status === "archived") where.push(sql`b.publication_status = 'archived'`);
  if (p.q) {
    const pattern = likePattern(normalizeForSearch(p.q));
    const inText = sql`EXISTS (SELECT 1 FROM search_documents s WHERE s.entity_type = ${type} AND s.entity_id = b.id
      AND s.scope = 'working' AND (s.title LIKE ${pattern} OR s.body LIKE ${pattern}))`;
    // Slugs are ASCII (an ascii_bin column): only an ASCII query can match one, and only such a query may be compared
    // with it (another script would not convert to the column's character set).
    where.push(/^[\x20-\x7e]+$/.test(p.q) ? sql`(b.slug LIKE ${likePattern(p.q.toLowerCase())} OR ${inText})` : inText);
  }
  switch (p.lang) {
    case "ar-missing":
      where.push(sql`b.state_ar = 'missing'`);
      break;
    case "en-missing":
      where.push(sql`b.state_en = 'missing'`);
      break;
    case "ar-incomplete":
      where.push(sql`b.state_ar <> 'complete'`);
      break;
    case "en-incomplete":
      where.push(sql`b.state_en <> 'complete'`);
      break;
    case "needs-review":
      where.push(sql`(b.state_en = 'needs_review' OR b.state_ar = 'needs_review')`);
      break;
  }
  if (p.featured) where.push(sql`b.is_featured = 1`);
  if (p.restricted) where.push(sql`b.blocking_count > 0`);
  if (p.category) where.push(sql`EXISTS (SELECT 1 FROM project_category_assignments a WHERE a.project_id = b.id AND a.category_id = ${p.category})`);
  if (p.classification) where.push(sql`b.classification = ${p.classification}`);
  if (p.pageType) where.push(sql`b.page_type = ${p.pageType}`);
  if (p.group) where.push(sql`b.service_group = ${p.group}`);
  return where;
}

function orderBy(p: ListParams): SQL {
  switch (p.sort) {
    case "order":
      return sql`ORDER BY b.position IS NULL, b.position, b.id`;
    case "title":
      return sql`ORDER BY COALESCE(NULLIF(b.title_en, ''), NULLIF(b.title_ar, ''), b.slug), b.id`;
    case "slug":
      return sql`ORDER BY b.slug, b.id`;
    default:
      return sql`ORDER BY b.updated_at DESC, b.id DESC`;
  }
}

export async function listItems(db: Db, type: EntityType, params: ListParams): Promise<ListResult> {
  const where = filters(type, params);
  const condition = where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``;
  const base = baseQuery(type);
  const [count] = await rowsOf<{ n: number }>(db, sql`SELECT COUNT(*) AS n FROM (${base}) b ${condition}`);
  const total = Number(count?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / params.size));
  const page = Math.min(params.page, pages);
  const rows = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT * FROM (${base}) b ${condition} ${orderBy(params)} LIMIT ${params.size} OFFSET ${(page - 1) * params.size}`,
  );
  return {
    total,
    pages,
    params: { ...params, page },
    rows: rows.map((r) => ({
      id: String(r.id),
      slug: (r.slug as string | null) ?? null,
      archived: r.publication_status === "archived",
      lockVersion: Number(r.lock_version),
      title: { en: (r.title_en as string | null) || null, ar: (r.title_ar as string | null) || null },
      state: { en: r.state_en as LocaleState, ar: r.state_ar as LocaleState },
      position: r.position === null || r.position === undefined ? null : Number(r.position),
      createdAt: instantOf(r.created_at),
      updatedAt: instantOf(r.updated_at),
      updatedBy: (r.updated_by_name as string | null) ?? null,
      extra: Object.fromEntries(
        ["page_type", "system_key", "requires_legal_review", "service_group", "power_watts", "is_featured", "gallery_ref", "flag_count", "blocking_count", "website_url", "classification", "expires_on"]
          .filter((k) => k in r)
          .map((k) => [k, r[k]]),
      ),
    })),
  };
}

/** The query string of a list address with some parameters changed (for filters, sorting and pagination links). */
export function listHref(path: string, params: ListParams, change: Partial<Record<keyof ListParams, string | number | boolean | null>>): string {
  const merged: Record<string, string | number | boolean | null> = {
    q: params.q,
    status: params.status,
    lang: params.lang,
    featured: params.featured,
    restricted: params.restricted,
    category: params.category,
    classification: params.classification,
    type: params.pageType,
    group: params.group,
    sort: params.sort,
    page: params.page,
    size: params.size,
  };
  for (const [key, value] of Object.entries(change)) merged[key === "pageType" ? "type" : key] = value as never;
  if (!("page" in change)) merged.page = 1;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === "" || value === false) continue;
    if (key === "status" && value === "active") continue;
    if (key === "sort" && value === params.defaultSort) continue;
    if (key === "page" && value === 1) continue;
    if (key === "size" && value === LIMITS.page.defaultSize) continue;
    search.set(key, value === true ? "1" : String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

// --- Counts (the dashboard: real numbers only, A3 brief §16) ---------------------------------------------------------------

export interface TypeCounts {
  type: EntityType;
  /** Working records (drafts; nothing is public in A3). */
  active: number;
  archived: number;
  enMissing: number;
  arMissing: number;
  /** Active records with a language not yet confirmed complete. */
  notComplete: number;
  needsReview: number;
  /** Projects only: active projects with a blocking flag. */
  restricted: number | null;
}

export async function countItems(db: Db, type: EntityType): Promise<TypeCounts> {
  const active = sql`b.publication_status <> 'archived'`;
  const [row] = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT COUNT(*) AS total,
        COALESCE(SUM(${active}), 0) AS active,
        COALESCE(SUM(b.publication_status = 'archived'), 0) AS archived,
        COALESCE(SUM(${active} AND b.state_en = 'missing'), 0) AS en_missing,
        COALESCE(SUM(${active} AND b.state_ar = 'missing'), 0) AS ar_missing,
        COALESCE(SUM(${active} AND (b.state_en <> 'complete' OR b.state_ar <> 'complete')), 0) AS not_complete,
        COALESCE(SUM(${active} AND (b.state_en = 'needs_review' OR b.state_ar = 'needs_review')), 0) AS needs_review
        ${type === "project" ? sql`, COALESCE(SUM(${active} AND b.blocking_count > 0), 0) AS restricted` : sql``}
      FROM (${baseQuery(type)}) b`,
  );
  const n = (key: string) => Number(row?.[key] ?? 0);
  return {
    type,
    active: n("active"),
    archived: n("archived"),
    enMissing: n("en_missing"),
    arMissing: n("ar_missing"),
    notComplete: n("not_complete"),
    needsReview: n("needs_review"),
    restricted: type === "project" ? n("restricted") : null,
  };
}
