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
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { REGISTRY } from "../../src/server/builder/registry.ts";
import { reusableNameSchema } from "../../src/server/builder/input.ts";
import { EMAIL_RE } from "../../src/server/builder/links.ts";
import { EMPTY_RICH } from "../../src/server/builder/richtext.ts";
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
