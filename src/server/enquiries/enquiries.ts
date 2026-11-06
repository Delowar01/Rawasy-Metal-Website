/**
 * The enquiry inbox (A7.2–A7.4): PRIVATE stored submissions, their workflow, assignment and internal notes.
 *
 * - Read: `enquiries.view` (Owner, Admin); change: `enquiries.manage` (Owner, Admin) — re-decided in the transaction
 *   (A3's `contentTransaction`: the acting user and session locked first, then the enquiry FOR UPDATE).
 * - The workflow is the registry's (`TRANSITIONS`): New → Open → Answered → Closed, reopening, and closing without an
 *   answer with a reason. A status change and an assignment are decided on the enquiry's version as its page showed it
 *   (stale: refused, audited `failed`); a note is added whatever changed meanwhile (it overwrites nothing).
 * - An enquiry is assigned only to an active person who may manage enquiries now (their roles read under lock).
 * - Every change is audited with the enquiry's reference as its label — never a visitor's name, address or message, and
 *   never a note's text (A1-SECURITY-RBAC §9).
 * - Lists: server-side, filtered and sorted by fixed maps, searched with bound parameters (reference, name, email,
 *   company, phone), 25 a page by default; anonymized enquiries show no personal data; deleted ones are not listed.
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { enquiryNotes, enquiryStatusHistory } from "../db/schema-forms.ts";
import { contentTransaction, dateOnly, instantOf, rowsOf } from "../cms/store.ts";
import { likePattern, plainText } from "../cms/text.ts";
import { permissionsOf } from "../policy/registry.ts";
import { ulid } from "../security/ids.ts";
import { formsAudit, INVALID, refuse, stale, STALE_ENQUIRY, versionSchema, zodIssues, type FormsChange, type Result } from "../forms/common.ts";
import { ENQUIRY_LIMITS, ENQUIRY_STATUSES, STATUS_LABELS, transitionOf, type EnquiryStatus } from "../forms/registry.ts";
import { staticFieldTexts } from "../forms/copy.ts";
import { fieldDefinition } from "../forms/registry.ts";
import { latinDigits } from "./validate.ts";

/** A project type's words (today's English label, as the inbox and the export show it); an unknown key as stored. */
export function projectTypeLabel(key: string): string {
  const field = fieldDefinition("projectType");
  return (key && field && staticFieldTexts(field, "en").optionLabels[key]) || key;
}

/**
 * The enquiry page's Email link: the address's own characters percent-encoded on each side of its last "@", so nothing
 * a visitor typed becomes a mailto parameter (`?bcc=…`, `&body=…`; security review L2).
 */
export function mailtoHref(email: string): string {
  const at = email.lastIndexOf("@");
  return at > 0 ? `mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}` : `mailto:${encodeURIComponent(email)}`;
}

/** The enquiry page's Phone link: digits of any script dialled as Latin digits, the plus kept, nothing else. */
export const telHref = (phone: string) => `tel:${latinDigits(phone).replace(/[^\d+]/g, "")}`;

// --- Lists ------------------------------------------------------------------------------------------------------------

export const SORTS = { newest: "e.submitted_at DESC, e.id DESC", oldest: "e.submitted_at ASC, e.id ASC", reference: "e.reference DESC", status: "FIELD(e.status, 'new', 'open', 'answered', 'closed'), e.submitted_at DESC" } as const;
export type EnquirySort = keyof typeof SORTS;

export interface EnquiryQuery {
  q: string;
  status: EnquiryStatus | "all" | "active";
  assigned: "all" | "me" | "none";
  sort: EnquirySort;
  page: number;
  size: number;
}

export const DEFAULT_QUERY: EnquiryQuery = { q: "", status: "all", assigned: "all", sort: "newest", page: 1, size: ENQUIRY_LIMITS.pageSize.default };

/** A list address's query, read leniently (an unknown value falls back to the default). */
export function parseQuery(params: Record<string, string | string[] | undefined>): EnquiryQuery {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]) ?? "";
  const status = one("status");
  const assigned = one("assigned");
  const sort = one("sort");
  const size = Number(one("size"));
  const page = Number(one("page"));
  return {
    q: [...one("q").trim()].slice(0, ENQUIRY_LIMITS.search).join(""),
    status: (["all", "active", ...ENQUIRY_STATUSES] as string[]).includes(status) ? (status as EnquiryQuery["status"]) : "all",
    assigned: assigned === "me" || assigned === "none" ? assigned : "all",
    // Own keys only: `in` also accepts Object.prototype's names ("constructor"), whose text would reach `sql.raw`.
    sort: Object.hasOwn(SORTS, sort) ? (sort as EnquirySort) : "newest",
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
    size: Number.isInteger(size) && size >= ENQUIRY_LIMITS.pageSize.min && size <= ENQUIRY_LIMITS.pageSize.max ? size : ENQUIRY_LIMITS.pageSize.default,
  };
}

