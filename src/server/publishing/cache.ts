/**
 * The shared cache-invalidation record (A1-PUBLISHING-VERSIONS §8.2): a publish or an unpublish takes the next cache
 * generation (`UPDATE cache_generation SET value = value + 1`, whose row lock, held until the commit, orders
 * invalidations by commit) and stamps each of its tags with it. No public page reads it before the A9 cutover (static
 * mode: the custom cache handler is not configured); A9's handler serves a cached page only when none of its tags has a
 * newer generation. A database restore sets a new epoch (`newCacheEpoch`).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rowsOf } from "../cms/store.ts";
import { ulid } from "../security/ids.ts";
import type { AggregateType } from "./registry.ts";

/** The tags a change of this aggregate invalidates (A1 §8.3): its document, its type and, for shared parts, the site. */
export function tagsFor(type: AggregateType, id: string, slugs: readonly (string | null)[] = []): string[] {
  const tags = new Set([`doc:${type}:${id}`, `type:${type}`]);
  if (type === "menu" || type === "site_settings" || type === "reusable_section") tags.add("site");
  for (const slug of slugs) if (slug) tags.add(`slug:${type}:${slug}`);
  return [...tags].map((t) => t.slice(0, 255));
}

/**
 * Takes the next generation and stamps the tags with it (in the caller's transaction, as its last write: inside a
 * content transaction callers defer their tags with `deferInvalidations`, and `contentTransaction` records them once).
 */
export async function recordInvalidations(tx: Db, tags: readonly string[], requestId: string | null, now: Date): Promise<number> {
  await tx.execute(sql`UPDATE cache_generation SET value = value + 1, updated_at = ${now} WHERE id = 1`);
  const [row] = await rowsOf<{ value: number }>(tx, sql`SELECT value FROM cache_generation WHERE id = 1`);
  const generation = Number(row?.value ?? 0);
  if (!generation) throw new Error("The cache generation row is missing (migration 0011).");
  for (const tag of tags) {
    await tx.execute(
      sql`INSERT INTO cache_invalidations (tag, generation, invalidated_at, updated_by_request) VALUES (${tag}, ${generation}, ${now}, ${requestId})
          ON DUPLICATE KEY UPDATE generation = VALUES(generation), invalidated_at = VALUES(invalidated_at), updated_by_request = VALUES(updated_by_request)`,
    );
  }
  return generation;
}

/** A new epoch after a database restore: every page cached under another epoch is treated as missing (A1 §8.2). */
export async function newCacheEpoch(tx: Db, now: Date): Promise<string> {
  const epoch = ulid(now.getTime());
  await tx.execute(sql`UPDATE cache_generation SET epoch = ${epoch}, updated_at = ${now} WHERE id = 1`);
  return epoch;
}
