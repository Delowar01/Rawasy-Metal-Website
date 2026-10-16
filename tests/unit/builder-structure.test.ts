/**
 * Page builder (A5) — the structure policy (brief §26–§27, §48, §56–§57): every owner's contract, the layout check (one
 * h1 source first, required parts, owner types, maximum instances, anchors, protected anchors, the legal pages' locked
 * structure) and the change check (what is structure, who may change it, which sections never move, hide or go), with
 * the reasons people read. Authority is decided from permission keys (the registry's matrix), never role names.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { legalDocuments } from "../../src/content/legal.ts";
import { OWNER_KINDS, type OwnerKind } from "../../src/server/builder/block.ts";
import { REGISTRY } from "../../src/server/builder/registry.ts";
import {
  allowedOn,
  anchorProblem,
  changeIssues,
  CONTRACTS,
  HERO_VARIANT_OF,
  layoutIssues,
  layoutWarnings,
  libraryFor,
  lockReason,
  mayChangeStructure,
  mayEditContent,
  mayInitialize,
  NO_STRUCTURE_PERMISSION,
  ownerKindOf,
  requiredBlocks,
  type LayoutSection,
} from "../../src/server/builder/structure.ts";
import { permissionsOf } from "../../src/server/policy/registry.ts";

const all = { desktop: true, tablet: true, mobile: true };

/** The contract's initial layout as sections (ids s0, s1, …). */
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

