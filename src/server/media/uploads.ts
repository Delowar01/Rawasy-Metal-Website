/**
 * The chunked upload protocol (A4 brief §24–§35; A1-MEDIA-STORAGE §6): framework-free, called by the Route Handlers
 * under `/api/admin/media/uploads` (never Server Actions: their 1 MB limit and in-memory body).
 *
 *   POST   /api/admin/media/uploads                          open: purpose, file name, size (→ upload id, part size)
 *   PUT    /api/admin/media/uploads/{upload}/parts/{n}       one part, streamed to disk with a byte cap
 *   POST   /api/admin/media/uploads/{upload}/complete        assemble, verify, store, process (→ the media item)
 *   DELETE /api/admin/media/uploads/{upload}                 cancel
 *
 * - **Ownership** lives in the upload's private manifest (`tmp/uploads/<upload>/manifest.json`, 0600): the user and the
 *   session that opened it. Another user, another session (outside its rotation lineage), or an unknown id gets "not
 *   found" — a guessed ULID reveals nothing. No database table holds uploads.
 * - **Limits:** at most 5 open uploads per user (slots in `rate_limits`, freed on completion or cancel, or after the
 *   1-hour lifetime — only by the upload that holds them), 60 new uploads per user per hour, 20 MiB per file, parts of
 *   exactly 4 MiB (the last one shorter), at most 5 parts, the declared size checked before anything is read and the
 *   assembled size again. Opening an upload first removes the person's own expired, abandoned ones.
 * - **Verification** before any database row: the extension must be accepted and the bytes' signature must match it
 *   (`signature.ts`); an image's header is read with the 40-megapixel limit (`images.ts`); a PDF needs its header and its
 *   end marker. Duplicates (same SHA-256) are offered for reuse first — only items the person may know of.
 * - **Processing** (`versions.ts` around it): the file row `processing`, the verified original moved to `originals/`
 *   (public class) or `private/` (a certificate's private original, never derived), the variants of a public image, then
 *   the row `ready` and current. A failure leaves the row `failed`, never anything deliverable, and removes what was
 *   written.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { hitRateLimit, HOUR } from "../auth/rate-limit.ts";
import type { Db } from "../db/client.ts";
import { rateLimits, sessions } from "../db/schema.ts";
import { mediaAssets, mediaFiles, mediaTranslations } from "../db/schema-media.ts";
import { isUlid, sha256, ulid } from "../security/ids.ts";
import { canSeePrivate, decideAccess, mayUploadPrivate, mayUploadPublic } from "./access.ts";
import { generateVariants, ImageRejected, probeImage } from "./images.ts";
import { MEDIA_LIMITS, typeForExtension, USAGE_STATUS_LABELS, type AcceptedType, type UploadPurpose } from "./registry.ts";
import { displayFilename, extensionOf, HEAD_BYTES, TAIL_BYTES, verifySignature } from "./signature.ts";
import { originalKey, privateKey, StoragePathError, StorageSizeError, type MediaStore } from "./storage.ts";
import type { MediaContext } from "./service.ts";
import { beginNewItem, beginNewVersion, failUpload, finishUpload } from "./versions.ts";

// --- Manifest -------------------------------------------------------------------------------------------------------------

export interface UploadManifest {
  v: 1;
  uploadId: string;
  userId: string;
  sessionId: string;
  purpose: UploadPurpose;
  /** replace: the item; private_original: none (a new item). */
  targetMediaId: string | null;
  /** private_original: the certificate the document belongs to. */
  certificateId: string | null;
  folderId: string | null;
  /** Display name (sanitized; never used for a path). */
  filename: string;
  extension: string;
  size: number;
  partSize: number;
  parts: number;
  createdAt: string;
  expiresAt: string;
  /** The open-upload slot this upload holds (0–4). */
  slot: number;
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const manifestSchema = z
  .object({
    v: z.literal(1),
    uploadId: z.string().regex(ULID_RE),
    userId: z.string().regex(ULID_RE),
    sessionId: z.string().regex(ULID_RE),
    purpose: z.enum(["new", "replace", "private_original"]),
    targetMediaId: z.string().regex(ULID_RE).nullable(),
    certificateId: z.string().regex(ULID_RE).nullable(),
    folderId: z.string().regex(ULID_RE).nullable(),
    filename: z.string().max(400),
    extension: z.string().max(10),
    size: z.number().int().min(1).max(MEDIA_LIMITS.maxBytes),
    partSize: z.literal(MEDIA_LIMITS.chunkBytes),
    parts: z.number().int().min(1).max(MEDIA_LIMITS.maxParts),
    createdAt: z.string(),
    expiresAt: z.string(),
    slot: z.number().int().min(0).max(MEDIA_LIMITS.activeUploads - 1),
  })
  .strict();

