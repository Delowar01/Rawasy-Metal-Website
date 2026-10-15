/**
 * The A3 tables of the A1 schema (A1-DATABASE-SCHEMA §5–§7): the working copies of the core content — pages, services,
 * machines, projects and their categories, industries, clients, certificates — with their translations, relations and
 * the collections' orderings, plus the admin search index and the (empty in A3) revisions table that the publication
 * columns refer to. The public website never reads these tables (T1 = Option B: it stays on its static source until
 * the A9 cutover).
 *
 * Column groups follow A1 §5: TS (timestamps and actors), SD (soft delete), PUB (publication), SRC (provenance,
 * admin-only), SEO_R / SEO_T (per-record SEO), TR (translation status). Left out until the phase that builds them:
 * every media reference and alt text (A4: media library), the section/block tables (A5: page builder), and the public
 * read model, references index, cache and redirect tables (A8/A9: publishing and the cutover).
 *
 * Three additions the A3 brief asks for go beyond A1's catalogue, each following an A1 pattern (A3 report):
 * `machine_attributes` (+ translations) like `certificate_facts`, `industry_projects` like `industry_services`, and
 * `clients.is_featured` like `projects.is_featured`.
 *
 * Source of truth for `drizzle-kit generate`; queries use Drizzle's core builder only (no relations declared).
 */
import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  varchar,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";
import { asciiColumn, hashColumn, instant, jsonColumn, localeColumn, ulidColumn } from "./columns.ts";
import { locales, users } from "./schema.ts";

const now3 = sql`CURRENT_TIMESTAMP(3)`;

export const PUBLICATION_STATUSES = ["unpublished", "published", "archived"] as const;
export const DRAFT_STATUSES = ["none", "draft", "in_review"] as const;
export const TRANSLATION_STATUSES = ["draft", "complete", "needs_review"] as const;
export const SOURCE_BASES = ["profile", "licence", "owner", "inferred", "other"] as const;
export const REVISION_KINDS = ["save", "submit", "publish", "unpublish", "archive", "restore", "import"] as const;
export const SEARCH_SCOPES = ["working", "published"] as const;
export const PAGE_TYPES = ["home", "system", "legal", "generic", "template"] as const;
export const SERVICE_GROUPS = ["metal", "scaffolding"] as const;
export const INDUSTRY_CLASSIFICATIONS = ["profile_sector", "website_classification"] as const;

/** A1's slug rule (A1-CONTENT-MODEL §3.4), also enforced by the database. */
const SLUG_CHECK = "^[a-z0-9]+(-[a-z0-9]+)*$";

// --- Shared column groups (A1-DATABASE-SCHEMA §5); each call makes fresh builders ------------------------------------

/** TS — timestamps and actors. */
const ts = () => ({
  createdAt: instant("created_at").notNull().default(now3),
  createdBy: ulidColumn("created_by"),
  updatedAt: instant("updated_at").notNull().default(now3),
  updatedBy: ulidColumn("updated_by"),
});

/** SD — soft delete (the Trash; not used by A3's actions, kept for A8). */
const sd = () => ({
  deletedAt: instant("deleted_at"),
  deletedBy: ulidColumn("deleted_by"),
});

/** PUB — publication (aggregate roots). A3 writes only unpublished/draft and archived/none. */
const pub = () => ({
  publicationStatus: mysqlEnum("publication_status", PUBLICATION_STATUSES).notNull().default("unpublished"),
  draftStatus: mysqlEnum("draft_status", DRAFT_STATUSES).notNull().default("draft"),
  publishedRevisionId: ulidColumn("published_revision_id"),
  currentRevisionId: ulidColumn("current_revision_id"),
  lockVersion: int("lock_version", { unsigned: true }).notNull().default(0),
  firstPublishedAt: instant("first_published_at"),
  publishedAt: instant("published_at"),
  publishedBy: ulidColumn("published_by"),
  archivedAt: instant("archived_at"),
  archivedBy: ulidColumn("archived_by"),
});

/** SRC — provenance (admin-only, never rendered). */
const src = () => ({
  sourceBasis: mysqlEnum("source_basis", SOURCE_BASES),
  sourcePages: varchar("source_pages", { length: 40 }),
  sourceNote: text("source_note"),
});

/** SEO_R — per-record SEO on the root (the share-image column arrives with the media library, A4). */
const seoRoot = () => ({
  robotsIndex: boolean("robots_index").notNull().default(true),
  robotsFollow: boolean("robots_follow").notNull().default(true),
  inSitemap: boolean("in_sitemap").notNull().default(true),
  canonicalOverride: varchar("canonical_override", { length: 255 }),
});

