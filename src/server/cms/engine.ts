/**
 * The Core CMS engine (A3): one implementation of create, edit, archive and restore for every content type, so the
 * rules hold the same way everywhere —
 *
 * - **Authority from the session only.** Actor ids, statuses and versions are never read from the form; each schema
 *   reads only the fields it defines (no mass assignment). Every change runs in `contentTransaction` (the acting user
 *   still active, the session still live) and checks its permission from the registry (record-level for legal pages).
 * - **No silent overwrite (A3 brief §12).** The form sends the item's `lock_version` as it opened it; the save, archive
 *   and restore are refused when it moved on ("stale"), and the person's typed values stay in their form.
 * - **Archived items are read-only** until restored (A1 T12/T13); nothing in A3 can make an item public.
 * - **Languages are equals (A1 §3.2).** Each language has its own state; neither is required to save a draft; a
 *   language is marked complete only when its required fields are filled; changing one language of a complete item asks
 *   for the other's review unless the editor says it is not affected.
 * - **Relations** are checked (exist, no duplicates, archived ones may stay but not be added) and written in order.
 * - Every successful change and every refusal that matters is in the audit log, without long texts.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AnyMySqlColumn, AnyMySqlTable } from "drizzle-orm/mysql-core";
import { z } from "zod";
import type { Actor, RequestMeta } from "../auth/types.ts";
import type { Db } from "../db/client.ts";
import { ulid, isUlid } from "../security/ids.ts";
import { planTranslationStatus, sameValue, localeState, type LocaleState, type TranslationStatus } from "./completeness.ts";
import { fieldName, type FormObject } from "./form.ts";
import { can, isFixedPage } from "./permissions.ts";
import { ENTITIES, LIMITS, LOCALES, type EntityType, type Locale, type PageType } from "./registry.ts";
import { checkSlug } from "./slug.ts";
import {
  appendToOrdering,
  checkTargets,
  contentAudit,
  contentTransaction,
  duplicateKey,
  labelOf,
  lockRoot,
  readRelation,
  rebuildSearch,
  replaceRelation,
  setArchived,
  slugTaken,
  touchOrdering,
  type CmsDeps,
  type FieldErrors,
  type RelationTable,
  type SaveResult,
} from "./store.ts";
import { digitGuardProblem, docToPlain, EMPTY_DOC, isDocEmpty, linesList, plainText, richTextFromPlain, sitePathProblem, storedLines } from "./text.ts";
import { diffOrdered } from "./reorder.ts";
import type { AnchorNamespace } from "../../i18n/reserved-slugs.ts";

// --- Specifications ----------------------------------------------------------------------------------------------------

export type TextKind = "line" | "text" | "rich" | "lines";

/** A translated field: its column (property name), how it is edited and checked, and what completeness needs. */
export interface TrField {
  key: string;
  label: string;
  kind: TextKind;
  /** Characters (rich text: per paragraph; lines: per line). */
  max: number;
  /** Required for the language to be complete (a NOT NULL column holding "" while missing). */
  required?: boolean;
  /** Nullable column: stored NULL when empty (optional facts, A1 §3.5). */
  optional?: boolean;
  /** Lines: at most this many. */
  maxItems?: number;
  /** Public certificate text: the digit guard applies. */
  digitGuard?: boolean;
  /** Included in the admin search body. */
  search?: boolean;
  /** Shown in the SEO section of the editor. */
  seo?: boolean;
  hint?: string;
}

/**
 * A refusal that another record's state imposes on a relation change (A3 Correction 1): its message goes on the
 * relation's field and its summary into a failed audit event — names and slugs only, never long texts.
 */
export interface RelationRefusal {
  message: string;
  summary: string;
  changes?: Record<string, unknown>;
}

export interface RelationSpec {
  key: string;
  label: string;
  target: EntityType;
  table: RelationTable;
  max: number;
  /** A relation from a type to itself (related services): the item may not list itself. */
  self?: boolean;
  /**
   * An extra rule on the chosen targets (featured projects must list the service; a project keeps a service that
   * features it). Runs after `checkTargets`, with the item's root row locked and before any write; a string is an
   * input problem, a `RelationRefusal` a cross-record refusal (also audited).
   */
  check?: (db: Db, ownerId: string | null, ids: readonly string[], before: readonly string[]) => Promise<string | RelationRefusal | null>;
  hint?: string;
}

/** Ordered child items with label/value texts per language (certificate facts, machine attributes). */
export interface ChildSpec {
  key: "facts" | "attributes";
  label: string;
  table: AnyMySqlTable;
  idColumn: AnyMySqlColumn;
  parentColumn: AnyMySqlColumn;
  positionColumn: AnyMySqlColumn;
  parentKey: string;
  trTable: AnyMySqlTable;
  trParentColumn: AnyMySqlColumn;
  trLocaleColumn: AnyMySqlColumn;
  trParentKey: string;
  max: number;
  labelMax: number;
  valueMax: number;
  digitGuard?: boolean;
}

export interface KindSpec {
  type: EntityType;
  /** Where the slug is used: generic pages (reserved routes), an anchor namespace, or a plain unique slug. */
  slugNamespace: "page" | AnchorNamespace | null;
  hasSource: boolean;
  hasSeo: boolean;
  root: AnyMySqlTable;
  rootId: AnyMySqlColumn;
  tr: AnyMySqlTable;
  trParentColumn: AnyMySqlColumn;
  trLocaleColumn: AnyMySqlColumn;
  trParentKey: string;
  fields: readonly TrField[];
  /** The field used as the item's title (lists, audit, search). */
  titleKey: string;
  /** Root fields of this type (validated; column property → schema). Slug, provenance and SEO are handled here. */
  rootShape: z.ZodRawShape;
  /** Root columns to write from the parsed root fields (pages: decided with the record's own page type). */
  rootColumns: (input: Record<string, unknown>, context: { pageType?: PageType }) => Record<string, unknown>;
  /** The stored root columns as the same comparable values. */
  rootValues: (row: Record<string, unknown>) => Record<string, unknown>;
  /** Labels of root fields for audit change lists. */
  rootLabels: Record<string, string>;
  relations?: readonly RelationSpec[];
  children?: ChildSpec;
  /** Extra checks of the parsed root fields against the database (field → message). */
  checkRoot?: (db: Db, input: Record<string, unknown>, itemId: string | null) => Promise<FieldErrors>;
}