const manifestKey = (uploadId: string) => `${uploadId}/manifest.json`;
const lockKey = (uploadId: string) => `${uploadId}/complete.lock`;
const assembledKey = (uploadId: string) => `${uploadId}/assembled`;
const partKey = (uploadId: string, part: number) => `${uploadId}/part-${part}`;

async function readManifest(store: MediaStore, uploadId: string): Promise<UploadManifest | null> {
  const opened = await store.openRead("tmp", manifestKey(uploadId)).catch(() => null);
  if (!opened) return null;
  try {
    if (opened.size > 8192) return null;
    const text = await opened.handle.readFile("utf8");
    const parsed = manifestSchema.safeParse(JSON.parse(text));
    return parsed.success ? (parsed.data as UploadManifest) : null;
  } catch {
    return null;
  } finally {
    await opened.handle.close().catch(() => undefined);
  }
}

async function exists(store: MediaStore, key: string) {
  return (await store.sizeOf("tmp", key)) !== null;
}

// --- Results ---------------------------------------------------------------------------------------------------------------

/** What a route answers: an HTTP status and a JSON body (never a path, a key or a library's message). */
export interface UploadAnswer {
  status: number;
  body: Record<string, unknown> | null;
}

const answer = (status: number, body: Record<string, unknown> | null = null): UploadAnswer => ({ status, body });
const problem = (status: number, error: string, extra: Record<string, unknown> = {}): UploadAnswer => answer(status, { error, ...extra });
const NOT_FOUND = () => problem(404, "This upload does not exist, has finished, or is not yours.");

// --- Slots (5 open uploads per user) ------------------------------------------------------------------------------------

const SLOT_ROW = new Date(0);
const slotHash = (userId: string, slot: number) => sha256(`media:upload-slot:${userId}#${slot}`);

/**
 * Claims a free open-upload slot (a single conditional UPDATE per slot; rows inserted in key order): the slot and the
 * time it is held until (the upload's expiry, and the claim's mark: see `freeUploadSlot`). Null when all 5 are taken.
 */
export async function claimUploadSlot(db: Db, userId: string, now: Date): Promise<{ slot: number; until: Date } | null> {
  const hashes = Array.from({ length: MEDIA_LIMITS.activeUploads }, (_, slot) => slotHash(userId, slot));
  await db
    .insert(rateLimits)
    .ignore()
    .values([...hashes].sort(Buffer.compare).map((keyHash) => ({ keyHash, windowStart: SLOT_ROW, count: 0, expiresAt: SLOT_ROW })));
  const until = new Date(now.getTime() + MEDIA_LIMITS.uploadTtlMs);
  for (const [slot, keyHash] of hashes.entries()) {
    const [taken] = await db
      .update(rateLimits)
      .set({ count: sql`${rateLimits.count} + 1`, expiresAt: until })
      .where(and(eq(rateLimits.keyHash, keyHash), eq(rateLimits.windowStart, SLOT_ROW), lte(rateLimits.expiresAt, now)));
    if (taken.affectedRows === 1) return { slot, until };
  }
  return null;
}

