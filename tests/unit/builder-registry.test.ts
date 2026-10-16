/**
 * Page builder (A5) — the block registry: one code-defined entry per block type (brief §9–§12), the strict schemas
 * derived from each declaration (no mass assignment, plain text only), schema versions and upcasters (§10), repeated
 * items keyed by id in both languages (§15), selections (§16), references (§17), duplication and reusable detach
 * (§47, §44), the public projection, embeds (§19–§20) and the size bounds (§65).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BLOCK_CATEGORIES, FREE, OWNER_KINDS, type BlockDefinition } from "../../src/server/builder/block.ts";
import { ALL_BLOCKS, BESPOKE_BLOCKS } from "../../src/server/builder/blocks/index.ts";
import { GENERIC_BLOCKS, mapPlaceLinkProblem, SAFE_ADDITIONS } from "../../src/server/builder/blocks/generic.ts";
import { automatic, items, media, selection, text, textarea, value } from "../../src/server/builder/blocks/kit.ts";
import {
  BUILDER_LIMITS,
  cloneWithNewIds,
  defaultsOf,
  hasAnyText,
  missingRequired,
  missingSettings,
  newItemId,
  parityIssues,
  plainTextOf,
  projectSettings,
  referencesOf,
  type Settings,
} from "../../src/server/builder/fields.ts";
import { createRegistry, readProblem, REGISTRY } from "../../src/server/builder/registry.ts";

const ULID = (n: number) => `01J${String(n).padStart(23, "0")}`;

/** The block types the A5 brief lists (§11 and §12), exactly. */
const BRIEF_BESPOKE = `home.hero home.capability_strip home.about home.services home.machinery home.projects home.industries home.clients
home.compliance home.contact page.hero page.closing_cta about.overview about.what about.metal about.beyond about.vision about.approach
about.process about.why about.workshop about.machinery about.work about.clients about.compliance services.index service.hero
service.overview service.scope service.process service.machines service.applications service.gallery service.why service.related
service.projects service.cta capabilities.power capabilities.console capabilities.register capabilities.service_lines
capabilities.source projects.featured projects.highlights projects.gallery projects.index project.hero project.photos
project.details industries.sectors industries.index clients.wall certificates.register certificates.redaction contact.quote
contact.location legal.contents legal.section not_found.view`.split(/\s+/);
const BRIEF_GENERIC = `generic.hero generic.heading generic.rich_text generic.image generic.text_image generic.gallery generic.video
generic.services_grid generic.projects_grid generic.machine_grid generic.client_logos generic.certificates generic.statistics
generic.feature_cards generic.timeline generic.process generic.industries generic.faq generic.cta generic.contact_details
generic.quote_form generic.map generic.logo_strip generic.divider generic.spacer generic.button_group generic.downloads
generic.reusable`.split(/\s+/);

const def = (key: string) => {
  const found = REGISTRY.get(key);
  assert.ok(found, key);
  return found;
};

/** A block's defaults with texts in both languages (the same text), valid unless a test changes them. */
function sample(key: string) {
  const d = def(key);
  const { settings, content } = defaultsOf(d.settings, d.content, (() => {
    let n = 0;
    return () => `i${++n}`;
  })());
  return { d, settings, en: structuredClone(content), ar: structuredClone(content) };
}

