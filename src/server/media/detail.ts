/**
 * One media item as its admin page shows it (A4 brief §38–§48): Overview, English, العربية, Rights & safety, Versions,
 * Used by, Storage/technical — and what the viewing session may do with it. A private item is null to anyone who may
 * not know private items exist (the page answers "not found"). Never a server path or storage key: files are named by
 * their version, size, type and hash only; addresses are the admin's preview and file routes.
 */
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { certificateDocuments, certificateTranslations } from "../db/schema-cms.ts";
import { mediaAssets, mediaFiles, mediaFlags, mediaTranslations, mediaVariants, publicMedia } from "../db/schema-media.ts";
import { users } from "../db/schema.ts";
import { isUlid } from "../security/ids.ts";
import { canSeePrivate, decideAccess, type MediaOperation } from "./access.ts";
import { deliverability } from "./deliverability.ts";
import { folderTree } from "./folders.ts";
import { isBlockingMediaFlag, isKnownMediaFlag, MEDIA_FLAGS, MEDIA_LIMITS, mediaFlagLabel, type UsageStatus } from "./registry.ts";
import { mediaFlagToken } from "./service.ts";
import { mediaUsage, type UsageGroup } from "./usage.ts";

export interface FlagDetail {
  flag: string;
  label: string;
  description: string | null;
  blocking: boolean;
  known: boolean;
  note: string | null;
  addedAt: Date;
  addedBy: string | null;
  token: string;
}

export interface VersionDetail {
  id: string;
  version: number;
  current: boolean;
  status: "uploaded" | "processing" | "ready" | "failed";
  error: string | null;
  area: "release" | "originals" | "private";
  filename: string;
  mime: string;
  byteSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
  variants: { key: string; width: number; height: number; byteSize: number }[];
  uploadedAt: Date;
  uploadedBy: string | null;
  supersededAt: Date | null;
  /** Older than 30 days since it stopped being current: may be purged later (never automatically in A4). */
  purgeEligible: boolean;
}

export interface MediaDetail {
  id: string;
  legacyKey: string | null;
  kind: "image" | "svg" | "document";
  visibility: "public" | "private";
  status: UsageStatus;
  lockVersion: number;
  deleted: boolean;
  deletedAt: Date | null;
  folderId: string | null;
  folderPath: string | null;
  focal: { x: number; y: number } | null;
  rightsHolder: string | null;
  rightsNote: string | null;
  licenceExpiresOn: string | null;
  sourceNote: string | null;
  approval: { at: Date; by: string | null; note: string | null } | null;
  restriction: { at: Date | null; by: string | null; reason: string | null } | null;
  translations: Record<"en" | "ar", { title: string | null; alt: string | null; caption: string | null }>;
  flags: FlagDetail[];
  versions: VersionDetail[];
  current: VersionDetail | null;
  deliverable: boolean;
  reasons: string[];
  publicSrc: string | null;
  publicVariants: { width: number; url: string }[];
  usage: UsageGroup[];
  certificates: { id: string; title: string; role: "public_preview" | "private_original"; locale: string | null }[];
  created: { at: Date; by: string | null };
  updated: { at: Date; by: string | null };
  /** What the viewer may do (each decided again by the services when sent). */
  can: Record<MediaOperation, boolean>;
}

const OPERATIONS: MediaOperation[] = ["view", "edit", "flag", "clear_flag", "approve", "restrict", "unrestrict", "archive", "unarchive", "trash", "untrash", "restore_version", "replace", "view_original"];

