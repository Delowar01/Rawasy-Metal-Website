/**
 * A9.2 — the approved pages as page-builder layouts (`src/server/migration/layouts.ts`): the importer's encoding and the
 * database read model's decoding are one map, so decode(encode(today's content)) must give today's content back exactly,
 * and every page text the layouts do not carry must be one the map says is held elsewhere (the quote form's own A7 copy)
 * or one no approved component reads. Also the A9 corrections the import found (A3, A5, A8).
 */
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { describe, test } from "node:test";
import { staticContentSet } from "../../src/content/static-set.ts";
import { decodeLayout, layoutOwners, legalBlocks, legalDoc, planLayout, type PublishedSection } from "../../src/server/migration/layouts.ts";
import { CONTRACTS, layoutIssues, type LayoutSection } from "../../src/server/builder/structure.ts";
import type { OwnerKind } from "../../src/server/builder/block.ts";
import { REGISTRY } from "../../src/server/builder/registry.ts";
import { HERO_VARIANT_OF } from "../../src/server/builder/structure.ts";
import { projectSnapshot } from "../../src/server/publishing/projection.ts";
import { parseInput } from "../../src/server/cms/engine.ts";
import { projectSpec } from "../../src/server/cms/kinds.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const S: Any = staticContentSet();
const left: string[] = [];
const enc = { media: (k: string) => `id:${k}`, id: (t: string, s: string) => `${t}:${s}`, leftOut: (o: string, k: string) => void left.push(`${o} ${k}`) };
const dec = {
  mediaKey: (id: unknown) => (typeof id === "string" && id.startsWith("id:") ? id.slice(3) : null),
  slugOf: (_: unknown, id: unknown) => (typeof id === "string" ? (id.split(":")[1] ?? null) : null),
};

/** Encodes every owner, keeps the visible sections as the public projection does, transforms their texts, decodes. */
function roundTrip(transform: (content: Any) => Any = (c) => c): Any {
  const out: Any = structuredClone(S);
  for (const owner of layoutOwners(S)) {
    const sections: PublishedSection[] = planLayout(owner, S, enc)
      .filter((p) => p.visible)
      .map((p) => ({ blockType: p.block, anchor: p.anchor, settings: p.settings, content: transform(p.content) }));
    decodeLayout(owner, sections, out, S, dec);
  }
  return out;
}

const MARK = "\u2063";
const mark = (v: Any): Any =>
  typeof v === "string"
    ? v === ""
      ? v
      : v + MARK
    : Array.isArray(v)
      ? v.map(mark)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "type" && ("content" in v || "text" in v) ? x : mark(x)]))
        : v;

/** Page copy the layouts do not carry, by prefix: held elsewhere, composed in code, or read by no approved component. */
const NOT_IN_LAYOUTS = [
  // The quote form's words: the A7 form definition holds them (the published form document).
  "contactPage.form.errors.",
  "contactPage.form.fields.",
  "contactPage.form.files.",
  "contactPage.form.groups.",
  "contactPage.form.noscript",
  "contactPage.form.privacy.",
  "contactPage.form.projectTypes.",
  "contactPage.form.ready.",
  "contactPage.form.requiredNote",
  "contactPage.form.serviceOther",
  "contactPage.form.submit",
  // Composed by the Capabilities page in code ("Company profile · p.7"); the blocks carry the composed line read-only.
  "capabilitiesPage.fields.page",
  "capabilitiesPage.fields.profile",
  // The previous design's homepage copy: no Modern Commerce component reads it (TM-1).
  "home.certificates.intro",
  "home.certificates.redacted",
  "home.certificates.view",
  "home.cta.primary",
  "home.hero.scroll",
  "home.intro.beyondLabel",
  "home.intro.beyondTitle",
  "home.intro.capabilitiesLabel",
  "home.intro.explore",
  "home.intro.paragraphs.en.1",
  "home.intro.paragraphs.ar.1",
  "home.intro.workshopDetailAlt",
  "home.machinery.notStated",
  "home.machinery.usedFor",
  "home.metrics.",
  "home.process.",
  "home.projects.view",
  "home.services.figure",
  "home.statement.",
  "home.why.intro",
  "home.why.title",
];
const PAGE_COPY = ["home", "about", "servicesPage", "servicePage", "industriesPage", "clientsPage", "certificatesPage", "projectsPage", "projectDetailPage", "contactPage", "legalDocuments", "legalChrome", "capabilitiesPage", "serviceDetails", "pillars", "capabilityStatements"];
const isText = (path: string) => /\.(en|ar)(\.\d+)?$/.test(path);

