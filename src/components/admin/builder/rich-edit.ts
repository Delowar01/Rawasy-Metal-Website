/**
 * The rich-text editor's model (A5 brief §14): a document (`src/server/builder/richtext.ts`) edited as a list of blocks
 * of plain text — paragraph, heading 3 or 4, bulleted or numbered list (one item per line) — with formatting kept as
 * ranges over each block's text (bold, italic, a structured link, a language). People type text only; formatting is
 * applied to the selected text with buttons, never written as markup, and the document is built from these ranges. The
 * server validates and normalizes every document again.
 *
 * Pure: the editor component and the unit tests share it.
 */

export type LinkTargetValue = Record<string, unknown> & { type: string };
export type Mark = { type: "bold" } | { type: "italic" } | { type: "link"; target: LinkTargetValue } | { type: "lang"; lang: "en" | "ar" };
type Inline = { type: "text"; text: string; marks?: Mark[] } | { type: "hard_break" };
type DocBlock =
  | { type: "paragraph"; content: Inline[] }
  | { type: "heading"; level: 3 | 4; content: Inline[] }
  | { type: "bullet_list" | "ordered_list"; content: { type: "list_item"; content: Inline[] }[] };
export interface RichDoc {
  type: "doc";
  content: DocBlock[];
}

export type BlockKind = "paragraph" | "h3" | "h4" | "bullet" | "ordered";
export const BLOCK_KINDS: { value: BlockKind; label: string; add: string; heading?: true; list?: true }[] = [
  { value: "paragraph", label: "Paragraph", add: "Add a paragraph" },
  { value: "h3", label: "Heading (level 3)", add: "Add a heading", heading: true },
  { value: "h4", label: "Heading (level 4)", add: "Add a subheading", heading: true },
  { value: "bullet", label: "Bulleted list (one item per line)", add: "Add a bulleted list", list: true },
  { value: "ordered", label: "Numbered list (one item per line)", add: "Add a numbered list", list: true },
];

/** Formatting over `[start, end)` of a block's text (UTF-16 offsets, as the text box reports its selection). */
export interface Span {
  start: number;
  end: number;
  mark: Mark;
}

export interface EditBlock {
  key: string;
  kind: BlockKind;
  /** Paragraphs keep line breaks; a list has one item per line; a heading is one line. */
  text: string;
  spans: Span[];
}

let blockCounter = 0;
export const blockKey = () => `b${++blockCounter}`;

const sameMark = (a: Mark, b: Mark) => JSON.stringify(a) === JSON.stringify(b);