/** SEO_T — per-record SEO per language. */
const seoText = () => ({
  seoTitle: varchar("seo_title", { length: 120 }),
  seoDescription: varchar("seo_description", { length: 320 }),
  ogTitle: varchar("og_title", { length: 120 }),
  ogDescription: varchar("og_description", { length: 320 }),
});

/** TR — translation status. */
const tr = () => ({
  translationStatus: mysqlEnum("translation_status", TRANSLATION_STATUSES).notNull().default("draft"),
  completedAt: instant("completed_at"),
  completedBy: ulidColumn("completed_by"),
  updatedAt: instant("updated_at").notNull().default(now3),
  updatedBy: ulidColumn("updated_by"),
});

type Columns = Record<string, AnyMySqlColumn>;

/** Actor foreign keys (users, ON DELETE SET NULL) for the given columns. */
const actorKeys = (table: string, t: Columns, columns: string[]) =>
  columns.map((c) => foreignKey({ name: `fk_${table}_${snake(c)}`, columns: [t[c]], foreignColumns: [users.id] }).onDelete("set null"));

const snake = (name: string) => name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

/** The constraints of an aggregate root: state index, actors, revision links and A1's two publication checks. */
const rootConstraints = (table: string, t: Columns, options: { slug?: boolean; softDelete?: boolean } = {}) => [
  index(`ix_${table}_state`).on(t.publicationStatus, t.draftStatus),
  ...(options.softDelete === false ? [] : [index(`ix_${table}_deleted`).on(t.deletedAt)]),
  ...actorKeys(table, t, ["createdBy", "updatedBy", "publishedBy", "archivedBy", ...(options.softDelete === false ? [] : ["deletedBy"])]),
  foreignKey({ name: `fk_${table}_pubrev`, columns: [t.publishedRevisionId], foreignColumns: [revisions.id] }).onDelete("restrict"),
  foreignKey({ name: `fk_${table}_currev`, columns: [t.currentRevisionId], foreignColumns: [revisions.id] }).onDelete("restrict"),
  check(`ck_${table}_live`, sql`${t.publicationStatus} <> 'published' OR ${t.publishedRevisionId} IS NOT NULL`),
  check(`ck_${table}_archived`, sql`${t.publicationStatus} <> 'archived' OR ${t.draftStatus} = 'none'`),
  ...(options.slug === false ? [] : [check(`ck_${table}_slug`, slugCheck(t.slug))]),
];

const slugCheck = (column: AnyMySqlColumn): SQL => sql`${column} REGEXP ${sql.raw(`'${SLUG_CHECK}'`)}`;

/** The constraints of a translation table: parent (CASCADE), locale (RESTRICT), actors. */
const translationConstraints = (table: string, t: Columns, parentColumn: string, parent: AnyMySqlColumn) => [
  primaryKey({ columns: [t[parentColumn], t.locale] }),
  foreignKey({ name: `fk_${table}_parent`, columns: [t[parentColumn]], foreignColumns: [parent] }).onDelete("cascade"),
  foreignKey({ name: `fk_${table}_locale`, columns: [t.locale], foreignColumns: [locales.code] }).onDelete("restrict"),
  ...actorKeys(table, t, ["completedBy", "updatedBy"]),
];

// --- Revisions, orderings and the admin search index ----------------------------------------------------------------

/**
 * Immutable aggregate snapshots (A1). Created in A3 because every root's PUB columns refer to it; A3 writes no revision
 * (version history, restore and publication are A8), so with `ck_*_live` no A3 row can ever be "published".
 */