describe("A9: today's pages as layouts", () => {
  test("decode(encode(today's content)) is today's content, value for value", () => {
    const out = roundTrip();
    for (const key of Object.keys(S)) assert.ok(isDeepStrictEqual(out[key], S[key]), `${key} changed in the round trip`);
  });

  test("every page text either travels in a layout or is listed as held elsewhere", () => {
    const out = roundTrip(mark);
    const untouched: string[] = [];
    const walk = (a: Any, b: Any, path: string) => {
      if (typeof a === "string") {
        if (a !== "" && a === b && isText(path)) untouched.push(path);
        return;
      }
      if (a && typeof a === "object") for (const k of Object.keys(a)) walk(a[k], b?.[k], `${path}.${k}`);
    };
    for (const key of PAGE_COPY) walk(S[key], out[key], key);
    const unexplained = untouched.filter((p) => !NOT_IN_LAYOUTS.some((prefix) => p.startsWith(prefix)));
    assert.deepEqual(unexplained, [], "page texts the layouts lose");
    // And the list holds nothing a layout does carry (it would hide a regression).
    const stale = NOT_IN_LAYOUTS.filter((prefix) => !untouched.some((p) => p.startsWith(prefix)));
    assert.deepEqual(stale, []);
  });

  test("an edited text reaches its page, an edited shared label reaches every page that shows it", () => {
    const out = roundTrip((content) => {
      const c = structuredClone(content);
      if (c.en && "statement" in c.en && "visionLabel" in c.en) c.en.statement = "Edited statement";
      if (c.en && "seeWork" in c.en) c.en.seeWork = "Edited see the work";
      return c;
    });
    assert.equal(out.home.intro.statement.en, "Edited statement");
    // The shared service labels are read from Laser Cutting's page only (its canonical place).
    assert.equal(out.servicePage.seeWork.en, "Edited see the work");
    assert.equal(out.home.intro.statement.ar, S.home.intro.statement.ar);
  });

  test("a hidden optional service section removes it; hiding a page part keeps today's approved structure", () => {
    const out: Any = structuredClone(S);
    const owner = { service: "laser-cutting" };
    const sections = planLayout(owner, S, enc)
      .filter((p) => p.visible && p.block !== "service.machines")
      .map((p) => ({ blockType: p.block, anchor: p.anchor, settings: p.settings, content: p.content }));
    decodeLayout(owner, sections, out, S, dec);
    assert.equal(out.serviceDetails["laser-cutting"].machines, undefined);
    assert.ok(out.serviceDetails["laser-cutting"].gallery);
  });

  test("items follow the builder: reordered, removed, added", () => {
    const out: Any = structuredClone(S);
    const owner = { page: "about" };
    const sections = planLayout(owner, S, enc)
      .filter((p) => p.visible)
      .map((p) => {
        if (p.block !== "about.why") return { blockType: p.block, anchor: p.anchor, settings: p.settings, content: p.content };
        const pillars = [...(p.settings.pillars as Any[])].reverse().slice(1);
        pillars.push({ id: "new-pillar" });
        const content = structuredClone(p.content) as Any;
        for (const l of ["en", "ar"]) content[l].pillars["new-pillar"] = { title: `New ${l}`, body: `Body ${l}` };
        return { blockType: p.block, anchor: p.anchor, settings: { ...p.settings, pillars }, content };
      });
    decodeLayout(owner, sections, out, S, dec);
    const slugs = S.pillars.map((x: Any) => x.slug).reverse().slice(1);
    assert.deepEqual(out.pillars.map((x: Any) => x.slug), [...slugs, "new-pillar"]);
    assert.equal(out.pillars.at(-1).title.ar, "New ar");
    assert.equal(out.pillars[0].icon, S.pillars.at(-2).icon, "a kept pillar keeps its icon (code)");
  });

  test("a media item the library does not deliver is left out and reported, never referenced", () => {
    left.length = 0;
    const restricted = new Set(["services/engraving-nameplates", "services/engraving-wood", "site/laser-sparks"]);
    const refs = { ...enc, media: (k: string) => (restricted.has(k) ? null : `id:${k}`) };
    const plans = layoutOwners(S).flatMap((o) => planLayout(o, S, refs));
    const json = JSON.stringify(plans);
    for (const key of restricted) assert.equal(json.includes(`id:${key}`), false, key);
    assert.ok(left.some((l) => l.endsWith("site/laser-sparks")));
  });

  test("legal text: paragraphs and lists survive the rich document both ways", () => {
    for (const doc of Object.values(S.legalDocuments) as Any[])
      for (const section of doc.sections) for (const l of ["en", "ar"]) assert.deepEqual(legalBlocks(legalDoc(section.body[l])), section.body[l]);
  });
});

describe("A9 corrections found by the import", () => {
  const all = { desktop: true, tablet: true, mobile: true };
  const initial = (kind: OwnerKind): LayoutSection[] =>
    CONTRACTS[kind].initial.map((s: { blockType: string; anchor?: string }, i: number) => {
      const def = REGISTRY.get(s.blockType)!;
      return { id: `s${i}`, blockType: s.blockType, anchor: s.anchor ?? def.fixedAnchor ?? null, visible: true, devices: { ...all }, locked: def.locked, reusableId: null, variant: s.blockType === "page.hero" ? (HERO_VARIANT_OF as Record<string, string | undefined>)[kind] : undefined } as LayoutSection;
    });

  test("A5: a service without a gallery or projects (Laser Engraving) has a valid layout; the homepage hero's link still holds", () => {
    const service = initial("service").map((s) => (s.blockType === "service.gallery" || s.blockType === "service.projects" ? { ...s, visible: false } : s));
    assert.deepEqual(layoutIssues("service", service), []);
    const home = initial("home").map((s) => (s.anchor === "machinery" ? { ...s, visible: false } : s));
    assert.match(layoutIssues("home", home).map((i) => i.message).join(" | "), /machinery/);
  });

  test("A8: the public projection keeps a record's source basis and pages, never its note or a certificate's expiry", () => {
    const projection = projectSnapshot("machine", { root: { slug: "m", sourceBasis: "profile", sourcePages: [7], sourceNote: "internal", expiresOn: "2030-01-01" }, texts: {}, relations: {}, children: [], mediaLists: {} });
    const root = projection.document.root as Record<string, unknown>;
    assert.equal(root.sourceBasis, "profile");
    assert.deepEqual(root.sourcePages, [7]);
    assert.equal("sourceNote" in root, false);
    assert.equal("expiresOn" in root, false);
  });

  test("A3: a gallery reference with an en dash (the profile's “07\u201308”) is accepted", () => {
    const form = { slug: "p", galleryRef: "07\u201308", en: { title: "T", complete: "1" }, ar: { title: "ت", complete: "1" } };
    const parsed = parseInput(projectSpec, "create", form);
    assert.equal(parsed.ok, true, JSON.stringify(parsed));
  });
});
