/**
 * Form definitions (A7.1; A1 `forms`, `form_translations`, `form_fields`, `form_field_translations`): the working copy
 * of the quote form — its settings, its copy and its ten system fields, both languages.
 *
 * - Read: every signed-in role (`content.view`); change: `forms.edit` (Owner, Admin), re-decided in the transaction.
 *   Data-collection decisions are the Owner's alone (A1-SECURITY-RBAC §5.3): the delivery mode, stored attachments and
 *   the consent mode need `forms.delivery_mode`; the retention period needs `enquiries.delete`. A change of one of them
 *   by someone without that key is refused and audited; the rest of a form may be saved by an Admin.
 * - Set-up copies today's form (`copy.ts`, from `src/content/contact.ts`) into the empty root the seed created — once,
 *   audited; nothing is invented (the consent box's wording starts empty).
 * - A save is the full state of the form, decided on the form's version as the page showed it. Both languages are
 *   required (the form is drawn in both); each language's status is A3's plan from what changed and the "<language> is
 *   complete" / "does not affect the other language" boxes — never a status sent by the browser. Field order is kept
 *   inside each group (details, project, message); a locked field's "required" never changes; lengths stay inside the
 *   registry's bounds; a required field needs its error text.
 *
 * The public website never reads this (T1 = Option B): its form stays today's handoff form. The admin preview does.
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { formFieldTranslations, formFields, formTranslations, forms } from "../db/schema-forms.ts";
import { EMAIL_RE, ULID_RE } from "../builder/links.ts";
import { planTranslationStatus } from "../cms/completeness.ts";
import { contentTransaction, instantOf, rowsOf } from "../cms/store.ts";
import { ulid } from "../security/ids.ts";
import { fieldTextsSchema, quoteCopySchema, staticCopy, staticFieldTexts, type FieldTexts, type QuoteCopy } from "./copy.ts";
import { FREE_RANGE, INVALID, refuse, stale, STALE_FORM, formsAudit, versionSchema, zodIssues, type FormsChange, type Issue, type Result } from "./common.ts";
import {
  ATTACHMENT_EXTENSIONS,
  CONSENT_MODES,
  DELIVERY_MODES,
  FIELD_GROUPS,
  FORM_LIMITS,
  LOCALES,
  QUOTE_FIELDS,
  fieldDefinition,
  type ConsentMode,
  type DeliveryMode,
  type FieldGroup,
  type FieldType,
  type Locale,
} from "./registry.ts";

export type TranslationStatus = "draft" | "complete" | "needs_review";

export interface FormSettings {
  isEnabled: boolean;
  deliveryMode: DeliveryMode;
  notificationEmails: string[];
  retentionDays: number | null;
  honeypotEnabled: boolean;
  minFillSeconds: number;
  consentMode: ConsentMode;
  acceptFiles: boolean;
  maxFiles: number;
  maxFileMb: number;
  acceptedExtensions: string[];
}

export interface FieldModel {
  id: string;
  key: string;
  type: FieldType;
  group: FieldGroup;
  position: number;
  isRequired: boolean;
  isSystem: boolean;
  /** The registry's: whether "required" may change, and the length bounds (null: no length). */
  requiredLocked: boolean;
  bounds: { floor: number; ceiling: number } | null;
  minLength: number | null;
  maxLength: number | null;
  options: string[] | null;
  texts: Record<Locale, FieldTexts>;
}

export interface FormModel {
  id: string;
  key: string;
  setUp: boolean;
  lockVersion: number;
  updatedAt: Date | null;
  settings: FormSettings;
  copy: Record<Locale, QuoteCopy>;
  status: Record<Locale, TranslationStatus | null>;
  fields: FieldModel[];
}

const json = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
};

