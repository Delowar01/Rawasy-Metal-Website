/**
 * Core CMS (A3) — the pure rules: plain text and the paragraph document (no HTML ever), addresses, the certificate digit
 * guard, search normalization, translation completeness, Move up / Move down, relation diffs, and the form reader's
 * refusal of anything a schema does not define.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { localeState, planTranslationStatus, sameValue, type StatusInput } from "../../src/server/cms/completeness.ts";
import { formToObject } from "../../src/server/cms/form.ts";
import { diffOrdered, planMove } from "../../src/server/cms/reorder.ts";
import {
  digitGuardProblem,
  docToPlain,
  EMPTY_DOC,
  httpsUrlProblem,
  isDocEmpty,
  likePattern,
  linesList,
  normalizeForSearch,
  plainText,
  plainToDoc,
  richDocSchema,
  richTextFromPlain,
  sitePathProblem,
  textProblem,
} from "../../src/server/cms/text.ts";

describe("plain text", () => {
  test("markup, script, control and direction-override characters are refused; Arabic and punctuation are not", () => {
    for (const bad of ["<b>x</b>", "a <script>", "<!-- c -->", "</p>", "<?php", "x\u0000y", "x\u0007", "x‮y", "x⁦y"]) {
      assert.notEqual(textProblem(bad, { multiline: true }), null, JSON.stringify(bad));
    }
    for (const ok of ["5 < 6 and 7 > 3", "قص بالليزر — ٦ كيلوواط", "R&D, 100% steel", "a\tb", "x‏y"]) assert.equal(textProblem(ok, { multiline: false }), null, ok);
    assert.equal(textProblem("two\nlines", { multiline: false }), "newline");
    assert.equal(textProblem("two\nlines", { multiline: true }), null);
  });

  test("lengths are counted in characters people see (code points), after trimming; CRLF becomes LF", () => {
    const schema = plainText(5, { multiline: true });
    assert.equal(schema.parse("  héllo  "), "héllo");
    assert.equal(schema.parse("a\r\nb"), "a\nb");
    assert.equal(schema.safeParse("١٢٣٤٥").success, true);
    assert.equal(schema.safeParse("😀😀😀😀😀").success, true);
    assert.equal(schema.safeParse("123456").success, false);
  });
});

describe("the paragraph document (A1's rich text, paragraphs only in A3)", () => {
  test("a blank line separates paragraphs, a single line break is kept, empty paragraphs are dropped", () => {
    const doc = plainToDoc("One.\nStill one.\n\n\n  Two.  \n\n");
    assert.deepEqual(doc, {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "One." }, { type: "hard_break" }, { type: "text", text: "Still one." }] },
        { type: "paragraph", content: [{ type: "text", text: "Two." }] },
      ],
    });
    assert.equal(docToPlain(doc), "One.\nStill one.\n\nTwo.");
    assert.deepEqual(plainToDoc("   "), EMPTY_DOC);
    assert.ok(isDocEmpty(EMPTY_DOC));
    assert.ok(isDocEmpty(null));
  });

  test("the stored shape is strict: no other node, mark, attribute or HTML", () => {
    assert.equal(richDocSchema.safeParse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link" }] }] }] }).success, false);
    assert.equal(richDocSchema.safeParse({ type: "doc", content: [{ type: "heading", content: [] }] }).success, false);
    assert.equal(richDocSchema.safeParse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "<img src=x>" }] }] }).success, false);
    assert.equal(richDocSchema.safeParse({ type: "doc", content: [], html: "<p>" }).success, false);
    assert.equal(richDocSchema.safeParse(plainToDoc("Fine text.")).success, true);
  });

  test("the editor's schema: per-paragraph length and paragraph count, markup refused", () => {
    const schema = richTextFromPlain(10, 2);
    assert.equal(schema.safeParse("short\n\nshort").success, true);
    assert.equal(schema.safeParse("way too long a paragraph").success, false);
    assert.equal(schema.safeParse("a\n\nb\n\nc").success, false);
    assert.equal(schema.safeParse("<p>x</p>").success, false);
  });

  test("lists: one item per line, trimmed, empty lines dropped, bounded", () => {
    const schema = linesList(3, 10);
    assert.deepEqual(schema.parse(" a \n\n b\n"), ["a", "b"]);
    assert.equal(schema.safeParse("a\nb\nc\nd").success, false);
    assert.equal(schema.safeParse("x".repeat(11)).success, false);
    assert.equal(schema.safeParse("<i>a</i>").success, false);
  });
});

describe("addresses", () => {
  test("external website: https, a public host, no credentials, no spaces", () => {
    assert.equal(httpsUrlProblem("https://example.com"), null);
    assert.equal(httpsUrlProblem("https://sub.example.co.uk/path?q=1"), null);
    for (const bad of ["http://example.com", "javascript:alert(1)", "https://u:p@example.com", "https://localhost", "https://exa mple.com", "ftp://x.com", "data:text/html,x", "//x.com", "https://x..com", `https://x.com/${"a".repeat(250)}`]) {
      assert.notEqual(httpsUrlProblem(bad), null, bad);
    }
  });

  test("canonical override: a lowercase path on this site only", () => {
    for (const ok of ["/", "/en", "/services/laser-cutting", "/en/projects/steel-gate"]) assert.equal(sitePathProblem(ok), null, ok);
    for (const bad of ["https://x.com/a", "//x.com", "/en/", "/A", "/a?b", "/a#b", "/a/../b", "en/a", "/a b"]) assert.notEqual(sitePathProblem(bad), null, bad);
  });
});

describe("the certificate digit guard", () => {
  test("registration numbers in any digit script, grouped numbers and expiry wording are refused; dates are not", () => {
    for (const bad of ["1234567", "No. 12345678", "١٢٣٤٥٦٧", "۱۲۳۴۵۶۷", "12 34 567", "10-2034-5678", "1.234.567", "Valid until expiry", "تاريخ الانتهاء"]) {
      assert.notEqual(digitGuardProblem(bad), null, bad);
    }
    for (const ok of ["2026-01-15", "15/01/2026", "Issued 2026", "Grade A", "سجل تجاري", "123456"]) assert.equal(digitGuardProblem(ok), null, ok);
  });
});

describe("search normalization", () => {
  test("Arabic diacritics, tatweel and letter variants compare equal; digits and case fold", () => {
    assert.equal(normalizeForSearch("إِسْتِشَارَةٌ"), normalizeForSearch("استشاره"));
    assert.equal(normalizeForSearch("مـــدرسة"), "مدرسه");
    assert.equal(normalizeForSearch("مستشفى"), "مستشفي");
    assert.equal(normalizeForSearch("آلة"), "اله");
    assert.equal(normalizeForSearch("Laser  ٦٠٠٠  W"), "laser 6000 w");
  });

  test("LIKE patterns take the query literally (%, _ and \\ escaped)", () => {
    assert.equal(likePattern("50%_off\\"), "%50\\%\\_off\\\\%");
  });
});

describe("translation completeness", () => {
  const base: StatusInput = {
    previous: { en: null, ar: null },
    changed: { en: false, ar: false },
    marked: { en: false, ar: false },
    filled: { en: false, ar: false },
    exists: { en: false, ar: false },
    otherUnaffected: false,
  };
  const plan = (patch: Partial<StatusInput>) => planTranslationStatus({ ...base, ...patch });

  test("states: missing (no text), incomplete (a required field empty), then the stored status", () => {
    assert.equal(localeState(null, false), "missing");
    assert.equal(localeState("draft", false), "incomplete");
    assert.equal(localeState("complete", false), "incomplete");
    assert.equal(localeState("draft", true), "draft");
    assert.equal(localeState("needs_review", true), "needs_review");
  });

  test("Arabic is never required to save; a language with no text has no row", () => {
    const p = plan({ exists: { en: true, ar: false }, filled: { en: true, ar: false }, changed: { en: true, ar: false } });
    assert.deepEqual(p.status, { en: "draft", ar: null });
    assert.deepEqual(p.refused, []);
  });

  test("marking complete is refused while empty or while a required field is missing", () => {
    assert.deepEqual(plan({ marked: { en: true, ar: true }, exists: { en: true, ar: false }, filled: { en: false, ar: false } }).refused, ["en", "ar"]);
  });

  test("a change to one language of a complete item asks for the other's review, unless it does not affect it", () => {
    const both = { previous: { en: "complete", ar: "complete" } as const, marked: { en: true, ar: true }, exists: { en: true, ar: true }, filled: { en: true, ar: true } };
    assert.deepEqual(plan({ ...both, changed: { en: true, ar: false } }).status, { en: "complete", ar: "needs_review" });
    assert.deepEqual(plan({ ...both, changed: { en: true, ar: false }, otherUnaffected: true }).status, { en: "complete", ar: "complete" });
    assert.deepEqual(plan({ ...both, changed: { en: false, ar: false } }).status, { en: "complete", ar: "complete" });
    // An unticked language that is not changed keeps "needs review"; a changed one becomes a draft.
    assert.deepEqual(plan({ ...both, previous: { en: "complete", ar: "needs_review" }, marked: { en: true, ar: false }, changed: { en: false, ar: false } }).status, { en: "complete", ar: "needs_review" });
    assert.deepEqual(plan({ ...both, previous: { en: "complete", ar: "needs_review" }, marked: { en: true, ar: false }, changed: { en: false, ar: true } }).status.ar, "draft");
  });

  test("completedNow only when confirmed by this save", () => {
    const p = plan({ previous: { en: "complete", ar: "draft" }, marked: { en: true, ar: true }, exists: { en: true, ar: true }, filled: { en: true, ar: true } });
    assert.deepEqual(p.completedNow, { en: false, ar: true });
  });

  test("sameValue: empty values are equal, JSON compared by content", () => {
    assert.ok(sameValue(null, ""));
    assert.ok(sameValue(undefined, null));
    assert.ok(sameValue(["a"], ["a"]));
    assert.ok(!sameValue(["a"], ["b"]));
  });
});

describe("Move up / Move down", () => {
  const items = [
    { id: "a", position: 1, active: true },
    { id: "b", position: 2, active: false },
    { id: "c", position: 5, active: true },
    { id: "d", position: 9, active: true },
  ];

  test("swaps with the nearest active item, stepping over archived ones", () => {
    assert.deepEqual(planMove(items, "c", "up"), { kind: "swap", a: { id: "c", position: 5 }, b: { id: "a", position: 1 } });
    assert.deepEqual(planMove(items, "c", "down"), { kind: "swap", a: { id: "c", position: 5 }, b: { id: "d", position: 9 } });
  });

  test("edges, archived and unknown items are refused, whatever order the list comes in", () => {
    assert.deepEqual(planMove([...items].reverse(), "a", "up"), { kind: "edge" });
    assert.deepEqual(planMove(items, "d", "down"), { kind: "edge" });
    assert.deepEqual(planMove(items, "b", "up"), { kind: "missing" });
    assert.deepEqual(planMove(items, "zzz", "up"), { kind: "missing" });
  });

  test("a sequence of moves keeps every position unique and is deterministic", () => {
    let list = items.map((i) => ({ ...i }));
    for (const [id, direction] of [["d", "up"], ["d", "up"], ["a", "down"], ["c", "up"]] as const) {
      const p = planMove(list, id, direction);
      if (p.kind !== "swap") continue;
      list = list.map((i) => (i.id === p.a.id ? { ...i, position: p.b.position } : i.id === p.b.id ? { ...i, position: p.a.position } : i));
    }
    assert.equal(new Set(list.map((i) => i.position)).size, list.length);
    assert.deepEqual(
      [...list].sort((x, y) => x.position - y.position).map((i) => i.id),
      ["c", "b", "d", "a"],
    );
  });

  test("relation diffs: added, removed, reordered", () => {
    assert.deepEqual(diffOrdered(["a", "b", "c"], ["c", "a", "d"]), { added: ["d"], removed: ["b"], reordered: true, changed: true });
    assert.deepEqual(diffOrdered(["a", "b"], ["a", "b"]), { added: [], removed: [], reordered: false, changed: false });
  });
});

describe("the form reader (no mass assignment)", () => {
  test("only `field`, `<group>.<field>` and repeated `rel.<key>` are read; the first value of a repeated field wins", () => {
    const form = formToObject([
      ["slug", "a"],
      ["slug", "b"],
      ["en.title", "T"],
      ["rel.machines", "1"],
      ["rel.machines", "2"],
      ["$ACTION_ID_abc", "x"],
      ["__proto__", "x"],
      ["constructor.prototype", "x"],
      ["en.title.deep", "x"],
      ["a.b.c", "x"],
      ["_type", "service"],
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(form)), { slug: "a", en: { title: "T" }, rel: { machines: ["1", "2"] }, constructor: { prototype: "x" } });
    assert.equal(Object.getPrototypeOf(form), null);
    assert.equal(({} as Record<string, unknown>).prototype, undefined, "no prototype was polluted");
  });

  test("files are ignored", () => {
    const form = formToObject([["en.title", new Blob(["x"]) as unknown as FormDataEntryValue]]);
    assert.deepEqual(JSON.parse(JSON.stringify(form)), {});
  });
});
