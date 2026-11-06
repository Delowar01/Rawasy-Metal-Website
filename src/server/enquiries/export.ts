/**
 * CSV export of enquiries (A7.8): `enquiries.export` (the Owner alone, A1-SECURITY-RBAC §5.3) and a step-up within the
 * last 10 minutes (a sensitive permission), the inbox's own filters, at most 5,000 rows a file. Audited with the count
 * and the filters — never a value.
 *
 * Every cell is quoted (RFC 4180: doubled quotes, CRLF rows) and a text that a spreadsheet would read as a formula —
 * starting with `=`, `+`, `-`, `@`, a tab or a carriage return, after any leading spaces — is prefixed with an
 * apostrophe, so a visitor's "=HYPERLINK(…)" is shown as text, never run (OWASP "CSV injection"). A byte-order mark
 * lets spreadsheet apps read the Arabic text as UTF-8. Anonymized enquiries export no personal data.
 */
import { sql } from "drizzle-orm";
import { isRecentlyAuthenticated } from "../auth/sessions.ts";
import type { Db } from "../db/client.ts";
import { instantOf, rowsOf } from "../cms/store.ts";
import { formsAudit, refuse, type FormsChange } from "../forms/common.ts";
import { ENQUIRY_LIMITS, STATUS_LABELS, type EnquiryStatus } from "../forms/registry.ts";
import { SORTS, type EnquiryQuery, projectTypeLabel } from "./enquiries.ts";
import { likePattern } from "../cms/text.ts";

/** A cell as a spreadsheet must read it: text, never a formula. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");

export const EXPORT_COLUMNS = [
  "Reference",
  "Status",
  "Received (UTC)",
  "Language",
  "Full name",
  "Company",
  "Email",
  "Phone",
  "Service",
  "Project type",
  "Estimated requirement",
  "Project location",
  "Project details",
  "Assigned to",
  "Files",
  "Closed (UTC)",
] as const;

export type ExportResult = { kind: "ok"; filename: string; csv: string; rows: number; truncated: boolean } | { kind: "denied"; message: string } | { kind: "step_up"; message: string };

export async function exportEnquiries(change: FormsChange, query: EnquiryQuery): Promise<ExportResult> {
  const { deps, actor } = change;
  const now = deps.clock();
  const ev = { action: "enquiry.export", type: "enquiry_export" as const, id: "enquiries", label: "Enquiries (CSV)" };
  if (!actor.permissions.has("enquiries.export")) return refuse(deps.db, change, now, ev, "Exporting enquiries is the Owner's.");
  if (!isRecentlyAuthenticated(actor.session, now)) {
    await formsAudit(deps.db, change, now, { ...ev, outcome: "denied", summary: "Refused: exporting enquiries needs a step-up within the last 10 minutes." });
    return { kind: "step_up", message: "Confirm your identity first (valid for 10 minutes), then export again." };
  }
  const rows = await exportRows(deps.db, query, actor.user.id);
  const truncated = rows.length > ENQUIRY_LIMITS.exportRows;
  const kept = rows.slice(0, ENQUIRY_LIMITS.exportRows);
  const csv = "\ufeff" + [csvRow([...EXPORT_COLUMNS]), ...kept.map((r) => csvRow(r))].join("\r\n") + "\r\n";
  await formsAudit(deps.db, change, now, {
    ...ev,
    summary: `Exported ${kept.length} enquir${kept.length === 1 ? "y" : "ies"} as CSV${truncated ? " (the first 5,000)" : ""}.`,
    changes: { rows: kept.length, status: query.status, assigned: query.assigned, search: Boolean(query.q), sort: query.sort },
  });
  const stamp = now.toISOString().slice(0, 10);
  return { kind: "ok", filename: `rawasy-enquiries-${stamp}.csv`, csv, rows: kept.length, truncated };
}

async function exportRows(db: Db, query: EnquiryQuery, actorId: string): Promise<unknown[][]> {
  const parts = [sql`e.deleted_at IS NULL`];
  if (query.status === "active") parts.push(sql`e.status IN ('new', 'open', 'answered')`);
  else if (query.status !== "all") parts.push(sql`e.status = ${query.status}`);
  if (query.assigned === "me") parts.push(sql`e.assigned_to = ${actorId}`);
  if (query.assigned === "none") parts.push(sql`e.assigned_to IS NULL`);
  if (query.q) {
    const pattern = likePattern(query.q);
    const text = sql`(e.full_name LIKE ${pattern} OR e.company LIKE ${pattern} OR e.email LIKE ${pattern} OR e.phone LIKE ${pattern})`;
    parts.push(/^[\x20-\x7e]+$/.test(query.q) ? sql`(e.reference LIKE ${likePattern(query.q.toUpperCase())} OR ${text})` : text);
  }
  const rows = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT e.reference, e.status, e.submitted_at, e.locale, e.full_name, e.company, e.email, e.phone, e.service_label, e.project_type,
               e.requirement, e.project_location, e.message, e.closed_at, e.anonymized_at, u.display_name AS assigned_name,
               (SELECT COUNT(*) FROM enquiry_files f WHERE f.enquiry_id = e.id) AS files
        FROM enquiries e LEFT JOIN users u ON u.id = e.assigned_to
        WHERE ${sql.join(parts, sql` AND `)}
        ORDER BY ${sql.raw(SORTS[query.sort])}
        LIMIT ${ENQUIRY_LIMITS.exportRows + 1}`,
  );
  const iso = (v: unknown) => instantOf(v)?.toISOString().replace("T", " ").slice(0, 19) ?? "";
  return rows.map((r) => {
    const gone = r.anonymized_at !== null && r.anonymized_at !== undefined;
    const personal = (v: unknown) => (gone ? "" : (v ?? ""));
    return [
      r.reference,
      STATUS_LABELS[String(r.status) as EnquiryStatus] ?? r.status,
      iso(r.submitted_at),
      r.locale === "ar" ? "Arabic" : "English",
      gone ? "(anonymized)" : personal(r.full_name),
      personal(r.company),
      personal(r.email),
      personal(r.phone),
      r.service_label ?? "",
      projectTypeLabel(String(r.project_type ?? "")),
      personal(r.requirement),
      personal(r.project_location),
      personal(r.message),
      r.assigned_name ?? "",
      Number(r.files),
      iso(r.closed_at),
    ];
  });
}
