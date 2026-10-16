/**
 * Where a media item is used (A4 brief §57): ONE list of every A1 media reference — the media columns of the content
 * types and their media relation rows — read by the item's "Used by" panel, the library's "unused" filter and the
 * dashboard alike, each as a direct query on indexed columns (every foreign key has its index). No second usage table.
 * Read-only. Table and column names come from this list, never from input; ids are bound parameters.
 */
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { refsByIds, type ItemRef } from "../cms/lookups.ts";
import { ENTITIES, type EntityType } from "../cms/registry.ts";
import { rowsOf } from "../cms/store.ts";

export interface MediaReference {
  key: string;
  /** Where it shows on the owner, for people. */
  label: string;
  owner: EntityType;
  table: string;
  /** The media column. */
  column: string;
  /** The owner's id column in `table` (`id` for the owner's own row). */
  ownerColumn: string;
  /** Only rows with this value (certificate documents' role). */
  where?: { column: string; value: string };
}

/** Every media reference of the A1 content model (A1-CONTENT-MODEL §8; A1-DATABASE-SCHEMA). */
export const MEDIA_REFERENCES: readonly MediaReference[] = [
  { key: "page.og_image", label: "Share image", owner: "page", table: "pages", column: "og_image_media_id", ownerColumn: "id" },
  { key: "service.cover", label: "Cover photo", owner: "service", table: "services", column: "cover_media_id", ownerColumn: "id" },
  { key: "service.supporting", label: "Supporting photo", owner: "service", table: "services", column: "supporting_media_id", ownerColumn: "id" },
  { key: "service.gallery", label: "Gallery", owner: "service", table: "service_gallery_items", column: "media_id", ownerColumn: "service_id" },
  { key: "service.og_image", label: "Share image", owner: "service", table: "services", column: "og_image_media_id", ownerColumn: "id" },
  { key: "machine.photo", label: "Photo", owner: "machine", table: "machines", column: "media_id", ownerColumn: "id" },
  { key: "project.photos", label: "Photos", owner: "project", table: "project_media", column: "media_id", ownerColumn: "project_id" },
  { key: "project.og_image", label: "Share image", owner: "project", table: "projects", column: "og_image_media_id", ownerColumn: "id" },
  { key: "industry.photo", label: "Photo", owner: "industry", table: "industries", column: "media_id", ownerColumn: "id" },
  { key: "industry.feature", label: "Feature photo", owner: "industry", table: "industries", column: "feature_media_id", ownerColumn: "id" },
  { key: "client.logo", label: "Logo (colour)", owner: "client", table: "clients", column: "logo_media_id", ownerColumn: "id" },
  { key: "client.logo_mono", label: "Logo (monochrome)", owner: "client", table: "clients", column: "logo_mono_media_id", ownerColumn: "id" },
  { key: "certificate.thumb", label: "Thumbnail", owner: "certificate", table: "certificates", column: "thumb_media_id", ownerColumn: "id" },
  {
    key: "certificate.preview",
    label: "Redacted public preview",
    owner: "certificate",
    table: "certificate_documents",
    column: "media_id",
    ownerColumn: "certificate_id",
    where: { column: "role", value: "public_preview" },
  },
  {
    key: "certificate.private_original",
    label: "Private original",
    owner: "certificate",
    table: "certificate_documents",
    column: "media_id",
    ownerColumn: "certificate_id",
    where: { column: "role", value: "private_original" },
  },
];

const id = (name: string) => sql.identifier(name);

/** `EXISTS (…)` for one reference, given the SQL expression of the media id (e.g. `a.id`). */
function referenceExists(ref: MediaReference, mediaId: SQL): SQL {
  const softDeleted = ref.ownerColumn === "id" ? sql` AND u.deleted_at IS NULL` : sql``;
  const where = ref.where ? sql` AND u.${id(ref.where.column)} = ${ref.where.value}` : sql``;
  return sql`EXISTS (SELECT 1 FROM ${id(ref.table)} u WHERE u.${id(ref.column)} = ${mediaId}${softDeleted}${where})`;
}

/** SQL that is true when the item `mediaId` (an SQL expression) is used by any content record. */
export function usedSql(mediaId: SQL): SQL {
  return sql`(${sql.join(
    MEDIA_REFERENCES.map((ref) => referenceExists(ref, mediaId)),
    sql` OR `,
  )})`;
}

export interface UsageGroup {
  key: string;
  label: string;
  owner: EntityType;
  ownerLabel: string;
  path: string;
  items: ItemRef[];
}

/** The records that use an item, by reference ("Used by"), each with its owners in their own order. */
export async function mediaUsage(db: Db, mediaId: string): Promise<UsageGroup[]> {
  const out: UsageGroup[] = [];
  for (const ref of MEDIA_REFERENCES) {
    const softDeleted = ref.ownerColumn === "id" ? sql` AND deleted_at IS NULL` : sql``;
    const where = ref.where ? sql` AND ${id(ref.where.column)} = ${ref.where.value}` : sql``;
    const rows = await rowsOf<{ owner: string }>(db, sql`SELECT DISTINCT ${id(ref.ownerColumn)} AS owner FROM ${id(ref.table)} WHERE ${id(ref.column)} = ${mediaId}${softDeleted}${where}`);
    if (!rows.length) continue;
    const items = await refsByIds(
      db,
      ref.owner,
      rows.map((r) => r.owner),
    );
    if (!items.length) continue;
    out.push({ key: ref.key, label: ref.label, owner: ref.owner, ownerLabel: ENTITIES[ref.owner].one, path: ENTITIES[ref.owner].path, items });
  }
  return out;
}

/** How many content references an item has (0 = unused). */
export async function usageCount(db: Db, mediaId: string): Promise<number> {
  return (await mediaUsage(db, mediaId)).reduce((n, group) => n + group.items.length, 0);
}
