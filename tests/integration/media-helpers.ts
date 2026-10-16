/**
 * Helpers of the media library (A4) integration tests: a migrated database, a temporary RAWASY_DATA_DIR and a temporary
 * release folder per test file, the four roles, synthetic files made at test time (never a real document, certificate
 * number, QR code or person's name), the upload protocol driven exactly as the Route Handlers drive it, and the
 * `public_media` invariant (A4 brief §68) checked in both directions.
 */
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { crc32 } from "node:zlib";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { Actor } from "../../src/server/auth/types.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { deliverability } from "../../src/server/media/deliverability.ts";
import type { MediaContext, MediaDeps } from "../../src/server/media/service.ts";
import { MediaStore } from "../../src/server/media/storage.ts";
import { cancelUpload, completeUpload, openUpload, writePart, type UploadAnswer } from "../../src/server/media/uploads.ts";
import { MEDIA_LIMITS } from "../../src/server/media/registry.ts";
import { team, type Team } from "./cms-helpers.ts";
import { meta, setupTestEnv, type TestEnv } from "./helpers.ts";

export interface MediaEnv extends TestEnv {
  store: MediaStore;
  dataDir: string;
  releaseDir: string;
  media: MediaDeps;
  team: Team;
  closeMedia(): Promise<void>;
}

export async function setupMediaEnv(prefix: string): Promise<MediaEnv> {
  const env = await setupTestEnv(prefix);
  const dataDir = mkdtempSync(join(tmpdir(), "rawasy-media-test-"));
  const releaseDir = mkdtempSync(join(tmpdir(), "rawasy-release-test-"));
  const store = await MediaStore.open(dataDir);
  const media: MediaDeps = { pool: env.pool, db: env.deps.db, clock: env.deps.clock, store: async () => store, releaseDir };
  const roles = await team(env);
  return {
    ...env,
    store,
    dataDir,
    releaseDir,
    media,
    team: roles,
    async closeMedia() {
      await env.close();
      rmSync(dataDir, { recursive: true, force: true });
      rmSync(releaseDir, { recursive: true, force: true });
    },
  };
}

export const mctx = (env: MediaEnv, actor: Actor): MediaContext => ({ deps: env.media, actor, meta: meta() });

// --- Synthetic files ----------------------------------------------------------------------------------------------------