/** Joins touching or overlapping spans of the same mark, drops empty ones, keeps them in order. */
export function mergeSpans(spans: Span[]): Span[] {
  const sorted = spans.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Span[] = [];
  for (const span of sorted) {
    const last = [...out].reverse().find((s) => sameMark(s.mark, span.mark));
    if (last && last.end >= span.start) last.end = Math.max(last.end, span.end);
    else out.push({ ...span });
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

// --- Document → blocks ------------------------------------------------------------------------------------------------------

function inlineToText(content: Inline[], offset: number, spans: Span[]): string {
  let text = "";
  for (const node of content) {
    if (node.type === "hard_break") {
      text += "\n";
      continue;
    }
    const start = offset + text.length;
    text += node.text;
    for (const mark of node.marks ?? []) spans.push({ start, end: start + node.text.length, mark });
  }
  return text;
}

/** A stored document as editable blocks (an unreadable value reads as no text). */
export function docToBlocks(value: unknown): EditBlock[] {
  const doc = value as RichDoc | null;
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) return [];
  return doc.content.map((block) => {
    const spans: Span[] = [];
    if (block.type === "bullet_list" || block.type === "ordered_list") {
      let text = "";
      block.content.forEach((item, i) => {
        if (i > 0) text += "\n";
        text += inlineToText(item.content, text.length, spans);
      });
      return { key: blockKey(), kind: block.type === "bullet_list" ? "bullet" : "ordered", text, spans: mergeSpans(spans) };
    }
    const single = block as Extract<DocBlock, { type: "paragraph" | "heading" }>;
    const text = inlineToText(single.content, 0, spans);
    const kind: BlockKind = single.type === "heading" ? (single.level === 4 ? "h4" : "h3") : "paragraph";
    return { key: blockKey(), kind, text, spans: mergeSpans(spans) };
  });
}

// --- Blocks → document ------------------------------------------------------------------------------------------------------

/** One mark of each type over a run (a later link or language wins over an earlier one). */
function marksAt(spans: Span[], a: number, b: number): Mark[] {
  const byType = new Map<string, Mark>();
  for (const span of spans) if (span.start <= a && span.end >= b) byType.set(span.mark.type, span.mark);
  const order = ["bold", "italic", "link", "lang"];
  return [...byType.values()].sort((x, y) => order.indexOf(x.type) - order.indexOf(y.type));
}

/** A stretch of text `[from, to)` of a block as inline nodes (line breaks as `hard_break` where `breaks`). */
function runs(text: string, spans: Span[], from: number, to: number, breaks: boolean): Inline[] {
  const cuts = new Set<number>([from, to]);
  for (const s of spans) {
    if (s.start > from && s.start < to) cuts.add(s.start);
    if (s.end > from && s.end < to) cuts.add(s.end);
  }
  for (let i = from; i < to; i++) {
    if (text[i] !== "\n") continue;
    cuts.add(i);
    cuts.add(i + 1);
  }
  const points = [...cuts].sort((x, y) => x - y);
  const out: Inline[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const piece = text.slice(a, b);
    if (!piece) continue;
    if (piece === "\n") {
      if (breaks) out.push({ type: "hard_break" });
      else out.push({ type: "text", text: " " });
      continue;
    }
    const marks = marksAt(spans, a, b);
    out.push(marks.length ? { type: "text", text: piece, marks } : { type: "text", text: piece });
  }
  return out;
}

/** The editable blocks as a document (empty blocks and list lines left out; blank lines split paragraphs). */
export function blocksToDoc(blocks: EditBlock[]): RichDoc {
  const content: DocBlock[] = [];
  for (const block of blocks) {
    const { text, spans } = block;
    if (block.kind === "bullet" || block.kind === "ordered") {
      const items: { type: "list_item"; content: Inline[] }[] = [];
      let start = 0;
      for (const line of text.split("\n")) {
        const end = start + line.length;
        if (line.trim()) items.push({ type: "list_item", content: runs(text, spans, start, end, false) });
        start = end + 1;
      }
      if (items.length) content.push({ type: block.kind === "bullet" ? "bullet_list" : "ordered_list", content: items });
      continue;
    }
    if (block.kind === "h3" || block.kind === "h4") {
      const inline = runs(text, spans, 0, text.length, false);
      if (text.trim()) content.push({ type: "heading", level: block.kind === "h4" ? 4 : 3, content: inline });
      continue;
    }
    // A paragraph: a blank line starts another one.
    const pattern = /\n[ \t]*\n+/g;
    let start = 0;
    const pieces: [number, number][] = [];
    for (const match of text.matchAll(pattern)) {
      pieces.push([start, match.index]);
      start = match.index + match[0].length;
    }
    pieces.push([start, text.length]);
    for (const [a, b] of pieces) {
      if (!text.slice(a, b).trim()) continue;
      content.push({ type: "paragraph", content: runs(text, spans, a, b, true) });
    }
  }
  return { type: "doc", content };
}

// --- Editing -----------------------------------------------------------------------------------------------------------------

/**
 * The spans after the text changed from `before` to `after` (one contiguous edit, as a text box makes): text typed inside
 * a span joins it, text typed at a span's edge does not, deleted text takes its formatting with it.
 */
export function shiftSpans(spans: Span[], before: string, after: string): Span[] {
  let p = 0;
  const max = Math.min(before.length, after.length);
  while (p < max && before[p] === after[p]) p++;
  let q = 0;
  while (q < max - p && before[before.length - 1 - q] === after[after.length - 1 - q]) q++;
  const oldEnd = before.length - q;
  const newEnd = after.length - q;
  const delta = after.length - before.length;
  // A start inside the replaced text moves past the new text; an end inside it moves to where the edit began.
  const at = (x: number, edge: "start" | "end") => {
    if (edge === "start") return x < p ? x : x >= oldEnd ? x + delta : newEnd;
    return x <= p ? x : x >= oldEnd ? x + delta : p;
  };
  return mergeSpans(spans.map((s) => ({ ...s, start: at(s.start, "start"), end: at(s.end, "end") })));
}

/** Removes formatting of one type over `[a, b)` (a span crossing the edge is cut). */
export function clearRange(spans: Span[], a: number, b: number, type: Mark["type"]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (s.mark.type !== type || s.end <= a || s.start >= b) {
      out.push(s);
      continue;
    }
    if (s.start < a) out.push({ ...s, end: a });
    if (s.end > b) out.push({ ...s, start: b });
  }
  return mergeSpans(out);
}

/** Whether `[a, b)` is wholly covered by formatting of one type. */
export function covered(spans: Span[], a: number, b: number, type: Mark["type"]): boolean {
  let at = a;
  for (const s of [...spans].filter((x) => x.mark.type === type).sort((x, y) => x.start - y.start)) {
    if (s.start > at) break;
    at = Math.max(at, s.end);
    if (at >= b) return true;
  }
  return at >= b;
}

/** Bold or italic on `[a, b)`: removed where the whole range has it, added otherwise. */
export function toggleMark(spans: Span[], a: number, b: number, type: "bold" | "italic"): Span[] {
  if (a >= b) return spans;
  if (covered(spans, a, b, type)) return clearRange(spans, a, b, type);
  return mergeSpans([...spans, { start: a, end: b, mark: { type } }]);
}

/** A link or a language over `[a, b)` (replacing any of the same type there), or none (`mark` null). */
export function setRangeMark(spans: Span[], a: number, b: number, type: "link" | "lang", mark: Mark | null): Span[] {
  if (a >= b) return spans;
  const cleared = clearRange(spans, a, b, type);
  return mark ? mergeSpans([...cleared, { start: a, end: b, mark }]) : cleared;
}

/** A block's text in its new kind: a heading keeps one line. */
export function retype(block: EditBlock, kind: BlockKind): EditBlock {
  if (kind === "h3" || kind === "h4") {
    const text = block.text.replace(/\n/g, " ");
    return { ...block, kind, text };
  }
  return { ...block, kind };
}

/** Characters of text (as people count them), for the field's limit. */
export const charCount = (blocks: EditBlock[]) => blocks.reduce((n, b) => n + [...b.text.replace(/\n/g, "")].length, 0);
