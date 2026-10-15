"use server";
/**
 * Server Actions of the Core CMS (A3). Each one starts with the admin's own checks (the gate, the session, the
 * request's origin — `actionContext`) and hands the change to the content services, which decide the permission from
 * the acting session (record-level for legal pages), lock the item, check its version and audit the outcome. Nothing a
 * form says about who acts, an item's status or its version is taken as authority; ids and types are validated here and
 * again by the services. A saved or created item opens again with its new version (a redirect), so the editor starts
 * from what is stored; a refused save keeps the person's typed values in their form.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { createItem, setItemArchived, updateItem, type ChangeContext, type LifecycleResult } from "@/server/cms/engine";
import { addProjectFlag, clearProjectFlag, type FlagResult } from "@/server/cms/flags";
import { formToObject } from "@/server/cms/form";
import { categoryInUse, SPECS } from "@/server/cms/kinds";
import { moveItem } from "@/server/cms/ordering";
import { createPage, setPageArchived, updatePage } from "@/server/cms/pages";
import { ENTITIES, ENTITY_TYPES, PROJECT_FLAG_KEYS, SYSTEM_PAGES, type EntityType } from "@/server/cms/registry";
import type { SaveResult } from "@/server/cms/store";
import { guarded } from "../context";
import { actionContext, failure, type ActionState } from "../guards";
import { STALE_MESSAGE, type ContentState } from "./cms-model";

const ULID = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const TYPE = z.enum(ENTITY_TYPES);
const VERSION = z.coerce.number().int().min(0).max(2_147_483_647);

const changeOf = (context: { deps: ChangeContext["deps"]; actor: ChangeContext["actor"]; meta: ChangeContext["meta"] }): ChangeContext => ({
  deps: { pool: context.deps.pool, db: context.deps.db, clock: context.deps.clock },
  actor: context.actor,
  meta: context.meta,
});

const NOT_FOUND = "This item no longer exists, or it is in another list. Go back to the list and open it again.";

/** Create or save an item. The form carries `_type`, `_id` (an existing item) and, for a new page, `_page`. */
export async function saveContentAction(_prev: ContentState, form: FormData): Promise<ContentState> {
  const type = TYPE.safeParse(form.get("_type"));
  if (!type.success) return { status: "error", message: "Unknown content type." };
  const rawId = form.get("_id");
  const isNew = rawId === null || rawId === "";
  const id = isNew ? null : ULID.safeParse(rawId);
  if (id && !id.success) return { status: "error", message: NOT_FOUND };
  const ctx = await actionContext(`${type.data}.${isNew ? "create" : "update"}`);
  if (!ctx.ok) return { status: "error", message: ctx.state.message ?? "This request was refused." };
  const change = changeOf(ctx.context);
  const fields = formToObject(form.entries());
  let result: SaveResult;
  if (isNew) {
    if (type.data === "page") {
      const choice = String(form.get("_page") ?? "");
      if (choice !== "generic" && !SYSTEM_PAGES.some((p) => `system:${p.key}` === choice)) return { status: "error", message: "Choose what kind of page this is." };
      result = await guarded(() => createPage(change, choice === "generic" ? { kind: "generic" } : { kind: "system", key: choice.slice(7) }, fields));
    } else {
      result = await guarded(() => createItem(change, SPECS[type.data], fields));
    }
  } else {
    const itemId = id!.data!;
    result = await guarded(() => (type.data === "page" ? updatePage(change, itemId, fields) : updateItem(change, SPECS[type.data], itemId, fields)));
  }
  switch (result.kind) {
    case "ok":
      redirect(`${ENTITIES[type.data].path}/${result.id}?${isNew ? "created" : "saved"}=1`);
    case "invalid":
      return { status: "invalid", message: "Some fields need attention. Nothing was saved.", errors: result.errors };
    case "stale":
      return { status: "stale", message: STALE_MESSAGE };
    case "archived":
      return { status: "error", message: `This ${ENTITIES[type.data].one} was archived after you opened it. Nothing was saved; restore it first.` };
    case "not_found":
      return { status: "error", message: NOT_FOUND };
    case "denied":
      return { status: "error", message: result.message };
  }
}

