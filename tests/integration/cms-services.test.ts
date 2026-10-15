/**
 * Core CMS (A3) — services and machinery on a real MariaDB: the working state from create to archive and back,
 * bilingual completeness, the collection order (Move up / Move down, stale and concurrent moves), relations (machines,
 * related services, featured projects that list the service), machines with power only when stated, a primary service,
 * and technical attributes as validated label/value pairs (never a free blob). Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createItem, loadEditorItem, setItemArchived, updateItem } from "../../src/server/cms/engine.ts";
import { machineSpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { usagesOf } from "../../src/server/cms/lookups.ts";
import { loadOrder, moveItem } from "../../src/server/cms/ordering.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditOf, ctxOf, expectOk, formOf, query, team, type Fields, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_services");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);

const service = (name: string, extra: Fields = {}): Fields => ({
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  serviceGroup: "metal",
  iconKey: "laser-cutting",
  "en.name": name,
  "en.tagline": `${name} tagline`,
  "en.summary": `${name} summary for tests.`,
  "en.body": "First test paragraph.\n\nSecond test paragraph,\nwith a line break.",
  "en.highlights": "Test point one\nTest point two",
  ...extra,
});

const version = async (table: string, id: string) => Number((await query(env, `SELECT lock_version AS v FROM ${table} WHERE id = ?`, [id]))[0].v);

describe("services", () => {
  const ids: Record<string, string> = {};

  test("an Editor creates a service as a draft; the body is stored as A1's paragraph document, never HTML", async () => {
    const created = expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(service("Test Laser Service", { "en.complete": "1" }))));
    ids.laser = created.id;
    const [tr] = await query<{ body: unknown; highlights: unknown; translation_status: string }>(
      env,
      "SELECT body, highlights, translation_status FROM service_translations WHERE service_id = ? AND locale = 'en'",
      [ids.laser],
    );
    const body = typeof tr.body === "string" ? JSON.parse(tr.body) : tr.body;
    assert.deepEqual(body, {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First test paragraph." }] },
        { type: "paragraph", content: [{ type: "text", text: "Second test paragraph," }, { type: "hard_break" }, { type: "text", text: "with a line break." }] },
      ],
    });
    assert.deepEqual(typeof tr.highlights === "string" ? JSON.parse(tr.highlights) : tr.highlights, ["Test point one", "Test point two"]);
    assert.equal(tr.translation_status, "complete");
    const item = await loadEditorItem(db(), serviceSpec, ids.laser);
    assert.deepEqual(item?.states, { en: "complete", ar: "missing" });
    assert.equal(item?.values.en.body, "First test paragraph.\n\nSecond test paragraph,\nwith a line break.");
    ids.bend = expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(service("Test Bending Service", { iconKey: "cnc-bending" })))).id;
    ids.frame = expectOk(await createItem(ctxOf(env, t.admin), serviceSpec, formOf(service("Test Frame Service", { serviceGroup: "scaffolding", iconKey: "scaffolding" })))).id;
  });

  test("a Reviewer cannot create or edit; unknown icons, groups and markup are refused server-side", async () => {
    assert.equal((await createItem(ctxOf(env, t.reviewer), serviceSpec, formOf(service("Test Reviewer Service")))).kind, "denied");
    const badIcon = await createItem(ctxOf(env, t.editor), serviceSpec, formOf(service("Test Bad", { iconKey: "javascript:alert(1)", serviceGroup: "other" })));
    assert.equal(badIcon.kind, "invalid");
    if (badIcon.kind === "invalid") assert.ok(badIcon.errors.iconKey && badIcon.errors.serviceGroup);
    const html = await createItem(ctxOf(env, t.editor), serviceSpec, formOf(service("Test Html", { "en.body": "<p onclick=x>Hi</p>", "en.highlights": Array(9).fill("x").join("\n") })));
    assert.equal(html.kind, "invalid");
    if (html.kind === "invalid") {
      assert.match(html.errors["en.body"], /markup/);
      assert.match(html.errors["en.highlights"], /at most 8/);
    }
  });

  test("Arabic completeness is independent of English and never required to save", async () => {
    const v = await version("services", ids.bend);
    const result = await updateItem(
      ctxOf(env, t.editor),
      serviceSpec,
      ids.bend,
      formOf(service("Test Bending Service", { iconKey: "cnc-bending", lockVersion: String(v), "ar.name": "خدمة ثني تجريبية", "ar.complete": "1" })),
    );
    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") {
      assert.equal(result.errors["ar.tagline"], "Required before Arabic can be marked complete.");
      assert.match(result.errors["ar.complete"], /Arabic is incomplete: Tagline, Summary, Description are missing/);
    }
    expectOk(await updateItem(ctxOf(env, t.editor), serviceSpec, ids.bend, formOf(service("Test Bending Service", { iconKey: "cnc-bending", lockVersion: String(v), "ar.name": "خدمة ثني تجريبية" }))));
    assert.deepEqual((await loadEditorItem(db(), serviceSpec, ids.bend))?.states, { en: "draft", ar: "incomplete" });
  });

  test("the order: new items at the end; Move up / Move down by an Editor; stale, edge, Reviewer refused", async () => {
    let order = await loadOrder(db(), "service");
    assert.deepEqual(order?.rows.map((r) => r.id), [ids.laser, ids.bend, ids.frame]);
    assert.deepEqual(order?.rows.map((r) => r.position), [1, 2, 3]);
    const moved = expectOk(await moveItem(ctxOf(env, t.editor), "service", ids.frame, "up", order!.lockVersion));
    order = await loadOrder(db(), "service");
    assert.deepEqual(order?.rows.map((r) => r.id), [ids.laser, ids.frame, ids.bend]);
    assert.equal(order?.lockVersion, moved.lockVersion);
    assert.deepEqual(await moveItem(ctxOf(env, t.editor), "service", ids.bend, "up", moved.lockVersion - 1), { kind: "stale" });
    assert.equal((await moveItem(ctxOf(env, t.editor), "service", ids.laser, "up", order!.lockVersion)).kind, "edge");
    assert.equal((await moveItem(ctxOf(env, t.reviewer), "service", ids.laser, "down", order!.lockVersion)).kind, "denied");
    const positions = await query<{ position: number }>(env, "SELECT position FROM entity_ordering_items WHERE ordering_key = 'services' ORDER BY position");
    assert.deepEqual(
      positions.map((p) => p.position),
      [1, 2, 3],
    );
    const actions = (await auditOf(env, "service", ids.frame)).map((e) => `${e.action}:${e.outcome}`);
    assert.ok(actions.includes("service.reorder:success"));
  });

  test("two moves sent at once from the same page: exactly one applies, positions stay unique", async () => {
    const order = (await loadOrder(db(), "service"))!;
    const results = await Promise.all([
      moveItem(ctxOf(env, t.editor), "service", ids.bend, "up", order.lockVersion),
      moveItem(ctxOf(env, t.admin), "service", ids.laser, "down", order.lockVersion),
    ]);
    assert.deepEqual(results.map((r) => r.kind).sort(), ["ok", "stale"]);
    const after = (await loadOrder(db(), "service"))!;
    assert.equal(new Set(after.rows.map((r) => r.position)).size, 3);
    assert.equal(after.rows.length, 3);
  });

  test("an archived item keeps its place, is stepped over by moves and comes back there when restored", async () => {
    const before = (await loadOrder(db(), "service"))!;
    const middle = before.rows[1].id;
    expectOk(await setItemArchived(ctxOf(env, t.admin), serviceSpec, middle, true, await version("services", middle)));
    const first = before.rows[0].id;
    const last = before.rows[2].id;
    const step = (await loadOrder(db(), "service"))!;
    expectOk(await moveItem(ctxOf(env, t.editor), "service", last, "up", step.lockVersion));
    const after = (await loadOrder(db(), "service"))!;
    assert.deepEqual(after.rows.map((r) => r.id), [last, middle, first]);
    expectOk(await setItemArchived(ctxOf(env, t.admin), serviceSpec, middle, false, await version("services", middle)));
    assert.deepEqual((await loadOrder(db(), "service"))!.rows.map((r) => [r.id, r.archived]), [
      [last, false],
      [middle, false],
      [first, false],
    ]);
  });

  test("relations: related services in order, never itself, never twice; an archived target may stay but not be added", async () => {
    const v = await version("services", ids.laser);
    const self = await updateItem(ctxOf(env, t.editor), serviceSpec, ids.laser, formOf(service("Test Laser Service", { lockVersion: String(v), "rel.relatedServices": [ids.laser] })));
    assert.equal(self.kind, "invalid");
    const twice = await updateItem(ctxOf(env, t.editor), serviceSpec, ids.laser, formOf(service("Test Laser Service", { lockVersion: String(v), "rel.relatedServices": [ids.bend, ids.bend] })));
    assert.equal(twice.kind, "invalid");
    const unknown = await updateItem(ctxOf(env, t.editor), serviceSpec, ids.laser, formOf(service("Test Laser Service", { lockVersion: String(v), "rel.relatedServices": ["01ARZ3NDEKTSV4RRFFQ69G5FAV"] })));
    assert.equal(unknown.kind, "invalid");
    expectOk(await updateItem(ctxOf(env, t.editor), serviceSpec, ids.laser, formOf(service("Test Laser Service", { lockVersion: String(v), "rel.relatedServices": [ids.frame, ids.bend] }))));
    assert.deepEqual(
      (await query(env, "SELECT related_service_id AS id, position FROM service_related_services WHERE service_id = ? ORDER BY position", [ids.laser])).map((r) => r.id),
      [ids.frame, ids.bend],
    );
    const relationEvent = (await auditOf(env, "service", ids.laser)).find((e) => e.action === "service.relations_change");
    assert.ok(relationEvent);
    // Archive the bending service: it may stay linked, but a service that did not link it may not add it.
    expectOk(await setItemArchived(ctxOf(env, t.admin), serviceSpec, ids.bend, true, await version("services", ids.bend)));
    expectOk(
      await updateItem(ctxOf(env, t.editor), serviceSpec, ids.laser, formOf(service("Test Laser Service", { lockVersion: String(v + 1), "rel.relatedServices": [ids.bend, ids.frame] }))),
    );
    const add = await updateItem(
      ctxOf(env, t.editor),
      serviceSpec,
      ids.frame,
      formOf(service("Test Frame Service", { serviceGroup: "scaffolding", iconKey: "scaffolding", lockVersion: String(await version("services", ids.frame)), "rel.relatedServices": [ids.bend] })),
    );
    assert.equal(add.kind, "invalid");
    if (add.kind === "invalid") assert.match(add.errors["rel.relatedServices"], /Archived items can stay linked/);
    expectOk(await setItemArchived(ctxOf(env, t.admin), serviceSpec, ids.bend, false, await version("services", ids.bend)));
  });

  test("featured projects must list the service in their own record", async () => {
    const project = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf({ slug: "demo-project-one", "en.title": "Demo Project One", "en.summary": "A demo summary." }))).id;
    const v = await version("services", ids.laser);
    const refused = await updateItem(
      ctxOf(env, t.editor),
      serviceSpec,
      ids.laser,
      formOf(service("Test Laser Service", { lockVersion: String(v), "rel.relatedServices": [ids.bend, ids.frame], "rel.featuredProjects": [project] })),
    );
    assert.equal(refused.kind, "invalid");
    if (refused.kind === "invalid") assert.match(refused.errors["rel.featuredProjects"], /no longer list this service/);
    expectOk(
      await updateItem(ctxOf(env, t.editor), projectSpec, project, formOf({ lockVersion: "0", slug: "demo-project-one", "en.title": "Demo Project One", "en.summary": "A demo summary.", "rel.services": [ids.laser] })),
    );
    expectOk(
      await updateItem(
        ctxOf(env, t.editor),
        serviceSpec,
        ids.laser,
        formOf(service("Test Laser Service", { lockVersion: String(v), "rel.relatedServices": [ids.bend, ids.frame], "rel.featuredProjects": [project] })),
      ),
    );
    const usage = await usagesOf(db(), "project", project);
    assert.deepEqual(usage.map((u) => [u.label, u.items.map((i) => i.id)]), [["Services that feature this project", [ids.laser]]]);
  });
});

describe("machinery", () => {
  let serviceId = "";
  let machineId = "";
  const machine = (extra: Fields = {}): Fields => ({
    slug: "test-laser-6kw",
    "en.name": "Test Laser 6 kW",
    "en.shortName": "Test Laser",
    "en.category": "Test cutting machine",
    "en.capability": "Cuts test sheets.",
    ...extra,
  });

  before(async () => {
    serviceId = expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(service("Test Machine Service", { slug: "test-machine-service" })))).id;
  });

  test("power is stored only when entered; an empty power is “not stated” (NULL), never 0", async () => {
    machineId = expectOk(await createItem(ctxOf(env, t.editor), machineSpec, formOf(machine()))).id;
    assert.equal((await query(env, "SELECT power_watts FROM machines WHERE id = ?", [machineId]))[0].power_watts, null);
    for (const powerWatts of ["0", "-5", "abc", "1.5", "100001"]) {
      const result = await updateItem(ctxOf(env, t.editor), machineSpec, machineId, formOf(machine({ lockVersion: "0", powerWatts })));
      assert.equal(result.kind, "invalid", powerWatts);
    }
    expectOk(await updateItem(ctxOf(env, t.editor), machineSpec, machineId, formOf(machine({ lockVersion: "0", powerWatts: "6000", primaryServiceId: serviceId }))));
    assert.deepEqual((await query(env, "SELECT power_watts, primary_service_id FROM machines WHERE id = ?", [machineId]))[0], { power_watts: 6000, primary_service_id: serviceId });
  });

  test("the slug is also the /capabilities anchor: the page's own ids are refused", async () => {
    for (const slug of ["console", "register", "main", "test-name", "line-cutting", "power-title"]) {
      const result = await createItem(ctxOf(env, t.editor), machineSpec, formOf(machine({ slug })));
      assert.equal(result.kind, "invalid", slug);
    }
  });

  test("technical attributes: ordered label/value pairs per language, validated; ids kept when reordered", async () => {
    const children = JSON.stringify([
      { id: null, en: { label: "Test bed", value: "3 × 1.5 m" }, ar: { label: "طاولة تجريبية", value: "٣ × ١٫٥ م" } },
      { id: null, en: { label: "Test axis", value: "4 axes" }, ar: { label: "", value: "" } },
    ]);
    expectOk(await updateItem(ctxOf(env, t.editor), machineSpec, machineId, formOf(machine({ lockVersion: "1", powerWatts: "6000", primaryServiceId: serviceId, children }))));
    const item = await loadEditorItem(db(), machineSpec, machineId);
    assert.deepEqual(
      item?.children.map((c) => [c.en.label, c.ar.label]),
      [
        ["Test bed", "طاولة تجريبية"],
        ["Test axis", ""],
      ],
    );
    const [a, b] = item!.children;
    const swapped = JSON.stringify([
      { id: b.id, en: b.en, ar: { label: "محور", value: "٤ محاور" } },
      { id: a.id, en: a.en, ar: a.ar },
    ]);
    expectOk(await updateItem(ctxOf(env, t.editor), machineSpec, machineId, formOf(machine({ lockVersion: "2", powerWatts: "6000", primaryServiceId: serviceId, children: swapped }))));
    const after = await loadEditorItem(db(), machineSpec, machineId);
    assert.deepEqual(
      after?.children.map((c) => c.id),
      [b.id, a.id],
    );
    const rows = await query(env, "SELECT id, position FROM machine_attributes WHERE machine_id = ? ORDER BY position", [machineId]);
    assert.deepEqual(rows, [
      { id: b.id, position: 1 },
      { id: a.id, position: 2 },
    ]);
  });

  test("no attribute blob: extra keys, markup, scripts, unknown ids, too many entries and broken JSON are refused", async () => {
    const attempts = [
      JSON.stringify([{ id: null, en: { label: "x", value: "y" }, ar: { label: "", value: "" }, html: "<b>x</b>" }]),
      JSON.stringify([{ id: null, en: { label: "x", value: "<script>alert(1)</script>" }, ar: { label: "", value: "" } }]),
      JSON.stringify([{ id: null, en: { label: "x", value: "y", style: "color:red" }, ar: { label: "", value: "" } }]),
      JSON.stringify([{ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", en: { label: "x", value: "y" }, ar: { label: "", value: "" } }]),
      JSON.stringify(Array.from({ length: 21 }, () => ({ id: null, en: { label: "x", value: "y" }, ar: { label: "", value: "" } }))),
      JSON.stringify({ en: "not a list" }),
      "{not json",
      JSON.stringify([{ id: null, en: { label: "x".repeat(81), value: "y" }, ar: { label: "", value: "" } }]),
    ];
    for (const children of attempts) {
      const result = await updateItem(ctxOf(env, t.editor), machineSpec, machineId, formOf(machine({ lockVersion: "3", children })));
      assert.equal(result.kind, "invalid", children.slice(0, 60));
    }
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM machine_attributes WHERE machine_id = ?", [machineId]))[0].n, 2);
  });

  test("a machine's primary service must exist and be active when chosen; services list machines in order", async () => {
    const missing = await updateItem(ctxOf(env, t.editor), machineSpec, machineId, formOf(machine({ lockVersion: "3", primaryServiceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" })));
    assert.equal(missing.kind, "invalid");
    const second = expectOk(await createItem(ctxOf(env, t.editor), machineSpec, formOf(machine({ slug: "test-press-brake", "en.name": "Test Press Brake" })))).id;
    const sv = await version("services", serviceId);
    expectOk(await updateItem(ctxOf(env, t.editor), serviceSpec, serviceId, formOf(service("Test Machine Service", { slug: "test-machine-service", lockVersion: String(sv), "rel.machines": [second, machineId] }))));
    assert.deepEqual(
      (await query(env, "SELECT machine_id AS id FROM service_machines WHERE service_id = ? ORDER BY position", [serviceId])).map((r) => r.id),
      [second, machineId],
    );
    const usage = await usagesOf(db(), "machine", machineId);
    assert.deepEqual(usage.map((u) => u.label), ["Services that list this machine"]);
  });

  test("Arabic text keeps its letters and digits exactly (utf8mb4)", async () => {
    const [row] = await query(env, "SELECT value FROM machine_attribute_translations WHERE locale = 'ar' AND label = 'طاولة تجريبية'");
    assert.equal(row.value, "٣ × ١٫٥ م");
  });
});
