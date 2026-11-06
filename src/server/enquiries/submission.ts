/**
 * The public enquiry submission (A7.5; A1-ARCHITECTURE §5.8), prepared for a later, approved activation: nothing on the
 * website calls it (the quote form stays today's handoff form, T1 = Option B) and no route or Server Action of the
 * build reaches it. The integration tests and the test seed call it; A9's cutover wires it, with the Owner's go-ahead.
 *
 * In order, each refusal before anything is stored:
 * 1. the Origin header must be exactly the site's origin (and `Sec-Fetch-Site`, when sent, `same-origin`);
 * 2. the declared body and the text fields stay under their limits (files: the form's count and size);
 * 3. the form must be on and store submissions (`delivery_mode` store / store_and_notify): 'handoff' stores nothing;
 * 4. per address: 5 in 10 minutes, 20 a day (A2's shared `rate_limits`, keys hashed);
 * 5. the hidden honeypot field must be empty; the signed timing token valid, at least the form's minimum fill time old
 *    and at most two hours;
 * 6. every field checked against the form's working definition (`validate.ts`); per email address: 5 an hour;
 * 7. files only when the form accepts them: the extension on the form's list and the bytes agreeing (A4's signatures:
 *    PDF, JPEG, PNG; never SVG, office or executable files), at most the form's count and size, stored in the private
 *    `enquiries` area under a key the server makes;
 * 8. the token's nonce claimed (a replay is refused); then one transaction: the reference (Q-YYYY-NNNNN, gapless, from
 *    a locked per-year counter), the enquiry, its first status, the notification rows (store_and_notify: the reference
 *    and a link to the admin only — no personal data in the mail), an audit event (the reference only).
 * "Received, reference …" is the answer only after that commit. A refused submission is not audited (a flood would fill
 * the audit log); the rate limits count it.
 */
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { recordAudit } from "../audit/audit.ts";
import { inTransaction, type Db } from "../db/client.ts";
import type { CmsDeps } from "../cms/store.ts";
import { emailOutbox, enquiries, enquiryFiles, enquiryStatusHistory } from "../db/schema-forms.ts";
import { hitRateLimit } from "../auth/rate-limit.ts";
import { rowsOf } from "../cms/store.ts";
import { displayFilename, extensionOf, sniff, pdfTailOk } from "../media/signature.ts";
import { enquiryFileKey, type MediaStore } from "../media/storage.ts";
import { sha256, ulid } from "../security/ids.ts";
import { services as todaysServices } from "../../content/services.ts";
import { readForm, type FormModel } from "../forms/forms.ts";
import { ATTACHMENT_TYPES, SERVICE_NOT_SURE, SUBMISSION_LIMITS, formatReference, referenceYear, type Locale } from "../forms/registry.ts";
import { claimToken, verifyToken } from "./token.ts";
import { textBytes, validateSubmission, type FieldErrors } from "./validate.ts";

export interface SubmissionDeps {
  pool: CmsDeps["pool"];
  db: Db;
  clock: () => Date;
  /** The form token key (`tokenKeyFrom`). */
  tokenKey: Buffer;
  /** The site's public origin (`https://…`, no path): the only Origin accepted. */
  siteOrigin: string;
  /** The admin's base address, for the notification's link. */
  adminUrl: string;
  /** The private file store, opened only when a submission carries files. */
  store?: () => Promise<MediaStore>;
}

export interface SubmittedFile {
  name: string;
  bytes: Uint8Array;
}

export interface SubmissionInput {
  formKey: string;
  locale: Locale;
  origin: string | null;
  secFetchSite: string | null;
  /** The body's declared length (Content-Length), when known. */
  contentLength: number | null;
  ip: string | null;
  userAgent: string | null;
  /** The page the form was sent from (`/en/contact`). */
  sourcePath: string;
  fields: Record<string, unknown>;
  files: SubmittedFile[];
}

export type RefusalReason = "origin" | "too_large" | "closed" | "rate_limited" | "honeypot" | "token" | "too_fast" | "expired" | "replayed";

export type SubmissionResult =
  | { kind: "received"; reference: string; enquiryId: string; notify: boolean }
  | { kind: "invalid"; errors: FieldErrors }
  | { kind: "refused"; reason: RefusalReason };

const SOURCE_PATH = /^\/(en|ar)(\/[A-Za-z0-9._~%-]{1,120}){0,6}$/;

/** Today's service choices (the public form's own list) and their labels in a language. */
const serviceSlugs = todaysServices.map((s) => s.slug as string);
const serviceLabel = (slug: string, locale: Locale, form: FormModel) =>
  slug === SERVICE_NOT_SURE ? form.copy[locale].serviceOther : (todaysServices.find((s) => s.slug === slug)?.name[locale] ?? slug);

/** The stored extension and MIME type of an accepted attachment (".jpeg" is stored as "jpg"). */
const storedType = (kind: string) => (kind === "jpeg" ? { extension: "jpg", mime: "image/jpeg" } : kind === "png" ? { extension: "png", mime: "image/png" } : { extension: "pdf", mime: "application/pdf" });

