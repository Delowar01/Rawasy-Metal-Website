/**
 * Page builder (A5) — the security review's findings on a real MariaDB (brief §68). Each test failed on the code before
 * its fix (a0f381b):
 *
 * - F1: certificate copy keeps A3's digit guard wherever it reaches the Certificates page — a figure (a value shown as
 *   text), an anchor (part of the page's address), and a reusable section's texts when it is linked there, edited while
 *   linked there, or duplicated or detached there.
 * - F2: linking and archiving a reusable section decide on the latest committed state (locking reads, taken in one
 *   order), so a reusable section is never archived while a page section links it, and a detach copies the reusable
 *   section's texts as they are when it commits.
 * - F3: a settings-only save of a section stored at an older block version stores its texts at the new version too.
 * - F5: a layout change the page's structure refuses and a stale archive are audited.
 *
 * Races are made deterministic with a row held FOR UPDATE on a third connection (A3 Correction 1's pattern). Test data
 * only ("Test …").
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { REGISTRY } from "../../src/server/builder/registry.ts";
import { createReusable, setReusableArchived, updateReusable } from "../../src/server/builder/reusable.ts";
import { detachSection, initializeLayout, readSectionData } from "../../src/server/builder/sections.ts";
import { readReusable, type OwnerRef, type StoredSection } from "../../src/server/builder/store.ts";
import type { SectionInput } from "../../src/server/builder/input.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditOf, expectOk, query, team, type Team } from "./cms-helpers.ts";
import { changeOf, dataFor, entryOf, expectInvalid, genericPage, layoutOf, save, systemPage, versionOf } from "./builder-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
/** The site's Certificates page (one per database), set up once. */
let certificates: OwnerRef;
before(async () => {
  env = await setupTestEnv("builder_review");
  t = await team(env);
  certificates = await systemPage(env, t.owner, "certificates");
  expectOk(await initializeLayout(changeOf(env, t.owner), certificates, await versionOf(env, certificates)));
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const all = { desktop: true, tablet: true, mobile: true };
const NUMBER = /registration or certificate number/;

async function initialized(owner: OwnerRef, actor = t.owner): Promise<StoredSection[]> {
  expectOk(await initializeLayout(changeOf(env, actor), owner, await versionOf(env, owner)));
  return layoutOf(env, owner);
}

/** The stored layout as save entries with `extra` placed before the closing section (it stays last). */
const beforeLast = (sections: StoredSection[], extra: SectionInput): SectionInput[] => [...sections.slice(0, -1).map(entryOf), extra, entryOf(sections.at(-1)!)];

const faqData = (question: string) =>
  dataFor("generic.faq", {
    settings: { questions: [{ id: "q1" }] },
    texts: { en: { title: "Test FAQ", questions: { q1: { question, answer: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test answer." }] }] } } } } },
  });

async function reusableWith(question: string, name = "Test review FAQ"): Promise<string> {
  const created = expectOk(await createReusable(changeOf(env, t.editor), { name, blockType: "generic.faq" }));
  expectOk(await updateReusable(changeOf(env, t.editor), { id: created.id, expectedVersion: 0, name, data: faqData(question) }));
  return created.id;
}

const link = (reusableId: string, ref = "new:1"): SectionInput => ({ ref, reusableId, visible: true, devices: all, anchor: null });

/** A row held FOR UPDATE on its own connection until `commit`. */
async function holding(statement: string, params: unknown[]) {
  const conn = await env.pool.getConnection();
  await conn.query("BEGIN");
  await conn.query(statement, params);
  return {
    commit: async () => {
      await conn.query("COMMIT");
      conn.release();
    },
  };
}

/** Whether a change is still running after a while: it is waiting for a lock (not finished, not failed). */
const stillWaiting = (change: Promise<unknown>, ms = 600) =>
  Promise.race([change.then(() => false, () => false), new Promise<boolean>((done) => setTimeout(() => done(true), ms))]);

describe("F1 — certificate copy on the Certificates page", () => {

  test("a figure is shown as text: a registration number in it is refused there, kept on other pages", async () => {
    const figures = (value: string): SectionInput => ({
      ref: "new:1",
      blockType: "generic.statistics",
      visible: true,
      devices: all,
      anchor: null,
      data: dataFor("generic.statistics", {
        settings: { figures: [{ id: "f1", value, sourceBasis: "unstated", sourcePages: "" }] },
        texts: { en: { figures: { f1: { label: "Test figure", unit: "" } } } },
      }),
    });
    const sections = await layoutOf(env, certificates);
    expectInvalid(await save(env, t.owner, certificates, beforeLast(sections, figures("1010123456"))), NUMBER);
    expectInvalid(await save(env, t.owner, certificates, beforeLast(sections, figures("101 0123"))), NUMBER);
    expectOk(await save(env, t.owner, certificates, beforeLast(sections, figures("12,000"))));
    const page = await genericPage(env, t.editor);
    const generic = await initialized(page, t.editor);
    expectOk(await save(env, t.editor, page, [...generic.map(entryOf), figures("1010123456")]));
  });

  test("a Contact details block (phone numbers) can't be added there", async () => {
    const contact: SectionInput = { ref: "new:1", blockType: "generic.contact_details", visible: true, devices: all, anchor: null };
    expectInvalid(await save(env, t.owner, certificates, beforeLast(await layoutOf(env, certificates), contact)), /“Contact details” can't be added to the Certificates\./);
  });

  test("an anchor is part of the page's address: no registration number in it there; free on other pages", async () => {
    const heading = (anchor: string): SectionInput => ({ ref: "new:1", blockType: "generic.heading", visible: true, devices: all, anchor, data: dataFor("generic.heading", { texts: { en: { title: "Test heading" } } }) });
    expectInvalid(await save(env, t.owner, certificates, beforeLast(await layoutOf(env, certificates), heading("a1010123456"))), /anchor/);
    expectInvalid(await save(env, t.owner, certificates, beforeLast(await layoutOf(env, certificates), heading("doc-101-0123"))), /anchor/);
    const page = await genericPage(env, t.editor);
    expectOk(await save(env, t.editor, page, [...(await initialized(page, t.editor)).map(entryOf), heading("a1010123456")]));
  });
});

describe("F1 — reusable sections shown on the Certificates page", () => {

  test("linking one whose texts hold a number is refused there, allowed on other pages", async () => {
    const reusable = await reusableWith("Registration 1010123456?");
    const page = await genericPage(env, t.editor);
    expectOk(await save(env, t.editor, page, [...(await initialized(page, t.editor)).map(entryOf), link(reusable)]));
    expectInvalid(await save(env, t.owner, certificates, beforeLast(await layoutOf(env, certificates), link(reusable))), NUMBER);
  });

  test("editing one linked there keeps the guard; the same text is accepted while it is linked only elsewhere", async () => {
    const shown = await reusableWith("Test question?");
    expectOk(await save(env, t.owner, certificates, beforeLast(await layoutOf(env, certificates), link(shown))));
    const v = (await readReusable(db(), shown))!.lockVersion;
    const refused = await updateReusable(changeOf(env, t.editor), { id: shown, expectedVersion: v, name: "Test review FAQ", data: faqData("Registration 1010123456?") });
    assert.equal(refused.kind, "invalid", JSON.stringify(refused));
    if (refused.kind === "invalid") assert.match(refused.issues.map((i) => i.message).join(" | "), NUMBER);
    assert.equal((await readReusable(db(), shown))!.lockVersion, v, "nothing was saved");

    const elsewhere = await reusableWith("Test question?");
    const page = await genericPage(env, t.editor);
    expectOk(await save(env, t.editor, page, [...(await initialized(page, t.editor)).map(entryOf), link(elsewhere)]));
    const w = (await readReusable(db(), elsewhere))!.lockVersion;
    expectOk(await updateReusable(changeOf(env, t.editor), { id: elsewhere, expectedVersion: w, name: "Test review FAQ", data: faqData("Registration 1010123456?") }));
  });

  test("a duplicate or a detach of a link there checks the reusable section's texts (texts written before the guard)", async () => {
    const shown = await reusableWith("Test question?");
    const linked = expectOk(await save(env, t.owner, certificates, beforeLast(await layoutOf(env, certificates), link(shown)))).ids["new:1"];
    // Texts stored before this guard existed (written here directly).
    await query(env, "UPDATE reusable_section_translations SET content = ? WHERE reusable_section_id = ? AND locale = 'en'", [JSON.stringify(faqData("Registration 1010123456?").content.en), shown]);
    const sections = await layoutOf(env, certificates);
    expectInvalid(await save(env, t.owner, certificates, beforeLast(sections, { ref: "new:1", duplicateOf: linked, visible: true, devices: all, anchor: null })), NUMBER);
    expectInvalid(await detachSection(changeOf(env, t.owner), { owner: certificates, expectedVersion: await versionOf(env, certificates), sectionId: linked }), NUMBER);
    assert.equal((await layoutOf(env, certificates)).find((s) => s.id === linked)?.reusableId, shown, "still linked: nothing was copied");

    // The same texts may be detached on a page that is not certificate copy.
    const page = await genericPage(env, t.editor);
    const there = expectOk(await save(env, t.editor, page, [...(await initialized(page, t.editor)).map(entryOf), link(shown)])).ids["new:1"];
    expectOk(await detachSection(changeOf(env, t.admin), { owner: page, expectedVersion: await versionOf(env, page), sectionId: there }));
  });
});

describe("F2 — linking, archiving and detaching decide on the latest committed state", () => {
  test("a reusable section is never archived while a page section links it (the save's snapshot predates the archive)", async () => {
    const reusable = await reusableWith("Test question?");
    const page = await genericPage(env, t.editor);
    const sections = await initialized(page, t.editor);
    const version = await versionOf(env, page);
    const archiveVersion = (await readReusable(db(), reusable))!.lockVersion;
    // The save takes the page's root (its snapshot starts there) and then waits at the page's held section row.
    const hold = await holding("SELECT id FROM page_sections WHERE id = ? FOR UPDATE", [sections[0].id]);
    const linking = save(env, t.editor, page, [...sections.map(entryOf), link(reusable)], version);
    assert.equal(await stillWaiting(linking), true, "the save waits at the page's sections");
    const archiving = setReusableArchived(changeOf(env, t.admin), { id: reusable, expectedVersion: archiveVersion, archived: true });
    await stillWaiting(archiving);
    await hold.commit();
    const [linked, archived] = await Promise.all([linking, archiving]);
    const [row] = await query<{ publication_status: string; uses: number }>(
      env,
      "SELECT publication_status, (SELECT COUNT(*) FROM page_sections WHERE reusable_section_id = r.id) AS uses FROM reusable_sections r WHERE id = ?",
      [reusable],
    );
    assert.ok(!(row.publication_status === "archived" && Number(row.uses) > 0), `archived while linked: ${JSON.stringify({ row, linked, archived })}`);
    assert.ok(
      (linked.kind === "ok" && archived.kind === "denied") || (linked.kind === "invalid" && archived.kind === "ok"),
      `exactly one wins: ${JSON.stringify([linked, archived])}`,
    );
  });

  test("a detach copies the reusable section's texts as they are when it commits, never an older version", async () => {
    const reusable = await reusableWith("Before?");
    const page = await genericPage(env, t.editor);
    const linked = expectOk(await save(env, t.editor, page, [...(await initialized(page, t.editor)).map(entryOf), link(reusable)])).ids["new:1"];
    const version = await versionOf(env, page);
    const reusableVersion = (await readReusable(db(), reusable))!.lockVersion;
    const order: string[] = [];
    // The detach takes the page's root (its snapshot starts there) and then waits at the held section row.
    const hold = await holding("SELECT id FROM page_sections WHERE id = ? FOR UPDATE", [linked]);
    const detaching = detachSection(changeOf(env, t.admin), { owner: page, expectedVersion: version, sectionId: linked }).then((r) => (order.push("detach"), r));
    assert.equal(await stillWaiting(detaching), true, "the detach waits at the section");
    const updating = updateReusable(changeOf(env, t.editor), { id: reusable, expectedVersion: reusableVersion, name: "Test review FAQ", data: faqData("After?") }).then((r) => (order.push("update"), r));
    await stillWaiting(updating);
    await hold.commit();
    const [detached, updated] = await Promise.all([detaching, updating]);
    expectOk(detached);
    expectOk(updated);
    const copy = (await layoutOf(env, page)).find((s) => s.id === linked)!;
    assert.equal(copy.reusableId, null);
    const question = Object.values((copy.translations.en!.content as { questions: Record<string, { question: string }> }).questions)[0].question;
    assert.equal(question, order[0] === "update" ? "After?" : "Before?", `finished in the order ${order.join(", ")}; the copy holds “${question}”`);
  });
});

describe("F3 — a section stored at an older block version", () => {
  test("a settings-only save stores its texts at the new version too (never old texts under the new version)", async () => {
    const page = await genericPage(env, t.editor);
    const heading: SectionInput = { ref: "new:1", blockType: "generic.heading", visible: true, devices: all, anchor: null, data: dataFor("generic.heading", { texts: { en: { title: "Test heading" } } }) };
    const id = expectOk(await save(env, t.editor, page, [...(await initialized(page, t.editor)).map(entryOf), heading])).ids["new:1"];
    // Version 2 of the block: its step from version 1 rewrites the title (a stand-in for a renamed or reshaped field).
    const def = REGISTRY.get("generic.heading")!;
    const original = { version: def.version, upcasters: def.upcasters };
    def.version = 2;
    def.upcasters = {
      1: (data) => ({
        settings: data.settings,
        content: Object.fromEntries(Object.entries(data.content).map(([locale, text]) => [locale, { ...(text as object), title: `${(text as { title: string }).title} (v2)` }])),
      }),
    };
    try {
      const stored = (await layoutOf(env, page)).find((s) => s.id === id)!;
      assert.equal(stored.schemaVersion, 1);
      const read = readSectionData(stored);
      assert.ok(read.state === "ok" && read.upcast);
      // The editor opened the section at version 2 and changed its alignment only.
      const design = { ...(read.settings.design as object), align: "center" };
      const sections = await layoutOf(env, page);
      expectOk(
        await save(
          env,
          t.editor,
          page,
          sections.map((s) => (s.id === id ? { ...entryOf(s), data: { settings: { ...read.settings, design }, content: read.content, complete: { en: false, ar: false }, otherUnaffected: false } } : entryOf(s))),
        ),
      );
      const saved = (await layoutOf(env, page)).find((s) => s.id === id)!;
      assert.equal(saved.schemaVersion, 2);
      assert.equal((saved.translations.en!.content as { title: string }).title, "Test heading (v2)", "the texts are stored at version 2");
      const again = readSectionData(saved);
      assert.ok(again.state === "ok" && !again.upcast && (again.content.en as { title: string }).title === "Test heading (v2)");
    } finally {
      def.version = original.version;
      def.upcasters = original.upcasters;
    }
  });
});

describe("F5 — refusals are audited", () => {
  test("an Owner's layout change About's structure refuses (removing a part that may only be hidden) is audited for the page", async () => {
    const about = await systemPage(env, t.owner, "about");
    const sections = await initialized(about);
    const before = (await auditOf(env, "page", about.id)).length;
    expectInvalid(await save(env, t.owner, about, sections.filter((s) => s.blockType !== "about.overview").map(entryOf)), /can't be removed/);
    const events = await auditOf(env, "page", about.id);
    assert.equal(events.length, before + 1);
    assert.deepEqual([events[0].action, events[0].outcome, events[0].actorUserId], ["layout.save", "failed", t.owner.user.id]);
    assert.match(events[0].summary, /^Refused: /);
  });

  test("a stale archive or restore is audited as failed", async () => {
    const reusable = await reusableWith("Test question?");
    const v = (await readReusable(db(), reusable))!.lockVersion;
    assert.equal((await setReusableArchived(changeOf(env, t.admin), { id: reusable, expectedVersion: v - 1, archived: true })).kind, "stale");
    const [event] = await auditOf(env, "reusable_section", reusable);
    assert.deepEqual([event.action, event.outcome], ["reusable_section.archive", "failed"]);
  });
});
