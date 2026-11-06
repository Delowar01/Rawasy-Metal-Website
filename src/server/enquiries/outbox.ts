/**
 * Outgoing notifications (A7.6; A1 `email_outbox`): rows written in the enquiry's own transaction, sent afterwards by
 * `processOutbox` — run by hand (`npm run email:outbox`) or, once approved, by the host's cron. There is no HTTP route
 * for it (A7 brief §6: no new endpoint) and no SMTP: the transport is A2's mailer — `disabled` (default; nothing leaves,
 * rows stay pending and say why) or the local `sink` (APP_ENV=local: JSON files). A future SMTP transport plugs into
 * `Mailer` without touching this module (the provider is the Owner's decision, A7 report item 9).
 *
 * Delivery state is auditable: each row records its attempts, the next attempt, the last error (a code, never the
 * server's text) and when it was sent; a row is claimed with a lease (`claimed_until`) by one conditional UPDATE, so two
 * senders never claim it at once and a stopped sender's row returns to the queue. A sender writes its outcome only while
 * its own claim still holds (a sender slower than the lease finds the row claimed again and writes nothing over it); a
 * future SMTP transport must time out well inside the 5-minute lease, or the row may be sent twice. Retries back off
 * (1, 5, 15, 60, 240 minutes); after five failed attempts a row is `failed`, and its enquiry's notification status says
 * so. An admin may queue a failed row again (`retryNotification`, `enquiries.manage`, audited) — never one of an
 * anonymized enquiry (retention cancels those rows). A row without a body (cleared by retention) is cancelled, never sent.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rowsOf, contentTransaction } from "../cms/store.ts";
import type { Mailer } from "../mail/mailer.ts";
import { formsAudit, refuse, type FormsChange, type Result } from "../forms/common.ts";
import { OUTBOX } from "../forms/registry.ts";

export interface OutboxReport {
  claimed: number;
  sent: number;
  /** Claims another sender took over before this one finished (its outcome was not written). */
  superseded: number;
  /** Rows without a body (cleared by retention): cancelled, never sent. */
  cancelled: number;
  retrying: number;
  failed: number;
  /** Rows left pending because the mail transport is off (nothing is attempted or counted). */
  waiting: number;
}

/** The delay before the next attempt after `attempts` failed ones. */
export const backoffMs = (attempts: number) => OUTBOX.backoffMinutes[Math.min(Math.max(attempts - 1, 0), OUTBOX.backoffMinutes.length - 1)] * 60_000;

/** Sends what is due, at most one batch. */
export async function processOutbox(db: Db, mailer: Mailer, now: Date): Promise<OutboxReport> {
  const report: OutboxReport = { claimed: 0, sent: 0, superseded: 0, cancelled: 0, retrying: 0, failed: 0, waiting: 0 };
  if (!mailer.configured) {
    const [row] = await rowsOf<{ n: number }>(db, sql`SELECT COUNT(*) AS n FROM email_outbox WHERE status = 'pending'`);
    await db.execute(sql`UPDATE email_outbox SET last_error = 'mail_disabled' WHERE status = 'pending' AND (last_error IS NULL OR last_error <> 'mail_disabled')`);
    report.waiting = Number(row?.n ?? 0);
    return report;
  }
  const due = await rowsOf<{ id: string }>(
    db,
    sql`SELECT id FROM email_outbox
        WHERE (status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ${now}))
           OR (status = 'sending' AND claimed_until < ${now})
        ORDER BY next_attempt_at, id LIMIT ${OUTBOX.batch}`,
  );
  for (const { id } of due) {
    const lease = new Date(now.getTime() + OUTBOX.leaseMs);
    const [claim] = (await db.execute(
      sql`UPDATE email_outbox SET status = 'sending', claimed_until = ${lease}, attempts = attempts + 1
          WHERE id = ${id} AND ((status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})) OR (status = 'sending' AND claimed_until < ${now}))`,
    )) as unknown as [{ affectedRows: number }];
    if (claim.affectedRows !== 1) continue;
    report.claimed++;
    const [row] = await rowsOf<{ kind: string; to_address: string; subject: string; body_text: string | null; attempts: number; related_type: string | null; related_id: string | null }>(
      db,
      sql`SELECT kind, to_address, subject, body_text, attempts, related_type, related_id FROM email_outbox WHERE id = ${id}`,
    );
    /** This sender's claim, which every outcome below must still hold. */
    const ours = sql`id = ${id} AND status = 'sending' AND claimed_until = ${lease}`;
    const affected = (result: unknown) => (result as [{ affectedRows: number }])[0].affectedRows;
    if (row.body_text === null) {
      await db.execute(sql`UPDATE email_outbox SET status = 'cancelled', claimed_until = NULL, last_error = 'no_body' WHERE ${ours}`);
      report.cancelled++;
      if (row.related_type === "enquiry" && row.related_id) await refreshNotificationStatus(db, row.related_id);
      continue;
    }
    let delivered = false;
    let error: string | null = null;
    try {
      const result = await mailer.send({ kind: "enquiry_notification", to: row.to_address, subject: row.subject, text: row.body_text });
      delivered = result.delivered;
      if (!delivered) error = "not_delivered";
    } catch (e) {
      error = (e as { code?: string })?.code ? `error_${String((e as { code?: string }).code).slice(0, 40)}` : "send_failed";
    }
    if (delivered) {
      if (affected(await db.execute(sql`UPDATE email_outbox SET status = 'sent', sent_at = ${now}, claimed_until = NULL, last_error = NULL WHERE ${ours}`))) report.sent++;
      else report.superseded++;
    } else if (Number(row.attempts) >= OUTBOX.maxAttempts) {
      if (affected(await db.execute(sql`UPDATE email_outbox SET status = 'failed', claimed_until = NULL, last_error = ${error} WHERE ${ours}`))) report.failed++;
      else report.superseded++;
    } else {
      const next = new Date(now.getTime() + backoffMs(Number(row.attempts)));
      if (affected(await db.execute(sql`UPDATE email_outbox SET status = 'pending', claimed_until = NULL, last_error = ${error}, next_attempt_at = ${next} WHERE ${ours}`))) report.retrying++;
      else report.superseded++;
    }
    if (row.related_type === "enquiry" && row.related_id) await refreshNotificationStatus(db, row.related_id);
  }
  return report;
}