export interface EnquiryRow {
  id: string;
  reference: string;
  status: EnquiryStatus;
  submittedAt: Date | null;
  locale: string;
  fullName: string;
  company: string;
  email: string;
  serviceLabel: string;
  assignedName: string | null;
  files: number;
  anonymized: boolean;
}

/** The WHERE clause of a list query (bound parameters only). */
function whereOf(query: EnquiryQuery, actorId: string): SQL {
  const parts: SQL[] = [sql`e.deleted_at IS NULL`];
  if (query.status === "active") parts.push(sql`e.status IN ('new', 'open', 'answered')`);
  else if (query.status !== "all") parts.push(sql`e.status = ${query.status}`);
  if (query.assigned === "me") parts.push(sql`e.assigned_to = ${actorId}`);
  if (query.assigned === "none") parts.push(sql`e.assigned_to IS NULL`);
  if (query.q) {
    const pattern = likePattern(query.q);
    const ascii = /^[\x20-\x7e]+$/.test(query.q);
    const text = sql`(e.full_name LIKE ${pattern} OR e.company LIKE ${pattern} OR e.email LIKE ${pattern} OR e.phone LIKE ${pattern})`;
    parts.push(ascii ? sql`(e.reference LIKE ${likePattern(query.q.toUpperCase())} OR ${text})` : text);
  }
  return sql.join(parts, sql` AND `);
}

