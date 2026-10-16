/**
 * The field language of the block registry (A5 brief §9, §13, §15–§17, §65): every block declares its settings
 * (non-localized) and its content (per language) as typed fields, and everything else — the Zod schemas that validate
 * what the editor sends and what the database holds, the defaults, the repeaters' language parity, the language
 * completeness, the references to media and records, a duplicate's new item ids and the public projection — is derived
 * from those declarations here. One source of truth per block; no second list of fields anywhere.
 *
 * - Settings and content objects are **strict**: a key the block does not declare is refused (no mass assignment).
 * - Text is plain text (A3's rules: no markup, control or direction-override characters), bounded in length; longer copy
 *   is the rich-text document (`richtext.ts`). Nothing is HTML, CSS, script, SQL or JSON typed by a person.
 * - Repeated items (A1-CONTENT-MODEL §5.5) keep their order and non-text options in settings (`[{ id, … }]`) and their
 *   texts per language in content, keyed by the same ids; every language present must cover exactly those ids.
 * - Media are A4 media item ids (never paths or URLs); records are A3 ids (selections) or link targets (`links.ts`).
 *
 * Pure: the registry, the Server Actions, the editor models and the unit tests share it.
 */
import { z } from "zod";
import { charLength, plainText } from "../cms/text.ts";
import { designSchema, type DesignSpec, type DesignValues } from "./design.ts";
import { DEFAULT_LINK_KINDS, linkField, targetRecord, ULID_RE, type LinkKind, type LinkTarget } from "./links.ts";
import { EMPTY_RICH, isRichEmpty, richLinks, richTextSchema, richToPlain, type RichDocument, type RichLimits } from "./richtext.ts";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export type MediaKindName = "image" | "document";
export type SelectableEntity = "service" | "project" | "machine" | "client" | "certificate" | "industry";
export type SelectionSource = "all" | "featured" | "category";

export const ENTITY_LABELS: Record<SelectableEntity, { one: string; many: string }> = {
  service: { one: "service", many: "services" },
  project: { one: "project", many: "projects" },
  machine: { one: "machine", many: "machines" },
  client: { one: "client", many: "clients" },
  certificate: { one: "certificate", many: "certificates" },
  industry: { one: "industry", many: "industries" },
};

export const SOURCE_LABELS: Record<SelectionSource, string> = {
  all: "All, in the collection's order",
  featured: "Featured only",
  category: "One project category",
};

/** Which automatic sources each collection supports (A1-CONTENT-MODEL §5.6). */
export const ENTITY_SOURCES: Record<SelectableEntity, readonly SelectionSource[]> = {
  service: ["all"],
  project: ["all", "featured", "category"],
  machine: ["all"],
  client: ["all", "featured"],
  certificate: ["all"],
  industry: ["all"],
};

// --- Field declarations ---------------------------------------------------------------------------------------------------

interface Base {
  label: string;
  hint?: string;
  /** Used (and shown in the editor) only when the block's `variant` setting is one of these. */
  only?: readonly string[];
}

/** One line of plain text. */
export interface TextField extends Base {
  kind: "text";
  max: number;
  required?: boolean;
}
/** Several lines of plain text (line breaks kept). */
export interface TextareaField extends Base {
  kind: "textarea";
  max: number;
  required?: boolean;
}
/** A list of short lines (headline lines, steps, tags). */
export interface LinesField extends Base {
  kind: "lines";
  maxItems: number;
  maxLength: number;
  required?: boolean;
}
/** A rich-text document (A1 §12). */
export interface RichField extends Base {
  kind: "rich";
  required?: boolean;
  limits?: Partial<RichLimits>;
}
export type ContentField = TextField | TextareaField | LinesField | RichField;

