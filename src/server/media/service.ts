/**
 * The media library's changes (A4 brief §15–§20, §33–§34, §40–§43, §58, §66–§67; A1-MEDIA-STORAGE §4, §11): metadata,
 * flags, approval, restriction, archive, the Trash and version restores. Each runs in ONE transaction that
 *
 * 1. locks the acting user and session (`contentTransaction`: still active, still live — A2's invariant),
 * 2. locks the item's `media_assets` row FOR UPDATE and decides on that latest state (never on the page's word),
 * 3. checks the permission from the session (`access.ts`) — a private item is "not found" to anyone who may not know
 *    private items exist,
 * 4. writes, then rebuilds or removes the item's `public_media` row (`syncPublicMedia`) before it commits, and
 * 5. records the outcome in the audit log (refusals too).
 *
 * Direction decides concurrency (§66): a change that makes an item SAFER — a flag, a restriction, archiving, the Trash —
 * never needs the version the page showed (a stale form must not hold back a safety change); a change that makes it
 * LESS safe — approving, clearing a flag, lifting a restriction, restoring from archive or the Trash, restoring a
 * version — is decided on the version the page showed (`lock_version`, moved by every status, metadata or file change;
 * flags have their own instance token). Every flag the item holds is re-read under the lock before an approval.
 *
 * Nothing here publishes anything: the public website does not read these tables before A9 (T1 = Option B).
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { recordAudit, type AuditOutcome } from "../audit/audit.ts";
import { auditActorOf, type Actor, type RequestMeta } from "../auth/types.ts";
import type { Db } from "../db/client.ts";
import { searchDocuments } from "../db/schema-cms.ts";
import { mediaAssets, mediaFiles, mediaFlags, mediaTranslations, mediaVariants } from "../db/schema-media.ts";
import { users } from "../db/schema.ts";
import { contentTransaction, rowsOf, type CmsDeps } from "../cms/store.ts";
import { charLength, normalizeForSearch, normalizeNewlines, plainText, textProblem, TEXT_PROBLEM_MESSAGES } from "../cms/text.ts";
import { isUlid } from "../security/ids.ts";
import { decideAccess, type MediaOperation } from "./access.ts";
import { deliverability, syncPublicMedia } from "./deliverability.ts";
import { missingDeliveryFiles } from "./presence.ts";
import { isBlockingMediaFlag, isKnownMediaFlag, MEDIA_LIMITS, mediaFlagLabel, USAGE_STATUS_LABELS, type MediaFlagKey, type UsageStatus } from "./registry.ts";
import type { MediaStore } from "./storage.ts";

// --- Context and results -------------------------------------------------------------------------------------------------

export interface MediaDeps extends CmsDeps {
  /** The persistent store (RAWASY_DATA_DIR), opened on first use; null when it is not configured. */
  store: () => Promise<MediaStore | null>;
  /** The release's `public/` folder (release files are checked there). */
  releaseDir: string;
}

export interface MediaContext {
  deps: MediaDeps;
  actor: Actor;
  meta: RequestMeta;
}

export type MediaResult =
  | { kind: "ok"; summary: string; lockVersion?: number }
  | { kind: "unchanged"; message: string }
  | { kind: "invalid"; message: string; errors?: Record<string, string> }
  | { kind: "stale"; message: string }
  | { kind: "refused"; message: string }
  | { kind: "denied"; message: string }
  | { kind: "not_found" };

export const MEDIA_STALE_MESSAGE = "This media item changed after you opened it. Reload and review the latest version first.";
const DENIED_MESSAGE = "You don't have permission to do this.";

export type AssetRow = typeof mediaAssets.$inferSelect;
type FileRow = typeof mediaFiles.$inferSelect;

/** Locks a media item's row (FOR UPDATE), in the Trash or not; null when it does not exist. */
export async function lockAsset(tx: Db, id: string): Promise<AssetRow | null> {
  const [row] = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, id)).for("update");
  return row ?? null;
}

export interface MediaEvent {
  action: string;
  id: string;
  label?: string | null;
  outcome?: AuditOutcome;
  summary: string;
  changes?: Record<string, unknown>;
}

/** A media audit event: who, what, which item — never a file's bytes, path or storage key. */
export async function mediaAudit(db: Db, actor: Actor, meta: RequestMeta, at: Date, event: MediaEvent): Promise<void> {
  await recordAudit(db, {
    at,
    requestId: meta.requestId,
    actor: auditActorOf(actor),
    ip: meta.ip,
    action: event.action,
    entity: { type: "media", id: event.id, label: event.label ? [...event.label].slice(0, 120).join("") : null },
    outcome: event.outcome ?? "success",
    summary: event.summary,
    changes: event.changes,
  });
}

/** A short name for summaries: the English or Arabic title, else the legacy key, else the file name, else the id. */
export async function mediaLabel(db: Db, asset: Pick<AssetRow, "id" | "legacyKey" | "currentFileId" | "visibility">): Promise<string> {
  const titles = await db.select({ locale: mediaTranslations.locale, title: mediaTranslations.title }).from(mediaTranslations).where(eq(mediaTranslations.mediaId, asset.id));
  const title = titles.find((t) => t.locale === "en")?.title || titles.find((t) => t.locale === "ar")?.title;
  if (title) return title;
  if (asset.legacyKey) return asset.legacyKey;
  if (asset.visibility === "private") return "private document";
  if (asset.currentFileId) {
    const [file] = await db.select({ name: mediaFiles.originalFilename }).from(mediaFiles).where(eq(mediaFiles.id, asset.currentFileId));
    if (file?.name) return file.name;
  }
  return asset.id;
}

