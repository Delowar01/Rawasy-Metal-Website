/**
 * The A8 tables of the A1 schema (A1-DATABASE-SCHEMA §7 "Revisions, publishing and the public read model"): the public
 * read model (`published_documents`), the reference index (`content_references`), reviewers' comments
 * (`review_comments`), the shared cache invalidation record (`cache_generation`, `cache_invalidations`) and the job log
 * (`system_job_runs`). `revisions` exists since A3 (every root's publication columns refer to it).
 *
 * T1 = Option B: the public website reads none of them before the A9 cutover. A publish writes the projection into
 * `published_documents` and records its cache invalidations, so A9's database mode starts from a correct, complete
 * state; until then the public pages stay prerendered from `src/content/*`.
 *
 * Unchanged from A1 except (A8 report, item 4):
 * - `scheduled_publications` is not created: scheduling needs the cron runner and `CRON_SECRET` (pre-staging, A1 §7),
 *   and the A8 brief does not ask for it; it stays in A1's design for a later, Owner-approved step.
 * - `content_references.field_path` is ASCII (paths are built from registry keys and indexes).
 * - checks for what the application validates too (the singleton row, positive generations).
 *
 * Source of truth for `drizzle-kit generate`; queries use Drizzle's core builder only.
 */
import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, mysqlEnum, mysqlTable, primaryKey, smallint, text, tinyint, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { asciiColumn, hashColumn, instant, jsonColumn, localeColumn, ulidColumn } from "./columns.ts";
import { locales, users } from "./schema.ts";
import { revisions } from "./schema-cms.ts";

const now3 = sql`CURRENT_TIMESTAMP(3)`;

export const REFERENCE_SCOPES = ["working", "published"] as const;
export const REVIEW_COMMENT_STATUSES = ["open", "resolved"] as const;
export const JOB_STATUSES = ["running", "success", "failed", "skipped"] as const;

/** THE public read model: one row per live aggregate with its public projection (written only by publish/unpublish). */
export const publishedDocuments = mysqlTable(
  "published_documents",
  {
    entityType: asciiColumn("entity_type", { length: 32 }).notNull(),
    entityId: asciiColumn("entity_id", { length: 64 }).notNull(),
    revisionId: ulidColumn("revision_id").notNull(),
    slug: asciiColumn("slug", { length: 80 }),
    schemaVersion: smallint("schema_version", { unsigned: true }).notNull(),
    document: jsonColumn("document").notNull(),
    contentSha256: hashColumn("content_sha256").notNull(),
    publishedAt: instant("published_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entityType, t.entityId] }),
    uniqueIndex("uq_published_documents_slug").on(t.entityType, t.slug),
    index("ix_published_documents_time").on(t.entityType, t.publishedAt),
    foreignKey({ name: "fk_published_documents_revision", columns: [t.revisionId], foreignColumns: [revisions.id] }).onDelete("restrict"),
  ],
);

/** Every reference one aggregate makes to another, for its working copy and for its live version. Derived, rebuilt. */
export const contentReferences = mysqlTable(
  "content_references",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    scope: mysqlEnum("scope", REFERENCE_SCOPES).notNull(),
    sourceType: asciiColumn("source_type", { length: 32 }).notNull(),
    sourceId: asciiColumn("source_id", { length: 64 }).notNull(),
    sourceSectionId: ulidColumn("source_section_id"),
    fieldPath: asciiColumn("field_path", { length: 191 }).notNull(),
    targetType: asciiColumn("target_type", { length: 32 }).notNull(),
    targetId: asciiColumn("target_id", { length: 64 }).notNull(),
  },
  (t) => [
    index("ix_content_references_target").on(t.targetType, t.targetId, t.scope),
    index("ix_content_references_source").on(t.sourceType, t.sourceId, t.scope),
  ],
);

/** A reviewer's comment on a draft (request changes), optionally on one section or language. ADMIN-ONLY. */
export const reviewComments = mysqlTable(
  "review_comments",
  {
    id: ulidColumn("id").primaryKey(),
    entityType: asciiColumn("entity_type", { length: 32 }).notNull(),
    entityId: asciiColumn("entity_id", { length: 64 }).notNull(),
    revisionId: ulidColumn("revision_id"),
    sectionId: ulidColumn("section_id"),
    locale: localeColumn("locale"),
    authorId: ulidColumn("author_id"),
    body: text("body").notNull(),
    status: mysqlEnum("status", REVIEW_COMMENT_STATUSES).notNull().default("open"),
    resolvedBy: ulidColumn("resolved_by"),
    resolvedAt: instant("resolved_at"),
    createdAt: instant("created_at").notNull().default(now3),
  },
  (t) => [
    index("ix_review_comments_entity").on(t.entityType, t.entityId, t.status),
    foreignKey({ name: "fk_review_comments_revision", columns: [t.revisionId], foreignColumns: [revisions.id] }).onDelete("set null"),
    foreignKey({ name: "fk_review_comments_locale", columns: [t.locale], foreignColumns: [locales.code] }).onDelete("restrict"),
    foreignKey({ name: "fk_review_comments_author", columns: [t.authorId], foreignColumns: [users.id] }).onDelete("set null"),
    foreignKey({ name: "fk_review_comments_resolved_by", columns: [t.resolvedBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

/** Orders cache invalidations by commit (one row; the publishing transaction increments it as its last write). */
export const cacheGeneration = mysqlTable(
  "cache_generation",
  {
    id: tinyint("id", { unsigned: true }).primaryKey(),
    epoch: ulidColumn("epoch").notNull(),
    value: bigint("value", { mode: "number", unsigned: true }).notNull().default(0),
    updatedAt: instant("updated_at").notNull().default(now3),
  },
  (t) => [check("ck_cache_generation_singleton", sql`${t.id} = 1`)],
);

/** The newest invalidation of each cache tag, by generation (never purged). */
export const cacheInvalidations = mysqlTable(
  "cache_invalidations",
  {
    tag: asciiColumn("tag", { length: 255 }).primaryKey(),
    generation: bigint("generation", { mode: "number", unsigned: true }).notNull(),
    invalidatedAt: instant("invalidated_at").notNull(),
    updatedByRequest: ulidColumn("updated_by_request"),
  },
  (t) => [index("ix_cache_invalidations_generation").on(t.generation), check("ck_cache_invalidations_generation", sql`${t.generation} > 0`)],
);

/** Log of jobs and operator tools (reference rebuilds, backups, restore drills) for the dashboard and troubleshooting. */
export const systemJobRuns = mysqlTable(
  "system_job_runs",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    jobKey: asciiColumn("job_key", { length: 32 }).notNull(),
    startedAt: instant("started_at").notNull(),
    finishedAt: instant("finished_at"),
    status: mysqlEnum("status", JOB_STATUSES).notNull(),
    summary: varchar("summary", { length: 500 }),
    details: jsonColumn("details"),
  },
  (t) => [index("ix_system_job_runs_job").on(t.jobKey, t.startedAt)],
);