export interface EnumField extends Base {
  kind: "enum";
  options: readonly { value: string; label: string }[];
  default: string;
  adminOnly?: boolean;
}
export interface BooleanField extends Base {
  kind: "boolean";
  default: boolean;
  adminOnly?: boolean;
}
export interface IntField extends Base {
  kind: "int";
  min: number;
  max: number;
  default: number;
  adminOnly?: boolean;
}
/** A short value that does not change with the language (a figure such as "12,000", a video id), checked by `check`. */
export interface ValueField extends Base {
  kind: "value";
  max: number;
  default: string;
  required?: boolean;
  /** Returns a message when the value is not acceptable (after the plain-text rules). */
  check?: (value: string) => string | null;
  /** Written left to right in both languages (digits, ids, addresses). */
  ltr?: boolean;
  adminOnly?: boolean;
}
/** One A4 media item (its id). */
export interface MediaField extends Base {
  kind: "media";
  kinds: readonly MediaKindName[];
  required?: boolean;
}
/** Records shown by a section, chosen by hand or automatically (A1 §5.6). */
export interface SelectionField extends Base {
  kind: "selection";
  entity: SelectableEntity;
  max: number;
  default: SelectionValue;
}
/** A link target (`links.ts`). */
export interface LinkFieldSpec extends Base {
  kind: "link";
  kinds?: readonly LinkKind[];
  required?: boolean;
}
export type ItemSettingsField = EnumField | BooleanField | IntField | ValueField | MediaField | LinkFieldSpec;
/** Repeated items: ids and options in settings, texts per language in content (A1 §5.5). */
export interface ItemsField extends Base {
  kind: "items";
  /** One item, as messages name it ("question", "figure"). */
  one: string;
  min: number;
  max: number;
  /** Items a new section starts with. */
  initial?: number;
  settings: Record<string, ItemSettingsField>;
  content: Record<string, ContentField>;
}
/** The design inspector's settings (`design.ts`). */
export interface DesignField {
  kind: "design";
  label?: string;
  spec: DesignSpec;
  default: DesignValues;
}
export type SettingsField = EnumField | BooleanField | IntField | ValueField | MediaField | SelectionField | LinkFieldSpec | ItemsField | DesignField;

export type SelectionValue = { mode: "manual"; ids: string[] } | { mode: "automatic"; source: SelectionSource; limit: number; categoryId?: string };

export type SettingsFields = Record<string, SettingsField>;
export type ContentFields = Record<string, ContentField>;

/** What a block's settings and content hold (validated JSON). */
export type Settings = Record<string, unknown>;
export type Content = Record<string, unknown>;

// --- Limits -----------------------------------------------------------------------------------------------------------------

export const BUILDER_LIMITS = {
  /** A section's settings and its two languages' content, as stored JSON (well under the 1 MB Server Action body). */
  sectionBytes: 48_000,
  /** Sections per page or service. */
  sectionsPerOwner: 60,
  /** The whole layout save, as sent (the action refuses a longer body before parsing it). */
  saveBytes: 900_000,
  /** Nesting depth of any JSON the builder accepts. */
  jsonDepth: 12,
  itemId: 40,
} as const;

/** A repeated item's id: lowercase ASCII, as A1's import derives them from slugs ("power", "i1") or the editor makes. */
export const ITEM_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** A fresh item id: "i" + 8 random base-36 characters (collision chance negligible within one section). */
export function newItemId(random: () => number = Math.random): string {
  let id = "i";
  for (let i = 0; i < 8; i++) id += "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(random() * 36)];
  return id;
}

/** The depth of a JSON value (an object or array adds one level). */
export function jsonDepth(value: unknown, limit = 64): number {
  if (value === null || typeof value !== "object") return 0;
  if (limit <= 0) return Infinity;
  let deepest = 0;
  for (const child of Object.values(value as Record<string, unknown>)) deepest = Math.max(deepest, jsonDepth(child, limit - 1));
  return deepest + 1;
}

// --- Schemas ------------------------------------------------------------------------------------------------------------------

