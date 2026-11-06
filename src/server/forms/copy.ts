/**
 * The quote form's working copy (A7.1): the form's own texts per language (`form_translations.copy`), each field's
 * texts (`form_field_translations`), today's form in those shapes (what set-up copies — never rewritten) and the
 * approved form component's words (`QuoteFormText`) laid together from them for the admin preview.
 *
 * Every text is A3's plain text (no markup, control or direction-override character), one line, with the form's own
 * placeholders kept: the privacy line holds `{link}` once, the file errors `{name}` once (the component fills them in).
 * Nothing here is new copy: today's words come from `src/content/contact.ts`, which holds only type imports, so the
 * Node-run tests and tools load this module as well as Next.js. The consent box's wording starts empty: it is
 * RAWASY's to write (A7 brief §5: no invented consent declaration).
 */
import { z } from "zod";
import type { QuoteFormText } from "@/components/commerce/contact/QuoteForm";
import { contactPage } from "../../content/contact.ts";
import { plainText } from "../cms/text.ts";
import { FORM_LIMITS, SERVICE_NOT_SURE, type FieldDefinition, type Locale } from "./registry.ts";

export interface QuoteCopy {
  requiredNote: string;
  groups: { details: string; project: string; message: string };
  noscript: string;
  submit: string;
  serviceOther: string;
  files: { choose: string; drop: string; remove: string; note: string; units: { kb: string; mb: string } };
  errors: { summary: string; fileType: string; fileSize: string; fileCount: string };
  ready: {
    title: string;
    body: string;
    email: string;
    whatsapp: string;
    copy: string;
    copied: string;
    copyFailed: string;
    attach: string;
    filesLine: string;
    fallback: string;
    edit: string;
    subject: string;
    preview: string;
  };
  privacy: { text: string; link: string };
  consent: { label: string; error: string };
}

export interface FieldTexts {
  label: string;
  placeholder: string;
  hint: string;
  /** { value: label } for a choice; {} otherwise. */
  optionLabels: Record<string, string>;
  errorRequired: string;
  errorInvalid: string;
}

const t = (max: number = FORM_LIMITS.copyText) => plainText(max);
const required = (max?: number) => t(max).refine((v) => v.length > 0, { message: "Required." });
/** A text that holds a placeholder exactly once (`{link}`, `{name}`): the component fills it in. */
const withPlaceholder = (token: string, max?: number) =>
  required(max).refine((v) => v.split(token).length === 2, { message: `Keep ${token} exactly once: the form puts the ${token === "{link}" ? "link" : "file name"} there.` });

export const quoteCopySchema = z
  .object({
    requiredNote: required(),
    groups: z.object({ details: required(80), project: required(80), message: required(80) }).strict(),
    noscript: required(),
    submit: required(60),
    serviceOther: required(FORM_LIMITS.option),
    files: z
      .object({
        choose: required(60),
        drop: required(60),
        remove: required(60),
        note: required(),
        units: z.object({ kb: required(20), mb: required(20) }).strict(),
      })
      .strict(),
    errors: z.object({ summary: required(FORM_LIMITS.error), fileType: withPlaceholder("{name}", FORM_LIMITS.error), fileSize: withPlaceholder("{name}", FORM_LIMITS.error), fileCount: required(FORM_LIMITS.error) }).strict(),
    ready: z
      .object({
        title: required(120),
        body: required(),
        email: required(60),
        whatsapp: required(60),
        copy: required(60),
        copied: required(60),
        copyFailed: required(FORM_LIMITS.error),
        attach: required(120),
        filesLine: required(120),
        fallback: required(),
        edit: required(60),
        subject: required(120),
        preview: required(120),
      })
      .strict(),
    privacy: z.object({ text: withPlaceholder("{link}"), link: required(80) }).strict(),
    consent: z.object({ label: t(FORM_LIMITS.consentLabel), error: t(FORM_LIMITS.error) }).strict(),
  })
  .strict();

export const fieldTextsSchema = z
  .object({
    label: required(FORM_LIMITS.label),
    placeholder: t(FORM_LIMITS.placeholder),
    hint: t(FORM_LIMITS.hint),
    optionLabels: z.record(z.string().max(32), t(FORM_LIMITS.option)),
    errorRequired: t(FORM_LIMITS.error),
    errorInvalid: t(FORM_LIMITS.error),
  })
  .strict();

// --- Today's form ----------------------------------------------------------------------------------------------------

const form = contactPage.form;

