/**
 * Forms and enquiries (A7; A1-DATABASE-SCHEMA §7 "Forms, enquiries and outgoing email", A1-ARCHITECTURE §5.8): the
 * code side of the form definitions and the enquiry workflow. Framework-free (Node type stripping, `.ts` imports): the
 * services, the seed generator, the CLIs and the tests read it.
 *
 * - The quote form's ten fields are system fields: their key, type, group and validation kind live here and never in
 *   the database's hands (A1: "never a regular expression typed in the admin"). The admin edits their texts, their
 *   order inside their group, whether an optional field is required, and lengths inside the bounds given here.
 * - Today's limits are the public handoff form's own (`src/components/commerce/contact/QuoteForm.tsx`: its `maxLength`
 *   attributes and its `validate`), so a stored submission is held to exactly what the visitor's browser checks.
 * - Stored attachments accept only types whose bytes can be checked (PDF, JPEG, PNG). The handoff form's own list
 *   (DWG, DXF, STEP …) stays on the visitor's device and is not changed; CAD files are an Owner decision (A7 report).
 * - The workflow is the Owner-approved New → Open → Answered → Closed (A7 brief §A7.4), with reopening and closing
 *   without an answer (a reason required) as the only other moves.
 */

export type Locale = "en" | "ar";
export const LOCALES: readonly Locale[] = ["en", "ar"];

export const FORM_KEYS = ["quote"] as const;
export type FormKey = (typeof FORM_KEYS)[number];

/** The seeded quote form's fixed id (a ULID-shaped constant: the seed and the tests refer to it). */
export const FORM_IDS: Record<FormKey, string> = { quote: "01K8F0RM000000000000000QTE" };

