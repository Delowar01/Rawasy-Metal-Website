/**
 * The reference index (A8.3, A1-DATABASE-SCHEMA `content_references`): every reference one aggregate makes to another —
 * foreign-key columns, relations, media slots and lists, layout sections (their media, the records they show or link,
 * the reusable section they link), a collection's order, the site's share image — rebuilt for the source in the same
 * transaction as each revision (scope `working`) and each publish or unpublish (scope `published`). It answers "Used by"
 * and the impact lists before an archive or an unpublish; it is never edited by hand and can be rebuilt whole
 * (`rebuildAllReferences`, the operator tool `npm run content:references`).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { contentReferences } from "../db/schema-publishing.ts";
import { SPECS } from "../cms/kinds.ts";
import { ENTITIES, ENTITY_TYPES, type EntityType } from "../cms/registry.ts";
import { rowsOf } from "../cms/store.ts";
import { REGISTRY } from "../builder/registry.ts";
import { referencesOf } from "../builder/fields.ts";
import type { Locale } from "../cms/registry.ts";
import { AGGREGATES, CONTENT_AGGREGATES, type AggregateType } from "./registry.ts";
import type { Snapshot } from "./snapshot.ts";

export type TargetType = AggregateType | "media";

export interface Reference {
  fieldPath: string;
  targetType: TargetType;
  targetId: string;
  sectionId?: string | null;
}

/** Root columns that name another aggregate (the A3 foreign keys outside relations). */
const ROOT_REFERENCES: Partial<Record<EntityType, Record<string, EntityType>>> = {
  machine: { primaryServiceId: "service" },
  project: { clientId: "client" },
};

const isContent = (type: AggregateType): type is EntityType => (CONTENT_AGGREGATES as readonly string[]).includes(type);
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** A section's (or reusable section's) references, from its block definition. */
function blockReferences(blockType: unknown, settings: unknown, texts: unknown, prefix: string, sectionId: string | null): Reference[] {
  const def = typeof blockType === "string" ? REGISTRY.get(blockType) : undefined;
  if (!def) return [];
  const content: Partial<Record<Locale, Record<string, unknown>>> = {};
  for (const [locale, t] of Object.entries(asRecord(texts))) {
    const c = asRecord(t).content;
    if (c && typeof c === "object") content[locale as Locale] = c as Record<string, unknown>;
  }
  let refs;
  try {
    refs = referencesOf(def.settings, def.content, asRecord(settings) as never, content as never);
  } catch {
    return [];
  }
  return [
    ...refs.media.map((m) => ({ fieldPath: `${prefix}.${m.path}`, targetType: "media" as const, targetId: m.id, sectionId })),
    ...refs.records.map((r) => ({ fieldPath: `${prefix}.${r.path}`, targetType: r.type as AggregateType, targetId: r.id, sectionId })),
  ];
}

/** Every reference a snapshot makes (duplicates kept: each is a different place). */
export function referencesOfSnapshot(type: AggregateType, snapshot: Snapshot | null): Reference[] {
  if (!snapshot) return [];
  const out: Reference[] = [];
  const push = (fieldPath: string, targetType: TargetType, targetId: unknown, sectionId: string | null = null) => {
    if (typeof targetId === "string" && targetId && targetId.length <= 64) out.push({ fieldPath: fieldPath.slice(0, 191), targetType, targetId, sectionId });
  };
  if (isContent(type)) {
    const spec = SPECS[type];
    const root = asRecord(snapshot.root);
    for (const slot of spec.mediaSlots ?? []) push(`root.${slot.key}`, "media", root[slot.key]);
    for (const [key, target] of Object.entries(ROOT_REFERENCES[type] ?? {})) push(`root.${key}`, target, root[key]);
    const relations = asRecord(snapshot.relations);
    for (const relation of spec.relations ?? []) {
      const ids = relations[relation.key];
      if (Array.isArray(ids)) ids.forEach((id, i) => push(`relations.${relation.key}.${i}`, relation.target, id));
    }
    const lists = asRecord(snapshot.mediaLists);
    for (const list of spec.mediaLists ?? []) {
      const entries = lists[list.key];
      if (Array.isArray(entries)) entries.forEach((e, i) => push(`mediaLists.${list.key}.${i}`, "media", asRecord(e).media));
    }
    const children = snapshot.children;
    if (Array.isArray(children)) children.forEach((c, i) => push(`children.${i}.media`, "media", asRecord(c).media));
    const layout = snapshot.layout;
    if (Array.isArray(layout)) {
      layout.forEach((section, i) => {
        const s = asRecord(section);
        const sectionId = typeof s.id === "string" && ULID.test(s.id) ? s.id : null;
        if (typeof s.reusableId === "string") push(`layout.${i}.reusable`, "reusable_section", s.reusableId, sectionId);
        else out.push(...blockReferences(s.blockType, s.settings, s.texts, `layout.${i}`, sectionId));
      });
    }
    return out;
  }
  switch (type) {
    case "reusable_section":
      return blockReferences(snapshot.blockType, snapshot.settings, snapshot.texts, "block", null);
    case "ordering": {
      const collection = snapshot.collection;
      const items = snapshot.items;
      if (typeof collection === "string" && (ENTITY_TYPES as readonly string[]).includes(collection) && Array.isArray(items)) items.forEach((id, i) => push(`items.${i}`, collection as EntityType, id));
      return out;
    }
    case "site_settings":
      push("values.defaultOgImageMediaId", "media", asRecord(snapshot.values).defaultOgImageMediaId);
      return out;
    default:
      return out;
  }
}