/** Today's form copy in a language (what set-up stores). The consent wording starts empty. */
export function staticCopy(locale: Locale): QuoteCopy {
  const pick = <K extends string>(record: Record<K, Record<Locale, string>>) =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [key, (value as Record<Locale, string>)[locale]])) as Record<K, string>;
  return {
    requiredNote: form.requiredNote[locale],
    groups: { details: form.groups.details[locale], project: form.groups.project[locale], message: form.groups.message[locale] },
    noscript: form.noscript[locale],
    submit: form.submit[locale],
    serviceOther: form.serviceOther[locale],
    files: {
      choose: form.files.choose[locale],
      drop: form.files.drop[locale],
      remove: form.files.remove[locale],
      note: form.files.note[locale],
      units: { kb: form.files.units.kb[locale], mb: form.files.units.mb[locale] },
    },
    errors: { summary: form.errors.summary[locale], fileType: form.errors.fileType[locale], fileSize: form.errors.fileSize[locale], fileCount: form.errors.fileCount[locale] },
    ready: pick(form.ready) as QuoteCopy["ready"],
    privacy: { text: form.privacy.text[locale], link: form.privacy.link[locale] },
    consent: { label: "", error: "" },
  };
}

type ContentField = { label: Record<Locale, string>; hint?: Record<Locale, string>; placeholder?: Record<Locale, string> };
const errorText = (key: string | undefined, locale: Locale) => (key ? (form.errors as Record<string, Record<Locale, string>>)[key]?.[locale] ?? "" : "");

/** Today's texts of a field in a language. */
export function staticFieldTexts(field: FieldDefinition, locale: Locale): FieldTexts {
  const content = (form.fields as Record<string, ContentField>)[field.key];
  return {
    label: content.label[locale],
    placeholder: content.placeholder?.[locale] ?? "",
    hint: content.hint?.[locale] ?? "",
    optionLabels: field.key === "projectType" ? Object.fromEntries(form.projectTypes.map((p) => [p.value, p.label[locale]])) : {},
    errorRequired: errorText(field.errors?.required, locale),
    errorInvalid: errorText(field.errors?.invalid, locale),
  };
}

// --- The approved component's words from a working copy ----------------------------------------------------------------

export interface WorkingField {
  key: string;
  texts: FieldTexts;
  options: readonly string[] | null;
}

/**
 * The quote form's words (`QuoteFormText`) in a language from the working copy, laid over today's (`base`, built by
 * `quoteFormText`): the form's texts, each field's texts and error messages, the service list's "not sure" label and
 * the project types' labels in the working order. The service list, the handoff form's file rules (what the visitor's
 * browser accepts) and anything a working copy does not hold stay today's.
 */
export function workingQuoteFormText(base: QuoteFormText, copy: QuoteCopy, fields: readonly WorkingField[]): QuoteFormText {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const textOf = (key: string) => byKey.get(key)?.texts;
  const fieldText = (key: keyof QuoteFormText["fields"]) => {
    const texts = textOf(key);
    if (!texts) return base.fields[key];
    return { label: texts.label, hint: texts.hint || undefined, placeholder: texts.placeholder || undefined };
  };
  const errorOf = (key: string, kind: "errorRequired" | "errorInvalid", today: string) => textOf(key)?.[kind] || today;
  const projectType = byKey.get("projectType");
  return {
    ...base,
    requiredNote: copy.requiredNote,
    groups: { ...copy.groups },
    noscript: copy.noscript,
    fields: Object.fromEntries((Object.keys(base.fields) as (keyof QuoteFormText["fields"])[]).map((key) => [key, fieldText(key)])) as QuoteFormText["fields"],
    services: base.services.map((s) => (s.value === SERVICE_NOT_SURE ? { value: s.value, label: copy.serviceOther } : s)),
    projectTypes: projectType ? (projectType.options ?? []).map((value) => ({ value, label: projectType.texts.optionLabels[value] ?? value })) : base.projectTypes,
    files: { ...base.files, choose: copy.files.choose, drop: copy.files.drop, remove: copy.files.remove, note: copy.files.note, units: { ...copy.files.units } },
    submit: copy.submit,
    errors: {
      summary: copy.errors.summary,
      fullName: errorOf("fullName", "errorRequired", base.errors.fullName),
      email: errorOf("email", "errorRequired", base.errors.email),
      emailInvalid: errorOf("email", "errorInvalid", base.errors.emailInvalid),
      phone: errorOf("phone", "errorRequired", base.errors.phone),
      phoneInvalid: errorOf("phone", "errorInvalid", base.errors.phoneInvalid),
      service: errorOf("service", "errorRequired", base.errors.service),
      message: errorOf("message", "errorRequired", base.errors.message),
      messageShort: errorOf("message", "errorInvalid", base.errors.messageShort),
      fileType: copy.errors.fileType,
      fileSize: copy.errors.fileSize,
      fileCount: copy.errors.fileCount,
    },
    ready: { ...copy.ready },
    privacy: { ...copy.privacy },
  };
}