/**
 * Frees a slot (completion, cancel, expiry) — only while the upload that claimed it still holds it: the row still
 * carries that claim's expiry. Once an upload has expired its slot may be claimed again, and a late cancel or complete
 * of the expired upload must not free the newer upload's slot (that would allow more than 5 open uploads). Never
 * deletes the row (a concurrent claim still finds it).
 */
export async function freeUploadSlot(db: Db, userId: string, slot: number, heldUntil: Date): Promise<void> {
  await db
    .update(rateLimits)
    .set({ expiresAt: SLOT_ROW })
    .where(and(eq(rateLimits.keyHash, slotHash(userId, slot)), eq(rateLimits.windowStart, SLOT_ROW), eq(rateLimits.expiresAt, heldUntil)));
}

// --- Ownership ---------------------------------------------------------------------------------------------------------------

/**
 * Whether the acting session is the one that opened the upload, or a session it was rotated into (A2 rotates session
 * tokens: the row's `replaced_by_id` names the successor). Followed at most 20 steps; nothing else ever matches.
 */
async function sameSessionLineage(db: Db, openedBy: string, current: string): Promise<boolean> {
  if (openedBy === current) return true;
  let id: string | null = openedBy;
  for (let step = 0; id && step < 20; step++) {
    const rows: { next: string | null }[] = await db.select({ next: sessions.replacedById }).from(sessions).where(eq(sessions.id, id));
    id = rows[0]?.next ?? null;
    if (id === current) return true;
  }
  return false;
}

/** The manifest when the upload exists and belongs to this user and session; null otherwise (answer "not found"). */
async function ownedManifest(ctx: MediaContext, store: MediaStore, uploadId: string): Promise<UploadManifest | null> {
  if (!isUlid(uploadId)) return null;
  const manifest = await readManifest(store, uploadId);
  if (!manifest || manifest.uploadId !== uploadId || manifest.userId !== ctx.actor.user.id) return null;
  if (!(await sameSessionLineage(ctx.deps.db, manifest.sessionId, ctx.actor.session.id))) return null;
  return manifest;
}

/** Whether the purpose of an upload is still allowed to this session (permissions can change while it runs). */
const purposeAllowed = (ctx: MediaContext, purpose: UploadPurpose) =>
  purpose === "private_original" ? mayUploadPrivate(ctx.actor.permissions) : purpose === "replace" ? ctx.actor.permissions.has("media.upload") && ctx.actor.permissions.has("media.edit") : mayUploadPublic(ctx.actor.permissions);

/** Removes an expired or finished upload's folder and frees its slot (if it still holds it). */
async function discard(ctx: MediaContext, store: MediaStore, manifest: UploadManifest) {
  await store.removeUpload(manifest.uploadId).catch(() => undefined);
  await freeUploadSlot(ctx.deps.db, manifest.userId, manifest.slot, new Date(manifest.expiresAt));
}

const expired = (manifest: UploadManifest, now: Date) => Date.parse(manifest.expiresAt) <= now.getTime();

/** How many staging folders one sweep looks at, at most (oldest first: upload ids begin with their time). */
const SWEEP_LIMIT = 200;

/**
 * Removes the acting user's expired uploads that were never finished or cancelled, before a new one opens: their parts
 * (up to 20 MiB each) would otherwise stay on disk until someone runs the maintenance tool, while their slots are free
 * again — so abandoned uploads could pile up. A folder being completed (its lock present) is left alone.
 */
async function sweepExpired(ctx: MediaContext, store: MediaStore, now: Date): Promise<void> {
  let names: string[];
  try {
    names = (await readdir(store.areaRoot("tmp"))).filter(isUlid).sort().slice(0, SWEEP_LIMIT);
  } catch {
    return;
  }
  for (const uploadId of names) {
    const manifest = await readManifest(store, uploadId);
    if (!manifest || manifest.uploadId !== uploadId || manifest.userId !== ctx.actor.user.id || !expired(manifest, now)) continue;
    if (await exists(store, lockKey(uploadId))) continue;
    await discard(ctx, store, manifest);
  }
}