/** A content field's schema (missing → the empty value; the output is always complete). */
export function contentFieldSchema(field: ContentField): z.ZodType {
  switch (field.kind) {
    case "text":
      return plainText(field.max).optional().default("");
    case "textarea":
      return plainText(field.max, { multiline: true }).optional().default("");
    case "lines":
      return z
        .array(plainText(field.maxLength))
        .max(field.maxItems * 2)
        .transform((lines) => lines.filter((line) => line !== ""))
        .refine((lines) => lines.length <= field.maxItems, { message: `Use at most ${field.maxItems} lines.` })
        .optional()
        .default([]);
    case "rich":
      return richTextSchema(field.limits).optional().default(EMPTY_RICH);
  }
}

const ulid = z.string().regex(ULID_RE, "Choose an item from the list.");

function selectionSchema(field: SelectionField) {
  const sources = ENTITY_SOURCES[field.entity];
  return z
    .discriminatedUnion("mode", [
      z.object({ mode: z.literal("manual"), ids: z.array(ulid).max(field.max, `Choose at most ${field.max}.`) }).strict(),
      z
        .object({
          mode: z.literal("automatic"),
          source: z.enum(sources as unknown as [SelectionSource, ...SelectionSource[]]),
          limit: z.number().int().min(1).max(field.max),
          categoryId: ulid.optional(),
        })
        .strict(),
    ])
    .superRefine((value, ctx) => {
      if (value.mode === "manual" && new Set(value.ids).size !== value.ids.length) ctx.addIssue({ code: "custom", message: "An item is chosen twice." });
      if (value.mode === "automatic" && (value.source === "category") !== Boolean(value.categoryId)) {
        ctx.addIssue({ code: "custom", message: value.source === "category" ? "Choose the category." : "A category is only used with the category source." });
      }
    });
}

/** A settings field's schema (missing → its default). */
export function settingsFieldSchema(field: SettingsField): z.ZodType {
  switch (field.kind) {
    case "enum":
      return z.enum(field.options.map((o) => o.value) as [string, ...string[]]).optional().default(field.default);
    case "boolean":
      return z.boolean().optional().default(field.default);
    case "int":
      return z.number().int().min(field.min).max(field.max).optional().default(field.default);
    // Required values, media and links are completeness rules (A1-CONTENT-MODEL §15: a draft saves incomplete; the
    // section reads "incomplete" until they are set), never shape rules: their schemas take the empty value.
    case "value":
      return plainText(field.max)
        .superRefine((value, ctx) => {
          if (!value) return;
          const problem = field.check?.(value);
          if (problem) ctx.addIssue({ code: "custom", message: problem });
        })
        .optional()
        .default(field.default);
    case "media":
      return ulid.nullable().optional().default(null as never);
    case "selection":
      return selectionSchema(field).optional().default(field.default);
    case "link":
      return linkField(field.kinds ?? DEFAULT_LINK_KINDS).optional().default(null as never);
    case "items": {
      const shape: Record<string, z.ZodType> = { id: z.string().regex(ITEM_ID_RE, "An item id is malformed.") };
      for (const [key, sub] of Object.entries(field.settings)) shape[key] = settingsFieldSchema(sub);
      return z
        .array(z.object(shape).strict())
        .max(field.max, `Use at most ${field.max} ${field.one}s.`)
        .superRefine((items, ctx) => {
          if (items.length < field.min) ctx.addIssue({ code: "custom", message: `Keep at least ${field.min} ${field.one}${field.min === 1 ? "" : "s"}.` });
          const ids = items.map((item) => (item as { id: string }).id);
          if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: `Two ${field.one}s have the same id.` });
        })
        .optional()
        .default([]);
    }
    case "design":
      return designSchema(field.spec).optional().default(field.default as never);
  }
}

/** A block's settings schema: strict, every declared field (missing ones take their defaults). */
export function settingsSchemaOf(fields: SettingsFields) {
  return z.object(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, settingsFieldSchema(field)]))).strict();
}