describe("registry completeness", () => {
  test("exactly the brief's 59 bespoke and 28 generic block types, each once", () => {
    assert.deepEqual(BESPOKE_BLOCKS.map((b) => b.key).sort(), [...BRIEF_BESPOKE].sort());
    assert.deepEqual(GENERIC_BLOCKS.map((b) => b.key).sort(), [...BRIEF_GENERIC].sort());
    assert.equal(BESPOKE_BLOCKS.length, 59);
    assert.equal(GENERIC_BLOCKS.length, 28);
    assert.equal(new Set(ALL_BLOCKS.map((b) => b.key)).size, ALL_BLOCKS.length);
    assert.equal(REGISTRY.all().length, 87);
  });

  test("a key registered twice is refused", () => {
    const one = def("generic.divider");
    assert.throws(() => createRegistry([one, one]), /registered twice/);
  });

  test("every block declares what the brief requires (§9)", () => {
    for (const b of ALL_BLOCKS) {
      assert.match(b.key, /^[a-z][a-z_]*\.[a-z][a-z_]*$/, b.key);
      assert.ok(Number.isInteger(b.version) && b.version >= 1, `${b.key} version`);
      assert.ok(b.label && b.description, `${b.key} label`);
      assert.ok(b.category in BLOCK_CATEGORIES, `${b.key} category`);
      assert.ok(b.icon, `${b.key} icon`);
      assert.ok(b.owners.length > 0 && b.owners.every((o) => (OWNER_KINDS as readonly string[]).includes(o)), `${b.key} owners`);
      assert.ok(b.max >= 1, `${b.key} max`);
      for (let v = 1; v < b.version; v++) assert.ok(b.upcasters[v], `${b.key} upcaster ${v}`);
      if (b.anchor === "fixed") assert.ok(b.fixedAnchor, `${b.key} fixed anchor`);
      else assert.equal(b.fixedAnchor, undefined, `${b.key} has a fixed anchor but ${b.anchor}`);
    }
  });

  test("every block's defaults validate in both languages (a new section is always valid)", () => {
    for (const b of ALL_BLOCKS) {
      if (!b.storable) continue;
      const { settings, en, ar } = sample(b.key);
      const result = REGISTRY.validate(b, settings, { en, ar });
      assert.ok(result.ok, `${b.key}: ${JSON.stringify(!result.ok && result.issues)}`);
    }
  });

  test("bespoke blocks are never reusable and generic ones never own a site page", () => {
    for (const b of BESPOKE_BLOCKS) assert.equal(b.reusable, false, b.key);
    for (const b of GENERIC_BLOCKS) assert.deepEqual([...b.owners], ["generic"], b.key);
    for (const key of SAFE_ADDITIONS) assert.ok(def(key).storable && def(key).structure === FREE, key);
    assert.ok(!SAFE_ADDITIONS.includes("generic.quote_form" as never) && !SAFE_ADDITIONS.includes("generic.hero" as never));
  });

  test("a block is created structure-locked exactly when its policy fixes it", () => {
    for (const b of ALL_BLOCKS) {
      const fixed = !b.structure.movable && !b.structure.hideable && !b.structure.removable && !b.structure.duplicable;
      assert.equal(b.locked, fixed, b.key);
    }
  });

  test("only the main-heading blocks render the h1, and they are locked, first-only and single", () => {
    const h1 = ALL_BLOCKS.filter((b) => b.h1).map((b) => b.key).sort();
    assert.deepEqual(h1, ["generic.hero", "home.hero", "not_found.view", "page.hero", "project.hero", "service.hero"]);
    for (const key of h1) {
      assert.equal(def(key).max, 1, key);
      assert.equal(def(key).locked, true, key);
      assert.deepEqual(def(key).structure, { movable: false, hideable: false, removable: false, duplicable: false }, key);
    }
  });

  test("the library-only reusable entry can't be validated or read as a stored section", () => {
    const entry = def("generic.reusable");
    assert.equal(entry.storable, false);
    const result = REGISTRY.validate(entry, {}, {});
    assert.equal(result.ok, false);
    assert.deepEqual(REGISTRY.read("generic.reusable", 1, {}, {}), { state: "not_storable" });
  });
});

