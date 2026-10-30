/**
 * Page builder (A5) — the security review's findings that pure code decides (brief §68). Each test failed on the code
 * before its fix (a0f381b):
 *
 * - F1: the Certificates page takes no "Contact details" block (its phone numbers are long digit groups, which the
 *   certificate guard keeps off that page), and a displayed value (a figure) is certificate copy there.
 * - F4: a reusable section's name is plain text (no control or direction-override characters, no markup, one line).
 * - F6: every frame the builder draws is sandboxed and never allowed to navigate the window above it.
 * - I1: the ids the approved components build from record slugs ("m-<machine>", "line-<service>", "<service>") are taken
 *   on their page.
 * - I3: an email target carries no percent-escape or fragment into its mailto: address.
 * - I5: a parse never hands out a default object another parse shares.
 * - I6: a question's answer holding a link inside a list item is not "nested too deeply".
 *
 * The final security pass (each test failed on 96c3ebb): certificate copy is read as a visitor reads it — each text piece
 * as it is drawn (a line break inside a field no longer splits a number or an expiry phrase past the guard), digits
 * separated by invisible format characters as one number, and every link target's address, anchor, email and phone.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { REGISTRY } from "../../src/server/builder/registry.ts";
import { defaultsOf, type Content } from "../../src/server/builder/fields.ts";
import { reusableNameSchema } from "../../src/server/builder/input.ts";
import { EMAIL_RE, type LinkTarget } from "../../src/server/builder/links.ts";
import { CERTIFICATE_LINK, certificateIssues } from "../../src/server/builder/references.ts";
import { EMPTY_RICH } from "../../src/server/builder/richtext.ts";
import { digitGuardProblem, hasRegistrationNumber, textProblem } from "../../src/server/cms/text.ts";
import { allowedOn, CONTRACTS, HERO_VARIANT_OF, layoutIssues, libraryFor, type LayoutSection } from "../../src/server/builder/structure.ts";
import type { OwnerKind } from "../../src/server/builder/block.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const all = { desktop: true, tablet: true, mobile: true };

function initial(kind: OwnerKind): LayoutSection[] {
  return CONTRACTS[kind].initial.map((s, i) => {
    const def = REGISTRY.get(s.blockType)!;
    return {
      id: `s${i}`,
      blockType: s.blockType,
      anchor: s.anchor ?? def.fixedAnchor ?? null,
      visible: true,
      devices: { ...all },
      locked: def.locked,
      reusableId: null,
      variant: s.blockType === "page.hero" ? HERO_VARIANT_OF[kind] : undefined,
    };
  });
}

const generic = (id: string, blockType = "generic.heading", anchor: string | null = null): LayoutSection => ({
  id,
  blockType,
  anchor,
  visible: true,
  devices: { ...all },
  locked: REGISTRY.get(blockType)!.locked,
  reusableId: null,
});

/** A generic section placed before the page's closing section (which stays last). */
const beforeLast = (sections: LayoutSection[], extra: LayoutSection) => [...sections.slice(0, -1), extra, sections.at(-1)!];
const messages = (issues: { message: string }[]) => issues.map((i) => i.message).join(" | ");