const quoted = (label: string) => `“${[...label].length > 80 ? `${[...label].slice(0, 79).join("")}…` : label}”`;

/**
 * Checks the operation against the session's permissions on the locked item; records refusals. Returns null when
 * allowed, otherwise the result to answer with (`not_found` for an item the person may not know exists).
 */
async function refuseUnlessAllowed(tx: Db, ctx: MediaContext, now: Date, asset: AssetRow, operation: MediaOperation, action: string): Promise<MediaResult | null> {
  const decision = decideAccess(ctx.actor.permissions, operation, asset.visibility);
  if (decision.ok) return null;
  await mediaAudit(tx, ctx.actor, ctx.meta, now, {
    action,
    id: asset.id,
    outcome: "denied",
    summary: decision.hidden
      ? "Refused: the item is private (only a holder of private_documents.view may know it exists)."
      : decision.missing.length
        ? `Refused: missing permission ${decision.missing.join(", ")}.`
        : "Refused: this can never be done to a private item.",
  });
  if (decision.hidden) return { kind: "not_found" };
  return decision.missing.length ? { kind: "denied", message: DENIED_MESSAGE } : { kind: "refused", message: "Private items can never be approved or published." };
}

/** A note or reason: plain text (one or more lines), trimmed, `min`..`max` characters. Null when acceptable. */
function noteProblem(note: string, min: number, max: number): string | null {
  if (charLength(note) < min) return min > 1 ? `Write at least ${min} characters.` : "Write a note.";
  if (charLength(note) > max) return `Use at most ${max} characters.`;
  const problem = textProblem(note, { multiline: true });
  return problem ? TEXT_PROBLEM_MESSAGES[problem] : null;
}

const cleanNote = (raw: unknown) => normalizeNewlines(typeof raw === "string" ? raw : "").trim();

// --- Reads under the lock ------------------------------------------------------------------------------------------------

async function flagsOf(db: Db, mediaId: string) {
  return db.select().from(mediaFlags).where(eq(mediaFlags.mediaId, mediaId)).orderBy(asc(mediaFlags.createdAt), asc(mediaFlags.flag));
}

async function translationsOf(db: Db, mediaId: string) {
  const rows = await db.select().from(mediaTranslations).where(eq(mediaTranslations.mediaId, mediaId));
  return { en: rows.find((r) => r.locale === "en") ?? null, ar: rows.find((r) => r.locale === "ar") ?? null };
}

async function fileOf(db: Db, mediaId: string, fileId: string | null): Promise<FileRow | null> {
  if (!fileId) return null;
  const [row] = await db.select().from(mediaFiles).where(and(eq(mediaFiles.id, fileId), eq(mediaFiles.mediaId, mediaId)));
  return row ?? null;
}

async function variantsOf(db: Db, fileId: string) {
  return db.select().from(mediaVariants).where(eq(mediaVariants.fileId, fileId)).orderBy(asc(mediaVariants.width));
}

/** What keeps a version from being delivered on disk (empty when its files are in place). */
async function missingFilesOf(ctx: MediaContext, asset: AssetRow, file: FileRow): Promise<string[]> {
  const store = await ctx.deps.store().catch(() => null);
  const variants = file.storageArea === "originals" ? await variantsOf(ctx.deps.db, file.id) : [];
  return missingDeliveryFiles(store, ctx.deps.releaseDir, { storageArea: file.storageArea, storageKey: file.storageKey, byteSize: Number(file.byteSize), kind: asset.kind }, variants);
}

// --- Search rows (A1 `search_documents`, working scope; entity type "media") -------------------------------------------

/**
 * Rewrites an item's admin search rows: per language, its title, and as the body its alt text, caption, the current
 * file's name and the legacy key — normalized like A3's (Arabic forms unified). Visibility is not stored here: every
 * search query filters private items itself (`list.ts`).
 */
export async function rebuildMediaSearch(tx: Db, mediaId: string, now: Date): Promise<void> {
  const [asset] = await tx.select({ legacyKey: mediaAssets.legacyKey, currentFileId: mediaAssets.currentFileId }).from(mediaAssets).where(eq(mediaAssets.id, mediaId));
  if (!asset) return;
  const tr = await translationsOf(tx, mediaId);
  const file = await fileOf(tx, mediaId, asset.currentFileId);
  await tx.delete(searchDocuments).where(and(eq(searchDocuments.entityType, "media"), eq(searchDocuments.entityId, mediaId), eq(searchDocuments.scope, "working")));
  const rows = (["en", "ar"] as const).map((locale) => {
    const t = tr[locale];
    const body = [t?.altText ?? "", t?.caption ?? "", file?.originalFilename ?? "", asset.legacyKey ?? ""].join(" ");
    return {
      entityType: "media",
      entityId: mediaId,
      locale,
      scope: "working" as const,
      title: [...normalizeForSearch(t?.title ?? "")].slice(0, 255).join(""),
      body: [...normalizeForSearch(body)].slice(0, 20_000).join(""),
      updatedAt: now,
    };
  });
  await tx.insert(searchDocuments).values(rows);
}

