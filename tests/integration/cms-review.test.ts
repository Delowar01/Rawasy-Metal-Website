/**
 * Core CMS (A3) — the focused security review's findings on a real MariaDB, each with a test that fails on the code
 * before its fix: a certificate's place in the order is a certificate action (finding 2); a category archived while a
 * project links it, and a project restored into an archived category (3); two creates at once (4); archive and restore
 * make an open order page stale (7); refusals audited (8). Findings 1 and 6 are unit tests (cms-rules, cms-slugs,
 * cms-validation), finding 5 is in the admin browser suite (e2e-admin/cms.spec.ts).
 *
 * The races are made deterministic by holding a row lock on a separate connection (the other side of the race) and
 * checking that the change under test is waiting for it before the lock is released. Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createItem, setItemArchived, updateItem } from "../../src/server/cms/engine.ts";
import { addProjectFlag, clearProjectFlag } from "../../src/server/cms/flags.ts";
import { categorySpec, certificateSpec, LIFECYCLE_RULES, machineSpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { loadOrder, moveItem } from "../../src/server/cms/ordering.ts";
import { auditOf, ctxOf, expectOk, formOf, query, team, type Fields, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_review");
  t = await team(env);
});
after(async () => env?.close());

const version = async (table: string, id: string) => Number((await query(env, `SELECT lock_version AS v FROM ${table} WHERE id = ?`, [id]))[0].v);
const service = (slug: string): Fields => ({ slug, serviceGroup: "metal", iconKey: "fabrication", "en.name": `Test ${slug}` });
const category = (slug: string): Fields => ({ slug, "en.label": `Demo ${slug}` });
const project = (slug: string, extra: Fields = {}): Fields => ({ slug, "en.title": `Demo ${slug}`, "en.summary": "A demo summary.", ...extra });
const ARCHIVE_SQL = (table: string) =>
  `UPDATE ${table} SET publication_status = 'archived', draft_status = 'none', archived_at = UTC_TIMESTAMP(3), lock_version = lock_version + 1 WHERE id = ?`;

/** A transaction on its own connection that holds the row locks of its statements until `commit` (the other side). */
async function holding(statements: [string, unknown[]][]) {
  const conn = await env.pool.getConnection();
  await conn.query("BEGIN");
  for (const [statement, params] of statements) await conn.query(statement, params);
  return {
    run: (statement: string, params: unknown[] = []) => conn.query(statement, params),
    commit: async () => {
      await conn.query("COMMIT");
      conn.release();
    },
  };
}

/** Whether a change is still running after a while: it is waiting for the held lock (not finished, not failed). */
const stillWaiting = (change: Promise<unknown>, ms = 600) =>
  Promise.race([change.then(() => false, () => false), new Promise<boolean>((done) => setTimeout(() => done(true), ms))]);

describe("finding 2: a certificate's place in the order is a certificate action", () => {
  test("an Editor (orderings.edit, not certificates.edit) can't move a certificate; the refusal is audited; an Admin can", async () => {
    const ids = [];
    for (const slug of ["test-licence-a", "test-licence-b"]) {
      ids.push(expectOk(await createItem(ctxOf(env, t.admin), certificateSpec, formOf({ slug, "en.title": `Test ${slug}`, "en.issuer": "Test Body" }))).id);
    }
    const order = (await loadOrder(env.deps.db, "certificate"))!;
    const refused = await moveItem(ctxOf(env, t.editor), "certificate", ids[1], "up", order.lockVersion);
    assert.equal(refused.kind, "denied");
    const [event] = await auditOf(env, "certificate", ids[1]);
    assert.equal(event.action, "certificate.reorder");
    assert.equal(event.outcome, "denied");
    assert.match(event.summary, /orderings\.edit and certificates\.edit/);
    assert.equal((await loadOrder(env.deps.db, "certificate"))!.lockVersion, order.lockVersion, "nothing moved");
    expectOk(await moveItem(ctxOf(env, t.admin), "certificate", ids[1], "up", order.lockVersion));
  });
});