describe("F1 — the Certificates page", () => {
  test("takes no Contact details block (phone numbers are digit groups); other pages still do", () => {
    const contact = REGISTRY.get("generic.contact_details")!;
    assert.equal(allowedOn("system:certificates", contact), false);
    assert.ok(!libraryFor("system:certificates").some((d) => d.key === "generic.contact_details"));
    const page = beforeLast(initial("system:certificates"), generic("c", "generic.contact_details"));
    assert.match(messages(layoutIssues("system:certificates", page)), /“Contact details” can't be part of the Certificates\./);
    for (const kind of ["generic", "home", "system:about", "system:contact", "service"] as const) assert.equal(allowedOn(kind, contact), true, kind);
    // Everything else the other pages may add stays available there.
    const others = CONTRACTS["system:about"].additions.filter((key) => key !== "generic.contact_details");
    assert.deepEqual(CONTRACTS["system:certificates"].additions, others);
  });

  test("a figure is shown as text, so it is a value certificate copy reads; ids and addresses the page never shows are not", () => {
    const figure = REGISTRY.get("generic.statistics")!.settings.figures;
    assert.ok(figure.kind === "items" && figure.settings.value.kind === "value" && !figure.settings.value.technical);
    const video = REGISTRY.get("generic.video")!.settings.videoId;
    assert.ok(video.kind === "value" && video.technical === true);
    const place = REGISTRY.get("generic.map")!.settings.placeLink;
    assert.ok(place.kind === "value" && place.technical === true);
  });
});

describe("F4 — a reusable section's name is plain text", () => {
  test("control, direction-override and newline characters and markup are refused; ordinary names are kept", () => {
    for (const bad of ["Test a‮b", "Test a\u0000b", "Test two\nlines", "<b>Test</b>", "Test ⁦isolate⁩"]) {
      assert.equal(reusableNameSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
    assert.equal(reusableNameSchema.safeParse("   ").success, false);
    assert.equal(reusableNameSchema.parse("  Test shared FAQ  "), "Test shared FAQ");
    assert.equal(reusableNameSchema.parse("أسئلة مشتركة تجريبية"), "أسئلة مشتركة تجريبية");
    assert.equal(reusableNameSchema.safeParse("x".repeat(121)).success, false);
  });
});

describe("F6 — frames the builder draws", () => {
  const files = (dir: string): string[] =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".tsx") ? [join(dir, entry.name)] : []));

  test("every iframe is sandboxed, and none may navigate the window above it", () => {
    const frames = [...files("src/components/builder"), ...files("src/components/admin/builder")].flatMap((file) =>
      [...readFileSync(join(ROOT, file), "utf8").matchAll(/<iframe\b[\s\S]*?\/>/g)].map((match) => ({ file, tag: match[0] })),
    );
    assert.equal(frames.length, 3, "the video player, the map and the builder's preview canvas");
    for (const { file, tag } of frames) {
      assert.match(tag, /\ssandbox="[a-z -]*"/, `${file}: ${tag}`);
      assert.doesNotMatch(tag, /allow-top-navigation/, file);
    }
  });
});

describe("I1 — ids the approved components build from record slugs", () => {
  test("are taken on their page, and free elsewhere", () => {
    const services = initial("system:services");
    const row = beforeLast(services, generic("g", "generic.heading", "laser-cutting"));
    assert.match(messages(layoutIssues("system:services", row, { recordSlugs: { service: ["laser-cutting"] } })), /already used/);
    const home = initial("home");
    assert.match(messages(layoutIssues("home", [...home, generic("g", "generic.heading", "m-fiber-laser-6kw")], { recordSlugs: { machine: ["fiber-laser-6kw"] } })), /already used/);
    const capabilities = initial("system:capabilities");
    for (const [anchor, slugs] of [
      ["line-laser-cutting", { service: ["laser-cutting"] }],
      ["fiber-laser-6kw-name", { machine: ["fiber-laser-6kw"] }],
      ["fiber-laser-6kw", { machine: ["fiber-laser-6kw"] }],
    ] as const) {
      assert.match(messages(layoutIssues("system:capabilities", beforeLast(capabilities, generic("g", "generic.heading", anchor)), { recordSlugs: slugs })), /already used/, anchor);
    }
    const page = [...initial("generic"), generic("g", "generic.heading", "laser-cutting"), generic("h", "generic.heading", "m-fiber-laser-6kw")];
    assert.deepEqual(layoutIssues("generic", page, { recordSlugs: { service: ["laser-cutting"], machine: ["fiber-laser-6kw"] } }), []);
  });
});

describe("I3 — email targets", () => {
  test("no percent-escapes or fragments in the address; ordinary addresses pass", () => {
    for (const bad of ["a%0d%0abcc@example.com", "name#x@example.com", "a%40b@example.com"]) assert.equal(EMAIL_RE.test(bad), false, bad);
    for (const good of ["info@example.com", "first.last+tag@example.com", "o'neil@example.co.uk"]) assert.equal(EMAIL_RE.test(good), true, good);
  });
});