// --- Parsing ---------------------------------------------------------------------------------------------------------

const ULID = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const checkbox = z.string().max(16).optional().transform((v) => v !== undefined);
const emptyAsUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

function fieldSchema(field: TrField) {
  let schema: z.ZodType;
  switch (field.kind) {
    case "line":
      schema = plainText(field.max);
      break;
    case "text":
      schema = plainText(field.max, { multiline: true });
      break;
    case "rich":
      schema = richTextFromPlain(field.max, LIMITS.text.paragraphs);
      break;
    case "lines":
      schema = linesList(field.maxItems ?? 8, field.max);
      break;
  }
  if (field.digitGuard) {
    schema = schema.superRefine((value, ctx) => {
      const text = typeof value === "string" ? value : Array.isArray(value) ? value.join("\n") : docToPlain(value);
      const problem = digitGuardProblem(text);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    });
  }
  return z.preprocess((v) => (v === undefined ? "" : v), schema);
}

const childSchema = (spec: ChildSpec) => {
  const text = (max: number) => {
    let s: z.ZodType<string> = plainText(max);
    if (spec.digitGuard) {
      s = s.superRefine((value, ctx) => {
        const problem = digitGuardProblem(value);
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      });
    }
    return z.preprocess((v) => (v === undefined || v === null ? "" : v), s);
  };
  const pair = z.object({ label: text(spec.labelMax), value: text(spec.valueMax) }).strict();
  return z
    .string()
    .max(200_000)
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return [];
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "The list could not be read. Reload the page." });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(z.object({ id: ULID.nullable().optional(), en: pair, ar: pair }).strict())
        .max(spec.max, `Use at most ${spec.max} entries.`),
    );
};

/** SEO fields only robots/canonical/sitemap holders may change (`seo.advanced`); sent with the marker `seo.advanced`. */
const seoAdvancedShape = {
  advanced: z.string().max(4).optional(),
  robotsIndex: checkbox,
  robotsFollow: checkbox,
  inSitemap: checkbox,
  canonicalOverride: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string()
      .max(255)
      .optional()
      .superRefine((value, ctx) => {
        if (value) {
          const problem = sitePathProblem(value);
          if (problem) ctx.addIssue({ code: "custom", message: problem });
        }
      }),
  ),
};

export const SOURCE_SHAPE = {
  sourceBasis: z.preprocess(emptyAsUndefined, z.enum(["profile", "licence", "owner", "inferred", "other"]).optional()),
  sourcePages: z.preprocess(
    emptyAsUndefined,
    z
      .string()
      .max(LIMITS.text.sourcePages)
      .regex(/^[0-9][0-9 ,–-]*$/, "Pages as numbers, e.g. 7 or 8-11.")
      .optional(),
  ),
  sourceNote: z.preprocess((v) => (v === undefined ? "" : v), plainText(LIMITS.text.sourceNote, { multiline: true })),
};

export function inputSchema(spec: KindSpec, mode: "create" | "update") {
  const locale = z.object({
    ...Object.fromEntries(spec.fields.map((f) => [f.key, fieldSchema(f)])),
    complete: checkbox,
  });
  const relations = Object.fromEntries((spec.relations ?? []).map((r) => [r.key, z.array(ULID).max(r.max * 2).optional().default([])]));
  return z.object({
    ...(mode === "update" ? { lockVersion: z.coerce.number().int().min(0).max(2_147_483_647) } : {}),
    slug: z.string().max(400).optional(),
    en: z.preprocess((v) => v ?? {}, locale),
    ar: z.preprocess((v) => v ?? {}, locale),
    otherUnaffected: checkbox,
    rel: z.preprocess((v) => v ?? {}, z.object(relations)),
    ...(spec.children ? { children: childSchema(spec.children) } : {}),
    ...(spec.hasSeo ? { seo: z.preprocess((v) => v ?? {}, z.object(seoAdvancedShape)) } : {}),
    ...(spec.hasSource ? SOURCE_SHAPE : {}),
    ...spec.rootShape,
  });
}

type LocaleValues = Record<string, unknown>;
interface ChildValue {
  id?: string | null;
  en: { label: string; value: string };
  ar: { label: string; value: string };
}

export interface ParsedInput {
  lockVersion?: number;
  slug?: string;
  en: LocaleValues & { complete: boolean };
  ar: LocaleValues & { complete: boolean };
  otherUnaffected: boolean;
  rel: Record<string, string[]>;
  children?: ChildValue[];
  seo?: { advanced?: string; robotsIndex: boolean; robotsFollow: boolean; inSitemap: boolean; canonicalOverride?: string };
  [key: string]: unknown;
}

export type ParseResult = { ok: true; input: ParsedInput } | { ok: false; errors: FieldErrors };

/** Validates a form against the type's schema; errors are keyed by the form's field names. */
export function parseInput(spec: KindSpec, mode: "create" | "update", form: FormObject): ParseResult {
  const parsed = inputSchema(spec, mode).safeParse(form);
  if (parsed.success) return { ok: true, input: parsed.data as unknown as ParsedInput };
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const name = fieldName(issue.path) || "form";
    errors[name] ??= issue.message;
  }
  return { ok: false, errors };
}

// --- Stored values -----------------------------------------------------------------------------------------------------