// --- Metadata (A4 brief §38–§40) -------------------------------------------------------------------------------------------

const ULID = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const emptyAsUndefined = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : v);
const text = (max: number, multiline = false) => z.preprocess((v) => (v === undefined || v === null ? "" : v), plainText(max, { multiline }));

const ALT_MODES = ["text", "decorative", "undecided"] as const;
export type AltMode = (typeof ALT_MODES)[number];

const localeShape = z.object({
  title: text(MEDIA_LIMITS.titleMax),
  altMode: z.preprocess((v) => (v === undefined || v === "" ? "undecided" : v), z.enum(ALT_MODES)),
  alt: text(MEDIA_LIMITS.altMax),
  caption: text(MEDIA_LIMITS.captionMax),
});

const focal = z.preprocess(emptyAsUndefined, z.coerce.number().min(0, "Use a value from 0 to 1.").max(1, "Use a value from 0 to 1.").optional());

const isRealDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "2000-01-01" && value <= "2100-12-31";
};

/** The metadata form: exactly these fields (no mass assignment; status, visibility, files and approvals are not here). */
export const metadataSchema = z.object({
  lockVersion: z.coerce.number().int().min(0).max(2_147_483_647),
  en: z.preprocess((v) => v ?? {}, localeShape),
  ar: z.preprocess((v) => v ?? {}, localeShape),
  folderId: z.preprocess(emptyAsUndefined, ULID.optional()),
  focalX: focal,
  focalY: focal,
  rightsHolder: text(MEDIA_LIMITS.rightsHolderMax),
  rightsNote: text(MEDIA_LIMITS.rightsNoteMax, true),
  sourceNote: text(MEDIA_LIMITS.sourceNoteMax, true),
  licenceExpiresOn: z.preprocess(emptyAsUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date (YYYY-MM-DD).").refine(isRealDate, "Use a real date between 2000 and 2100.").optional()),
});

export type MetadataInput = z.infer<typeof metadataSchema>;

/** The alt text to store for a language: text → the text, decorative → '', undecided → NULL (A4 brief §40). */
export function altValue(mode: AltMode, alt: string): string | null {
  if (mode === "decorative") return "";
  if (mode === "text") return alt;
  return null;
}

/** A focal point rounded to the column's three decimals (both coordinates or neither). */
const roundFocal = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * 1000) / 1000);

