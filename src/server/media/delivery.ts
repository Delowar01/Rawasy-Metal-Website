/**
 * Where a requested media address leads (A4 brief §44–§48; A1-MEDIA-STORAGE §8–§9), decided from the database only —
 * framework-free, so the Route Handlers stay thin and the tests can call it directly.
 *
 * - Public: `/media/u/{media-ulid}/{name}`, where `name` is a width variant (`w1080-3f9a1c2b.webp`) or a document
 *   (`document-3f9a1c2b.pdf`) — a strict grammar; only through `public_media` (the item deliverable now), only the
 *   current version's variants (never the admin thumbnail, never an image original), a document's own file.
 * - Admin preview: the thumbnail or a mid-size variant of a public-class image (or a release file), never of a private
 *   item (private items have no derivatives).
 * - Files: a version's original (public class: `media.view_original`; private: the Owner with a step-up — the route
 *   checks the step-up).
 */
import { and, eq, ne } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { mediaAssets, mediaFiles, mediaVariants, publicMedia } from "../db/schema-media.ts";
import { isUlid } from "../security/ids.ts";
import { documentPublicName } from "./deliverability.ts";

/** A file the route will stream: where it is, what it is, and its validators. */
export interface DeliveryTarget {
  area: "derived" | "originals" | "private" | "release";
  key: string;
  mime: string;
  byteSize: number;
  sha256Hex: string;
  /** The name offered on download (documents) or null (images, inline). */
  downloadName: string | null;
}

const WIDTH_NAME = /^w[0-9]{2,4}-[0-9a-f]{8}\.webp$/;
const DOCUMENT_NAME = /^document-[0-9a-f]{8}\.pdf$/;

/** Whether a public address follows the grammar (anything else is answered 404 without a database read). */
export function publicAddressValid(id: string, name: string): boolean {
  return isUlid(id) && name.length <= 40 && (WIDTH_NAME.test(name) || DOCUMENT_NAME.test(name));
}

/** The public file at `/media/u/{id}/{name}`, or null (not deliverable, not current, not this name). */
export async function resolvePublic(db: Db, id: string, name: string): Promise<DeliveryTarget | null> {
  if (!publicAddressValid(id, name)) return null;
  const [row] = await db.select({ fileId: publicMedia.fileId, kind: publicMedia.kind }).from(publicMedia).where(eq(publicMedia.mediaId, id));
  if (!row) return null;
  if (DOCUMENT_NAME.test(name)) {
    if (row.kind !== "document") return null;
    const [file] = await db.select().from(mediaFiles).where(and(eq(mediaFiles.id, row.fileId), eq(mediaFiles.mediaId, id)));
    if (!file || file.storageArea !== "originals" || file.processingStatus !== "ready") return null;
    const hex = file.sha256.toString("hex");
    if (documentPublicName(hex, file.extension) !== name) return null;
    return { area: "originals", key: file.storageKey, mime: file.mimeType, byteSize: Number(file.byteSize), sha256Hex: hex, downloadName: name };
  }
  if (row.kind !== "image") return null;
  const [variant] = await db
    .select()
    .from(mediaVariants)
    .where(and(eq(mediaVariants.fileId, row.fileId), eq(mediaVariants.storageKey, `${id}/${name}`), ne(mediaVariants.variantKey, "thumb")));
  if (!variant) return null;
  return { area: "derived", key: variant.storageKey, mime: "image/webp", byteSize: Number(variant.byteSize), sha256Hex: variant.sha256.toString("hex"), downloadName: null };
}

export type PreviewSize = "thumb" | "large";

/**
 * An admin preview of a public-class item's version (the current one unless `fileId` names another of its versions):
 * the thumbnail, or the largest variant up to 1080 px; release files are served as they are. Null for private items,
 * documents, failed or unknown versions.
 */
export async function resolvePreview(db: Db, id: string, size: PreviewSize, fileId: string | null): Promise<DeliveryTarget | null> {
  if (!isUlid(id) || (fileId !== null && !isUlid(fileId))) return null;
  const [asset] = await db.select({ visibility: mediaAssets.visibility, kind: mediaAssets.kind, currentFileId: mediaAssets.currentFileId }).from(mediaAssets).where(eq(mediaAssets.id, id));
  if (!asset || asset.visibility !== "public" || asset.kind !== "image") return null;
  const target = fileId ?? asset.currentFileId;
  if (!target) return null;
  const [file] = await db.select().from(mediaFiles).where(and(eq(mediaFiles.id, target), eq(mediaFiles.mediaId, id)));
  if (!file || file.processingStatus !== "ready") return null;
  if (file.storageArea === "release") {
    return { area: "release", key: file.storageKey, mime: file.mimeType, byteSize: Number(file.byteSize), sha256Hex: file.sha256.toString("hex"), downloadName: null };
  }
  if (file.storageArea !== "originals") return null;
  const variants = await db.select().from(mediaVariants).where(eq(mediaVariants.fileId, file.id));
  const chosen =
    size === "thumb"
      ? variants.find((v) => v.variantKey === "thumb")
      : variants
          .filter((v) => v.variantKey !== "thumb" && v.width <= 1080)
          .sort((a, b) => b.width - a.width)[0] ?? variants.filter((v) => v.variantKey !== "thumb").sort((a, b) => a.width - b.width)[0];
  if (!chosen) return null;
  return { area: "derived", key: chosen.storageKey, mime: "image/webp", byteSize: Number(chosen.byteSize), sha256Hex: chosen.sha256.toString("hex"), downloadName: null };
}

export interface FileTarget extends DeliveryTarget {
  visibility: "public" | "private";
  version: number;
  originalFilename: string;
}

/** A version's original file (the current one unless `fileId` names another); the caller decides who may have it. */
export async function resolveOriginal(db: Db, id: string, fileId: string | null): Promise<{ asset: { visibility: "public" | "private"; deleted: boolean }; file: FileTarget | null } | null> {
  if (!isUlid(id) || (fileId !== null && !isUlid(fileId))) return null;
  const [asset] = await db
    .select({ visibility: mediaAssets.visibility, currentFileId: mediaAssets.currentFileId, deletedAt: mediaAssets.deletedAt })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id));
  if (!asset) return null;
  const target = fileId ?? asset.currentFileId;
  if (!target) return { asset: { visibility: asset.visibility, deleted: Boolean(asset.deletedAt) }, file: null };
  const [file] = await db.select().from(mediaFiles).where(and(eq(mediaFiles.id, target), eq(mediaFiles.mediaId, id)));
  if (!file || file.processingStatus !== "ready") return { asset: { visibility: asset.visibility, deleted: Boolean(asset.deletedAt) }, file: null };
  // A private item's bytes are read only from the private root (A1 §9); a public-class item's never from it.
  const expected = asset.visibility === "private" ? ["private"] : ["originals", "release"];
  if (!expected.includes(file.storageArea)) return { asset: { visibility: asset.visibility, deleted: Boolean(asset.deletedAt) }, file: null };
  return {
    asset: { visibility: asset.visibility, deleted: Boolean(asset.deletedAt) },
    file: {
      area: file.storageArea,
      key: file.storageKey,
      mime: file.mimeType,
      byteSize: Number(file.byteSize),
      sha256Hex: file.sha256.toString("hex"),
      downloadName: file.originalFilename,
      visibility: asset.visibility,
      version: file.version,
      originalFilename: file.originalFilename,
    },
  };
}
