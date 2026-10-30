"use server";
/**
 * Server Actions of the media library (A4). Each one starts with the admin's own checks — the gate, the session, the
 * request's origin (`actionContext`) — before it reads or answers anything about its input, then hands the change to
 * the media services, which decide the permission from the acting session (private items: hidden from anyone without
 * private access), lock the item, check its version where the change makes it less safe, and audit the outcome. Nothing
 * a form says about who acts, an item's status or its visibility is taken as authority. Uploads and file downloads are
 * Route Handlers (they stream), not actions.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { formToObject } from "@/server/cms/form";
import { pickerCards } from "@/server/media/cards";
import { createFolder, deleteFolder, moveFolder, renameFolder, reorderFolder } from "@/server/media/folders";
import {
  addMediaFlag,
  approveMedia,
  archiveMedia,
  clearMediaFlag,
  restoreMediaFromTrash,
  restoreMediaVersion,
  restrictMedia,
  trashMedia,
  unarchiveMedia,
  unrestrictMedia,
  updateMediaMetadata,
  type MediaContext,
  type MediaResult,
} from "@/server/media/service";
import { guarded } from "../context";
import { actionContext, failure, type ActionState } from "../guards";
import { mediaDeps } from "../routes";
import type { PickerState } from "./media-model";

const ULID = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const VERSION = z.coerce.number().int().min(0).max(2_147_483_647);
const NOTE = z.string().max(4000).default("");
const NOT_FOUND = "This media item no longer exists, or you can't see it. Go back to the library.";

const mediaCtx = (context: { actor: MediaContext["actor"]; meta: MediaContext["meta"] }): MediaContext => ({ deps: mediaDeps(), actor: context.actor, meta: context.meta });

/** A service result as the form shows it (field errors as one list, in the order the form names them). */
function stateOf(result: MediaResult): ActionState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary };
    case "unchanged":
      return { status: "ok", message: result.message };
    case "invalid":
      return failure([result.message, ...Object.values(result.errors ?? {})].filter(Boolean).join(" "));
    case "stale":
    case "refused":
    case "denied":
      return failure(result.message);
    case "not_found":
      return failure(NOT_FOUND);
  }
}

// --- Picker ------------------------------------------------------------------------------------------------------------

const PICKER = z.object({
  q: z.string().max(100).default(""),
  kinds: z.array(z.enum(["image", "document"])).min(1).max(2),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  id: ULID.optional(),
});

/**
 * One page of what a public content slot may take (A4 brief §53): public-class only — never a private item, whoever
 * asks — not in the Trash, pending, approved or restricted, ready, of the slot's kinds. Reading it changes nothing.
 */
export async function pickMediaAction(input: { q?: string; kinds: string[]; page?: number; id?: string }): Promise<PickerState> {
  // The picker opens inside editors that hold unsaved work (the page builder, a reusable section, a content form): an
  // ended session is answered in the picker, never redirected, so the page and its edits stay (A5 final correction).
  const ctx = await actionContext("media.pick", { permission: "media.view", signedOut: "answer" });
  if (!ctx.ok) {
    if (ctx.state.signedOut) return { status: "error", message: "Your session has ended. Sign in again in a new tab, then search again; nothing on this page is lost." };
    return { status: "error", message: ctx.state.message ?? "This request was refused." };
  }
  const parsed = PICKER.safeParse(input);
  if (!parsed.success) return { status: "error", message: "The search could not be read." };
  const { q, kinds, page, id } = parsed.data;
  const result = await guarded(() => pickerCards(ctx.context.deps.db, { q, kinds, page, pageSize: 24, ...(id ? { id } : {}) }));
  return { status: "ok", ...result };
}

// --- One item ----------------------------------------------------------------------------------------------------------

/**
 * Save an item's details (titles, alt texts, captions, folder, focal point, rights), decided on the version shown. A
 * saved item opens again from what is stored (a redirect, so the form carries the new version); a refused save keeps the
 * person's typed values in the form.
 */
