/**
 * The A5 page-builder tables of the A1 schema (A1-DATABASE-SCHEMA §7 "Pages and the section (block) model";
 * A1-CONTENT-MODEL §5): the ordered sections (blocks) of a page or of a service's detail page, their localized content,
 * and the reusable (global) sections a page section can link. A3 left them to A5 (schema-cms.ts).
 *
 * A section row is a fixed relational skeleton — owner, position, block type and schema version, visibility per device,
 * structure lock, anchor, reusable link — with the block's non-localized `settings` as validated JSON; its copy is one
 * `page_section_translations.content` document per language. Both JSON documents are produced and validated by the
 * code-defined block registry (`src/server/builder/`), never typed by a person: no HTML, CSS, script or raw JSON.
 *
 * A section belongs to exactly one owner (a page or a service, CASCADE with it). A linked section names its reusable
 * section (RESTRICT: a reusable section that pages still link cannot be removed; detach first); `detached_from_id`
 * records where a detached copy came from (provenance, no foreign key). Reusable sections are aggregate roots with A1's
 * publication columns; A5 writes only working states (unpublished · draft, archived · none), A8 publishes.
 *
 * The public website never reads these tables before the A9 cutover (T1 = Option B). Source of truth for
 * `drizzle-kit generate`; queries use Drizzle's core builder only.
 */
import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, int, mysqlTable, smallint, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { asciiColumn, jsonColumn, localeColumn, ulidColumn } from "./columns.ts";
import { actorKeys, pages, pub, rootConstraints, sd, services, translationConstraints, tr, ts } from "./schema-cms.ts";

/** A registry key: a namespace and a name ("home.hero", "generic.text_image"). */
export const BLOCK_KEY_PATTERN = "^[a-z][a-z_]*\\.[a-z][a-z_]*$";
/** An in-page anchor: ASCII, lowercase, starting with a letter ("quote", "service-lines"). */
export const ANCHOR_PATTERN = "^[a-z][a-z0-9]*(-[a-z0-9]+)*$";

const regexp = (column: Parameters<typeof sql>[1], pattern: string) => sql`${column} REGEXP ${sql.raw(`'${pattern.replaceAll("\\", "\\\\")}'`)}`;

/** Global blocks used on several pages (A1 §5.7): one block's settings and copy, linked by page sections. */
export const reusableSections = mysqlTable(
  "reusable_sections",
  {
    id: ulidColumn("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    blockType: asciiColumn("block_type", { length: 64 }).notNull(),
    schemaVersion: smallint("schema_version", { unsigned: true }).notNull(),
    settings: jsonColumn("settings").notNull(),
    ...pub(),
    ...ts(),
    ...sd(),
  },
  (t) => [
    index("ix_reusable_sections_block_type").on(t.blockType),
    ...rootConstraints("reusable_sections", t, { slug: false }),
    check("ck_reusable_sections_block_type", regexp(t.blockType, BLOCK_KEY_PATTERN)),
    check("ck_reusable_sections_schema_version", sql`${t.schemaVersion} >= 1`),
  ],
);

/** A reusable section's copy, per language (validated by its block's content schema). */
export const reusableSectionTranslations = mysqlTable(
  "reusable_section_translations",
  {
    reusableSectionId: ulidColumn("reusable_section_id").notNull(),
    locale: localeColumn("locale").notNull(),
    content: jsonColumn("content").notNull(),
    ...tr(),
  },
  (t) => translationConstraints("reusable_section_translations", t, "reusableSectionId", reusableSections.id),
);

/** The ordered sections of a page or of a service's detail page. */
export const pageSections = mysqlTable(
  "page_sections",
  {
    id: ulidColumn("id").primaryKey(),
    pageId: ulidColumn("page_id"),
    serviceId: ulidColumn("service_id"),
    blockType: asciiColumn("block_type", { length: 64 }).notNull(),
    schemaVersion: smallint("schema_version", { unsigned: true }).notNull(),
    position: int("position", { unsigned: true }).notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
    showDesktop: boolean("show_desktop").notNull().default(true),
    showTablet: boolean("show_tablet").notNull().default(true),
    showMobile: boolean("show_mobile").notNull().default(true),
    isLocked: boolean("is_locked").notNull().default(false),
    anchor: asciiColumn("anchor", { length: 64 }),
    reusableSectionId: ulidColumn("reusable_section_id"),
    /** Provenance after a detach: the reusable section the copy came from (no foreign key). */
    detachedFromId: ulidColumn("detached_from_id"),
    settings: jsonColumn("settings").notNull(),
    ...ts(),
  },
  (t) => [
    uniqueIndex("uq_page_sections_page_position").on(t.pageId, t.position),
    uniqueIndex("uq_page_sections_service_position").on(t.serviceId, t.position),
    uniqueIndex("uq_page_sections_page_anchor").on(t.pageId, t.anchor),
    uniqueIndex("uq_page_sections_service_anchor").on(t.serviceId, t.anchor),
    index("ix_page_sections_block_type").on(t.blockType),
    index("ix_page_sections_reusable").on(t.reusableSectionId),
    foreignKey({ name: "fk_page_sections_page", columns: [t.pageId], foreignColumns: [pages.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_page_sections_service", columns: [t.serviceId], foreignColumns: [services.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_page_sections_reusable", columns: [t.reusableSectionId], foreignColumns: [reusableSections.id] }).onDelete("restrict"),
    ...actorKeys("page_sections", t, ["createdBy", "updatedBy"]),
    check("ck_page_sections_owner", sql`(${t.pageId} IS NULL) <> (${t.serviceId} IS NULL)`),
    check("ck_page_sections_devices", sql`${t.showDesktop} OR ${t.showTablet} OR ${t.showMobile}`),
    check("ck_page_sections_position", sql`${t.position} >= 1`),
    check("ck_page_sections_schema_version", sql`${t.schemaVersion} >= 1`),
    check("ck_page_sections_block_type", regexp(t.blockType, BLOCK_KEY_PATTERN)),
    check("ck_page_sections_anchor", sql`${t.anchor} IS NULL OR ${regexp(t.anchor, ANCHOR_PATTERN)}`),
  ],
);

/** A section's copy, per language (validated by the block's content schema; repeated items keyed by settings' ids). */
export const pageSectionTranslations = mysqlTable(
  "page_section_translations",
  {
    sectionId: ulidColumn("section_id").notNull(),
    locale: localeColumn("locale").notNull(),
    content: jsonColumn("content").notNull(),
    ...tr(),
  },
  (t) => translationConstraints("page_section_translations", t, "sectionId", pageSections.id),
);
