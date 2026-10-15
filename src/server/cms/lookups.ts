/**
 * What the editors show around an item (A3 brief §32): the candidates a relation picker offers (with archived ones
 * marked), and where an item is used ("used by"), so an archived or soon-archived record is never a surprise. Read-only.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { localeStateSql } from "./list.ts";
import type { LocaleState } from "./completeness.ts";
import { ENTITIES, type EntityType } from "./registry.ts";
import { rowsOf } from "./store.ts";
import { COMPLETENESS } from "./translated.ts";

const id = (name: string) => sql.identifier(name);

export interface ItemRef {
  id: string;
  type: EntityType;
  slug: string | null;
  title: { en: string | null; ar: string | null };
  archived: boolean;
  state: { en: LocaleState; ar: LocaleState };
}

/** A short name for an item: the English title, else the Arabic one, else the slug. */
export const refLabel = (ref: Pick<ItemRef, "title" | "slug">) => ref.title.en || ref.title.ar || (ref.slug ? `(${ref.slug})` : "(untitled)");

/** Hard cap on the candidates a picker lists (more needs A5's search pickers; the A3 collections are far smaller). */
export const PICKER_LIMIT = 500;

function refQuery(type: EntityType, where: ReturnType<typeof sql>, limit = PICKER_LIMIT) {
  const info = ENTITIES[type];
  const parent = id(info.trParent);
  const title = id(COMPLETENESS[type].title);
  const ordering = info.orderingKey ? sql`LEFT JOIN entity_ordering_items oi ON oi.ordering_key = ${info.orderingKey} AND oi.entity_id = r.id` : sql``;
  return sql`SELECT r.id, r.slug, (r.publication_status = 'archived') AS archived,
      te.${title} AS title_en, ta.${title} AS title_ar,
      ${localeStateSql(type, "te", "en")} AS state_en, ${localeStateSql(type, "ta", "ar")} AS state_ar
    FROM ${id(info.table)} r
    LEFT JOIN ${id(info.trTable)} te ON te.${parent} = r.id AND te.locale = 'en'
    LEFT JOIN ${id(info.trTable)} ta ON ta.${parent} = r.id AND ta.locale = 'ar'
    ${ordering}
    WHERE r.deleted_at IS NULL AND ${where}
    ORDER BY ${info.orderingKey ? sql`oi.position IS NULL, oi.position,` : sql``} COALESCE(NULLIF(te.${title}, ''), NULLIF(ta.${title}, ''), r.slug), r.id
    LIMIT ${limit}`;
}

const toRef = (type: EntityType) => (r: Record<string, unknown>): ItemRef => ({
  id: String(r.id),
  type,
  slug: (r.slug as string | null) ?? null,
  title: { en: (r.title_en as string | null) || null, ar: (r.title_ar as string | null) || null },
  archived: Boolean(Number(r.archived)),
  state: { en: r.state_en as LocaleState, ar: r.state_ar as LocaleState },
});

/** Every item of a type a picker may offer (archived ones included, marked: they may stay linked, not be added). */
export async function pickerOptions(db: Db, type: EntityType): Promise<ItemRef[]> {
  return (await rowsOf<Record<string, unknown>>(db, refQuery(type, sql`1 = 1`))).map(toRef(type));
}

/** Specific items by id (in the given order; missing ones left out). */
export async function refsByIds(db: Db, type: EntityType, ids: readonly string[]): Promise<ItemRef[]> {
  if (!ids.length) return [];
  const rows = (
    await rowsOf<Record<string, unknown>>(
      db,
      refQuery(
        type,
        sql`r.id IN (${sql.join(
          ids.map((v) => sql`${v}`),
          sql`, `,
        )})`,
        ids.length,
      ),
    )
  ).map(toRef(type));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((v) => byId.get(v)).filter((v): v is ItemRef => Boolean(v));
}

export interface Usage {
  label: string;
  items: ItemRef[];
}

/** The records that point to an item ("used by"), each list in its owners' order. */
export async function usagesOf(db: Db, type: EntityType, itemId: string): Promise<Usage[]> {
  const ids = async (query: ReturnType<typeof sql>) => (await rowsOf<{ id: string }>(db, query)).map((r) => r.id);
  const out: Usage[] = [];
  const add = async (label: string, owner: EntityType, query: ReturnType<typeof sql>) => {
    const found = await ids(query);
    if (found.length) out.push({ label, items: await refsByIds(db, owner, found) });
  };
  switch (type) {
    case "service":
      await add("Projects that list this service", "project", sql`SELECT project_id AS id FROM project_services WHERE service_id = ${itemId}`);
      await add("Industries that list this service", "industry", sql`SELECT industry_id AS id FROM industry_services WHERE service_id = ${itemId}`);
      await add("Machines with this primary service", "machine", sql`SELECT id FROM machines WHERE primary_service_id = ${itemId} AND deleted_at IS NULL`);
      await add("Services that relate to this one", "service", sql`SELECT service_id AS id FROM service_related_services WHERE related_service_id = ${itemId}`);
      break;
    case "machine":
      await add("Services that list this machine", "service", sql`SELECT service_id AS id FROM service_machines WHERE machine_id = ${itemId}`);
      break;
    case "project":
      await add("Services that feature this project", "service", sql`SELECT service_id AS id FROM service_featured_projects WHERE project_id = ${itemId}`);
      await add("Industries that list this project", "industry", sql`SELECT industry_id AS id FROM industry_projects WHERE project_id = ${itemId}`);
      break;
    case "project_category":
      await add("Projects in this category", "project", sql`SELECT project_id AS id FROM project_category_assignments WHERE category_id = ${itemId}`);
      break;
    case "client":
      await add("Projects naming this client", "project", sql`SELECT id FROM projects WHERE client_id = ${itemId} AND deleted_at IS NULL`);
      break;
    default:
      break;
  }
  return out;
}
