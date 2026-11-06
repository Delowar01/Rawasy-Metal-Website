/**
 * Comparing two versions of an aggregate (A8.1, A1-PUBLISHING-VERSIONS §10): field by field, per language, with
 * repeated items (children, layout sections, form fields, phones, menu items) matched by their id rather than their
 * place, so an item moved is a change of order and an item edited is a change of that item. Pure.
 */
import { canonicalJson, type Snapshot } from "./snapshot.ts";

export type PathPart = string;

export interface Change {
  path: PathPart[];
  kind: "added" | "removed" | "changed" | "reordered";
  before: unknown;
  after: unknown;
}

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const idOf = (v: unknown): string | null => (isPlain(v) && typeof v.id === "string" && v.id ? v.id : null);
const keyed = (list: unknown[]) => list.length > 0 && list.every((v) => idOf(v) !== null) && new Set(list.map(idOf)).size === list.length;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

function walk(a: unknown, b: unknown, path: PathPart[], out: Change[]) {
  if (same(a, b)) return;
  if (isPlain(a) && isPlain(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const key of keys) walk(a[key], b[key], [...path, key], out);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b) && (keyed(a) || a.length === 0) && (keyed(b) || b.length === 0) && (a.length || b.length) && (keyed(a) || keyed(b))) {
    const before = new Map(a.map((v) => [idOf(v)!, v]));
    const after = new Map(b.map((v) => [idOf(v)!, v]));
    for (const [id, v] of after) {
      if (!before.has(id)) out.push({ path: [...path, `#${id}`], kind: "added", before: null, after: v });
      else walk(before.get(id), v, [...path, `#${id}`], out);
    }
    for (const [id, v] of before) if (!after.has(id)) out.push({ path: [...path, `#${id}`], kind: "removed", before: v, after: null });
    const common = (list: unknown[], other: Map<string, unknown>) => list.map(idOf).filter((id): id is string => id !== null && other.has(id));
    const orderBefore = common(a, after);
    const orderAfter = common(b, before);
    if (orderBefore.join() !== orderAfter.join()) out.push({ path: [...path, "(order)"], kind: "reordered", before: orderBefore, after: orderAfter });
    return;
  }
  const kind = a === null || a === undefined ? "added" : b === null || b === undefined ? "removed" : "changed";
  out.push({ path, kind, before: a ?? null, after: b ?? null });
}

/** The changes from `before` to `after` (both canonical snapshots). */
export function diffSnapshots(before: Snapshot | null, after: Snapshot | null): Change[] {
  const out: Change[] = [];
  walk(before ?? {}, after ?? {}, [], out);
  return out;
}

/** The languages a set of changes touches ('en', 'ar'), from the path parts that name them. */
export function localesOf(changes: readonly Change[]): string[] {
  const found = new Set<string>();
  for (const change of changes) for (const part of change.path) if (part === "en" || part === "ar") found.add(part);
  return ["en", "ar"].filter((l) => found.has(l));
}

const SEGMENT_LABELS: Record<string, string> = {
  root: "",
  texts: "",
  values: "",
  settings: "Settings",
  relations: "Relations",
  children: "Items",
  mediaLists: "Media",
  layout: "Layout",
  flags: "Flags",
  copy: "Copy",
  fields: "Fields",
  items: "Items",
  interfaceText: "Interface text",
  status: "Language state",
  en: "English",
  ar: "Arabic",
  "(order)": "order",
};

const words = (key: string) => {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Text of a stored rich-text document, else the value as short text. */
export function displayValue(value: unknown, max = 300): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value.length > max ? `${value.slice(0, max)}…` : value;
  if (typeof value === "number") return String(value);
  if (isPlain(value) && value.type === "doc") return displayValue(docText(value), max);
  const text = JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function docText(node: unknown): string {
  if (isPlain(node)) {
    if (typeof node.text === "string") return node.text;
    if (Array.isArray(node.content)) return node.content.map(docText).join(node.type === "doc" ? "\n" : "");
  }
  return "";
}

/**
 * A change's label for people: "English · Title", "Layout · Section 3 (home.hero) · English", "Relations · services ·
 * order". `fieldLabel` names a content field by its key when the caller knows the type's fields.
 */
export function changeLabel(change: Change, context: { after: Snapshot | null; before: Snapshot | null; fieldLabel?: (key: string) => string | undefined }): string {
  const parts: string[] = [];
  let afterNode: unknown = context.after;
  let beforeNode: unknown = context.before;
  for (const part of change.path) {
    if (part.startsWith("#")) {
      const id = part.slice(1);
      const find = (node: unknown) => (Array.isArray(node) ? node.find((v) => idOf(v) === id) : undefined);
      const list = Array.isArray(afterNode) ? afterNode : Array.isArray(beforeNode) ? beforeNode : [];
      const item = find(afterNode) ?? find(beforeNode);
      const position = list.findIndex((v) => idOf(v) === id);
      const block = isPlain(item) && typeof item.blockType === "string" ? ` (${item.blockType})` : isPlain(item) && typeof item.key === "string" ? ` (${item.key})` : "";
      parts.push(`${position >= 0 ? `Item ${position + 1}` : "Item"}${block}`);
      afterNode = find(afterNode);
      beforeNode = find(beforeNode);
      continue;
    }
    const label = Object.hasOwn(SEGMENT_LABELS, part) ? SEGMENT_LABELS[part] : (context.fieldLabel?.(part) ?? words(part));
    if (label) parts.push(label);
    afterNode = isPlain(afterNode) ? afterNode[part] : undefined;
    beforeNode = isPlain(beforeNode) ? beforeNode[part] : undefined;
  }
  return parts.join(" · ") || "Whole record";
}