const fieldEmpty = (field: TrField, value: unknown) => {
  if (value === null || value === undefined) return true;
  if (field.kind === "rich") return isDocEmpty(value);
  if (field.kind === "lines") return storedLines(value).length === 0;
  return String(value).trim() === "";
};

/** The value to store for a field: "" / empty document / [] while missing, NULL for optional facts. */
function columnValue(field: TrField, value: unknown): unknown {
  const empty = fieldEmpty(field, value);
  if (field.kind === "rich") return empty ? (field.optional ? null : EMPTY_DOC) : value;
  if (field.kind === "lines") return empty ? [] : value;
  if (empty) return field.optional ? null : "";
  return value;
}

/** A stored value as comparable input (rich text and lines as stored JSON). */
const storedValue = (field: TrField, value: unknown) => {
  if (field.kind === "rich") return isDocEmpty(value) ? null : value;
  if (field.kind === "lines") return storedLines(value);
  return value ?? "";
};

/** The editor's value of a stored field (rich text as plain text, lines one per line). */
export function editorValue(field: TrField, value: unknown): string {
  if (field.kind === "rich") return docToPlain(value);
  if (field.kind === "lines") return storedLines(value).join("\n");
  return value === null || value === undefined ? "" : String(value);
}

export interface StoredItem {
  root: Record<string, unknown>;
  tr: Record<Locale, Record<string, unknown> | null>;
  rel: Record<string, string[]>;
  children: { id: string; position: number; tr: Record<Locale, { label: string; value: string } | null> }[];
}

export async function readStored(db: Db, spec: KindSpec, id: string): Promise<StoredItem | null> {
  const [root] = (await db.select().from(spec.root).where(eq(spec.rootId, id))) as Record<string, unknown>[];
  if (!root || root.deletedAt) return null;
  const trRows = (await db.select().from(spec.tr).where(eq(spec.trParentColumn, id))) as Record<string, unknown>[];
  const tr = { en: null, ar: null } as StoredItem["tr"];
  for (const row of trRows) if (LOCALES.includes(row.locale as Locale)) tr[row.locale as Locale] = row;
  const rel: Record<string, string[]> = {};
  for (const relation of spec.relations ?? []) rel[relation.key] = await readRelation(db, relation.table, id);
  const children: StoredItem["children"] = [];
  if (spec.children) {
    const c = spec.children;
    const items = (await db.select().from(c.table).where(eq(c.parentColumn, id)).orderBy(c.positionColumn)) as Record<string, unknown>[];
    const ids = items.map((i) => String(i.id));
    const trs = ids.length ? ((await db.select().from(c.trTable).where(inArray(c.trParentColumn, ids))) as Record<string, unknown>[]) : [];
    for (const item of items) {
      const childTr = { en: null, ar: null } as StoredItem["children"][number]["tr"];
      for (const row of trs.filter((t) => t[c.trParentKey] === item.id)) {
        childTr[row.locale as Locale] = { label: String(row.label ?? ""), value: String(row.value ?? "") };
      }
      children.push({ id: String(item.id), position: Number(item.position), tr: childTr });
    }
  }
  return { root, tr, rel, children };
}

/** Whether every required field (and every child's label and value) of a language is filled. */
export function requiredFilled(spec: KindSpec, values: Record<string, unknown> | null, children: readonly ChildValue[], locale: Locale): boolean {
  if (!values) return false;
  if (spec.fields.some((f) => f.required && fieldEmpty(f, values[f.key]))) return false;
  return children.every((c) => c[locale].label.trim() !== "" && c[locale].value.trim() !== "");
}

/** The state shown for each language of a stored item. */
export function storedStates(spec: KindSpec, item: StoredItem): Record<Locale, LocaleState> {
  const children = item.children.map((c) => ({
    en: c.tr.en ?? { label: "", value: "" },
    ar: c.tr.ar ?? { label: "", value: "" },
  }));
  return Object.fromEntries(
    LOCALES.map((l) => {
      const row = item.tr[l];
      const values = row ? Object.fromEntries(spec.fields.map((f) => [f.key, row[f.key]])) : null;
      return [l, localeState((row?.translationStatus as TranslationStatus) ?? null, requiredFilled(spec, values, children, l))];
    }),
  ) as Record<Locale, LocaleState>;
}

// --- Create and update -------------------------------------------------------------------------------------------------

export interface ChangeContext {
  deps: CmsDeps;
  actor: Actor;
  meta: RequestMeta;
}

const titleOf = (spec: KindSpec, input: ParsedInput) => {
  const en = input.en[spec.titleKey];
  const ar = input.ar[spec.titleKey];
  return (typeof en === "string" && en) || (typeof ar === "string" && ar) || "";
};

function rootChanges(spec: KindSpec, before: Record<string, unknown> | null, next: Record<string, unknown>): string[] {
  return Object.keys(next).filter((k) => !before || !sameValue(before[k], next[k])).map((k) => spec.rootLabels[k] ?? k);
}

/** The SEO fields a change would set, or a refusal when they change without `seo.advanced`. */
function seoColumns(spec: KindSpec, actor: Actor, input: ParsedInput, stored: Record<string, unknown> | null): { ok: true; columns: Record<string, unknown> } | { ok: false } {
  if (!spec.hasSeo || !input.seo?.advanced) return { ok: true, columns: {} };
  const next = {
    robotsIndex: input.seo.robotsIndex,
    robotsFollow: input.seo.robotsFollow,
    inSitemap: input.seo.inSitemap,
    canonicalOverride: input.seo.canonicalOverride || null,
  };
  const current = stored
    ? { robotsIndex: Boolean(stored.robotsIndex), robotsFollow: Boolean(stored.robotsFollow), inSitemap: Boolean(stored.inSitemap), canonicalOverride: stored.canonicalOverride ?? null }
    : { robotsIndex: true, robotsFollow: true, inSitemap: true, canonicalOverride: null };
  const changed = (Object.keys(next) as (keyof typeof next)[]).some((k) => !sameValue(next[k], current[k]));
  if (!changed) return { ok: true, columns: {} };
  if (!can(actor.permissions, spec.type, "seo_advanced")) return { ok: false };
  return { ok: true, columns: next };
}

