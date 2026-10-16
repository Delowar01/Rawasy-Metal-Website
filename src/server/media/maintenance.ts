/**
 * Media maintenance (A4 brief §59–§62; A1-MEDIA-STORAGE §14): a report, and repairs run only on request — no cron, no
 * schedule, nothing at app start (`npm run media:maintenance`).
 *
 * Report (read-only): abandoned temporary uploads (older than 24 h), stuck processing (older than 15 min), records whose
 * files are missing on disk, files on disk without a record (orphans, never deleted automatically), entries that are
 * not regular files (symbolic links …), old versions past the 30-day retention (purge candidates — never purged in A4),
 * and `public_media` rows that disagree with the deliverability rule.
 *
 * Repairs (each audited as the CLI operator): remove abandoned temporary uploads; mark stuck processing failed;
 * regenerate an item's variants from its original; rebuild `public_media` for every item. A file is never marked ready
 * while its bytes are missing, and an unknown file on disk is reported, never deleted.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, inArray, lt } from "drizzle-orm";
import type { Pool } from "mysql2/promise";
import { recordAudit, type AuditActor } from "../audit/audit.ts";
import { inTransaction, type Db } from "../db/client.ts";
import { mediaAssets, mediaFiles, mediaFlags, mediaVariants, publicMedia } from "../db/schema-media.ts";
import { ulid } from "../security/ids.ts";
import { deliverability, syncPublicMedia } from "./deliverability.ts";
import { generateVariants } from "./images.ts";
import { missingDeliveryFiles } from "./presence.ts";
import { MEDIA_LIMITS } from "./registry.ts";
import { KEY_GRAMMAR, type MediaStore } from "./storage.ts";

export interface MaintenanceReport {
  at: string;
  tmp: { abandoned: { uploadId: string; ageHours: number }[]; open: number; other: string[] };
  stuck: { mediaId: string; fileId: string; version: number; since: string }[];
  failed: number;
  /** How many of `failed` belong to private items (left out of what a role without private access is shown). */
  failedPrivate?: number;
  missing: { mediaId: string; fileId: string; version: number; what: string[] }[];
  orphans: { area: string; key: string }[];
  notFiles: { area: string; key: string }[];
  purgeCandidates: { mediaId: string; fileId: string; version: number; byteSize: number; supersededAt: string }[];
  publicMediaDrift: { mediaId: string; expected: boolean; present: boolean }[];
}

export interface MaintenanceContext {
  pool: Pool;
  db: Db;
  store: MediaStore | null;
  releaseDir: string;
  now: Date;
  actor: AuditActor;
}

export const REPORT_FILE = "media/maintenance-report.json";