export async function updateMediaMetadata(ctx: MediaContext, id: string, form: Record<string, unknown>): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id)) return { kind: "not_found" };
  const parsed = metadataSchema.safeParse(form);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.filter((p) => typeof p === "string" || typeof p === "number").join(".") || "form"] ??= issue.message;
    return { kind: "invalid", message: "Check the highlighted fields.", errors };
  }
  const input = parsed.data;
  const errors: Record<string, string> = {};
  for (const locale of ["en", "ar"] as const) {
    if (input[locale].altMode === "text" && !input[locale].alt) errors[`${locale}.alt`] = "Write the alt text, or mark the image decorative.";
  }
  const fx = roundFocal(input.focalX);
  const fy = roundFocal(input.focalY);
  if ((fx === undefined) !== (fy === undefined)) errors.focalX = "Set both coordinates of the focal point, or neither.";
  if (Object.keys(errors).length) return { kind: "invalid", message: "Check the highlighted fields.", errors };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, "edit", "media.update");
    if (refused) return refused;
    const label = await mediaLabel(tx, asset);
    const fail = async (summary: string) => mediaAudit(tx, actor, meta, now, { action: "media.update", id, label, outcome: "failed", summary });
    if (asset.deletedAt) {
      await fail("Refused: the item is in the Trash (read-only until restored).");
      return { kind: "refused", message: "This item is in the Trash. Restore it before changing its details." } as const;
    }
    if (asset.lockVersion !== input.lockVersion) {
      await fail(`Refused: the item changed after the form was opened (version ${input.lockVersion}, now ${asset.lockVersion}).`);
      return { kind: "stale", message: MEDIA_STALE_MESSAGE } as const;
    }
    if (input.folderId) {
      // A locking read: a folder deleted meanwhile is seen gone (or kept until this change commits).
      const [folder] = await rowsOf<{ id: string }>(tx, sql`SELECT id FROM media_folders WHERE id = ${input.folderId} LOCK IN SHARE MODE`);
      if (!folder) return { kind: "invalid", message: "Check the highlighted fields.", errors: { folderId: "That folder no longer exists. Reload the page." } } as const;
    }
    const isImage = asset.kind === "image";
    const next = {
      en: { title: input.en.title || null, alt: isImage ? altValue(input.en.altMode, input.en.alt) : null, caption: input.en.caption || null },
      ar: { title: input.ar.title || null, alt: isImage ? altValue(input.ar.altMode, input.ar.alt) : null, caption: input.ar.caption || null },
    };
    // An approved item keeps what its approval required (A4 brief §20): the alt decision of an image, the library title
    // of a public document, in both languages. Removing one is refused (approval is never undone by a metadata save).
    if (asset.usageStatus === "approved" && asset.visibility === "public") {
      for (const locale of ["en", "ar"] as const) {
        if (isImage && next[locale].alt === null) errors[`${locale}.altMode`] = "An approved image keeps its alt decision: write the alt text or mark it decorative.";
        if (asset.kind === "document" && !next[locale].title) errors[`${locale}.title`] = "An approved document keeps its title in both languages.";
      }
      if (Object.keys(errors).length) return { kind: "invalid", message: "Check the highlighted fields.", errors } as const;
    }
    const before = await translationsOf(tx, id);
    const changed: string[] = [];
    const sameText = (a: string | null | undefined, b: string | null) => (a ?? null) === b;
    for (const locale of ["en", "ar"] as const) {
      const was = before[locale];
      const now_ = next[locale];
      const name = locale === "en" ? "English" : "Arabic";
      if (!sameText(was?.title, now_.title)) changed.push(`${name} title`);
      if (!sameText(was?.altText, now_.alt)) changed.push(`${name} alt text`);
      if (!sameText(was?.caption, now_.caption)) changed.push(`${name} caption`);
      if (now_.title === null && now_.alt === null && now_.caption === null) {
        await tx.delete(mediaTranslations).where(and(eq(mediaTranslations.mediaId, id), eq(mediaTranslations.locale, locale)));
      } else {
        const values = { title: now_.title, altText: now_.alt, caption: now_.caption, updatedAt: now, updatedBy: actor.user.id };
        await tx
          .insert(mediaTranslations)
          .values({ mediaId: id, locale, ...values })
          .onDuplicateKeyUpdate({ set: values });
      }
    }
    const root = {
      folderId: input.folderId ?? null,
      focalX: isImage && fx !== undefined ? fx.toFixed(3) : null,
      focalY: isImage && fy !== undefined ? fy.toFixed(3) : null,
      rightsHolder: input.rightsHolder || null,
      rightsNote: input.rightsNote || null,
      sourceNote: input.sourceNote || null,
      licenceExpiresOn: input.licenceExpiresOn ?? null,
    };
    const ROOT_LABELS: Record<keyof typeof root, string> = {
      folderId: "folder",
      focalX: "focal point",
      focalY: "focal point",
      rightsHolder: "rights holder",
      rightsNote: "rights note",
      sourceNote: "source note",
      licenceExpiresOn: "licence expiry",
    };
    const asNumber = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    for (const key of Object.keys(root) as (keyof typeof root)[]) {
      const was = asset[key] as unknown;
      const now_ = root[key];
      const same = key === "focalX" || key === "focalY" ? asNumber(was) === asNumber(now_) : (was ?? null) === now_;
      if (!same && !changed.includes(ROOT_LABELS[key])) changed.push(ROOT_LABELS[key]);
    }
    if (!changed.length) return { kind: "unchanged", message: "Nothing changed." } as const;
    await tx
      .update(mediaAssets)
      .set({ ...root, lockVersion: sql`${mediaAssets.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id })
      .where(eq(mediaAssets.id, id));
    await syncPublicMedia(tx, id, now);
    await rebuildMediaSearch(tx, id, now);
    const newLabel = await mediaLabel(tx, asset);
    await mediaAudit(tx, actor, meta, now, {
      action: "media.update",
      id,
      label: newLabel,
      summary: `Updated the details of media ${quoted(newLabel)}: ${changed.join(", ")}.`,
      changes: { fields: changed },
    });
    return { kind: "ok", summary: "Saved.", lockVersion: asset.lockVersion + 1 } as const;
  });
}

// --- Flags (A4 brief §15, §41, §43) ---------------------------------------------------------------------------------------

/** Names one instance of a flag (the time it was added) for a clear request. */
export const mediaFlagToken = (createdAt: Date) => String(createdAt.getTime());

/** Adds a flag (any role with media.flag; never needs the item's version). A blocking flag withdraws the item at once. */
export async function addMediaFlag(ctx: MediaContext, id: string, flag: string, rawNote: unknown): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id)) return { kind: "not_found" };
  if (!isKnownMediaFlag(flag)) return { kind: "invalid", message: "Choose one of the listed flags." };
  const note = cleanNote(rawNote);
  const problem = note ? noteProblem(note, 1, MEDIA_LIMITS.noteMax) : null;
  if (problem) return { kind: "invalid", message: `Note: ${problem}` };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, "flag", "media.flag_add");
    if (refused) return refused;
    const [existing] = await tx.select({ flag: mediaFlags.flag }).from(mediaFlags).where(and(eq(mediaFlags.mediaId, id), eq(mediaFlags.flag, flag)));
    if (existing) return { kind: "unchanged", message: `“${mediaFlagLabel(flag)}” is already set on this item.` } as const;
    await tx.insert(mediaFlags).values({ mediaId: id, flag, note: note || null, createdAt: now, createdBy: actor.user.id });
    const sync = await syncPublicMedia(tx, id, now);
    const label = await mediaLabel(tx, asset);
    await mediaAudit(tx, actor, meta, now, {
      action: "media.flag_add",
      id,
      label,
      summary: `Added the flag “${mediaFlagLabel(flag)}” to media ${quoted(label)}${isBlockingMediaFlag(flag) ? " (blocking)" : ""}${sync.changed && !sync.deliverable ? "; it is no longer deliverable" : ""}.`,
      changes: { after: { flag }, ...(note ? { reason: note } : {}) },
    });
    return { kind: "ok", summary: `Added “${mediaFlagLabel(flag)}”.` } as const;
  });
}

/**
 * Clears one instance of a flag (`token`) with a reason: Owner and Admin only (media.approve), audited. A flag cleared
 * and added again since the page was opened is a newer instance: the stale request changes nothing.
 */
export async function clearMediaFlag(ctx: MediaContext, id: string, flag: string, token: string, rawNote: unknown): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id) || !/^[a-z0-9_]{1,32}$/.test(flag) || !/^[0-9]{1,16}$/.test(token)) return { kind: "not_found" };
  const note = cleanNote(rawNote);
  const problem = noteProblem(note, 3, MEDIA_LIMITS.decisionNoteMax);
  if (problem) return { kind: "invalid", message: `Reason: ${problem}` };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, "clear_flag", "media.flag_clear");
    if (refused) return refused;
    const label = await mediaLabel(tx, asset);
    const [row] = await tx.select().from(mediaFlags).where(and(eq(mediaFlags.mediaId, id), eq(mediaFlags.flag, flag)));
    if (!row || mediaFlagToken(row.createdAt) !== token) {
      await mediaAudit(tx, actor, meta, now, {
        action: "media.flag_clear",
        id,
        label,
        outcome: "failed",
        summary: `Refused: the flag “${mediaFlagLabel(flag)}” changed after the page was opened (cleared, or cleared and added again).`,
      });
      return { kind: "stale", message: "This flag changed after you opened the page (cleared, or added again). Reload and check it." } as const;
    }
    await tx.delete(mediaFlags).where(and(eq(mediaFlags.mediaId, id), eq(mediaFlags.flag, flag)));
    const sync = await syncPublicMedia(tx, id, now);
    await mediaAudit(tx, actor, meta, now, {
      action: "media.flag_clear",
      id,
      label,
      summary: `Cleared the flag “${mediaFlagLabel(flag)}” of media ${quoted(label)}${isBlockingMediaFlag(flag) ? " (blocking)" : ""}${sync.deliverable ? "; it is deliverable again" : ""}.`,
      changes: { before: { flag }, reason: note },
    });
    return { kind: "ok", summary: `Cleared “${mediaFlagLabel(flag)}”.` } as const;
  });
}

// --- Approval (A4 brief §18–§20, §42) ---------------------------------------------------------------------------------------

/**
 * Approves an item for public use — an explicit action, never part of saving its details. Decided on the latest locked
 * state and on the version the approver's page showed: public class, pending review, not in the Trash, no blocking flag,
 * the current file ready and its delivery files on disk, the alt decision of an image (or the library title of a
 * document) in both languages, and a note. Builds the `public_media` row in the same transaction.
 */
export async function approveMedia(ctx: MediaContext, id: string, expectedVersion: number, rawNote: unknown): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id)) return { kind: "not_found" };
  const note = cleanNote(rawNote);
  const problem = noteProblem(note, 3, MEDIA_LIMITS.decisionNoteMax);
  if (problem) return { kind: "invalid", message: `Approval note: ${problem}` };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refusedAccess = await refuseUnlessAllowed(tx, ctx, now, asset, "approve", "media.approve");
    if (refusedAccess) return refusedAccess;
    const label = await mediaLabel(tx, asset);
    const refuse = async (message: string, outcome: "failed" = "failed") => {
      await mediaAudit(tx, actor, meta, now, { action: "media.approve", id, label, outcome, summary: `Refused: ${message}` });
      return { kind: "refused", message: `This item can't be approved yet: ${message}` } as const;
    };
    if (asset.lockVersion !== expectedVersion) {
      await mediaAudit(tx, actor, meta, now, {
        action: "media.approve",
        id,
        label,
        outcome: "failed",
        summary: `Refused: the item changed after the page was opened (version ${expectedVersion}, now ${asset.lockVersion}).`,
      });
      return { kind: "stale", message: MEDIA_STALE_MESSAGE } as const;
    }
    if (asset.deletedAt) return refuse("the item is in the Trash.");
    if (asset.usageStatus === "approved") return { kind: "unchanged", message: "This item is already approved." } as const;
    if (asset.usageStatus !== "pending_review") {
      return refuse(
        asset.usageStatus === "restricted"
          ? "the item is restricted. Lift the restriction first (it returns to review)."
          : asset.usageStatus === "archived"
            ? "the item is archived. Restore it first (it returns to review)."
            : `only an item pending review can be approved (it is ${USAGE_STATUS_LABELS[asset.usageStatus as UsageStatus] ?? asset.usageStatus}).`,
      );
    }
    const flags = (await flagsOf(tx, id)).map((f) => f.flag);
    const blocking = flags.filter(isBlockingMediaFlag);
    if (blocking.length) return refuse(`it has blocking flags: ${blocking.map(mediaFlagLabel).join(", ")}. An Owner or Admin clears them first, with a reason.`);
    const file = await fileOf(tx, id, asset.currentFileId);
    if (!file) return refuse("it has no current file.");
    if (file.processingStatus !== "ready") return refuse(`its current file is not ready (${file.processingStatus}).`);
    const tr = await translationsOf(tx, id);
    if (asset.kind === "image") {
      const undecided = (["en", "ar"] as const).filter((l) => tr[l]?.altText === null || tr[l]?.altText === undefined);
      if (undecided.length) return refuse(`decide the alt text in ${undecided.map((l) => (l === "en" ? "English" : "Arabic")).join(" and ")} first (write it, or mark the image decorative).`);
    } else if (asset.kind === "document") {
      const untitled = (["en", "ar"] as const).filter((l) => !tr[l]?.title);
      if (untitled.length) return refuse(`give the document its library title in ${untitled.map((l) => (l === "en" ? "English" : "Arabic")).join(" and ")} first.`);
    }
    const widths = file.storageArea === "originals" ? (await variantsOf(tx, file.id)).filter((v) => v.variantKey !== "thumb").length : 0;
    const verdict = deliverability({
      visibility: asset.visibility,
      usageStatus: "approved",
      deleted: false,
      flags,
      kind: asset.kind,
      current: { processingStatus: file.processingStatus, storageArea: file.storageArea },
      widthVariants: widths,
    });
    if (!verdict.deliverable) return refuse(verdict.reasons.join(" "));
    const missing = await missingFilesOf(ctx, asset, file);
    if (missing.length) return refuse(`its files are missing on disk (${missing.join(", ")}). Run the maintenance tool.`);
    await tx
      .update(mediaAssets)
      .set({ usageStatus: "approved", approvedAt: now, approvedBy: actor.user.id, approvalNote: note, lockVersion: sql`${mediaAssets.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id })
      .where(eq(mediaAssets.id, id));
    const sync = await syncPublicMedia(tx, id, now);
    if (!sync.deliverable) throw new Error("An approved item was not deliverable after its checks.");
    await mediaAudit(tx, actor, meta, now, {
      action: "media.approve",
      id,
      label,
      summary: `Approved media ${quoted(label)} for public use (version ${file.version}).`,
      changes: { before: { status: "pending_review" }, after: { status: "approved" }, reason: note, version: file.version },
    });
    return { kind: "ok", summary: "Approved.", lockVersion: asset.lockVersion + 1 } as const;
  });
}

// --- Status changes: restrict, lift, archive, restore (A4 brief §17, §43) -----------------------------------------------------

/** Where an item goes when a restriction is lifted or it leaves the archive or the Trash: review again (private: internal). */
const reviewStatusOf = (asset: AssetRow): UsageStatus => (asset.visibility === "public" ? "pending_review" : "internal");

const CLEAR_APPROVAL = { approvedAt: null, approvedBy: null, approvalNote: null } as const;

/** Restricts an item (Owner/Admin): it stops being deliverable at once. Never needs the page's version. */
export async function restrictMedia(ctx: MediaContext, id: string, rawReason: unknown): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id)) return { kind: "not_found" };
  const reason = cleanNote(rawReason);
  const problem = noteProblem(reason, 3, MEDIA_LIMITS.noteMax);
  if (problem) return { kind: "invalid", message: `Reason: ${problem}` };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, "restrict", "media.restrict");
    if (refused) return refused;
    if (asset.usageStatus === "restricted") return { kind: "unchanged", message: "This item is already restricted." } as const;
    await tx
      .update(mediaAssets)
      .set({
        usageStatus: "restricted",
        restrictedAt: now,
        restrictedBy: actor.user.id,
        restrictionReason: reason,
        ...CLEAR_APPROVAL,
        lockVersion: sql`${mediaAssets.lockVersion} + 1`,
        updatedAt: now,
        updatedBy: actor.user.id,
      })
      .where(eq(mediaAssets.id, id));
    const sync = await syncPublicMedia(tx, id, now);
    const label = await mediaLabel(tx, asset);
    await mediaAudit(tx, actor, meta, now, {
      action: "media.restrict",
      id,
      label,
      summary: `Restricted media ${quoted(label)}${sync.changed ? "; it is no longer deliverable" : ""}.`,
      changes: { before: { status: asset.usageStatus }, after: { status: "restricted" }, reason },
    });
    return { kind: "ok", summary: "Restricted.", lockVersion: asset.lockVersion + 1 } as const;
  });
}

/** Lifts a restriction (Owner/Admin, on the version the page showed): the item returns to review, never to approved. */
export async function unrestrictMedia(ctx: MediaContext, id: string, expectedVersion: number, rawNote: unknown): Promise<MediaResult> {
  return statusBack(ctx, id, expectedVersion, rawNote, { from: "restricted", operation: "unrestrict", action: "media.unrestrict", verb: "Lifted the restriction of" });
}

/** Archives an item (Owner/Admin). Never needs the page's version: archiving only makes it safer. */
export async function archiveMedia(ctx: MediaContext, id: string): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id)) return { kind: "not_found" };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, "archive", "media.archive");
    if (refused) return refused;
    if (asset.usageStatus === "archived") return { kind: "unchanged", message: "This item is already archived." } as const;
    await tx
      .update(mediaAssets)
      .set({ usageStatus: "archived", ...CLEAR_APPROVAL, lockVersion: sql`${mediaAssets.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id })
      .where(eq(mediaAssets.id, id));
    const sync = await syncPublicMedia(tx, id, now);
    const label = await mediaLabel(tx, asset);
    await mediaAudit(tx, actor, meta, now, {
      action: "media.archive",
      id,
      label,
      summary: `Archived media ${quoted(label)}${sync.changed ? "; it is no longer deliverable" : ""}.`,
      changes: { before: { status: asset.usageStatus }, after: { status: "archived" } },
    });
    return { kind: "ok", summary: "Archived.", lockVersion: asset.lockVersion + 1 } as const;
  });
}