describe("I5 — defaults are never shared between parses", () => {
  test("a selection's ids and a rich document's content are new arrays each time", () => {
    const hero = REGISTRY.get("page.hero")!;
    const first = REGISTRY.validate(hero, {}, {});
    assert.ok(first.ok);
    const ids = (first.settings.prints as { ids: string[] }).ids;
    ids.push("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    try {
      const second = REGISTRY.validate(hero, {}, {});
      assert.ok(second.ok);
      assert.deepEqual((second.settings.prints as { ids: string[] }).ids, []);
    } finally {
      ids.length = 0;
    }
    const text = REGISTRY.get("generic.rich_text")!;
    const a = REGISTRY.validate(text, {}, { en: {} });
    assert.ok(a.ok);
    const body = (a.content.en!.body as { content: unknown[] }).content;
    body.push({ type: "paragraph", content: [] });
    try {
      const b = REGISTRY.validate(text, {}, { en: {} });
      assert.ok(b.ok);
      assert.deepEqual((b.content.en!.body as { content: unknown[] }).content, []);
      assert.deepEqual(EMPTY_RICH, { type: "doc", content: [] });
    } finally {
      body.length = 0;
    }
  });
});

describe("I6 — nesting", () => {
  test("a question's answer with a link inside a list item is valid", () => {
    const faq = REGISTRY.get("generic.faq")!;
    const answer = {
      type: "doc",
      content: [{ type: "bullet_list", content: [{ type: "list_item", content: [{ type: "text", text: "Test link", marks: [{ type: "link", target: { type: "system", key: "contact", anchor: "quote" } }] }] }] }],
    };
    const result = REGISTRY.validate(faq, { questions: [{ id: "q1" }] }, { en: { questions: { q1: { question: "Test question?", answer } } } });
    assert.equal(result.ok, true, JSON.stringify(result));
  });
});

