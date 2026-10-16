/**
 * Who may do what with a media item (A4 brief §21, §65; A1-SECURITY-RBAC §5.3), decided from the acting session's
 * permissions and the item's visibility — never from a hidden button. The permission keys are A2's registry; A4 adds
 * none:
 *
 * - every role views the library and adds flags (`media.view`, `media.flag`);
 * - Owner, Admin and Editor upload and edit public-class items (`media.upload`, `media.edit`);
 * - Owner and Admin approve, clear blocking flags, restrict, archive, restore versions (`media.approve`), move to and
 *   from the Trash (`media.delete`) and download public-class originals (`media.view_original`);
 * - private documents are the Owner's alone: seeing one at all needs `private_documents.view`; changing one needs
 *   `private_documents.upload` (or `.delete` for the Trash); downloading one also needs a step-up within 10 minutes
 *   (checked by the file route). To everyone else a private item does not exist ("not found").
 *
 * Framework-free and pure.
 */
import type { Visibility } from "./registry.ts";

export type MediaOperation =
  | "view"
  | "edit"
  | "flag"
  | "clear_flag"
  | "approve"
  | "restrict"
  | "unrestrict"
  | "archive"
  | "unarchive"
  | "trash"
  | "untrash"
  | "restore_version"
  | "replace"
  | "view_original";

/** Whether the person may know private items exist (list, search, open, pick none of them otherwise). */
export const canSeePrivate = (permissions: ReadonlySet<string>) => permissions.has("private_documents.view");

const PUBLIC_KEYS: Record<MediaOperation, readonly string[]> = {
  view: ["media.view"],
  edit: ["media.edit"],
  flag: ["media.flag"],
  clear_flag: ["media.approve"],
  approve: ["media.approve"],
  restrict: ["media.approve"],
  unrestrict: ["media.approve"],
  archive: ["media.approve"],
  unarchive: ["media.approve"],
  trash: ["media.delete"],
  untrash: ["media.delete"],
  restore_version: ["media.approve"],
  replace: ["media.upload", "media.edit"],
  view_original: ["media.view_original"],
};

/** Private items: seeing needs private_documents.view; every change private_documents.upload (Trash: .delete). */
const PRIVATE_KEYS: Record<MediaOperation, readonly string[] | null> = {
  view: [],
  edit: ["private_documents.upload"],
  flag: ["private_documents.upload"],
  clear_flag: ["private_documents.upload"],
  // A private item is never approved: there is no path from private to public.
  approve: null,
  restrict: ["private_documents.upload"],
  unrestrict: ["private_documents.upload"],
  archive: ["private_documents.upload"],
  unarchive: ["private_documents.upload"],
  trash: ["private_documents.delete"],
  untrash: ["private_documents.delete"],
  restore_version: ["private_documents.upload"],
  replace: ["private_documents.upload"],
  view_original: [],
};

/** The permission keys an operation needs on an item of this visibility; null when it can never be done. */
export function requiredKeys(operation: MediaOperation, visibility: Visibility): readonly string[] | null {
  if (visibility === "private") {
    const keys = PRIVATE_KEYS[operation];
    return keys === null ? null : ["private_documents.view", ...keys];
  }
  return PUBLIC_KEYS[operation];
}

export type AccessDecision = { ok: true } | { ok: false; hidden: boolean; missing: readonly string[] };

/**
 * May the person do `operation` on an item of this visibility? `hidden` means the item must look absent (a private item
 * to someone who may not know private items exist): the caller answers "not found", never "forbidden".
 */
export function decideAccess(permissions: ReadonlySet<string>, operation: MediaOperation, visibility: Visibility): AccessDecision {
  if (visibility === "private" && !canSeePrivate(permissions)) return { ok: false, hidden: true, missing: ["private_documents.view"] };
  const keys = requiredKeys(operation, visibility);
  if (keys === null) return { ok: false, hidden: false, missing: [] };
  const missing = keys.filter((k) => !permissions.has(k));
  return missing.length ? { ok: false, hidden: false, missing } : { ok: true };
}

export const mayUploadPublic = (permissions: ReadonlySet<string>) => permissions.has("media.upload");
export const mayUploadPrivate = (permissions: ReadonlySet<string>) => permissions.has("private_documents.view") && permissions.has("private_documents.upload");