describe("settings and content validation", () => {
  test("an undeclared settings key is refused (no mass assignment)", () => {
    const { d, settings, en } = sample("generic.heading");
    const result = REGISTRY.validate(d, { ...settings, lockVersion: 9 }, { en });
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.issues.some((i) => i.path.startsWith("settings")));
  });

  test("an undeclared content key is refused, in either language", () => {
    const { d, settings, en, ar } = sample("generic.heading");
    for (const bad of [{ en: { ...en, html: "x" }, ar }, { en, ar: { ...ar, status: "complete" } }]) {
      const result = REGISTRY.validate(d, settings, bad);
      assert.equal(result.ok, false);
    }
  });

  test("markup, script and control characters are refused in plain text", () => {
    const { d, settings, en } = sample("generic.heading");
    for (const title of ["<script>alert(1)</script>", "<b>x</b>", "a\u0000b", "x‮y", "line\nbreak"]) {
      const result = REGISTRY.validate(d, settings, { en: { ...en, title } });
      assert.equal(result.ok, false, JSON.stringify(title));
    }
  });

  test("text lengths count characters as people do (Arabic letters once)", () => {
    const { d, settings, en } = sample("generic.heading");
    const ok = REGISTRY.validate(d, settings, { ar: { ...en, title: "ع".repeat(200) } });
    assert.ok(ok.ok);
    const long = REGISTRY.validate(d, settings, { ar: { ...en, title: "ع".repeat(201) } });
    assert.equal(long.ok, false);
  });

  test("an enum takes only its options and an integer only its range", () => {
    const { d, settings, en } = sample("generic.image");
    assert.equal(REGISTRY.validate(d, { ...settings, aspect: "huge" }, { en }).ok, false);
    assert.equal(REGISTRY.validate(d, { ...settings, aspect: "16x9" }, { en }).ok, true);
    const video = sample("generic.video");
    assert.equal(REGISTRY.validate(video.d, { ...video.settings, provider: "dailymotion" }, { en: video.en }).ok, false);
  });

  test("required values, media and links make a section incomplete, never invalid (a draft saves)", () => {
    const { d, settings } = sample("generic.button_group");
    assert.deepEqual(missingSettings(d.settings, settings), ["button 1: Opens"]);
    const done = structuredClone(settings);
    (done.buttons as Settings[])[0].target = { type: "system", key: "contact" };
    assert.deepEqual(missingSettings(d.settings, done), []);
  });

  test("required texts are listed per language, repeated items included", () => {
    const { d, settings, en } = sample("generic.faq");
    const missing = missingRequired(d.settings, d.content, settings, en);
    assert.ok(missing.length > 0);
    assert.equal(hasAnyText(d.settings, d.content, en), false);
  });

  test("depth and size are bounded", () => {
    const { d, settings, en } = sample("generic.rich_text");
    let deep: unknown = "x";
    for (let i = 0; i < BUILDER_LIMITS.jsonDepth + 2; i++) deep = { a: deep };
    const nested = REGISTRY.validate(d, settings, { en: { ...en, body: deep } });
    assert.equal(nested.ok, false);
    assert.match(JSON.stringify(!nested.ok && nested.issues), /nested too deeply/);

    const faq = sample("generic.faq");
    const questions = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}` }));
    const texts = Object.fromEntries(questions.map((e) => [e.id, { question: "Q".repeat(200), answer: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A".repeat(1900) }] }] } }]));
    const big = REGISTRY.validate(faq.d, { ...faq.settings, questions }, { en: { ...faq.en, questions: texts }, ar: { ...faq.ar, questions: texts } });
    assert.equal(big.ok, false);
    assert.match(JSON.stringify(!big.ok && big.issues), /holds too much/);
  });
});

describe("schema versions and upcasters (§10)", () => {
  const v2: BlockDefinition = {
    ...def("generic.divider"),
    key: "test.versioned",
    version: 3,
    settings: { kind: { kind: "enum", label: "Kind", options: [{ value: "line", label: "Line" }, { value: "space", label: "Space" }], default: "line" } },
    content: { label: text("Label", 40) },
    upcasters: {
      1: (old) => ({ settings: { kind: (old.settings as { style?: string }).style === "gap" ? "space" : "line" }, content: old.content }),
      2: (old) => ({ settings: old.settings, content: Object.fromEntries(Object.entries(old.content).map(([l, c]) => [l, { label: String((c as { caption?: string }).caption ?? "") }])) }),
    },
  };
  const registry = createRegistry([v2]);

  test("the latest version validates as is", () => {
    const r = registry.read("test.versioned", 3, { kind: "space" }, { en: { label: "x" } });
    assert.equal(r.state, "ok");
    assert.ok(r.state === "ok" && !r.upcast);
  });

  test("older versions are upcast step by step, then validated again", () => {
    const r = registry.read("test.versioned", 1, { style: "gap" }, { en: { caption: "Old" } });
    assert.equal(r.state, "ok");
    assert.ok(r.state === "ok" && r.upcast);
    assert.deepEqual(r.state === "ok" && r.settings, { kind: "space" });
    assert.deepEqual(r.state === "ok" && r.content.en, { label: "Old" });
  });

  test("an unknown future version (v99) is never edited or shown", () => {
    assert.deepEqual(registry.read("test.versioned", 99, {}, {}), { state: "future_version", stored: 99, latest: 3 });
    assert.match(readProblem({ state: "future_version", stored: 99, latest: 3 }), /newer block version/);
  });

  test("a missing upcaster fails closed", () => {
    const gap = createRegistry([{ ...v2, upcasters: { 2: v2.upcasters[2] } }]);
    assert.deepEqual(gap.read("test.versioned", 1, {}, {}), { state: "no_upcaster", from: 1 });
  });

  test("an upcaster that throws fails closed", () => {
    const broken = createRegistry([{ ...v2, upcasters: { ...v2.upcasters, 1: () => { throw new Error("boom"); } } }]);
    assert.deepEqual(broken.read("test.versioned", 1, {}, {}), { state: "no_upcaster", from: 1 });
  });

  test("an upcast result is revalidated (garbage out of an upcaster is invalid, not rendered)", () => {
    const bad = createRegistry([{ ...v2, upcasters: { ...v2.upcasters, 2: (old) => ({ settings: { ...(old.settings as object), injected: "<script>" }, content: old.content }) } }]);
    const r = bad.read("test.versioned", 2, { kind: "line" }, { en: { caption: "x" } });
    assert.equal(r.state, "invalid");
  });

  test("the upcaster gets a copy (stored JSON is never mutated in place)", () => {
    const stored = { style: "gap" };
    registry.read("test.versioned", 1, stored, { en: { caption: "x" } });
    assert.deepEqual(stored, { style: "gap" });
  });

  test("unknown block types and invalid versions", () => {
    assert.deepEqual(REGISTRY.read("home.unknown", 1, {}, {}), { state: "unknown_type" });
    assert.equal(REGISTRY.read("generic.divider", 0, {}, {}).state, "invalid");
    assert.equal(REGISTRY.read("generic.divider", 1.5, {}, {}).state, "invalid");
    assert.equal(REGISTRY.get("<script>"), undefined);
  });
});

describe("repeated items: EN/AR parity by id (§15)", () => {
  const { d, settings, en, ar } = sample("generic.statistics");
  const ids = (settings.figures as { id: string }[]).map((f) => f.id);

  test("texts keyed by the settings' ids validate; a missing or extra id does not", () => {
    assert.ok(ids.length > 0);
    assert.ok(REGISTRY.validate(d, settings, { en, ar }).ok);
    const missing = structuredClone(ar);
    delete (missing.figures as Record<string, unknown>)[ids[0]];
    const r1 = REGISTRY.validate(d, settings, { en, ar: missing });
    assert.equal(r1.ok, false);
    assert.match(JSON.stringify(!r1.ok && r1.issues), /Arabic texts don't match/);
    const extra = structuredClone(en);
    (extra.figures as Record<string, unknown>)["zz9"] = (extra.figures as Record<string, unknown>)[ids[0]];
    assert.equal(REGISTRY.validate(d, settings, { en: extra, ar }).ok, false);
  });

  test("reordering the items never misaligns the languages", () => {
    const texts = (lang: string) => Object.fromEntries(ids.map((id, i) => [id, { label: `${lang} ${i}`, unit: "" }]));
    const reordered = { ...settings, figures: [...(settings.figures as { id: string }[])].reverse() };
    const r = REGISTRY.validate(d, reordered, { en: { ...en, figures: texts("en") }, ar: { ...ar, figures: texts("ar") } });
    assert.ok(r.ok);
    assert.deepEqual(parityIssues(d.settings, reordered, { en: { figures: texts("en") }, ar: { figures: texts("ar") } }), []);
  });

  test("item ids are well formed and unique", () => {
    const dup = { ...settings, figures: [...(settings.figures as object[]), (settings.figures as object[])[0]] };
    assert.equal(REGISTRY.validate(d, dup, { en }).ok, false);
    const malformed = { ...settings, figures: [{ ...(settings.figures as object[])[0], id: "Bad Id" }] };
    assert.equal(REGISTRY.validate(d, malformed, {}).ok, false);
    for (let i = 0; i < 200; i++) assert.match(newItemId(), /^i[0-9a-z]{8}$/);
  });
});

describe("selections (§16)", () => {
  const { d, settings, en } = sample("generic.projects_grid");
  const key = Object.entries(d.settings).find(([, f]) => f.kind === "selection")![0];
  const check = (value: unknown) => REGISTRY.validate(d, { ...settings, [key]: value }, { en }).ok;

  test("manual: ordered ULIDs, no duplicates, at most the field's maximum", () => {
    assert.ok(check({ mode: "manual", ids: [ULID(2), ULID(1)] }));
    assert.ok(!check({ mode: "manual", ids: [ULID(1), ULID(1)] }));
    assert.ok(!check({ mode: "manual", ids: ["../etc/passwd"] }));
    assert.ok(!check({ mode: "manual", ids: Array.from({ length: 100 }, (_, i) => ULID(i)) }));
  });

  test("automatic: the collection's own sources, a bounded limit, a category only with the category source", () => {
    assert.ok(check({ mode: "automatic", source: "all", limit: 6 }));
    assert.ok(check({ mode: "automatic", source: "featured", limit: 6 }));
    assert.ok(check({ mode: "automatic", source: "category", limit: 6, categoryId: ULID(5) }));
    assert.ok(!check({ mode: "automatic", source: "category", limit: 6 }));
    assert.ok(!check({ mode: "automatic", source: "all", limit: 6, categoryId: ULID(5) }));
    assert.ok(!check({ mode: "automatic", source: "all", limit: 0 }));
    assert.ok(!check({ mode: "automatic", source: "newest", limit: 6 }));
    assert.ok(!check({ mode: "automatic", source: "all", limit: 6, sql: "1=1" }));
  });

  test("machines take no featured or category source", () => {
    const machines = sample("generic.machine_grid");
    const mKey = Object.entries(machines.d.settings).find(([, f]) => f.kind === "selection")![0];
    assert.equal(REGISTRY.validate(machines.d, { ...machines.settings, [mKey]: { mode: "automatic", source: "featured", limit: 3 } }, {}).ok, false);
  });
});

describe("references, duplication, detach and projection", () => {
  const block: BlockDefinition = {
    ...def("generic.divider"),
    key: "test.refs",
    settings: {
      photo: media("Photo"),
      records: selection("Projects", "project", 6, { mode: "manual", ids: [] }),
      cards: items("Cards", "card", { min: 0, max: 4 }, { media: media("Card photo"), source: value("Source", 40, { adminOnly: true }) }, { title: text("Title", 80) }),
      note: value("Provenance", 200, { adminOnly: true }),
    },
    content: { body: { kind: "rich", label: "Text" } },
  };

  test("every media item, record and link a section names is found (rich-text links included)", () => {
    const settings = {
      photo: ULID(1),
      records: { mode: "manual", ids: [ULID(2)] },
      cards: [{ id: "c1", media: ULID(3), source: "x" }],
      note: "",
    };
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "See", marks: [{ type: "link", target: { type: "service", id: ULID(4) } }] }] }] };
    const refs = referencesOf(block.settings, block.content, settings, { en: { body: doc, cards: { c1: { title: "T" } } } });
    assert.deepEqual(refs.media.map((m) => m.id), [ULID(1), ULID(3)]);
    assert.deepEqual(refs.records.map((r) => `${r.type}:${r.id}`), [`project:${ULID(2)}`, `service:${ULID(4)}`]);
    assert.equal(refs.links.length, 1);
    const category = referencesOf(def("generic.projects_grid").settings, {}, { projects: { mode: "automatic", source: "category", limit: 3, categoryId: ULID(9) } }, {});
    assert.deepEqual(category.records, [{ type: "project_category", id: ULID(9), path: "settings.projects.categoryId" }]);
  });

  test("a duplicate's repeated items get new ids, and its texts follow them in both languages", () => {
    const settings = { cards: [{ id: "a", media: null, source: "" }, { id: "b", media: null, source: "" }] };
    const texts = { en: { cards: { a: { title: "A" }, b: { title: "B" } } }, ar: { cards: { a: { title: "أ" }, b: { title: "ب" } } } };
    let n = 0;
    const copy = cloneWithNewIds(block.settings, settings, texts, () => `n${++n}`);
    const newIds = (copy.settings.cards as { id: string }[]).map((c) => c.id);
    assert.deepEqual(newIds, ["n1", "n2"]);
    assert.deepEqual(copy.content.en?.cards, { n1: { title: "A" }, n2: { title: "B" } });
    assert.deepEqual(copy.content.ar?.cards, { n1: { title: "أ" }, n2: { title: "ب" } });
    // The original is untouched.
    assert.deepEqual(settings.cards.map((c) => c.id), ["a", "b"]);
    assert.deepEqual(parityIssues(block.settings, copy.settings, copy.content), []);
  });

  test("detaching a reusable section copies its data with new item ids (the same cloning)", () => {
    const { d, settings, en, ar } = sample("generic.faq");
    const copy = cloneWithNewIds(d.settings, settings, { en, ar });
    const before = (settings.questions as { id: string }[]).map((e) => e.id);
    const after = (copy.settings.questions as { id: string }[]).map((e) => e.id);
    assert.equal(after.length, before.length);
    assert.ok(after.every((id) => !before.includes(id)));
    assert.ok(REGISTRY.validate(d, copy.settings, copy.content).ok);
  });

  test("the public projection drops admin-only fields (provenance, notes)", () => {
    const projected = projectSettings(block.settings, { photo: null, records: { mode: "manual", ids: [] }, cards: [{ id: "c1", media: null, source: "profile p.3" }], note: "internal" });
    assert.equal("note" in projected, false);
    assert.deepEqual(projected.cards, [{ id: "c1", media: null }]);
    const stats = def("generic.statistics");
    const statsDefaults = defaultsOf(stats.settings, stats.content);
    const figures = projectSettings(stats.settings, statsDefaults.settings).figures as Record<string, unknown>[];
    assert.ok(figures.length > 0);
    for (const figure of figures) assert.equal("sourceBasis" in figure, false);
  });

  test("plain text of a section (search, audit lengths)", () => {
    const { d, en } = sample("generic.heading");
    assert.equal(plainTextOf(d.content, d.settings, { ...en, title: "Hello", intro: "World" }), "Hello\nWorld");
  });
});

describe("embeds (§19–§20)", () => {
  const video = sample("generic.video");
  const check = (provider: string, videoId: string) => REGISTRY.validate(video.d, { ...video.settings, provider, videoId }, { en: video.en }).ok;

  test("a video is a typed id of an allowlisted provider, never an embed code or URL", () => {
    assert.ok(check("youtube", "dQw4w9WgXcQ"));
    assert.ok(check("vimeo", "76979871"));
    assert.ok(!check("youtube", "https://youtu.be/dQw4w9WgXcQ"));
    assert.ok(!check("youtube", '<iframe src="x">'));
    assert.ok(!check("youtube", "dQw4w9WgXc"));
    assert.ok(!check("vimeo", "dQw4w9WgXcQ"));
    assert.ok(!check("vimeo", "javascript:1"));
  });

  test("a map takes an address search or a Google Maps place link only", () => {
    assert.equal(mapPlaceLinkProblem("https://maps.app.goo.gl/AbCdEf123"), null);
    assert.equal(mapPlaceLinkProblem("https://www.google.com/maps/place/Riyadh"), null);
    for (const bad of ["http://www.google.com/maps/x", "https://evil.example/maps", "https://www.google.com/search?q=x", "https://user:pw@www.google.com/maps", "javascript:alert(1)", "https://www.google.com/maps/x y"]) {
      assert.notEqual(mapPlaceLinkProblem(bad), null, bad);
    }
    const map = sample("generic.map");
    assert.equal(REGISTRY.validate(map.d, { ...map.settings, placeLink: "https://evil.example/" }, {}).ok, false);
    assert.ok(REGISTRY.validate(map.d, { ...map.settings, query: "Al Mashael, Riyadh" }, {}).ok);
  });

  test("contact details written for a block are a phone number and one email address", () => {
    const c = sample("generic.contact_details");
    assert.ok(REGISTRY.validate(c.d, { ...c.settings, email: "info@example.com" }, {}).ok);
    assert.equal(REGISTRY.validate(c.d, { ...c.settings, email: "a@b.com?subject=x" }, {}).ok, false);
    assert.equal(REGISTRY.validate(c.d, { ...c.settings, phones: [{ id: "p1", number: "javascript:1", whatsapp: false }] }, { en: { ...c.en, phones: { p1: { label: "" } } } }).ok, false);
  });
});

describe("kit helpers", () => {
  test("a selection's default is copied, never shared between sections", () => {
    const field = selection("Projects", "project", 6, automatic("all", 6));
    const a = defaultsOf({ s: field }, {});
    const b = defaultsOf({ s: field }, {});
    (a.settings.s as { limit: number }).limit = 1;
    assert.equal((b.settings.s as { limit: number }).limit, 6);
  });

  test("textarea keeps line breaks; text does not take them", () => {
    const block: BlockDefinition = { ...def("generic.divider"), key: "test.text", settings: {}, content: { one: text("One", 50), many: textarea("Many", 50) } };
    const registry = createRegistry([block]);
    assert.ok(registry.validate(block, {}, { en: { many: "a\nb" } }).ok);
    assert.equal(registry.validate(block, {}, { en: { one: "a\nb" } }).ok, false);
  });
});