interface Planned {
  rows: Record<Locale, Record<string, unknown> | null>;
  status: Record<Locale, TranslationStatus | null>;
  completedNow: Record<Locale, boolean>;
  changed: Record<Locale, boolean>;
}

function planTranslations(spec: KindSpec, input: ParsedInput, stored: StoredItem | null): { ok: true; plan: Planned } | { ok: false; errors: FieldErrors } {
  const children = input.children ?? [];
  const changed = {} as Record<Locale, boolean>;
  const exists = {} as Record<Locale, boolean>;
  const filled = {} as Record<Locale, boolean>;
  const rows = {} as Record<Locale, Record<string, unknown> | null>;
  for (const locale of LOCALES) {
    const values = input[locale];
    const row = Object.fromEntries(spec.fields.map((f) => [f.key, columnValue(f, values[f.key])]));
    const any = spec.fields.some((f) => !fieldEmpty(f, values[f.key])) || children.some((c) => c[locale].label || c[locale].value);
    exists[locale] = any;
    filled[locale] = requiredFilled(spec, values, children, locale);
    rows[locale] = any ? row : null;
    const before = stored?.tr[locale] ?? null;
    const fieldChanged = spec.fields.some((f) => !sameValue(before ? storedValue(f, before[f.key]) : null, storedValue(f, row[f.key])));
    const beforeChildren = (stored?.children ?? []).map((c) => [c.id, c.tr[locale]?.label ?? "", c.tr[locale]?.value ?? ""]);
    const nextChildren = children.map((c) => [c.id ?? "new", c[locale].label, c[locale].value]);
    changed[locale] = fieldChanged || JSON.stringify(beforeChildren) !== JSON.stringify(nextChildren);
  }
  const plan = planTranslationStatus({
    previous: { en: (stored?.tr.en?.translationStatus as TranslationStatus) ?? null, ar: (stored?.tr.ar?.translationStatus as TranslationStatus) ?? null },
    changed,
    marked: { en: input.en.complete, ar: input.ar.complete },
    filled,
    exists,
    otherUnaffected: input.otherUnaffected,
  });
  if (plan.refused.length) {
    // Three kinds of message (A3 brief §9): a field missing (on the field), the language incomplete (on its
    // "complete" box); invalid content was already refused field by field by the schema.
    const errors: FieldErrors = {};
    for (const locale of plan.refused) {
      const name = locale === "en" ? "English" : "Arabic";
      const missingFields = spec.fields.filter((f) => f.required && fieldEmpty(f, input[locale][f.key]));
      for (const field of missingFields) errors[`${locale}.${field.key}`] = `Required before ${name} can be marked complete.`;
      const missing = missingFields.map((f) => f.label);
      errors[`${locale}.complete`] = exists[locale]
        ? `${name} is incomplete: ${missing.length ? `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing` : `every ${spec.children?.label.toLowerCase().replace(/s$/, "") ?? "entry"} needs its ${name} label and value`}.`
        : `${name} can't be marked complete: it has no text yet.`;
      if (!missing.length && exists[locale] && spec.children) errors.children ??= `Every entry needs its ${name} label and value before ${name} can be marked complete.`;
    }
    return { ok: false, errors };
  }
  return { ok: true, plan: { rows, status: plan.status, completedNow: plan.completedNow, changed } };
}

async function writeTranslations(tx: Db, spec: KindSpec, id: string, plan: Planned, stored: StoredItem | null, actorId: string, now: Date) {
  for (const locale of LOCALES) {
    const row = plan.rows[locale];
    if (!row) {
      await tx.delete(spec.tr).where(and(eq(spec.trParentColumn, id), eq(spec.trLocaleColumn, locale)));
      continue;
    }
    const status = plan.status[locale] ?? "draft";
    const before = stored?.tr[locale] ?? null;
    const completed =
      status === "draft"
        ? { completedAt: null, completedBy: null }
        : plan.completedNow[locale]
          ? { completedAt: now, completedBy: actorId }
          : { completedAt: (before?.completedAt as Date | null) ?? null, completedBy: (before?.completedBy as string | null) ?? null };
    const values = { ...row, translationStatus: status, ...completed, updatedAt: now, updatedBy: actorId };
    await tx
      .insert(spec.tr)
      .values({ [spec.trParentKey]: id, locale, ...values } as never)
      .onDuplicateKeyUpdate({ set: values as never });
  }
}

async function writeChildren(tx: Db, spec: ChildSpec, id: string, children: readonly ChildValue[], status: Record<Locale, TranslationStatus | null>, actorId: string, now: Date) {
  const existing = (await tx.select({ id: spec.idColumn }).from(spec.table).where(eq(spec.parentColumn, id))) as { id: string }[];
  // Removed children go (their translations cascade); kept ones are renumbered through a free range first, so the
  // unique (parent, position) index never sees two rows at one position.
  const keep = new Set(children.map((c) => c.id).filter((v): v is string => Boolean(v)));
  const gone = existing.map((e) => e.id).filter((e) => !keep.has(e));
  if (gone.length) await tx.delete(spec.table).where(inArray(spec.idColumn, gone));
  if (keep.size) await tx.update(spec.table).set({ position: sql`${spec.positionColumn} + 100000` } as never).where(eq(spec.parentColumn, id));
  for (const [index, child] of children.entries()) {
    const childId = child.id ?? ulid(now.getTime());
    if (child.id) {
      await tx.update(spec.table).set({ position: index + 1 } as never).where(eq(spec.idColumn, childId));
    } else {
      await tx.insert(spec.table).values({ id: childId, [spec.parentKey]: id, position: index + 1 } as never);
    }
    for (const locale of LOCALES) {
      const text = child[locale];
      if (!text.label && !text.value) {
        await tx.delete(spec.trTable).where(and(eq(spec.trParentColumn, childId), eq(spec.trLocaleColumn, locale)));
        continue;
      }
      const values = { label: text.label, value: text.value, translationStatus: status[locale] ?? "draft", updatedAt: now, updatedBy: actorId };
      await tx
        .insert(spec.trTable)
        .values({ [spec.trParentKey]: childId, locale, ...values } as never)
        .onDuplicateKeyUpdate({ set: values as never });
    }
  }
}

