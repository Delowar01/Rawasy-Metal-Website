/**
 * A submission's fields checked against the form's working definition (A7.5): the same rules the visitor's browser
 * applies on today's form (`QuoteForm.tsx`'s `validate` and `maxLength` attributes), held on the server — required
 * fields, lengths (code points, after trimming), today's email and phone rules (any script's digits, 8 to 15), the
 * service and project-type choices, the consent box — and nothing else: an unknown field name refuses the submission.
 * Messages are the form's own error texts in the submission's language. Pure functions: unit-tested.
 *
 * Text is stored as typed (trimmed, line endings normalised). Control characters and direction overrides are refused
 * (they hide or reorder what staff read); angle brackets are accepted (a visitor may write "< 5 mm"): every view and
 * the export treat the text as text, never as markup.
 */
import { PHONE_DIGITS, SERVICE_NOT_SURE, SUBMISSION_LIMITS, type Locale } from "../forms/registry.ts";
import type { FieldModel, FormModel } from "../forms/forms.ts";

/**
 * Today's email rule (QuoteForm.tsx), with the domain held to what a domain can be — letters, marks and digits of any
 * script, dots and hyphens — so no "?", "&", "#", "%" or "=" after the "@" turns the inbox's Email link into mailto
 * parameters (security review L2; the link also encodes the address, `mailtoHref`). The local part stays today's.
 */
export const EMAIL = /^[^\s@]+@[\p{L}\p{M}\p{N}.-]+\.[\p{L}\p{M}\p{N}-]{2,}$/u;
/** Today's phone characters: digits of any of the three scripts, spaces, + ( ) . - */
export const PHONE_CHARS = /^[\d\s+().\-\u0660-\u0669\u06f0-\u06f9]+$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const BIDI_CONTROL = /[\u202a-\u202e\u2066-\u2069]/;

/** Arabic-Indic and Extended Arabic-Indic digits as Latin digits (today's `latinDigits`). */
export const latinDigits = (s: string) => s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

export interface SubmittedValues {
  fullName: string;
  company: string;
  email: string;
  phone: string;
  service: string;
  projectType: string;
  requirement: string;
  location: string;
  message: string;
  consent: boolean;
}

export type FieldErrors = Record<string, string>;

/** Field names a submission may carry besides the form's fields. */
export const CONTROL_FIELDS = ["token", SUBMISSION_LIMITS.honeypot, "consent"] as const;

const length = (s: string) => [...s].length;

/**
 * Checks a submission's text fields. `services` are the choices the form offers (today's six slugs); the result holds
 * the cleaned values or the errors by field name.
 */
export function validateSubmission(
  form: FormModel,
  locale: Locale,
  fields: Record<string, unknown>,
  services: readonly string[],
): { ok: true; values: SubmittedValues } | { ok: false; errors: FieldErrors; unknown: string[] } {
  const byKey = new Map(form.fields.map((f) => [f.key, f]));
  const unknown = Object.keys(fields).filter((name) => !byKey.has(name) && !(CONTROL_FIELDS as readonly string[]).includes(name));
  if (unknown.some((name) => name === "files")) unknown.splice(unknown.indexOf("files"), 1);
  const errors: FieldErrors = {};
  const values: SubmittedValues = { fullName: "", company: "", email: "", phone: "", service: "", projectType: "", requirement: "", location: "", message: "", consent: false };
  const fail = (field: FieldModel, kind: "errorRequired" | "errorInvalid") => {
    const texts = field.texts[locale];
    errors[field.key] = texts[kind] || texts.errorRequired || texts.errorInvalid || "Check this field.";
  };
  for (const field of form.fields) {
    if (field.type === "file") continue;
    const raw = fields[field.key];
    if (raw !== undefined && typeof raw !== "string") {
      fail(field, "errorInvalid");
      continue;
    }
    const multiline = field.type === "textarea";
    const value = (raw ?? "").replace(/\r\n?/g, "\n").trim();
    if (CONTROL.test(value.replace(multiline ? /[\n\t]/g : /\t/g, "")) || BIDI_CONTROL.test(value) || (!multiline && value.includes("\n"))) {
      fail(field, "errorInvalid");
      continue;
    }
    if (!value) {
      if (field.isRequired) fail(field, "errorRequired");
      continue;
    }
    const min = field.minLength ?? 0;
    const max = field.maxLength ?? field.bounds?.ceiling ?? 200;
    if (field.type === "email") {
      if (length(value) > max || !EMAIL.test(value)) fail(field, "errorInvalid");
    } else if (field.type === "tel") {
      const digits = latinDigits(value).replace(/\D/g, "").length;
      if (length(value) > max || !PHONE_CHARS.test(value) || digits < PHONE_DIGITS.min || digits > PHONE_DIGITS.max) fail(field, "errorInvalid");
    } else if (field.type === "service_select") {
      if (value !== SERVICE_NOT_SURE && !services.includes(value)) fail(field, "errorInvalid");
    } else if (field.type === "select") {
      if (!(field.options ?? []).includes(value)) fail(field, "errorInvalid");
    } else if (length(value) < min || length(value) > max) {
      fail(field, "errorInvalid");
    }
    if (!errors[field.key] && field.key in values) (values as unknown as Record<string, string>)[field.key] = value;
  }
  if (form.settings.consentMode === "checkbox") {
    values.consent = fields.consent === "yes";
    if (!values.consent) errors.consent = form.copy[locale].consent.error || "Consent is required.";
  }
  if (unknown.length || Object.keys(errors).length) return { ok: false, errors, unknown };
  return { ok: true, values };
}

/** Every text field's size together (UTF-8 bytes): a submission is refused unread past the limit. */
export const textBytes = (fields: Record<string, unknown>) =>
  Object.values(fields).reduce<number>((sum, v) => sum + (typeof v === "string" ? Buffer.byteLength(v, "utf8") : 0), 0);