/** Brings an item back from the archive (Owner/Admin, on the version the page showed): it returns to review. */
export async function unarchiveMedia(ctx: MediaContext, id: string, expectedVersion: number, rawNote: unknown): Promise<MediaResult> {
  return statusBack(ctx, id, expectedVersion, rawNote, { from: "archived", operation: "unarchive", action: "media.unarchive", verb: "Restored from the archive" });
}

async function statusBack(
  ctx: MediaContext,
  id: string,
  expectedVersion: number,
  rawNote: unknown,
  how: { from: "restricted" | "archived"; operation: MediaOperation; action: string; verb: string },
): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id)) return { kind: "not_found" };
  const note = cleanNote(rawNote);
  const problem = noteProblem(note, 3, MEDIA_LIMITS.decisionNoteMax);
  if (problem) return { kind: "invalid", message: `Reason: ${problem}` };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, how.operation, how.action);
    if (refused) return refused;
    const label = await mediaLabel(tx, asset);
    if (asset.lockVersion !== expectedVersion) {
      await mediaAudit(tx, actor, meta, now, {
        action: how.action,
        id,
        label,
        outcome: "failed",
        summary: `Refused: the item changed after the page was opened (version ${expectedVersion}, now ${asset.lockVersion}).`,
      });
      return { kind: "stale", message: MEDIA_STALE_MESSAGE } as const;
    }
    if (asset.usageStatus !== how.from) return { kind: "unchanged", message: `This item is not ${how.from}.` } as const;
    const status = reviewStatusOf(asset);
    await tx
      .update(mediaAssets)
      .set({
        usageStatus: status,
        ...(how.from === "restricted" ? { restrictedAt: null, restrictedBy: null, restrictionReason: null } : {}),
        lockVersion: sql`${mediaAssets.lockVersion} + 1`,
        updatedAt: now,
        updatedBy: actor.user.id,
      })
      .where(eq(mediaAssets.id, id));
    await syncPublicMedia(tx, id, now);
    await mediaAudit(tx, actor, meta, now, {
      action: how.action,
      id,
      label,
      summary: `${how.verb} media ${quoted(label)}: it is ${USAGE_STATUS_LABELS[status].toLowerCase()} (an approval is needed again).`,
      changes: { before: { status: how.from }, after: { status }, reason: note },
    });
    return { kind: "ok", summary: `Now ${USAGE_STATUS_LABELS[status].toLowerCase()}.`, lockVersion: asset.lockVersion + 1 } as const;
  });
}