const EMPTY_FIELD_TEXTS: FieldTexts = { label: "", placeholder: "", hint: "", optionLabels: {}, errorRequired: "", errorInvalid: "" };
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** A form's working copy as stored (set up or not), by key or id; null when there is none. */
export async function readForm(db: Db, by: { key: string } | { id: string }): Promise<FormModel | null> {
  const where = "key" in by ? sql`\`key\` = ${by.key}` : sql`id = ${by.id}`;
  const [root] = await rowsOf<Record<string, unknown>>(db, sql`SELECT * FROM forms WHERE ${where}`);
  if (!root) return null;
  const id = String(root.id);
  const translations = await rowsOf<Record<string, unknown>>(db, sql`SELECT * FROM form_translations WHERE form_id = ${id}`);
  const fieldRows = await rowsOf<Record<string, unknown>>(db, sql`SELECT * FROM form_fields WHERE form_id = ${id} ORDER BY position`);
  const fieldTexts = fieldRows.length
    ? await rowsOf<Record<string, unknown>>(db, sql`SELECT t.* FROM form_field_translations t JOIN form_fields f ON f.id = t.field_id WHERE f.form_id = ${id}`)
    : [];
  const status: Record<Locale, TranslationStatus | null> = { en: null, ar: null };
  const copy = {} as Record<Locale, QuoteCopy>;
  for (const locale of LOCALES) copy[locale] = staticCopy(locale);
  for (const row of translations) {
    const locale = String(row.locale) as Locale;
    if (!LOCALES.includes(locale)) continue;
    status[locale] = String(row.translation_status) as TranslationStatus;
    copy[locale] = json<QuoteCopy>(row.copy, copy[locale]);
  }
  const fields: FieldModel[] = fieldRows.map((row) => {
    const key = String(row.field_key);
    const def = fieldDefinition(key);
    const validation = json<{ minLength?: number; maxLength?: number } | null>(row.validation, null);
    const texts = { en: { ...EMPTY_FIELD_TEXTS }, ar: { ...EMPTY_FIELD_TEXTS } } as Record<Locale, FieldTexts>;
    for (const t of fieldTexts.filter((x) => String(x.field_id) === String(row.id))) {
      const locale = String(t.locale) as Locale;
      if (!LOCALES.includes(locale)) continue;
      texts[locale] = {
        label: str(t.label),
        placeholder: str(t.placeholder),
        hint: str(t.hint),
        optionLabels: json<Record<string, string>>(t.option_labels, {}),
        errorRequired: str(t.error_required),
        errorInvalid: str(t.error_invalid),
      };
    }
    return {
      id: String(row.id),
      key,
      type: String(row.field_type) as FieldType,
      group: String(row.group_key) as FieldGroup,
      position: Number(row.position),
      isRequired: Boolean(Number(row.is_required)),
      isSystem: Boolean(Number(row.is_system)),
      requiredLocked: def?.requiredLocked ?? true,
      bounds: def?.length ? { floor: def.length.floor, ceiling: def.length.max } : null,
      minLength: validation?.minLength ?? null,
      maxLength: validation?.maxLength ?? null,
      options: json<string[] | null>(row.options, null),
      texts,
    };
  });
  return {
    id,
    key: String(root.key),
    setUp: status.en !== null && status.ar !== null && fields.length > 0,
    lockVersion: Number(root.lock_version),
    updatedAt: instantOf(root.updated_at),
    settings: {
      isEnabled: Boolean(Number(root.is_enabled)),
      deliveryMode: String(root.delivery_mode) as DeliveryMode,
      notificationEmails: json<string[]>(root.notification_emails, []),
      retentionDays: root.retention_days === null || root.retention_days === undefined ? null : Number(root.retention_days),
      honeypotEnabled: Boolean(Number(root.honeypot_enabled)),
      minFillSeconds: Number(root.min_fill_seconds),
      consentMode: String(root.consent_mode) as ConsentMode,
      acceptFiles: Boolean(Number(root.accept_files)),
      maxFiles: Number(root.max_files),
      maxFileMb: Number(root.max_file_mb),
      acceptedExtensions: String(root.accepted_extensions ?? "").split(",").filter(Boolean),
    },
    copy,
    status,
    fields,
  };
}

/** The form's root, FOR UPDATE (every change to the form, its copy or its fields). */
export async function lockForm(tx: Db, id: string): Promise<{ lockVersion: number; key: string } | null> {
  const [row] = await rowsOf<{ lock_version: number; key: string }>(tx, sql`SELECT lock_version, \`key\` FROM forms WHERE id = ${id} FOR UPDATE`);
  return row ? { lockVersion: Number(row.lock_version), key: String(row.key) } : null;
}

const bumpForm = (tx: Db, id: string, actorId: string, now: Date) =>
  tx.execute(sql`UPDATE forms SET lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actorId} WHERE id = ${id}`);

const formEvent = (id: string, key: string, action: string) => ({ action, type: "form" as const, id, label: key === "quote" ? "Quote request form" : key });

