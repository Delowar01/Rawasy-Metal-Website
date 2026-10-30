"use server";
/**
 * Server Actions of the page builder (A5). Each one starts with the admin's own checks — the gate, the session, the
 * request's origin (`actionContext`) — before it reads or answers anything about its input, then hands the change to
 * the builder services, which decide the permission from the acting session's keys, lock the owner (or the reusable
 * section), check the version the editor opened, validate everything with the block registry and audit the outcome.
 *
 * Inputs are small structured JSON (A5 brief §66): a layout save arrives as one JSON string, refused unread past
 * `BUILDER_LIMITS.saveBytes` (well under the 1 MB Server Action body; the global limit is not raised). No file is ever
 * received here (uploads are A4's Route Handlers). Nothing a client sends about who acts, a section's lock, a block's
 * version or a translation's status is authority.
 *
 * Unsaved work (A5 final correction): the editors call these with the working copy in the page, so a session that has
 * ended — before the request, or while the change runs — is answered (`signed_out`), never redirected: the page and its
 * edits stay where they are and nothing is done. The editor also names the user who opened it (`editor`): when this
 * browser is signed in as someone else by then, nothing is done either (audited), so one person's typing is never saved
 * as another's. Sign-in, the session's limits and every check below are unchanged.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseBoundedJson } from "@/server/builder/input";
import { createReusable, setReusableArchived, updateReusable, type ReusableResult } from "@/server/builder/reusable";
import { createReusableFromSection, detachSection, initializeLayout, saveLayout, type BuilderChange, type LayoutResult } from "@/server/builder/sections";
import { SessionEndedError } from "@/server/auth/sessions";
import { guarded } from "../context";
import { actionContext, auditDenied, failure, type ActionContext, type ActionState } from "../guards";
import { BUILDER_OTHER_USER_MESSAGE, BUILDER_SIGNED_OUT_MESSAGE, BUILDER_STALE_MESSAGE, type BuilderSaveState } from "./builder-model";

const changeOf = (context: { deps: BuilderChange["deps"]; actor: BuilderChange["actor"]; meta: BuilderChange["meta"] }): BuilderChange => ({
  deps: { pool: context.deps.pool, db: context.deps.db, clock: context.deps.clock },
  actor: context.actor,
  meta: context.meta,
});

const NOT_FOUND = "This page or service no longer exists, or it is in the Trash. Go back to the list.";
const ARCHIVED = "This record is archived: restore it before changing its layout. Nothing was saved.";

function layoutState(result: LayoutResult): BuilderSaveState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary, lockVersion: result.lockVersion, ids: result.ids };
    case "stale":
      return { status: "stale", message: BUILDER_STALE_MESSAGE };
    case "not_found":
      return { status: "error", message: NOT_FOUND };
    case "archived":
      return { status: "error", message: ARCHIVED };
    case "denied":
      return { status: "error", message: result.message };
    case "invalid":
      return { status: "error", message: result.message, issues: result.issues };
  }
}

const refused = (state: ActionState): BuilderSaveState =>
  state.signedOut ? SIGNED_OUT : { status: "error", message: state.message ?? "This request was refused." };

const SIGNED_OUT: BuilderSaveState = { status: "signed_out", reason: "ended", message: BUILDER_SIGNED_OUT_MESSAGE };

/**
 * The editor's checks: the admin's own (`actionContext`, answering when signed out), then the person — the editor was
 * opened by `editor`; a session of anyone else is refused and audited. Runs before any input is read.
 */
async function editorContext(action: string, editor: unknown): Promise<{ ok: true; context: ActionContext } | { ok: false; state: BuilderSaveState }> {
  const ctx = await actionContext(action, { signedOut: "answer" });
  if (!ctx.ok) return { ok: false, state: refused(ctx.state) };
  if (editor !== ctx.context.actor.user.id) {
    await auditDenied(ctx.context.actor, action, "Refused: the editor was opened by another user (this browser signed in as someone else meanwhile).", ctx.context.meta, ctx.context.deps);
    return { ok: false, state: { status: "signed_out", reason: "other_user", message: BUILDER_OTHER_USER_MESSAGE } };
  }
  return ctx;
}

const ENDED = Symbol("session ended");
/** A change whose session ends while it runs (its transaction finds the session revoked or expired) answers too. */
async function orEnded<T>(work: () => Promise<T>): Promise<T | typeof ENDED> {
  return guarded(async () => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof SessionEndedError) return ENDED;
      throw error;
    }
  });
}

/** Save a whole layout (order, visibility, anchors, new, duplicated, linked and removed sections, edited sections). */
export async function saveLayoutAction(payload: string, editor: string): Promise<BuilderSaveState> {
  const ctx = await editorContext("layout.save", editor);
  if (!ctx.ok) return ctx.state;
  const parsed = parseBoundedJson(payload);
  if (!parsed.ok) return { status: "error", message: "This layout is too large to save at once, or it couldn't be read. Nothing was saved." };
  const result = await orEnded(() => saveLayout(changeOf(ctx.context), parsed.value));
  return result === ENDED ? SIGNED_OUT : layoutState(result);
}