interface CheckedFile {
  id: string;
  key: string;
  name: string;
  extension: string;
  mime: string;
  size: number;
  sha256: Buffer;
  bytes: Uint8Array;
}

/** The attachments checked against the form (count, size, type, bytes); errors under "files". */
function checkFiles(form: FormModel, locale: Locale, files: SubmittedFile[], now: Date): { ok: true; files: CheckedFile[] } | { ok: false; error: string } {
  const copy = form.copy[locale];
  if (!files.length) return { ok: true, files: [] };
  if (!form.settings.acceptFiles) return { ok: false, error: copy.errors.fileCount };
  if (files.length > form.settings.maxFiles) return { ok: false, error: copy.errors.fileCount };
  const out: CheckedFile[] = [];
  for (const file of files) {
    const name = displayFilename(file.name);
    const extension = `.${extensionOf(file.name)}`;
    const allowed = ATTACHMENT_TYPES.find((t) => t.extension === extension);
    if (!allowed || !form.settings.acceptedExtensions.includes(extension)) return { ok: false, error: copy.errors.fileType.replace("{name}", name) };
    if (file.bytes.byteLength > form.settings.maxFileMb * 1024 * 1024 || file.bytes.byteLength === 0) return { ok: false, error: copy.errors.fileSize.replace("{name}", name) };
    const found = sniff(file.bytes.subarray(0, 4096), file.bytes.byteLength);
    if (found !== allowed.kind || (found === "pdf" && !pdfTailOk(file.bytes.subarray(Math.max(0, file.bytes.byteLength - 1024))))) return { ok: false, error: copy.errors.fileType.replace("{name}", name) };
    const id = ulid(now.getTime());
    const type = storedType(found);
    out.push({ id, key: enquiryFileKey(id, type.extension, now), name, extension: type.extension, mime: type.mime, size: file.bytes.byteLength, sha256: sha256(Buffer.from(file.bytes)), bytes: file.bytes });
  }
  return { ok: true, files: out };
}