// --- The Trash (A4 brief §58) -----------------------------------------------------------------------------------------------

/** Moves an item to the Trash (soft delete): it stops being deliverable at once; metadata, files and history stay. */
export async function trashMedia(ctx: MediaContext, id: string): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id)) return { kind: "not_found" };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, "trash", "media.trash");
    if (refused) return refused;
    if (asset.deletedAt) return { kind: "unchanged", message: "This item is already in the Trash." } as const;
    await tx
      .update(mediaAssets)
      .set({ deletedAt: now, deletedBy: actor.user.id, lockVersion: sql`${mediaAssets.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id })
      .where(eq(mediaAssets.id, id));
    const sync = await syncPublicMedia(tx, id, now);
    const label = await mediaLabel(tx, asset);
    await mediaAudit(tx, actor, meta, now, {
      action: "media.trash",
      id,
      label,
      summary: `Moved media ${quoted(label)} to the Trash${sync.changed ? "; it is no longer deliverable" : ""} (metadata, files and versions are kept).`,
      changes: { status: asset.usageStatus },
    });
    return { kind: "ok", summary: "Moved to the Trash.", lockVersion: asset.lockVersion + 1 } as const;
  });
}

/** Restores an item from the Trash into a safe state: an approved item returns to review; restricted and archived stay. */
export async function restoreMediaFromTrash(ctx: MediaContext, id: string, expectedVersion: number): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id)) return { kind: "not_found" };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, "untrash", "media.untrash");
    if (refused) return refused;
    const label = await mediaLabel(tx, asset);
    if (asset.lockVersion !== expectedVersion) {
      await mediaAudit(tx, actor, meta, now, {
        action: "media.untrash",
        id,
        label,
        outcome: "failed",
        summary: `Refused: the item changed after the page was opened (version ${expectedVersion}, now ${asset.lockVersion}).`,
      });
      return { kind: "stale", message: MEDIA_STALE_MESSAGE } as const;
    }
    if (!asset.deletedAt) return { kind: "unchanged", message: "This item is not in the Trash." } as const;
    const status: UsageStatus = asset.usageStatus === "approved" ? "pending_review" : (asset.usageStatus as UsageStatus);
    await tx
      .update(mediaAssets)
      .set({
        deletedAt: null,
        deletedBy: null,
        usageStatus: status,
        ...(asset.usageStatus === "approved" ? CLEAR_APPROVAL : {}),
        lockVersion: sql`${mediaAssets.lockVersion} + 1`,
        updatedAt: now,
        updatedBy: actor.user.id,
      })
      .where(eq(mediaAssets.id, id));
    await syncPublicMedia(tx, id, now);
    await mediaAudit(tx, actor, meta, now, {
      action: "media.untrash",
      id,
      label,
      summary: `Restored media ${quoted(label)} from the Trash: it is ${USAGE_STATUS_LABELS[status].toLowerCase()}${asset.usageStatus === "approved" ? " (it needs approval again)" : ""}.`,
      changes: { before: { status: asset.usageStatus }, after: { status } },
    });
    return { kind: "ok", summary: `Restored (${USAGE_STATUS_LABELS[status].toLowerCase()}).`, lockVersion: asset.lockVersion + 1 } as const;
  });
}

// --- Versions (A4 brief §33–§34) ----------------------------------------------------------------------------------------------

/**
 * Makes an earlier version current again (Owner/Admin, on the version the page showed). The newer version stays (it is
 * never deleted); an approved item returns to review — restoring is a replacement too (Owner decision 8); restricted
 * and archived items keep their status. The restored version's files must be on disk.
 */
export async function restoreMediaVersion(ctx: MediaContext, id: string, fileId: string, expectedVersion: number): Promise<MediaResult> {
  const { deps, actor, meta } = ctx;
  if (!isUlid(id) || !isUlid(fileId)) return { kind: "not_found" };
  return contentTransaction(deps, actor, async (tx, now) => {
    const asset = await lockAsset(tx, id);
    if (!asset) return { kind: "not_found" } as const;
    const refused = await refuseUnlessAllowed(tx, ctx, now, asset, "restore_version", "media.restore_version");
    if (refused) return refused;
    const label = await mediaLabel(tx, asset);
    const fail = async (message: string) => {
      await mediaAudit(tx, actor, meta, now, { action: "media.restore_version", id, label, outcome: "failed", summary: `Refused: ${message}` });
      return { kind: "refused", message } as const;
    };
    if (asset.lockVersion !== expectedVersion) {
      await mediaAudit(tx, actor, meta, now, {
        action: "media.restore_version",
        id,
        label,
        outcome: "failed",
        summary: `Refused: the item changed after the page was opened (version ${expectedVersion}, now ${asset.lockVersion}).`,
      });
      return { kind: "stale", message: MEDIA_STALE_MESSAGE } as const;
    }
    if (asset.deletedAt) return fail("the item is in the Trash. Restore it first.");
    const file = await fileOf(tx, id, fileId);
    if (!file) return { kind: "not_found" } as const;
    if (asset.currentFileId === file.id) return { kind: "unchanged", message: "That version is already the current one." } as const;
    if (file.processingStatus !== "ready") return fail(`that version is not ready (${file.processingStatus}).`);
    const missing = await missingFilesOf(ctx, asset, file);
    if (missing.length) return fail(`that version's files are missing on disk (${missing.join(", ")}). Regenerate its variants with the maintenance tool.`);
    const status: UsageStatus = asset.usageStatus === "approved" ? "pending_review" : (asset.usageStatus as UsageStatus);
    if (asset.currentFileId) await tx.update(mediaFiles).set({ supersededAt: now }).where(eq(mediaFiles.id, asset.currentFileId));
    await tx.update(mediaFiles).set({ supersededAt: null }).where(eq(mediaFiles.id, file.id));
    await tx
      .update(mediaAssets)
      .set({
        currentFileId: file.id,
        usageStatus: status,
        ...(asset.usageStatus === "approved" ? CLEAR_APPROVAL : {}),
        lockVersion: sql`${mediaAssets.lockVersion} + 1`,
        updatedAt: now,
        updatedBy: actor.user.id,
      })
      .where(eq(mediaAssets.id, id));
    await syncPublicMedia(tx, id, now);
    await rebuildMediaSearch(tx, id, now);
    await mediaAudit(tx, actor, meta, now, {
      action: "media.restore_version",
      id,
      label,
      summary: `Made version ${file.version} of media ${quoted(label)} current again${asset.usageStatus === "approved" ? "; it is pending review (approval needed again)" : ""}.`,
      changes: { before: { status: asset.usageStatus }, after: { status }, version: file.version },
    });
    return { kind: "ok", summary: `Version ${file.version} is current.`, lockVersion: asset.lockVersion + 1 } as const;
  });
}

// --- Names for the views ----------------------------------------------------------------------------------------------------

export async function userNamesOf(db: Db, ids: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((v): v is string => typeof v === "string" && v.length === 26))];
  if (!wanted.length) return new Map();
  const rows = await db.select({ id: users.id, name: users.displayName }).from(users).where(sql`${users.id} IN (${sql.join(wanted.map((w) => sql`${w}`), sql`, `)})`);
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** The newest file versions first (for the Versions panel). */
export async function versionsOf(db: Db, mediaId: string) {
  return db.select().from(mediaFiles).where(eq(mediaFiles.mediaId, mediaId)).orderBy(desc(mediaFiles.version));
}

export type { MediaFlagKey };