export async function saveMediaMetadataAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.update");
  if (!ctx.ok) return ctx.state;
  const id = ULID.safeParse(form.get("_id"));
  if (!id.success) return failure(NOT_FOUND);
  const fields = formToObject(form.entries());
  const result = await guarded(() => updateMediaMetadata(mediaCtx(ctx.context), id.data, fields));
  if (result.kind === "ok") redirect(`/admin/media/${id.data}?saved=1`);
  return stateOf(result);
}

/** Add a flag (safety-increasing: every role with media.add_flags; no version needed). */
export async function addMediaFlagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.flag_add");
  if (!ctx.ok) return ctx.state;
  const input = z.object({ id: ULID, flag: z.string().regex(/^[a-z0-9_]{1,32}$/), note: NOTE }).safeParse({ id: form.get("id"), flag: form.get("flag"), note: form.get("note") ?? "" });
  if (!input.success) return failure("Choose one of the listed flags.");
  return stateOf(await guarded(() => addMediaFlag(mediaCtx(ctx.context), input.data.id, input.data.flag, input.data.note)));
}

/** Clear one flag instance (Owner and Admin), with a reason, decided on the instance the page showed. */
export async function clearMediaFlagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.flag_clear");
  if (!ctx.ok) return ctx.state;
  const input = z
    .object({ id: ULID, flag: z.string().regex(/^[a-z0-9_]{1,32}$/), token: z.string().regex(/^[0-9]{1,16}$/), note: NOTE })
    .safeParse({ id: form.get("id"), flag: form.get("flag"), token: form.get("token"), note: form.get("note") ?? "" });
  if (!input.success) return failure("This flag can't be cleared from this page. Reload it.");
  const { id, flag, token, note } = input.data;
  return stateOf(await guarded(() => clearMediaFlag(mediaCtx(ctx.context), id, flag, token, note)));
}

const versioned = (form: FormData) => z.object({ id: ULID, version: VERSION, note: NOTE }).safeParse({ id: form.get("id"), version: form.get("version"), note: form.get("note") ?? "" });

/** Approve for public use (Owner and Admin): an explicit action, decided on the version the page showed. */
export async function approveMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.approve");
  if (!ctx.ok) return ctx.state;
  const input = versioned(form);
  if (!input.success) return failure(NOT_FOUND);
  return stateOf(await guarded(() => approveMedia(mediaCtx(ctx.context), input.data.id, input.data.version, input.data.note)));
}

/** Restrict (Owner and Admin): safety-increasing, never refused by an older page. */
export async function restrictMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.restrict");
  if (!ctx.ok) return ctx.state;
  const input = z.object({ id: ULID, reason: NOTE }).safeParse({ id: form.get("id"), reason: form.get("reason") ?? "" });
  if (!input.success) return failure(NOT_FOUND);
  return stateOf(await guarded(() => restrictMedia(mediaCtx(ctx.context), input.data.id, input.data.reason)));
}

/** Lift a restriction (back to review, never straight to approved), decided on the version shown. */
export async function unrestrictMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.unrestrict");
  if (!ctx.ok) return ctx.state;
  const input = versioned(form);
  if (!input.success) return failure(NOT_FOUND);
  return stateOf(await guarded(() => unrestrictMedia(mediaCtx(ctx.context), input.data.id, input.data.version, input.data.note)));
}

/** Archive (safety-increasing). */
export async function archiveMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.archive");
  if (!ctx.ok) return ctx.state;
  const id = ULID.safeParse(form.get("id"));
  if (!id.success) return failure(NOT_FOUND);
  return stateOf(await guarded(() => archiveMedia(mediaCtx(ctx.context), id.data)));
}

/** Unarchive (back to review, or internal for a private item), decided on the version shown. */
export async function unarchiveMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.unarchive");
  if (!ctx.ok) return ctx.state;
  const input = versioned(form);
  if (!input.success) return failure(NOT_FOUND);
  return stateOf(await guarded(() => unarchiveMedia(mediaCtx(ctx.context), input.data.id, input.data.version, input.data.note)));
}

