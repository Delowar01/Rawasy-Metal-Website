/**
 * The A7 tables of the A1 schema (A1-DATABASE-SCHEMA §7 "Forms, enquiries and outgoing email"): the form definitions
 * (the quote form first: its settings, copy and fields, both languages) and the private enquiries with their files,
 * internal notes, status history and outgoing notifications.
 *
 * The public website reads none of them (T1 = Option B): the quote form on the website stays today's handoff form,
 * which prepares an email or a WhatsApp message for the visitor to send. The admin edits the form's working copy and
 * the enquiry inbox holds what a later, approved submission path will store (A7 builds and tests it; nothing on the
 * website calls it). Enquiries, their files, notes, history and outbox rows are PRIVATE personal data.
 *
 * Unchanged from A1 except, as in A3–A6, where noted (A7 report, item 4):
 * - `enquiries.status` is the Owner-approved workflow new · open · answered · closed (A7 brief §A7.4; A1 proposed
 *   new · contacted · qualified · closed · spam); `enquiry_status_history` uses the same values.
 * - `enquiries.lock_version`: a status change or an assignment is decided on the version its page showed.
 * - `enquiries.retain_until` is nullable and `forms.retention_days` too: no retention period is chosen until the Owner
 *   (and legal review) decides one (A7 brief §A7.8); nothing is deleted automatically.
 * - `enquiries.phone` is nullable (the admin may make the phone optional); `service_key` keeps the choice's value
 *   beside A1's `service_id` (set when a working service has that slug) and `service_label`.
 * - `enquiries.consent_at`: when the visitor ticked the consent box (only with `consent_mode` 'checkbox').
 * - `forms.consent_mode` (structured consent: today's privacy notice, or a box whose wording RAWASY provides);
 *   `captcha_provider` is left out (no CAPTCHA or third-party service without the Owner's authorization).
 * - `enquiry_reference_counters` (new): one row per year, locked to number references without gaps or duplicates.
 * - `email_outbox.claimed_until` (new): a sender's lease, so a stopped sender's row returns to the queue.
 * - checks for what the application validates too: the form key, the limits, positions, the reference's form.
 *
 * Source of truth for `drizzle-kit generate`; queries use Drizzle's core builder only.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { asciiColumn, hashColumn, instant, jsonColumn, localeColumn, ulidColumn } from "./columns.ts";
import { locales } from "./schema.ts";
import { actorKeys, pub, revisions, rootConstraints, services, translationConstraints, tr, ts } from "./schema-cms.ts";
import { CONSENT_MODES, DELIVERY_MODES, ENQUIRY_STATUSES, FIELD_TYPES, REFERENCE_PATTERN } from "../forms/registry.ts";

const now3 = sql`CURRENT_TIMESTAMP(3)`;
const regexp = (column: Parameters<typeof sql>[1], pattern: string) => sql`${column} REGEXP ${sql.raw(`'${pattern.replaceAll("\\", "\\\\")}'`)}`;

export const OUTBOX_KINDS = ["enquiry_notification", "enquiry_receipt", "publication_failed", "security_alert"] as const;
export const OUTBOX_STATUSES = ["pending", "sending", "sent", "failed", "cancelled"] as const;
export const NOTIFICATION_STATUSES = ["not_required", "pending", "sent", "failed"] as const;

// --- Forms --------------------------------------------------------------------------------------------------------------

/** Form definitions (the quote form first). `delivery_mode` starts as 'handoff' — exactly today's behaviour. */
export const forms = mysqlTable(
  "forms",
  {
    id: ulidColumn("id").primaryKey(),
    key: asciiColumn("key", { length: 32 }).notNull(),
    deliveryMode: mysqlEnum("delivery_mode", DELIVERY_MODES).notNull().default("handoff"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    /** Up to 5 addresses (validated); only for 'store_and_notify'. */
    notificationEmails: jsonColumn("notification_emails"),
    /** How long enquiries are kept: none until the Owner (and legal review) decides. */
    retentionDays: smallint("retention_days", { unsigned: true }),
    honeypotEnabled: boolean("honeypot_enabled").notNull().default(true),
    minFillSeconds: tinyint("min_fill_seconds", { unsigned: true }).notNull().default(3),
    consentMode: mysqlEnum("consent_mode", CONSENT_MODES).notNull().default("notice"),
    /** Stored attachments: off until the Owner decides (files stay on the visitor's device today). */
    acceptFiles: boolean("accept_files").notNull().default(false),
    maxFiles: tinyint("max_files", { unsigned: true }).notNull().default(5),
    maxFileMb: tinyint("max_file_mb", { unsigned: true }).notNull().default(10),
    acceptedExtensions: asciiColumn("accepted_extensions", { length: 200 }).notNull().default(".pdf,.jpg,.jpeg,.png"),
    ...pub(),
    ...ts(),
  },
  (t) => [
    uniqueIndex("uq_forms_key").on(t.key),
    ...rootConstraints("forms", t, { slug: false, softDelete: false }),
    check("ck_forms_key", regexp(t.key, "^[a-z][a-z0-9_]{0,31}$")),
    check("ck_forms_retention", sql`${t.retentionDays} IS NULL OR ${t.retentionDays} BETWEEN 30 AND 3650`),
    check("ck_forms_min_fill", sql`${t.minFillSeconds} BETWEEN 1 AND 60`),
    check("ck_forms_max_files", sql`${t.maxFiles} BETWEEN 1 AND 5`),
    check("ck_forms_max_file_mb", sql`${t.maxFileMb} BETWEEN 1 AND 10`),
  ],
);

/** The form's copy per language (headings, notes, errors, the 'ready' panel, the privacy line, the consent wording). */
export const formTranslations = mysqlTable(
  "form_translations",
  {
    formId: ulidColumn("form_id").notNull(),
    locale: localeColumn("locale").notNull(),
    /** Validated per form key (src/server/forms/copy.ts); mirrors today's quote form content. */
    copy: jsonColumn("copy").notNull(),
    ...tr(),
  },
  (t) => translationConstraints("form_translations", t, "formId", forms.id),
);

/** Fields in order. System fields keep their key, type and validation kind in code; their texts are editable. */
export const formFields = mysqlTable(
  "form_fields",
  {
    id: ulidColumn("id").primaryKey(),
    formId: ulidColumn("form_id").notNull(),
    fieldKey: asciiColumn("field_key", { length: 32 }).notNull(),
    fieldType: mysqlEnum("field_type", FIELD_TYPES).notNull(),
    groupKey: asciiColumn("group_key", { length: 32 }).notNull(),
    position: int("position", { unsigned: true }).notNull(),
    isRequired: boolean("is_required").notNull(),
    isSystem: boolean("is_system").notNull(),
    /** { minLength, maxLength } inside the registry's bounds — never a regular expression. */
    validation: jsonColumn("validation"),
    /** A choice's values (labels in translations). */
    options: jsonColumn("options"),
    ...ts(),
  },
  (t) => [
    uniqueIndex("uq_form_fields_key").on(t.formId, t.fieldKey),
    uniqueIndex("uq_form_fields_position").on(t.formId, t.position),
    foreignKey({ name: "fk_form_fields_form", columns: [t.formId], foreignColumns: [forms.id] }).onDelete("cascade"),
    ...actorKeys("form_fields", t, ["createdBy", "updatedBy"]),
    check("ck_form_fields_position", sql`${t.position} >= 1`),
  ],
);

/** Field texts per language. */
export const formFieldTranslations = mysqlTable(
  "form_field_translations",
  {
    fieldId: ulidColumn("field_id").notNull(),
    locale: localeColumn("locale").notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    placeholder: varchar("placeholder", { length: 120 }),
    hint: varchar("hint", { length: 300 }),
    /** { value: label } for a choice. */
    optionLabels: jsonColumn("option_labels"),
    errorRequired: varchar("error_required", { length: 200 }),
    errorInvalid: varchar("error_invalid", { length: 200 }),
    ...tr(),
  },
  (t) => translationConstraints("form_field_translations", t, "fieldId", formFields.id),
);

// --- Enquiries (PRIVATE) --------------------------------------------------------------------------------------------------

/** Stored submissions (only once a form's delivery mode stores them). PRIVATE personal data. */
export const enquiries = mysqlTable(
  "enquiries",
  {
    id: ulidColumn("id").primaryKey(),
    reference: asciiColumn("reference", { length: 20 }).notNull(),
    formId: ulidColumn("form_id").notNull(),
    locale: localeColumn("locale").notNull(),
    status: mysqlEnum("status", ENQUIRY_STATUSES).notNull().default("new"),
    assignedTo: ulidColumn("assigned_to"),
    submittedAt: instant("submitted_at").notNull(),
    sourcePath: varchar("source_path", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    company: varchar("company", { length: 200 }),
    email: varchar("email", { length: 254 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    serviceKey: asciiColumn("service_key", { length: 64 }),
    serviceId: ulidColumn("service_id"),
    serviceLabel: varchar("service_label", { length: 200 }),
    projectType: asciiColumn("project_type", { length: 32 }),
    requirement: text("requirement"),
    projectLocation: varchar("project_location", { length: 200 }),
    message: text("message").notNull(),
    extra: jsonColumn("extra"),
    consentAt: instant("consent_at"),
    privacyRevisionId: ulidColumn("privacy_revision_id"),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    spamScore: smallint("spam_score").notNull().default(0),
    spamSignals: varchar("spam_signals", { length: 255 }),
    notificationStatus: mysqlEnum("notification_status", NOTIFICATION_STATUSES).notNull().default("not_required"),
    retainUntil: date("retain_until", { mode: "string" }),
    anonymizedAt: instant("anonymized_at"),
    closedAt: instant("closed_at"),
    lockVersion: int("lock_version", { unsigned: true }).notNull().default(0),
    updatedAt: instant("updated_at").notNull().default(now3),
    updatedBy: ulidColumn("updated_by"),
    deletedAt: instant("deleted_at"),
    deletedBy: ulidColumn("deleted_by"),
  },
  (t) => [
    uniqueIndex("uq_enquiries_reference").on(t.reference),
    index("ix_enquiries_status").on(t.status, t.submittedAt),
    index("ix_enquiries_submitted").on(t.submittedAt),
    index("ix_enquiries_email").on(t.email),
    index("ix_enquiries_retain").on(t.retainUntil),
    index("ix_enquiries_assigned").on(t.assignedTo),
    index("ix_enquiries_deleted").on(t.deletedAt),
    foreignKey({ name: "fk_enquiries_form", columns: [t.formId], foreignColumns: [forms.id] }).onDelete("restrict"),
    foreignKey({ name: "fk_enquiries_locale", columns: [t.locale], foreignColumns: [locales.code] }).onDelete("restrict"),
    foreignKey({ name: "fk_enquiries_service", columns: [t.serviceId], foreignColumns: [services.id] }).onDelete("set null"),
    foreignKey({ name: "fk_enquiries_privacy", columns: [t.privacyRevisionId], foreignColumns: [revisions.id] }).onDelete("restrict"),
    ...actorKeys("enquiries", t, ["assignedTo", "updatedBy", "deletedBy"]),
    check("ck_enquiries_reference", regexp(t.reference, REFERENCE_PATTERN)),
  ],
);

/** The last reference number given in a year (Riyadh time): locked to give the next without gaps or duplicates. */
export const enquiryReferenceCounters = mysqlTable(
  "enquiry_reference_counters",
  {
    year: smallint("year", { unsigned: true }).primaryKey(),
    lastNumber: int("last_number", { unsigned: true }).notNull(),
  },
  (t) => [check("ck_enquiry_reference_counters_year", sql`${t.year} BETWEEN 2000 AND 9999`)],
);

/** Files attached to an enquiry: in the private storage area, downloadable only by authorized staff. */
export const enquiryFiles = mysqlTable(
  "enquiry_files",
  {
    id: ulidColumn("id").primaryKey(),
    enquiryId: ulidColumn("enquiry_id").notNull(),
    storageKey: asciiColumn("storage_key", { length: 255 }).notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    mimeType: asciiColumn("mime_type", { length: 100 }).notNull(),
    extension: asciiColumn("extension", { length: 10 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number", unsigned: true }).notNull(),
    sha256: hashColumn("sha256").notNull(),
    createdAt: instant("created_at").notNull().default(now3),
  },
  (t) => [
    uniqueIndex("uq_enquiry_files_storage").on(t.storageKey),
    index("ix_enquiry_files_enquiry").on(t.enquiryId),
    foreignKey({ name: "fk_enquiry_files_enquiry", columns: [t.enquiryId], foreignColumns: [enquiries.id] }).onDelete("cascade"),
  ],
);

/** Internal notes on an enquiry (plain text). */
export const enquiryNotes = mysqlTable(
  "enquiry_notes",
  {
    id: ulidColumn("id").primaryKey(),
    enquiryId: ulidColumn("enquiry_id").notNull(),
    authorId: ulidColumn("author_id"),
    body: text("body").notNull(),
    createdAt: instant("created_at").notNull().default(now3),
    editedAt: instant("edited_at"),
  },
  (t) => [
    index("ix_enquiry_notes_enquiry").on(t.enquiryId, t.createdAt),
    foreignKey({ name: "fk_enquiry_notes_enquiry", columns: [t.enquiryId], foreignColumns: [enquiries.id] }).onDelete("cascade"),
    ...actorKeys("enquiry_notes", t, ["authorId"]),
  ],
);

/** Every status change (New → Open → Answered → Closed, reopening, closing without an answer). */
export const enquiryStatusHistory = mysqlTable(
  "enquiry_status_history",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    enquiryId: ulidColumn("enquiry_id").notNull(),
    fromStatus: mysqlEnum("from_status", ENQUIRY_STATUSES),
    toStatus: mysqlEnum("to_status", ENQUIRY_STATUSES).notNull(),
    changedAt: instant("changed_at").notNull(),
    changedBy: ulidColumn("changed_by"),
    note: varchar("note", { length: 500 }),
  },
  (t) => [
    index("ix_enquiry_status_history_enquiry").on(t.enquiryId, t.changedAt),
    foreignKey({ name: "fk_enquiry_status_history_enquiry", columns: [t.enquiryId], foreignColumns: [enquiries.id] }).onDelete("cascade"),
    ...actorKeys("enquiry_status_history", t, ["changedBy"]),
  ],
);

/** Outgoing notifications, sent after the enquiry is committed and retried. Mail carrying a secret never enters it. */
export const emailOutbox = mysqlTable(
  "email_outbox",
  {
    id: ulidColumn("id").primaryKey(),
    kind: mysqlEnum("kind", OUTBOX_KINDS).notNull(),
    toAddress: varchar("to_address", { length: 254 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    bodyText: mediumtext("body_text"),
    relatedType: asciiColumn("related_type", { length: 32 }),
    relatedId: asciiColumn("related_id", { length: 64 }),
    status: mysqlEnum("status", OUTBOX_STATUSES).notNull().default("pending"),
    attempts: tinyint("attempts", { unsigned: true }).notNull().default(0),
    nextAttemptAt: instant("next_attempt_at"),
    claimedUntil: instant("claimed_until"),
    lastError: varchar("last_error", { length: 500 }),
    createdAt: instant("created_at").notNull().default(now3),
    sentAt: instant("sent_at"),
  },
  (t) => [index("ix_email_outbox_due").on(t.status, t.nextAttemptAt), index("ix_email_outbox_related").on(t.relatedType, t.relatedId)],
);

