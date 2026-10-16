/**
 * The database side of an upload's processing (A4 brief §32–§33; A1-MEDIA-STORAGE §6, §11): the steps around the work
 * on disk.
 *
 * - `beginNewItem` / `beginNewVersion` (step 2): the item (new uploads) and the file row, `processing`, committed before
 *   any binary is moved — a crash leaves a visible `processing` row for the maintenance tool, never an unrecorded file.
 *   Decided under the item's lock with the session's permissions; a replacement gets the next version number there.
 * - `finishUpload` (steps 6–9): one transaction — the variant rows, the file `ready`, the current version switched
 *   (only to a newer version than the current one: of two replacements finishing out of order the newer wins), the
 *   status rule (a replacement returns an approved item to review — Owner decision 8 — and never lifts a restriction),
 *   `public_media` rebuilt (a replaced item is withdrawn until it is approved again), the search rows, the audit event,
 *   and for a certificate's private original its `certificate_documents` link.
 * - `failUpload`: the file row `failed` with a safe reason; nothing becomes current, nothing deliverable.
 *
 * The previous version stays current and deliverable until its replacement is ready (§33): a failed replacement leaves
 * the item exactly as it was.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { certificateDocuments } from "../db/schema-cms.ts";
import { mediaAssets, mediaFiles, mediaVariants } from "../db/schema-media.ts";
import { contentTransaction, rowsOf } from "../cms/store.ts";
import { ulid } from "../security/ids.ts";
import { decideAccess, mayUploadPrivate, mayUploadPublic } from "./access.ts";
import { syncPublicMedia } from "./deliverability.ts";
import type { GeneratedVariant } from "./images.ts";
import { USAGE_STATUS_LABELS, type UsageStatus } from "./registry.ts";
import { lockAsset, mediaAudit, mediaLabel, rebuildMediaSearch, type MediaContext } from "./service.ts";

export interface NewFile {
  fileId: string;
  storageArea: "originals" | "private";
  storageKey: string;
  /** Display only (sanitized; never a path). */
  originalFilename: string;
  mimeType: string;
  extension: string;
  byteSize: number;
  sha256: Buffer;
  /** Images: as displayed (after the EXIF orientation). */
  width: number | null;
  height: number | null;
}

export type BeginResult =
  | { kind: "ok"; mediaId: string; fileId: string; version: number }
  | { kind: "not_found" }
  | { kind: "denied"; message: string }
  | { kind: "refused"; message: string };

const DENIED = { kind: "denied", message: "You don't have permission to upload this file." } as const;

/** A locking read of a certificate the private original is for: it exists, is not in the Trash and is not archived. */
async function certificateState(tx: Db, certificateId: string): Promise<"ok" | "missing" | "archived"> {
  const [row] = await rowsOf<{ archived: number }>(
    tx,
    sql`SELECT (publication_status = 'archived') AS archived FROM certificates WHERE id = ${certificateId} AND deleted_at IS NULL LOCK IN SHARE MODE`,
  );
  if (!row) return "missing";
  return Number(row.archived) ? "archived" : "ok";
}

/** Step 2 of a new item: the item (public: pending review; a private original: internal) and its first file row. */
export async function beginNewItem(
  ctx: MediaContext,
  input: { mediaId: string; kind: "image" | "document"; visibility: "public" | "private"; folderId: string | null; certificateId: string | null; file: NewFile },
): Promise<BeginResult> {
  const { deps, actor, meta } = ctx;
  const privateItem = input.visibility === "private";
  return contentTransaction(deps, actor, async (tx, now) => {
    const allowed = privateItem ? mayUploadPrivate(actor.permissions) : mayUploadPublic(actor.permissions);
    if (!allowed) {
      await mediaAudit(tx, actor, meta, now, {
        action: privateItem ? "media.private_upload" : "media.upload",
        id: input.mediaId,
        outcome: "denied",
        summary: privateItem ? "Refused: uploading a private original needs private_documents.upload (Owner)." : "Refused: uploading needs media.upload.",
      });
      return DENIED;
    }
    if (privateItem) {
      if (!input.certificateId) return { kind: "refused", message: "A private original belongs to a certificate." } as const;
      const state = await certificateState(tx, input.certificateId);
      if (state === "missing") return { kind: "not_found" } as const;
      if (state === "archived") return { kind: "refused", message: "This certificate is archived. Restore it before adding a document." } as const;
    }
    if (input.folderId) {
      const [folder] = await rowsOf<{ id: string }>(tx, sql`SELECT id FROM media_folders WHERE id = ${input.folderId} LOCK IN SHARE MODE`);
      if (!folder) return { kind: "refused", message: "That folder no longer exists. Choose another folder." } as const;
    }
    const status: UsageStatus = privateItem ? "internal" : "pending_review";
    await tx.insert(mediaAssets).values({
      id: input.mediaId,
      kind: input.kind,
      visibility: input.visibility,
      usageStatus: status,
      folderId: privateItem ? null : input.folderId,
      lockVersion: 0,
      createdAt: now,
      createdBy: actor.user.id,
      updatedAt: now,
      updatedBy: actor.user.id,
    });
    await tx.insert(mediaFiles).values({ ...input.file, id: input.file.fileId, mediaId: input.mediaId, version: 1, processingStatus: "processing", uploadedAt: now, uploadedBy: actor.user.id });
    return { kind: "ok", mediaId: input.mediaId, fileId: input.file.fileId, version: 1 } as const;
  });
}