/** The report, read-only. */
export async function scanMedia(ctx: MaintenanceContext): Promise<MaintenanceReport> {
  const { db, store, now } = ctx;
  const report: MaintenanceReport = {
    at: now.toISOString(),
    tmp: { abandoned: [], open: 0, other: [] },
    stuck: [],
    failed: 0,
    failedPrivate: 0,
    missing: [],
    orphans: [],
    notFiles: [],
    purgeCandidates: [],
    publicMediaDrift: [],
  };
  const files = await db.select().from(mediaFiles);
  const assets = await db.select().from(mediaAssets);
  const variants = await db.select().from(mediaVariants);
  const flags = await db.select({ mediaId: mediaFlags.mediaId, flag: mediaFlags.flag }).from(mediaFlags);
  const published = new Set((await db.select({ id: publicMedia.mediaId }).from(publicMedia)).map((r) => r.id));
  const assetOf = new Map(assets.map((a) => [a.id, a]));
  const stuckBefore = now.getTime() - MEDIA_LIMITS.stuckProcessingMs;
  for (const file of files) {
    if ((file.processingStatus === "processing" || file.processingStatus === "uploaded") && file.uploadedAt.getTime() < stuckBefore) {
      report.stuck.push({ mediaId: file.mediaId, fileId: file.id, version: file.version, since: file.uploadedAt.toISOString() });
    }
    const asset = assetOf.get(file.mediaId);
    if (file.processingStatus === "failed") {
      report.failed++;
      if (asset?.visibility === "private") report.failedPrivate = (report.failedPrivate ?? 0) + 1;
    }
    if (file.processingStatus !== "ready") continue;
    const what = await missingDeliveryFiles(store, ctx.releaseDir, { storageArea: file.storageArea, storageKey: file.storageKey, byteSize: Number(file.byteSize), kind: asset?.kind ?? "image" }, variants.filter((v) => v.fileId === file.id));
    // An uploaded image's original must be there too (the source of its variants and of any regeneration).
    if (file.storageArea === "originals" && asset?.kind === "image" && store) {
      const size = await store.sizeOf("originals", file.storageKey).catch(() => null);
      if (size !== Number(file.byteSize)) what.push("the original");
    }
    if (what.length) report.missing.push({ mediaId: file.mediaId, fileId: file.id, version: file.version, what });
    const asset2 = assetOf.get(file.mediaId);
    if (file.supersededAt && file.id !== asset2?.currentFileId && file.supersededAt.getTime() <= now.getTime() - MEDIA_LIMITS.versionRetentionMs) {
      report.purgeCandidates.push({ mediaId: file.mediaId, fileId: file.id, version: file.version, byteSize: Number(file.byteSize), supersededAt: file.supersededAt.toISOString() });
    }
  }
  for (const asset of assets) {
    const current = files.find((f) => f.id === asset.currentFileId) ?? null;
    const expected = deliverability({
      visibility: asset.visibility,
      usageStatus: asset.usageStatus,
      deleted: Boolean(asset.deletedAt),
      flags: flags.filter((f) => f.mediaId === asset.id).map((f) => f.flag),
      kind: asset.kind,
      current: current ? { processingStatus: current.processingStatus, storageArea: current.storageArea } : null,
      widthVariants: current ? variants.filter((v) => v.fileId === current.id && v.variantKey !== "thumb").length : 0,
    }).deliverable;
    const present = published.has(asset.id);
    if (expected !== present) report.publicMediaDrift.push({ mediaId: asset.id, expected, present });
  }
  if (store) {
    const known = {
      originals: new Set(files.filter((f) => f.storageArea === "originals").map((f) => f.storageKey)),
      private: new Set(files.filter((f) => f.storageArea === "private").map((f) => f.storageKey)),
      derived: new Set(variants.map((v) => v.storageKey)),
    };
    for (const area of ["originals", "derived", "private"] as const) {
      const listing = await store.listArea(area);
      for (const key of listing.files) if (!known[area].has(key)) report.orphans.push({ area, key });
      for (const key of listing.other) report.notFiles.push({ area, key });
    }
    const tmp = await store.listArea("tmp");
    const uploads = new Map<string, true>();
    for (const key of [...tmp.files, ...tmp.other]) {
      const uploadId = key.split("/")[0];
      if (!KEY_GRAMMAR.tmp.test(uploadId)) report.tmp.other.push(key);
      else uploads.set(uploadId, true);
    }
    for (const uploadId of uploads.keys()) {
      const modified = (await store.modifiedAt("tmp", `${uploadId}/manifest.json`)) ?? (await store.modifiedAt("tmp", uploadId));
      const age = modified ? now.getTime() - modified.getTime() : Infinity;
      if (age > MEDIA_LIMITS.tmpMaxAgeMs) report.tmp.abandoned.push({ uploadId, ageHours: Number.isFinite(age) ? Math.floor(age / 3_600_000) : -1 });
      else report.tmp.open++;
    }
  }
  return report;
}

/**
 * The report as a role without private access may see it (a private item does not exist for anyone who may not know of
 * it, A4 brief §16): entries about private items and the private area are left out, and so are their failures.
 */
export function publicView(report: MaintenanceReport, privateIds: ReadonlySet<string>): MaintenanceReport {
  const isPublic = (entry: { mediaId: string }) => !privateIds.has(entry.mediaId);
  return {
    ...report,
    stuck: report.stuck.filter(isPublic),
    failed: Math.max(0, report.failed - (report.failedPrivate ?? 0)),
    failedPrivate: 0,
    missing: report.missing.filter(isPublic),
    orphans: report.orphans.filter((o) => o.area !== "private"),
    notFiles: report.notFiles.filter((o) => o.area !== "private"),
    purgeCandidates: report.purgeCandidates.filter(isPublic),
    publicMediaDrift: report.publicMediaDrift.filter(isPublic),
  };
}

/** The ids of every private item (for `publicView`). */
export async function privateMediaIds(db: Db): Promise<Set<string>> {
  return new Set((await db.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.visibility, "private"))).map((r) => r.id));
}

/** Whether a report shows something for the Owner/Admin to look at. */
export const reportHasProblems = (r: MaintenanceReport) =>
  r.stuck.length > 0 || r.missing.length > 0 || r.orphans.length > 0 || r.notFiles.length > 0 || r.publicMediaDrift.length > 0 || r.tmp.abandoned.length > 0 || r.tmp.other.length > 0;

/** Saves the report beside the media areas (the dashboard shows its summary). */
export async function saveReport(store: MediaStore, report: MaintenanceReport): Promise<void> {
  await writeFile(join(store.root, REPORT_FILE), JSON.stringify(report, null, 2), { mode: 0o600 });
}

export async function readLastReport(store: MediaStore | null): Promise<MaintenanceReport | null> {
  if (!store) return null;
  try {
    return JSON.parse(await readFile(join(store.root, REPORT_FILE), "utf8")) as MaintenanceReport;
  } catch {
    return null;
  }
}

const audit = (ctx: MaintenanceContext, db: Db, action: string, summary: string, id: string | null = null, changes?: Record<string, unknown>) =>
  recordAudit(db, { at: ctx.now, requestId: ulid(ctx.now.getTime()), actor: ctx.actor, action, entity: { type: "media", id, label: null }, outcome: "success", summary, changes });