function lifecycleState(result: LifecycleResult, archived: boolean): ActionState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary };
    case "unchanged":
      return { status: "ok", message: archived ? "It was already archived." : "It was already restored." };
    case "stale":
      return failure(STALE_MESSAGE);
    case "not_found":
      return failure(NOT_FOUND);
    case "denied":
    case "refused":
      return failure(result.message);
  }
}

/** Archive (`archived=1`) or restore (`archived=0`) an item, decided on the version the page showed. */
export async function setArchivedAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ type: TYPE, id: ULID, version: VERSION, archived: z.enum(["0", "1"]) })
    .safeParse({ type: form.get("type"), id: form.get("id"), version: form.get("version"), archived: form.get("archived") });
  if (!input.success) return failure(NOT_FOUND);
  const { type, id, version } = input.data;
  const archived = input.data.archived === "1";
  const ctx = await actionContext(`${type}.${archived ? "archive" : "restore"}`);
  if (!ctx.ok) return ctx.state;
  const change = changeOf(ctx.context);
  const result = await guarded(() =>
    type === "page"
      ? setPageArchived(change, id, archived, version)
      : setItemArchived(change, SPECS[type as EntityType], id, archived, version, type === "project_category" ? { blockArchive: categoryInUse } : {}),
  );
  return lifecycleState(result, archived);
}

export type MoveState = { status: "ok" | "error"; message: string; lockVersion?: number };

/** Move an item one place up or down in its collection, decided on the order the page showed. */
export async function moveContentAction(input: { type: string; id: string; direction: string; version: number }): Promise<MoveState> {
  const parsed = z.object({ type: TYPE, id: ULID, direction: z.enum(["up", "down"]), version: VERSION }).safeParse(input);
  if (!parsed.success) return { status: "error", message: NOT_FOUND };
  const { type, id, direction, version } = parsed.data;
  const ctx = await actionContext(`${type}.reorder`);
  if (!ctx.ok) return { status: "error", message: ctx.state.message ?? "This request was refused." };
  const result = await guarded(() => moveItem(changeOf(ctx.context), type, id, direction, version));
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary, lockVersion: result.lockVersion };
    case "stale":
      return { status: "error", message: "The order changed after you opened this page. Reload it and try again." };
    case "edge":
    case "denied":
      return { status: "error", message: result.message };
    case "not_found":
      return { status: "error", message: "This item is archived or no longer exists. Reload the page." };
  }
}

function flagState(result: FlagResult): ActionState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary };
    case "unchanged":
    case "invalid":
    case "stale":
    case "denied":
      return failure(result.message);
    case "not_found":
      return failure(NOT_FOUND);
  }
}

/** Add a restrictive flag to a project (every role: projects.add_flags). */
export async function addFlagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ project: ULID, flag: z.enum(PROJECT_FLAG_KEYS as [string, ...string[]]), note: z.string().max(4000) })
    .safeParse({ project: form.get("project"), flag: form.get("flag"), note: form.get("note") ?? "" });
  if (!input.success) return failure("Choose one of the listed flags.");
  const ctx = await actionContext("project.restriction_add");
  if (!ctx.ok) return ctx.state;
  return flagState(await guarded(() => addProjectFlag(changeOf(ctx.context), input.data.project, input.data.flag, input.data.note)));
}

/** Clear one instance of a flag (Owner and Admin: projects.clear_flags), with a reason. */
export async function clearFlagAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const input = z
    .object({ project: ULID, flag: z.string().regex(/^[a-z0-9_]{1,32}$/), token: z.string().regex(/^[0-9]{1,16}$/), note: z.string().max(4000) })
    .safeParse({ project: form.get("project"), flag: form.get("flag"), token: form.get("token"), note: form.get("note") ?? "" });
  if (!input.success) return failure("This flag can't be cleared from this page. Reload it.");
  const ctx = await actionContext("project.restriction_clear");
  if (!ctx.ok) return ctx.state;
  const { project, flag, token, note } = input.data;
  return flagState(await guarded(() => clearProjectFlag(changeOf(ctx.context), project, flag, token, note)));
}