function searchEntries(spec: KindSpec, input: ParsedInput, slug: string | null) {
  return LOCALES.filter((l) => spec.fields.some((f) => !fieldEmpty(f, input[l][f.key]))).map((locale) => {
    const values = input[locale];
    const title = String(values[spec.titleKey] ?? "");
    const body = [
      slug ?? "",
      ...spec.fields.filter((f) => f.search).map((f) => (f.kind === "rich" ? docToPlain(values[f.key]) : f.kind === "lines" ? storedLines(values[f.key]).join(" ") : String(values[f.key] ?? ""))),
    ].join(" ");
    return { locale, title, body };
  });
}

/** The relations' problems (field → message) and the cross-record refusals among them (audited as failed changes). */
async function checkRelations(
  db: Db,
  spec: KindSpec,
  input: ParsedInput,
  stored: StoredItem | null,
  itemId: string | null,
): Promise<{ errors: FieldErrors; refusals: RelationRefusal[] }> {
  const errors: FieldErrors = {};
  const refusals: RelationRefusal[] = [];
  for (const relation of spec.relations ?? []) {
    const next = input.rel[relation.key] ?? [];
    const before = stored?.rel[relation.key] ?? [];
    const problem =
      (await checkTargets(db, relation.target, next, before, { max: relation.max, self: relation.self ? (itemId ?? undefined) : undefined })) ??
      (relation.check ? await relation.check(db, itemId, next, before) : null);
    if (typeof problem === "string") errors[`rel.${relation.key}`] = problem;
    else if (problem) {
      errors[`rel.${relation.key}`] = problem.message;
      refusals.push(problem);
    }
  }
  return { errors, refusals };
}

/** The audit event of a change refused by other records (A3 Correction 1): one failed event, summaries joined. */
const refusalEvent = (refusals: readonly RelationRefusal[]) => ({
  summary: refusals.map((r) => r.summary).join(" "),
  changes: { refused: refusals.map((r) => r.changes ?? {}) },
});

function checkChildren(spec: KindSpec, input: ParsedInput, stored: StoredItem | null): FieldErrors {
  if (!spec.children || !input.children) return {};
  const known = new Set((stored?.children ?? []).map((c) => c.id));
  const ids = input.children.map((c) => c.id).filter((v): v is string => Boolean(v));
  if (ids.some((id) => !known.has(id)) || new Set(ids).size !== ids.length) return { children: "The list changed after the page was opened. Reload the page." };
  return {};
}

async function deniedAudit(ctx: ChangeContext, action: string, spec: KindSpec, id: string | null, label: string, summary: string) {
  await contentAudit(ctx.deps.db, ctx.actor, ctx.meta, ctx.deps.clock(), {
    action,
    type: spec.type,
    id: id ?? "new",
    label,
    outcome: "denied",
    summary,
  });
}

export interface CreateOptions {
  /** Pages: the type and system key chosen at creation (immutable afterwards). */
  page?: { pageType: PageType; systemKey: string | null; requiresLegalReview: boolean };
}

