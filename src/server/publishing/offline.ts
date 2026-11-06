/**
 * Taking a live aggregate offline (A1-PUBLISHING-VERSIONS §5, the end): its `published_documents` row and its published
 * references are removed, the live revision gets `live_until`, and the invalidation is recorded — in the caller's
 * transaction (an unpublish, an archive, a blocking project flag). The caller changes the root's status and clears
 * `published_revision_id` in one statement (`ck_*_live`: a published root always names its live revision). Nothing
 * else changes: what linked to it simply leaves it out (A1 §6).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rowsOf } from "../cms/store.ts";
import { recordInvalidations, tagsFor } from "./cache.ts";
import type { AggregateType } from "./registry.ts";

/** Whether the aggregate had a live version (and so was taken offline). */
export async function takeOffline(tx: Db, type: AggregateType, id: string, now: Date, requestId: string | null = null): Promise<boolean> {
  const [doc] = await rowsOf<{ revision_id: string; slug: string | null }>(tx, sql`SELECT revision_id, slug FROM published_documents WHERE entity_type = ${type} AND entity_id = ${id} FOR UPDATE`);
  if (!doc) return false;
  await tx.execute(sql`DELETE FROM published_documents WHERE entity_type = ${type} AND entity_id = ${id}`);
  await tx.execute(sql`DELETE FROM content_references WHERE source_type = ${type} AND source_id = ${id} AND scope = 'published'`);
  await tx.execute(sql`UPDATE revisions SET live_until = ${now} WHERE id = ${doc.revision_id} AND live_until IS NULL`);
  await recordInvalidations(tx, tagsFor(type, id, [doc.slug]), requestId, now);
  return true;
}
