/**
 * The page builder's working copy (A5 brief §29–§35, §47, §54–§57): the sections as the editor holds them between saves,
 * and the pure operations on them — the layout save's payload, a new section's starting data, a duplicate's copy with
 * fresh item ids, the anchors in use, the fields a block's composition shows. No React and no server code here; the
 * server validates every save again and decides every permission, so nothing here is authority.
 */
import type { BlockModel, BuilderLocale, BuilderModel, FieldModel, SectionData, SectionModel } from "@/server/admin/actions/builder-model";
import { newBuilderItemId } from "@/server/admin/actions/builder-model";

export const LOCALES: BuilderLocale[] = ["en", "ar"];
export const LANGUAGE: Record<BuilderLocale, string> = { en: "English", ar: "Arabic" };

export type Devices = SectionModel["devices"];

/** A section as the editor holds it: a stored one (its server model beside it) or a new one ("new:N"). */
export interface WorkingSection {
  /** The stored id, or "new:N" until the save gives it one. */
  ref: string;
  /** The stored id (null for a new section). */
  id: string | null;
  blockType: string;
  label: string;
  visible: boolean;
  devices: Devices;
  anchor: string | null;
  locked: boolean;
  /** A linked reusable section (its own data is the reusable's, edited elsewhere). */
  reusable: SectionModel["reusable"];
  /** A new duplicate: the stored section it copies (the server makes a linked one another link). */
  duplicateOf?: string;
  /** A new section linked to this reusable section. */
  reusableId?: string;
  /** The section's own data (null: linked, or unreadable). */
  data: SectionData | null;
  /** Whether the save sends `data` (edited, or a new section's). */
  dataChanged: boolean;
  /** The server's model of a stored section (states, warnings, operations); null for a new one. */
  model: SectionModel | null;
}

let counter = 0;
/** A new section's reference, unique in this page's session. */
export const newRef = () => `new:${++counter}`;

/** The sections the builder opened with. */
export function initialSections(model: BuilderModel): WorkingSection[] {
  return model.sections.map((s) => ({
    ref: s.id,
    id: s.id,
    blockType: s.blockType,
    label: s.label,
    visible: s.visible,
    devices: { ...s.devices },
    anchor: s.anchor,
    locked: s.locked,
    reusable: s.reusable,
    data: s.data ? fillLanguages(model.blocks[s.blockType], s.data) : null,
    dataChanged: false,
    model: s,
  }));
}

// --- Empty values --------------------------------------------------------------------------------------------------------

/** A content field's empty value (as the server's `emptyContentValue`). */
export function emptyValue(field: FieldModel): unknown {
  switch (field.kind) {
    case "lines":
      return [];
    case "rich":
      return { type: "doc", content: [] };
    case "text":
    case "textarea":
      return "";
    default:
      return undefined;
  }
}

/** An item's settings defaults (as the server's `defaultFieldValue`, for the kinds an item may hold). */
export function itemDefaults(fields: FieldModel[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.kind === "enum") out[f.key] = f.default;
    else if (f.kind === "boolean") out[f.key] = f.default;
    else if (f.kind === "int") out[f.key] = f.default;
    else if (f.kind === "value") out[f.key] = "";
    else if (f.kind === "media" || f.kind === "link") out[f.key] = null;
  }
  return out;
}

/** An item's empty texts in one language. */
export const itemTexts = (fields: FieldModel[]) => Object.fromEntries(fields.map((f) => [f.key, emptyValue(f)]));

/**
 * Both languages' texts with every field present (empty where not written yet) and every repeated item covered, so the
 * editor never sends a language that does not match the items (the server writes a language only once it has text).
 */