export async function listEnquiries(db: Db, query: EnquiryQuery, actorId: string): Promise<{ rows: EnquiryRow[]; total: number; pages: number }> {
  const where = whereOf(query, actorId);
  const [{ total }] = await rowsOf<{ total: number }>(db, sql`SELECT COUNT(*) AS total FROM enquiries e WHERE ${where}`);
  const pages = Math.max(1, Math.ceil(Number(total) / query.size));
  const page = Math.min(query.page, pages);
  const rows = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT e.id, e.reference, e.status, e.submitted_at, e.locale, e.full_name, e.company, e.email, e.service_label, e.anonymized_at,
               u.display_name AS assigned_name,
               (SELECT COUNT(*) FROM enquiry_files f WHERE f.enquiry_id = e.id) AS files
        FROM enquiries e LEFT JOIN users u ON u.id = e.assigned_to
        WHERE ${where}
        ORDER BY ${sql.raw(SORTS[query.sort])}
        LIMIT ${query.size} OFFSET ${(page - 1) * query.size}`,
  );
  return {
    total: Number(total),
    pages,
    rows: rows.map((r) => ({
      id: String(r.id),
      reference: String(r.reference),
      status: String(r.status) as EnquiryStatus,
      submittedAt: instantOf(r.submitted_at),
      locale: String(r.locale),
      fullName: String(r.full_name ?? ""),
      company: String(r.company ?? ""),
      email: String(r.email ?? ""),
      serviceLabel: String(r.service_label ?? ""),
      assignedName: r.assigned_name ? String(r.assigned_name) : null,
      files: Number(r.files),
      anonymized: r.anonymized_at !== null && r.anonymized_at !== undefined,
    })),
  };
}

export interface EnquirySummary {
  byStatus: Record<EnquiryStatus, number>;
  unassigned: number;
  mine: number;
  lastSevenDays: number;
  total: number;
}

/** The inbox's summary indicators. */
export async function enquirySummary(db: Db, actorId: string, now: Date): Promise<EnquirySummary> {
  const rows = await rowsOf<{ status: string; n: number }>(db, sql`SELECT status, COUNT(*) AS n FROM enquiries WHERE deleted_at IS NULL GROUP BY status`);
  const byStatus = Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, 0])) as Record<EnquiryStatus, number>;
  for (const r of rows) if ((ENQUIRY_STATUSES as readonly string[]).includes(r.status)) byStatus[r.status as EnquiryStatus] = Number(r.n);
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const [counts] = await rowsOf<{ unassigned: number; mine: number; recent: number }>(
    db,
    sql`SELECT SUM(status IN ('new', 'open', 'answered') AND assigned_to IS NULL) AS unassigned,
               SUM(status IN ('new', 'open', 'answered') AND assigned_to = ${actorId}) AS mine,
               SUM(submitted_at >= ${week}) AS recent
        FROM enquiries WHERE deleted_at IS NULL`,
  );
  return {
    byStatus,
    unassigned: Number(counts?.unassigned ?? 0),
    mine: Number(counts?.mine ?? 0),
    lastSevenDays: Number(counts?.recent ?? 0),
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
  };
}

// --- Detail -----------------------------------------------------------------------------------------------------------

export interface EnquiryDetail {
  id: string;
  reference: string;
  formKey: string;
  locale: string;
  status: EnquiryStatus;
  lockVersion: number;
  submittedAt: Date | null;
  sourcePath: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  serviceLabel: string;
  projectType: string;
  requirement: string;
  projectLocation: string;
  message: string;
  consentAt: Date | null;
  notificationStatus: string;
  retainUntil: string | null;
  anonymizedAt: Date | null;
  closedAt: Date | null;
  assignedTo: string | null;
  assignedName: string | null;
  files: { id: string; name: string; mime: string; extension: string; size: number }[];
  notes: { id: string; body: string; author: string | null; at: Date | null }[];
  history: { from: EnquiryStatus | null; to: EnquiryStatus; at: Date | null; by: string | null; note: string | null }[];
  assignments: { at: Date | null; by: string | null; summary: string }[];
  outbox: { id: string; to: string; status: string; attempts: number; nextAttemptAt: Date | null; lastError: string | null; sentAt: Date | null }[];
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** One enquiry with its files, notes, status history, assignment events and notifications; null when unknown or deleted. */
export async function readEnquiry(db: Db, id: string): Promise<EnquiryDetail | null> {
  const [r] = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT e.*, f.\`key\` AS form_key, u.display_name AS assigned_name
        FROM enquiries e JOIN forms f ON f.id = e.form_id LEFT JOIN users u ON u.id = e.assigned_to
        WHERE e.id = ${id} AND e.deleted_at IS NULL`,
  );
  if (!r) return null;
  const files = await rowsOf<Record<string, unknown>>(db, sql`SELECT id, original_filename, mime_type, extension, byte_size FROM enquiry_files WHERE enquiry_id = ${id} ORDER BY created_at, id`);
  const notes = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT n.id, n.body, n.created_at, u.display_name FROM enquiry_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.enquiry_id = ${id} ORDER BY n.created_at, n.id`,
  );
  const history = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT h.from_status, h.to_status, h.changed_at, h.note, u.display_name FROM enquiry_status_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.enquiry_id = ${id} ORDER BY h.changed_at, h.id`,
  );
  const assignments = await rowsOf<Record<string, unknown>>(
    db,
    // Who assigned: the person's name as the rest of the history shows it (the audit label also carries the email).
    sql`SELECT a.occurred_at, u.display_name, a.summary FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.entity_type = 'enquiry' AND a.entity_id = ${id} AND a.action = 'enquiry.assign' AND a.outcome = 'success' ORDER BY a.occurred_at, a.id`,
  );
  const outbox = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT id, to_address, status, attempts, next_attempt_at, last_error, sent_at FROM email_outbox WHERE related_type = 'enquiry' AND related_id = ${id} ORDER BY created_at, id`,
  );
  return {
    id,
    reference: s(r.reference),
    formKey: s(r.form_key),
    locale: s(r.locale),
    status: s(r.status) as EnquiryStatus,
    lockVersion: Number(r.lock_version),
    submittedAt: instantOf(r.submitted_at),
    sourcePath: s(r.source_path),
    fullName: s(r.full_name),
    company: s(r.company),
    email: s(r.email),
    phone: s(r.phone),
    serviceLabel: s(r.service_label),
    projectType: s(r.project_type),
    requirement: s(r.requirement),
    projectLocation: s(r.project_location),
    message: s(r.message),
    consentAt: instantOf(r.consent_at),
    notificationStatus: s(r.notification_status),
    retainUntil: dateOnly(r.retain_until),
    anonymizedAt: instantOf(r.anonymized_at),
    closedAt: instantOf(r.closed_at),
    assignedTo: r.assigned_to ? s(r.assigned_to) : null,
    assignedName: r.assigned_name ? s(r.assigned_name) : null,
    files: files.map((f) => ({ id: s(f.id), name: s(f.original_filename), mime: s(f.mime_type), extension: s(f.extension), size: Number(f.byte_size) })),
    notes: notes.map((n) => ({ id: s(n.id), body: s(n.body), author: n.display_name ? s(n.display_name) : null, at: instantOf(n.created_at) })),
    history: history.map((h) => ({
      from: h.from_status ? (s(h.from_status) as EnquiryStatus) : null,
      to: s(h.to_status) as EnquiryStatus,
      at: instantOf(h.changed_at),
      by: h.display_name ? s(h.display_name) : null,
      note: h.note ? s(h.note) : null,
    })),
    assignments: assignments.map((a) => ({ at: instantOf(a.occurred_at), by: a.display_name ? s(a.display_name) : null, summary: s(a.summary) })),
    outbox: outbox.map((o) => ({
      id: s(o.id),
      to: s(o.to_address),
      status: s(o.status),
      attempts: Number(o.attempts),
      nextAttemptAt: instantOf(o.next_attempt_at),
      lastError: o.last_error ? s(o.last_error) : null,
      sentAt: instantOf(o.sent_at),
    })),
  };
}

/** People an enquiry may be assigned to: active, not removed, holding `enquiries.manage` through their roles. */
export async function assignableUsers(db: Db): Promise<{ id: string; name: string }[]> {
  const rows = await rowsOf<{ id: string; display_name: string; roles: string | null }>(
    db,
    sql`SELECT u.id, u.display_name, GROUP_CONCAT(r.role_key) AS roles FROM users u JOIN user_roles r ON r.user_id = u.id
        WHERE u.status = 'active' AND u.deleted_at IS NULL GROUP BY u.id, u.display_name ORDER BY u.display_name, u.id`,
  );
  return rows.filter((r) => permissionsOf(String(r.roles ?? "").split(",")).has("enquiries.manage")).map((r) => ({ id: String(r.id), name: String(r.display_name) }));
}

// --- Changes ----------------------------------------------------------------------------------------------------------

interface LockedEnquiry {
  reference: string;
  status: EnquiryStatus;
  lockVersion: number;
  assignedTo: string | null;
  anonymized: boolean;
}

async function lockEnquiry(tx: Db, id: string): Promise<LockedEnquiry | null> {
  const [row] = await rowsOf<{ reference: string; status: string; lock_version: number; assigned_to: string | null; anonymized_at: unknown }>(
    tx,
    sql`SELECT reference, status, lock_version, assigned_to, anonymized_at FROM enquiries WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`,
  );
  return row
    ? { reference: String(row.reference), status: String(row.status) as EnquiryStatus, lockVersion: Number(row.lock_version), assignedTo: row.assigned_to ? String(row.assigned_to) : null, anonymized: row.anonymized_at !== null && row.anonymized_at !== undefined }
    : null;
}

const event = (id: string, reference: string, action: string) => ({ action, type: "enquiry" as const, id, label: reference });

export const statusInputSchema = z
  .object({
    expectedVersion: versionSchema,
    to: z.enum(ENQUIRY_STATUSES),
    note: plainText(ENQUIRY_LIMITS.transitionNote),
  })
  .strict();

/** Moves an enquiry along the workflow, decided on the version its page showed. */
export async function changeStatus(change: FormsChange, id: string, raw: unknown): Promise<Result<{ lockVersion: number }>> {
  const parsed = statusInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: zodIssues(parsed.error) };
  const input = parsed.data;
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<Result<{ lockVersion: number }>> => {
    const locked = await lockEnquiry(tx, id);
    if (!locked) return { kind: "not_found" };
    const ev = event(id, locked.reference, "enquiry.status");
    if (!actor.permissions.has("enquiries.manage")) return refuse(tx, change, now, ev, "Changing an enquiry's status needs a permission you don't hold.");
    if (locked.lockVersion !== input.expectedVersion) return stale(tx, change, now, ev, input.expectedVersion, locked.lockVersion, STALE_ENQUIRY);
    const transition = transitionOf(locked.status, input.to);
    if (!transition) {
      await formsAudit(tx, change, now, { ...ev, outcome: "failed", summary: `Refused: ${STATUS_LABELS[locked.status]} → ${STATUS_LABELS[input.to]} is not a step of the workflow.` });
      return { kind: "invalid", message: `An enquiry that is ${STATUS_LABELS[locked.status].toLowerCase()} can't become ${STATUS_LABELS[input.to].toLowerCase()}.`, issues: [{ path: "to", message: "Not a step of the workflow." }] };
    }
    if (transition.noteRequired && !input.note) return { kind: "invalid", message: INVALID, issues: [{ path: "note", message: "Say why it is closed without an answer." }] };
    await tx.execute(
      sql`UPDATE enquiries SET status = ${input.to}, closed_at = ${input.to === "closed" ? now : null}, lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actor.user.id} WHERE id = ${id}`,
    );
    await tx.insert(enquiryStatusHistory).values({ enquiryId: id, fromStatus: locked.status, toStatus: input.to, changedAt: now, changedBy: actor.user.id, note: input.note || null });
    await formsAudit(tx, change, now, {
      ...ev,
      summary: `${STATUS_LABELS[locked.status]} → ${STATUS_LABELS[input.to]}${input.note ? " (with a reason)" : ""}.`,
      changes: { from: locked.status, to: input.to, reason: Boolean(input.note) },
    });
    return { kind: "ok", lockVersion: locked.lockVersion + 1, summary: `Now ${STATUS_LABELS[input.to].toLowerCase()}.` };
  });
}