/** Replaces a source's references of one scope (in the caller's transaction). */
export async function writeReferences(tx: Db, type: AggregateType, id: string, scope: "working" | "published", refs: readonly Reference[]): Promise<void> {
  await tx.execute(sql`DELETE FROM content_references WHERE source_type = ${type} AND source_id = ${id} AND scope = ${scope}`);
  if (!refs.length) return;
  for (let i = 0; i < refs.length; i += 200) {
    await tx.insert(contentReferences).values(
      refs.slice(i, i + 200).map((r) => ({ scope, sourceType: type, sourceId: id, sourceSectionId: r.sectionId ?? null, fieldPath: r.fieldPath, targetType: r.targetType, targetId: r.targetId })),
    );
  }
}

export interface UsedByRow {
  sourceType: AggregateType;
  sourceId: string;
  scope: "working" | "published";
  places: number;
  label: string;
  path: string | null;
}

/** Where an item is used: by source and scope, with a label and the admin page of each source. */
export async function usedBy(db: Db, targetType: TargetType, targetId: string): Promise<UsedByRow[]> {
  const rows = await rowsOf<{ source_type: string; source_id: string; scope: "working" | "published"; n: number }>(
    db,
    sql`SELECT source_type, source_id, scope, COUNT(*) AS n FROM content_references WHERE target_type = ${targetType} AND target_id = ${targetId}
         GROUP BY source_type, source_id, scope ORDER BY source_type, source_id, scope LIMIT 500`,
  );
  const out: UsedByRow[] = [];
  for (const r of rows) {
    if (!Object.hasOwn(AGGREGATES, r.source_type)) continue;
    const type = r.source_type as AggregateType;
    out.push({ sourceType: type, sourceId: r.source_id, scope: r.scope, places: Number(r.n), label: await sourceLabel(db, type, r.source_id), path: adminPath(type, r.source_id) });
  }
  return out;
}

/** The admin page of an aggregate (a page for every type that has one). */
export function adminPath(type: AggregateType, id: string): string | null {
  switch (type) {
    case "page":
      return `/admin/pages/${id}`;
    case "service":
      return `/admin/services/${id}`;
    case "machine":
      return `/admin/machinery/${id}`;
    case "project":
      return `/admin/projects/${id}`;
    case "project_category":
      return `/admin/projects/categories/${id}`;
    case "industry":
      return `/admin/industries/${id}`;
    case "client":
      return `/admin/clients/${id}`;
    case "certificate":
      return `/admin/certificates/${id}`;
    case "reusable_section":
      return `/admin/reusable-sections/${id}`;
    case "ordering":
      return null;
    case "menu":
      return "/admin/navigation";
    case "site_settings":
      return "/admin/settings";
    case "form":
      return `/admin/forms/${id}`;
  }
}

/** A source's name for lists (English title, else Arabic, else its slug or key). */
export async function sourceLabel(db: Db, type: AggregateType, id: string): Promise<string> {
  if (isContent(type)) {
    const info = ENTITIES[type];
    const [row] = await rowsOf<{ title: string | null; slug: string | null }>(
      db,
      sql`SELECT COALESCE(NULLIF(en.${sql.identifier(SPECS[type].titleKey)}, ''), NULLIF(ar.${sql.identifier(SPECS[type].titleKey)}, '')) AS title, r.slug
            FROM ${sql.identifier(info.table)} r
            LEFT JOIN ${sql.identifier(info.trTable)} en ON en.${sql.identifier(info.trParent)} = r.id AND en.locale = 'en'
            LEFT JOIN ${sql.identifier(info.trTable)} ar ON ar.${sql.identifier(info.trParent)} = r.id AND ar.locale = 'ar'
           WHERE r.id = ${id}`,
    );
    return row?.title || (row?.slug ? `(${row.slug})` : `(${info.one})`);
  }
  if (type === "reusable_section") {
    const [row] = await rowsOf<{ name: string }>(db, sql`SELECT name FROM reusable_sections WHERE id = ${id}`);
    return row?.name ?? "(reusable section)";
  }
  if (type === "ordering") return `The order of ${id.replace(/_/g, " ")}`;
  if (type === "menu") return `Menu: ${id.replace(/_/g, " ")}`;
  if (type === "site_settings") return "Company & website settings";
  if (type === "form") return "Quote request form";
  return id;
}
