/**
 * Rebuilding the reference index whole (A8.3; A1: "rebuilt, never edited by hand"): every aggregate's working references
 * from its working copy, and every live aggregate's published references from its live revision. Used once after the
 * A8 migration (aggregates saved before A8 have no index rows until their next save), after a database restore (A1 §11
 * "rebuild … references") and whenever the maintenance check finds a difference. One transaction per aggregate (its
 * root share-locked, so no save of it interleaves); recorded in `system_job_runs`.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { inTransaction } from "../db/client.ts";
import type { Pool } from "mysql2/promise";
import { rowsOf } from "../cms/store.ts";
import { AGGREGATE_TYPES, type AggregateType } from "./registry.ts";
import { referencesOfSnapshot, writeReferences } from "./references.ts";
import { readRevision, ROOTS } from "./revisions.ts";
import { readSnapshot } from "./snapshot.ts";
import { shownSnapshot } from "./validate.ts";

export interface RebuildReport {
  aggregates: number;
  working: number;
  published: number;
  changed: number;
}

async function idsOf(db: Db, type: AggregateType): Promise<string[]> {
  const root = ROOTS[type];
  const rows = await rowsOf<{ id: string }>(db, sql`SELECT ${sql.identifier(root.key)} AS id FROM ${sql.identifier(root.table)}${root.softDelete ? sql` WHERE deleted_at IS NULL` : sql``}`);
  return rows.map((r) => r.id);
}

const countOf = async (db: Db, type: AggregateType, id: string, scope: string) =>
  Number((await rowsOf<{ n: number }>(db, sql`SELECT COUNT(*) AS n FROM content_references WHERE source_type = ${type} AND source_id = ${id} AND scope = ${scope}`))[0]?.n ?? 0);

export async function rebuildAllReferences(pool: Pool, db: Db, now: Date): Promise<RebuildReport> {
  const report: RebuildReport = { aggregates: 0, working: 0, published: 0, changed: 0 };
  const started = now;
  for (const type of AGGREGATE_TYPES) {
    for (const id of await idsOf(db, type)) {
      report.aggregates++;
      await inTransaction(pool, async (tx) => {
        const root = ROOTS[type];
        const [row] = await rowsOf<{ published_revision_id: string | null }>(tx, sql`SELECT published_revision_id FROM ${sql.identifier(root.table)} WHERE ${sql.identifier(root.key)} = ${id} LOCK IN SHARE MODE`);
        if (!row) return;
        const before = (await countOf(tx, type, id, "working")) + (await countOf(tx, type, id, "published"));
        const working = referencesOfSnapshot(type, await readSnapshot(tx, type, id));
        await writeReferences(tx, type, id, "working", working);
        report.working += working.length;
        let published: ReturnType<typeof referencesOfSnapshot> = [];
        if (row.published_revision_id) {
          const live = await readRevision(tx, type, id, row.published_revision_id);
          if (live) published = referencesOfSnapshot(type, shownSnapshot(live.snapshot));
        }
        await writeReferences(tx, type, id, "published", published);
        report.published += published.length;
        if (before !== working.length + published.length) report.changed++;
      });
    }
  }
  await db.execute(
    sql`INSERT INTO system_job_runs (job_key, started_at, finished_at, status, summary, details)
        VALUES ('rebuild_references', ${started}, ${new Date()}, 'success', ${`Rebuilt the reference index of ${report.aggregates} aggregates.`}, ${JSON.stringify(report)})`,
  );
  return report;
}