/** Set the form up from today's (once). */
export async function setUpForm(change: FormsChange, id: string): Promise<Result<{ id: string; lockVersion: number }>> {
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<Result<{ id: string; lockVersion: number }>> => {
    const root = await lockForm(tx, id);
    if (!root) return { kind: "not_found" };
    const event = formEvent(id, root.key, "form.setup");
    if (!actor.permissions.has("forms.edit")) return refuse(tx, change, now, event, "Setting up a form needs a permission you don't hold.");
    const current = await readForm(tx, { id });
    if (current?.setUp) return { kind: "ok", id, lockVersion: root.lockVersion, summary: "The form was already set up." };
    await tx.delete(formFields).where(eq(formFields.formId, id));
    await tx.delete(formTranslations).where(eq(formTranslations.formId, id));
    for (const [i, def] of QUOTE_FIELDS.entries()) {
      const fieldId = ulid(now.getTime());
      await tx.insert(formFields).values({
        id: fieldId,
        formId: id,
        fieldKey: def.key,
        fieldType: def.type,
        groupKey: def.group,
        position: i + 1,
        isRequired: def.required,
        isSystem: true,
        validation: def.length ? { minLength: def.length.min, maxLength: def.length.max } : null,
        options: def.options ? [...def.options] : null,
        createdBy: actor.user.id,
        updatedBy: actor.user.id,
        createdAt: now,
        updatedAt: now,
      });
      for (const locale of LOCALES) await writeFieldTexts(tx, fieldId, locale, staticFieldTexts(def, locale), "complete", true, actor.user.id, now);
    }
    for (const locale of LOCALES) await writeCopy(tx, id, locale, staticCopy(locale), "complete", true, actor.user.id, now);
    await bumpForm(tx, id, actor.user.id, now);
    await formsAudit(tx, change, now, { ...event, summary: "Set up the form from today's website (its texts and ten fields, both languages).", changes: { fields: QUOTE_FIELDS.length } });
    return { kind: "ok", id, lockVersion: root.lockVersion + 1, summary: "The form now holds today's website. Nothing changed for visitors." };
  });
}

async function writeCopy(tx: Db, formId: string, locale: Locale, copy: QuoteCopy, status: TranslationStatus, completedNow: boolean, actorId: string, now: Date) {
  const completion = status === "draft" ? { completedAt: null, completedBy: null } : completedNow ? { completedAt: now, completedBy: actorId } : {};
  await tx
    .insert(formTranslations)
    .values({ formId, locale, copy, translationStatus: status, completedAt: completedNow ? now : null, completedBy: completedNow ? actorId : null, updatedAt: now, updatedBy: actorId })
    .onDuplicateKeyUpdate({ set: { copy, translationStatus: status, ...completion, updatedAt: now, updatedBy: actorId } });
}

async function writeFieldTexts(tx: Db, fieldId: string, locale: Locale, texts: FieldTexts, status: TranslationStatus, completedNow: boolean, actorId: string, now: Date) {
  const values = {
    label: texts.label,
    placeholder: texts.placeholder || null,
    hint: texts.hint || null,
    optionLabels: Object.keys(texts.optionLabels).length ? texts.optionLabels : null,
    errorRequired: texts.errorRequired || null,
    errorInvalid: texts.errorInvalid || null,
  };
  const completion = status === "draft" ? { completedAt: null, completedBy: null } : completedNow ? { completedAt: now, completedBy: actorId } : {};
  await tx
    .insert(formFieldTranslations)
    .values({ fieldId, locale, ...values, translationStatus: status, completedAt: completedNow ? now : null, completedBy: completedNow ? actorId : null, updatedAt: now, updatedBy: actorId })
    .onDuplicateKeyUpdate({ set: { ...values, translationStatus: status, ...completion, updatedAt: now, updatedBy: actorId } });
}

// --- Saving ------------------------------------------------------------------------------------------------------------

const emailSchema = z
  .string()
  .max(254)
  .transform((v) => v.trim())
  .refine((v) => EMAIL_RE.test(v), { message: "Enter one email address (name@example.com)." });

const fieldInputSchema = z
  .object({
    id: z.string().regex(ULID_RE, "The field list couldn't be read. Reload the page."),
    isRequired: z.boolean(),
    minLength: z.number().int().min(0).max(10_000).nullable(),
    maxLength: z.number().int().min(0).max(10_000).nullable(),
    texts: z.object({ en: fieldTextsSchema, ar: fieldTextsSchema }).strict(),
  })
  .strict();