/** Receives one submission (see the module's comment for the order of the checks). */
export async function submitEnquiry(deps: SubmissionDeps, input: SubmissionInput): Promise<SubmissionResult> {
  const now = deps.clock();
  // 1. Origin.
  if (!input.origin || input.origin !== deps.siteOrigin || (input.secFetchSite !== null && input.secFetchSite !== "same-origin")) return { kind: "refused", reason: "origin" };
  // 2. Size, before anything is read further.
  const form = await readForm(deps.db, { key: input.formKey });
  const fileBudget = form?.settings.acceptFiles ? form.settings.maxFiles * form.settings.maxFileMb * 1024 * 1024 : 0;
  if ((input.contentLength ?? 0) > SUBMISSION_LIMITS.bodyBytes + fileBudget || textBytes(input.fields) > SUBMISSION_LIMITS.textBytes) return { kind: "refused", reason: "too_large" };
  // 3. The form must be on and store submissions.
  if (!form || !form.setUp || !form.settings.isEnabled || form.settings.deliveryMode === "handoff") return { kind: "refused", reason: "closed" };
  // 4. Per address.
  if (input.ip) {
    const short = await hitRateLimit(deps.db, `enquiry:ip:${input.ip}`, SUBMISSION_LIMITS.perIpShort, now);
    const day = await hitRateLimit(deps.db, `enquiry:ip-day:${input.ip}`, SUBMISSION_LIMITS.perIpDay, now);
    if (!short.allowed || !day.allowed) return { kind: "refused", reason: "rate_limited" };
  }
  // 5. Honeypot, then the timing token.
  const trap = input.fields[SUBMISSION_LIMITS.honeypot];
  if (form.settings.honeypotEnabled && typeof trap === "string" && trap.trim() !== "") return { kind: "refused", reason: "honeypot" };
  const token = verifyToken(deps.tokenKey, input.fields.token, form.key, now, form.settings.minFillSeconds);
  if (!token.ok) return { kind: "refused", reason: token.reason };
  // 6. The fields, then per email address.
  const checked = validateSubmission(form, input.locale, input.fields, serviceSlugs);
  const files = checkFiles(form, input.locale, input.files, now);
  if (!checked.ok || !files.ok) {
    const errors: FieldErrors = checked.ok ? {} : { ...checked.errors, ...Object.fromEntries((checked.unknown ?? []).map((name) => [name, "Unknown field."])) };
    if (!files.ok) errors.files = files.error;
    return { kind: "invalid", errors };
  }
  const values = checked.values;
  const perEmail = await hitRateLimit(deps.db, `enquiry:email:${values.email.toLowerCase()}`, SUBMISSION_LIMITS.perEmail, now);
  if (!perEmail.allowed) return { kind: "refused", reason: "rate_limited" };
  // 7. Files to the private area (removed again if the enquiry is not stored).
  const store = files.files.length ? await deps.store?.() : undefined;
  if (files.files.length && !store) throw new Error("The private file store is not configured.");
  const created: string[] = [];
  try {
    for (const file of files.files) {
      await store!.writeNew("enquiries", file.key, file.bytes);
      created.push(file.key);
    }
    // 8. Once only, then one transaction.
    if (!(await claimToken(deps.db, token.nonce, token.issuedAt))) {
      await removeAll(store, created);
      return { kind: "refused", reason: "replayed" };
    }
    const stored = await inTransaction(deps.pool, async (tx) => {
      const [row] = await rowsOf<{ delivery_mode: string; is_enabled: number; retention_days: number | null }>(
        tx,
        sql`SELECT delivery_mode, is_enabled, retention_days FROM forms WHERE id = ${form.id} LOCK IN SHARE MODE`,
      );
      if (!row || !Number(row.is_enabled) || row.delivery_mode === "handoff") return null;
      const notify = row.delivery_mode === "store_and_notify" && form.settings.notificationEmails.length > 0;
      const year = referenceYear(now);
      // One upsert takes the year's row exclusively at once (an INSERT IGNORE first took a shared lock, and two
      // submissions then deadlocked upgrading it); the number is read back under that lock and rolls back with the rest.
      await tx.execute(sql`INSERT INTO enquiry_reference_counters (year, last_number) VALUES (${year}, 1) ON DUPLICATE KEY UPDATE last_number = last_number + 1`);
      const [counter] = await rowsOf<{ last_number: number }>(tx, sql`SELECT last_number FROM enquiry_reference_counters WHERE year = ${year} FOR UPDATE`);
      const number = Number(counter.last_number);
      const reference = formatReference(year, number);
      const id = ulid(now.getTime());
      const [service] = values.service && values.service !== SERVICE_NOT_SURE ? await rowsOf<{ id: string }>(tx, sql`SELECT id FROM services WHERE slug = ${values.service} AND deleted_at IS NULL LIMIT 1`) : [];
      const retention = row.retention_days === null || row.retention_days === undefined ? null : Number(row.retention_days);
      await tx.insert(enquiries).values({
        id,
        reference,
        formId: form.id,
        locale: input.locale,
        status: "new",
        submittedAt: now,
        sourcePath: SOURCE_PATH.test(input.sourcePath) ? input.sourcePath : `/${input.locale}/contact`,
        fullName: values.fullName,
        company: values.company || null,
        email: values.email,
        phone: values.phone || null,
        serviceKey: values.service || null,
        serviceId: service?.id ?? null,
        serviceLabel: values.service ? serviceLabel(values.service, input.locale, form).slice(0, 200) : null,
        projectType: values.projectType || null,
        requirement: values.requirement || null,
        projectLocation: values.location || null,
        message: values.message,
        consentAt: values.consent ? now : null,
        ip: input.ip ? input.ip.slice(0, 45) : null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 255) : null,
        notificationStatus: notify ? "pending" : "not_required",
        retainUntil: retention ? new Date(now.getTime() + retention * 86_400_000).toISOString().slice(0, 10) : null,
        updatedAt: now,
      });
      await tx.insert(enquiryStatusHistory).values({ enquiryId: id, fromStatus: null, toStatus: "new", changedAt: now, changedBy: null });
      for (const file of files.files) {
        await tx.insert(enquiryFiles).values({ id: file.id, enquiryId: id, storageKey: file.key, originalFilename: file.name, mimeType: file.mime, extension: file.extension, byteSize: file.size, sha256: file.sha256, createdAt: now });
      }
      if (notify) {
        for (const to of form.settings.notificationEmails) {
          await tx.insert(emailOutbox).values({
            id: ulid(now.getTime()),
            kind: "enquiry_notification",
            toAddress: to,
            subject: `New enquiry ${reference}`,
            bodyText: `A new request was received through the website's ${form.key === "quote" ? "quote request form" : form.key}: ${reference}.\n\nOpen it in the admin (sign-in required):\n${deps.adminUrl.replace(/\/+$/, "")}/admin/enquiries/${id}\n\nThe request's details are in the admin only.`,
            relatedType: "enquiry",
            relatedId: id,
            status: "pending",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
          });
        }
      }
      await recordAudit(tx, {
        at: now,
        requestId: ulid(now.getTime()),
        actor: { type: "system", label: "Website enquiry form" },
        ip: input.ip,
        action: "enquiry.received",
        entity: { type: "enquiry", id, label: reference },
        outcome: "success",
        summary: `Received ${reference} (${input.locale === "en" ? "English" : "Arabic"}${files.files.length ? `, ${files.files.length} file${files.files.length === 1 ? "" : "s"}` : ""}${notify ? ", notification queued" : ""}).`,
        changes: { files: files.files.length, notify },
      });
      return { reference, id, notify };
    });
    if (!stored) {
      await removeAll(store, created);
      return { kind: "refused", reason: "closed" };
    }
    return { kind: "received", reference: stored.reference, enquiryId: stored.id, notify: stored.notify };
  } catch (error) {
    await removeAll(store, created);
    throw error;
  }
}

async function removeAll(store: MediaStore | undefined, keys: string[]) {
  if (!store) return;
  for (const key of keys) await store.remove("enquiries", key).catch(() => undefined);
}

/** A fresh random nonce (exported for tests that make tokens by hand). */
export const randomNonce = () => randomBytes(16);
