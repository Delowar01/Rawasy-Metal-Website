/**
 * The one deliverability rule (A1-MEDIA-STORAGE §4; A4 brief §18) and the materialized `public_media` row it governs.
 *
 * An item is publicly deliverable only when ALL hold: public visibility, usage status `approved`, no blocking flag (an
 * unknown flag blocks), not in the Trash, a current file that exists and is `ready`, and its delivery storage: release
 * files are served by the release itself; an uploaded image needs its width variants; a PDF is its own file.
 *
 * `syncPublicMedia` is called at the end of every transaction that changes one of those inputs — approval, restriction,
 * flags, Trash, the current file, the alt texts — with the item's row already locked: it writes the `public_media` row
 * when the item is deliverable and deletes it otherwise, so `public_media` never disagrees with the item. Nothing else
 * writes `public_media`; the admin has no way to edit it.
 */
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { mediaAssets, mediaFiles, mediaFlags, mediaTranslations, mediaVariants, publicMedia } from "../db/schema-media.ts";
import { isBlockingMediaFlag, mediaFlagLabel, USAGE_STATUS_LABELS, type MediaKind, type UsageStatus, type Visibility } from "./registry.ts";

export interface DeliverabilityInput {
  visibility: Visibility;
  usageStatus: UsageStatus;
  deleted: boolean;
  flags: readonly string[];
  kind: MediaKind;
  /** The current file, or null when none is set (a new upload still processing, or one that failed). */
  current: { processingStatus: string; storageArea: string } | null;
  /** Width variants of the current file (excluding the admin thumbnail). */
  widthVariants: number;
}

/** Whether an item may be delivered publicly, and every reason it may not (in words for the admin). */
export function deliverability(input: DeliverabilityInput): { deliverable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.visibility !== "public") reasons.push("It is private: private items are never public.");
  if (input.usageStatus !== "approved") reasons.push(`Its status is ${USAGE_STATUS_LABELS[input.usageStatus] ?? input.usageStatus}, not Approved.`);
  const blocking = input.flags.filter(isBlockingMediaFlag);
  if (blocking.length) reasons.push(`Blocking flag${blocking.length === 1 ? "" : "s"}: ${blocking.map(mediaFlagLabel).join(", ")}.`);
  if (input.deleted) reasons.push("It is in the Trash.");
  if (!input.current) reasons.push("It has no current file.");
  else if (input.current.processingStatus !== "ready") reasons.push(`Its current file is not ready (${input.current.processingStatus}).`);
  else if (input.kind === "image" && input.current.storageArea === "originals" && input.widthVariants === 0) reasons.push("Its current file has no delivery variants.");
  else if (input.kind === "svg") reasons.push("SVG files are not delivered (A4).");
  return { deliverable: reasons.length === 0, reasons };
}

/** The address of an uploaded document's public download (its name carries the file's hash). */
export const documentPublicName = (sha256Hex: string, extension: string) => `document-${sha256Hex.slice(0, 8)}.${extension}`;
export const publicUrl = (mediaId: string, name: string) => `/media/u/${mediaId}/${name}`;

/** The variant's public name: the derived key without the media folder (`w1080-3f9a1c2b.webp`). */
export const variantName = (storageKey: string) => storageKey.slice(storageKey.indexOf("/") + 1);

export interface SyncResult {
  deliverable: boolean;
  /** Whether the row was written or deleted by this call (false when it already matched). */
  changed: boolean;
}

/**
 * Rebuilds (or removes) an item's `public_media` row from its current state. The caller holds the item's row lock
 * (FOR UPDATE) in the same transaction; every reader of the inputs below writes them only under that lock.
 */
export async function syncPublicMedia(tx: Db, mediaId: string, now: Date): Promise<SyncResult> {
  const [asset] = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, mediaId));
  const [existing] = await tx.select({ fileId: publicMedia.fileId, src: publicMedia.src }).from(publicMedia).where(eq(publicMedia.mediaId, mediaId));
  if (!asset) return { deliverable: false, changed: false };
  const flags = (await tx.select({ flag: mediaFlags.flag }).from(mediaFlags).where(eq(mediaFlags.mediaId, mediaId))).map((r) => r.flag);
  const [file] = asset.currentFileId ? await tx.select().from(mediaFiles).where(and(eq(mediaFiles.id, asset.currentFileId), eq(mediaFiles.mediaId, mediaId))) : [];
  const variants = file ? await tx.select().from(mediaVariants).where(eq(mediaVariants.fileId, file.id)).orderBy(asc(mediaVariants.width)) : [];
  const widthVariants = variants.filter((v) => v.variantKey !== "thumb");
  const verdict = deliverability({
    visibility: asset.visibility,
    usageStatus: asset.usageStatus,
    deleted: Boolean(asset.deletedAt),
    flags,
    kind: asset.kind,
    current: file ? { processingStatus: file.processingStatus, storageArea: file.storageArea } : null,
    widthVariants: widthVariants.length,
  });
  if (!verdict.deliverable || !file) {
    if (!existing) return { deliverable: false, changed: false };
    await tx.delete(publicMedia).where(eq(publicMedia.mediaId, mediaId));
    return { deliverable: false, changed: true };
  }
  const translations = await tx.select({ locale: mediaTranslations.locale, altText: mediaTranslations.altText }).from(mediaTranslations).where(eq(mediaTranslations.mediaId, mediaId));
  const defaultAlt = Object.fromEntries(translations.filter((t) => t.altText !== null).map((t) => [t.locale, t.altText]));
  let src: string;
  let width = file.width;
  let height = file.height;
  let list: { width: number; url: string }[] | null = null;
  if (file.storageArea === "release") {
    src = file.storageKey;
  } else if (asset.kind === "document") {
    src = publicUrl(mediaId, documentPublicName(file.sha256.toString("hex"), file.extension));
  } else {
    list = widthVariants.map((v) => ({ width: v.width, url: publicUrl(mediaId, variantName(v.storageKey)) }));
    const largest = widthVariants[widthVariants.length - 1];
    src = list[list.length - 1].url;
    width = largest.width;
    height = largest.height;
  }
  const row = {
    fileId: file.id,
    legacyKey: asset.legacyKey,
    kind: asset.kind,
    src,
    width,
    height,
    blurDataUrl: file.blurDataUrl,
    variants: list,
    defaultAlt: Object.keys(defaultAlt).length ? defaultAlt : null,
    updatedAt: now,
  };
  await tx.insert(publicMedia).values({ mediaId, ...row }).onDuplicateKeyUpdate({ set: row });
  return { deliverable: true, changed: !existing || existing.fileId !== file.id || existing.src !== src };
}