export async function createItem(ctx: ChangeContext, spec: KindSpec, form: FormObject, options: CreateOptions = {}): Promise<SaveResult> {
  const { deps, actor, meta } = ctx;
  const info = ENTITIES[spec.type];
  const pageFacts = options.page ? { pageType: options.page.pageType } : undefined;
  if (!can(actor.permissions, spec.type, "create", pageFacts)) {
    await deniedAudit(ctx, `${spec.type}.create`, spec, null, "", `Refused: creating a ${info.one} needs ${spec.type === "page" ? "page-creation rights for this page type" : `${info.resource}.edit`}.`);
    return { kind: "denied", message: `You don't have permission to create this ${info.one}.` };
  }
  const parsed = parseInput(spec, "create", form);
  if (!parsed.ok) return { kind: "invalid", errors: parsed.errors };
  const input = parsed.input;
  const usesSlug = !(spec.type === "page" && options.page && isFixedPage(options.page.pageType));
  let slug: string | null = null;
  if (usesSlug) {
    const checked = checkSlug(input.slug ?? "", spec.slugNamespace);
    if (!checked.ok) return { kind: "invalid", errors: { slug: checked.message + (checked.suggestion ? ` Suggestion: ${checked.suggestion}` : "") } };
    slug = checked.slug;
  }
  const seo = seoColumns(spec, actor, input, null);
  if (!seo.ok) {
    await deniedAudit(ctx, `${spec.type}.create`, spec, null, titleOf(spec, input), "Refused: robots, canonical or sitemap settings need seo.advanced.");
    return { kind: "denied", message: "You don't have permission to change robots, canonical or sitemap settings." };
  }
  const planned = planTranslations(spec, input, null);
  if (!planned.ok) return { kind: "invalid", errors: planned.errors };
  const rootInput = Object.fromEntries(Object.keys(spec.rootShape).map((k) => [k, input[k]]));
  try {
    return await contentTransaction(deps, actor, async (tx, now) => {
      const errors: FieldErrors = spec.checkRoot ? await spec.checkRoot(tx, rootInput, null) : {};
      const relations = await checkRelations(tx, spec, input, null, null);
      Object.assign(errors, relations.errors, checkChildren(spec, input, null));
      if (slug && (await slugTaken(tx, spec.type, slug, null))) errors.slug = `The slug “${slug}” is already used by another ${info.one} (perhaps an archived one).`;
      if (Object.keys(errors).length) {
        if (relations.refusals.length) {
          await contentAudit(tx, actor, meta, now, { action: `${spec.type}.create`, type: spec.type, id: "new", label: titleOf(spec, input) || slug, outcome: "failed", ...refusalEvent(relations.refusals) });
        }
        return { kind: "invalid", errors } as const;
      }
      const id = ulid(now.getTime());
      const source = spec.hasSource
        ? { sourceBasis: input.sourceBasis ?? null, sourcePages: input.sourcePages ?? null, sourceNote: (input.sourceNote as string) || null }
        : {};
      await tx.insert(spec.root).values({
        id,
        ...(usesSlug ? { slug } : {}),
        ...(options.page ? { pageType: options.page.pageType, systemKey: options.page.systemKey, requiresLegalReview: options.page.requiresLegalReview } : {}),
        ...spec.rootColumns(rootInput, { pageType: options.page?.pageType }),
        ...source,
        ...seo.columns,
        publicationStatus: "unpublished",
        draftStatus: "draft",
        lockVersion: 0,
        createdAt: now,
        createdBy: actor.user.id,
        updatedAt: now,
        updatedBy: actor.user.id,
      } as never);
      await writeTranslations(tx, spec, id, planned.plan, null, actor.user.id, now);
      for (const relation of spec.relations ?? []) {
        const ids = input.rel[relation.key] ?? [];
        if (ids.length) await replaceRelation(tx, relation.table, id, ids);
      }
      if (spec.children && input.children?.length) await writeChildren(tx, spec.children, id, input.children, planned.plan.status, actor.user.id, now);
      if (info.orderingKey) await appendToOrdering(tx, info.orderingKey, id, actor.user.id, now);
      await rebuildSearch(tx, spec.type, id, searchEntries(spec, input, slug ?? options.page?.systemKey ?? null), now);
      const label = labelOf(titleOf(spec, input), slug ?? options.page?.systemKey);
      await contentAudit(tx, actor, meta, now, {
        action: `${spec.type}.create`,
        type: spec.type,
        id,
        label: titleOf(spec, input) || slug,
        summary: `Created ${info.one} ${label} as a draft (not public).`,
        changes: {
          languages: LOCALES.filter((l) => planned.plan.rows[l]),
          relations: Object.fromEntries((spec.relations ?? []).map((r) => [r.key, (input.rel[r.key] ?? []).length])),
        },
      });
      return { kind: "ok", id, lockVersion: 0, summary: `Created ${label}.` } as const;
    });
  } catch (error) {
    const key = duplicateKey(error);
    if (key) return duplicateResult(key, slug);
    throw error;
  }
}

/**
 * What a duplicate-key error means for the person, by the index it names: only a slug or a system page clash is theirs
 * to fix; anything else (two changes at the same moment) is told as such, never as a slug problem (A3 review, finding 4).
 */
function duplicateResult(key: string, slug: string | null): SaveResult {
  if (/^uq_[a-z_]+_slug$/.test(key)) return { kind: "invalid", errors: { slug: `The slug “${slug ?? ""}” is already used.` } };
  if (key === "uq_pages_system_key") return { kind: "invalid", errors: { systemKey: "That system page already has a record." } };
  return { kind: "invalid", errors: { form: "Another change was saved at the same moment, so nothing was saved. Try again." } };
}

export interface UpdateOptions {
  /** Pages: decided on the stored type (record-level permission: legal pages need legal.edit). */
  pageTypeOf?: (root: Record<string, unknown>) => PageType;
}