/**
 * Step 2 of a replacement: a new version row of an existing item (the next number, under the item's lock). The kind and
 * the visibility never change (a replacement of an image is an image; of a private item, private), the item must not
 * be in the Trash, and identical bytes to the current version are refused (nothing to replace).
 */
export async function beginNewVersion(ctx: MediaContext, input: { mediaId: string; kind: "image" | "document"; file: Omit<NewFile, "storageArea"> & { storageArea: "originals" | "private" } }): Promise<BeginResult> {
  const { deps, actor, meta } = ctx;
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, input.mediaId);
    if (!asset) return { kind: "not_found" } as const;
    const decision = decideAccess(actor.permissions, "replace", asset.visibility);
    if (!decision.ok) {
      await mediaAudit(tx, actor, meta, now, {
        action: "media.replace",
        id: asset.id,
        outcome: "denied",
        summary: decision.hidden ? "Refused: the item is private." : `Refused: missing permission ${decision.missing.join(", ")}.`,
      });
      return decision.hidden ? ({ kind: "not_found" } as const) : DENIED;
    }
    if (asset.deletedAt) return { kind: "refused", message: "This item is in the Trash. Restore it before replacing its file." } as const;
    if (asset.kind !== input.kind) return { kind: "refused", message: `A replacement must be ${asset.kind === "image" ? "an image" : "a PDF document"}, like the current file.` } as const;
    const area = asset.visibility === "private" ? "private" : "originals";
    if (input.file.storageArea !== area) return { kind: "refused", message: "A replacement keeps the item's storage class." } as const;
    if (asset.currentFileId) {
      const [current] = await tx.select({ sha256: mediaFiles.sha256 }).from(mediaFiles).where(eq(mediaFiles.id, asset.currentFileId));
      if (current && Buffer.compare(current.sha256, input.file.sha256) === 0) {
        return { kind: "refused", message: "This file is identical to the current version: there is nothing to replace." } as const;
      }
    }
    const [last] = await rowsOf<{ max: number | null }>(tx, sql`SELECT MAX(version) AS max FROM media_files WHERE media_id = ${asset.id} FOR UPDATE`);
    const version = Number(last?.max ?? 0) + 1;
    if (version > 65_000) return { kind: "refused", message: "This item has too many versions." } as const;
    await tx.insert(mediaFiles).values({ ...input.file, id: input.file.fileId, mediaId: asset.id, version, processingStatus: "processing", uploadedAt: now, uploadedBy: actor.user.id });
    return { kind: "ok", mediaId: asset.id, fileId: input.file.fileId, version } as const;
  });
}

export type FinishResult = { kind: "ok"; current: boolean; version: number; status: UsageStatus } | { kind: "failed"; message: string };