const messages = (issues: { message: string }[]) => issues.map((i) => i.message).join(" | ");
const byKey = (sections: LayoutSection[], key: string) => sections.find((s) => s.blockType === key)!;
const move = <T,>(list: T[], from: number, to: number) => {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

const OWNER = permissionsOf(["owner"]);
const ADMIN = permissionsOf(["admin"]);
const EDITOR = permissionsOf(["editor"]);
const REVIEWER = permissionsOf(["reviewer"]);

describe("contracts", () => {
  test("every owner kind has a contract whose initial layout is valid", () => {
    for (const kind of OWNER_KINDS) {
      const contract = CONTRACTS[kind];
      assert.equal(contract.kind, kind);
      assert.deepEqual(layoutIssues(kind, initial(kind)), [], kind);
      assert.equal(contract.initial[0].blockType, contract.h1, `${kind}: the h1 block starts the layout`);
      for (const key of requiredBlocks(kind)) assert.ok(contract.initial.some((s) => s.blockType === key), `${kind} starts with ${key}`);
    }
  });

  test("the legal pages' structure is today's: their sections and anchors, in order", () => {
    for (const key of ["privacy", "terms"] as const) {
      const sections = CONTRACTS[`legal:${key}`].initial.filter((s) => s.blockType === "legal.section").map((s) => s.anchor);
      assert.deepEqual(sections, legalDocuments[key].sections.map((s) => s.id));
    }
  });

  test("owner kinds of page records and services", () => {
    assert.equal(ownerKindOf({ pageType: "home", systemKey: "home" }), "home");
    assert.equal(ownerKindOf({ pageType: "system", systemKey: "contact" }), "system:contact");
    assert.equal(ownerKindOf({ pageType: "legal", systemKey: "terms" }), "legal:terms");
    assert.equal(ownerKindOf({ pageType: "template", systemKey: "project_detail" }), "template:project_detail");
    assert.equal(ownerKindOf({ pageType: "generic", systemKey: null }), "generic");
    assert.equal(ownerKindOf({ service: true }), "service");
    assert.equal(ownerKindOf({ pageType: "system", systemKey: "admin" }), null);
  });

  test("what each owner may hold: its own bespoke blocks and its additions, nothing else", () => {
    assert.ok(allowedOn("home", REGISTRY.get("home.hero")!));
    assert.ok(!allowedOn("system:about", REGISTRY.get("home.hero")!));
    assert.ok(!allowedOn("home", REGISTRY.get("generic.quote_form")!), "the quote form is for generic pages only");
    assert.ok(allowedOn("generic", REGISTRY.get("generic.quote_form")!));
    assert.ok(!allowedOn("generic", REGISTRY.get("about.vision")!));
    assert.ok(!allowedOn("legal:privacy", REGISTRY.get("generic.heading")!));
    assert.ok(!allowedOn("generic", REGISTRY.get("generic.reusable")!), "the library entry is never stored");
    assert.ok(libraryFor("system:not_found").every((d) => d.key === "not_found.view"));
    assert.ok(libraryFor("service").some((d) => d.key === "generic.faq"));
  });
});

describe("layout check", () => {
  test("the homepage hero exists exactly once and stays first", () => {
    const home = initial("home");
    assert.match(messages(layoutIssues("home", move(home, 0, 2))), /Homepage hero must remain first/);
    assert.match(messages(layoutIssues("home", home.slice(1))), /needs its main heading/);
    assert.match(messages(layoutIssues("home", [...home, { ...home[0], id: "dup" }])), /at most once|exactly one main heading/);
  });

  test("exactly one h1 source on every routable page", () => {
    const page = initial("generic");
    assert.deepEqual(layoutIssues("generic", page), []);
    assert.match(messages(layoutIssues("generic", [...page, { ...page[0], id: "h2" }])), /exactly one main heading/);
    assert.match(messages(layoutIssues("generic", [generic("x")])), /needs its main heading/);
  });

  test("the 404 view exists exactly once", () => {
    assert.deepEqual(layoutIssues("system:not_found", initial("system:not_found")), []);
    assert.match(messages(layoutIssues("system:not_found", [])), /main heading/);
    const twice = [...initial("system:not_found"), { ...initial("system:not_found")[0], id: "again" }];
    assert.match(messages(layoutIssues("system:not_found", twice)), /exactly one main heading|at most once/);
  });

  test("required parts must be present and shown on every device", () => {
    const contact = initial("system:contact");
    assert.match(messages(layoutIssues("system:contact", contact.filter((s) => s.blockType !== "contact.quote"))), /“Request a quote” is a required part/);
    const hidden = contact.map((s) => (s.blockType === "contact.location" ? { ...s, devices: { ...all, mobile: false } } : s));
    assert.match(messages(layoutIssues("system:contact", hidden)), /required part of this page; it can't be hidden/);
    assert.match(messages(layoutIssues("system:contact", hidden)), /#location” is required by this page/);
  });

  test("protected anchors cannot silently disappear", () => {
    const projects = initial("system:projects");
    const gallery = byKey(projects, "projects.gallery");
    const issues = layoutIssues("system:projects", projects.map((s) => (s === gallery ? { ...s, visible: false } : s)));
    assert.match(messages(issues), /#gallery” is required by this page/);
  });

  test("a required section's in-page link keeps its target shown (the homepage hero's second action)", () => {
    const home = initial("home").map((s) => (s.blockType === "home.machinery" ? { ...s, visible: false } : s));
    assert.match(messages(layoutIssues("home", home)), /links to this section \(#machinery\)/);
  });

  test("optional parts' in-page links only warn", () => {
    const about = initial("system:about").map((s) => (s.blockType === "about.metal" ? { ...s, visible: false } : s));
    assert.deepEqual(layoutIssues("system:about", about), []);
    assert.match(messages(layoutWarnings("system:about", about)), /links to #metal/);
  });

  test("owner types and maximum instances are enforced", () => {
    const about = initial("system:about");
    assert.match(messages(layoutIssues("system:about", [...about.slice(0, -1), { ...generic("x", "home.hero"), locked: true }, about.at(-1)!])), /can't be part of the About/);
    const many = [...initial("generic"), ...Array.from({ length: 5 }, (_, i) => generic(`m${i}`, "generic.map"))];
    assert.match(messages(layoutIssues("generic", many)), /at most 2 times/);
    const tooMany = [...initial("generic"), ...Array.from({ length: 60 }, (_, i) => generic(`d${i}`, "generic.divider"))];
    assert.match(messages(layoutIssues("generic", tooMany)), /at most 60 sections/);
  });

  test("an inner page's opening keeps its own composition", () => {
    const clients = initial("system:clients");
    assert.match(messages(layoutIssues("system:clients", clients.map((s) => (s.blockType === "page.hero" ? { ...s, variant: "about" } : s)))), /own approved composition/);
  });

  test("the closing call to action stays at the end", () => {
    const services = initial("system:services");
    assert.match(messages(layoutIssues("system:services", [...services, generic("g")])), /stays at the end of the page/);
    assert.deepEqual(layoutIssues("system:services", [...services.slice(0, -1), generic("g"), services.at(-1)!]), []);
  });

  test("a section's structure lock always matches its block type", () => {
    const about = initial("system:about").map((s) => (s.blockType === "page.hero" ? { ...s, locked: false } : s));
    assert.match(messages(layoutIssues("system:about", about)), /structure lock doesn't match/);
  });

  test("the legal pages and the project template are exactly their initial layout", () => {
    const privacy = initial("legal:privacy");
    assert.match(messages(layoutIssues("legal:privacy", move(privacy, 3, 5))), /Legal-page structure is locked/);
    assert.match(messages(layoutIssues("legal:privacy", privacy.slice(0, -1))), /Legal-page structure is locked/);
    const renamed = privacy.map((s, i) => (i === 4 ? { ...s, anchor: "renamed" } : s));
    assert.match(messages(layoutIssues("legal:privacy", renamed)), /Legal-page structure is locked/);
    const template = initial("template:project_detail");
    assert.match(messages(layoutIssues("template:project_detail", template.slice(0, -1))), /template's structure is fixed/);
  });
});

describe("anchors (§48)", () => {
  test("format: lowercase ASCII words joined by single hyphens, starting with a letter", () => {
    for (const ok of ["faq", "our-team", "phase-2"]) assert.equal(anchorProblem(ok), null, ok);
    for (const bad of ["FAQ", "1st", "a--b", "-a", "a-", "a b", "حول", "a_b", "x".repeat(65), "faq-title"]) assert.notEqual(anchorProblem(bad), null, bad);
  });

  test("unique on the page, including the ids the components render and the shell's", () => {
    const page = [...initial("generic"), generic("a", "generic.heading", "faq"), generic("b", "generic.rich_text", "faq")];
    assert.match(messages(layoutIssues("generic", page)), /“faq” is already used/);
    for (const taken of ["main", "top", "page-title", "page", "page-cta"]) {
      assert.match(messages(layoutIssues("generic", [...initial("generic"), generic("a", "generic.heading", taken)])), /already used/, taken);
    }
    const home = initial("home");
    assert.match(messages(layoutIssues("home", [...home, generic("g", "generic.heading", "machinery")])), /“machinery” is already used/);
    assert.deepEqual(layoutIssues("home", [...home, generic("g", "generic.heading", "gallery")]), [], "an anchor of another page's block is free here");
  });

  test("a record's slug rendered as an id on the page is taken (machines, projects, documents)", () => {
    const capabilities = initial("system:capabilities");
    const page = [...capabilities.slice(0, -1), generic("g", "generic.heading", "fiber-laser-6kw"), capabilities.at(-1)!];
    assert.match(messages(layoutIssues("system:capabilities", page, { recordSlugs: { machine: ["fiber-laser-6kw"] } })), /already used/);
    assert.deepEqual(layoutIssues("system:capabilities", page, { recordSlugs: { project: ["fiber-laser-6kw"] } }), []);
  });

  test("fixed anchors are set by their block; blocks without anchors take none", () => {
    const home = initial("home").map((s) => (s.blockType === "home.services" ? { ...s, anchor: "what-we-do" } : s));
    assert.match(messages(layoutIssues("home", home)), /set by its block/);
    const strip = initial("home").map((s) => (s.blockType === "home.capability_strip" ? { ...s, anchor: "strip" } : s));
    assert.match(messages(layoutIssues("home", strip)), /takes no anchor/);
  });
});

describe("change check", () => {
  const home = initial("home");
  const structure = { structure: true };
  const content = { structure: false };

  test("texts and settings are not structure: an unchanged layout passes without the structure permission", () => {
    assert.deepEqual(changeIssues("home", home, home.map((s) => ({ ...s })), content), []);
  });

  test("without the structure permission every structural change is refused, with the reason", () => {
    const cases: LayoutSection[][] = [
      move(home, 3, 4),
      home.map((s) => (s.blockType === "home.projects" ? { ...s, visible: false } : s)),
      [...home, generic("new")],
      home.filter((s) => s.blockType !== "home.projects"),
    ];
    for (const after of cases) assert.match(messages(changeIssues("home", home, after, content)), new RegExp(NO_STRUCTURE_PERMISSION.slice(0, 40)));
  });

  test("structure holders may move, hide and add where the registry marks it safe", () => {
    assert.deepEqual(changeIssues("home", home, move(home, 3, 6), structure), []);
    assert.deepEqual(changeIssues("home", home, home.map((s) => (s.blockType === "home.projects" ? { ...s, devices: { ...all, mobile: false } } : s)), structure), []);
    assert.deepEqual(changeIssues("home", home, [...home, generic("new")], structure), []);
  });

  test("bespoke parts are hidden, never removed; required and locked ones never move, hide or go", () => {
    assert.match(messages(changeIssues("home", home, home.filter((s) => s.blockType !== "home.projects"), structure)), /can't be removed; hide it instead/);
    assert.match(messages(changeIssues("home", home, home.filter((s) => s.blockType !== "home.hero"), structure)), /required main heading/);
    assert.match(messages(changeIssues("home", home, move(home, 0, 3), structure)), /Homepage hero must remain first/);
    const service = initial("service");
    assert.match(messages(changeIssues("service", service, move(service, 3, 1), structure)), /required part of this page/);
    assert.match(messages(changeIssues("service", service, service.map((s) => (s.blockType === "service.process" ? { ...s, visible: false } : s)), structure)), /required part/);
  });

  test("a generic block may be moved between locked parts, and removed", () => {
    const service = initial("service");
    const withFaq = [...service.slice(0, 2), generic("faq", "generic.faq"), ...service.slice(2)];
    assert.deepEqual(changeIssues("service", service, withFaq, structure), []);
    assert.deepEqual(changeIssues("service", withFaq, move(withFaq, 2, 5), structure), []);
    assert.deepEqual(changeIssues("service", withFaq, service, structure), []);
  });

  test("only generic blocks are duplicated", () => {
    const page = [...initial("generic"), generic("a", "generic.faq")];
    assert.deepEqual(changeIssues("generic", page, [...page, generic("b", "generic.faq")], { structure: true, duplicates: new Map([["b", "a"]]) }), []);
    const about = initial("system:about");
    const copy = { ...byKey(about, "about.vision"), id: "copy" };
    const issues = changeIssues("system:about", about, [...about.slice(0, -1), copy, about.at(-1)!], { structure: true, duplicates: new Map([["copy", byKey(about, "about.vision").id]]) });
    assert.match(messages(issues), /can't be duplicated/);
  });

  test("nobody changes a section's block type or its lock", () => {
    const changed = home.map((s) => (s.blockType === "home.projects" ? { ...s, blockType: "home.industries" } : s));
    assert.match(messages(changeIssues("home", home, changed, structure)), /block type can't change/);
    const unlocked = home.map((s) => (s.blockType === "home.hero" ? { ...s, locked: false } : s));
    assert.match(messages(changeIssues("home", home, unlocked, structure)), /structure lock can't change/);
  });

  test("anchors: editable ones by structure holders, fixed ones never", () => {
    const page = [...initial("generic"), generic("a", "generic.heading", "faq")];
    assert.deepEqual(changeIssues("generic", page, page.map((s) => (s.id === "a" ? { ...s, anchor: "questions" } : s)), structure), []);
    assert.match(messages(changeIssues("generic", page, page.map((s) => (s.id === "a" ? { ...s, anchor: "questions" } : s)), content)), /structure/);
    assert.match(messages(changeIssues("home", home, home.map((s) => (s.blockType === "home.services" ? { ...s, anchor: "x" } : s)), structure)), /anchor is set by its block/);
  });

  test("legal pages: nobody changes the structure in A5, whatever their permissions", () => {
    const privacy = initial("legal:privacy");
    for (const after of [move(privacy, 3, 4), privacy.slice(0, -1), privacy.map((s, i) => (i === 5 ? { ...s, anchor: "x" } : s)), privacy.map((s, i) => (i === 5 ? { ...s, visible: false } : s))]) {
      assert.match(messages(changeIssues("legal:privacy", privacy, after, structure)), /Legal-page structure is locked/);
    }
    assert.deepEqual(changeIssues("legal:privacy", privacy, privacy, content), []);
  });

  test("a section appearing twice in a layout is refused", () => {
    assert.match(messages(changeIssues("home", home, [...home, home[3]], structure)), /appears twice/);
  });

  test("lock reasons are words, never a bare refusal (§27)", () => {
    const hero = byKey(home, "home.hero");
    assert.equal(lockReason("home", REGISTRY.get("home.hero"), hero, "move"), "Homepage hero must remain first.");
    assert.equal(lockReason("system:about", REGISTRY.get("page.hero"), initial("system:about")[0], "hide"), "This block provides the page's required main heading.");
    assert.equal(lockReason("legal:terms", REGISTRY.get("legal.section"), initial("legal:terms")[3], "move"), "Legal-page structure is locked.");
    assert.equal(lockReason("system:contact", REGISTRY.get("contact.quote"), byKey(initial("system:contact"), "contact.quote"), "hide"), "This anchor is required by this page.");
    assert.equal(lockReason("system:clients", REGISTRY.get("clients.wall"), byKey(initial("system:clients"), "clients.wall"), "remove"), "This section is a required part of this page.");
    assert.match(lockReason("system:about", REGISTRY.get("page.closing_cta"), byKey(initial("system:about"), "page.closing_cta"), "move") ?? "", /stays at the end/);
    assert.equal(lockReason("home", REGISTRY.get("home.projects"), byKey(home, "home.projects"), "move"), null);
  });
});

describe("permissions (from the registry's matrix, never role names)", () => {
  test("Reviewers see and preview only", () => {
    for (const kind of OWNER_KINDS) {
      assert.equal(mayEditContent(REVIEWER, kind), false, kind);
      assert.equal(mayChangeStructure(REVIEWER, kind), false, kind);
      assert.equal(mayInitialize(REVIEWER, kind), false, kind);
    }
  });

  test("Editors: generic pages' structure; content of the site's pages and services; not legal; not the site's structure", () => {
    assert.equal(mayChangeStructure(EDITOR, "generic"), true);
    assert.equal(mayChangeStructure(EDITOR, "home"), false);
    assert.equal(mayChangeStructure(EDITOR, "system:about"), false);
    assert.equal(mayChangeStructure(EDITOR, "service"), false);
    assert.equal(mayEditContent(EDITOR, "home"), true);
    assert.equal(mayEditContent(EDITOR, "service"), true);
    assert.equal(mayEditContent(EDITOR, "legal:privacy"), false);
  });

  test("Admins and the Owner: the site's structure where it may change; legal content but never legal structure", () => {
    for (const perms of [ADMIN, OWNER]) {
      for (const kind of ["home", "system:about", "system:contact", "service", "template:service_detail_default", "generic"] as OwnerKind[]) {
        assert.equal(mayChangeStructure(perms, kind), true, kind);
      }
      for (const kind of ["legal:privacy", "legal:terms", "system:not_found", "template:project_detail"] as OwnerKind[]) {
        assert.equal(mayChangeStructure(perms, kind), false, kind);
        assert.equal(mayInitialize(perms, kind), true, kind);
      }
      assert.equal(mayEditContent(perms, "legal:terms"), true);
    }
  });
});