describe("finding 3: no active project in an archived category", () => {
  test("a category archived while a project's save links it: the save waits for the archive, then refuses the category", async () => {
    const cat = expectOk(await createItem(ctxOf(env, t.editor), categorySpec, formOf(category("demo-race-cat")))).id;
    const proj = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("demo-race-project")))).id;
    // The archive holds the category's row (as `setItemArchived` does) and finds no active project using it yet.
    const archive = await holding([[`SELECT id FROM project_categories WHERE id = ? FOR UPDATE`, [cat]]]);
    const save = updateItem(ctxOf(env, t.editor), projectSpec, proj, formOf(project("demo-race-project", { lockVersion: String(await version("projects", proj)), "rel.categories": [cat] })));
    assert.equal(await stillWaiting(save), true, "the save waits for the category's lock");
    await archive.run(ARCHIVE_SQL("project_categories"), [cat]);
    await archive.commit();
    const result = await save;
    assert.equal(result.kind, "invalid", JSON.stringify(result));
    if (result.kind === "invalid") assert.match(result.errors["rel.categories"] ?? "", /Archived items/);
    const links = await query(env, "SELECT category_id FROM project_category_assignments WHERE project_id = ?", [proj]);
    assert.deepEqual(links, [], "the project was not linked to the archived category");
  });

  test("the same race for a single reference (a machine's primary service is archived meanwhile): refused", async () => {
    const svc = expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(service("test-race-primary")))).id;
    const machine = expectOk(await createItem(ctxOf(env, t.editor), machineSpec, formOf({ slug: "test-race-machine", "en.name": "Test Race Machine" }))).id;
    const archive = await holding([[`SELECT id FROM services WHERE id = ? FOR UPDATE`, [svc]]]);
    const save = updateItem(
      ctxOf(env, t.editor),
      machineSpec,
      machine,
      formOf({ slug: "test-race-machine", "en.name": "Test Race Machine", primaryServiceId: svc, lockVersion: String(await version("machines", machine)) }),
    );
    assert.equal(await stillWaiting(save), true, "the save waits for the service's lock");
    await archive.run(ARCHIVE_SQL("services"), [svc]);
    await archive.commit();
    const result = await save;
    assert.equal(result.kind, "invalid", JSON.stringify(result));
    assert.equal((await query(env, "SELECT primary_service_id AS s FROM machines WHERE id = ?", [machine]))[0].s, null);
  });

  test("a project is not restored while its category is archived (archive the project, then the category); audited", async () => {
    const cat = expectOk(await createItem(ctxOf(env, t.editor), categorySpec, formOf(category("demo-restore-cat")))).id;
    const proj = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("demo-restore-project", { "rel.categories": [cat] })))).id;
    const rules = LIFECYCLE_RULES.project ?? {};
    expectOk(await setItemArchived(ctxOf(env, t.admin), projectSpec, proj, true, await version("projects", proj), rules));
    // No active project uses the category now, so it may be archived.
    expectOk(await setItemArchived(ctxOf(env, t.admin), categorySpec, cat, true, await version("project_categories", cat), LIFECYCLE_RULES.project_category ?? {}));
    const refused = await setItemArchived(ctxOf(env, t.admin), projectSpec, proj, false, await version("projects", proj), rules);
    assert.equal(refused.kind, "refused", JSON.stringify(refused));
    if (refused.kind === "refused") assert.match(refused.message, /archived category .*Demo demo-restore-cat.*Restore it first/);
    assert.equal((await query(env, "SELECT publication_status AS s FROM projects WHERE id = ?", [proj]))[0].s, "archived");
    const [event] = await auditOf(env, "project", proj);
    assert.deepEqual([event.action, event.outcome], ["project.restore", "failed"]);
    // Restore the category first, then the project.
    expectOk(await setItemArchived(ctxOf(env, t.admin), categorySpec, cat, false, await version("project_categories", cat), LIFECYCLE_RULES.project_category ?? {}));
    expectOk(await setItemArchived(ctxOf(env, t.admin), projectSpec, proj, false, await version("projects", proj), rules));
  });
});