/** Move to the Trash (safety-increasing: delivery stops at once; nothing is deleted). */
export async function trashMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.trash");
  if (!ctx.ok) return ctx.state;
  const id = ULID.safeParse(form.get("id"));
  if (!id.success) return failure(NOT_FOUND);
  return stateOf(await guarded(() => trashMedia(mediaCtx(ctx.context), id.data)));
}

/** Restore from the Trash into a safe state (approved items return to review), decided on the version shown. */
export async function restoreMediaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.untrash");
  if (!ctx.ok) return ctx.state;
  const input = versioned(form);
  if (!input.success) return failure(NOT_FOUND);
  return stateOf(await guarded(() => restoreMediaFromTrash(mediaCtx(ctx.context), input.data.id, input.data.version)));
}

/** Make an older version current again (Owner and Admin; an approved item returns to review). */
export async function restoreVersionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.restore_version");
  if (!ctx.ok) return ctx.state;
  const input = z.object({ id: ULID, file: ULID, version: VERSION }).safeParse({ id: form.get("id"), file: form.get("file"), version: form.get("version") });
  if (!input.success) return failure(NOT_FOUND);
  return stateOf(await guarded(() => restoreMediaVersion(mediaCtx(ctx.context), input.data.id, input.data.file, input.data.version)));
}

// --- Folders -----------------------------------------------------------------------------------------------------------

const FOLDER_NAME = z.string().max(400);
const OPTIONAL_PARENT = z.preprocess((v) => (v === "" || v === null ? undefined : v), ULID.optional());

export async function createFolderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.folder_create");
  if (!ctx.ok) return ctx.state;
  const input = z.object({ name: FOLDER_NAME, parent: OPTIONAL_PARENT }).safeParse({ name: form.get("name") ?? "", parent: form.get("parent") });
  if (!input.success) return failure("Check the folder's name and place.");
  return stateOf(await guarded(() => createFolder(mediaCtx(ctx.context), input.data.name, input.data.parent ?? null)));
}

export async function renameFolderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.folder_rename");
  if (!ctx.ok) return ctx.state;
  const input = z.object({ id: ULID, name: FOLDER_NAME }).safeParse({ id: form.get("id"), name: form.get("name") ?? "" });
  if (!input.success) return failure("This folder no longer exists. Reload the page.");
  return stateOf(await guarded(() => renameFolder(mediaCtx(ctx.context), input.data.id, input.data.name)));
}

/** Move a folder: `parent` is "top" (the top level) or a folder's id — never implied by an untouched field. */
export async function moveFolderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.folder_move");
  if (!ctx.ok) return ctx.state;
  const input = z.object({ id: ULID, parent: z.union([z.literal("top"), ULID]) }).safeParse({ id: form.get("id"), parent: form.get("parent") });
  if (!input.success) return failure("Choose where to move the folder.");
  const parent = input.data.parent === "top" ? null : input.data.parent;
  return stateOf(await guarded(() => moveFolder(mediaCtx(ctx.context), input.data.id, parent)));
}

export async function reorderFolderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.folder_reorder");
  if (!ctx.ok) return ctx.state;
  const input = z.object({ id: ULID, direction: z.enum(["up", "down"]) }).safeParse({ id: form.get("id"), direction: form.get("direction") });
  if (!input.success) return failure("This folder no longer exists. Reload the page.");
  return stateOf(await guarded(() => reorderFolder(mediaCtx(ctx.context), input.data.id, input.data.direction)));
}

export async function deleteFolderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("media.folder_delete");
  if (!ctx.ok) return ctx.state;
  const id = ULID.safeParse(form.get("id"));
  if (!id.success) return failure("This folder no longer exists. Reload the page.");
  return stateOf(await guarded(() => deleteFolder(mediaCtx(ctx.context), id.data)));
}