// --- Open ----------------------------------------------------------------------------------------------------------------------

export const openRequestSchema = z
  .object({
    purpose: z.enum(["new", "replace", "private_original"]),
    filename: z.string().min(1).max(1000),
    size: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    mediaId: z.string().regex(ULID_RE).optional(),
    certificateId: z.string().regex(ULID_RE).optional(),
    folderId: z.string().regex(ULID_RE).optional(),
  })
  .strict();

export async function openUpload(ctx: MediaContext, store: MediaStore, body: unknown): Promise<UploadAnswer> {
  const parsed = openRequestSchema.safeParse(body);
  if (!parsed.success) return problem(400, "The upload request is not valid.");
  const request = parsed.data;
  const { deps, actor } = ctx;
  if (!purposeAllowed(ctx, request.purpose)) return problem(request.purpose === "private_original" && !canSeePrivate(actor.permissions) ? 404 : 403, "You don't have permission to upload this file.");
  if (request.purpose === "replace" && !request.mediaId) return problem(400, "Choose the item to replace.");
  if (request.purpose === "private_original" && !request.certificateId) return problem(400, "Choose the certificate.");
  if (request.size < 1) return problem(400, "The file is empty.");
  if (request.size > MEDIA_LIMITS.maxBytes) return problem(413, `The file is larger than ${MEDIA_LIMITS.maxBytes / 1024 / 1024} MB.`);
  const filename = displayFilename(request.filename, MEDIA_LIMITS.filenameMax);
  const extension = extensionOf(filename);
  const accepted = typeForExtension(extension);
  if (!accepted) return problem(415, "This file type is not accepted. Use JPEG, PNG, WebP, AVIF or PDF.");
  if (request.purpose === "replace") {
    // Early answer for the target (decided again, under its lock, when the file is stored).
    const [target] = await deps.db.select({ visibility: mediaAssets.visibility, kind: mediaAssets.kind, deletedAt: mediaAssets.deletedAt }).from(mediaAssets).where(eq(mediaAssets.id, request.mediaId!));
    if (!target) return NOT_FOUND();
    const decision = decideAccess(actor.permissions, "replace", target.visibility);
    if (!decision.ok) return decision.hidden ? NOT_FOUND() : problem(403, "You don't have permission to replace this file.");
    if (target.deletedAt) return problem(409, "This item is in the Trash. Restore it before replacing its file.");
    if (target.kind !== accepted.kind) return problem(415, `A replacement must be ${target.kind === "image" ? "an image (JPEG, PNG, WebP or AVIF)" : "a PDF document"}, like the current file.`);
  }
  const now = deps.clock();
  const hourly = await hitRateLimit(deps.db, `media:uploads:${actor.user.id}`, { limit: MEDIA_LIMITS.uploadsPerHour, windowMs: HOUR }, now);
  if (!hourly.allowed) return problem(429, `You have started ${MEDIA_LIMITS.uploadsPerHour} uploads in the last hour. Try again later.`);
  await sweepExpired(ctx, store, now);
  const claim = await claimUploadSlot(deps.db, actor.user.id, now);
  if (!claim) return problem(409, `You already have ${MEDIA_LIMITS.activeUploads} uploads open. Finish or cancel one first.`);
  const { slot, until } = claim;
  const uploadId = ulid(now.getTime());
  const manifest: UploadManifest = {
    v: 1,
    uploadId,
    userId: actor.user.id,
    sessionId: actor.session.id,
    purpose: request.purpose,
    targetMediaId: request.purpose === "replace" ? request.mediaId! : null,
    certificateId: request.purpose === "private_original" ? request.certificateId! : null,
    folderId: request.purpose === "new" ? (request.folderId ?? null) : null,
    filename,
    extension,
    size: request.size,
    partSize: MEDIA_LIMITS.chunkBytes,
    parts: Math.ceil(request.size / MEDIA_LIMITS.chunkBytes),
    createdAt: now.toISOString(),
    // The slot's claim mark too: a slot is freed only by the upload whose expiry it still carries.
    expiresAt: until.toISOString(),
    slot,
  };
  try {
    await store.writeAtomic("tmp", manifestKey(uploadId), Buffer.from(JSON.stringify(manifest)));
  } catch (error) {
    await freeUploadSlot(deps.db, actor.user.id, slot, until);
    throw error;
  }
  return answer(201, { uploadId, partSize: manifest.partSize, parts: manifest.parts, expiresAt: manifest.expiresAt });
}