/** `handoff`: today's form (the visitor sends the prepared email or WhatsApp message; nothing reaches the website). */
export const DELIVERY_MODES = ["handoff", "store", "store_and_notify"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export const DELIVERY_LABELS: Record<DeliveryMode, string> = {
  handoff: "Handoff (today): the visitor sends the prepared request; nothing is stored",
  store: "Store submissions in the enquiry inbox",
  store_and_notify: "Store submissions and notify by email",
};

/** `notice`: today's privacy line under the form. `checkbox`: a consent box the visitor must tick (wording: RAWASY's). */
export const CONSENT_MODES = ["notice", "checkbox"] as const;
export type ConsentMode = (typeof CONSENT_MODES)[number];

export const FIELD_TYPES = ["text", "email", "tel", "textarea", "select", "service_select", "file"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_GROUPS = ["details", "project", "message"] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];

export interface FieldDefinition {
  key: string;
  type: FieldType;
  group: FieldGroup;
  /** Today's: required on the website's form. */
  required: boolean;
  /** The admin may not change whether it is required (the minimum a reply needs; files are never required). */
  requiredLocked: boolean;
  /** Text lengths: today's minimum and maximum, and the lowest minimum the admin may choose. */
  length?: { min: number; max: number; floor: number };
  /** A choice's values (labels are translations). */
  options?: readonly string[];
  /** Which today's errors a field's two error texts are (copied at set-up). */
  errors?: { required?: string; invalid?: string };
}

/** Today's project types (the select's values), in order. */
export const PROJECT_TYPES = ["new-project", "custom-piece", "production", "rental", "maintenance", "other"] as const;
/** The service select's extra choice. */
export const SERVICE_NOT_SURE = "not-sure";

export const QUOTE_FIELDS: readonly FieldDefinition[] = [
  { key: "fullName", type: "text", group: "details", required: true, requiredLocked: true, length: { min: 2, max: 120, floor: 2 }, errors: { required: "fullName", invalid: "fullName" } },
  { key: "company", type: "text", group: "details", required: false, requiredLocked: false, length: { min: 0, max: 160, floor: 0 } },
  { key: "email", type: "email", group: "details", required: true, requiredLocked: true, length: { min: 0, max: 254, floor: 0 }, errors: { required: "email", invalid: "emailInvalid" } },
  { key: "phone", type: "tel", group: "details", required: true, requiredLocked: false, length: { min: 0, max: 30, floor: 0 }, errors: { required: "phone", invalid: "phoneInvalid" } },
  { key: "service", type: "service_select", group: "project", required: true, requiredLocked: false, errors: { required: "service" } },
  { key: "projectType", type: "select", group: "project", required: false, requiredLocked: false, options: PROJECT_TYPES },
  { key: "requirement", type: "text", group: "project", required: false, requiredLocked: false, length: { min: 0, max: 300, floor: 0 } },
  { key: "location", type: "text", group: "project", required: false, requiredLocked: false, length: { min: 0, max: 120, floor: 0 } },
  { key: "message", type: "textarea", group: "message", required: true, requiredLocked: true, length: { min: 20, max: 4000, floor: 1 }, errors: { required: "message", invalid: "messageShort" } },
  { key: "files", type: "file", group: "message", required: false, requiredLocked: true },
];

export const fieldDefinition = (key: string) => QUOTE_FIELDS.find((f) => f.key === key);

/** Today's phone rule: digits (any script), spaces, + ( ) . - ; 8 to 15 digits. */
export const PHONE_DIGITS = { min: 8, max: 15 } as const;

// --- Form settings ----------------------------------------------------------------------------------------------------

export const FORM_LIMITS = {
  minFillSeconds: { min: 1, max: 60, today: 3 },
  maxFiles: { min: 1, max: 5, today: 5 },
  maxFileMb: { min: 1, max: 10, today: 10 },
  notificationEmails: 5,
  /** A retention period, once the Owner chooses one (none is chosen: A7 brief §A7.8). */
  retentionDays: { min: 30, max: 3650 },
  /** One copy text. */
  copyText: 600,
  label: 120,
  placeholder: 120,
  hint: 300,
  error: 200,
  option: 120,
  consentLabel: 600,
} as const;

/** Stored attachments: only what the bytes can prove (A4's signatures). Never SVG, office or executable files. */
export const ATTACHMENT_TYPES = [
  { extension: ".pdf", mime: "application/pdf", kind: "pdf" },
  { extension: ".jpg", mime: "image/jpeg", kind: "jpeg" },
  { extension: ".jpeg", mime: "image/jpeg", kind: "jpeg" },
  { extension: ".png", mime: "image/png", kind: "png" },
] as const;
export const ATTACHMENT_EXTENSIONS: readonly string[] = ATTACHMENT_TYPES.map((t) => t.extension);
export const DEFAULT_ATTACHMENT_EXTENSIONS = ".pdf,.jpg,.jpeg,.png";

// --- Public submission (prepared; nothing on the website calls it before the approved cutover) ---------------------------

export const SUBMISSION_LIMITS = {
  /** A signed timing token is valid this long after the form was drawn. */
  tokenMaxAgeMs: 2 * 60 * 60 * 1000,
  /** Every text field together, in bytes (UTF-8). */
  textBytes: 32 * 1024,
  /** A request without files (the whole body as the server received it). */
  bodyBytes: 64 * 1024,
  /** The honeypot field's name (a field no person fills: hidden from sight and from assistive technology). */
  honeypot: "website",
  /** Per address, per form: 5 in 10 minutes, 20 a day; per email address: 5 an hour. */
  perIpShort: { limit: 5, windowMs: 10 * 60 * 1000 },
  perIpDay: { limit: 20, windowMs: 24 * 60 * 60 * 1000 },
  perEmail: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

// --- Enquiries --------------------------------------------------------------------------------------------------------

export const ENQUIRY_STATUSES = ["new", "open", "answered", "closed"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const STATUS_LABELS: Record<EnquiryStatus, string> = { new: "New", open: "Open", answered: "Answered", closed: "Closed" };

export interface Transition {
  from: EnquiryStatus;
  to: EnquiryStatus;
  /** The button's words. */
  label: string;
  /** A reason is required (closing without an answer). */
  noteRequired: boolean;
}

/** The workflow: forward New → Open → Answered → Closed; reopen; close without an answer with a reason. */
export const TRANSITIONS: readonly Transition[] = [
  { from: "new", to: "open", label: "Open", noteRequired: false },
  { from: "open", to: "answered", label: "Mark answered", noteRequired: false },
  { from: "answered", to: "closed", label: "Close", noteRequired: false },
  { from: "answered", to: "open", label: "Reopen", noteRequired: false },
  { from: "closed", to: "open", label: "Reopen", noteRequired: false },
  { from: "new", to: "closed", label: "Close without an answer", noteRequired: true },
  { from: "open", to: "closed", label: "Close without an answer", noteRequired: true },
];

export const transitionOf = (from: EnquiryStatus, to: EnquiryStatus) => TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;

/** The human reference (A1: never an id): Q-YYYY-NNNNN, the year in Riyadh time (UTC+3, no daylight saving). */
export const REFERENCE_PATTERN = "^Q-[0-9]{4}-[0-9]{5,}$";
export const REFERENCE_RE = /^Q-\d{4}-\d{5,}$/;
export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
export const referenceYear = (at: Date) => new Date(at.getTime() + RIYADH_OFFSET_MS).getUTCFullYear();
export const formatReference = (year: number, n: number) => `Q-${year}-${String(n).padStart(5, "0")}`;

export const ENQUIRY_LIMITS = {
  note: 4000,
  transitionNote: 500,
  pageSize: { min: 10, max: 100, default: 25 },
  search: 100,
  /** CSV export: at most this many rows at once (narrow the filters for more). */
  exportRows: 5000,
} as const;

/** Outgoing mail (A1 `email_outbox`): retries with backoff, then failed. */
export const OUTBOX = {
  maxAttempts: 5,
  /** Minutes before attempt n+1 (n = attempts so far). */
  backoffMinutes: [1, 5, 15, 60, 240],
  /** A claimed row returns to the queue after this long (a sender that stopped mid-way). */
  leaseMs: 5 * 60 * 1000,
  batch: 20,
} as const;