export async function loadMediaDetail(db: Db, permissions: ReadonlySet<string>, id: string, now: Date): Promise<MediaDetail | null> {
  if (!isUlid(id)) return null;
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
  if (!asset) return null;
  if (asset.visibility === "private" && !canSeePrivate(permissions)) return null;
  const names = new Map<string, string>();
  const want = new Set<string>();
  const remember = (v: string | null | undefined) => {
    if (v) want.add(v);
  };
  [asset.approvedBy, asset.restrictedBy, asset.createdBy, asset.updatedBy].forEach(remember);
  const tr = await db.select().from(mediaTranslations).where(eq(mediaTranslations.mediaId, id));
  const flagRows = await db.select().from(mediaFlags).where(eq(mediaFlags.mediaId, id)).orderBy(asc(mediaFlags.createdAt), asc(mediaFlags.flag));
  flagRows.forEach((f) => remember(f.createdBy));
  const files = await db.select().from(mediaFiles).where(eq(mediaFiles.mediaId, id)).orderBy(desc(mediaFiles.version));
  files.forEach((f) => remember(f.uploadedBy));
  const variants = files.length ? await db.select().from(mediaVariants).where(inArray(mediaVariants.fileId, files.map((f) => f.id))).orderBy(asc(mediaVariants.width)) : [];
  if (want.size) {
    for (const row of await db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, [...want]))) names.set(row.id, row.name);
  }
  const nameOf = (v: string | null | undefined) => (v ? (names.get(v) ?? null) : null);
  const versions: VersionDetail[] = files.map((f) => ({
    id: f.id,
    version: f.version,
    current: f.id === asset.currentFileId,
    status: f.processingStatus,
    error: f.processingError,
    area: f.storageArea,
    filename: f.originalFilename,
    mime: f.mimeType,
    byteSize: Number(f.byteSize),
    sha256: f.sha256.toString("hex"),
    width: f.width,
    height: f.height,
    variants: variants.filter((v) => v.fileId === f.id).map((v) => ({ key: v.variantKey, width: v.width, height: v.height, byteSize: Number(v.byteSize) })),
    uploadedAt: f.uploadedAt,
    uploadedBy: nameOf(f.uploadedBy),
    supersededAt: f.supersededAt,
    purgeEligible: f.id !== asset.currentFileId && Boolean(f.supersededAt) && f.supersededAt!.getTime() <= now.getTime() - MEDIA_LIMITS.versionRetentionMs,
  }));
  const current = versions.find((v) => v.current) ?? null;
  const verdict = deliverability({
    visibility: asset.visibility,
    usageStatus: asset.usageStatus,
    deleted: Boolean(asset.deletedAt),
    flags: flagRows.map((f) => f.flag),
    kind: asset.kind,
    current: current ? { processingStatus: current.status, storageArea: current.area } : null,
    widthVariants: current ? current.variants.filter((v) => v.key !== "thumb").length : 0,
  });
  const [pub] = await db.select().from(publicMedia).where(eq(publicMedia.mediaId, id));
  const folders = asset.folderId ? await folderTree(db) : [];
  const docs = await db
    .select({ certificateId: certificateDocuments.certificateId, role: certificateDocuments.role, locale: certificateDocuments.locale })
    .from(certificateDocuments)
    .where(eq(certificateDocuments.mediaId, id));
  const certificates = [];
  for (const doc of docs) {
    const titles = await db.select({ locale: certificateTranslations.locale, title: certificateTranslations.title }).from(certificateTranslations).where(eq(certificateTranslations.certificateId, doc.certificateId));
    certificates.push({ id: doc.certificateId, title: titles.find((t) => t.locale === "en")?.title || titles.find((t) => t.locale === "ar")?.title || "(untitled certificate)", role: doc.role, locale: doc.locale });
  }
  const byLocale = (locale: "en" | "ar") => {
    const row = tr.find((t) => t.locale === locale);
    return { title: row?.title ?? null, alt: row?.altText ?? null, caption: row?.caption ?? null };
  };
  return {
    id,
    legacyKey: asset.legacyKey,
    kind: asset.kind,
    visibility: asset.visibility,
    status: asset.usageStatus,
    lockVersion: asset.lockVersion,
    deleted: Boolean(asset.deletedAt),
    deletedAt: asset.deletedAt,
    folderId: asset.folderId,
    folderPath: folders.find((f) => f.id === asset.folderId)?.path ?? null,
    focal: asset.focalX !== null && asset.focalY !== null ? { x: Number(asset.focalX), y: Number(asset.focalY) } : null,
    rightsHolder: asset.rightsHolder,
    rightsNote: asset.rightsNote,
    licenceExpiresOn: asset.licenceExpiresOn,
    sourceNote: asset.sourceNote,
    approval: asset.usageStatus === "approved" && asset.approvedAt ? { at: asset.approvedAt, by: nameOf(asset.approvedBy), note: asset.approvalNote } : null,
    restriction: asset.usageStatus === "restricted" ? { at: asset.restrictedAt, by: nameOf(asset.restrictedBy), reason: asset.restrictionReason } : null,
    translations: { en: byLocale("en"), ar: byLocale("ar") },
    flags: flagRows.map((f) => ({
      flag: f.flag,
      label: mediaFlagLabel(f.flag),
      description: isKnownMediaFlag(f.flag) ? MEDIA_FLAGS[f.flag].description : null,
      blocking: isBlockingMediaFlag(f.flag),
      known: isKnownMediaFlag(f.flag),
      note: f.note,
      addedAt: f.createdAt,
      addedBy: nameOf(f.createdBy),
      token: mediaFlagToken(f.createdAt),
    })),
    versions,
    current,
    deliverable: verdict.deliverable,
    reasons: verdict.reasons,
    publicSrc: pub?.src ?? null,
    publicVariants: Array.isArray(pub?.variants) ? (pub.variants as { width: number; url: string }[]) : [],
    usage: await mediaUsage(db, id),
    certificates,
    created: { at: asset.createdAt, by: nameOf(asset.createdBy) },
    updated: { at: asset.updatedAt, by: nameOf(asset.updatedBy) },
    can: Object.fromEntries(OPERATIONS.map((op) => [op, decideAccess(permissions, op, asset.visibility).ok])) as Record<MediaOperation, boolean>,
  };
}

/** Old versions past the 30-day retention (A4 brief §60: reported as purge candidates; nothing is deleted in A4). */
export async function purgeCandidates(db: Db, now: Date) {
  const before = new Date(now.getTime() - MEDIA_LIMITS.versionRetentionMs);
  return db
    .select({ id: mediaFiles.id, mediaId: mediaFiles.mediaId, version: mediaFiles.version, byteSize: mediaFiles.byteSize, supersededAt: mediaFiles.supersededAt })
    .from(mediaFiles)
    .innerJoin(mediaAssets, eq(mediaAssets.id, mediaFiles.mediaId))
    .where(and(lt(mediaFiles.supersededAt, before), sql`${mediaFiles.id} <> COALESCE(${mediaAssets.currentFileId}, '')`));
}

/** A folder's choices for a select (the tree, indented). */
export async function folderOptions(db: Db) {
  return (await folderTree(db)).map((f) => ({ id: f.id, label: `${"— ".repeat(f.depth)}${f.name}`, path: f.path }));
}