export function fillLanguages(block: BlockModel | undefined, data: SectionData): SectionData {
  if (!block) return data;
  const content: SectionData["content"] = {};
  for (const locale of LOCALES) {
    const text: Record<string, unknown> = { ...(data.content[locale] ?? {}) };
    for (const field of block.content) if (text[field.key] === undefined) text[field.key] = emptyValue(field);
    for (const field of block.settings) {
      if (field.kind !== "items") continue;
      const items = (data.settings[field.key] as { id: string }[] | undefined) ?? [];
      const map = { ...((text[field.key] as Record<string, Record<string, unknown>> | undefined) ?? {}) };
      for (const item of items) map[item.id] = { ...itemTexts(field.content), ...(map[item.id] ?? {}) };
      for (const id of Object.keys(map)) if (!items.some((item) => item.id === id)) delete map[id];
      text[field.key] = map;
    }
    content[locale] = text;
  }
  return { ...data, content };
}

/** A new section's data: the block's defaults, and each repeater's starting items with fresh ids. */
export function newSectionData(block: BlockModel): SectionData {
  const settings: Record<string, unknown> = structuredClone(block.defaults.settings);
  for (const field of block.settings) {
    if (field.kind !== "items") continue;
    settings[field.key] = Array.from({ length: field.initial }, () => ({ id: newBuilderItemId(), ...itemDefaults(field.settings) }));
  }
  return fillLanguages(block, { settings, content: {}, complete: { en: false, ar: false }, otherUnaffected: false });
}

/** A copy of a section's data with fresh repeated-item ids (A5 brief §47), languages and marks kept. */
export function copyWithNewIds(block: BlockModel, data: SectionData): SectionData {
  const settings: Record<string, unknown> = structuredClone(data.settings);
  const content: SectionData["content"] = structuredClone(data.content);
  for (const field of block.settings) {
    if (field.kind !== "items") continue;
    const items = (settings[field.key] as { id: string }[] | undefined) ?? [];
    const renamed = new Map(items.map((item) => [item.id, newBuilderItemId()]));
    settings[field.key] = items.map((item) => ({ ...item, id: renamed.get(item.id)! }));
    for (const locale of LOCALES) {
      const map = (content[locale]?.[field.key] as Record<string, unknown> | undefined) ?? {};
      if (content[locale]) content[locale]![field.key] = Object.fromEntries(Object.entries(map).map(([id, value]) => [renamed.get(id) ?? id, value]));
    }
  }
  return { settings, content, complete: { ...data.complete }, otherUnaffected: true };
}

// --- The save -------------------------------------------------------------------------------------------------------------

/** One layout save's payload: the order is the array's, a stored section left out is removed. */
export function layoutPayload(owner: BuilderModel["owner"], expectedVersion: number, sections: WorkingSection[]) {
  return {
    owner: { type: owner.type, id: owner.id },
    expectedVersion,
    sections: sections.map((s) => ({
      ref: s.ref,
      ...(s.id === null && !s.duplicateOf && !s.reusableId ? { blockType: s.blockType } : {}),
      ...(s.duplicateOf ? { duplicateOf: s.duplicateOf } : {}),
      ...(s.reusableId ? { reusableId: s.reusableId } : {}),
      visible: s.visible,
      devices: s.devices,
      anchor: s.anchor,
      ...(s.dataChanged && s.data ? { data: s.data } : {}),
    })),
  };
}

/** What the save would change, as one string (the "unsaved changes" test compares it with the opened layout's). */
export const layoutKey = (sections: WorkingSection[]) =>
  JSON.stringify(sections.map((s) => [s.ref, s.visible, s.devices, s.anchor, s.duplicateOf ?? null, s.reusableId ?? null, s.dataChanged ? s.data : null]));

// --- Anchors and links ------------------------------------------------------------------------------------------------------

/** The in-page anchors the layout's sections give (their own, or their block's fixed one). */
export function anchorsOf(sections: WorkingSection[], blocks: Record<string, BlockModel>): string[] {
  const out = new Set<string>();
  for (const s of sections) {
    const block = blocks[s.blockType];
    const anchor = block?.anchor === "fixed" ? block.fixedAnchor : s.anchor;
    if (anchor) out.add(anchor);
  }
  return [...out];
}

