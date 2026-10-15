/**
 * Core CMS (A3) — projects and their categories on a real MariaDB: confirmed details only (empty stays NULL), ordered
 * categories and services, a client record reference, the featured working flag, the category archive rule, and the
 * safety flags: every role may add a restriction, only Owner and Admin may clear one (with a reason), a stale page can't
 * clear a newer restriction, every change and refusal audited. Test data only ("Demo Project …").
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createItem, setItemArchived, updateItem } from "../../src/server/cms/engine.ts";
import { addProjectFlag, clearProjectFlag, listProjectFlags } from "../../src/server/cms/flags.ts";
import { categoryInUse, categorySpec, clientSpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { PROJECT_FLAG_KEYS } from "../../src/server/cms/registry.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditOf, ctxOf, expectOk, formOf, query, team, type Fields, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_projects");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const version = async (table: string, id: string) => Number((await query(env, `SELECT lock_version AS v FROM ${table} WHERE id = ?`, [id]))[0].v);

const project = (extra: Fields = {}): Fields => ({ slug: "demo-project", "en.title": "Demo Project", "en.summary": "A demo project summary.", ...extra });

describe("projects", () => {
  let id = "";
  let cats: string[] = [];
  let svc = "";
  let client = "";

  before(async () => {
    cats = [];
    for (const [slug, label] of [
      ["demo-cat-a", "Demo Category A"],
      ["demo-cat-b", "Demo Category B"],
    ]) {
      cats.push(expectOk(await createItem(ctxOf(env, t.editor), categorySpec, formOf({ slug, "en.label": label, "ar.label": "فئة تجريبية" }))).id);
    }
    svc = expectOk(
      await createItem(
        ctxOf(env, t.editor),
        serviceSpec,
        formOf({ slug: "test-service", serviceGroup: "metal", iconKey: "fabrication", "en.name": "Test Service", "en.tagline": "T", "en.summary": "S", "en.body": "B" }),
      ),
    ).id;
    client = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf({ slug: "demo-client", "en.name": "Demo Client Co." }))).id;
  });

  test("CRUD: optional details stay NULL until entered; categories and services in order; the client record", async () => {
    id = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project({ "rel.categories": [cats[1], cats[0]], "rel.services": [svc] })))).id;
    const [tr] = await query(env, "SELECT scope, description, materials, location, client_name, challenge, solution FROM project_translations WHERE project_id = ?", [id]);
    assert.deepEqual(tr, { scope: null, description: null, materials: null, location: null, client_name: null, challenge: null, solution: null });
    const [root] = await query(env, "SELECT gallery_ref, year, client_id, is_featured FROM projects WHERE id = ?", [id]);
    assert.deepEqual(root, { gallery_ref: null, year: null, client_id: null, is_featured: 0 });
    assert.deepEqual(
      (await query(env, "SELECT category_id AS c FROM project_category_assignments WHERE project_id = ? ORDER BY position", [id])).map((r) => r.c),
      [cats[1], cats[0]],
    );
    expectOk(
      await updateItem(
        ctxOf(env, t.editor),
        projectSpec,
        id,
        formOf(project({ lockVersion: "0", galleryRef: "p.3", year: "2024", clientId: client, isFeatured: "1", "en.location": "Test City", "rel.categories": [cats[0]], "rel.services": [svc] })),
      ),
    );
    assert.deepEqual((await query(env, "SELECT gallery_ref, year, client_id, is_featured FROM projects WHERE id = ?", [id]))[0], {
      gallery_ref: "p.3",
      year: 2024,
      client_id: client,
      is_featured: 1,
    });
    for (const [field, value] of [
      ["year", "1800"],
      ["year", "20x4"],
      ["galleryRef", "<b>04</b>"],
      ["clientId", "not-an-id"],
    ]) {
      const result = await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project({ lockVersion: "1", [field]: value })));
      assert.equal(result.kind, "invalid", `${field}=${value}`);
    }
  });

  test("the featured working flag is a filterable flag only (nothing is public in A3)", async () => {
    const [row] = await query(env, "SELECT is_featured, publication_status FROM projects WHERE id = ?", [id]);
    assert.deepEqual(row, { is_featured: 1, publication_status: "unpublished" });
  });

  test("a category in use by an active project can't be archived; once unused it can, and stays restorable", async () => {
    const refused = await setItemArchived(ctxOf(env, t.admin), categorySpec, cats[0], true, await version("project_categories", cats[0]), { blockArchive: categoryInUse });
    assert.equal(refused.kind, "refused");
    expectOk(await setItemArchived(ctxOf(env, t.admin), categorySpec, cats[1], true, await version("project_categories", cats[1]), { blockArchive: categoryInUse }));
    // An archived category can't be added to a project…
    const add = await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project({ lockVersion: "1", "rel.categories": [cats[0], cats[1]], "rel.services": [svc] })));
    assert.equal(add.kind, "invalid");
    expectOk(await setItemArchived(ctxOf(env, t.admin), categorySpec, cats[1], false, await version("project_categories", cats[1]), { blockArchive: categoryInUse }));
  });

  test("an archived client stays on the project it names, but can't be chosen for another", async () => {
    expectOk(await setItemArchived(ctxOf(env, t.admin), clientSpec, client, true, await version("clients", client)));
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project({ lockVersion: "1", clientId: client, "rel.categories": [cats[0]], "rel.services": [svc] }))));
    const other = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project({ slug: "demo-project-two", "en.title": "Demo Project Two" })))).id;
    const refused = await updateItem(ctxOf(env, t.editor), projectSpec, other, formOf(project({ slug: "demo-project-two", lockVersion: "0", clientId: client })));
    assert.equal(refused.kind, "invalid");
    if (refused.kind === "invalid") assert.match(refused.errors.clientId, /Archived/);
    expectOk(await setItemArchived(ctxOf(env, t.admin), clientSpec, client, false, await version("clients", client)));
  });

  test("the slug is the gallery anchor: the gallery page's own ids are refused", async () => {
    for (const slug of ["gallery", "featured", "highlights", "index", "main", "demo-title"]) {
      assert.equal((await createItem(ctxOf(env, t.editor), projectSpec, formOf(project({ slug })))).kind, "invalid", slug);
    }
  });
});

describe("safety flags", () => {
  let id = "";
  before(async () => {
    id = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project({ slug: "demo-flagged", "en.title": "Demo Flagged Project" })))).id;
  });

  test("every role — Reviewer and Editor included — can add a restriction; adding twice changes nothing", async () => {
    expectOk(await addProjectFlag(ctxOf(env, t.reviewer), id, "rights_pending", "Waiting for the test owner's answer."));
    expectOk(await addProjectFlag(ctxOf(env, t.editor), id, "hidden", ""));
    expectOk(await addProjectFlag(ctxOf(env, t.admin), id, "ai_watermark", ""));
    assert.equal((await addProjectFlag(ctxOf(env, t.owner), id, "hidden", "")).kind, "unchanged");
    const flags = await listProjectFlags(db(), id);
    assert.deepEqual(flags.map((f) => [f.flag, f.blocking]).sort(), [
      ["ai_watermark", false],
      ["hidden", true],
      ["rights_pending", true],
    ]);
    const [event] = (await auditOf(env, "project", id)).filter((e) => e.action === "project.restriction_add" && e.actorUserId === t.reviewer.user.id);
    assert.equal(event.outcome, "success");
  });

  test("only known flags can be added, and notes are plain text", async () => {
    assert.equal((await addProjectFlag(ctxOf(env, t.owner), id, "approved", "")).kind, "invalid");
    assert.equal((await addProjectFlag(ctxOf(env, t.owner), id, "restricted", "<img src=x onerror=alert(1)>")).kind, "invalid");
    assert.equal((await addProjectFlag(ctxOf(env, t.owner), id, "restricted", "x".repeat(501))).kind, "invalid");
    assert.ok(PROJECT_FLAG_KEYS.includes("restricted"));
  });

  test("an Editor or Reviewer cannot clear any flag — blocking or not — and the refusal is audited", async () => {
    const flags = await listProjectFlags(db(), id);
    for (const actor of [t.editor, t.reviewer]) {
      for (const flag of flags) {
        const result = await clearProjectFlag(ctxOf(env, actor), id, flag.flag, flag.token, "Trying to clear it.");
        assert.equal(result.kind, "denied", `${actor.roles[0]} ${flag.flag}`);
      }
    }
    assert.equal((await listProjectFlags(db(), id)).length, 3);
    const denied = (await auditOf(env, "project", id)).filter((e) => e.action === "project.restriction_clear" && e.outcome === "denied");
    assert.equal(denied.length, 6);
  });

  test("an Owner or Admin clears a flag only with a reason, which the audit keeps", async () => {
    const [hidden] = (await listProjectFlags(db(), id)).filter((f) => f.flag === "hidden");
    assert.equal((await clearProjectFlag(ctxOf(env, t.admin), id, "hidden", hidden.token, "")).kind, "invalid");
    expectOk(await clearProjectFlag(ctxOf(env, t.admin), id, "hidden", hidden.token, "Confirmed with the test owner."));
    const [event] = (await auditOf(env, "project", id)).filter((e) => e.action === "project.restriction_clear" && e.outcome === "success");
    assert.equal(event.actorUserId, t.admin.user.id);
    const changes = typeof event.changes === "string" ? JSON.parse(event.changes) : event.changes;
    assert.deepEqual(changes, { before: { flag: "hidden" }, reason: "Confirmed with the test owner." });
  });

  test("a stale page cannot clear a newer restriction (cleared and set again since)", async () => {
    const [old] = (await listProjectFlags(db(), id)).filter((f) => f.flag === "rights_pending");
    expectOk(await clearProjectFlag(ctxOf(env, t.owner), id, "rights_pending", old.token, "Rights confirmed in the test."));
    env.clock.advance(1000);
    expectOk(await addProjectFlag(ctxOf(env, t.editor), id, "rights_pending", "New doubt about the rights."));
    const result = await clearProjectFlag(ctxOf(env, t.owner), id, "rights_pending", old.token, "Clearing from an old page.");
    assert.equal(result.kind, "stale");
    assert.ok((await listProjectFlags(db(), id)).some((f) => f.flag === "rights_pending"));
    const already = await clearProjectFlag(ctxOf(env, t.owner), id, "hidden", "123", "Already gone.");
    assert.equal(already.kind, "stale");
  });

  test("two clears of one flag at once: one succeeds, the other finds it gone", async () => {
    const [flag] = (await listProjectFlags(db(), id)).filter((f) => f.flag === "rights_pending");
    const results = await Promise.all([
      clearProjectFlag(ctxOf(env, t.owner), id, "rights_pending", flag.token, "First clear."),
      clearProjectFlag(ctxOf(env, t.admin), id, "rights_pending", flag.token, "Second clear."),
    ]);
    assert.deepEqual(results.map((r) => r.kind).sort(), ["ok", "stale"]);
  });

  test("an archived project can still be restricted, but not cleared until restored", async () => {
    expectOk(await setItemArchived(ctxOf(env, t.admin), projectSpec, id, true, await version("projects", id)));
    expectOk(await addProjectFlag(ctxOf(env, t.reviewer), id, "internal_only", ""));
    const [flag] = (await listProjectFlags(db(), id)).filter((f) => f.flag === "internal_only");
    assert.equal((await clearProjectFlag(ctxOf(env, t.owner), id, "internal_only", flag.token, "Clear while archived.")).kind, "invalid");
    expectOk(await setItemArchived(ctxOf(env, t.admin), projectSpec, id, false, await version("projects", id)));
    expectOk(await clearProjectFlag(ctxOf(env, t.owner), id, "internal_only", flag.token, "Restored and confirmed."));
  });

  test("flags never change the editor's version, so adding one never makes a form stale", async () => {
    const before = await version("projects", id);
    expectOk(await addProjectFlag(ctxOf(env, t.reviewer), id, "pending_confirmation", ""));
    assert.equal(await version("projects", id), before);
  });

  test("a flag the code does not know (from another release) blocks and can still be cleared by an Owner", async () => {
    await env.pool.query("INSERT INTO project_flags (project_id, flag, note, created_at) VALUES (?, 'future_flag', NULL, ?)", [id, new Date(env.clock.now)]);
    const [unknown] = (await listProjectFlags(db(), id)).filter((f) => f.flag === "future_flag");
    assert.deepEqual([unknown.known, unknown.blocking], [false, true]);
    assert.equal((await clearProjectFlag(ctxOf(env, t.editor), id, "future_flag", unknown.token, "No.")).kind, "denied");
    expectOk(await clearProjectFlag(ctxOf(env, t.owner), id, "future_flag", unknown.token, "Removed in the test."));
  });
});
