/**
 * A8 — revisions, publishing and restore across every kind of aggregate on a real MariaDB: a page's layout is part of
 * its versions and comes back with a restore; reusable sections, menus, the site settings with their interface text,
 * forms and collection orders keep versions and restore through their own saves; a form's live projection leaves its
 * private settings out; enquiries never become revisions and record the live privacy policy's version; the audit log
 * viewer's filters; carried hardening (forged layout input audited, relation rows written as a diff, the certificate
 * guard on the rendered page). Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createItem, updateItem } from "../../src/server/cms/engine.ts";
import { clientSpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { moveItem } from "../../src/server/cms/ordering.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { createReusable, updateReusable } from "../../src/server/builder/reusable.ts";
import { readMenus, saveMenu, setUpNavigation } from "../../src/server/site/menus.ts";
import { readSettings, saveSettings, setUpSettings } from "../../src/server/site/settings.ts";
import { readForm, saveForm, setUpForm } from "../../src/server/forms/forms.ts";
import { changeStatus } from "../../src/server/enquiries/enquiries.ts";
import { listAudit, parseAuditQuery } from "../../src/server/audit/viewer.ts";
import { listRevisions, readRevision } from "../../src/server/publishing/revisions.ts";
import { publish, restoreRevision, type PublishingChange } from "../../src/server/publishing/workflow.ts";
import { auditOf, ctxOf, expectOk, formOf, query, team, type Team } from "./cms-helpers.ts";
import { changeOf, dataFor, entryOf, genericPage, layoutOf, save, systemPage, versionOf } from "./builder-helpers.ts";
import { initializeLayout } from "../../src/server/builder/sections.ts";
import { siteChange, settingsInputOf, menuInputOf } from "./site-helpers.ts";
import { formInputOf, formsChange, QUOTE, received, storingForm, submissionEnv } from "./forms-helpers.ts";
import { meta, setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("pub_aggregates");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const change = (actor: Team[keyof Team]): PublishingChange => ({ deps: env.deps, actor, meta: meta() });
const version = async (table: string, key: string, column = "id") => Number((await query(env, `SELECT lock_version AS v FROM ${table} WHERE ${column} = ?`, [key]))[0].v);
const json = <T>(value: unknown): T => (typeof value === "string" ? JSON.parse(value) : value) as T;
const kinds = async (type: string, id: string) => (await listRevisions(db(), type as never, id)).rows.map((r) => r.kind);

describe("a page's layout is part of its versions", () => {
  test("a layout save is a revision of the page; restoring an earlier version brings its layout back", async () => {
    const owner = await genericPage(env, t.admin, "Test Versioned Page");
    expectOk(await initializeLayout(changeOf(env, t.admin), owner, await versionOf(env, owner)));
    const opening = await layoutOf(env, owner);
    const keep = opening.map(entryOf);
    expectOk(await save(env, t.admin, owner, [...keep, { ref: "new:1", blockType: "generic.heading", visible: true, devices: { desktop: true, tablet: true, mobile: true }, anchor: null, data: dataFor("generic.heading", { texts: { en: { title: "Test heading one" } } }) }]));
    const afterFirst = (await listRevisions(db(), "page", owner.id)).rows;
    const snapshot = (await readRevision(db(), "page", owner.id, afterFirst[0].id))!.snapshot as { layout: { blockType: string }[] };
    assert.deepEqual(snapshot.layout.map((s) => s.blockType), [...opening.map((s) => s.blockType), "generic.heading"]);
    env.clock.advance(1000);
    const now = await layoutOf(env, owner);
    expectOk(await save(env, t.admin, owner, [...now.map(entryOf), { ref: "new:2", blockType: "generic.divider", visible: true, devices: { desktop: true, tablet: true, mobile: true }, anchor: null }]));
    assert.equal(Number((await query(env, "SELECT COUNT(*) AS n FROM page_sections WHERE page_id = ?", [owner.id]))[0].n), opening.length + 2);
    env.clock.advance(1000);
    expectOk(await restoreRevision(change(t.admin), "page", owner.id, afterFirst[0].id, await versionOf(env, owner)));
    const sections = await query<{ block_type: string }>(env, "SELECT block_type FROM page_sections WHERE page_id = ? ORDER BY position", [owner.id]);
    assert.deepEqual(sections.map((s) => s.block_type), [...opening.map((s) => s.blockType), "generic.heading"]);
    assert.equal((await kinds("page", owner.id))[0], "restore");
  });

  test("forged layout input (a stored section's block type changed) is refused and audited", async () => {
    const owner = await genericPage(env, t.admin, "Test Forged Page");
    expectOk(await initializeLayout(changeOf(env, t.admin), owner, await versionOf(env, owner)));
    const sections = await layoutOf(env, owner);
    const result = await save(env, t.admin, owner, sections.map((s, i) => (i === 0 ? { ...entryOf(s), blockType: "generic.divider" } : entryOf(s))));
    assert.equal(result.kind, "invalid");
    const events = await auditOf(env, "page", owner.id);
    assert.ok(events.some((e) => e.action === "layout.save" && e.outcome === "failed"), "audited as a failed change");
  });

  test("too many sections are said as such", async () => {
    const owner = await genericPage(env, t.admin, "Test Long Page");
    const many = Array.from({ length: 61 }, (_, i) => ({ ref: `new:${i + 1}`, blockType: "generic.divider", visible: true, devices: { desktop: true, tablet: true, mobile: true }, anchor: null }));
    const result = await save(env, t.admin, owner, many);
    assert.ok(result.kind === "invalid" && /at most 60 sections/.test(result.message), JSON.stringify(result).slice(0, 200));
  });
});

describe("reusable sections, menus, settings, forms and orders", () => {
  test("a reusable section keeps versions and restores", async () => {
    const created = await createReusable(changeOf(env, t.admin), { name: "Test Versioned Reusable", blockType: "generic.heading" });
    assert.equal(created.kind, "ok");
    const id = (created as { id: string }).id;
    env.clock.advance(1000);
    const updated = await updateReusable(changeOf(env, t.admin), { id, expectedVersion: 0, name: "Test Versioned Reusable Renamed", data: dataFor("generic.heading", { texts: { en: { title: "Test words" } } }) });
    assert.equal(updated.kind, "ok", JSON.stringify(updated));
    const history = (await listRevisions(db(), "reusable_section", id)).rows;
    assert.deepEqual(history.map((r) => r.kind), ["save", "save"]);
    env.clock.advance(1000);
    expectOk(await restoreRevision(change(t.admin), "reusable_section", id, history[1].id, await version("reusable_sections", id)));
    assert.equal((await query<{ name: string }>(env, "SELECT name FROM reusable_sections WHERE id = ?", [id]))[0].name, "Test Versioned Reusable");
  });

  test("a menu keeps versions; its live projection holds visible items only; a restore brings an earlier version back", async () => {
    assert.equal((await setUpNavigation(siteChange(env, t.admin))).kind, "ok");
    const menu = (await readMenus(db())).find((m) => m.key === "footer_legal")!;
    const input = menuInputOf(menu);
    const original = input.items.map((i) => i.label?.en);
    env.clock.advance(1000);
    input.items[0] = { ...input.items[0], label: { en: "Test Legal Label", ar: input.items[0].label?.ar ?? "اختبار" } };
    assert.equal((await saveMenu(siteChange(env, t.admin), input)).kind, "ok");
    const history = (await listRevisions(db(), "menu", "footer_legal")).rows;
    assert.ok(history.length >= 2, JSON.stringify(history.map((r) => r.kind)));
    expectOk(await publish(change(t.admin), "menu", "footer_legal", await version("menus", "footer_legal", "`key`")));
    const live = await query<{ document: unknown }>(env, "SELECT document FROM published_documents WHERE entity_type = 'menu' AND entity_id = 'footer_legal'");
    assert.equal(json<{ items: { label: { en: string } }[] }>(live[0].document).items[0].label.en, "Test Legal Label");
    env.clock.advance(1000);
    const before = history[history.length - 1];
    expectOk(await restoreRevision(change(t.admin), "menu", "footer_legal", before.id, await version("menus", "footer_legal", "`key`")));
    const now = (await readMenus(db())).find((m) => m.key === "footer_legal")!;
    assert.deepEqual(now.items.map((i) => i.label?.en), original);
    assert.equal((await restoreRevision(change(t.editor), "menu", "footer_legal", before.id, now.lockVersion)).kind, "denied", "an Editor may not edit menus");
  });

  test("the site settings (with the interface text) keep versions and restore", async () => {
    assert.equal((await setUpSettings(siteChange(env, t.admin))).kind, "ok");
    const model = await readSettings(db());
    const input = settingsInputOf(model);
    env.clock.advance(1000);
    input.texts.en.statement = "Test statement for versions.";
    assert.equal((await saveSettings(siteChange(env, t.admin), input)).kind, "ok");
    const history = (await listRevisions(db(), "site_settings", "site")).rows;
    assert.ok(history.length >= 2);
    env.clock.advance(1000);
    expectOk(await restoreRevision(change(t.admin), "site_settings", "site", history[history.length - 1].id, await version("site_settings", "site")));
    assert.equal((await readSettings(db())).values.texts.en.statement, model.values.texts.en.statement);
  });

  test("a form keeps versions; its live projection leaves out notification addresses and retention", async () => {
    assert.equal((await setUpForm(formsChange(env, t.owner), QUOTE)).kind, "ok");
    const form = await readForm(db(), { id: QUOTE });
    const input = formInputOf(form!);
    input.settings.notificationEmails = ["test.notify@example.test"];
    input.settings.deliveryMode = "store_and_notify";
    input.complete = { en: true, ar: true };
    env.clock.advance(1000);
    assert.equal((await saveForm(formsChange(env, t.owner), QUOTE, input)).kind, "ok");
    expectOk(await publish(change(t.owner), "form", QUOTE, await version("forms", QUOTE)));
    const live = await query<{ document: unknown }>(env, "SELECT document FROM published_documents WHERE entity_type = 'form' AND entity_id = ?", [QUOTE]);
    const settings = json<{ settings: Record<string, unknown> }>(live[0].document).settings;
    assert.equal("notificationEmails" in settings, false);
    assert.equal("retentionDays" in settings, false);
    assert.equal(settings.deliveryMode, "store_and_notify");
    const history = (await listRevisions(db(), "form", QUOTE)).rows;
    assert.equal(history[0].kind, "publish");
  });

  test("a collection's order keeps versions and restores (items added since go last)", async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 3; i++) ids.push(expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf({ slug: `test-order-client-${i}`, "en.name": `Test Order Client ${i}` }))).id);
    const before = (await listRevisions(db(), "ordering", "clients")).rows[0];
    env.clock.advance(1000);
    const moved = await moveItem(ctxOf(env, t.admin), "client", ids[2], "up", await version("entity_orderings", "clients", "`key`"));
    assert.equal(moved.kind, "ok");
    const order = async () => (await query<{ entity_id: string }>(env, "SELECT entity_id FROM entity_ordering_items WHERE ordering_key = 'clients' ORDER BY position")).map((r) => r.entity_id).filter((id) => ids.includes(id));
    assert.deepEqual(await order(), [ids[0], ids[2], ids[1]]);
    expectOk(await restoreRevision(change(t.admin), "ordering", "clients", before.id, await version("entity_orderings", "clients", "`key`")));
    assert.deepEqual(await order(), ids);
  });
});

describe("enquiries and revisions", () => {
  test("an enquiry is never a revision; it records the live privacy policy's version", async () => {
    await storingForm(env, t.owner, "store");
    const sub = await submissionEnv(env);
    const privacy = await systemPage(env, t.owner, "privacy");
    const live = "01KA0000000000000000PRIVCY";
    await query(env, "INSERT INTO revisions (id, entity_type, entity_id, revision_number, kind, schema_version, snapshot, snapshot_sha256, is_sealed, created_at) VALUES (?, 'page', ?, 99, 'publish', 1, '{}', UNHEX(SHA2('x', 256)), 1, NOW(3))", [live, privacy.id]);
    await query(env, "UPDATE pages SET publication_status = 'published', draft_status = 'none', published_revision_id = ? WHERE id = ?", [live, privacy.id]);
    const { enquiryId } = await received(env, sub);
    const row = await query<{ privacy_revision_id: string | null; lock_version: number }>(env, "SELECT privacy_revision_id, lock_version FROM enquiries WHERE id = ?", [enquiryId]);
    assert.equal(row[0].privacy_revision_id, live);
    const formRevisions = (await listRevisions(db(), "form", QUOTE)).total;
    assert.equal((await changeStatus(formsChange(env, t.admin), enquiryId, { expectedVersion: Number(row[0].lock_version), to: "open", note: "" })).kind, "ok");
    assert.equal(Number((await query(env, "SELECT COUNT(*) AS n FROM revisions WHERE entity_type = 'enquiry' OR entity_id = ?", [enquiryId]))[0].n), 0);
    assert.equal((await listRevisions(db(), "form", QUOTE)).total, formRevisions, "a submission and a status change leave the form's versions alone");
  });
});

describe("the audit log viewer", () => {
  test("filters by outcome, record, person and search; the search's wildcards are taken literally", async () => {
    const id = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf({ slug: "test-audit-client", "en.name": "Test Audit Client 50%" }))).id;
    await publish(change(t.editor), "client", id, await version("clients", id));
    const denied = await listAudit(db(), parseAuditQuery({ outcome: "denied", entity: `client:${id}` }, ""));
    assert.ok(denied.rows.length >= 1 && denied.rows.every((r) => r.outcome === "denied" && r.entityId === id));
    const mine = await listAudit(db(), parseAuditQuery({ actor: t.editor.user.id }, ""));
    assert.ok(mine.rows.every((r) => r.actorUserId === t.editor.user.id));
    const found = await listAudit(db(), parseAuditQuery({}, "Audit Client 50%"));
    assert.ok(found.rows.some((r) => r.entityId === id));
    assert.equal((await listAudit(db(), parseAuditQuery({}, "Audit Client 5_%"))).total, 0, "_ is a character, not a wildcard");
    const bogus = parseAuditQuery({ outcome: "x", type: "DROP TABLE", actor: "nope", size: "1000", page: "-3", from: "2026-13-45" }, "");
    assert.deepEqual([bogus.outcome, bogus.type, bogus.actor, bogus.size, bogus.page, bogus.from], ["", "", "", 25, 1, ""]);
  });
});

describe("carried hardening", () => {
  test("relation rows are written as a diff: kept rows stay, order changes move positions, removals and additions only", async () => {
    const s1 = expectOk(await createItem(ctxOf(env, t.admin), serviceSpec, formOf({ slug: "test-diff-one", serviceGroup: "metal", iconKey: "laser-cutting", "en.name": "Test Diff One" }))).id;
    const s2 = expectOk(await createItem(ctxOf(env, t.admin), serviceSpec, formOf({ slug: "test-diff-two", serviceGroup: "metal", iconKey: "laser-cutting", "en.name": "Test Diff Two" }))).id;
    const s3 = expectOk(await createItem(ctxOf(env, t.admin), serviceSpec, formOf({ slug: "test-diff-three", serviceGroup: "metal", iconKey: "laser-cutting", "en.name": "Test Diff Three" }))).id;
    const form = (services: string[], v: number) => formOf({ lockVersion: String(v), slug: "test-diff-project", "en.title": "Test Diff Project", "en.summary": "Synthetic.", "rel.services": services });
    const id = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf({ slug: "test-diff-project", "en.title": "Test Diff Project", "en.summary": "Synthetic.", "rel.services": [s1, s2] }))).id;
    const rows = async () => query<{ service_id: string; position: number }>(env, "SELECT service_id, position FROM project_services WHERE project_id = ? ORDER BY position", [id]);
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, form([s2, s1, s3], await version("projects", id))));
    assert.deepEqual((await rows()).map((r) => [r.service_id, Number(r.position)]), [[s2, 1], [s1, 2], [s3, 3]]);
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, form([s3], await version("projects", id))));
    assert.deepEqual((await rows()).map((r) => [r.service_id, Number(r.position)]), [[s3, 1]]);
  });

  test("the certificate guard reads what the Certificates page would draw from other records", async () => {
    const project = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf({ slug: "test-guard-project", "en.title": "Test Guard Project 1234567", "en.summary": "Synthetic.", "ar.title": "مشروع", "ar.summary": "ملخص.", "en.complete": "1", "ar.complete": "1" }))).id;
    expectOk(await publish(change(t.admin), "project", project, await version("projects", project)));
    const page = await systemPage(env, t.owner, "certificates");
    expectOk(await initializeLayout(changeOf(env, t.owner), page, await versionOf(env, page)));
    const grid = dataFor("generic.projects_grid", { settings: { projects: { mode: "manual", ids: [project] } } });
    const kept = (await layoutOf(env, page)).map(entryOf);
    const saved = await save(env, t.owner, page, [...kept.slice(0, 1), { ref: "new:1", blockType: "generic.projects_grid", visible: true, devices: { desktop: true, tablet: true, mobile: true }, anchor: null, data: grid }, ...kept.slice(1)]);
    assert.equal(saved.kind, "ok", JSON.stringify(saved).slice(0, 300));
    const result = await publish(change(t.owner), "page", page.id, await versionOf(env, page));
    assert.ok(result.kind === "refused" && result.issues?.some((i) => i.code === "certificate.rendered"), JSON.stringify(result).slice(0, 300));
  });
});