// --- Parts ------------------------------------------------------------------------------------------------------------------------

/** The exact length of a part: every part is `partSize` long except the last. */
export const expectedPartLength = (manifest: Pick<UploadManifest, "size" | "partSize" | "parts">, part: number) =>
  part < manifest.parts ? manifest.partSize : manifest.size - manifest.partSize * (manifest.parts - 1);

export async function writePart(ctx: MediaContext, store: MediaStore, uploadId: string, rawPart: string, contentLength: string | null, body: AsyncIterable<Uint8Array> | null): Promise<UploadAnswer> {
  const manifest = await ownedManifest(ctx, store, uploadId);
  if (!manifest) return NOT_FOUND();
  if (!purposeAllowed(ctx, manifest.purpose)) return problem(403, "You don't have permission to upload this file.");
  const now = ctx.deps.clock();
  if (expired(manifest, now)) {
    await discard(ctx, store, manifest);
    return problem(410, "This upload expired. Start it again.");
  }
  if (!/^[1-9][0-9]?$/.test(rawPart)) return problem(400, "Unknown part number.");
  const part = Number(rawPart);
  if (part > manifest.parts) return problem(400, "Unknown part number.");
  if (await exists(store, lockKey(uploadId))) return problem(409, "This upload is being completed.");
  if (contentLength === null || !/^[0-9]{1,9}$/.test(contentLength)) return problem(411, "Each part needs its length.");
  const length = Number(contentLength);
  const expected = expectedPartLength(manifest, part);
  if (length > manifest.partSize) return problem(413, "A part may be at most 4 MiB.");
  if (length !== expected) return problem(400, `Part ${part} must be exactly ${expected} bytes.`);
  if (!body) return problem(400, "The part has no body.");
  try {
    await store.writeStreamAtomic("tmp", partKey(uploadId, part), body, { maxBytes: manifest.partSize, exactBytes: expected });
  } catch (error) {
    if (error instanceof StorageSizeError) return problem(error.kind === "too_large" ? 413 : 400, `Part ${part} must be exactly ${expected} bytes.`);
    // The folder went while the part was streamed: the upload expired meanwhile and was cleaned up.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return problem(410, "This upload expired. Start it again.");
    throw error;
  }
  return answer(204);
}

// --- Cancel -------------------------------------------------------------------------------------------------------------------------

export async function cancelUpload(ctx: MediaContext, store: MediaStore, uploadId: string): Promise<UploadAnswer> {
  const manifest = await ownedManifest(ctx, store, uploadId);
  if (!manifest) return NOT_FOUND();
  if (await exists(store, lockKey(uploadId))) return problem(409, "This upload is being completed.");
  await discard(ctx, store, manifest);
  return answer(204);
}

// --- Complete ---------------------------------------------------------------------------------------------------------------------

export const completeRequestSchema = z.object({ keepDuplicate: z.boolean().optional() }).strict();

/** An item that holds the same bytes, as far as the person may know of it (A4 brief §35). */
export interface DuplicateCandidate {
  id: string;
  label: string;
  status: string;
  kind: string;
  trashed: false;
}