export const assignInputSchema = z
  .object({
    expectedVersion: versionSchema,
    assignee: z.union([z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/), z.literal("")]),
  })
  .strict();

/** Assigns an enquiry (or clears its assignment), decided on the version its page showed. */
export async function assignEnquiry(change: FormsChange, id: string, raw: unknown): Promise<Result<{ lockVersion: number }>> {
  const parsed = assignInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: zodIssues(parsed.error) };
  const input = parsed.data;
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<Result<{ lockVersion: number }>> => {
    const locked = await lockEnquiry(tx, id);
    if (!locked) return { kind: "not_found" };
    const ev = event(id, locked.reference, "enquiry.assign");
    if (!actor.permissions.has("enquiries.manage")) return refuse(tx, change, now, ev, "Assigning an enquiry needs a permission you don't hold.");
    if (locked.lockVersion !== input.expectedVersion) return stale(tx, change, now, ev, input.expectedVersion, locked.lockVersion, STALE_ENQUIRY);
    const assignee = input.assignee || null;
    let name = "nobody";
    if (assignee) {
      const [user] = await rowsOf<{ display_name: string; status: string; deleted_at: unknown }>(
        tx,
        sql`SELECT display_name, status, deleted_at FROM users WHERE id = ${assignee} LOCK IN SHARE MODE`,
      );
      const roles = user ? (await rowsOf<{ role_key: string }>(tx, sql`SELECT role_key FROM user_roles WHERE user_id = ${assignee} LOCK IN SHARE MODE`)).map((r) => r.role_key) : [];
      if (!user || user.status !== "active" || user.deleted_at || !permissionsOf(roles).has("enquiries.manage")) {
        await formsAudit(tx, change, now, { ...ev, outcome: "failed", summary: "Refused: the chosen person can't handle enquiries." });
        return { kind: "invalid", message: "That person can't handle enquiries (not active, or without the permission). Choose someone else.", issues: [{ path: "assignee", message: "Choose someone who can handle enquiries." }] };
      }
      name = String(user.display_name);
    }
    if (assignee === locked.assignedTo) return { kind: "ok", lockVersion: locked.lockVersion, summary: "No change." };
    await tx.execute(sql`UPDATE enquiries SET assigned_to = ${assignee}, lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actor.user.id} WHERE id = ${id}`);
    await formsAudit(tx, change, now, { ...ev, summary: assignee ? `Assigned to ${name}.` : "Assignment cleared.", changes: { assignee } });
    return { kind: "ok", lockVersion: locked.lockVersion + 1, summary: assignee ? `Assigned to ${name}.` : "No one is assigned now." };
  });
}

