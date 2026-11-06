"use server";
/**
 * Server Actions of A8 (publishing, revisions, audit search). Each starts with `actionContext` (gate, session, same
 * origin) before it reads its input; the publishing services then lock the aggregate, decide the permission there from
 * the seeded keys and the stored record (a legal page needs `legal.*`), compare the version the page showed and audit
 * the outcome. Nothing a form says about who acts, a state or a permission is taken as authority: the form names the
 * aggregate, the version the page showed and, for a few steps, a comment, a change note or the legal reviewer.
 */
import { z } from "zod";
import { ORDERING_KEYS } from "@/server/cms/registry";
import { MENU_SLOTS } from "@/server/site/registry";
import type { AggregateType } from "@/server/publishing/registry";
import {
  discardChanges,
  publish,
  requestChanges,
  restoreRevision,
  rollback,
  submitForReview,
  unpublish,
  withdrawFromReview,
  workflowAggregate,
  STALE_MESSAGE,
  type PublishingChange,
  type WorkflowResult,
} from "@/server/publishing/workflow";
import { cleanSearch } from "@/server/enquiries/search-state";
import { auditAddress, parseAuditQuery } from "@/server/audit/viewer";
import { guarded } from "../context";
import { keepAuditSearch } from "../audit-search";
import { actionContext, failure, type ActionState } from "../guards";
import { redirect } from "next/navigation";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const VERSION = z.coerce.number().int().min(0).max(2_147_483_647);
const STEPS = ["submit", "request_changes", "withdraw", "publish", "unpublish", "discard"] as const;
const NOT_FOUND = "This item no longer exists. Reload the page.";

/** Whether `id` names an aggregate of this type (its id grammar; existence is the service's to decide). */
async function validAggregateId(type: AggregateType, id: string): Promise<boolean> {
  switch (type) {
    case "ordering":
      return (ORDERING_KEYS as readonly string[]).includes(id);
    case "menu":
      return MENU_SLOTS.some((slot) => slot.key === id);
    case "site_settings":
      return id === "site";
    default:
      return ULID.test(id);
  }
}

const changeOf = (context: { deps: PublishingChange["deps"]; actor: PublishingChange["actor"]; meta: PublishingChange["meta"] }): PublishingChange => ({
  deps: { pool: context.deps.pool, db: context.deps.db, clock: context.deps.clock },
  actor: context.actor,
  meta: context.meta,
});

function stateOf(result: WorkflowResult): ActionState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: [result.summary, ...(result.warnings ?? [])].join(" ") };
    case "stale":
      return failure(STALE_MESSAGE);
    case "not_found":
      return failure(NOT_FOUND);
    case "denied":
      return failure(result.message);
    case "step_up":
      return failure(result.message, { stepUp: true });
    case "refused": {
      const details = [
        ...(result.issues ?? []).filter((i) => i.blocking).map((i) => i.message),
        ...Object.values(result.errors ?? {}),
        ...(result.details ?? []).map((d) => d.message),
      ];
      return failure([result.message, ...details.slice(0, 8)].join(" "));
    }
  }
}

/** One workflow step on an aggregate: the form names `step`, `type`, `id`, `version` and the step's own text. */
export async function workflowAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const step = z.enum(STEPS).safeParse(form.get("step"));
  const type = workflowAggregate(String(form.get("type") ?? ""));
  const ctx = await actionContext(`${type ?? "content"}.${step.success ? step.data : "workflow"}`, { permission: "content.view" });
  if (!ctx.ok) return ctx.state;
  const id = String(form.get("id") ?? "");
  const version = VERSION.safeParse(form.get("version"));
  if (!step.success || !type || !version.success || !(await validAggregateId(type, id))) return failure(NOT_FOUND);
  const change = changeOf(ctx.context);
  const v = version.data;
  const text = (name: string) => (typeof form.get(name) === "string" ? String(form.get(name)) : undefined);
  const result = await guarded(() => {
    switch (step.data) {
      case "submit":
        return submitForReview(change, type, id, v, text("message"));
      case "request_changes":
        return requestChanges(change, type, id, v, text("comment"));
      case "withdraw":
        return withdrawFromReview(change, type, id, v);
      case "publish":
        return publish(change, type, id, v, { message: text("message"), legalReviewer: text("legalReviewer") });
      case "unpublish":
        return unpublish(change, type, id, v);
      case "discard":
        return discardChanges(change, type, id, v);
    }
  });
  return stateOf(result);
}

/** Restore an earlier version into the working copy, or roll the live version back to an earlier published one. */
export async function revisionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const mode = z.enum(["restore", "rollback"]).safeParse(form.get("mode"));
  const type = workflowAggregate(String(form.get("type") ?? ""));
  const ctx = await actionContext(`${type ?? "content"}.${mode.success && mode.data === "rollback" ? "rollback" : "restore_revision"}`, { permission: "content.view" });
  if (!ctx.ok) return ctx.state;
  const id = String(form.get("id") ?? "");
  const revision = String(form.get("revision") ?? "");
  const version = VERSION.safeParse(form.get("version"));
  if (!mode.success || !type || !version.success || !ULID.test(revision) || !(await validAggregateId(type, id))) return failure(NOT_FOUND);
  const change = changeOf(ctx.context);
  const result = await guarded(() =>
    mode.data === "restore"
      ? restoreRevision(change, type, id, revision, version.data)
      : rollback(change, type, id, revision, version.data, { legalReviewer: typeof form.get("legalReviewer") === "string" ? String(form.get("legalReviewer")) : undefined }),
  );
  return stateOf(result);
}

/** The audit log's search (A8.5): kept sealed in a cookie of its own, like the enquiry search — never in an address. */
export async function searchAuditAction(form: FormData): Promise<void> {
  const ctx = await actionContext("audit.search", { permission: "audit.view" });
  if (!ctx.ok) redirect("/admin/audit");
  await keepAuditSearch(ctx.context.actor, cleanSearch(form.get("q")));
  // The address takes the filters only as the log's own parser accepts them (never the search, never raw form values).
  const filters: Record<string, string> = {};
  for (const name of ["outcome", "type", "actor", "action", "from", "to", "size", "entity"]) {
    const value = form.get(name);
    if (typeof value === "string") filters[name] = value;
  }
  redirect(auditAddress(parseAuditQuery(filters, ""), 1));
}

export async function clearAuditSearchAction(): Promise<void> {
  const ctx = await actionContext("audit.search", { permission: "audit.view" });
  if (ctx.ok) await keepAuditSearch(ctx.context.actor, "");
  redirect("/admin/audit");
}