export const revisions = mysqlTable(
  "revisions",
  {
    id: ulidColumn("id").primaryKey(),
    entityType: asciiColumn("entity_type", { length: 32 }).notNull(),
    entityId: asciiColumn("entity_id", { length: 64 }).notNull(),
    revisionNumber: int("revision_number", { unsigned: true }).notNull(),
    kind: mysqlEnum("kind", REVISION_KINDS).notNull(),
    schemaVersion: smallint("schema_version", { unsigned: true }).notNull(),
    snapshot: jsonColumn("snapshot").notNull(),
    snapshotSha256: hashColumn("snapshot_sha256").notNull(),
    baseRevisionId: ulidColumn("base_revision_id"),
    restoredFromId: ulidColumn("restored_from_id"),
    message: varchar("message", { length: 500 }),
    localesChanged: varchar("locales_changed", { length: 64 }),
    liveFrom: instant("live_from"),
    liveUntil: instant("live_until"),
    isSealed: boolean("is_sealed").notNull(),
    createdAt: instant("created_at").notNull(),
    createdBy: ulidColumn("created_by"),
  },
  (t) => [
    uniqueIndex("uq_revisions_number").on(t.entityType, t.entityId, t.revisionNumber),
    index("ix_revisions_entity").on(t.entityType, t.entityId, t.createdAt),
    index("ix_revisions_kind").on(t.kind, t.createdAt),
    foreignKey({ name: "fk_revisions_created_by", columns: [t.createdBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

/** The order of a whole collection (A1): one row per collection, seeded; `lock_version` guards reordering. */
export const entityOrderings = mysqlTable(
  "entity_orderings",
  {
    key: asciiColumn("key", { length: 32 }).primaryKey(),
    entityType: asciiColumn("entity_type", { length: 32 }).notNull(),
    ...pub(),
    ...ts(),
  },
  (t) => [...rootConstraints("entity_orderings", t, { slug: false, softDelete: false })],
);

/** The working order of a collection: one position per item, never two items at one position. */
export const entityOrderingItems = mysqlTable(
  "entity_ordering_items",
  {
    orderingKey: asciiColumn("ordering_key", { length: 32 }).notNull(),
    entityId: ulidColumn("entity_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orderingKey, t.entityId] }),
    uniqueIndex("uq_entity_ordering_items_position").on(t.orderingKey, t.position),
    foreignKey({ name: "fk_entity_ordering_items_ordering", columns: [t.orderingKey], foreignColumns: [entityOrderings.key] }).onDelete("cascade"),
  ],
);

/** Admin search: one normalized row per aggregate, language and scope (A3 writes the working scope only). */
export const searchDocuments = mysqlTable(
  "search_documents",
  {
    entityType: asciiColumn("entity_type", { length: 32 }).notNull(),
    entityId: asciiColumn("entity_id", { length: 64 }).notNull(),
    locale: localeColumn("locale").notNull(),
    scope: mysqlEnum("scope", SEARCH_SCOPES).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: mediumtext("body").notNull(),
    updatedAt: instant("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entityType, t.entityId, t.locale, t.scope] }),
    index("ix_search_documents_scope").on(t.entityType, t.locale, t.scope),
    foreignKey({ name: "fk_search_documents_locale", columns: [t.locale], foreignColumns: [locales.code] }).onDelete("restrict"),
  ],
);

// --- Pages -----------------------------------------------------------------------------------------------------------

export const pages = mysqlTable(
  "pages",
  {
    id: ulidColumn("id").primaryKey(),
    pageType: mysqlEnum("page_type", PAGE_TYPES).notNull(),
    systemKey: asciiColumn("system_key", { length: 32 }),
    slug: asciiColumn("slug", { length: 80 }),
    parentId: ulidColumn("parent_id"),
    templateKey: asciiColumn("template_key", { length: 32 }),
    headerVariant: mysqlEnum("header_variant", ["standard"]).notNull().default("standard"),
    footerVariant: mysqlEnum("footer_variant", ["standard"]).notNull().default("standard"),
    navHidden: boolean("nav_hidden").notNull().default(false),
    requiresLegalReview: boolean("requires_legal_review").notNull().default(false),
    effectiveDate: date("effective_date", { mode: "string" }),
    ...seoRoot(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [
    uniqueIndex("uq_pages_system_key").on(t.systemKey),
    uniqueIndex("uq_pages_slug").on(t.slug),
    index("ix_pages_type").on(t.pageType),
    foreignKey({ name: "fk_pages_parent", columns: [t.parentId], foreignColumns: [t.id] }).onDelete("restrict"),
    ...rootConstraints("pages", t),
    check("ck_pages_generic_slug", sql`(${t.pageType} = 'generic') = (${t.slug} IS NOT NULL)`),
    check("ck_pages_system_key", sql`(${t.pageType} <> 'generic') = (${t.systemKey} IS NOT NULL)`),
    check("ck_pages_legal_review", sql`${t.pageType} <> 'legal' OR ${t.requiresLegalReview} = 1`),
  ],
);

export const pageTranslations = mysqlTable(
  "page_translations",
  {
    pageId: ulidColumn("page_id").notNull(),
    locale: localeColumn("locale").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    navLabel: varchar("nav_label", { length: 80 }),
    ...seoText(),
    ...tr(),
  },
  (t) => translationConstraints("page_translations", t, "pageId", pages.id),
);

// --- Services --------------------------------------------------------------------------------------------------------

export const services = mysqlTable(
  "services",
  {
    id: ulidColumn("id").primaryKey(),
    slug: asciiColumn("slug", { length: 80 }).notNull(),
    serviceGroup: mysqlEnum("service_group", SERVICE_GROUPS).notNull(),
    iconKey: asciiColumn("icon_key", { length: 32 }).notNull(),
    ...src(),
    ...seoRoot(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [uniqueIndex("uq_services_slug").on(t.slug), ...rootConstraints("services", t)],
);

export const serviceTranslations = mysqlTable(
  "service_translations",
  {
    serviceId: ulidColumn("service_id").notNull(),
    locale: localeColumn("locale").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    tagline: varchar("tagline", { length: 200 }).notNull(),
    summary: text("summary").notNull(),
    /** Rich-text document (A1-CONTENT-MODEL §12); A3 writes paragraphs only. */
    body: jsonColumn("body").notNull(),
    /** Ordered list of short strings (≤ 8). */
    highlights: jsonColumn("highlights").notNull(),
    ...seoText(),
    ...tr(),
  },
  (t) => translationConstraints("service_translations", t, "serviceId", services.id),
);

// --- Machines --------------------------------------------------------------------------------------------------------

export const machines = mysqlTable(
  "machines",
  {
    id: ulidColumn("id").primaryKey(),
    slug: asciiColumn("slug", { length: 80 }).notNull(),
    /** NULL = not stated (never a default). */
    powerWatts: int("power_watts", { unsigned: true }),
    primaryServiceId: ulidColumn("primary_service_id"),
    ...src(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [
    uniqueIndex("uq_machines_slug").on(t.slug),
    foreignKey({ name: "fk_machines_primary_service", columns: [t.primaryServiceId], foreignColumns: [services.id] }).onDelete("restrict"),
    ...rootConstraints("machines", t),
  ],
);

export const machineTranslations = mysqlTable(
  "machine_translations",
  {
    machineId: ulidColumn("machine_id").notNull(),
    locale: localeColumn("locale").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    shortName: varchar("short_name", { length: 80 }).notNull(),
    category: varchar("category", { length: 160 }).notNull(),
    capability: text("capability").notNull(),
    ...tr(),
  },
  (t) => translationConstraints("machine_translations", t, "machineId", machines.id),
);

/** A machine's technical attributes (A3 brief §26–27; A1's `certificate_facts` pattern): ordered label/value pairs. */
export const machineAttributes = mysqlTable(
  "machine_attributes",
  {
    id: ulidColumn("id").primaryKey(),
    machineId: ulidColumn("machine_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    uniqueIndex("uq_machine_attributes_position").on(t.machineId, t.position),
    foreignKey({ name: "fk_machine_attributes_machine", columns: [t.machineId], foreignColumns: [machines.id] }).onDelete("cascade"),
  ],
);

export const machineAttributeTranslations = mysqlTable(
  "machine_attribute_translations",
  {
    attributeId: ulidColumn("attribute_id").notNull(),
    locale: localeColumn("locale").notNull(),
    label: varchar("label", { length: 80 }).notNull(),
    value: varchar("value", { length: 200 }).notNull(),
    ...tr(),
  },
  (t) => translationConstraints("machine_attribute_translations", t, "attributeId", machineAttributes.id),
);

// --- Clients (before projects: a project may name its client) -------------------------------------------------------

export const clients = mysqlTable(
  "clients",
  {
    id: ulidColumn("id").primaryKey(),
    slug: asciiColumn("slug", { length: 80 }).notNull(),
    /** Not shown on the site today; showing links needs the Owner's decision (A1). */
    websiteUrl: varchar("website_url", { length: 255 }),
    /** A3 brief §29 (like `projects.is_featured`): a working flag for future selections; no public effect. */
    isFeatured: boolean("is_featured").notNull().default(false),
    ...src(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [uniqueIndex("uq_clients_slug").on(t.slug), ...rootConstraints("clients", t)],
);

export const clientTranslations = mysqlTable(
  "client_translations",
  {
    clientId: ulidColumn("client_id").notNull(),
    locale: localeColumn("locale").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    ...tr(),
  },
  (t) => translationConstraints("client_translations", t, "clientId", clients.id),
);

// --- Projects and their categories -----------------------------------------------------------------------------------

export const projects = mysqlTable(
  "projects",
  {
    id: ulidColumn("id").primaryKey(),
    slug: asciiColumn("slug", { length: 80 }).notNull(),
    galleryRef: varchar("gallery_ref", { length: 16 }),
    year: smallint("year", { unsigned: true }),
    clientId: ulidColumn("client_id"),
    isFeatured: boolean("is_featured").notNull().default(false),
    ...src(),
    ...seoRoot(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [
    uniqueIndex("uq_projects_slug").on(t.slug),
    foreignKey({ name: "fk_projects_client", columns: [t.clientId], foreignColumns: [clients.id] }).onDelete("restrict"),
    ...rootConstraints("projects", t),
  ],
);

export const projectTranslations = mysqlTable(
  "project_translations",
  {
    projectId: ulidColumn("project_id").notNull(),
    locale: localeColumn("locale").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    summary: text("summary").notNull(),
    scope: text("scope"),
    /** Rich-text document (A3: paragraphs only). */
    description: jsonColumn("description"),
    materials: varchar("materials", { length: 500 }),
    location: varchar("location", { length: 200 }),
    clientName: varchar("client_name", { length: 200 }),
    challenge: text("challenge"),
    solution: text("solution"),
    ...seoText(),
    ...tr(),
  },
  (t) => translationConstraints("project_translations", t, "projectId", projects.id),
);

export const projectCategories = mysqlTable(
  "project_categories",
  {
    id: ulidColumn("id").primaryKey(),
    slug: asciiColumn("slug", { length: 80 }).notNull(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [uniqueIndex("uq_project_categories_slug").on(t.slug), ...rootConstraints("project_categories", t)],
);

export const projectCategoryTranslations = mysqlTable(
  "project_category_translations",
  {
    categoryId: ulidColumn("category_id").notNull(),
    locale: localeColumn("locale").notNull(),
    label: varchar("label", { length: 80 }).notNull(),
    ...tr(),
  },
  (t) => translationConstraints("project_category_translations", t, "categoryId", projectCategories.id),
);

export const projectCategoryAssignments = mysqlTable(
  "project_category_assignments",
  {
    projectId: ulidColumn("project_id").notNull(),
    categoryId: ulidColumn("category_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.categoryId] }),
    index("ix_project_category_assignments_category").on(t.categoryId),
    foreignKey({ name: "fk_project_category_assignments_project", columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_project_category_assignments_category", columns: [t.categoryId], foreignColumns: [projectCategories.id] }).onDelete(
      "restrict",
    ),
  ],
);

export const projectServices = mysqlTable(
  "project_services",
  {
    projectId: ulidColumn("project_id").notNull(),
    serviceId: ulidColumn("service_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.serviceId] }),
    index("ix_project_services_service").on(t.serviceId),
    foreignKey({ name: "fk_project_services_project", columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_project_services_service", columns: [t.serviceId], foreignColumns: [services.id] }).onDelete("restrict"),
  ],
);

/** Open questions that restrict a project (A1): the policy lives in code; an unknown flag restricts. */
export const projectFlags = mysqlTable(
  "project_flags",
  {
    projectId: ulidColumn("project_id").notNull(),
    flag: asciiColumn("flag", { length: 32 }).notNull(),
    note: varchar("note", { length: 500 }),
    createdAt: instant("created_at").notNull(),
    createdBy: ulidColumn("created_by"),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.flag] }),
    foreignKey({ name: "fk_project_flags_project", columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_project_flags_created_by", columns: [t.createdBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

// --- Service relations (after machines and projects) -----------------------------------------------------------------

export const serviceMachines = mysqlTable(
  "service_machines",
  {
    serviceId: ulidColumn("service_id").notNull(),
    machineId: ulidColumn("machine_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.machineId] }),
    foreignKey({ name: "fk_service_machines_service", columns: [t.serviceId], foreignColumns: [services.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_service_machines_machine", columns: [t.machineId], foreignColumns: [machines.id] }).onDelete("restrict"),
  ],
);

export const serviceRelatedServices = mysqlTable(
  "service_related_services",
  {
    serviceId: ulidColumn("service_id").notNull(),
    relatedServiceId: ulidColumn("related_service_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.relatedServiceId] }),
    foreignKey({ name: "fk_service_related_services_service", columns: [t.serviceId], foreignColumns: [services.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_service_related_services_related", columns: [t.relatedServiceId], foreignColumns: [services.id] }).onDelete("restrict"),
    check("ck_service_related_services_self", sql`${t.serviceId} <> ${t.relatedServiceId}`),
  ],
);

/** Projects shown on a service page: only projects whose own record lists the service (checked on save). */
export const serviceFeaturedProjects = mysqlTable(
  "service_featured_projects",
  {
    serviceId: ulidColumn("service_id").notNull(),
    projectId: ulidColumn("project_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.serviceId, t.projectId] }),
    foreignKey({ name: "fk_service_featured_projects_service", columns: [t.serviceId], foreignColumns: [services.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_service_featured_projects_project", columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("restrict"),
  ],
);

// --- Industries ------------------------------------------------------------------------------------------------------

export const industries = mysqlTable(
  "industries",
  {
    id: ulidColumn("id").primaryKey(),
    slug: asciiColumn("slug", { length: 80 }).notNull(),
    /** PUBLIC: the page distinguishes sectors named in the profile from website classifications. */
    classification: mysqlEnum("classification", INDUSTRY_CLASSIFICATIONS).notNull(),
    ...src(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [uniqueIndex("uq_industries_slug").on(t.slug), ...rootConstraints("industries", t)],
);

export const industryTranslations = mysqlTable(
  "industry_translations",
  {
    industryId: ulidColumn("industry_id").notNull(),
    locale: localeColumn("locale").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    ...tr(),
  },
  (t) => translationConstraints("industry_translations", t, "industryId", industries.id),
);

export const industryServices = mysqlTable(
  "industry_services",
  {
    industryId: ulidColumn("industry_id").notNull(),
    serviceId: ulidColumn("service_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.industryId, t.serviceId] }),
    index("ix_industry_services_service").on(t.serviceId),
    foreignKey({ name: "fk_industry_services_industry", columns: [t.industryId], foreignColumns: [industries.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_industry_services_service", columns: [t.serviceId], foreignColumns: [services.id] }).onDelete("restrict"),
  ],
);

/** Projects related to a sector (A3 brief §28/§32; A1's `industry_services` pattern). */
export const industryProjects = mysqlTable(
  "industry_projects",
  {
    industryId: ulidColumn("industry_id").notNull(),
    projectId: ulidColumn("project_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.industryId, t.projectId] }),
    index("ix_industry_projects_project").on(t.projectId),
    foreignKey({ name: "fk_industry_projects_industry", columns: [t.industryId], foreignColumns: [industries.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_industry_projects_project", columns: [t.projectId], foreignColumns: [projects.id] }).onDelete("restrict"),
  ],
);

// --- Certificates (document metadata; files arrive in A4) -----------------------------------------------------------

export const certificates = mysqlTable(
  "certificates",
  {
    id: ulidColumn("id").primaryKey(),
    slug: asciiColumn("slug", { length: 80 }).notNull(),
    /** ADMIN-ONLY renewal reminder; never rendered. */
    expiresOn: date("expires_on", { mode: "string" }),
    ...src(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [uniqueIndex("uq_certificates_slug").on(t.slug), ...rootConstraints("certificates", t)],
);

export const certificateTranslations = mysqlTable(
  "certificate_translations",
  {
    certificateId: ulidColumn("certificate_id").notNull(),
    locale: localeColumn("locale").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    issuer: varchar("issuer", { length: 200 }).notNull(),
    ...tr(),
  },
  (t) => translationConstraints("certificate_translations", t, "certificateId", certificates.id),
);

/** Displayed facts (entity type, issued, status …), in order. Never a registration number (digit guard). */
export const certificateFacts = mysqlTable(
  "certificate_facts",
  {
    id: ulidColumn("id").primaryKey(),
    certificateId: ulidColumn("certificate_id").notNull(),
    position: int("position", { unsigned: true }).notNull(),
  },
  (t) => [
    uniqueIndex("uq_certificate_facts_position").on(t.certificateId, t.position),
    foreignKey({ name: "fk_certificate_facts_certificate", columns: [t.certificateId], foreignColumns: [certificates.id] }).onDelete("cascade"),
  ],
);

export const certificateFactTranslations = mysqlTable(
  "certificate_fact_translations",
  {
    factId: ulidColumn("fact_id").notNull(),
    locale: localeColumn("locale").notNull(),
    label: varchar("label", { length: 80 }).notNull(),
    value: varchar("value", { length: 200 }).notNull(),
    ...tr(),
  },
  (t) => translationConstraints("certificate_fact_translations", t, "factId", certificateFacts.id),
);