/** Steps 6–9: the processed file becomes ready (and current, when it is the newest version), in one transaction. */
export async function finishUpload(
  ctx: MediaContext,
  input: {
    mediaId: string;
    fileId: string;
    purpose: "new" | "replace" | "private_original";
    certificateId: string | null;
    width: number | null;
    height: number | null;
    blurDataUrl: string | null;
    variants: readonly GeneratedVariant[];
  },
): Promise<FinishResult> {
  const { deps, actor, meta } = ctx;
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, input.mediaId);
    if (!asset) return { kind: "failed", message: "The item no longer exists." } as const;
    const [file] = await tx.select().from(mediaFiles).where(and(eq(mediaFiles.id, input.fileId), eq(mediaFiles.mediaId, asset.id)));
    if (!file || file.processingStatus !== "processing") return { kind: "failed", message: "This upload was already finished or failed." } as const;
    // The permission is decided again at the end (it can be taken away while a large file is processed).
    const allowed = input.purpose === "new" ? actor.permissions.has("media.upload") : decideAccess(actor.permissions, input.purpose === "private_original" ? "edit" : "replace", asset.visibility).ok;
    if (!allowed) return { kind: "failed", message: "Your permissions changed during the upload." } as const;
    if (input.variants.length) {
      await tx.insert(mediaVariants).values(
        input.variants.map((v) => ({
          id: ulid(now.getTime()),
          fileId: file.id,
          variantKey: v.variantKey,
          format: "webp" as const,
          width: v.width,
          height: v.height,
          byteSize: v.byteSize,
          storageKey: v.storageKey,
          sha256: v.sha256,
          createdAt: now,
        })),
      );
    }
    let currentVersion = 0;
    if (asset.currentFileId) {
      const [current] = await tx.select({ version: mediaFiles.version }).from(mediaFiles).where(eq(mediaFiles.id, asset.currentFileId));
      currentVersion = Number(current?.version ?? 0);
    }
    const becomesCurrent = !asset.currentFileId || file.version > currentVersion;
    await tx
      .update(mediaFiles)
      .set({ processingStatus: "ready", processingError: null, width: input.width, height: input.height, blurDataUrl: input.blurDataUrl, supersededAt: becomesCurrent ? null : now })
      .where(eq(mediaFiles.id, file.id));
    // A replacement returns an approved item to review (Owner decision 8: always, whoever replaces it); a pending item
    // stays pending; a restricted, archived or internal item keeps its status (a new file never lifts a restriction).
    const replacing = Boolean(asset.currentFileId) && becomesCurrent;
    const status: UsageStatus = replacing && asset.usageStatus === "approved" ? "pending_review" : (asset.usageStatus as UsageStatus);
    if (becomesCurrent) {
      if (asset.currentFileId) await tx.update(mediaFiles).set({ supersededAt: now }).where(eq(mediaFiles.id, asset.currentFileId));
      await tx
        .update(mediaAssets)
        .set({
          currentFileId: file.id,
          usageStatus: status,
          ...(status !== asset.usageStatus ? { approvedAt: null, approvedBy: null, approvalNote: null } : {}),
          lockVersion: sql`${mediaAssets.lockVersion} + 1`,
          updatedAt: now,
          updatedBy: actor.user.id,
        })
        .where(eq(mediaAssets.id, asset.id));
    }
    if (input.purpose === "private_original" && input.certificateId && file.version === 1) {
      const [last] = await rowsOf<{ max: number | null }>(
        tx,
        sql`SELECT MAX(position) AS max FROM certificate_documents WHERE certificate_id = ${input.certificateId} AND role = 'private_original' FOR UPDATE`,
      );
      await tx.insert(certificateDocuments).values({ certificateId: input.certificateId, mediaId: asset.id, role: "private_original", locale: null, position: Number(last?.max ?? 0) + 1 });
    }
    await syncPublicMedia(tx, asset.id, now);
    await rebuildMediaSearch(tx, asset.id, now);
    const label = await mediaLabel(tx, asset);
    const statusText = USAGE_STATUS_LABELS[status].toLowerCase();
    const summary =
      input.purpose === "private_original"
        ? `Uploaded a private original (never publishable) for a certificate: media “${label}”.`
        : input.purpose === "new"
          ? `Uploaded media “${label}” (${statusText}; not public until approved).`
          : becomesCurrent
            ? `Uploaded version ${file.version} of media “${label}”${replacing && asset.usageStatus === "approved" ? "; it returned to review (approval needed again)" : `; it is ${statusText}`}.`
            : `Uploaded version ${file.version} of media “${label}”; a newer version finished first, so it was kept as an older version.`;
    await mediaAudit(tx, actor, meta, now, {
      action: input.purpose === "private_original" ? "media.private_upload" : input.purpose === "new" ? "media.upload" : "media.replace",
      id: asset.id,
      label,
      summary,
      changes: { version: file.version, current: becomesCurrent, ...(status !== asset.usageStatus ? { before: { status: asset.usageStatus }, after: { status } } : {}) },
    });
    return { kind: "ok", current: becomesCurrent, version: file.version, status } as const;
  });
}

/** Records a failed processing: the file row `failed` with a safe reason (never a library's message or a path). */
export async function failUpload(ctx: MediaContext, input: { mediaId: string; fileId: string; purpose: "new" | "replace" | "private_original"; message: string }): Promise<void> {
  const { deps, actor, meta } = ctx;
  await contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, input.mediaId);
    if (!asset) return;
    await tx
      .update(mediaFiles)
      .set({ processingStatus: "failed", processingError: [...input.message].slice(0, 500).join("") })
      .where(and(eq(mediaFiles.id, input.fileId), eq(mediaFiles.mediaId, asset.id), eq(mediaFiles.processingStatus, "processing")));
    const label = await mediaLabel(tx, asset);
    await mediaAudit(tx, actor, meta, now, {
      action: input.purpose === "private_original" ? "media.private_upload" : input.purpose === "new" ? "media.upload" : "media.replace",
      id: asset.id,
      label,
      outcome: "failed",
      summary: `Processing failed for media “${label}”: ${input.message}`,
    });
  });
}
