/**
 * Page builder (A5) — reusable sections on a real MariaDB (A5 brief §44–§47, §70): create, edit in English and Arabic
 * with their own lock_version, link into compatible pages (never where the owner's registry refuses the block), "used
 * by", an edit seen by every linked section, a linked section's own data ignored, duplicate-as-link, detach (a local
 * copy with new item ids and `detached_from_id`), archive refused while linked (and RESTRICT in the database), restore,
 * create-from-section as an explicit copy or link, permissions and the audit trail. Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loadBuilder } from "../../src/server/builder/editor.ts";
import { createReusable, reusableUseViews, setReusableArchived, updateReusable } from "../../src/server/builder/reusable.ts";
import { createReusableFromSection, detachSection, initializeLayout } from "../../src/server/builder/sections.ts";
import { readReusable, type OwnerRef } from "../../src/server/builder/store.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditOf, expectOk, query, team, type Team } from "./cms-helpers.ts";
import { changeOf, dataFor, entryOf, expectDenied, expectInvalid, genericPage, layoutOf, save, systemPage, versionOf } from "./builder-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("builder_reusable");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const all = { desktop: true, tablet: true, mobile: true };

async function page(actor = t.editor): Promise<OwnerRef> {
  const ref = await genericPage(env, actor, "Test Reusable Host");
  expectOk(await initializeLayout(changeOf(env, actor), ref, await versionOf(env, ref)));
  return ref;
}

const faqData = (question: string, complete = { en: false, ar: false }) =>
  dataFor("generic.faq", {
    settings: { questions: [{ id: "q1" }] },
    texts: {
      en: { title: "Test FAQ", questions: { q1: { question, answer: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test answer." }] }] } } } },
      ar: { title: "أسئلة تجريبية", questions: { q1: { question: "سؤال تجريبي", answer: { type: "doc", content: [] } } } },
    },
    complete,
  });

describe("reusable sections", () => {
  let reusable = "";
  let host: OwnerRef;

  test("an Editor creates one from a generic block; Reviewers can't; bespoke blocks can't be reusable", async () => {
    const created = expectOk(await createReusable(changeOf(env, t.editor), { name: "Test shared FAQ", blockType: "generic.faq" }));
    reusable = created.id;
    const stored = await readReusable(db(), reusable);
    assert.equal(stored?.blockType, "generic.faq");
    assert.equal(stored?.lockVersion, 0);
    assert.equal((await createReusable(changeOf(env, t.reviewer), { name: "Test nope", blockType: "generic.faq" })).kind, "denied");
    assert.equal((await createReusable(changeOf(env, t.editor), { name: "Test bespoke", blockType: "home.hero" })).kind, "invalid");
    assert.equal((await createReusable(changeOf(env, t.editor), { name: "", blockType: "generic.faq" })).kind, "invalid");
    assert.equal((await auditOf(env, "reusable_section", reusable))[0].action, "reusable_section.create");
  });

  test("its texts are edited in English and Arabic on its own version; a stale editor is refused", async () => {
    const saved = expectOk(await updateReusable(changeOf(env, t.editor), { id: reusable, expectedVersion: 0, name: "Test shared FAQ", data: faqData("Test question one?") }));
    assert.equal(saved.lockVersion, 1);
    const stored = await readReusable(db(), reusable);
    assert.deepEqual(Object.keys(stored!.translations).sort(), ["ar", "en"]);
    const stale = await updateReusable(changeOf(env, t.editor), { id: reusable, expectedVersion: 0, name: "Test shared FAQ", data: faqData("Overwrite?") });
    assert.equal(stale.kind, "stale");
  });

  test("it is linked into a generic page; the linked section's own settings and texts are ignored", async () => {
    host = await page();
    const sections = await layoutOf(env, host);
    const linked = expectOk(await save(env, t.editor, host, [...sections.map(entryOf), { ref: "new:1", reusableId: reusable, visible: true, devices: all, anchor: "faq" }]));
    const id = linked.ids["new:1"];
    const row = (await layoutOf(env, host)).find((s) => s.id === id)!;
    assert.equal(row.reusableId, reusable);
    assert.equal(row.blockType, "generic.faq");
    assert.deepEqual(row.settings, {});
    assert.deepEqual(row.translations, {});
    const withData = { ref: "new:1", reusableId: reusable, visible: true, devices: all, anchor: null, data: faqData("Injected?") };
    expectInvalid(await save(env, t.editor, host, [...(await layoutOf(env, host)).map(entryOf), withData]), /reusable section's own settings/);
    const edit = { ...entryOf(row), data: faqData("Local edit?") };
    expectInvalid(await save(env, t.editor, host, (await layoutOf(env, host)).map((s) => (s.id === id ? edit : entryOf(s)))), /shows a reusable section/);
    assert.equal((await auditOf(env, "page_section", id))[0].action, "section.link_reusable");
  });

  test("“used by” lists the pages linking it; an edit shows on every one of them", async () => {
    const second = await page();
    expectOk(await save(env, t.editor, second, [...(await layoutOf(env, second)).map(entryOf), { ref: "new:1", reusableId: reusable, visible: true, devices: all, anchor: null }]));
    const uses = await reusableUseViews(db(), reusable);
    assert.equal(uses.length, 2);
    assert.ok(uses.every((u) => u.builderHref.startsWith("/admin/pages/") && u.builderHref.endsWith("/builder")));
    const v = (await readReusable(db(), reusable))!.lockVersion;
    expectOk(await updateReusable(changeOf(env, t.editor), { id: reusable, expectedVersion: v, name: "Test shared FAQ", data: faqData("Updated question?") }));
    for (const owner of [host, second]) {
      const model = await loadBuilder(db(), t.editor.permissions, owner);
      const section = model!.sections.find((s) => s.reusable?.id === reusable)!;
      const questions = (section.linkedData!.content.en as { questions: Record<string, { question: string }> }).questions;
      assert.equal(Object.values(questions)[0].question, "Updated question?");
      assert.equal(section.data, null);
      assert.equal(section.ops.edit.allowed, false);
    }
  });

  test("a linked section duplicates as another link to the same reusable section", async () => {
    const sections = await layoutOf(env, host);
    const linked = sections.find((s) => s.reusableId === reusable)!;
    const dup = expectOk(await save(env, t.editor, host, [...sections.map(entryOf), { ref: "new:1", duplicateOf: linked.id, visible: true, devices: all, anchor: null }]));
    const copy = (await layoutOf(env, host)).find((s) => s.id === dup.ids["new:1"])!;
    assert.equal(copy.reusableId, reusable);
  });

  test("archiving is refused while it is linked; the database's RESTRICT backs it", async () => {
    const v = (await readReusable(db(), reusable))!.lockVersion;
    expectDenied((await setReusableArchived(changeOf(env, t.admin), { id: reusable, expectedVersion: v, archived: true })) as never, /still used by 3 sections/);
    await assert.rejects(query(env, "DELETE FROM reusable_sections WHERE id = ?", [reusable]), /foreign key/i);
    assert.equal((await setReusableArchived(changeOf(env, t.editor), { id: reusable, expectedVersion: v, archived: true })).kind, "denied", "Editors don't archive");
  });

  test("detach makes a local copy (new item ids, detached_from_id), and the section no longer follows the reusable one", async () => {
    const sections = await layoutOf(env, host);
    const linked = sections.find((s) => s.reusableId === reusable && s.anchor === "faq")!;
    expectDenied(await detachSection(changeOf(env, t.reviewer), { owner: host, expectedVersion: await versionOf(env, host), sectionId: linked.id }), /view this layout/);
    const stale = await detachSection(changeOf(env, t.editor), { owner: host, expectedVersion: (await versionOf(env, host)) - 1, sectionId: linked.id });
    assert.equal(stale.kind, "stale");
    expectOk(await detachSection(changeOf(env, t.editor), { owner: host, expectedVersion: await versionOf(env, host), sectionId: linked.id }));
    const copy = (await layoutOf(env, host)).find((s) => s.id === linked.id)!;
    assert.equal(copy.reusableId, null);
    assert.equal(copy.detachedFromId, reusable);
    const ids = (copy.settings as { questions: { id: string }[] }).questions.map((q) => q.id);
    assert.ok(ids.length === 1 && ids[0] !== "q1");
    assert.equal((copy.translations.en!.content as { questions: Record<string, { question: string }> }).questions[ids[0]].question, "Updated question?");
    // A later edit of the reusable section doesn't reach the detached copy.
    const v = (await readReusable(db(), reusable))!.lockVersion;
    expectOk(await updateReusable(changeOf(env, t.editor), { id: reusable, expectedVersion: v, name: "Test shared FAQ", data: faqData("After the detach?") }));
    const again = (await layoutOf(env, host)).find((s) => s.id === linked.id)!;
    assert.equal((again.translations.en!.content as { questions: Record<string, { question: string }> }).questions[ids[0]].question, "Updated question?");
    assert.equal((await auditOf(env, "page_section", linked.id))[0].action, "section.detach_reusable");
  });

  test("a section of another page can't be detached through this page", async () => {
    const other = await page();
    const sections = await layoutOf(env, other);
    expectOk(await save(env, t.editor, other, [...sections.map(entryOf), { ref: "new:1", reusableId: reusable, visible: true, devices: all, anchor: null }]));
    const foreign = (await layoutOf(env, other)).find((s) => s.reusableId === reusable)!;
    expectInvalid(await detachSection(changeOf(env, t.editor), { owner: host, expectedVersion: await versionOf(env, host), sectionId: foreign.id }), /no longer on this page/);
  });

  test("once nothing links it, it can be archived (then not linked again) and restored", async () => {
    for (const s of await query<{ id: string; page_id: string }>(env, "SELECT id, page_id FROM page_sections WHERE reusable_section_id = ?", [reusable])) {
      const owner: OwnerRef = { type: "page", id: s.page_id };
      expectOk(await save(env, t.editor, owner, (await layoutOf(env, owner)).filter((x) => x.id !== s.id).map(entryOf)));
    }
    const v = (await readReusable(db(), reusable))!.lockVersion;
    expectOk(await setReusableArchived(changeOf(env, t.admin), { id: reusable, expectedVersion: v, archived: true }));
    const sections = await layoutOf(env, host);
    expectInvalid(await save(env, t.editor, host, [...sections.map(entryOf), { ref: "new:1", reusableId: reusable, visible: true, devices: all, anchor: null }]), /archived/);
    assert.equal((await updateReusable(changeOf(env, t.editor), { id: reusable, expectedVersion: v + 1, name: "Test", data: faqData("x") })).kind, "archived");
    expectOk(await setReusableArchived(changeOf(env, t.admin), { id: reusable, expectedVersion: v + 1, archived: false }));
  });

  test("a reusable section is linked only where the owner's registry allows its block", async () => {
    const form = expectOk(await createReusable(changeOf(env, t.editor), { name: "Test shared form", blockType: "generic.heading" }));
    const contact = await systemPage(env, t.owner, "contact");
    expectOk(await initializeLayout(changeOf(env, t.owner), contact, await versionOf(env, contact)));
    const sections = await layoutOf(env, contact);
    expectOk(await save(env, t.owner, contact, [...sections.map(entryOf), { ref: "new:1", reusableId: form.id, visible: true, devices: all, anchor: null }]));
    // A map is a generic block, but not one the site's own pages may receive: it links on generic pages only.
    const map = expectOk(await createReusable(changeOf(env, t.editor), { name: "Test shared map", blockType: "generic.map" }));
    expectInvalid(await save(env, t.owner, contact, [...(await layoutOf(env, contact)).map(entryOf), { ref: "new:2", reusableId: map.id, visible: true, devices: all, anchor: null }]), /can't be added/);
    // The quote form is never kept as a reusable section.
    assert.equal((await createReusable(changeOf(env, t.editor), { name: "Test form", blockType: "generic.quote_form" })).kind, "invalid");
  });

  test("create from a section: an explicit copy (the section stays) or create-and-link (structure holders)", async () => {
    const owner = await page();
    const sections = await layoutOf(env, owner);
    const added = expectOk(await save(env, t.editor, owner, [...sections.map(entryOf), { ref: "new:1", blockType: "generic.faq", visible: true, devices: all, anchor: null, data: faqData("Local question?") }]));
    const sectionId = added.ids["new:1"];
    const copy = await createReusableFromSection(changeOf(env, t.editor), { owner, expectedVersion: await versionOf(env, owner), sectionId }, "Test copied FAQ", "copy");
    assert.equal(copy.kind, "ok");
    const copied = await readReusable(db(), copy.reusableId!);
    assert.equal(copied?.blockType, "generic.faq");
    assert.equal((await layoutOf(env, owner)).find((s) => s.id === sectionId)!.reusableId, null, "a copy leaves the section as it is");
    const linked = await createReusableFromSection(changeOf(env, t.editor), { owner, expectedVersion: await versionOf(env, owner), sectionId }, "Test linked FAQ", "link");
    assert.equal(linked.kind, "ok");
    const row = (await layoutOf(env, owner)).find((s) => s.id === sectionId)!;
    assert.equal(row.reusableId, linked.reusableId);
    assert.deepEqual(row.translations, {});
    const hero = (await layoutOf(env, owner))[0];
    expectInvalid(await createReusableFromSection(changeOf(env, t.editor), { owner, expectedVersion: await versionOf(env, owner), sectionId: hero.id }, "Test hero", "copy"), /Only generic blocks/);
    expectDenied(await createReusableFromSection(changeOf(env, t.reviewer), { owner, expectedVersion: await versionOf(env, owner), sectionId }, "Test", "copy"), /permission/);
  });
});