export async function updateItem(ctx: ChangeContext, spec: KindSpec, id: string, form: FormObject, options: UpdateOptions = {}): Promise<SaveResult> {
  const { deps, actor, meta } = ctx;
  const info = ENTITIES[spec.type];
  if (!isUlid(id)) return { kind: "not_found" };
  const parsed = parseInput(spec, "update", form);
  if (!parsed.ok) return { kind: "invalid", errors: parsed.errors };
  const input = parsed.input;
  try {
    return await contentTransaction(deps, actor, async (tx, now) => {
      const state = await lockRoot(tx, spec.type, id);
      if (!state) return { kind: "not_found" } as const;
      const stored = await readStored(tx, spec, id);
      if (!stored) return { kind: "not_found" } as const;
      const pageFacts = options.pageTypeOf ? { pageType: options.pageTypeOf(stored.root) } : undefined;
      const title = String(stored.tr.en?.[spec.titleKey] || stored.tr.ar?.[spec.titleKey] || "");
      const refuse = async (summary: string, outcome: "denied" | "failed", changes?: Record<string, unknown>) => {
        await contentAudit(tx, actor, meta, now, { action: `${spec.type}.update`, type: spec.type, id, label: title || state.slug, outcome, summary, changes });
      };
      if (!can(actor.permissions, spec.type, "edit", pageFacts)) {
        await refuse(`Refused: editing this ${info.one} needs ${pageFacts?.pageType === "legal" ? "legal.edit" : `${info.resource}.edit`}.`, "denied");
        return { kind: "denied", message: `You don't have permission to edit this ${info.one}.` } as const;
      }
      if (state.publicationStatus === "archived") {
        await refuse(`Refused: the ${info.one} is archived (read-only until restored).`, "failed");
        return { kind: "archived" } as const;
      }
      if (state.lockVersion !== input.lockVersion) {
        await refuse(`Refused: the ${info.one} changed after the form was opened (version ${input.lockVersion}, now ${state.lockVersion}).`, "failed");
        return { kind: "stale" } as const;
      }
      const usesSlug = !(pageFacts && isFixedPage(pageFacts.pageType));
      let slug = state.slug;
      const errors: FieldErrors = {};
      if (usesSlug) {
        const checked = checkSlug(input.slug ?? "", spec.slugNamespace);
        if (!checked.ok) errors.slug = checked.message + (checked.suggestion ? ` Suggestion: ${checked.suggestion}` : "");
        else {
          slug = checked.slug;
          if (slug !== state.slug && (await slugTaken(tx, spec.type, slug, id))) errors.slug = `The slug “${slug}” is already used by another ${info.one} (perhaps an archived one).`;
        }
      }
      const seo = seoColumns(spec, actor, input, stored.root);
      if (!seo.ok) {
        await refuse("Refused: robots, canonical or sitemap settings need seo.advanced.", "denied");
        return { kind: "denied", message: "You don't have permission to change robots, canonical or sitemap settings." } as const;
      }
      const rootInput = Object.fromEntries(Object.keys(spec.rootShape).map((k) => [k, input[k]]));
      Object.assign(errors, spec.checkRoot ? await spec.checkRoot(tx, rootInput, id) : {});
      const relations = await checkRelations(tx, spec, input, stored, id);
      Object.assign(errors, relations.errors, checkChildren(spec, input, stored));
      const planned = planTranslations(spec, input, stored);
      if (!planned.ok) Object.assign(errors, planned.errors);
      if (Object.keys(errors).length || !planned.ok) {
        if (relations.refusals.length) {
          const event = refusalEvent(relations.refusals);
          await refuse(event.summary, "failed", event.changes);
        }
        return { kind: "invalid", errors } as const;
      }
      const source = spec.hasSource
        ? { sourceBasis: input.sourceBasis ?? null, sourcePages: input.sourcePages ?? null, sourceNote: (input.sourceNote as string) || null }
        : {};
      const columns = { ...spec.rootColumns(rootInput, { pageType: pageFacts?.pageType }), ...source, ...seo.columns, ...(usesSlug ? { slug } : {}) };
      const beforeRoot = { ...spec.rootValues(stored.root), ...Object.fromEntries(Object.keys(source).map((k) => [k, stored.root[k] ?? null])), slug: stored.root.slug };
      const changedRoot = rootChanges(spec, beforeRoot, { ...columns, slug: usesSlug ? slug : stored.root.slug }).filter((k) => k !== "slug");
      for (const k of Object.keys(seo.columns)) if (!changedRoot.includes(k)) changedRoot.push(k);
      await tx.update(spec.root).set({ ...columns, updatedAt: now, updatedBy: actor.user.id, lockVersion: sql`lock_version + 1` } as never).where(eq(spec.rootId, id));
      await writeTranslations(tx, spec, id, planned.plan, stored, actor.user.id, now);
      const relationChanges: Record<string, { added: number; removed: number; reordered: boolean }> = {};
      for (const relation of spec.relations ?? []) {
        const next = input.rel[relation.key] ?? [];
        const diff = diffOrdered(stored.rel[relation.key] ?? [], next);
        if (diff.changed) {
          await replaceRelation(tx, relation.table, id, next);
          relationChanges[relation.key] = { added: diff.added.length, removed: diff.removed.length, reordered: diff.reordered };
        }
      }
      const childrenChanged =
        spec.children &&
        JSON.stringify(stored.children.map((c) => [c.id, c.tr.en, c.tr.ar])) !==
          JSON.stringify((input.children ?? []).map((c) => [c.id ?? "new", c.en.label || c.en.value ? c.en : null, c.ar.label || c.ar.value ? c.ar : null]));
      if (spec.children && (childrenChanged || LOCALES.some((l) => planned.plan.status[l] !== (stored.tr[l]?.translationStatus ?? null)))) {
        await writeChildren(tx, spec.children, id, input.children ?? [], planned.plan.status, actor.user.id, now);
      }
      await rebuildSearch(tx, spec.type, id, searchEntries(spec, input, slug ?? (stored.root.systemKey as string | null) ?? null), now);
      const newTitle = titleOf(spec, input) || title;
      const label = labelOf(newTitle, slug);
      const languages = LOCALES.filter((l) => planned.plan.changed[l]).map((l) => (l === "en" ? "English" : "Arabic"));
      const parts = [
        ...languages,
        ...(changedRoot.length ? [changedRoot.join(", ")] : []),
        ...(Object.keys(relationChanges).length ? ["relations"] : []),
        ...(childrenChanged ? [spec.children!.label.toLowerCase()] : []),
      ];
      await contentAudit(tx, actor, meta, now, {
        action: `${spec.type}.update`,
        type: spec.type,
        id,
        label: newTitle || slug,
        summary: `Updated ${info.one} ${label}${parts.length ? `: ${parts.join("; ")}` : " (no change)"}.`,
        changes: {
          fields: changedRoot,
          languages: Object.fromEntries(LOCALES.map((l) => [l, planned.plan.status[l] ?? "missing"])),
          ...(Object.keys(relationChanges).length ? { relations: relationChanges } : {}),
        },
      });
      if (usesSlug && slug !== state.slug) {
        await contentAudit(tx, actor, meta, now, {
          action: `${spec.type}.slug_change`,
          type: spec.type,
          id,
          label: newTitle || slug,
          summary: `Changed the slug of ${info.one} ${labelOf(newTitle, null)} from ${state.slug} to ${slug} (not public: no redirect needed).`,
          changes: { before: { slug: state.slug }, after: { slug } },
        });
      }
      if (Object.keys(relationChanges).length) {
        const described = Object.entries(relationChanges)
          .map(([k, d]) => `${(spec.relations ?? []).find((r) => r.key === k)?.label ?? k} (+${d.added}, −${d.removed}${d.reordered ? ", reordered" : ""})`)
          .join("; ");
        await contentAudit(tx, actor, meta, now, {
          action: `${spec.type}.relations_change`,
          type: spec.type,
          id,
          label: newTitle || slug,
          summary: `Changed the relations of ${info.one} ${labelOf(newTitle, slug)}: ${described}.`,
          changes: { relations: relationChanges },
        });
      }
      return { kind: "ok", id, lockVersion: state.lockVersion + 1, summary: `Saved ${label}.` } as const;
    });
  } catch (error) {
    const key = duplicateKey(error);
    if (key) return duplicateResult(key, input.slug?.trim() ?? null);
    throw error;
  }
}

