/**
 * The rich-text model of the page builder (A1-CONTENT-MODEL §12; A5 brief §14): a validated JSON document, never HTML.
 *
 * Nodes: paragraph, heading (levels 3 and 4 — a page's h1 and a section's h2 are structural), bulleted list, numbered
 * list, list item, line break. Marks: bold, italic, link (a structured target, `links.ts`), language (`en` / `ar`; the
 * renderer adds the direction). Text is plain text by A3's rules (no control or direction-override characters, nothing in
 * angle brackets). Nothing else can be expressed: an unknown node, mark or key fails validation, so a document can never
 * carry a script, a style, an event handler or a URL scheme other than the link kinds the field allows.
 *
 * A3's paragraph documents are valid documents here (paragraphs of text and line breaks), so A3 content reads unchanged.
 * The renderer (`src/components/builder/RichText.tsx`) builds React elements from a validated document only.
 *
 * Pure: the registry, the editor's paste conversion, the Server Actions and the unit tests share it.
 */
import { z } from "zod";
import { charLength, TEXT_PROBLEM_MESSAGES, textProblem } from "../cms/text.ts";
import { DEFAULT_LINK_KINDS, linkTargetSchema, type LinkKind, type LinkTarget } from "./links.ts";

export type RichMark = { type: "bold" } | { type: "italic" } | { type: "link"; target: LinkTarget } | { type: "lang"; lang: "en" | "ar" };
export type RichInlineNode = { type: "text"; text: string; marks?: RichMark[] } | { type: "hard_break" };
export interface RichParagraphNode {
  type: "paragraph";
  content: RichInlineNode[];
}
export interface RichHeadingNode {
  type: "heading";
  level: 3 | 4;
  content: RichInlineNode[];
}
export interface RichListItemNode {
  type: "list_item";
  content: RichInlineNode[];
}
export interface RichListNode {
  type: "bullet_list" | "ordered_list";
  content: RichListItemNode[];
}
export type RichBlockNode = RichParagraphNode | RichHeadingNode | RichListNode;
export interface RichDocument {
  type: "doc";
  content: RichBlockNode[];
}

export const EMPTY_RICH: RichDocument = { type: "doc", content: [] };

export interface RichLimits {
  /** Every node counted (blocks, list items, inline nodes). */
  maxNodes: number;
  /** Characters of text, as people count them. */
  maxChars: number;
  /** Which link kinds the field takes (contact links only where allowed). */
  links: readonly LinkKind[];
  /** Whether headings may be used (short fields such as a card body take paragraphs and lists only). */
  headings: boolean;
  /** Whether lists may be used. */
  lists: boolean;
}

export const DEFAULT_RICH_LIMITS: RichLimits = { maxNodes: 400, maxChars: 12_000, links: DEFAULT_LINK_KINDS, headings: true, lists: true };

const MARK_ORDER = ["bold", "italic", "link", "lang"] as const;

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z.object({ type: z.literal("link"), target: linkTargetSchema }).strict(),
  z.object({ type: z.literal("lang"), lang: z.enum(["en", "ar"]) }).strict(),
]);

const inlineSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1).max(4000), marks: z.array(markSchema).max(4).optional() }).strict(),
  z.object({ type: z.literal("hard_break") }).strict(),
]);

const inlineList = z.array(inlineSchema).max(400);

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), content: inlineList }).strict(),
  z.object({ type: z.literal("heading"), level: z.union([z.literal(3), z.literal(4)]), content: inlineList }).strict(),
  z
    .object({
      type: z.enum(["bullet_list", "ordered_list"]),
      content: z.array(z.object({ type: z.literal("list_item"), content: inlineList }).strict()).min(1).max(100),
    })
    .strict(),
]);

const docShape = z.object({ type: z.literal("doc"), content: z.array(blockSchema).max(200) }).strict();

/** Whether a block is a list (narrows the block's type). */
export const isListBlock = (block: RichBlockNode): block is RichListNode => block.type === "bullet_list" || block.type === "ordered_list";

function inlineNodes(doc: RichDocument): RichInlineNode[] {
  return doc.content.flatMap((block) => (isListBlock(block) ? block.content.flatMap((item) => item.content) : block.content));
}

/** Nodes in a document: each block, each list item and each inline node. */
export function nodeCount(doc: RichDocument): number {
  return doc.content.reduce((n, block) => {
    if (isListBlock(block)) return n + 1 + block.content.reduce((m, item) => m + 1 + item.content.length, 0);
    return n + 1 + block.content.length;
  }, 0);
}

/** Characters of text in a document. */
export const textLength = (doc: RichDocument) => inlineNodes(doc).reduce((n, node) => n + (node.type === "text" ? charLength(node.text) : 0), 0);

/** Each paragraph, heading and list item as plain text (a line break as a space): the pieces the page shows on their own. */
export function richBlocksPlain(doc: RichDocument): string[] {
  const line = (content: RichInlineNode[]) => content.map((node) => (node.type === "text" ? node.text : " ")).join("");
  return doc.content.flatMap((block) => (isListBlock(block) ? block.content.map((item) => line(item.content)) : [line(block.content)]));
}

/** The document's text, one block per line (search, audit lengths, completeness). */
export const richToPlain = (doc: RichDocument): string => richBlocksPlain(doc).join("\n");

export const isRichEmpty = (doc: RichDocument) => richToPlain(doc).trim() === "";

