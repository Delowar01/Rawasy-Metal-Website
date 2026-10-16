/**
 * Page builder (A5) — the browser side's pure models: the rich-text editor's blocks and formatting ranges
 * (`src/components/admin/builder/rich-edit.ts`, brief §14: text is typed, formatting is chosen, never markup) and the
 * messages between the builder and its preview frame (`preview-protocol.ts`, brief §36–§38: each side uses only a
 * message of the exact expected shape). Every document the editor builds must pass the server's own rich-text schema.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  blocksToDoc,
  charCount,
  clearRange,
  covered,
  docToBlocks,
  mergeSpans,
  retype,
  setRangeMark,
  shiftSpans,
  toggleMark,
  type EditBlock,
  type Span,
} from "../../src/components/admin/builder/rich-edit.ts";
import { isBuilderMessage, isPreviewMessage } from "../../src/server/admin/actions/preview-protocol.ts";
import { normalizeRich, richTextSchema, type RichDocument } from "../../src/server/builder/richtext.ts";

const schema = richTextSchema();
const block = (kind: EditBlock["kind"], text: string, spans: Span[] = []): EditBlock => ({ key: `k-${kind}-${text.length}`, kind, text, spans });
const bold = (start: number, end: number): Span => ({ start, end, mark: { type: "bold" } });
/** The server's view of what the editor sends: valid, and equal to its own normalization. */
function serverAccepts(blocks: EditBlock[]): RichDocument {
  const doc = blocksToDoc(blocks);
  const parsed = schema.safeParse(doc);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues ?? []));
  return normalizeRich(parsed.data as RichDocument);
}
const strip = (blocks: EditBlock[]) => blocks.map(({ kind, text, spans }) => ({ kind, text, spans }));

describe("the rich-text editor's model (§14)", () => {
  test("every kind of block becomes a document the server accepts, and reads back the same", () => {
    const blocks = [
      block("h3", "Test heading"),
      block("paragraph", "First line\nsecond line", [bold(0, 5)]),
      block("h4", "Test subheading"),
      block("bullet", "One\nTwo\nThree", [{ start: 4, end: 7, mark: { type: "italic" } }]),
      block("ordered", "Alpha\nBeta"),
    ];
    const doc = serverAccepts(blocks);
    assert.deepEqual(
      doc.content.map((n) => n.type),
      ["heading", "paragraph", "heading", "bullet_list", "ordered_list"],
    );
    assert.deepEqual(strip(docToBlocks(doc)), strip(blocks));
  });

  test("a blank line starts another paragraph; empty blocks and list lines are left out", () => {
    const doc = serverAccepts([block("paragraph", "One\n\n  \nTwo"), block("paragraph", "   "), block("bullet", "a\n\nb")]);
    assert.equal(doc.content.length, 3);
    assert.deepEqual(
      doc.content.map((n) => n.type),
      ["paragraph", "paragraph", "bullet_list"],
    );
    assert.equal((doc.content[2] as { content: unknown[] }).content.length, 2);
  });

  test("typed markup is never formatting: tags are refused by the server, other text stays characters", () => {
    for (const text of ["<b>not bold</b>", "<script>alert(1)</script>", '<a href="javascript:x">y</a>', "<img src=x onerror=alert(1)>"]) {
      const parsed = schema.safeParse(blocksToDoc([block("paragraph", text)]));
      assert.equal(parsed.success, false, text);
      assert.match(JSON.stringify(parsed.error?.issues), /plain text only/);
    }
    const text = "javascript:alert(1) &amp; **not bold** [not](a link)";
    const doc = serverAccepts([block("paragraph", text)]);
    assert.deepEqual((doc.content[0] as { content: unknown[] }).content, [{ type: "text", text }]);
  });

  test("formatting is ranges over the text: bold toggles, links and languages replace their own kind", () => {
    let spans: Span[] = [];
    spans = toggleMark(spans, 0, 4, "bold");
    assert.ok(covered(spans, 0, 4, "bold"));
    spans = toggleMark(spans, 2, 6, "bold");
    assert.deepEqual(spans, [bold(0, 6)]);
    spans = toggleMark(spans, 1, 3, "bold");
    assert.deepEqual(spans, [bold(0, 1), bold(3, 6)]);
    const link = { type: "link" as const, target: { type: "system", key: "contact" } };
    spans = setRangeMark(spans, 2, 5, "link", link);
    spans = setRangeMark(spans, 3, 4, "link", { type: "link", target: { type: "anchor", anchor: "faq" } });
    assert.equal(spans.filter((s) => s.mark.type === "link").length, 3);
    spans = setRangeMark(spans, 0, 6, "link", null);
    assert.equal(spans.filter((s) => s.mark.type === "link").length, 0);
    spans = setRangeMark(spans, 0, 6, "lang", { type: "lang", lang: "ar" });
    const doc = serverAccepts([block("paragraph", "abcdef", spans)]);
    assert.ok(JSON.stringify(doc).includes('"lang":"ar"'));
  });

  test("editing keeps formatting on its words: typing inside joins it, at its edges does not, deleting takes it", () => {
    const spans = [bold(6, 11)]; // "Hello world" → "world"
    assert.deepEqual(shiftSpans(spans, "Hello world", "Hello, world"), [bold(7, 12)]);
    assert.deepEqual(shiftSpans(spans, "Hello world", "Hello wo-rld"), [bold(6, 12)]);
    assert.deepEqual(shiftSpans(spans, "Hello world", "Hello world!"), [bold(6, 11)]);
    assert.deepEqual(shiftSpans(spans, "Hello world", "Hello "), []);
    assert.deepEqual(shiftSpans(spans, "Hello world", "Hello wd"), [bold(6, 8)]);
    assert.deepEqual(clearRange([bold(0, 10)], 3, 6, "bold"), [bold(0, 3), bold(6, 10)]);
    assert.deepEqual(mergeSpans([bold(0, 2), bold(2, 4), bold(5, 5)]), [bold(0, 4)]);
  });

  test("a heading keeps one line; lengths count characters as people do (Arabic letters once)", () => {
    assert.equal(retype(block("paragraph", "a\nb"), "h3").text, "a b");
    assert.equal(retype(block("paragraph", "a\nb"), "bullet").text, "a\nb");
    assert.equal(charCount([block("paragraph", "مرحبا\nبكم"), block("h3", "Hi")]), 10);
  });

  test("a stored document that can't be read is no text (never rendered as it is)", () => {
    for (const bad of [null, "text", { type: "doc" }, { type: "html", content: [] }, 42]) assert.deepEqual(docToBlocks(bad), []);
  });
});