const ownerInput = z.object({ owner: z.unknown(), expectedVersion: z.unknown() }).strict();

/** Set up an empty layout (the page's contract, or the service template's layout). */
export async function initializeLayoutAction(input: unknown, editor: string): Promise<BuilderSaveState> {
  const ctx = await editorContext("layout.initialize", editor);
  if (!ctx.ok) return ctx.state;
  const parsed = ownerInput.safeParse(input);
  if (!parsed.success) return { status: "error", message: NOT_FOUND };
  const result = await orEnded(() => initializeLayout(changeOf(ctx.context), parsed.data.owner, parsed.data.expectedVersion));
  return result === ENDED ? SIGNED_OUT : layoutState(result);
}

/** Detach a linked section: it becomes a local copy of the reusable section. */
export async function detachSectionAction(input: unknown, editor: string): Promise<BuilderSaveState> {
  const ctx = await editorContext("section.detach_reusable", editor);
  if (!ctx.ok) return ctx.state;
  const result = await orEnded(() => detachSection(changeOf(ctx.context), input));
  return result === ENDED ? SIGNED_OUT : layoutState(result);
}

const fromSectionInput = z.object({ owner: z.unknown(), expectedVersion: z.unknown(), sectionId: z.unknown(), name: z.unknown(), mode: z.enum(["copy", "link"]) }).strict();

/** Create a reusable section from a section: a copy (the section stays), or linked (the section shows it from now on). */
export async function createReusableFromSectionAction(input: unknown, editor: string): Promise<BuilderSaveState & { reusableId?: string }> {
  const ctx = await editorContext("reusable_section.create", editor);
  if (!ctx.ok) return ctx.state;
  const parsed = fromSectionInput.safeParse(input);
  if (!parsed.success) return { status: "error", message: NOT_FOUND };
  const { owner, expectedVersion, sectionId, name, mode } = parsed.data;
  const result = await orEnded(() => createReusableFromSection(changeOf(ctx.context), { owner, expectedVersion, sectionId }, name, mode));
  if (result === ENDED) return SIGNED_OUT;
  return { ...layoutState(result), ...(result.reusableId ? { reusableId: result.reusableId } : {}) };
}

// --- Reusable sections -------------------------------------------------------------------------------------------------

function reusableState(result: ReusableResult): BuilderSaveState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary, lockVersion: result.lockVersion, ids: {} };
    case "stale":
      return { status: "stale", message: "This reusable section changed after you opened it. Reload and review the latest version before saving." };
    case "not_found":
      return { status: "error", message: "This reusable section no longer exists. Go back to the list." };
    case "archived":
      return { status: "error", message: "This reusable section is archived: restore it before editing it. Nothing was saved." };
    case "denied":
      return { status: "error", message: result.message };
    case "invalid":
      return { status: "error", message: result.message, issues: result.issues };
  }
}

/** Create a reusable section (name and block type), then open it. */
export async function createReusableAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await actionContext("reusable_section.create");
  if (!ctx.ok) return ctx.state;
  const result = await guarded(() => createReusable(changeOf(ctx.context), { name: form.get("name") ?? "", blockType: form.get("blockType") ?? "" }));
  if (result.kind === "ok") redirect(`/admin/reusable-sections/${result.id}?created=1`);
  const state = reusableState(result);
  return failure(state.status === "error" && state.issues?.length ? state.issues.map((i) => i.message).join(" ") : state.message, { fields: { name: String(form.get("name") ?? "").slice(0, 120) } });
}

/** Save a reusable section's name, settings, texts and language states. */
export async function saveReusableAction(payload: string, editor: string): Promise<BuilderSaveState> {
  const ctx = await editorContext("reusable_section.update", editor);
  if (!ctx.ok) return ctx.state;
  const parsed = parseBoundedJson(payload, 120_000);
  if (!parsed.ok) return { status: "error", message: "This reusable section is too large to save, or it couldn't be read. Nothing was saved." };
  const result = await orEnded(() => updateReusable(changeOf(ctx.context), parsed.value));
  return result === ENDED ? SIGNED_OUT : reusableState(result);
}

/** Archive (only while no section links it) or restore a reusable section. */
export async function setReusableArchivedAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const archived = form.get("archived") === "1";
  const ctx = await actionContext(archived ? "reusable_section.archive" : "reusable_section.restore");
  if (!ctx.ok) return ctx.state;
  const version = Number(form.get("version"));
  const result = await guarded(() => setReusableArchived(changeOf(ctx.context), { id: form.get("id"), expectedVersion: Number.isInteger(version) ? version : -1, archived }));
  const state = reusableState(result);
  return state.status === "ok" ? { status: "ok", message: state.message } : failure(state.message);
}