describe("Final review — certificate copy as a visitor reads it", () => {
  /** A block's default data with English texts (and settings) changed. */
  function dataOf(key: string, en: Content, settings: Record<string, unknown> = {}) {
    const def = REGISTRY.get(key)!;
    const defaults = defaultsOf(def.settings, def.content, () => "i1");
    return { def, data: { settings: { ...defaults.settings, ...settings }, content: { en: { ...defaults.content, ...en } } } };
  }
  const issuesOf = (key: string, en: Content, settings: Record<string, unknown> = {}) => {
    const { def, data } = dataOf(key, en, settings);
    return certificateIssues(def, data);
  };

  test("a line break inside a field splits no number or expiry phrase past the guard; separate fields stay separate", () => {
    for (const intro of ["Registration 1010\n123\n456", "This licence is valid\nuntil 1447 AH", "Valid\nthrough 2027", "\u0635\u0627\u0644\u062D\u0629\n\u062D\u062A\u0649 \u0662\u0660\u0662\u0667"]) {
      const issues = issuesOf("generic.heading", { title: "Test heading", intro });
      assert.equal(issues.length, 1, JSON.stringify(intro));
      assert.equal(issues[0].path, "content.en.intro", "reported at the field that holds it");
    }
    // A line break inside a rich text's paragraph (here a repeated item's answer) likewise.
    const answer = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Registration 1010" }, { type: "hard_break" }, { type: "text", text: "123 456" }] }] };
    assert.equal(issuesOf("generic.faq", { questions: { i1: { question: "Test question?", answer } } }).length, 1);
    // Controls: two fields are two pieces of the page (never read as one number), and ordinary text passes.
    assert.deepEqual(issuesOf("generic.heading", { title: "Test 1010", intro: "123 456" }), []);
    assert.deepEqual(issuesOf("generic.heading", { title: "Test heading", intro: "ISO 9001:2015\nIssued 2026" }), []);
  });

  test("digits separated by invisible format characters are one number; the characters themselves are plain text", () => {
    const formats = ["\u200B", "\u200C", "\u200D", "\u200E", "\u200F", "\u061C", "\u00AD", "\u2060", "\uFEFF"];
    for (const c of formats) {
      assert.equal(textProblem(`Test${c}text`, { multiline: false }), null, `U+${c.codePointAt(0)!.toString(16)} is accepted as plain text`);
      assert.equal(hasRegistrationNumber(`1010${c}123${c}456`), true, `grouped, U+${c.codePointAt(0)!.toString(16)}`);
      assert.equal(hasRegistrationNumber([..."1010123"].join(c)), true, `between every digit, U+${c.codePointAt(0)!.toString(16)}`);
      assert.notEqual(digitGuardProblem(`Test exp${c}iry`), null, `expiry wording, U+${c.codePointAt(0)!.toString(16)}`);
      assert.equal(issuesOf("generic.heading", { title: `Registration 1010${c}123${c}456` }).length, 1);
    }
    assert.notEqual(digitGuardProblem("\u0635\u0644\u0627\u062D\u064A\u200C\u0629"), null, "صلاحية with a zero-width non-joiner");
    // Controls: six digits stay six digits, a date stays a date.
    for (const ok of ["123\u200B456", "Issued\u200B2026", "2026\u200B-01-15"]) assert.equal(digitGuardProblem(ok), null, JSON.stringify(ok));
  });

  test("every other invisible character (default-ignorable, outside Cf) is read past too (A5 acceptance review)", () => {
    // The combining grapheme joiner, variation selectors (two planes), a Mongolian variation selector and a Khmer
    // inherent vowel (Mn), and the Hangul fillers (Lo): drawn as nothing or as a blank, never as a separator the guard knows.
    const invisible = ["\u034F", "\uFE00", "\u{E0100}", "\u180B", "\u17B4", "\u115F", "\u1160", "\u3164", "\uFFA0"];
    for (const c of invisible) {
      const name = `U+${c.codePointAt(0)!.toString(16)}`;
      assert.equal(textProblem(`Test${c}text`, { multiline: false }), null, `${name} is accepted as plain text`);
      assert.equal(hasRegistrationNumber(`1010${c}123${c}456`), true, `grouped, ${name}`);
      assert.equal(hasRegistrationNumber([..."1010123"].join(c)), true, `between every digit, ${name}`);
      assert.notEqual(digitGuardProblem(`Test exp${c}iry`), null, `expiry wording, ${name}`);
      assert.notEqual(digitGuardProblem(`This licence is valid unt${c}il 1447 AH`), null, `"valid until", ${name}`);
      assert.equal(issuesOf("generic.heading", { title: `Registration 1010${c}123${c}456` }).length, 1, name);
    }
    // Controls: six digits stay six digits, a date stays a date.
    for (const ok of ["123\u034F456", "Issued\u3164 2026", "2026\uFE00-01-15"]) assert.equal(digitGuardProblem(ok), null, JSON.stringify(ok));
  });

  test("a link's address, anchor, email or phone number holds no registration number; record links and ordinary addresses pass", () => {
    const button = (target: LinkTarget) => ({ actions: [{ id: "i1", target, style: "primary" }] });
    const cta = (target: LinkTarget) => issuesOf("generic.cta", { title: "Test call", actions: { i1: { label: "Test button" } } }, button(target));
    for (const target of [
      { type: "external", url: "https://verify.example.org/?no=1010123456" },
      { type: "external", url: "https://verify.example.org/c/1010-123-456" },
      { type: "anchor", anchor: "doc-1010123456" },
      { type: "system", key: "certificates", anchor: "c1010123456" },
    ] satisfies LinkTarget[]) {
      assert.deepEqual(cta(target), [{ path: "settings.actions.0.target", message: CERTIFICATE_LINK }], JSON.stringify(target));
    }
    for (const target of [
      { type: "external", url: "https://www.iso.org/iso-9001-quality-management.html" },
      { type: "system", key: "certificates" },
      { type: "service", id: "01HZY1234567890ABCDEFGHJKM" },
      { type: "anchor", anchor: "iso-9001" },
    ] satisfies LinkTarget[]) {
      assert.deepEqual(cta(target), [], JSON.stringify(target));
    }
    // A link inside a rich text (an answer).
    const answer = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test link", marks: [{ type: "link", target: { type: "external", url: "https://example.org/1010123456" } }] }] }] };
    assert.deepEqual(issuesOf("generic.faq", { questions: { i1: { question: "Test question?", answer } } }), [{ path: "content.en.questions.i1.answer", message: CERTIFICATE_LINK }]);
    // Email and phone targets (only legal sections take contact links today) are read too.
    for (const target of [
      { type: "phone", number: "+966 1010 123 456" },
      { type: "email", address: "c1010123456@example.com" },
    ] satisfies LinkTarget[]) {
      const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test contact", marks: [{ type: "link", target }] }] }] };
      assert.deepEqual(issuesOf("legal.section", { title: "Test section", body }), [{ path: "content.en.body", message: CERTIFICATE_LINK }], target.type);
    }
  });
});