async function duplicatesOf(ctx: MediaContext, hash: Buffer, exceptId: string | null): Promise<DuplicateCandidate[]> {
  const { db } = ctx.deps;
  const seePrivate = canSeePrivate(ctx.actor.permissions);
  const rows = await db
    .selectDistinct({ id: mediaAssets.id, status: mediaAssets.usageStatus, kind: mediaAssets.kind, legacyKey: mediaAssets.legacyKey })
    .from(mediaFiles)
    .innerJoin(mediaAssets, eq(mediaAssets.id, mediaFiles.mediaId))
    .where(and(eq(mediaFiles.sha256, hash), isNull(mediaAssets.deletedAt), seePrivate ? sql`TRUE` : eq(mediaAssets.visibility, "public")))
    .limit(6);
  const out: DuplicateCandidate[] = [];
  for (const row of rows) {
    if (row.id === exceptId) continue;
    const titles = await db.select({ locale: mediaTranslations.locale, title: mediaTranslations.title }).from(mediaTranslations).where(eq(mediaTranslations.mediaId, row.id));
    const label = titles.find((t) => t.locale === "en")?.title || titles.find((t) => t.locale === "ar")?.title || row.legacyKey || "Untitled item";
    out.push({ id: row.id, label, status: USAGE_STATUS_LABELS[row.status], kind: row.kind, trashed: false });
  }
  return out.slice(0, 5);
}

interface Assembled {
  size: number;
  sha256: Buffer;
  head: Buffer;
  tail: Buffer;
}

/** Concatenates the parts into `assembled` (streamed, hashed on the way), checking every part's exact length. */
async function assemble(store: MediaStore, manifest: UploadManifest): Promise<Assembled | UploadAnswer> {
  for (let part = 1; part <= manifest.parts; part++) {
    const size = await store.sizeOf("tmp", partKey(manifest.uploadId, part));
    if (size === null) return problem(400, `Part ${part} is missing. Send it, then complete again.`);
    if (size !== expectedPartLength(manifest, part)) return problem(400, `Part ${part} has the wrong length. Send it again.`);
  }
  const hash = createHash("sha256");
  let head = Buffer.alloc(0);
  let tail = Buffer.alloc(0);
  const reader = async function* () {
    for (let part = 1; part <= manifest.parts; part++) {
      const opened = await store.readStream("tmp", partKey(manifest.uploadId, part));
      if (!opened) throw new StoragePathError("A part disappeared.");
      for await (const chunk of opened.stream as AsyncIterable<Buffer>) {
        hash.update(chunk);
        if (head.length < HEAD_BYTES) head = Buffer.concat([head, chunk.subarray(0, HEAD_BYTES - head.length)]);
        tail = Buffer.concat([tail, chunk]).subarray(-TAIL_BYTES);
        yield chunk;
      }
    }
  };
  const size = await store.writeStreamAtomic("tmp", assembledKey(manifest.uploadId), reader(), { maxBytes: MEDIA_LIMITS.maxBytes, exactBytes: manifest.size });
  for (let part = 1; part <= manifest.parts; part++) await store.remove("tmp", partKey(manifest.uploadId, part)).catch(() => undefined);
  return { size, sha256: hash.digest(), head, tail };
}

/** Reads back an assembled file's facts (a second complete after a duplicate question). */
async function readAssembled(store: MediaStore, manifest: UploadManifest): Promise<Assembled | null> {
  const opened = await store.readStream("tmp", assembledKey(manifest.uploadId));
  if (!opened) return null;
  if (opened.size !== manifest.size) {
    opened.stream.destroy();
    return null;
  }
  const hash = createHash("sha256");
  let head = Buffer.alloc(0);
  let tail = Buffer.alloc(0);
  for await (const chunk of opened.stream as AsyncIterable<Buffer>) {
    hash.update(chunk);
    if (head.length < HEAD_BYTES) head = Buffer.concat([head, chunk.subarray(0, HEAD_BYTES - head.length)]);
    tail = Buffer.concat([tail, chunk]).subarray(-TAIL_BYTES);
  }
  return { size: opened.size, sha256: hash.digest(), head, tail };
}

