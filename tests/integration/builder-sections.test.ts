/**
 * Page builder (A5) — layouts on a real MariaDB (A5 brief §70): setting up a layout, generic page sections in English and
 * Arabic, the owner's lock_version as the layout's version (one increment per save; the exact stale message; concurrent
 * saves), reorder, visibility per device, locked and required sections, duplicates with new item ids, removal, anchors,
 * media references (never private; not newly trashed), entity selections, repeater parity, invalid block types and
 * schema versions, oversized data, the site's own pages and services (structure for Owner and Admin, content for
 * Editors), Reviewers, the legal pages' locked structure and the audit trail. Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { initializeLayout, LAYOUT_STALE } from "../../src/server/builder/sections.ts";
import { loadBuilder } from "../../src/server/builder/editor.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { ulid } from "../../src/server/security/ids.ts";
import { auditOf, expectOk, query, seedMedia, team, type Team } from "./cms-helpers.ts";
import { changeOf, dataFor, entryOf, expectDenied, expectInvalid, genericPage, layoutOf, save, service, systemPage, versionOf } from "./builder-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";
import type { OwnerRef } from "../../src/server/builder/store.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("builder_sections");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const all = { desktop: true, tablet: true, mobile: true };
const heading = (ref: string, en: string, ar?: string, anchor: string | null = null) => ({
  ref,
  blockType: "generic.heading",
  visible: true,
  devices: all,
  anchor,
  data: dataFor("generic.heading", { texts: { en: { title: en }, ...(ar ? { ar: { title: ar } } : {}) } }),
});

async function initialized(owner: OwnerRef, actor = t.owner) {
  expectOk(await initializeLayout(changeOf(env, actor), owner, await versionOf(env, owner)));
  return layoutOf(env, owner);
}

describe("a generic page's layout", () => {
  let page: OwnerRef;

  test("starts empty; Initialize (pages.edit) creates its one main heading, locked, and moves the version once", async () => {
    page = await genericPage(env, t.editor);
    assert.deepEqual(await layoutOf(env, page), []);
    const before = await versionOf(env, page);
    const sections = await initialized(page, t.editor);
    assert.deepEqual(
      sections.map((s) => [s.blockType, s.position, s.locked, s.anchor]),
      [["generic.hero", 1, true, null]],
    );
    assert.equal(await versionOf(env, page), before + 1);
    const [event] = await auditOf(env, "page", page.id);
    assert.equal(event.action, "layout.initialize");
    const again = await initializeLayout(changeOf(env, t.editor), page, await versionOf(env, page));
    expectInvalid(again, /already set up/);
  });

  test("an Editor adds sections with English and Arabic texts; each language gets its own row and state", async () => {
    const [hero] = await layoutOf(env, page);
    const result = expectOk(await save(env, t.editor, page, [entryOf(hero), heading("new:1", "Test heading", "عنوان تجريبي", "faq"), { ...heading("new:2", "Second test heading"), anchor: null }]));
    const sections = await layoutOf(env, page);
    assert.equal(sections.length, 3);
    assert.equal(result.ids["new:1"], sections[1].id);
    assert.deepEqual(
      sections.map((s) => [s.blockType, s.position, s.anchor, s.locked]),
      [
        ["generic.hero", 1, null, true],
        ["generic.heading", 2, "faq", false],
        ["generic.heading", 3, null, false],
      ],
    );
    assert.deepEqual(Object.keys(sections[1].translations).sort(), ["ar", "en"]);
    assert.equal((sections[1].translations.ar!.content as { title: string }).title, "عنوان تجريبي");
    assert.equal(sections[1].translations.en!.status, "draft");
    assert.deepEqual(Object.keys(sections[2].translations), ["en"]);
    const events = await auditOf(env, "page_section", sections[1].id);
    assert.equal(events[0].action, "section.create");
    assert.equal(events[0].actorUserId, t.editor.user.id);
    assert.ok(!JSON.stringify(events[0]).includes("عنوان"), "the audit never holds texts");
  });

  test("the layout's version is the page's lock_version: +1 per save, none for a save that changes nothing", async () => {
    const v = await versionOf(env, page);
    const sections = await layoutOf(env, page);
    const unchanged = expectOk(await save(env, t.editor, page, sections.map(entryOf)));
    assert.equal(unchanged.lockVersion, v);
    assert.equal(await versionOf(env, page), v);
    expectOk(await save(env, t.editor, page, [entryOf(sections[0]), entryOf(sections[2]), entryOf(sections[1])]));
    assert.equal(await versionOf(env, page), v + 1);
  });

  test("a stale editor is refused with the exact message; nothing changes", async () => {
    const v = await versionOf(env, page);
    const sections = await layoutOf(env, page);
    const result = await save(env, t.editor, page, [entryOf(sections[0])], v - 1);
    assert.equal(result.kind, "stale");
    assert.equal(LAYOUT_STALE, "This page layout changed after you opened it. Reload and review the latest version before saving.");
    assert.equal((await layoutOf(env, page)).length, sections.length);
    const [event] = await auditOf(env, "page", page.id);
    assert.equal(event.outcome, "failed");
  });

  test("two editors saving the same version: exactly one wins, the other is stale (no silent overwrite)", async () => {
    const v = await versionOf(env, page);
    const sections = await layoutOf(env, page);
    const a = save(env, t.editor, page, [entryOf(sections[0]), entryOf(sections[2]), entryOf(sections[1])], v);
    const b = save(env, t.owner, page, [entryOf(sections[0]), entryOf(sections[1]), { ...entryOf(sections[2]), visible: false }], v);
    const results = await Promise.all([a, b]);
    assert.deepEqual(results.map((r) => r.kind).sort(), ["ok", "stale"]);
    assert.equal(await versionOf(env, page), v + 1);
    const positions = (await layoutOf(env, page)).map((s) => s.position);
    assert.deepEqual(positions, [1, 2, 3], "positions stay unique and dense");
  });

  test("visibility and devices are saved; at least one device stays on", async () => {
    const sections = await layoutOf(env, page);
    expectOk(await save(env, t.editor, page, [entryOf(sections[0]), { ...entryOf(sections[1]), visible: false }, { ...entryOf(sections[2]), visible: true, devices: { desktop: true, tablet: false, mobile: false } }]));
    const after = await layoutOf(env, page);
    assert.equal(after[1].visible, false);
    assert.deepEqual(after[2].devices, { desktop: true, tablet: false, mobile: false });
    const none = await save(env, t.editor, page, [entryOf(after[0]), entryOf(after[1]), { ...entryOf(after[2]), devices: { desktop: false, tablet: false, mobile: false } }]);
    expectInvalid(none, /couldn't be read/);
    const events = await auditOf(env, "page_section", after[2].id);
    assert.ok(events.some((e) => e.action === "section.visibility"));
  });

  test("the main heading is locked: never removed, moved or hidden — by anyone", async () => {
    const sections = await layoutOf(env, page);
    expectInvalid(await save(env, t.owner, page, sections.slice(1).map(entryOf)), /required main heading/);
    expectInvalid(await save(env, t.owner, page, [entryOf(sections[1]), entryOf(sections[0]), entryOf(sections[2])]), /main heading must remain first|required main heading/);
    expectInvalid(await save(env, t.owner, page, [{ ...entryOf(sections[0]), visible: false }, entryOf(sections[1]), entryOf(sections[2])]), /required main heading/);
    const second = { ref: "new:1", blockType: "generic.hero", visible: true, devices: all, anchor: null };
    expectInvalid(await save(env, t.owner, page, [...sections.map(entryOf), second]), /at most once|exactly one main heading/);
  });

  test("a duplicate gets a new id and new repeated-item ids; its texts follow them", async () => {
    const sections = await layoutOf(env, page);
    const faq = dataFor("generic.faq", {
      settings: { questions: [{ id: "q1" }, { id: "q2" }] },
      texts: { en: { questions: { q1: { question: "Test Q1", answer: { type: "doc", content: [] } }, q2: { question: "Test Q2", answer: { type: "doc", content: [] } } } } },
    });
    const added = expectOk(await save(env, t.editor, page, [...sections.map(entryOf), { ref: "new:1", blockType: "generic.faq", visible: true, devices: all, anchor: null, data: faq }]));
    const originalId = added.ids["new:1"];
    const withFaq = await layoutOf(env, page);
    const dup = expectOk(await save(env, t.editor, page, [...withFaq.map(entryOf), { ref: "new:2", duplicateOf: originalId, visible: true, devices: all, anchor: null }]));
    const copyId = dup.ids["new:2"];
    assert.notEqual(copyId, originalId);
    const after = await layoutOf(env, page);
    const copy = after.find((s) => s.id === copyId)!;
    const ids = (copy.settings as { questions: { id: string }[] }).questions.map((q) => q.id);
    assert.equal(ids.length, 2);
    assert.ok(ids.every((id) => id !== "q1" && id !== "q2"));
    assert.deepEqual(Object.keys((copy.translations.en!.content as { questions: Record<string, unknown> }).questions).sort(), [...ids].sort());
    assert.equal((await auditOf(env, "page_section", copyId))[0].action, "section.duplicate");
  });

  test("an unlocked section is removed; the remaining positions close up", async () => {
    const sections = await layoutOf(env, page);
    const gone = sections[sections.length - 1];
    expectOk(await save(env, t.editor, page, sections.slice(0, -1).map(entryOf)));
    const after = await layoutOf(env, page);
    assert.equal(after.length, sections.length - 1);
    assert.deepEqual(
      after.map((s) => s.position),
      after.map((_, i) => i + 1),
    );
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM page_section_translations WHERE section_id = ?", [gone.id]))[0].n, 0);
    assert.equal((await auditOf(env, "page_section", gone.id))[0].action, "section.remove");
  });

  test("anchors: valid, unique on the page, never the ids the shell renders; swapping two anchors works", async () => {
    const sections = await layoutOf(env, page);
    const [hero, a, b] = sections;
    expectInvalid(await save(env, t.editor, page, [entryOf(hero), { ...entryOf(a), anchor: "same" }, { ...entryOf(b), anchor: "same" }]), /already used/);
    expectInvalid(await save(env, t.editor, page, [entryOf(hero), { ...entryOf(a), anchor: "main" }, entryOf(b)]), /already used/);
    expectInvalid(await save(env, t.editor, page, [entryOf(hero), { ...entryOf(a), anchor: "Bad Anchor" }, entryOf(b)]), /lowercase letters/);
    expectInvalid(await save(env, t.editor, page, [{ ...entryOf(hero), anchor: "top-of-page" }, entryOf(a), entryOf(b)]), /takes no anchor|structure|anchor/);
    expectOk(await save(env, t.editor, page, [entryOf(hero), { ...entryOf(a), anchor: "first" }, { ...entryOf(b), anchor: "second" }]));
    const now = await layoutOf(env, page);
    expectOk(await save(env, t.editor, page, [entryOf(now[0]), { ...entryOf(now[1]), anchor: "second" }, { ...entryOf(now[2]), anchor: "first" }]));
    assert.deepEqual(
      (await layoutOf(env, page)).map((s) => s.anchor),
      [null, "second", "first"],
    );
  });

  test("texts: plain text only, strict keys, EN/AR repeater parity by id", async () => {
    const sections = await layoutOf(env, page);
    const html = heading("new:1", "<script>alert(1)</script>");
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), html]), /markup|angle|plain|not allowed|HTML|text/i);
    const extra = { ...heading("new:1", "Test"), data: { ...heading("new:1", "Test").data, settings: { ...heading("new:1", "Test").data.settings, style: "color:red" } } };
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), extra]), /Unrecognized key|settings/);
    const stats = dataFor("generic.statistics", { settings: { figures: [{ id: "f1", value: "12", sourceBasis: "unstated" }] }, texts: { en: { figures: { f1: { label: "Test", unit: "" } } }, ar: { figures: {} } } });
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), { ref: "new:1", blockType: "generic.statistics", visible: true, devices: all, anchor: null, data: stats }]), /don't match/);
  });

  test("unknown or library-only block types can't be saved", async () => {
    const sections = await layoutOf(env, page);
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), { ref: "new:1", blockType: "generic.script", visible: true, devices: all, anchor: null }]), /Unknown block type/);
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), { ref: "new:1", blockType: "generic.reusable", visible: true, devices: all, anchor: null }]), /Unknown block type/);
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), { ref: "new:1", blockType: "home.hero", visible: true, devices: all, anchor: null }]), /can't be added|can't be part/);
  });

  test("oversized data is refused (a section stays far below the Server Action body limit)", async () => {
    const sections = await layoutOf(env, page);
    const questions = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}` }));
    const long = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A".repeat(2900) }] }] };
    const texts = Object.fromEntries(questions.map((q) => [q.id, { question: "Q".repeat(200), answer: long }]));
    const faq = dataFor("generic.faq", { settings: { questions }, texts: { en: { questions: texts }, ar: { questions: texts } } });
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), { ref: "new:1", blockType: "generic.faq", visible: true, devices: all, anchor: null, data: faq }]), /holds too much/);
  });

  test("a section of another page is never touched (it is “no longer on this page”)", async () => {
    const other = await genericPage(env, t.editor);
    const [otherHero] = await initialized(other, t.editor);
    const sections = await layoutOf(env, page);
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), entryOf(otherHero)]), /no longer on this page/);
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), { ref: "new:1", duplicateOf: otherHero.id, visible: true, devices: all, anchor: null }]), /no longer on this page/);
    assert.equal((await layoutOf(env, other)).length, 1);
  });

  test("a section stored with a newer schema version (v99) is shown read-only and can't be edited", async () => {
    const sections = await layoutOf(env, page);
    await query(env, "UPDATE page_sections SET schema_version = 99 WHERE id = ?", [sections[1].id]);
    const model = await loadBuilder(db(), t.editor.permissions, page);
    const section = model!.sections.find((s) => s.id === sections[1].id)!;
    assert.equal(section.state, "future_version");
    assert.equal(section.data, null);
    assert.equal(section.ops.edit.allowed, false);
    const edit = { ...entryOf(sections[1]), data: dataFor("generic.heading", { texts: { en: { title: "Overwrite" } } }) };
    expectInvalid(await save(env, t.editor, page, [entryOf(sections[0]), edit, ...sections.slice(2).map(entryOf)]), /newer block version/);
    // Moving it (no data) is still possible.
    await query(env, "UPDATE page_sections SET schema_version = 1 WHERE id = ?", [sections[1].id]);
  });

  test("a section with an unknown block type in the database is tolerated, never crashes the editor", async () => {
    const sections = await layoutOf(env, page);
    const id = ulid();
    await query(env, "INSERT INTO page_sections (id, page_id, block_type, schema_version, position, settings) VALUES (?, ?, 'generic.retired', 1, ?, '{}')", [id, page.id, sections.length + 1]);
    const model = await loadBuilder(db(), t.editor.permissions, page);
    const unknown = model!.sections.find((s) => s.id === id)!;
    assert.equal(unknown.state, "unknown_type");
    assert.match(unknown.problem ?? "", /not known/);
    assert.ok(model!.warnings.some((w) => w.sectionId === id));
    // It can be removed by a structure holder.
    expectOk(await save(env, t.editor, page, sections.map(entryOf)));
  });
});

describe("media and records a section names", () => {
  let page: OwnerRef;
  before(async () => {
    page = await genericPage(env, t.editor, "Test Media Page");
    await initialized(page, t.editor);
  });

  const imageEntry = (ref: string, media: string | null) => ({
    ref,
    blockType: "generic.image",
    visible: true,
    devices: all,
    anchor: null,
    data: dataFor("generic.image", { settings: { media }, texts: { en: { alt: "Test photo" } } }),
  });

  test("a private item is refused exactly like an unknown one; a pending or restricted public item may be chosen", async () => {
    const sections = await layoutOf(env, page);
    const priv = await seedMedia(env, { visibility: "private", kind: "document" });
    const privImage = await seedMedia(env, { visibility: "private" });
    const unknown = ulid();
    const r1 = await save(env, t.editor, page, [...sections.map(entryOf), imageEntry("new:1", privImage)]);
    const r2 = await save(env, t.editor, page, [...sections.map(entryOf), imageEntry("new:1", unknown)]);
    expectInvalid(r1, /can't be used here/);
    expectInvalid(r2, /can't be used here/);
    assert.equal(JSON.stringify(r1), JSON.stringify(r2).replace(unknown, privImage), "the two refusals read the same");
    void priv;
    const pending = await seedMedia(env, { status: "pending_review" });
    expectOk(await save(env, t.editor, page, [...sections.map(entryOf), imageEntry("new:1", pending)]));
    const model = await loadBuilder(db(), t.editor.permissions, page);
    const image = model!.sections.find((s) => s.blockType === "generic.image")!;
    assert.ok(image.warnings.some((w) => /Pending review/.test(w)));
  });

  test("a trashed, archived or unready item is not newly chosen; one already in place may stay", async () => {
    const sections = await layoutOf(env, page);
    const image = sections.find((s) => s.blockType === "generic.image")!;
    const kept = (image.settings as { media: string }).media;
    for (const options of [{ trashed: true }, { status: "archived" as const }, { ready: false }]) {
      const media = await seedMedia(env, options);
      expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), imageEntry("new:1", media)]), /Trash|archived|no ready file/);
    }
    await query(env, "UPDATE media_assets SET deleted_at = ? WHERE id = ?", [new Date(), kept]);
    const edit = { ...entryOf(image), data: dataFor("generic.image", { settings: { media: kept, aspect: "16x9" }, texts: { en: { alt: "Test photo" } } }) };
    expectOk(await save(env, t.editor, page, sections.map((s) => (s.id === image.id ? edit : entryOf(s)))));
  });

  test("a document field takes documents only; an image field images only", async () => {
    const sections = await layoutOf(env, page);
    const doc = await seedMedia(env, { kind: "document" });
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), imageEntry("new:1", doc)]), /Choose an image/);
  });

  test("selections: unknown ids are refused; an archived project is not newly chosen", async () => {
    const sections = await layoutOf(env, page);
    const grid = (ids: string[]) => ({
      ref: "new:1",
      blockType: "generic.projects_grid",
      visible: true,
      devices: all,
      anchor: null,
      data: dataFor("generic.projects_grid", { settings: { projects: { mode: "manual", ids } }, texts: { en: { title: "Test projects" } } }),
    });
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), grid([ulid()])]), /no longer exists/);
    const [project] = await query<{ id: string }>(env, "SELECT id FROM projects LIMIT 1");
    if (project) {
      await query(env, "UPDATE projects SET publication_status = 'archived', draft_status = 'none' WHERE id = ?", [project.id]);
      expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), grid([project.id])]), /archived/);
    }
  });

  test("links: a generic-page link must name a generic page; contact links only where allowed", async () => {
    const sections = await layoutOf(env, page);
    const home = await systemPage(env, t.owner, "about");
    const button = (target: unknown) => ({
      ref: "new:1",
      blockType: "generic.button_group",
      visible: true,
      devices: all,
      anchor: null,
      data: dataFor("generic.button_group", { settings: { buttons: [{ id: "b1", target, style: "primary" }] }, texts: { en: { buttons: { b1: { label: "Test" } } } } }),
    });
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), button({ type: "page", id: home.id })]), /generic page/);
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), button({ type: "external", url: "javascript:alert(1)" })]), /https|address/i);
    expectInvalid(await save(env, t.editor, page, [...sections.map(entryOf), button({ type: "email", address: "a@b.com" })]), /not allowed/);
    expectOk(await save(env, t.editor, page, [...sections.map(entryOf), button({ type: "system", key: "contact", anchor: "quote" })]));
  });
});

describe("the site's own pages and services", () => {
  test("the homepage: Initialize creates today's composition; Owner/Admin move and hide what the registry allows", async () => {
    const home = await systemPage(env, t.owner, "home");
    expectDenied(await initializeLayout(changeOf(env, t.editor), home, await versionOf(env, home)), /permission/);
    const sections = await initialized(home, t.admin);
    assert.deepEqual(
      sections.map((s) => s.blockType),
      ["home.hero", "home.capability_strip", "home.about", "home.services", "home.machinery", "home.projects", "home.industries", "home.clients", "home.compliance", "home.contact"],
    );
    assert.deepEqual(
      sections.map((s) => s.anchor),
      ["home", null, "about", "services", "machinery", "projects", "industries", "clients", null, "contact"],
    );
    // An Editor edits content but never the structure.
    const projects = sections.find((s) => s.blockType === "home.projects")!;
    const moved = [sections[0], sections[1], projects, ...sections.slice(2).filter((s) => s !== projects)];
    expectDenied(await save(env, t.editor, home, moved.map(entryOf)), /structure/);
    const edited = sections.map((s) =>
      s === projects ? { ...entryOf(s), data: dataFor("home.projects", { settings: { projects: { mode: "automatic", source: "featured", limit: 6 } }, texts: { en: { title: "Test selected work" } } }) } : entryOf(s),
    );
    expectOk(await save(env, t.editor, home, edited));
    // An Admin moves an optional part and hides another; the hero stays first, the machinery stays shown (the hero links to it).
    const now = await layoutOf(env, home);
    const p = now.find((s) => s.blockType === "home.projects")!;
    const order = [now[0], now[1], p, ...now.slice(2).filter((s) => s !== p)];
    expectOk(await save(env, t.admin, home, order.map((s) => (s.blockType === "home.industries" ? { ...entryOf(s), visible: false } : entryOf(s)))));
    const hidden = (await layoutOf(env, home)).map((s) => (s.blockType === "home.machinery" ? { ...entryOf(s), visible: false } : entryOf(s)));
    expectInvalid(await save(env, t.admin, home, hidden), /links to this section/);
    const removeOptional = (await layoutOf(env, home)).filter((s) => s.blockType !== "home.compliance");
    expectInvalid(await save(env, t.admin, home, removeOptional.map(entryOf)), /hide it instead/);
    const heroMoved = await layoutOf(env, home);
    expectInvalid(await save(env, t.owner, home, [heroMoved[1], heroMoved[0], ...heroMoved.slice(2)].map(entryOf)), /Homepage hero must remain first/);
  });

  test("Contact: the quote and location anchors are protected; generic additions are allowed, never the quote form block", async () => {
    const contact = await systemPage(env, t.owner, "contact");
    const sections = await initialized(contact, t.owner);
    assert.deepEqual(
      sections.map((s) => s.anchor),
      [null, "quote", "location"],
    );
    const hidden = sections.map((s) => (s.anchor === "quote" ? { ...entryOf(s), visible: false } : entryOf(s)));
    expectInvalid(await save(env, t.owner, contact, hidden), /anchor is required|required part/);
    const quoteForm = { ref: "new:1", blockType: "generic.quote_form", visible: true, devices: all, anchor: null };
    expectInvalid(await save(env, t.owner, contact, [...sections.map(entryOf), quoteForm]), /can't be added/);
    expectOk(await save(env, t.owner, contact, [...sections.map(entryOf), heading("new:1", "Test note heading", undefined, "note")]));
  });

  test("legal pages: content through legal.edit (Owner, Admin); the structure is locked for everyone", async () => {
    const privacy = await systemPage(env, t.owner, "privacy");
    const sections = await initialized(privacy, t.admin);
    assert.equal(sections[0].blockType, "page.hero");
    assert.equal(sections[1].blockType, "legal.contents");
    assert.equal(sections[2].anchor, "who-we-are");
    expectDenied(await save(env, t.editor, privacy, sections.map(entryOf)), /view this layout/);
    expectDenied(await save(env, t.owner, privacy, [sections[0], sections[1], sections[3], sections[2], ...sections.slice(4)].map(entryOf)), /Legal-page structure is locked/);
    expectDenied(await save(env, t.owner, privacy, sections.slice(0, -1).map(entryOf)), /Legal-page structure is locked/);
    const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test legal text." }] }] };
    const edit = sections.map((s, i) => (i === 2 ? { ...entryOf(s), data: dataFor("legal.section", { texts: { en: { title: "Test who we are", body } } }) } : entryOf(s)));
    expectOk(await save(env, t.admin, privacy, edit));
  });

  test("certificates page copy keeps the digit guard (no registration numbers)", async () => {
    const certificates = await systemPage(env, t.owner, "certificates");
    const sections = await initialized(certificates, t.owner);
    const redaction = sections.find((s) => s.blockType === "certificates.redaction")!;
    const bad = sections.map((s) => (s === redaction ? { ...entryOf(s), data: dataFor("certificates.redaction", { texts: { en: { title: "Registration 1010123456" } } }) } : entryOf(s)));
    expectInvalid(await save(env, t.owner, certificates, bad), /registration or certificate number/);
  });

  test("a service: Owner/Admin hold its structure, Editors its content; required parts stay", async () => {
    const svc = await service(env, t.editor);
    expectDenied(await initializeLayout(changeOf(env, t.editor), svc, await versionOf(env, svc)), /permission/);
    const sections = await initialized(svc, t.admin);
    assert.equal(sections.length, 11);
    assert.equal(sections[0].blockType, "service.hero");
    assert.equal(sections.at(-1)!.blockType, "service.cta");
    const process = sections.find((s) => s.blockType === "service.process")!;
    const withNote = sections.map((s) =>
      s === process ? { ...entryOf(s), data: dataFor("service.process", { settings: { layout: "timeline", rail: "none", steps: [{ id: "s1", icon: "doc" }] }, texts: { en: { note: "General workflow, not a certified procedure.", steps: { s1: { title: "Test step", body: "" } } } } }) } : entryOf(s),
    );
    expectOk(await save(env, t.editor, svc, withNote));
    const now = await layoutOf(env, svc);
    const why = now.find((s) => s.blockType === "service.why")!;
    expectDenied(await save(env, t.editor, svc, now.map((s) => (s === why ? { ...entryOf(s), visible: false } : entryOf(s)))), /structure/);
    expectOk(await save(env, t.admin, svc, now.map((s) => (s === why ? { ...entryOf(s), visible: false } : entryOf(s)))));
    const after = await layoutOf(env, svc);
    expectInvalid(await save(env, t.admin, svc, after.filter((s) => s.blockType !== "service.overview").map(entryOf)), /required part/);
    expectInvalid(await save(env, t.admin, svc, [...after.map(entryOf), heading("new:1", "Test after the call to action")]), /stays at the end/);
    expectOk(await save(env, t.admin, svc, [...after.slice(0, -1).map(entryOf), heading("new:1", "Test before the call to action"), entryOf(after.at(-1)!)]));
  });

  test("Reviewers view and preview only: no save, no set-up (refused and audited)", async () => {
    const page = await genericPage(env, t.editor);
    await initialized(page, t.editor);
    const sections = await layoutOf(env, page);
    expectDenied(await save(env, t.reviewer, page, sections.map(entryOf)), /view this layout/);
    const [event] = await auditOf(env, "page", page.id);
    assert.equal(event.outcome, "denied");
    assert.equal(event.actorUserId, t.reviewer.user.id);
    const model = await loadBuilder(db(), t.reviewer.permissions, page);
    assert.deepEqual(model!.can, { content: false, structure: false, initialize: false, reusableEdit: false });
    assert.ok(model!.sections.every((s) => !s.ops.edit.allowed && !s.ops.move.allowed));
  });

  test("an archived page's layout is read-only", async () => {
    const page = await genericPage(env, t.editor);
    await initialized(page, t.editor);
    await query(env, "UPDATE pages SET publication_status = 'archived', draft_status = 'none' WHERE id = ?", [page.id]);
    const sections = await layoutOf(env, page);
    assert.equal((await save(env, t.editor, page, sections.map(entryOf))).kind, "archived");
  });
});