/** An enquiry's notification status from its rows: none needed when all were cancelled, sent when the rest were sent, failed when one failed, else pending. */
export async function refreshNotificationStatus(db: Db, enquiryId: string): Promise<void> {
  const rows = await rowsOf<{ status: string }>(db, sql`SELECT status FROM email_outbox WHERE related_type = 'enquiry' AND related_id = ${enquiryId}`);
  if (!rows.length) return;
  const status = rows.every((r) => r.status === "cancelled")
    ? "not_required"
    : rows.every((r) => r.status === "sent" || r.status === "cancelled")
      ? "sent"
      : rows.some((r) => r.status === "failed")
        ? "failed"
        : "pending";
  await db.execute(sql`UPDATE enquiries SET notification_status = ${status} WHERE id = ${enquiryId}`);
}

/** Queues a failed notification again (an admin's retry). */
export async function retryNotification(change: FormsChange, outboxId: string): Promise<Result> {
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<Result> => {
    const [row] = await rowsOf<{ status: string; related_type: string | null; related_id: string | null; reference: string | null; anonymized_at: unknown; body_text: string | null }>(
      tx,
      sql`SELECT o.status, o.related_type, o.related_id, o.body_text, e.reference, e.anonymized_at FROM email_outbox o LEFT JOIN enquiries e ON o.related_type = 'enquiry' AND e.id = o.related_id WHERE o.id = ${outboxId} FOR UPDATE`,
    );
    if (!row || row.related_type !== "enquiry" || !row.related_id || !row.reference) return { kind: "not_found" };
    const ev = { action: "enquiry.notification_retry", type: "enquiry" as const, id: row.related_id, label: row.reference };
    if (!actor.permissions.has("enquiries.manage")) return refuse(tx, change, now, ev, "Retrying a notification needs a permission you don't hold.");
    if (row.anonymized_at || row.body_text === null) return { kind: "invalid", message: "This enquiry was anonymized: its notifications are not sent any more.", issues: [] };
    if (row.status !== "failed") return { kind: "invalid", message: "Only a failed notification can be sent again.", issues: [] };
    await tx.execute(sql`UPDATE email_outbox SET status = 'pending', attempts = 0, next_attempt_at = ${now}, last_error = NULL WHERE id = ${outboxId}`);
    await refreshNotificationStatus(tx, row.related_id);
    await formsAudit(tx, change, now, { ...ev, summary: "Queued a failed notification again.", changes: { outbox: outboxId } });
    return { kind: "ok", summary: "Queued again. It is sent the next time the outbox runs." };
  });
}