/** Every in-page link target ("#anchor") a value holds: buttons, rich-text links, repeated items. */
export function linkedAnchors(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const v of value) linkedAnchors(v, into);
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.type === "anchor" && typeof record.anchor === "string") into.add(record.anchor);
    else for (const v of Object.values(record)) linkedAnchors(v, into);
  }
  return into;
}

/** The sections (other than `except`) whose data links to `#anchor`. */
export function sectionsLinkingTo(sections: WorkingSection[], anchor: string, except: string): WorkingSection[] {
  return sections.filter((s) => s.ref !== except && s.data && linkedAnchors(s.data).has(anchor));
}

export const ANCHOR_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// --- Fields shown ----------------------------------------------------------------------------------------------------------

/** A block's composition key: the setting that decides which fields apply (`variant`, `layout` or `visual`). */
export function composition(settings: Record<string, unknown>): string | undefined {
  for (const key of ["variant", "layout", "visual"]) if (typeof settings[key] === "string") return settings[key] as string;
  return undefined;
}

/** The fields shown for a section's current composition (a field marked for other compositions is left out). */
export const shownFields = (fields: FieldModel[], settings: Record<string, unknown>) => {
  const current = composition(settings);
  return fields.filter((f) => !f.only || (current !== undefined && f.only.includes(current)));
};

/** Whether a section holds things a removal should be confirmed for (A5 brief §56): media, chosen records, repeated content. */
export function holdsContent(block: BlockModel | undefined, data: SectionData | null): string[] {
  if (!block || !data) return [];
  const out = new Set<string>();
  const visit = (fields: FieldModel[], values: Record<string, unknown>) => {
    for (const f of fields) {
      const v = values[f.key];
      if (f.kind === "media" && v) out.add("media");
      if (f.kind === "selection" && v && typeof v === "object" && ((v as { mode?: string }).mode === "automatic" || ((v as { ids?: unknown[] }).ids ?? []).length)) out.add("chosen records");
      if (f.kind === "items" && Array.isArray(v) && v.length) {
        out.add("repeated content");
        for (const item of v as Record<string, unknown>[]) visit(f.settings, item);
      }
    }
  };
  visit(block.settings, data.settings);
  return [...out];
}

// --- Language completeness ------------------------------------------------------------------------------------------------------

const isFilled = (field: FieldModel, value: unknown) => {
  if (field.kind === "lines") return Array.isArray(value) && value.some((line) => typeof line === "string" && line.trim() !== "");
  if (field.kind === "rich") {
    const doc = value as { content?: unknown[] } | null;
    return Boolean(doc && Array.isArray(doc.content) && doc.content.length > 0);
  }
  return typeof value === "string" && value.trim() !== "";
};

/** The required texts of one language that are still empty (labels), as the server's `missingRequired` names them. */
export function missingTexts(block: BlockModel, data: SectionData, locale: BuilderLocale): string[] {
  const text = data.content[locale] ?? {};
  const out: string[] = [];
  for (const field of shownFields(block.content, data.settings)) if ("required" in field && field.required && !isFilled(field, text[field.key])) out.push(field.label);
  for (const field of block.settings) {
    if (field.kind !== "items") continue;
    const map = (text[field.key] as Record<string, Record<string, unknown>> | undefined) ?? {};
    ((data.settings[field.key] as { id: string }[] | undefined) ?? []).forEach((item, i) => {
      for (const sub of field.content) if ("required" in sub && sub.required && !isFilled(sub, map[item.id]?.[sub.key])) out.push(`${field.one} ${i + 1}: ${sub.label}`);
    });
  }
  return out;
}

/** Whether a language has any text at all (the server stores a language only then). */
export function hasText(block: BlockModel, data: SectionData, locale: BuilderLocale): boolean {
  const text = data.content[locale] ?? {};
  if (block.content.some((f) => isFilled(f, text[f.key]))) return true;
  return block.settings.some((field) => {
    if (field.kind !== "items") return false;
    const map = (text[field.key] as Record<string, Record<string, unknown>> | undefined) ?? {};
    return Object.values(map).some((item) => field.content.some((sub) => isFilled(sub, item[sub.key])));
  });
}