export const formInputSchema = z
  .object({
    expectedVersion: versionSchema,
    settings: z
      .object({
        isEnabled: z.boolean(),
        deliveryMode: z.enum(DELIVERY_MODES),
        notificationEmails: z.array(emailSchema).max(FORM_LIMITS.notificationEmails, { message: `At most ${FORM_LIMITS.notificationEmails} addresses.` }),
        retentionDays: z
          .number()
          .int()
          .min(FORM_LIMITS.retentionDays.min, { message: `At least ${FORM_LIMITS.retentionDays.min} days.` })
          .max(FORM_LIMITS.retentionDays.max, { message: `At most ${FORM_LIMITS.retentionDays.max} days.` })
          .nullable(),
        honeypotEnabled: z.boolean(),
        minFillSeconds: z.number().int().min(FORM_LIMITS.minFillSeconds.min).max(FORM_LIMITS.minFillSeconds.max),
        consentMode: z.enum(CONSENT_MODES),
        acceptFiles: z.boolean(),
        maxFiles: z.number().int().min(FORM_LIMITS.maxFiles.min).max(FORM_LIMITS.maxFiles.max),
        maxFileMb: z.number().int().min(FORM_LIMITS.maxFileMb.min).max(FORM_LIMITS.maxFileMb.max),
        acceptedExtensions: z.array(z.enum(ATTACHMENT_EXTENSIONS as [string, ...string[]])).max(ATTACHMENT_EXTENSIONS.length),
      })
      .strict(),
    copy: z.object({ en: quoteCopySchema, ar: quoteCopySchema }).strict(),
    fields: z.array(fieldInputSchema).max(20),
    complete: z.object({ en: z.boolean(), ar: z.boolean() }).strict(),
    otherUnaffected: z.boolean(),
  })
  .strict();

export type FormInput = z.input<typeof formInputSchema>;

