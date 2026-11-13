/**
 * A9.4 — reads the public read model (A1-PUBLISHING-VERSIONS §1, §8): the cache generation, the published documents and
 * the delivered media, in one REPEATABLE READ snapshot (A2's connection setup), so a publication committed meanwhile is
 * either wholly in or wholly out. Nothing else is read: no working copy, no user, no private media.
 */
import { sql } from "drizzle-orm";
import { inTransaction, type Db } from "../db/client.ts";
import type { Pool } from "mysql2/promise";
import { rowsOf } from "../cms/store.ts";
import type { AggregateType } from "../publishing/registry.ts";
import type { DeliveredMedia, PublishedDoc, PublishedInput } from "./decode.ts";

const json = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);

/** The current cache generation (A8: every publication, unpublication and restore moves it). */
export async function readGeneration(db: Db): Promise<{ generation: number; epoch: string }> {
  const [row] = await rowsOf<{ generation: number | string; epoch: string }>(db, sql`SELECT value AS generation, epoch FROM cache_generation WHERE id = 1`);
  if (!row) throw new Error("The cache generation row is missing.");
  return { generation: Number(row.generation), epoch: String(row.epoch) };
}

export interface PublicSnapshot extends PublishedInput {
  generation: number;
  epoch: string;
}

/** Everything the public site may read, at one point in time. */
export async function readPublicSnapshot(pool: Pool): Promise<PublicSnapshot> {
  return inTransaction(pool, async (tx) => {
    const { generation, epoch } = await readGeneration(tx);
    const docs = await rowsOf<{ entity_type: string; entity_id: string; slug: string | null; document: unknown }>(
      tx,
      sql`SELECT entity_type, entity_id, slug, document FROM published_documents ORDER BY entity_type, entity_id`,
    );
    const media = await rowsOf<{ media_id: string; legacy_key: string | null; kind: string; src: string; width: number | null; height: number | null; blur_data_url: string | null }>(
      tx,
      sql`SELECT media_id, legacy_key, kind, src, width, height, blur_data_url FROM public_media ORDER BY media_id`,
    );
    return {
      generation,
      epoch,
      docs: docs.map((d): PublishedDoc => ({ type: d.entity_type as AggregateType, id: d.entity_id, slug: d.slug, document: json(d.document) as Record<string, unknown> })),
      media: media.map((m): DeliveredMedia => ({ id: m.media_id, legacyKey: m.legacy_key, kind: m.kind, src: m.src, width: m.width === null ? null : Number(m.width), height: m.height === null ? null : Number(m.height), blurDataUrl: m.blur_data_url })),
    };
  });
}
