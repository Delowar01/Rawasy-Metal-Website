/**
 * Enquiry retention (A7.8; A1-SECURITY-RBAC §2, A1 `enquiries.retain_until`): the mechanism, inactive. No retention
 * period is chosen (A7 brief: a legal period is the Owner's decision, with legal review), nothing runs on a schedule and
 * the admin offers only the plan — which enquiries a period would affect — never the deletion.
 *
 * - `planRetention`: the enquiries past their keep-until date (stored at submission from the form's period, or, for one
 *   received while no period was set, its submission plus the period chosen since). With no period: nothing is due.
 * - `applyRetention`: anonymizes what is due — personal fields emptied (name, company, email, phone, requirement,
 *   location, message, extra answers, address, browser), notes deleted, attachments deleted from disk and their rows
 *   removed, outgoing mail rows' bodies cleared — keeping the reference, dates, status, service and history counts (so
 *   the inbox's numbers stay true). Run only by the CLI with `--apply` (`npm run enquiries:retention`), never by the
 *   website; refused while the form has no period. Each run is audited (counts only).
 */
import { sql } from "drizzle-orm";
import { recordAudit } from "../audit/audit.ts";
import { inTransaction, type Db } from "../db/client.ts";
import { dateOnly, instantOf, rowsOf, type CmsDeps } from "../cms/store.ts";
import type { MediaStore } from "../media/storage.ts";
import { ulid } from "../security/ids.ts";

export interface RetentionPlan {
  formKey: string;
  retentionDays: number | null;
  due: { id: string; reference: string; submittedAt: Date | null; keepUntil: string }[];
}

/** What a retention run would anonymize now (read only). */
export async function planRetention(db: Db, formKey: string, now: Date): Promise<RetentionPlan> {
  const [form] = await rowsOf<{ id: string; retention_days: number | null }>(db, sql`SELECT id, retention_days FROM forms WHERE \`key\` = ${formKey}`);
  const days = form?.retention_days === null || form?.retention_days === undefined ? null : Number(form.retention_days);
  if (!form || days === null) return { formKey, retentionDays: null, due: [] };
  const today = now.toISOString().slice(0, 10);
  const rows = await rowsOf<{ id: string; reference: string; submitted_at: unknown; keep_until: unknown }>(
    db,
    sql`SELECT id, reference, submitted_at, COALESCE(retain_until, DATE(DATE_ADD(submitted_at, INTERVAL ${days} DAY))) AS keep_until
        FROM enquiries
        WHERE form_id = ${form.id} AND deleted_at IS NULL AND anonymized_at IS NULL
          AND COALESCE(retain_until, DATE(DATE_ADD(submitted_at, INTERVAL ${days} DAY))) < ${today}
        ORDER BY submitted_at, id`,
  );
  return { formKey, retentionDays: days, due: rows.map((r) => ({ id: String(r.id), reference: String(r.reference), submittedAt: instantOf(r.submitted_at), keepUntil: dateOnly(r.keep_until) ?? "" })) };
}

export type RetentionRun = { kind: "no_period" } | { kind: "done"; anonymized: number; files: number };

/** Anonymizes what is due (the CLI's `--apply`), one enquiry per transaction; files are removed after each commit. */
export async function applyRetention(deps: CmsDeps, store: MediaStore | null, formKey: string, operator: string): Promise<RetentionRun> {
  const now = deps.clock();
  const plan = await planRetention(deps.db, formKey, now);
  if (plan.retentionDays === null) return { kind: "no_period" };
  let anonymized = 0;
  let files = 0;
  for (const item of plan.due) {
    const keys = await inTransaction(deps.pool, async (tx) => {
      const [row] = await rowsOf<{ anonymized_at: unknown }>(tx, sql`SELECT anonymized_at FROM enquiries WHERE id = ${item.id} AND deleted_at IS NULL FOR UPDATE`);
      if (!row || row.anonymized_at) return null;
      const stored = await rowsOf<{ storage_key: string }>(tx, sql`SELECT storage_key FROM enquiry_files WHERE enquiry_id = ${item.id}`);
      await tx.execute(
        sql`UPDATE enquiries SET full_name = '', company = NULL, email = '', phone = NULL, requirement = NULL, project_location = NULL, message = '',
                   extra = NULL, ip = NULL, user_agent = NULL, anonymized_at = ${now}, lock_version = lock_version + 1, updated_at = ${now}, updated_by = NULL
            WHERE id = ${item.id}`,
      );
      await tx.execute(sql`DELETE FROM enquiry_notes WHERE enquiry_id = ${item.id}`);
      await tx.execute(sql`DELETE FROM enquiry_files WHERE enquiry_id = ${item.id}`);
      await tx.execute(sql`UPDATE email_outbox SET body_text = NULL WHERE related_type = 'enquiry' AND related_id = ${item.id}`);
      return stored.map((f) => String(f.storage_key));
    });
    if (keys === null) continue;
    anonymized++;
    for (const key of keys) {
      await store?.remove("enquiries", key).catch(() => undefined);
      files++;
    }
  }
  await recordAudit(deps.db, {
    at: now,
    requestId: ulid(now.getTime()),
    actor: { type: "cli", label: operator.slice(0, 200) },
    ip: null,
    action: "enquiry.retention",
    entity: { type: "enquiry_retention", id: formKey, label: "Enquiry retention" },
    outcome: "success",
    summary: `Retention (${plan.retentionDays} days): anonymized ${anonymized} enquir${anonymized === 1 ? "y" : "ies"}, removed ${files} file${files === 1 ? "" : "s"}.`,
    changes: { anonymized, files, days: plan.retentionDays },
  });
  return { kind: "done", anonymized, files };
}