describe("finding 4: two creates at once", () => {
  test("two items created at the same moment both join the order (no false “slug already used”)", async () => {
    // Both creates read their snapshot, then wait for the collection's order; the held lock lines them up exactly so.
    const order = await holding([["SELECT `key` FROM entity_orderings WHERE `key` = 'services' FOR UPDATE", []]]);
    const a = createItem(ctxOf(env, t.editor), serviceSpec, formOf(service("test-together-a")));
    const b = createItem(ctxOf(env, t.admin), serviceSpec, formOf(service("test-together-b")));
    assert.equal(await stillWaiting(Promise.all([a, b])), true, "both wait for the order's lock");
    await order.commit();
    const results = await Promise.all([a, b]);
    for (const result of results) assert.equal(result.kind, "ok", JSON.stringify(result));
    const positions = await query<{ position: number }>(
      env,
      "SELECT i.position FROM entity_ordering_items i JOIN services s ON s.id = i.entity_id WHERE i.ordering_key = 'services' AND s.slug IN ('test-together-a', 'test-together-b')",
    );
    assert.equal(new Set(positions.map((p) => p.position)).size, 2, JSON.stringify(positions));
  });
});

describe("finding 7: archive and restore change the order a page showed", () => {
  test("a move sent from an order page opened before an archive is refused as stale", async () => {
    const ids = [];
    for (const slug of ["test-order-a", "test-order-b", "test-order-c"]) ids.push(expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(service(slug)))).id);
    const page = (await loadOrder(env.deps.db, "service"))!;
    expectOk(await setItemArchived(ctxOf(env, t.admin), serviceSpec, ids[1], true, await version("services", ids[1])));
    const move = await moveItem(ctxOf(env, t.editor), "service", ids[2], "up", page.lockVersion);
    assert.equal(move.kind, "stale", "the page showed b between a and c; c would now pass a instead");
    const fresh = (await loadOrder(env.deps.db, "service"))!;
    expectOk(await moveItem(ctxOf(env, t.editor), "service", ids[2], "up", fresh.lockVersion));
  });
});

describe("finding 8: refusals are audited", () => {
  test("saving an archived item, archiving a category in use, and clearing a flag on an archived project", async () => {
    const svc = expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(service("test-audit-archived")))).id;
    expectOk(await setItemArchived(ctxOf(env, t.admin), serviceSpec, svc, true, await version("services", svc)));
    const save = await updateItem(ctxOf(env, t.editor), serviceSpec, svc, formOf({ ...service("test-audit-archived"), lockVersion: String(await version("services", svc)) }));
    assert.equal(save.kind, "archived");
    let [event] = await auditOf(env, "service", svc);
    assert.deepEqual([event.action, event.outcome], ["service.update", "failed"]);
    assert.match(event.summary, /archived/);

    const cat = expectOk(await createItem(ctxOf(env, t.editor), categorySpec, formOf(category("demo-audit-cat")))).id;
    const proj = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("demo-audit-project", { "rel.categories": [cat] })))).id;
    const blocked = await setItemArchived(ctxOf(env, t.admin), categorySpec, cat, true, await version("project_categories", cat), LIFECYCLE_RULES.project_category ?? {});
    assert.equal(blocked.kind, "refused");
    [event] = await auditOf(env, "project_category", cat);
    assert.deepEqual([event.action, event.outcome], ["project_category.archive", "failed"]);
    assert.match(event.summary, /active project/);

    expectOk(await addProjectFlag(ctxOf(env, t.reviewer), proj, "hidden", ""));
    const [{ created_at }] = await query<{ created_at: Date }>(env, "SELECT created_at FROM project_flags WHERE project_id = ? AND flag = 'hidden'", [proj]);
    expectOk(await setItemArchived(ctxOf(env, t.admin), projectSpec, proj, true, await version("projects", proj), LIFECYCLE_RULES.project ?? {}));
    const clear = await clearProjectFlag(ctxOf(env, t.owner), proj, "hidden", String(new Date(created_at).getTime()), "Checked with the test owner.");
    assert.equal(clear.kind, "invalid");
    [event] = await auditOf(env, "project", proj);
    assert.deepEqual([event.action, event.outcome], ["project.restriction_clear", "failed"]);
    assert.match(event.summary, /archived project/);
  });
});
