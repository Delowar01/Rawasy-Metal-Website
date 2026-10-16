/**
 * The A4 media library tables of the A1 schema (A1-DATABASE-SCHEMA §7 "Media library"; A1-MEDIA-STORAGE): folders, the
 * media items' stable identities, their binary versions and derived variants, bilingual metadata, safety flags and the
 * materialized public delivery state. A1 placed the registry part (assets, files, translations, flags, public_media) in
 * A3; the approved A3 left every media table and reference to A4, which builds them here together (A4 brief §4, §7).
 *
 * Content refers to `media_assets.id` (a ULID), never to a file name or storage key. A replacement adds a
 * `media_files` row (a new version) and keeps the id; a binary is never rewritten in place. `public_media` holds a row
 * exactly for the items that are deliverable (public, approved, no blocking flag, not in the Trash, current file
 * ready), rebuilt in the same transaction as any change to those inputs (`src/server/media/deliverability.ts`). The
 * public website does not read these tables before the A9 cutover (T1 = Option B).
 *
 * Additions beyond A1's catalogue, each reported in the A4 report: `media_assets.lock_version` (optimistic concurrency
 * of metadata edits and approvals, A1 §4.3's rule for editing) and `approval_note` (the approver's note, beside A1's
 * `restriction_reason`); `media_files.superseded_at` (when a version stopped being current: the 30-day retention clock);
 * `media_variants.sha256` (the delivery route's ETag and the maintenance integrity check).
 *
 * Source of truth for `drizzle-kit generate`; queries use Drizzle's core builder only (no relations declared).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  decimal,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  varchar,
  type MySqlTableExtraConfigValue,
} from "drizzle-orm/mysql-core";
import { asciiColumn, hashColumn, instant, jsonColumn, localeColumn, ulidColumn } from "./columns.ts";
import { locales, users } from "./schema.ts";

const now3 = sql`CURRENT_TIMESTAMP(3)`;

export const MEDIA_KINDS = ["image", "svg", "document"] as const;
export const MEDIA_VISIBILITIES = ["public", "private"] as const;
export const MEDIA_USAGE_STATUSES = ["pending_review", "approved", "restricted", "internal", "archived"] as const;
export const MEDIA_STORAGE_AREAS = ["release", "originals", "private"] as const;
export const MEDIA_PROCESSING_STATUSES = ["uploaded", "processing", "ready", "failed"] as const;
export const MEDIA_VARIANT_FORMATS = ["webp", "avif", "jpeg", "png"] as const;
const TRANSLATION_STATES = ["draft", "complete", "needs_review"] as const;

/** Optional folders for organizing the library: no effect on any address or storage key. */
export const mediaFolders = mysqlTable(
  "media_folders",
  {
    id: ulidColumn("id").primaryKey(),
    parentId: ulidColumn("parent_id"),
    name: varchar("name", { length: 120 }).notNull(),
    position: int("position", { unsigned: true }).notNull(),
    createdAt: instant("created_at").notNull().default(now3),
    createdBy: ulidColumn("created_by"),
    updatedAt: instant("updated_at").notNull().default(now3),
    updatedBy: ulidColumn("updated_by"),
  },
  (t) => [
    // A1: unique (parent_id, name). MariaDB treats NULLs as distinct, so top-level names are kept unique by the folder
    // service under the folder tree's lock (src/server/media/folders.ts).
    uniqueIndex("uq_media_folders_name").on(t.parentId, t.name),
    foreignKey({ name: "fk_media_folders_parent", columns: [t.parentId], foreignColumns: [t.id] }).onDelete("restrict"),
    foreignKey({ name: "fk_media_folders_created_by", columns: [t.createdBy], foreignColumns: [users.id] }).onDelete("set null"),
    foreignKey({ name: "fk_media_folders_updated_by", columns: [t.updatedBy], foreignColumns: [users.id] }).onDelete("set null"),
    check("ck_media_folders_self", sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`),
  ],
);

/** A media item's stable identity, rights and status. Replacing the file keeps the id. */
export const mediaAssets = mysqlTable(
  "media_assets",
  {
    id: ulidColumn("id").primaryKey(),
    /** Today's MediaId of a release-bundled file, e.g. 'projects/tulip-roundabout-1' (migration mapping). */
    legacyKey: asciiColumn("legacy_key", { length: 120 }),
    folderId: ulidColumn("folder_id"),
    kind: mysqlEnum("kind", MEDIA_KINDS).notNull(),
    /** Delivery class, fixed at creation: a private item is never deliverable publicly, whatever else changes. */
    visibility: mysqlEnum("visibility", MEDIA_VISIBILITIES).notNull(),
    usageStatus: mysqlEnum("usage_status", MEDIA_USAGE_STATUSES).notNull().default("pending_review"),
    currentFileId: ulidColumn("current_file_id"),
    focalX: decimal("focal_x", { precision: 4, scale: 3 }),
    focalY: decimal("focal_y", { precision: 4, scale: 3 }),
    rightsHolder: varchar("rights_holder", { length: 200 }),
    /** ADMIN-ONLY. */
    rightsNote: text("rights_note"),
    licenceExpiresOn: date("licence_expires_on", { mode: "string" }),
    /** ADMIN-ONLY provenance. */
    sourceNote: text("source_note"),
    approvedAt: instant("approved_at"),
    approvedBy: ulidColumn("approved_by"),
    /** The approver's note (A4 addition beside A1's restriction_reason). */
    approvalNote: varchar("approval_note", { length: 500 }),
    restrictedAt: instant("restricted_at"),
    restrictedBy: ulidColumn("restricted_by"),
    /** ADMIN-ONLY. */
    restrictionReason: varchar("restriction_reason", { length: 500 }),
    /** Optimistic concurrency (A4 addition; A1 §4.3): +1 per metadata save, status change or file switch — not per flag. */
    lockVersion: int("lock_version", { unsigned: true }).notNull().default(0),
    createdAt: instant("created_at").notNull().default(now3),
    createdBy: ulidColumn("created_by"),
    updatedAt: instant("updated_at").notNull().default(now3),
    updatedBy: ulidColumn("updated_by"),
    deletedAt: instant("deleted_at"),
    deletedBy: ulidColumn("deleted_by"),
  },
  // Annotated: media_assets and media_files refer to each other, which TypeScript cannot infer.
  (t): MySqlTableExtraConfigValue[] => [
    uniqueIndex("uq_media_assets_legacy_key").on(t.legacyKey),
    index("ix_media_assets_status").on(t.usageStatus, t.visibility),
    index("ix_media_assets_folder").on(t.folderId),
    index("ix_media_assets_deleted").on(t.deletedAt),
    foreignKey({ name: "fk_media_assets_folder", columns: [t.folderId], foreignColumns: [mediaFolders.id] }).onDelete("set null"),
    foreignKey({ name: "fk_media_assets_current_file", columns: [t.currentFileId], foreignColumns: [mediaFiles.id] }).onDelete("restrict"),
    ...(["approvedBy", "restrictedBy", "createdBy", "updatedBy", "deletedBy"] as const).map((c) =>
      foreignKey({ name: `fk_media_assets_${c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`, columns: [t[c]], foreignColumns: [users.id] }).onDelete("set null"),
    ),
    // A1: a private item is internal, archived or restricted — never pending review or approved.
    check("ck_media_assets_private", sql`${t.visibility} = 'public' OR ${t.usageStatus} IN ('internal', 'archived', 'restricted')`),
    check("ck_media_assets_focal", sql`(${t.focalX} IS NULL) = (${t.focalY} IS NULL) AND (${t.focalX} IS NULL OR (${t.focalX} BETWEEN 0 AND 1 AND ${t.focalY} BETWEEN 0 AND 1))`),
  ],
);

/** Binary versions of a media item (a replacement adds a version; the previous one stays). */
export const mediaFiles = mysqlTable(
  "media_files",
  {
    id: ulidColumn("id").primaryKey(),
    mediaId: ulidColumn("media_id").notNull(),
    version: smallint("version", { unsigned: true }).notNull(),
    /** release = public/media in the app build (today's files); originals and private live under RAWASY_DATA_DIR. */
    storageArea: mysqlEnum("storage_area", MEDIA_STORAGE_AREAS).notNull(),
    /** Generated by the server (never from a file name): '2026/10/01J9….jpg'; release: '/media/projects/x.webp'. */
    storageKey: asciiColumn("storage_key", { length: 255 }).notNull(),
    /** Display only (sanitized); never used to build a path. */
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    /** From the file's signature, never the browser. */
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    extension: varchar("extension", { length: 10 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number", unsigned: true }).notNull(),
    sha256: hashColumn("sha256").notNull(),
    width: int("width", { unsigned: true }),
    height: int("height", { unsigned: true }),
    pageCount: smallint("page_count", { unsigned: true }),
    blurDataUrl: varchar("blur_data_url", { length: 600 }),
    processingStatus: mysqlEnum("processing_status", MEDIA_PROCESSING_STATUSES).notNull(),
    processingError: varchar("processing_error", { length: 500 }),
    uploadedAt: instant("uploaded_at").notNull(),
    uploadedBy: ulidColumn("uploaded_by"),
    /** When this version stopped being the current one (A4 addition: the retention clock of old versions). */
    supersededAt: instant("superseded_at"),
  },
  (t): MySqlTableExtraConfigValue[] => [
    uniqueIndex("uq_media_files_version").on(t.mediaId, t.version),
    uniqueIndex("uq_media_files_storage").on(t.storageArea, t.storageKey),
    index("ix_media_files_sha256").on(t.sha256),
    index("ix_media_files_status").on(t.processingStatus),
    foreignKey({ name: "fk_media_files_media", columns: [t.mediaId], foreignColumns: [mediaAssets.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_media_files_uploaded_by", columns: [t.uploadedBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

/** Derivatives generated once from a file (WebP widths and the admin thumbnail), never wider than the source. */
export const mediaVariants = mysqlTable(
  "media_variants",
  {
    id: ulidColumn("id").primaryKey(),
    fileId: ulidColumn("file_id").notNull(),
    /** 'w320', 'w640', 'w1080', 'w1600', 'w2048', 'thumb' (and 'w<n>' for a source narrower than 320). */
    variantKey: asciiColumn("variant_key", { length: 32 }).notNull(),
    format: mysqlEnum("format", MEDIA_VARIANT_FORMATS).notNull(),
    width: int("width", { unsigned: true }).notNull(),
    height: int("height", { unsigned: true }).notNull(),
    byteSize: bigint("byte_size", { mode: "number", unsigned: true }).notNull(),
    /** Content-hashed name under derived/<media-ulid>/. */
    storageKey: asciiColumn("storage_key", { length: 255 }).notNull(),
    /** A4 addition: the variant's bytes (ETag, integrity check). */
    sha256: hashColumn("sha256").notNull(),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("uq_media_variants_key").on(t.fileId, t.variantKey),
    uniqueIndex("uq_media_variants_storage").on(t.storageKey),
    foreignKey({ name: "fk_media_variants_file", columns: [t.fileId], foreignColumns: [mediaFiles.id] }).onDelete("cascade"),
  ],
);

/** Default title, alt text and caption per language (a usage may override them). alt_text '' = decorative; NULL = not decided. */
export const mediaTranslations = mysqlTable(
  "media_translations",
  {
    mediaId: ulidColumn("media_id").notNull(),
    locale: localeColumn("locale").notNull(),
    altText: varchar("alt_text", { length: 500 }),
    caption: varchar("caption", { length: 500 }),
    title: varchar("title", { length: 200 }),
    translationStatus: mysqlEnum("translation_status", TRANSLATION_STATES).notNull().default("draft"),
    completedAt: instant("completed_at"),
    completedBy: ulidColumn("completed_by"),
    updatedAt: instant("updated_at").notNull().default(now3),
    updatedBy: ulidColumn("updated_by"),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.locale] }),
    foreignKey({ name: "fk_media_translations_parent", columns: [t.mediaId], foreignColumns: [mediaAssets.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_media_translations_locale", columns: [t.locale], foreignColumns: [locales.code] }).onDelete("restrict"),
    foreignKey({ name: "fk_media_translations_completed_by", columns: [t.completedBy], foreignColumns: [users.id] }).onDelete("set null"),
    foreignKey({ name: "fk_media_translations_updated_by", columns: [t.updatedBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

/** Why an item may not be shown. The policy (blocking or informative) is code; an unknown flag blocks. */
export const mediaFlags = mysqlTable(
  "media_flags",
  {
    mediaId: ulidColumn("media_id").notNull(),
    flag: asciiColumn("flag", { length: 32 }).notNull(),
    /** ADMIN-ONLY. */
    note: varchar("note", { length: 500 }),
    createdAt: instant("created_at").notNull(),
    createdBy: ulidColumn("created_by"),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.flag] }),
    index("ix_media_flags_flag").on(t.flag),
    foreignKey({ name: "fk_media_flags_media", columns: [t.mediaId], foreignColumns: [mediaAssets.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_media_flags_created_by", columns: [t.createdBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

/**
 * Materialized public delivery record: a row exists only while the item is deliverable. Built only by the media
 * service (never edited from the admin); the delivery route and, after A9, the public site read media only here.
 */
export const publicMedia = mysqlTable(
  "public_media",
  {
    mediaId: ulidColumn("media_id").primaryKey(),
    fileId: ulidColumn("file_id").notNull(),
    legacyKey: asciiColumn("legacy_key", { length: 120 }),
    kind: mysqlEnum("kind", MEDIA_KINDS).notNull(),
    /** '/media/…' (release files) or '/media/u/{id}/{variant}-{hash}.{ext}' (persistent store). */
    src: varchar("src", { length: 255 }).notNull(),
    width: int("width", { unsigned: true }),
    height: int("height", { unsigned: true }),
    blurDataUrl: varchar("blur_data_url", { length: 600 }),
    /** Derived list of {width, url}, rebuilt, never edited. */
    variants: jsonColumn("variants"),
    /** Derived {locale: alt} from media_translations. */
    defaultAlt: jsonColumn("default_alt"),
    updatedAt: instant("updated_at").notNull(),
  },
  (t) => [
    index("ix_public_media_file").on(t.fileId),
    foreignKey({ name: "fk_public_media_media", columns: [t.mediaId], foreignColumns: [mediaAssets.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_public_media_file", columns: [t.fileId], foreignColumns: [mediaFiles.id] }).onDelete("cascade"),
  ],
);