/** A JPEG photo-like gradient (no metadata unless asked). */
export async function jpeg(width: number, height: number, options: { orientation?: number; seed?: number } = {}): Promise<Buffer> {
  const seed = options.seed ?? 1;
  let pipeline = sharp({ create: { width, height, channels: 3, background: { r: (seed * 37) % 256, g: (seed * 91) % 256, b: (seed * 53) % 256 } } })
    .composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><rect x="0" y="0" width="${Math.ceil(width / 2)}" height="${height}" fill="#fff"/></svg>`), top: 0, left: 0 }])
    .jpeg({ quality: 80 });
  if (options.orientation) pipeline = pipeline.withMetadata({ orientation: options.orientation });
  return pipeline.toBuffer();
}

export const png = (width: number, height: number, seed = 2) =>
  sharp({ create: { width, height, channels: 4, background: { r: (seed * 41) % 256, g: 120, b: 200, alpha: 1 } } }).png().toBuffer();

export const webp = (width: number, height: number, seed = 3) => sharp({ create: { width, height, channels: 3, background: { r: 10, g: (seed * 29) % 256, b: 30 } } }).webp().toBuffer();

export const avif = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 90 } } }).avif({ quality: 50 }).toBuffer();

/** A minimal, valid one-page PDF that says it is a synthetic test document (no real content). */
export function pdf(label = "Synthetic test document"): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>",
  ];
  const stream = `BT /F1 12 Tf 20 100 Td (${label.replace(/[()\\]/g, "")}) Tj ET`;
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

const chunk = (type: string, data: Buffer) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "latin1"), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
};

/** A small PNG whose header claims `width` × `height` (a decompression bomb: tiny file, enormous image). */
export function pngBomb(width = 20_000, height = 20_000): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const row = Buffer.alloc(1 + width);
  const idat = deflateSync(Buffer.concat(Array.from({ length: 4 }, () => row)));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// --- The upload protocol, as the Route Handlers drive it ----------------------------------------------------------------

async function* once(data: Uint8Array) {
  yield data;
}

export interface UploadOptions {
  purpose?: "new" | "replace" | "private_original";
  mediaId?: string;
  certificateId?: string;
  folderId?: string;
  keepDuplicate?: boolean;
  /** Declared size (defaults to the real size). */
  size?: number;
  /** Another store to drive the protocol with (a `hookedStore` that acts in the middle of the processing). */
  store?: MediaStore;
}

/** Opens, sends every part in order, completes. Returns the last answer (and the open answer's upload id). */
export async function upload(env: MediaEnv, actor: Actor, bytes: Buffer, filename: string, options: UploadOptions = {}): Promise<UploadAnswer & { uploadId?: string }> {
  const ctx = mctx(env, actor);
  const store = options.store ?? env.store;
  const opened = await openUpload(ctx, store, {
    purpose: options.purpose ?? "new",
    filename,
    size: options.size ?? bytes.length,
    ...(options.mediaId ? { mediaId: options.mediaId } : {}),
    ...(options.certificateId ? { certificateId: options.certificateId } : {}),
    ...(options.folderId ? { folderId: options.folderId } : {}),
  });
  if (opened.status !== 201) return opened;
  const uploadId = String(opened.body!.uploadId);
  const parts = Number(opened.body!.parts);
  for (let part = 1; part <= parts; part++) {
    const slice = bytes.subarray((part - 1) * MEDIA_LIMITS.chunkBytes, part * MEDIA_LIMITS.chunkBytes);
    const answer = await writePart(ctx, store, uploadId, String(part), String(slice.length), once(slice));
    if (answer.status !== 204) return { ...answer, uploadId };
  }
  const done = await completeUpload(ctx, store, uploadId, options.keepDuplicate ? { keepDuplicate: true } : {});
  return { ...done, uploadId };
}

/**
 * The test's store, with `hook` run once before the first `method` call that matches `when` — something another person
 * does while a file is being processed (the processing itself is the store's real code).
 */
export function hookedStore<M extends "writeNew" | "move">(env: MediaEnv, method: M, when: (...args: Parameters<MediaStore[M]>) => boolean, hook: () => Promise<void>): MediaStore {
  const hooked = Object.create(env.store) as MediaStore;
  let fired = false;
  const original = MediaStore.prototype[method] as (...args: unknown[]) => Promise<unknown>;
  (hooked as unknown as Record<string, unknown>)[method] = async function (this: MediaStore, ...args: Parameters<MediaStore[M]>) {
    if (!fired && when(...args)) {
      fired = true;
      await hook();
    }
    return original.apply(this, args);
  };
  return hooked;
}

export async function uploadOk(env: MediaEnv, actor: Actor, bytes: Buffer, filename: string, options: UploadOptions = {}): Promise<string> {
  const answer = await upload(env, actor, bytes, filename, options);
  assert.equal(answer.status, 201, JSON.stringify(answer.body));
  return String(answer.body!.mediaId);
}

export { cancelUpload, once };

// --- The public_media invariant (A4 brief §68) ----------------------------------------------------------------------------

/**
 * Both directions: every deliverable item has its `public_media` row (pointing at its current file), and every row
 * belongs to a deliverable item. Run after each test that changes media.
 */
export async function assertPublicMediaInvariant(env: TestEnv): Promise<void> {
  const db = dbFor(env.pool);
  const [assets] = (await env.pool.query("SELECT id, visibility, usage_status, deleted_at, kind, current_file_id FROM media_assets")) as unknown as [Record<string, unknown>[]];
  const [files] = (await env.pool.query("SELECT id, processing_status, storage_area FROM media_files")) as unknown as [Record<string, unknown>[]];
  const [variants] = (await env.pool.query("SELECT file_id, variant_key FROM media_variants")) as unknown as [Record<string, unknown>[]];
  const [flags] = (await env.pool.query("SELECT media_id, flag FROM media_flags")) as unknown as [Record<string, unknown>[]];
  const [rows] = (await env.pool.query("SELECT media_id, file_id FROM public_media")) as unknown as [Record<string, unknown>[]];
  void db;
  const published = new Map(rows.map((r) => [String(r.media_id), String(r.file_id)]));
  for (const asset of assets) {
    const current = files.find((f) => f.id === asset.current_file_id) ?? null;
    const verdict = deliverability({
      visibility: asset.visibility as "public" | "private",
      usageStatus: asset.usage_status as "approved",
      deleted: asset.deleted_at !== null,
      flags: flags.filter((f) => f.media_id === asset.id).map((f) => String(f.flag)),
      kind: asset.kind as "image",
      current: current ? { processingStatus: String(current.processing_status), storageArea: String(current.storage_area) } : null,
      widthVariants: current ? variants.filter((v) => v.file_id === current.id && v.variant_key !== "thumb").length : 0,
    });
    const row = published.get(String(asset.id));
    if (verdict.deliverable) {
      assert.ok(row, `deliverable item ${asset.id} has no public_media row`);
      assert.equal(row, asset.current_file_id, `public_media of ${asset.id} names its current file`);
    } else {
      assert.equal(row, undefined, `non-deliverable item ${asset.id} (${verdict.reasons.join(" ")}) has a public_media row`);
    }
    if (asset.visibility === "private") assert.equal(row, undefined, "a private item never has a public_media row");
  }
  for (const id of published.keys()) assert.ok(assets.some((a) => a.id === id), `public_media row ${id} without an item`);
}