/** A block's content schema for one language: its fields and, per repeater, the texts keyed by item id. */
export function contentSchemaOf(settings: SettingsFields, content: ContentFields) {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(content)) shape[key] = contentFieldSchema(field);
  for (const [key, field] of Object.entries(settings)) {
    if (field.kind !== "items") continue;
    const item = z.object(Object.fromEntries(Object.entries(field.content).map(([k, f]) => [k, contentFieldSchema(f)]))).strict();
    shape[key] = z
      .record(z.string().regex(ITEM_ID_RE), item)
      .refine((map) => Object.keys(map).length <= field.max, { message: `Use at most ${field.max} ${field.one}s.` })
      .optional()
      .default({});
  }
  return z.object(shape).strict();
}

// --- Defaults -----------------------------------------------------------------------------------------------------------------

function emptyContentValue(field: ContentField): unknown {
  if (field.kind === "lines") return [];
  if (field.kind === "rich") return EMPTY_RICH;
  return "";
}

function defaultFieldValue(field: SettingsField | ItemSettingsField): unknown {
  switch (field.kind) {
    case "media":
    case "link":
      return null;
    case "items":
      return [];
    case "selection":
      return structuredClone(field.default);
    case "design":
      return structuredClone(field.default);
    default:
      return field.default;
  }
}

/** A new section's settings and content: field defaults, and each repeater's initial items (fresh ids, empty texts). */
export function defaultsOf(settings: SettingsFields, content: ContentFields, newId: () => string = () => newItemId()): { settings: Settings; content: Content } {
  const s: Settings = {};
  const c: Content = {};
  for (const [key, field] of Object.entries(content)) c[key] = emptyContentValue(field);
  for (const [key, field] of Object.entries(settings)) {
    if (field.kind !== "items") {
      s[key] = defaultFieldValue(field);
      continue;
    }
    const items = Array.from({ length: field.initial ?? field.min }, () => {
      const item: Record<string, unknown> = { id: newId() };
      for (const [k, sub] of Object.entries(field.settings)) item[k] = defaultFieldValue(sub);
      return item;
    });
    s[key] = items;
    c[key] = Object.fromEntries(items.map((item) => [item.id as string, Object.fromEntries(Object.entries(field.content).map(([k, f]) => [k, emptyContentValue(f)]))]));
  }
  return { settings: s, content: c };
}

// --- Repeater parity ----------------------------------------------------------------------------------------------------------

export interface FieldIssue {
  /** Where: "settings.items.2.icon", "content.ar.items.s1.title", "content.en.title". */
  path: string;
  message: string;
}

/** Every language's texts cover exactly the items in settings (A5 brief §15): reordering can never misalign them. */
export function parityIssues(settings: SettingsFields, values: Settings, contents: Partial<Record<Locale, Content>>): FieldIssue[] {
  const issues: FieldIssue[] = [];
  for (const [key, field] of Object.entries(settings)) {
    if (field.kind !== "items") continue;
    const ids = ((values[key] as { id: string }[] | undefined) ?? []).map((item) => item.id);
    for (const locale of LOCALES) {
      const content = contents[locale];
      if (!content) continue;
      const keys = Object.keys((content[key] as Record<string, unknown> | undefined) ?? {});
      const missing = ids.filter((id) => !keys.includes(id));
      const extra = keys.filter((id) => !ids.includes(id));
      if (missing.length || extra.length) {
        issues.push({
          path: `content.${locale}.${key}`,
          message: `The ${locale === "en" ? "English" : "Arabic"} texts don't match the ${field.one}s (${missing.length ? `missing for ${missing.length}` : ""}${missing.length && extra.length ? ", " : ""}${extra.length ? `${extra.length} without a ${field.one}` : ""}). Reload the editor.`,
        });
      }
    }
  }
  return issues;
}

// --- Completeness ---------------------------------------------------------------------------------------------------------------

const filled = (field: ContentField, value: unknown) => {
  if (field.kind === "lines") return Array.isArray(value) && value.length > 0;
  if (field.kind === "rich") return Boolean(value) && !isRichEmpty(value as RichDocument);
  return typeof value === "string" && value.trim() !== "";
};