const SETTING_KEYS = ["isEnabled", "deliveryMode", "notificationEmails", "retentionDays", "honeypotEnabled", "minFillSeconds", "consentMode", "acceptFiles", "maxFiles", "maxFileMb", "acceptedExtensions"] as const;
/** The settings only the Owner decides (data collection), and the key each needs. */
const OWNER_SETTINGS: Partial<Record<(typeof SETTING_KEYS)[number], string>> = {
  deliveryMode: "forms.delivery_mode",
  acceptFiles: "forms.delivery_mode",
  acceptedExtensions: "forms.delivery_mode",
  consentMode: "forms.delivery_mode",
  retentionDays: "enquiries.delete",
};
const SETTING_NAMES: Record<(typeof SETTING_KEYS)[number], string> = {
  isEnabled: "whether the form is on",
  deliveryMode: "the delivery mode",
  notificationEmails: "the notification addresses",
  retentionDays: "the retention period",
  honeypotEnabled: "the hidden spam field",
  minFillSeconds: "the minimum fill time",
  consentMode: "the consent mode",
  acceptFiles: "stored attachments",
  maxFiles: "the number of files",
  maxFileMb: "the file size",
  acceptedExtensions: "the accepted file types",
};
/** JSON with object keys sorted: two values are the same whatever order their keys were written in. */
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value as object)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
          .join(",")}}`
      : JSON.stringify(value ?? null);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** Save a form (its full state), decided on the version its page showed. */
export async function saveForm(change: FormsChange, id: string, raw: unknown): Promise<Result<{ id: string; lockVersion: number }>> {
  const parsed = formInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: INVALID, issues: zodIssues(parsed.error) };
  const input = parsed.data;
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<Result<{ id: string; lockVersion: number }>> => {
    const root = await lockForm(tx, id);
    if (!root) return { kind: "not_found" };
    const event = formEvent(id, root.key, "form.update");
    if (!actor.permissions.has("forms.edit")) return refuse(tx, change, now, event, "Editing a form needs a permission you don't hold.");
    if (root.lockVersion !== input.expectedVersion) return stale(tx, change, now, event, input.expectedVersion, root.lockVersion, STALE_FORM);
    const stored = await readForm(tx, { id });
    if (!stored?.setUp) return { kind: "invalid", message: "Set the form up from today's website first.", issues: [] };

    // The Owner's decisions: refused (and audited) when changed by someone without their key.
    const settings = { ...input.settings, notificationEmails: [...new Set(input.settings.notificationEmails)], acceptedExtensions: ATTACHMENT_EXTENSIONS.filter((e) => input.settings.acceptedExtensions.includes(e)) };
    const changedSettings = SETTING_KEYS.filter((key) => !same(settings[key], stored.settings[key]));
    const forbidden = changedSettings.filter((key) => OWNER_SETTINGS[key] && !actor.permissions.has(OWNER_SETTINGS[key]!));
    if (forbidden.length) return refuse(tx, change, now, event, `Changing ${forbidden.map((k) => SETTING_NAMES[k]).join(", ")} is the Owner's decision.`);

    const issues: Issue[] = [];
    if (settings.deliveryMode === "store_and_notify" && settings.notificationEmails.length === 0) issues.push({ path: "settings.notificationEmails", message: "Add at least one address to notify." });
    if (settings.acceptFiles && settings.acceptedExtensions.length === 0) issues.push({ path: "settings.acceptedExtensions", message: "Choose at least one file type, or turn stored attachments off." });
    if (settings.consentMode === "checkbox")
      for (const locale of LOCALES) {
        if (!input.copy[locale].consent.label) issues.push({ path: `copy.${locale}.consent.label`, message: "The consent box needs its wording in both languages (RAWASY's text)." });
        if (!input.copy[locale].consent.error) issues.push({ path: `copy.${locale}.consent.error`, message: "The consent box needs its message for an unticked box in both languages." });
      }

    // Fields: exactly the stored ones; order kept inside each group; the registry's rules.
    const storedById = new Map(stored.fields.map((f) => [f.id, f]));
    const ids = input.fields.map((f) => f.id);
    if (ids.length !== stored.fields.length || new Set(ids).size !== ids.length || ids.some((fid) => !storedById.has(fid))) {
      issues.push({ path: "fields", message: "The field list changed. Reload the page." });
      return { kind: "invalid", message: INVALID, issues };
    }
    const ordered = [...input.fields.entries()]
      .sort(([ia, a], [ib, b]) => FIELD_GROUPS.indexOf(storedById.get(a.id)!.group) - FIELD_GROUPS.indexOf(storedById.get(b.id)!.group) || ia - ib)
      .map(([, f]) => f);
    for (const [i, field] of input.fields.entries()) {
      const s = storedById.get(field.id)!;
      const at = `fields.${i}`;
      if (s.requiredLocked && field.isRequired !== s.isRequired) issues.push({ path: `${at}.isRequired`, message: `Whether "${s.texts.en.label || s.key}" is required can't change.` });
      if (s.bounds) {
        const min = field.minLength ?? 0;
        const max = field.maxLength ?? s.bounds.ceiling;
        if (min < s.bounds.floor) issues.push({ path: `${at}.minLength`, message: `At least ${s.bounds.floor}.` });
        if (max > s.bounds.ceiling) issues.push({ path: `${at}.maxLength`, message: `At most ${s.bounds.ceiling}.` });
        if (min > max) issues.push({ path: `${at}.minLength`, message: "The minimum can't be above the maximum." });
        if (max < 1) issues.push({ path: `${at}.maxLength`, message: "At least 1." });
      } else if (field.minLength !== null || field.maxLength !== null) {
        issues.push({ path: `${at}.maxLength`, message: "This field has no length." });
      }
      for (const locale of LOCALES) {
        const texts = field.texts[locale];
        if (field.isRequired && !texts.errorRequired) issues.push({ path: `${at}.texts.${locale}.errorRequired`, message: "A required field needs its message for a missing answer." });
        const options = s.options ?? [];
        const keys = Object.keys(texts.optionLabels);
        if (keys.length !== options.length || options.some((o) => !texts.optionLabels[o])) issues.push({ path: `${at}.texts.${locale}.optionLabels`, message: "Each choice needs its label." });
      }
    }
    if (issues.length) return { kind: "invalid", message: INVALID, issues };

    // Writes: settings, field order and rules, texts; each language's status from A3's plan.
    await tx
      .update(forms)
      .set({
        isEnabled: settings.isEnabled,
        deliveryMode: settings.deliveryMode,
        notificationEmails: settings.notificationEmails.length ? settings.notificationEmails : null,
        retentionDays: settings.retentionDays,
        honeypotEnabled: settings.honeypotEnabled,
        minFillSeconds: settings.minFillSeconds,
        consentMode: settings.consentMode,
        acceptFiles: settings.acceptFiles,
        maxFiles: settings.maxFiles,
        maxFileMb: settings.maxFileMb,
        acceptedExtensions: settings.acceptedExtensions.join(","),
      })
      .where(eq(forms.id, id));
    const orderChanged = ordered.some((f, i) => storedById.get(f.id)!.position !== i + 1);
    if (orderChanged) await tx.execute(sql`UPDATE form_fields SET position = position + ${FREE_RANGE} WHERE form_id = ${id}`);
    const ruleChanges: string[] = [];
    for (const [i, field] of ordered.entries()) {
      const s = storedById.get(field.id)!;
      const validation = s.bounds ? { minLength: field.minLength ?? 0, maxLength: field.maxLength ?? s.bounds.ceiling } : null;
      if (field.isRequired !== s.isRequired || !same(validation, s.bounds ? { minLength: s.minLength ?? 0, maxLength: s.maxLength ?? s.bounds.ceiling } : null)) ruleChanges.push(s.key);
      if (orderChanged || ruleChanges.includes(s.key))
        await tx.update(formFields).set({ position: i + 1, isRequired: field.isRequired, validation, updatedAt: now, updatedBy: actor.user.id }).where(eq(formFields.id, field.id));
    }
    const changed = { en: false, ar: false } as Record<Locale, boolean>;
    for (const locale of LOCALES) {
      changed[locale] = !same(input.copy[locale], stored.copy[locale]) || input.fields.some((f) => !same(f.texts[locale], storedById.get(f.id)!.texts[locale]));
    }
    const plan = planTranslationStatus({
      previous: stored.status,
      changed,
      marked: input.complete,
      filled: { en: true, ar: true },
      exists: { en: true, ar: true },
      otherUnaffected: input.otherUnaffected,
    });
    const changedLocales: Locale[] = [];
    for (const locale of LOCALES) {
      const status = plan.status[locale] ?? "draft";
      const statusChanged = stored.status[locale] !== status || plan.completedNow[locale];
      if (changed[locale] || statusChanged) changedLocales.push(locale);
      if (!changed[locale] && !statusChanged) continue;
      await writeCopy(tx, id, locale, input.copy[locale], status, plan.completedNow[locale], actor.user.id, now);
      for (const field of input.fields) await writeFieldTexts(tx, field.id, locale, field.texts[locale], status, plan.completedNow[locale], actor.user.id, now);
    }
    await bumpForm(tx, id, actor.user.id, now);
    const parts = [...changedSettings.map((k) => SETTING_NAMES[k]), ...(orderChanged ? ["field order"] : []), ...(ruleChanges.length ? [`rules of ${ruleChanges.join(", ")}`] : []), ...changedLocales.map((l) => (l === "en" ? "English" : "Arabic"))];
    await formsAudit(tx, change, now, {
      ...event,
      summary: `Edited the form${parts.length ? ` (${parts.join("; ")})` : " (no change)"}.`,
      changes: { settings: changedSettings, order: orderChanged, rules: ruleChanges, locales: changedLocales },
    });
    return { kind: "ok", id, lockVersion: root.lockVersion + 1, summary: "Saved. The preview shows the change; visitors still see today's form." };
  });
}

/** The forms list (one row per form). */
export async function listForms(db: Db): Promise<{ id: string; key: string; deliveryMode: DeliveryMode; isEnabled: boolean; setUp: boolean; updatedAt: Date | null }[]> {
  const rows = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT f.id, f.\`key\`, f.delivery_mode, f.is_enabled, f.updated_at,
               (SELECT COUNT(*) FROM form_translations t WHERE t.form_id = f.id) AS translations,
               (SELECT COUNT(*) FROM form_fields x WHERE x.form_id = f.id) AS fields
        FROM forms f ORDER BY f.\`key\``,
  );
  return rows.map((r) => ({
    id: String(r.id),
    key: String(r.key),
    deliveryMode: String(r.delivery_mode) as DeliveryMode,
    isEnabled: Boolean(Number(r.is_enabled)),
    setUp: Number(r.translations) >= LOCALES.length && Number(r.fields) > 0,
    updatedAt: instantOf(r.updated_at),
  }));
}