/** Every link target in a document (reference checks; anchors in use). */
export const richLinks = (doc: RichDocument): LinkTarget[] =>
  inlineNodes(doc).flatMap((node) => (node.type === "text" ? (node.marks ?? []).flatMap((mark) => (mark.type === "link" ? [mark.target] : [])) : []));

/**
 * The stored form: empty paragraphs, headings and list items dropped, lists without items dropped, marks in one order,
 * neighbouring text with the same marks joined. Two documents that look the same are stored the same.
 */
export function normalizeRich(doc: RichDocument): RichDocument {
  const marksKey = (marks: RichMark[] | undefined) => JSON.stringify(marks ?? []);
  const inline = (content: RichInlineNode[]): RichInlineNode[] => {
    const out: RichInlineNode[] = [];
    for (const node of content) {
      if (node.type === "hard_break") {
        out.push(node);
        continue;
      }
      if (!node.text) continue;
      const marks = node.marks?.length ? [...node.marks].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type)) : undefined;
      const last = out[out.length - 1];
      if (last && last.type === "text" && marksKey(last.marks) === marksKey(marks)) {
        out[out.length - 1] = { ...last, text: last.text + node.text };
      } else {
        out.push(marks ? { type: "text", text: node.text, marks } : { type: "text", text: node.text });
      }
    }
    // A line break at the very start or end of a block shows nothing.
    while (out[0]?.type === "hard_break") out.shift();
    while (out[out.length - 1]?.type === "hard_break") out.pop();
    return out;
  };
  const blocks: RichBlockNode[] = [];
  for (const block of doc.content) {
    if (isListBlock(block)) {
      const items = block.content.map((item) => ({ type: "list_item" as const, content: inline(item.content) })).filter((item) => item.content.length > 0);
      if (items.length) blocks.push({ type: block.type, content: items });
    } else {
      const content = inline(block.content);
      if (content.length) blocks.push(block.type === "heading" ? { type: "heading", level: block.level, content } : { type: "paragraph", content });
    }
  }
  return { type: "doc", content: blocks };
}

/**
 * The Zod schema of a rich-text field: the shape above, text checked as plain text, marks unique (one link, one
 * language), the field's link kinds and limits; returns the normalized document.
 */
export function richTextSchema(limits: Partial<RichLimits> = {}) {
  const l = { ...DEFAULT_RICH_LIMITS, ...limits };
  return docShape
    .superRefine((doc, ctx) => {
      const d = doc as RichDocument;
      if (nodeCount(d) > l.maxNodes) ctx.addIssue({ code: "custom", message: `This text is too long (more than ${l.maxNodes} parts). Split it into another section.` });
      if (textLength(d) > l.maxChars) ctx.addIssue({ code: "custom", message: `Use at most ${l.maxChars} characters.` });
      for (const block of d.content) {
        if (block.type === "heading" && !l.headings) ctx.addIssue({ code: "custom", message: "Headings are not available in this field." });
        if (isListBlock(block) && !l.lists) ctx.addIssue({ code: "custom", message: "Lists are not available in this field." });
      }
      for (const node of inlineNodes(d)) {
        if (node.type !== "text") continue;
        const problem = textProblem(node.text, { multiline: false });
        if (problem) {
          ctx.addIssue({ code: "custom", message: TEXT_PROBLEM_MESSAGES[problem] });
          return;
        }
        const types = (node.marks ?? []).map((m) => m.type);
        if (new Set(types).size !== types.length) ctx.addIssue({ code: "custom", message: "A piece of text has the same formatting twice." });
        for (const mark of node.marks ?? []) {
          if (mark.type === "link" && !l.links.includes(mark.target.type)) ctx.addIssue({ code: "custom", message: "This kind of link is not allowed in this text." });
        }
      }
    })
    .transform((doc) => normalizeRich(doc as RichDocument));
}

/** A stored document read defensively: a valid document, or the empty one (a page never crashes on bad JSON). */
export function readRich(value: unknown, limits: Partial<RichLimits> = {}): RichDocument {
  const parsed = richTextSchema(limits).safeParse(value);
  return parsed.success ? parsed.data : EMPTY_RICH;
}

/**
 * Pasted plain text → a document (the editor's paste: every formatting outside the model is discarded). Blank lines
 * separate paragraphs; single line breaks are kept; lines starting with "- ", "* " or "• " become a bulleted list and
 * "1. " a numbered list.
 */
export function plainToRich(value: string): RichDocument {
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (!text) return EMPTY_RICH;
  const blocks: RichBlockNode[] = [];
  for (const chunk of text.split(/\n[ \t]*\n+/)) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    const bullets = lines.every((line) => /^[-*•]\s+/.test(line));
    const numbers = lines.every((line) => /^\d{1,3}[.)]\s+/.test(line));
    if (bullets || numbers) {
      blocks.push({
        type: bullets ? "bullet_list" : "ordered_list",
        content: lines.map((line): RichListItemNode => ({ type: "list_item", content: [{ type: "text", text: line.replace(bullets ? /^[-*•]\s+/ : /^\d{1,3}[.)]\s+/, "") }] })),
      });
      continue;
    }
    blocks.push({ type: "paragraph", content: lines.flatMap((line, i): RichInlineNode[] => (i === 0 ? [{ type: "text", text: line }] : [{ type: "hard_break" }, { type: "text", text: line }])) });
  }
  return normalizeRich({ type: "doc", content: blocks });
}
