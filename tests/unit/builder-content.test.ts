/**
 * Page builder (A5) — what an editor can express: the rich-text model (brief §14), link targets (§14, §49–§50) and the
 * design inspector's typed tokens and rules (§23–§24): no free CSS, motion that never fades or moves text out of
 * place, AA contrast for every appearance that can be chosen, orange as an accent only.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AA,
  APPEARANCE,
  appearanceAllowed,
  appearanceContrast,
  contrastRatio,
  DELAYS,
  designKeys,
  designSchema,
  motionPresetsFor,
  narrowerColumns,
  SURFACES,
  TONES,
} from "../../src/server/builder/design.ts";
import { contactHref, CONTACT_KINDS, DEFAULT_LINK_KINDS, describeTarget, linkField, linkTargetSchema } from "../../src/server/builder/links.ts";
import { EMPTY_RICH, isRichEmpty, normalizeRich, plainToRich, readRich, richLinks, richTextSchema, richToPlain, type RichDocument } from "../../src/server/builder/richtext.ts";

const ULID = "01J0000000000000000000000A";
const para = (...content: unknown[]) => ({ type: "doc", content: [{ type: "paragraph", content }] });
const rich = richTextSchema();
const ok = (doc: unknown) => rich.safeParse(doc).success;

describe("rich text (§14)", () => {
  test("the allowed nodes: paragraph, headings 3–4, both lists, list items, line breaks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", level: 3, content: [{ type: "text", text: "Scope" }] },
        { type: "paragraph", content: [{ type: "text", text: "One" }, { type: "hard_break" }, { type: "text", text: "Two" }] },
        { type: "bullet_list", content: [{ type: "list_item", content: [{ type: "text", text: "a" }] }] },
        { type: "ordered_list", content: [{ type: "list_item", content: [{ type: "text", text: "b" }] }] },
        { type: "heading", level: 4, content: [{ type: "text", text: "Detail" }] },
      ],
    };
    assert.ok(ok(doc));
    assert.equal(richToPlain(rich.parse(doc) as RichDocument), "Scope\nOne Two\na\nb\nDetail");
  });

  test("anything else is refused: other heading levels, unknown nodes and keys, HTML, styles, events", () => {
    for (const level of [1, 2, 5, 6]) assert.ok(!ok({ type: "doc", content: [{ type: "heading", level, content: [{ type: "text", text: "x" }] }] }), `h${level}`);
    assert.ok(!ok({ type: "doc", content: [{ type: "html", value: "<b>x</b>" }] }));
    assert.ok(!ok({ type: "doc", content: [{ type: "image", src: "x.png" }] }));
    assert.ok(!ok({ type: "doc", content: [{ type: "paragraph", style: "color:red", content: [] }] }));
    assert.ok(!ok({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", onclick: "alert(1)" }] }] }));
    assert.ok(!ok(para({ type: "text", text: "<script>alert(1)</script>" })));
    assert.ok(!ok(para({ type: "text", text: "<img src=x onerror=alert(1)>" })));
    assert.ok(!ok(para({ type: "text", text: "bidi ‮ override" })));
    assert.ok(!ok(para({ type: "text", text: "nul \u0000" })));
    assert.ok(!ok("<p>html</p>"));
    assert.ok(!ok({ type: "doc", content: "x" }));
  });

  test("the allowed marks: bold, italic, link and language — each at most once", () => {
    assert.ok(ok(para({ type: "text", text: "x", marks: [{ type: "bold" }, { type: "italic" }, { type: "lang", lang: "ar" }] })));
    assert.ok(!ok(para({ type: "text", text: "x", marks: [{ type: "underline" }] })));
    assert.ok(!ok(para({ type: "text", text: "x", marks: [{ type: "bold" }, { type: "bold" }] })));
    assert.ok(!ok(para({ type: "text", text: "x", marks: [{ type: "lang", lang: "fr" }] })));
    assert.ok(!ok(para({ type: "text", text: "x", marks: [{ type: "color", value: "red" }] })));
  });

  test("links are structured targets: no javascript:, data: or other schemes can be expressed", () => {
    const link = (target: unknown) => para({ type: "text", text: "x", marks: [{ type: "link", target }] });
    assert.ok(ok(link({ type: "system", key: "contact", anchor: "quote" })));
    assert.ok(ok(link({ type: "service", id: ULID })));
    assert.ok(ok(link({ type: "external", url: "https://example.com/a?b=1" })));
    for (const target of [
      { type: "external", url: "javascript:alert(1)" },
      { type: "external", url: "data:text/html,<script>x</script>" },
      { type: "external", url: "http://example.com" },
      { type: "external", url: "vbscript:x" },
      { type: "external", url: "https://user:pw@example.com" },
      { type: "external", url: "https://example.com\\@evil.com" },
      { type: "url", href: "javascript:alert(1)" },
      { type: "system", key: "admin" },
      { type: "page", id: "../../etc" },
      { type: "anchor", anchor: "Top Of Page" },
    ]) {
      assert.ok(!ok(link(target)), JSON.stringify(target));
    }
  });

  test("contact links only where the field allows them", () => {
    const mail = para({ type: "text", text: "x", marks: [{ type: "link", target: { type: "email", address: "info@example.com" } }] });
    assert.ok(!ok(mail));
    assert.ok(richTextSchema({ links: [...DEFAULT_LINK_KINDS, ...CONTACT_KINDS] }).safeParse(mail).success);
  });

  test("headings and lists can be switched off per field", () => {
    const heading = { type: "doc", content: [{ type: "heading", level: 3, content: [{ type: "text", text: "x" }] }] };
    const list = { type: "doc", content: [{ type: "bullet_list", content: [{ type: "list_item", content: [{ type: "text", text: "x" }] }] }] };
    assert.ok(!richTextSchema({ headings: false }).safeParse(heading).success);
    assert.ok(!richTextSchema({ lists: false }).safeParse(list).success);
  });

  test("bounded: nodes and characters", () => {
    assert.ok(!richTextSchema({ maxChars: 10 }).safeParse(para({ type: "text", text: "12345678901" })).success);
    const many = { type: "doc", content: Array.from({ length: 150 }, () => ({ type: "paragraph", content: [{ type: "text", text: "x" }] })) };
    assert.ok(!richTextSchema({ maxNodes: 100 }).safeParse(many).success);
  });

  test("normalized: empty parts dropped, marks ordered, neighbours with the same marks joined", () => {
    const doc = {
      type: "doc" as const,
      content: [
        { type: "paragraph" as const, content: [] },
        {
          type: "paragraph" as const,
          content: [
            { type: "hard_break" as const },
            { type: "text" as const, text: "a", marks: [{ type: "italic" as const }, { type: "bold" as const }] },
            { type: "text" as const, text: "b", marks: [{ type: "bold" as const }, { type: "italic" as const }] },
            { type: "hard_break" as const },
          ],
        },
        { type: "bullet_list" as const, content: [{ type: "list_item" as const, content: [] }] },
      ],
    };
    assert.deepEqual(normalizeRich(doc), { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "ab", marks: [{ type: "bold" }, { type: "italic" }] }] }] });
    assert.ok(isRichEmpty(EMPTY_RICH));
  });

  test("a stored document is read defensively (bad JSON reads as empty, never rendered)", () => {
    assert.deepEqual(readRich({ type: "doc", content: [{ type: "html", value: "<b>" }] }), EMPTY_RICH);
    assert.deepEqual(readRich(null), EMPTY_RICH);
  });

  test("paste keeps only text: paragraphs, line breaks, bulleted and numbered lists", () => {
    const doc = plainToRich("First line\nsecond line\n\n- one\n- two\n\n1. a\n2. b\n\nEnd");
    assert.deepEqual(
      doc.content.map((b) => b.type),
      ["paragraph", "bullet_list", "ordered_list", "paragraph"],
    );
    assert.equal(richToPlain(doc), "First line second line\none\ntwo\na\nb\nEnd");
    assert.ok(ok(doc));
    assert.deepEqual(plainToRich("   "), EMPTY_RICH);
  });

  test("the links of a document are found (references and anchors in use)", () => {
    const doc = rich.parse(para({ type: "text", text: "x", marks: [{ type: "link", target: { type: "anchor", anchor: "faq" } }] })) as RichDocument;
    assert.deepEqual(richLinks(doc), [{ type: "anchor", anchor: "faq" }]);
  });
});

describe("link targets (§49–§50)", () => {
  test("each kind takes exactly its own fields", () => {
    assert.ok(linkTargetSchema.safeParse({ type: "system", key: "projects", anchor: "gallery" }).success);
    assert.ok(!linkTargetSchema.safeParse({ type: "system", key: "projects", url: "/x" }).success);
    assert.ok(linkTargetSchema.safeParse({ type: "project", id: ULID }).success);
    assert.ok(!linkTargetSchema.safeParse({ type: "project", id: ULID, anchor: "x" }).success);
    assert.ok(!linkTargetSchema.safeParse({ type: "machine", id: ULID.toLowerCase() }).success);
  });

  test("external addresses are https, public, without credentials, stored as the browser opens them", () => {
    const parsed = linkTargetSchema.parse({ type: "external", url: "https://EXAMPLE.com/Path" });
    assert.deepEqual(parsed, { type: "external", url: "https://example.com/Path" });
    for (const url of ["https://localhost/x", "https://10.0.0.1/", "ftp://example.com", "//example.com", "https://exa mple.com"]) {
      assert.ok(!linkTargetSchema.safeParse({ type: "external", url }).success, url);
    }
  });

  test("email and phone targets cannot carry parameters or scripts", () => {
    assert.ok(linkTargetSchema.safeParse({ type: "email", address: "info@rawasy.example" }).success);
    for (const address of ["info@x.com?subject=hi", "a@b", "javascript:alert(1)@x.com", "a b@x.com"]) assert.ok(!linkTargetSchema.safeParse({ type: "email", address }).success, address);
    assert.ok(linkTargetSchema.safeParse({ type: "phone", number: "+966 50 000 0000" }).success);
    for (const number of ["+966;rm", "12", "javascript:1", "+966 50 000 0000 ext 1"]) assert.ok(!linkTargetSchema.safeParse({ type: "phone", number }).success, number);
    assert.equal(contactHref({ type: "phone", number: "+966 50-000 0000" }), "tel:+966500000000");
    assert.equal(contactHref({ type: "email", address: "info@x.com" }), "mailto:info@x.com");
  });

  test("a field takes only its kinds, and an optional field takes null", () => {
    const field = linkField(["system", "anchor"]);
    assert.ok(field.safeParse(null).success);
    assert.ok(field.safeParse({ type: "anchor", anchor: "faq" }).success);
    assert.ok(!field.safeParse({ type: "external", url: "https://example.com" }).success);
  });

  test("descriptions never spell out an email address or a phone number", () => {
    assert.equal(describeTarget({ type: "email", address: "info@x.com" }), "email address");
    assert.equal(describeTarget({ type: "phone", number: "+966500000000" }), "phone number");
    assert.equal(describeTarget({ type: "external", url: "https://example.com/a" }), "example.com");
  });
});

describe("design inspector (§23–§24)", () => {
  test("a block's design object takes only the controls its spec offers (strict)", () => {
    const schema = designSchema({ align: true, tone: true });
    assert.deepEqual(designKeys({ align: true, tone: true }).sort(), ["align", "tone"]);
    assert.ok(schema.safeParse({ align: "center", tone: "teal" }).success);
    assert.ok(!schema.safeParse({ align: "center", columns: 3 }).success);
    assert.ok(!schema.safeParse({ css: "color: red" }).success);
    assert.ok(!schema.safeParse({ align: "left" }).success, "physical alignment is not offered (logical start/end only)");
    assert.ok(!schema.safeParse({ padding: "13px" }).success);
  });

  test("columns 1–4 where supported; narrower screens may always take fewer", () => {
    const schema = designSchema({ columns: [2, 3, 4], responsive: true });
    assert.ok(schema.safeParse({ columns: 4, responsive: { tablet: { columns: 2 }, mobile: { columns: 1 } } }).success);
    assert.ok(!schema.safeParse({ columns: 1 }).success);
    assert.ok(!schema.safeParse({ columns: 5 }).success);
    assert.ok(!schema.safeParse({ responsive: { desktop: { columns: 2 } } }).success, "desktop is the base, not an override");
    assert.ok(!schema.safeParse({ responsive: { mobile: { surface: "dark" } } }).success, "only layout keys are overridable");
    assert.deepEqual(narrowerColumns([2, 3]), [1, 2, 3]);
  });

  test("motion: text never fades or scales; fade and scale only for media; stagger only for lists", () => {
    assert.deepEqual(motionPresetsFor("text", false).sort(), ["none", "reveal", "slide"]);
    assert.ok(!motionPresetsFor("text", true).includes("fade"));
    assert.ok(motionPresetsFor("text", true).includes("stagger"));
    assert.ok(motionPresetsFor("media", false).includes("fade") && motionPresetsFor("media", false).includes("scale"));
    assert.ok(!motionPresetsFor("decoration", false).includes("scale"));
    const text = designSchema({ motion: { target: "text" } });
    assert.ok(text.safeParse({ motion: { preset: "reveal", duration: "3", delay: 120 } }).success);
    assert.ok(!text.safeParse({ motion: { preset: "fade", duration: "3", delay: 0 } }).success);
    assert.ok(!text.safeParse({ motion: { preset: "spin", duration: "3", delay: 0 } }).success);
    assert.ok(!text.safeParse({ motion: { preset: "reveal", duration: "750ms", delay: 0 } }).success);
    assert.ok(!text.safeParse({ motion: { preset: "reveal", duration: "3", delay: 30 } }).success);
    assert.ok(!text.safeParse({ motion: { preset: "reveal", duration: "3", delay: 660 } }).success);
    assert.ok(!text.safeParse({ motion: { preset: "reveal", duration: "3", delay: 0, iterations: "infinite" } }).success);
    assert.deepEqual([...DELAYS], Array.from({ length: 11 }, (_, i) => i * 60));
  });

  test("every surface and tone that can be chosen together reaches AA in both themes; the rest are refused", () => {
    const schema = designSchema({ surfaces: SURFACES, tone: true });
    let allowed = 0;
    for (const surface of SURFACES) {
      for (const tone of TONES) {
        const ratio = appearanceContrast(surface, tone);
        const valid = schema.safeParse({ surface, tone }).success;
        assert.equal(valid, appearanceAllowed(surface, tone), `${surface}/${tone}`);
        assert.equal(valid, ratio >= AA, `${surface}/${tone} ${ratio}`);
        if (valid) allowed++;
      }
    }
    assert.equal(APPEARANCE.size, allowed);
    assert.ok(allowed > 0);
    assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 1e-9);
  });

  test("orange is an accent, never a surface", () => {
    assert.ok(!(SURFACES as readonly string[]).includes("orange"));
    assert.ok(!designSchema({ surfaces: SURFACES }).safeParse({ surface: "orange" }).success);
    assert.ok(!designSchema({ tone: true }).safeParse({ tone: "orange" }).success);
  });
});