/** A PDF also needs the cross-reference pointer before its end marker (a truncated or padded file has none). */
const pdfStructureOk = (tail: Buffer) => /startxref\s+[0-9]+\s+%%EOF\s*$/.test(tail.toString("latin1"));

/** Holds the completion lock (exclusive create): two completes of one upload never run at once. */
async function takeCompleteLock(store: MediaStore, uploadId: string): Promise<boolean> {
  const path = await store.ensureDirFor("tmp", lockKey(uploadId));
  try {
    const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

export async function completeUpload(ctx: MediaContext, store: MediaStore, uploadId: string, body: unknown): Promise<UploadAnswer> {
  const options = completeRequestSchema.safeParse(body ?? {});
  if (!options.success) return problem(400, "The request is not valid.");
  const manifest = await ownedManifest(ctx, store, uploadId);
  if (!manifest) return NOT_FOUND();
  if (!purposeAllowed(ctx, manifest.purpose)) return problem(403, "You don't have permission to upload this file.");
  const now = ctx.deps.clock();
  if (expired(manifest, now)) {
    if (!(await exists(store, lockKey(uploadId)))) await discard(ctx, store, manifest);
    return problem(410, "This upload expired. Start it again.");
  }
  if (!(await takeCompleteLock(store, uploadId))) return problem(409, "This upload is already being completed.");
  let keep = false;
  try {
    const result = await completeLocked(ctx, store, manifest, options.data.keepDuplicate === true);
    keep = result.keep;
    return result.answer;
  } finally {
    // Kept for another try only when the person can act on it: a missing or short part (send it again) or a duplicate
    // question (reuse, or upload anyway). Anything else ends the upload: its folder goes and its slot frees.
    if (keep) await store.remove("tmp", lockKey(uploadId)).catch(() => undefined);
    else await discard(ctx, store, manifest);
  }
}

async function completeLocked(ctx: MediaContext, store: MediaStore, manifest: UploadManifest, keepDuplicate: boolean): Promise<{ answer: UploadAnswer; keep: boolean }> {
  const assembledAlready = (await store.sizeOf("tmp", assembledKey(manifest.uploadId))) !== null;
  const facts = assembledAlready ? await readAssembled(store, manifest) : await assemble(store, manifest);
  if (!facts) return { answer: problem(400, "The upload's data is incomplete. Start it again."), keep: false };
  if ("status" in facts) return { answer: facts, keep: true };
  if (facts.size !== manifest.size) return { answer: problem(400, "The file is not the size that was announced."), keep: false };
  const verified = verifySignature(manifest.extension, facts.head, facts.tail, facts.size);
  if (!verified.ok) return { answer: problem(422, verified.reason), keep: false };
  const accepted = verified.accepted;
  if (accepted.type === "pdf" && !pdfStructureOk(facts.tail)) return { answer: problem(422, "The PDF is incomplete or damaged (no cross-reference table before its end)."), keep: false };
  let dims: { width: number; height: number } | null = null;
  if (accepted.kind === "image") {
    try {
      dims = await probeImage(await store.verifiedPath("tmp", assembledKey(manifest.uploadId)), accepted.type as Exclude<AcceptedType["type"], "pdf">);
    } catch (error) {
      if (error instanceof ImageRejected) return { answer: problem(422, error.message), keep: false };
      throw error;
    }
  }
  if (!keepDuplicate) {
    const duplicates = await duplicatesOf(ctx, facts.sha256, manifest.targetMediaId);
    if (duplicates.length) {
      return {
        answer: problem(409, "The library already holds this exact file. Use the existing item, or upload it anyway as a separate item.", { duplicates }),
        keep: true,
      };
    }
  }
  return { answer: await storeAndProcess(ctx, store, manifest, accepted, facts, dims), keep: false };
}

async function storeAndProcess(ctx: MediaContext, store: MediaStore, manifest: UploadManifest, accepted: AcceptedType, facts: Assembled, dims: { width: number; height: number } | null): Promise<UploadAnswer> {
  const now = ctx.deps.clock();
  const privateItem = manifest.purpose === "private_original";
  const fileId = ulid(now.getTime());
  const extension = accepted.extensions[0];
  let mediaId = manifest.targetMediaId ?? ulid(now.getTime());
  let visibility: "public" | "private" = privateItem ? "private" : "public";
  if (manifest.purpose === "replace") {
    const [target] = await ctx.deps.db.select({ visibility: mediaAssets.visibility }).from(mediaAssets).where(eq(mediaAssets.id, mediaId));
    if (!target) return NOT_FOUND();
    visibility = target.visibility;
  }
  const area: "originals" | "private" = visibility === "private" ? "private" : "originals";
  const storageKey = area === "private" ? privateKey(mediaId, fileId, extension) : originalKey(fileId, extension, now);
  const file = {
    fileId,
    storageArea: area,
    storageKey,
    originalFilename: manifest.filename,
    mimeType: accepted.mime,
    extension,
    byteSize: facts.size,
    sha256: facts.sha256,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
  const begun =
    manifest.purpose === "replace"
      ? await beginNewVersion(ctx, { mediaId, kind: accepted.kind, file })
      : await beginNewItem(ctx, { mediaId, kind: accepted.kind, visibility: privateItem ? "private" : "public", folderId: manifest.folderId, certificateId: manifest.certificateId, file });
  if (begun.kind === "not_found") return NOT_FOUND();
  if (begun.kind === "denied") return problem(403, begun.message);
  if (begun.kind === "refused") return problem(409, begun.message);
  mediaId = begun.mediaId;
  const written: { area: "originals" | "private" | "derived"; key: string }[] = [];
  try {
    await store.move("tmp", assembledKey(manifest.uploadId), area, storageKey);
    written.push({ area, key: storageKey });
    let variants: Awaited<ReturnType<typeof generateVariants>>["variants"] = [];
    let blur: string | null = null;
    if (accepted.kind === "image" && area === "originals" && dims) {
      const generated = await generateVariants(store, await store.verifiedPath(area, storageKey), mediaId, fileId, dims);
      variants = generated.variants;
      blur = generated.blurDataUrl;
      // Only what this upload created is ever removed again (a name it found holding the same bytes is not its file).
      for (const v of variants) if (v.created) written.push({ area: "derived", key: v.storageKey });
    }
    // Step 5: what was written is checked back before anything is marked ready.
    if ((await store.sizeOf(area, storageKey)) !== facts.size) throw new Error("The stored original is not complete.");
    const finished = await finishUpload(ctx, {
      mediaId,
      fileId,
      purpose: manifest.purpose,
      certificateId: manifest.certificateId,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      blurDataUrl: blur,
      variants,
    });
    if (finished.kind !== "ok") throw new ProcessingFailure(finished.message);
    return answer(201, { mediaId, version: finished.version, current: finished.current, status: finished.status, statusLabel: USAGE_STATUS_LABELS[finished.status] });
  } catch (error) {
    const message =
      error instanceof ImageRejected || error instanceof ProcessingFailure ? error.message : "The file could not be processed. Nothing was published; try again, or report it.";
    for (const item of written) await store.remove(item.area, item.key).catch(() => undefined);
    await failUpload(ctx, { mediaId, fileId, purpose: manifest.purpose, message }).catch(() => undefined);
    return problem(422, message, { mediaId });
  }
}

class ProcessingFailure extends Error {}