/** The required texts of one language that are empty (labels), for "complete" and the editor's warnings. */
export function missingRequired(settings: SettingsFields, content: ContentFields, values: Settings, text: Content): string[] {
  const missing: string[] = [];
  for (const [key, field] of Object.entries(content)) if (field.required && !filled(field, text[key])) missing.push(field.label);
  for (const [key, field] of Object.entries(settings)) {
    if (field.kind !== "items") continue;
    const map = (text[key] as Record<string, Content> | undefined) ?? {};
    const items = (values[key] as { id: string }[] | undefined) ?? [];
    items.forEach((item, index) => {
      for (const [k, sub] of Object.entries(field.content)) {
        if (sub.required && !filled(sub, map[item.id]?.[k])) missing.push(`${field.one} ${index + 1}: ${sub.label}`);
      }
    });
  }
  return missing;
}

/** The required settings (values, media, links — inside repeated items too) that are not set, as labels. */
export function missingSettings(settings: SettingsFields, values: Settings): string[] {
  const missing: string[] = [];
  const empty = (field: SettingsField | ItemSettingsField, value: unknown) =>
    (field.kind === "value" && field.required && !value) || ((field.kind === "media" || field.kind === "link") && field.required && (value === null || value === undefined));
  for (const [key, field] of Object.entries(settings)) {
    if (field.kind !== "items") {
      if (empty(field, values[key])) missing.push(field.label ?? key);
      continue;
    }
    ((values[key] as Record<string, unknown>[] | undefined) ?? []).forEach((item, index) => {
      for (const [k, sub] of Object.entries(field.settings)) if (empty(sub, item[k])) missing.push(`${field.one} ${index + 1}: ${sub.label}`);
    });
  }
  return missing;
}

/** Whether a language holds any text at all (its row exists only then). */
export function hasAnyText(settings: SettingsFields, content: ContentFields, text: Content | undefined): boolean {
  if (!text) return false;
  for (const [key, field] of Object.entries(content)) if (filled(field, text[key])) return true;
  for (const [key, field] of Object.entries(settings)) {
    if (field.kind !== "items") continue;
    for (const item of Object.values((text[key] as Record<string, Content> | undefined) ?? {})) {
      for (const [k, sub] of Object.entries(field.content)) if (filled(sub, item?.[k])) return true;
    }
  }
  return false;
}

// --- References ------------------------------------------------------------------------------------------------------------------

export type RecordType = SelectableEntity | "page" | "project_category";

export interface BlockReferences {
  media: { id: string; kinds: readonly MediaKindName[]; path: string }[];
  records: { type: RecordType; id: string; path: string }[];
  links: { target: LinkTarget; path: string }[];
}

/** Every media item, record and link a section's settings and texts name (batched checks, warnings, usage). */
export function referencesOf(settings: SettingsFields, content: ContentFields, values: Settings, texts: Partial<Record<Locale, Content>>): BlockReferences {
  const out: BlockReferences = { media: [], records: [], links: [] };
  const link = (target: LinkTarget | null | undefined, path: string) => {
    if (!target) return;
    out.links.push({ target, path });
    const record = targetRecord(target);
    if (record) out.records.push({ type: record.type, id: record.id, path });
  };
  const visit = (field: SettingsField | ItemSettingsField, value: unknown, path: string) => {
    if (field.kind === "media" && typeof value === "string") out.media.push({ id: value, kinds: field.kinds, path });
    else if (field.kind === "link") link(value as LinkTarget | null, path);
    else if (field.kind === "selection" && value && typeof value === "object") {
      const selection = value as SelectionValue;
      if (selection.mode === "manual") selection.ids.forEach((id, i) => out.records.push({ type: field.entity, id, path: `${path}.ids.${i}` }));
      else if (selection.categoryId) out.records.push({ type: "project_category", id: selection.categoryId, path: `${path}.categoryId` });
    }
  };
  for (const [key, field] of Object.entries(settings)) {
    const value = values[key];
    if (field.kind === "items") {
      ((value as Record<string, unknown>[] | undefined) ?? []).forEach((item, i) => {
        for (const [k, sub] of Object.entries(field.settings)) visit(sub, item[k], `settings.${key}.${i}.${k}`);
      });
    } else visit(field, value, `settings.${key}`);
  }
  for (const locale of LOCALES) {
    const text = texts[locale];
    if (!text) continue;
    for (const [key, field] of Object.entries(content)) {
      if (field.kind === "rich" && text[key]) richLinks(text[key] as RichDocument).forEach((target) => link(target, `content.${locale}.${key}`));
    }
    for (const [key, field] of Object.entries(settings)) {
      if (field.kind !== "items") continue;
      for (const [id, item] of Object.entries((text[key] as Record<string, Content> | undefined) ?? {})) {
        for (const [k, sub] of Object.entries(field.content)) {
          if (sub.kind === "rich" && item?.[k]) richLinks(item[k] as RichDocument).forEach((target) => link(target, `content.${locale}.${key}.${id}.${k}`));
        }
      }
    }
  }
  return out;
}

