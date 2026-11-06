/**
 * What every A7 change shares (forms and enquiries): the change context (A3's `contentTransaction` deps, the actor and
 * the request), the result kinds, the audit event — keys, states, references and counts only: never a visitor's name,
 * email, phone, message or file name, never a note's text (A1-SECURITY-RBAC §9: "full enquiry message bodies" are never
 * logged) — and refusals. Enquiries are PRIVATE: an enquiry's audit label is its reference (Q-YYYY-NNNNN), never a name.
 */
import { z } from "zod";
import { recordAudit, type AuditOutcome } from "../audit/audit.ts";
import { auditActorOf, type Actor, type RequestMeta } from "../auth/types.ts";
import type { Db } from "../db/client.ts";
import type { CmsDeps } from "../cms/store.ts";

export interface FormsChange {
  deps: CmsDeps;
  actor: Actor;
  meta: RequestMeta;
}

export interface Issue {
  path: string;
  message: string;
}

export type Result<T extends object = object> =
  | ({ kind: "ok"; summary: string } & T)
  | { kind: "invalid"; message: string; issues: Issue[] }
  | { kind: "stale"; message: string }
  | { kind: "not_found" }
  | { kind: "denied"; message: string };

export const INVALID = "Some fields need attention. Nothing was saved.";
export const STALE_FORM = "This form changed after you opened it. Reload and review the latest version before saving.";
export const STALE_ENQUIRY = "This enquiry changed after you opened it. Reload and review the latest version before changing it.";

export const versionSchema = z.number().int().min(0).max(2_147_483_647);

export type FormsEntity = "form" | "enquiry" | "enquiry_file" | "enquiry_export" | "enquiry_retention" | "email_outbox";

export interface FormsEvent {
  action: string;
  type: FormsEntity;
  id: string;
  label?: string | null;
  outcome?: AuditOutcome;
  summary: string;
  changes?: Record<string, unknown>;
}

export async function formsAudit(db: Db, change: FormsChange, at: Date, event: FormsEvent): Promise<void> {
  await recordAudit(db, {
    at,
    requestId: change.meta.requestId,
    actor: auditActorOf(change.actor),
    ip: change.meta.ip,
    action: event.action,
    entity: { type: event.type, id: event.id, label: event.label ? event.label.slice(0, 120) : null },
    outcome: event.outcome ?? "success",
    summary: event.summary.slice(0, 500),
    changes: event.changes,
  });
}

/** A refused change: audited as denied, the person told why. */
export async function refuse(db: Db, change: FormsChange, at: Date, event: Omit<FormsEvent, "outcome" | "summary">, message: string): Promise<{ kind: "denied"; message: string }> {
  await formsAudit(db, change, at, { ...event, outcome: "denied", summary: `Refused: ${message}` });
  return { kind: "denied", message };
}

/** A stale change: audited as failed (the version the page showed, the stored one). */
export async function stale(db: Db, change: FormsChange, at: Date, event: Omit<FormsEvent, "outcome" | "summary">, expected: number, stored: number, message: string): Promise<{ kind: "stale"; message: string }> {
  await formsAudit(db, change, at, { ...event, outcome: "failed", summary: `Refused: changed after it was opened (version ${expected}, now ${stored}).` });
  return { kind: "stale", message };
}

/** Zod issues as form issues (the path joined with dots, as the forms name their fields). */
export const zodIssues = (error: z.ZodError): Issue[] => error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));

/** Positions are renumbered through a free range first, so a unique (owner, position) index never meets itself. */
export const FREE_RANGE = 1_000_000;