describe("builder ⇄ preview messages (§36–§38): only the exact shapes are used", () => {
  test("the preview's messages", () => {
    assert.ok(isPreviewMessage({ source: "rawasy-preview", type: "ready", found: ["a"], missing: [], notes: { a: ["n"] } }));
    assert.ok(isPreviewMessage({ source: "rawasy-preview", type: "pick", id: "01J0000000000000000000000A" }));
    assert.ok(isPreviewMessage({ source: "rawasy-preview", type: "locale", locale: "ar" }));
    assert.ok(isPreviewMessage({ source: "rawasy-preview", type: "theme", theme: "dark" }));
    assert.ok(isPreviewMessage({ source: "rawasy-preview", type: "link", href: "/en/contact" }));
    for (const bad of [
      null,
      "ready",
      [],
      { source: "rawasy-builder", type: "pick", id: "x" },
      { source: "rawasy-preview", type: "ready", found: ["a"], missing: [] },
      { source: "rawasy-preview", type: "ready", found: "a", missing: [], notes: {} },
      { source: "rawasy-preview", type: "ready", found: [], missing: [], notes: { a: "n" } },
      { source: "rawasy-preview", type: "ready", found: [], missing: [], notes: { a: [1] } },
      { source: "rawasy-preview", type: "ready", found: [], missing: [], notes: [] },
      { source: "rawasy-preview", type: "pick", id: 7 },
      { source: "rawasy-preview", type: "locale", locale: "fr" },
      { source: "rawasy-preview", type: "theme", theme: "blue" },
      { source: "rawasy-preview", type: "link" },
      { source: "rawasy-preview", type: "eval", code: "x" },
    ])
      assert.equal(isPreviewMessage(bad), false, JSON.stringify(bad));
  });

  test("the builder's messages", () => {
    assert.ok(isBuilderMessage({ source: "rawasy-builder", type: "select", id: null, scroll: true }));
    assert.ok(isBuilderMessage({ source: "rawasy-builder", type: "select", id: "01J0000000000000000000000A", scroll: false }));
    assert.ok(isBuilderMessage({ source: "rawasy-builder", type: "hover", id: null }));
    for (const bad of [
      { source: "rawasy-builder", type: "select", id: null },
      { source: "rawasy-builder", type: "select", id: 3, scroll: true },
      { source: "rawasy-builder", type: "hover" },
      { source: "rawasy-builder", type: "render", html: "<b>x</b>" },
      { source: "rawasy-preview", type: "hover", id: null },
    ])
      assert.equal(isBuilderMessage(bad), false, JSON.stringify(bad));
  });
});