// --- Archive and restore -------------------------------------------------------------------------------------------------

export type LifecycleResult = { kind: "ok"; summary: string; lockVersion: number } | { kind: "stale" } | { kind: "not_found" } | { kind: "denied"; message: string } | { kind: "refused"; message: string } | { kind: "unchanged" };

export interface LifecycleOptions {
  pageTypeOf?: (root: Record<string, unknown>) => PageType;
  /** A rule that can keep an item from being archived (e.g. a category assigned to active projects). */
  blockArchive?: (db: Db, id: string) => Promise<string | null>;
  /** A rule that can keep an item from being restored (e.g. a project whose category is archived). */
  blockRestore?: (db: Db, id: string) => Promise<string | null>;
}

export async function setItemArchived(
  ctx: ChangeContext,
  spec: KindSpec,
  id: string,
  archived: boolean,
  expectedVersion: number,
  options: LifecycleOptions = {},
): Promise<LifecycleResult> {
  const { deps, actor, meta } = ctx;
  const info = ENTITIES[spec.type];
  const action = `${spec.type}.${archived ? "archive" : "restore"}`;
  if (!isUlid(id)) return { kind: "not_found" };
  return contentTransaction(deps, actor, async (tx, now) => {
    const state = await lockRoot(tx, spec.type, id);
    if (!state) return { kind: "not_found" } as const;
    const stored = await readStored(tx, spec, id);
    if (!stored) return { kind: "not_found" } as const;
    const title = String(stored.tr.en?.[spec.titleKey] || stored.tr.ar?.[spec.titleKey] || "");
    const label = labelOf(title, state.slug ?? (stored.root.systemKey as string | null));
    const audit = (outcome: "success" | "denied" | "failed", summary: string, changes?: Record<string, unknown>) =>
      contentAudit(tx, actor, meta, now, { action, type: spec.type, id, label: title || state.slug, outcome, summary, changes });
    if (!can(actor.permissions, spec.type, "archive")) {
      await audit("denied", `Refused: ${archived ? "archiving" : "restoring"} a ${info.one} needs ${info.resource}.archive.`);
      return { kind: "denied", message: `You don't have permission to ${archived ? "archive" : "restore"} this ${info.one}.` } as const;
    }
    const pageType = options.pageTypeOf?.(stored.root);
    if (pageType && isFixedPage(pageType)) {
      await audit("denied", `Refused: ${label} is a fixed route of the site and is never archived.`);
      return { kind: "refused", message: "System, legal and template pages are fixed routes of the site: they are never archived." } as const;
    }
    if (state.lockVersion !== expectedVersion) {
      await audit("failed", `Refused: the ${info.one} changed after the page was opened (version ${expectedVersion}, now ${state.lockVersion}).`);
      return { kind: "stale" } as const;
    }
    if ((state.publicationStatus === "archived") === archived) return { kind: "unchanged" } as const;
    const block = archived ? options.blockArchive : options.blockRestore;
    if (block) {
      const reason = await block(tx, id);
      if (reason) {
        await audit("failed", `Refused: ${reason}`);
        return { kind: "refused", message: reason } as const;
      }
    }
    await setArchived(tx, spec.type, id, archived, actor.user.id, now);
    // The collection's order shows archived items stepped over: a page that showed it before this change is now stale.
    if (info.orderingKey) await touchOrdering(tx, info.orderingKey, actor.user.id, now);
    await audit(
      "success",
      archived ? `Archived ${info.one} ${label} (kept with its translations and relations; restorable).` : `Restored ${info.one} ${label} to a draft.`,
      { status: archived ? "archived" : "draft" },
    );
    return { kind: "ok", summary: archived ? `Archived ${label}.` : `Restored ${label} to a draft.`, lockVersion: state.lockVersion + 1 } as const;
  });
}

// --- Editor view ---------------------------------------------------------------------------------------------------------

export interface EditorItem {
  id: string;
  slug: string | null;
  lockVersion: number;
  archived: boolean;
  root: Record<string, unknown>;
  values: Record<Locale, Record<string, string>>;
  complete: Record<Locale, boolean>;
  states: Record<Locale, LocaleState>;
  rel: Record<string, string[]>;
  children: { id: string; en: { label: string; value: string }; ar: { label: string; value: string } }[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** An item as its editor shows it (plain values; rich text as paragraphs). */
export async function loadEditorItem(db: Db, spec: KindSpec, id: string): Promise<EditorItem | null> {
  if (!isUlid(id)) return null;
  const stored = await readStored(db, spec, id);
  if (!stored) return null;
  const values = {} as EditorItem["values"];
  const complete = {} as EditorItem["complete"];
  for (const locale of LOCALES) {
    const row = stored.tr[locale];
    values[locale] = Object.fromEntries(spec.fields.map((f) => [f.key, editorValue(f, row?.[f.key])]));
    complete[locale] = row?.translationStatus === "complete";
  }
  return {
    id,
    slug: (stored.root.slug as string | null) ?? null,
    lockVersion: Number(stored.root.lockVersion),
    archived: stored.root.publicationStatus === "archived",
    root: stored.root,
    values,
    complete,
    states: storedStates(spec, stored),
    rel: stored.rel,
    children: stored.children.map((c) => ({ id: c.id, en: c.tr.en ?? { label: "", value: "" }, ar: c.tr.ar ?? { label: "", value: "" } })),
    createdAt: (stored.root.createdAt as Date) ?? null,
    updatedAt: (stored.root.updatedAt as Date) ?? null,
  };
}