// --- Duplication ---------------------------------------------------------------------------------------------------------------

/**
 * A duplicate's settings and texts with new item ids (A5 brief §47): the copy's repeated items never share an id with the
 * original's (ids are only unique within a section, but a copy that kept them would carry the same anchors and keys).
 */
export function cloneWithNewIds(
  settings: SettingsFields,
  values: Settings,
  texts: Partial<Record<Locale, Content>>,
  newId: () => string = () => newItemId(),
): { settings: Settings; content: Partial<Record<Locale, Content>> } {
  const s = structuredClone(values);
  const c = structuredClone(texts);
  for (const [key, field] of Object.entries(settings)) {
    if (field.kind !== "items") continue;
    const items = (s[key] as { id: string }[] | undefined) ?? [];
    const renamed = new Map<string, string>();
    for (const item of items) {
      let next = newId();
      while (renamed.has(next) || items.some((other) => other.id === next)) next = newId();
      renamed.set(item.id, next);
      item.id = next;
    }
    for (const locale of LOCALES) {
      const map = c[locale]?.[key] as Record<string, unknown> | undefined;
      if (!map) continue;
      c[locale]![key] = Object.fromEntries(Object.entries(map).map(([id, value]) => [renamed.get(id) ?? id, value]));
    }
  }
  return { settings: s, content: c };
}

// --- Projection ---------------------------------------------------------------------------------------------------------------

/** What a published section would show (A1 §5.2, §18): settings without admin-only fields (provenance, notes). */
export function projectSettings(settings: SettingsFields, values: Settings): Settings {
  const out: Settings = {};
  for (const [key, field] of Object.entries(settings)) {
    if ("adminOnly" in field && field.adminOnly) continue;
    if (field.kind === "items") {
      out[key] = ((values[key] as Record<string, unknown>[] | undefined) ?? []).map((item) =>
        Object.fromEntries(Object.entries(item).filter(([k]) => k === "id" || !("adminOnly" in (field.settings[k] ?? {}) && (field.settings[k] as { adminOnly?: boolean }).adminOnly))),
      );
    } else out[key] = values[key];
  }
  return out;
}

// --- Text measures -------------------------------------------------------------------------------------------------------------

/** All text of one language, for search and the audit's lengths (never stored in the audit). */
export function plainTextOf(content: ContentFields, settings: SettingsFields, text: Content | undefined): string {
  if (!text) return "";
  const parts: string[] = [];
  const add = (field: ContentField, value: unknown) => {
    if (field.kind === "rich" && value) parts.push(richToPlain(value as RichDocument));
    else if (field.kind === "lines" && Array.isArray(value)) parts.push(...(value as string[]));
    else if (typeof value === "string") parts.push(value);
  };
  for (const [key, field] of Object.entries(content)) add(field, text[key]);
  for (const [key, field] of Object.entries(settings)) {
    if (field.kind !== "items") continue;
    for (const item of Object.values((text[key] as Record<string, Content> | undefined) ?? {})) for (const [k, sub] of Object.entries(field.content)) add(sub, item?.[k]);
  }
  return parts.filter(Boolean).join("\n");
}

export const textChars = (value: string) => charLength(value);
