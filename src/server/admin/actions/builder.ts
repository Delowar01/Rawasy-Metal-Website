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
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseBoundedJson } from "@/server/builder/input";
import { createReusable, setReusableArchived, updateReusable, type ReusableResult } from "@/server/builder/reusable";
import { createReusableFromSection, detachSection, initializeLayout, saveLayout, type BuilderChange, type LayoutResult } from "@/server/builder/sections";
import { guarded } from "../context";
import { actionContext, failure, type ActionState } from "../guards";
import { BUILDER_STALE_MESSAGE, type BuilderSaveState } from "./builder-model";

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

const refused = (state: ActionState): BuilderSaveState => ({ status: "error", message: state.message ?? "This request was refused." });

/** Save a whole layout (order, visibility, anchors, new, duplicated, linked and removed sections, edited sections). */
export async function saveLayoutAction(payload: string): Promise<BuilderSaveState> {
  const ctx = await actionContext("layout.save");
  if (!ctx.ok) return refused(ctx.state);
  const parsed = parseBoundedJson(payload);
  if (!parsed.ok) return { status: "error", message: "This layout is too large to save at once, or it couldn't be read. Nothing was saved." };
  return layoutState(await guarded(() => saveLayout(changeOf(ctx.context), parsed.value)));
}

const ownerInput = z.object({ owner: z.unknown(), expectedVersion: z.unknown() }).strict();

/** Set up an empty layout (the page's contract, or the service template's layout). */
export async function initializeLayoutAction(input: unknown): Promise<BuilderSaveState> {
  const ctx = await actionContext("layout.initialize");
  if (!ctx.ok) return refused(ctx.state);
  const parsed = ownerInput.safeParse(input);
  if (!parsed.success) return { status: "error", message: NOT_FOUND };
  return layoutState(await guarded(() => initializeLayout(changeOf(ctx.context), parsed.data.owner, parsed.data.expectedVersion)));
}

/** Detach a linked section: it becomes a local copy of the reusable section. */
export async function detachSectionAction(input: unknown): Promise<BuilderSaveState> {
  const ctx = await actionContext("section.detach_reusable");
  if (!ctx.ok) return refused(ctx.state);
  return layoutState(await guarded(() => detachSection(changeOf(ctx.context), input)));
}

const fromSectionInput = z.object({ owner: z.unknown(), expectedVersion: z.unknown(), sectionId: z.unknown(), name: z.unknown(), mode: z.enum(["copy", "link"]) }).strict();

/** Create a reusable section from a section: a copy (the section stays), or linked (the section shows it from now on). */
export async function createReusableFromSectionAction(input: unknown): Promise<BuilderSaveState & { reusableId?: string }> {
  const ctx = await actionContext("reusable_section.create");
  if (!ctx.ok) return refused(ctx.state);
  const parsed = fromSectionInput.safeParse(input);
  if (!parsed.success) return { status: "error", message: NOT_FOUND };
  const { owner, expectedVersion, sectionId, name, mode } = parsed.data;
  const result = await guarded(() => createReusableFromSection(changeOf(ctx.context), { owner, expectedVersion, sectionId }, name, mode));
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
export async function saveReusableAction(payload: string): Promise<BuilderSaveState> {
  const ctx = await actionContext("reusable_section.update");
  if (!ctx.ok) return refused(ctx.state);
  const parsed = parseBoundedJson(payload, 120_000);
  if (!parsed.ok) return { status: "error", message: "This reusable section is too large to save, or it couldn't be read. Nothing was saved." };
  return reusableState(await guarded(() => updateReusable(changeOf(ctx.context), parsed.value)));
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