export const noteInputSchema = z.object({ body: plainText(ENQUIRY_LIMITS.note, { multiline: true }) }).strict();

/** Adds an internal note (plain text). */
export async function addNote(change: FormsChange, id: string, raw: unknown): Promise<Result<{ noteId: string }>> {
  const parsed = noteInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: zodIssues(parsed.error) };
  if (!parsed.data.body) return { kind: "invalid", message: INVALID, issues: [{ path: "body", message: "Write the note first." }] };
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<Result<{ noteId: string }>> => {
    const locked = await lockEnquiry(tx, id);
    if (!locked) return { kind: "not_found" };
    const ev = event(id, locked.reference, "enquiry.note");
    if (!actor.permissions.has("enquiries.manage")) return refuse(tx, change, now, ev, "Adding a note needs a permission you don't hold.");
    if (locked.anonymized) return refuse(tx, change, now, ev, "This enquiry was anonymized: nothing can be added to it.");
    const noteId = ulid(now.getTime());
    await tx.insert(enquiryNotes).values({ id: noteId, enquiryId: id, authorId: actor.user.id, body: parsed.data.body, createdAt: now });
    await formsAudit(tx, change, now, { ...ev, summary: `Added a note (${[...parsed.data.body].length} characters).`, changes: { note: noteId } });
    return { kind: "ok", noteId, summary: "Note added." };
  });
}
