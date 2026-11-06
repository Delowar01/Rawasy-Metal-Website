"use server";
/**
 * Server Actions of forms and enquiries (A7). Each starts with the admin's own checks — the gate, the session, the
 * request's origin and the permission (`actionContext`, refusals audited) — before it reads its input, then hands the
 * change to the A7 services (`src/server/forms/`, `src/server/enquiries/`), which decide the permission again inside
 * their transaction, lock the record, check the version the page showed, validate everything and audit the outcome
 * (references and keys only, never personal data). The CSV export needs `enquiries.export` (the Owner) and a step-up
 * within 10 minutes (a sensitive permission); its file is returned to the page, never stored.
 *
 * No action here receives a public submission: the website's quote form stays today's handoff form, and the prepared
 * submission service (`src/server/enquiries/submission.ts`) is called by nothing in the build (A7 brief §6).
 */
import { actionContext, type ActionContext } from "../guards";
import { guarded } from "../context";
import type { FormsChange, Result } from "@/server/forms/common";
import { saveForm, setUpForm } from "@/server/forms/forms";
import { addNote, assignEnquiry, changeStatus, parseQuery } from "@/server/enquiries/enquiries";
import { exportEnquiries } from "@/server/enquiries/export";
import { retryNotification } from "@/server/enquiries/outbox";
import type { ExportState, FormsActionState } from "./forms-model";

const changeOf = (context: ActionContext): FormsChange => ({
  deps: { pool: context.deps.pool, db: context.deps.db, clock: context.deps.clock },
  actor: context.actor,
  meta: context.meta,
});

const NOT_FOUND = "This item no longer exists. Reload the page.";
const ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function stateOf(result: Result<{ lockVersion?: number }>): FormsActionState {
  switch (result.kind) {
    case "ok":
      return { status: "ok", message: result.summary, ...(typeof result.lockVersion === "number" ? { lockVersion: result.lockVersion } : {}) };
    case "invalid":
      return { status: "error", message: result.message, issues: result.issues };
    case "stale":
      return { status: "error", message: result.message, issues: [], stale: true };
    case "denied":
      return { status: "error", message: result.message, issues: [] };
    case "not_found":
      return { status: "error", message: NOT_FOUND, issues: [] };
  }
}

const refusal = (state: { message?: string; stepUp?: boolean }): FormsActionState => ({
  status: "error",
  message: state.message ?? "This request was refused.",
  issues: [],
  ...(state.stepUp ? { stepUp: true as const } : {}),
});

async function run(action: string, permission: string, id: unknown, work: (change: FormsChange, id: string) => Promise<Result<{ lockVersion?: number }>>): Promise<FormsActionState> {
  const ctx = await actionContext(action, { permission });
  if (!ctx.ok) return refusal(ctx.state);
  if (typeof id !== "string" || !ID.test(id)) return { status: "error", message: NOT_FOUND, issues: [] };
  return stateOf(await guarded(() => work(changeOf(ctx.context), id)));
}

export async function setUpFormAction(id: string): Promise<FormsActionState> {
  return run("form.setup", "forms.edit", id, (change, formId) => setUpForm(change, formId));
}

export async function saveFormAction(id: string, input: unknown): Promise<FormsActionState> {
  return run("form.update", "forms.edit", id, (change, formId) => saveForm(change, formId, input));
}

export async function changeEnquiryStatusAction(id: string, input: unknown): Promise<FormsActionState> {
  return run("enquiry.status", "enquiries.manage", id, (change, enquiryId) => changeStatus(change, enquiryId, input));
}

export async function assignEnquiryAction(id: string, input: unknown): Promise<FormsActionState> {
  return run("enquiry.assign", "enquiries.manage", id, (change, enquiryId) => assignEnquiry(change, enquiryId, input));
}

export async function addEnquiryNoteAction(id: string, input: unknown): Promise<FormsActionState> {
  return run("enquiry.note", "enquiries.manage", id, (change, enquiryId) => addNote(change, enquiryId, input));
}

export async function retryNotificationAction(outboxId: string): Promise<FormsActionState> {
  return run("enquiry.notification_retry", "enquiries.manage", outboxId, (change, id) => retryNotification(change, id));
}

/** The CSV of the inbox's current filters (the Owner, with a step-up). The file comes back to the page to be saved. */
export async function exportEnquiriesAction(params: Record<string, string>): Promise<ExportState> {
  const ctx = await actionContext("enquiry.export", { permission: "enquiries.export" });
  if (!ctx.ok) return { status: "error", message: ctx.state.message ?? "This request was refused.", ...(ctx.state.stepUp ? { stepUp: true as const } : {}) };
  const query = parseQuery(typeof params === "object" && params ? Object.fromEntries(Object.entries(params).filter(([, v]) => typeof v === "string")) : {});
  const result = await guarded(() => exportEnquiries(changeOf(ctx.context), { ...query, page: 1 }));
  if (result.kind === "ok") return { status: "ok", message: `Exported ${result.rows} enquir${result.rows === 1 ? "y" : "ies"}${result.truncated ? " (the first 5,000: narrow the filters for the rest)" : ""}.`, filename: result.filename, csv: result.csv };
  return { status: "error", message: result.message, ...(result.kind === "step_up" ? { stepUp: true as const } : {}) };
}
