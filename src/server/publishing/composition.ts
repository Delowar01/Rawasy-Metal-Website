/**
 * A9 (security review M2): what the approved website's fixed composition needs live. The public components choose these
 * records in code — the Projects page's collage, the Industries page's strip, the homepage's two laser services — and a
 * machine is drawn with its main service; the settings, the four menus and the quote form frame every page. In a
 * database-content release, taking one of them offline would leave a page that cannot be drawn (500). So unpublishing or
 * archiving one is refused (A8 `unpublish`, A3 archive), with the reason; what is safety-increasing (a blocking flag, a
 * media restriction) is never refused and fails that page closed instead (the A9 report, item 7).
 *
 * The lists equal the components' own (`tests/unit/migration-layouts.test.ts` reads them from the component files).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rowsOf } from "../cms/store.ts";
import type { AggregateType } from "./registry.ts";

/** Records the approved components look up by slug (and assume present). */
export const COMPOSITION_RECORDS = {
  /** The homepage's services section leads with these two signature cards (home/Services.tsx). */
  service: ["laser-cutting", "laser-engraving"],
  /** The Projects page hero's three prints (projects/ProjectsPage.tsx `COLLAGE`). */
  project: ["tulip-roundabout-sculpture", "clock-tower-landmark", "suspended-lantern"],
  /** The Industries page hero's strip of sector photos (industries/IndustriesPage.tsx `STRIP`). */
  industry: ["construction", "industrial", "public-realm", "architecture", "street-furniture"],
} as const satisfies Partial<Record<AggregateType, readonly string[]>>;

/** Singletons every page needs published (their documents frame the shell and the contact page). */
const FRAME: readonly AggregateType[] = ["site_settings", "menu", "form"];

/** Why the website needs this aggregate live (it may not be unpublished or archived), or null. */
export async function compositionNeeds(tx: Db, type: AggregateType, id: string): Promise<string | null> {
  if (FRAME.includes(type)) return "Every page of the website is drawn with it: publish a corrected version instead of taking it offline.";
  const fixed = (COMPOSITION_RECORDS as Partial<Record<AggregateType, readonly string[]>>)[type];
  if (fixed) {
    const [row] = await rowsOf<{ slug: string | null }>(tx, sql`SELECT slug FROM ${sql.identifier(type === "service" ? "services" : type === "project" ? "projects" : "industries")} WHERE id = ${id}`);
    if (row?.slug && fixed.includes(row.slug)) return "The website's approved composition shows it in a fixed place (the homepage's services, the Projects collage or the Industries strip): it stays live.";
  }
  if (type === "service") {
    const [row] = await rowsOf<{ n: number }>(
      tx,
      sql`SELECT COUNT(*) AS n FROM published_documents WHERE entity_type = 'machine' AND JSON_UNQUOTE(JSON_EXTRACT(document, '$.root.primaryServiceId')) = ${id}`,
    );
    const n = Number(row?.n ?? 0);
    if (n > 0) return `${n} live machine${n === 1 ? " names" : "s name"} it as their main service: give ${n === 1 ? "it" : "them"} another one, or take ${n === 1 ? "it" : "them"} offline, first.`;
  }
  return null;
}