/** Removes temporary uploads older than 24 h (their slots free on their own after the upload lifetime). */
export async function cleanTmp(ctx: MaintenanceContext, report: MaintenanceReport): Promise<number> {
  if (!ctx.store) return 0;
  let removed = 0;
  for (const { uploadId } of report.tmp.abandoned) {
    await ctx.store.removeUpload(uploadId);
    removed++;
  }
  if (removed) await audit(ctx, ctx.db, "media.maintenance", `Removed ${removed} abandoned temporary upload(s) older than 24 hours.`, null, { count: removed });
  return removed;
}

/** Marks processing that never finished as failed (nothing becomes current or deliverable). */
export async function failStuck(ctx: MaintenanceContext): Promise<number> {
  const before = new Date(ctx.now.getTime() - MEDIA_LIMITS.stuckProcessingMs);
  return inTransaction(ctx.pool, async (tx) => {
    const stuck = await tx
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(and(inArray(mediaFiles.processingStatus, ["uploaded", "processing"]), lt(mediaFiles.uploadedAt, before)))
      .for("update");
    if (!stuck.length) return 0;
    await tx
      .update(mediaFiles)
      .set({ processingStatus: "failed", processingError: "Processing did not finish (marked failed by the maintenance tool)." })
      .where(inArray(mediaFiles.id, stuck.map((s) => s.id)));
    await audit(ctx, tx, "media.maintenance", `Marked ${stuck.length} stuck processing file(s) failed.`, null, { count: stuck.length });
    return stuck.length;
  });
}

/** Rebuilds `public_media` for every item from its current state (the deliverability rule); returns the rows changed. */
export async function rebuildPublicMedia(ctx: MaintenanceContext): Promise<number> {
  const ids = (await ctx.db.select({ id: mediaAssets.id }).from(mediaAssets)).map((r) => r.id);
  let changed = 0;
  for (const id of ids) {
    changed += await inTransaction(ctx.pool, async (tx) => {
      await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.id, id)).for("update");
      return (await syncPublicMedia(tx, id, ctx.now)).changed ? 1 : 0;
    });
  }
  await audit(ctx, ctx.db, "media.maintenance", `Rebuilt public_media for ${ids.length} item(s): ${changed} row(s) changed.`, null, { count: changed });
  return changed;
}

/**
 * Regenerates the variants of an item's current version from its original (public-class images only): new rows replace
 * the old ones in one transaction with the item locked, `public_media` follows, and only then are files no row names
 * any more removed. The original's bytes are never touched.
 */
export async function regenerateVariants(ctx: MaintenanceContext, mediaId: string): Promise<"ok" | "skipped" | "missing"> {
  const { store } = ctx;
  if (!store) return "missing";
  const [asset] = await ctx.db.select().from(mediaAssets).where(eq(mediaAssets.id, mediaId));
  if (!asset || asset.kind !== "image" || asset.visibility !== "public" || !asset.currentFileId) return "skipped";
  const [file] = await ctx.db.select().from(mediaFiles).where(eq(mediaFiles.id, asset.currentFileId));
  if (!file || file.storageArea !== "originals" || file.processingStatus !== "ready" || !file.width || !file.height) return "skipped";
  const size = await store.sizeOf("originals", file.storageKey);
  if (size !== Number(file.byteSize)) return "missing";
  const generated = await generateVariants(store, await store.verifiedPath("originals", file.storageKey), mediaId, file.id, { width: file.width, height: file.height });
  const before = await ctx.db.select({ storageKey: mediaVariants.storageKey }).from(mediaVariants).where(eq(mediaVariants.fileId, file.id));
  await inTransaction(ctx.pool, async (tx) => {
    const [locked] = await tx.select({ currentFileId: mediaAssets.currentFileId }).from(mediaAssets).where(eq(mediaAssets.id, mediaId)).for("update");
    if (locked?.currentFileId !== file.id) throw new Error("The item's current version changed meanwhile: run again.");
    await tx.delete(mediaVariants).where(eq(mediaVariants.fileId, file.id));
    await tx.insert(mediaVariants).values(
      generated.variants.map((v) => ({
        id: ulid(ctx.now.getTime()),
        fileId: file.id,
        variantKey: v.variantKey,
        format: "webp" as const,
        width: v.width,
        height: v.height,
        byteSize: v.byteSize,
        storageKey: v.storageKey,
        sha256: v.sha256,
        createdAt: ctx.now,
      })),
    );
    if (generated.blurDataUrl !== file.blurDataUrl) await tx.update(mediaFiles).set({ blurDataUrl: generated.blurDataUrl }).where(eq(mediaFiles.id, file.id));
    await syncPublicMedia(tx, mediaId, ctx.now);
    await audit(ctx, tx, "media.maintenance", `Regenerated the variants of media ${mediaId} (version ${file.version}).`, mediaId, { version: file.version, count: generated.variants.length });
  });
  const kept = new Set(generated.variants.map((v) => v.storageKey));
  for (const old of before) if (!kept.has(old.storageKey)) await store.remove("derived", old.storageKey).catch(() => undefined);
  return "ok";
}
