/**
 * Core CMS (A3 Correction 1) — a service's featured projects on a real MariaDB. The invariant: every
 * service_featured_projects (service, project) row has its project_services (project, service) row at every commit.
 * The service side already checked it on its own save; a project's save could drop the service afterwards (or at the
 * same moment) and leave the service featuring a project that no longer lists it. Now the project's save is refused —
 * the service's curated list is never changed silently — and both sides decide on locking reads, so two saves at the
 * same moment commit exactly one valid result whichever takes its locks first.
 *
 * The races are made deterministic as in `cms-review.test.ts`: a row lock held on a separate connection stops the first
 * save after its checks (at its translation row, with its other locks taken), the second save is shown to be waiting
 * for the first, then the held lock is released. Test data only ("Test …", "Demo …").
 */
import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import type { Actor } from "../../src/server/auth/types.ts";
import { createItem, setItemArchived, updateItem } from "../../src/server/cms/engine.ts";
import { projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { auditOf, ctxOf, expectOk, formOf, query, team, type Fields, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_featured");
  t = await team(env);
});
after(async () => env?.close());

/** The invariant, as one query over the whole database (true when no featured project misses its listing row). */
const INVARIANT = `SELECT NOT EXISTS (
    SELECT 1 FROM service_featured_projects sfp
      LEFT JOIN project_services ps ON ps.project_id = sfp.project_id AND ps.service_id = sfp.service_id
     WHERE ps.project_id IS NULL
  ) AS holds`;
const invariantHolds = async () => Number((await query<{ holds: number }>(env, INVARIANT))[0].holds) === 1;
afterEach(async () => assert.equal(await invariantHolds(), true, "every featured project still lists its service"));

const version = async (table: string, id: string) => Number((await query(env, `SELECT lock_version AS v FROM ${table} WHERE id = ?`, [id]))[0].v);
const serviceForm = (slug: string, extra: Fields = {}): Fields => ({ slug, serviceGroup: "metal", iconKey: "fabrication", "en.name": `Test ${slug}`, ...extra });
const projectForm = (slug: string, extra: Fields = {}): Fields => ({ slug, "en.title": `Demo ${slug}`, "en.summary": "A demo summary for the featured tests.", ...extra });

const newService = async (slug: string) => expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(serviceForm(slug)))).id;
const newProject = async (slug: string, services: string[]) =>
  expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(projectForm(slug, { "rel.services": services })))).id;

/** A service saved with these featured projects (the form is the full state, as the editor sends it). */
const saveService = async (actor: Actor, id: string, slug: string, featured: string[]) =>
  updateItem(ctxOf(env, actor), serviceSpec, id, formOf(serviceForm(slug, { lockVersion: String(await version("services", id)), "rel.featuredProjects": featured })));
/** A project saved with these services. */
const saveProject = async (actor: Actor, id: string, slug: string, services: string[], extra: Fields = {}) =>
  updateItem(ctxOf(env, actor), projectSpec, id, formOf(projectForm(slug, { lockVersion: String(await version("projects", id)), "rel.services": services, ...extra })));

/** Whether the pair's two rows exist. */
const pair = async (serviceId: string, projectId: string) => ({
  featured: (await query(env, "SELECT 1 FROM service_featured_projects WHERE service_id = ? AND project_id = ?", [serviceId, projectId])).length === 1,
  listed: (await query(env, "SELECT 1 FROM project_services WHERE project_id = ? AND service_id = ?", [projectId, serviceId])).length === 1,
});
const servicesOf = async (projectId: string) =>
  (await query<{ service_id: string }>(env, "SELECT service_id FROM project_services WHERE project_id = ? ORDER BY position", [projectId])).map((r) => r.service_id);

/** A transaction on its own connection that holds the row locks of its statements until `commit` (the other side). */
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

const REFUSAL = /^This project is currently featured by “Test [a-z-]+”\. Remove it from that service's Featured projects first, then remove the service here\.$/;

describe("a project can't drop a service that features it", () => {
  test("sequential: refused (field message, nothing changed, audited), then allowed once the service stops featuring it", async () => {
    const service = await newService("test-seq-service");
    const project = await newProject("demo-seq-project", [service]);
    expectOk(await saveService(t.editor, service, "test-seq-service", [project]));
    assert.deepEqual(await pair(service, project), { featured: true, listed: true });

    const projectVersion = await version("projects", project);
    const refused = await saveProject(t.editor, project, "demo-seq-project", []);
    assert.equal(refused.kind, "invalid", JSON.stringify(refused));
    if (refused.kind === "invalid") {
      assert.match(refused.errors["rel.services"] ?? "", REFUSAL);
      assert.match(refused.errors["rel.services"] ?? "", /“Test test-seq-service”/);
      assert.deepEqual(Object.keys(refused.errors), ["rel.services"], "only the relation is refused");
    }
    assert.deepEqual(await pair(service, project), { featured: true, listed: true }, "both rows remain");
    assert.equal(await version("projects", project), projectVersion, "nothing was saved");

    const [event] = await auditOf(env, "project", project);
    assert.deepEqual([event.action, event.outcome, event.actorUserId], ["project.update", "failed", t.editor.user.id]);
    assert.match(event.summary, /^Refused: removing service “Test test-seq-service” \(test-seq-service\) from this project — it still features the project in its Featured projects\.$/);
    assert.ok(!event.summary.includes("A demo summary"), "no long content in the summary");
    assert.deepEqual(event.changes, { refused: [{ relation: "services", featuredBy: [service] }] });

    // The service stops featuring the project; the same removal then goes through.
    expectOk(await saveService(t.editor, service, "test-seq-service", []));
    expectOk(await saveProject(t.editor, project, "demo-seq-project", []));
    assert.deepEqual(await pair(service, project), { featured: false, listed: false });
  });

  test("several services feature it: all are named, nothing changes", async () => {
    const a = await newService("test-multi-a");
    const b = await newService("test-multi-b");
    const project = await newProject("demo-multi-project", [a, b]);
    expectOk(await saveService(t.editor, a, "test-multi-a", [project]));
    expectOk(await saveService(t.editor, b, "test-multi-b", [project]));
    const refused = await saveProject(t.admin, project, "demo-multi-project", []);
    assert.equal(refused.kind, "invalid");
    if (refused.kind === "invalid") {
      assert.equal(
        refused.errors["rel.services"],
        "This project is currently featured by “Test test-multi-a” and “Test test-multi-b”. Remove it from those services' Featured projects first, then remove the services here.",
      );
    }
    const [event] = await auditOf(env, "project", project);
    assert.match(event.summary, /^Refused: removing 2 services “Test test-multi-a” \(test-multi-a\) and “Test test-multi-b” \(test-multi-b\) from this project — they still feature/);
    assert.deepEqual(await servicesOf(project), [a, b]);
  });
});

describe("two saves at the same moment: exactly one valid result commits", () => {
  test("race A — the service features the project first, the project's removal of the service waits and is refused", async () => {
    const service = await newService("test-race-a-service");
    const project = await newProject("demo-race-a-project", [service]);
    // The service save takes its locks (its root, a share lock on the newly featured project, the pair), then stops at
    // its translation row, which another connection holds.
    const hold = await holding("SELECT service_id FROM service_translations WHERE service_id = ? AND locale = 'en' FOR UPDATE", [service]);
    const serviceSave = saveService(t.editor, service, "test-race-a-service", [project]);
    assert.equal(await stillWaiting(serviceSave), true, "the service save waits at its translation row, after its checks");
    const projectSave = saveProject(t.admin, project, "demo-race-a-project", []);
    assert.equal(await stillWaiting(projectSave), true, "the project save waits for the service save's lock on the project row");
    await hold.commit();
    const [s, p] = await Promise.all([serviceSave, projectSave]);
    assert.equal(s.kind, "ok", JSON.stringify(s));
    assert.equal(p.kind, "invalid", JSON.stringify(p));
    if (p.kind === "invalid") assert.match(p.errors["rel.services"] ?? "", REFUSAL);
    assert.deepEqual(await pair(service, project), { featured: true, listed: true });
    const [event] = await auditOf(env, "project", project);
    assert.deepEqual([event.action, event.outcome], ["project.update", "failed"]);
  });

  test("race B — the project drops the service first, the service's new feature waits and is refused", async () => {
    const service = await newService("test-race-b-service");
    const project = await newProject("demo-race-b-project", [service]);
    // The project save takes its root (FOR UPDATE) and makes its checks, then stops at its translation row. The service
    // save starts after it: its snapshot still shows the project listing the service, but it waits for the project row.
    const hold = await holding("SELECT project_id FROM project_translations WHERE project_id = ? AND locale = 'en' FOR UPDATE", [project]);
    const projectSave = saveProject(t.admin, project, "demo-race-b-project", []);
    assert.equal(await stillWaiting(projectSave), true, "the project save waits at its translation row, after its checks");
    const serviceSave = saveService(t.editor, service, "test-race-b-service", [project]);
    assert.equal(await stillWaiting(serviceSave), true, "the service save waits for the project row");
    await hold.commit();
    const [p, s] = await Promise.all([projectSave, serviceSave]);
    assert.equal(p.kind, "ok", JSON.stringify(p));
    assert.equal(s.kind, "invalid", JSON.stringify(s));
    if (s.kind === "invalid") assert.match(s.errors["rel.featuredProjects"] ?? "", /no longer list this service/);
    assert.deepEqual(await pair(service, project), { featured: false, listed: false });
    const [event] = await auditOf(env, "service", service);
    assert.deepEqual([event.action, event.outcome], ["service.update", "failed"]);
    assert.match(event.summary, /^Refused: featured project “Demo demo-race-b-project” \(demo-race-b-project\) does not list this service in its own record\.$/);
  });

  test("ten unscripted races: one save wins each time and the invariant holds after every round", async () => {
    for (let round = 0; round < 10; round++) {
      const service = await newService(`test-free-${round}`);
      const project = await newProject(`demo-free-${round}`, [service]);
      const [s, p] = await Promise.all([saveService(t.editor, service, `test-free-${round}`, [project]), saveProject(t.admin, project, `demo-free-${round}`, [])]);
      assert.deepEqual([s.kind, p.kind].sort(), ["invalid", "ok"], `round ${round}: ${JSON.stringify([s, p])}`);
      const state = await pair(service, project);
      assert.deepEqual(state, s.kind === "ok" ? { featured: true, listed: true } : { featured: false, listed: false });
      assert.equal(await invariantHolds(), true, `round ${round}`);
    }
  });
});

describe("ordinary relation editing is unchanged", () => {
  test("removing a service that does not feature the project, reordering, and an unchanged list all save", async () => {
    const featuring = await newService("test-ctl-featuring");
    const other = await newService("test-ctl-other");
    const third = await newService("test-ctl-third");
    const project = await newProject("demo-ctl-project", [featuring, other, third]);
    expectOk(await saveService(t.editor, featuring, "test-ctl-featuring", [project]));

    expectOk(await saveProject(t.editor, project, "demo-ctl-project", [featuring, third]));
    assert.deepEqual(await servicesOf(project), [featuring, third], "an unrelated service is removed");
    expectOk(await saveProject(t.editor, project, "demo-ctl-project", [third, featuring]));
    assert.deepEqual(await servicesOf(project), [third, featuring], "a reorder keeps the featuring service");
    const [reordered] = (await auditOf(env, "project", project)).filter((e) => e.action === "project.relations_change");
    assert.match(reordered.summary, /Services \(\+0, −0, reordered\)/);
    expectOk(await saveProject(t.editor, project, "demo-ctl-project", [third, featuring], { "en.title": "Demo ctl project renamed" }));
    assert.deepEqual(await servicesOf(project), [third, featuring], "an unchanged list with another change");
    assert.deepEqual(await pair(featuring, project), { featured: true, listed: true });
    const outcomes = (await auditOf(env, "project", project)).map((e) => e.outcome);
    assert.ok(!outcomes.includes("failed"), "no refusal among these saves");
  });

  test("archived services follow the archived-target policy; one that features the project is restored first", async () => {
    const featuring = await newService("test-arch-featuring");
    const plain = await newService("test-arch-plain");
    const project = await newProject("demo-arch-project", [featuring, plain]);
    expectOk(await saveService(t.editor, featuring, "test-arch-featuring", [project]));
    for (const id of [featuring, plain]) expectOk(await setItemArchived(ctxOf(env, t.admin), serviceSpec, id, true, await version("services", id)));

    expectOk(await saveProject(t.editor, project, "demo-arch-project", [featuring, plain], { "en.title": "Demo arch project renamed" }));
    assert.deepEqual(await servicesOf(project), [featuring, plain], "archived services may stay linked");
    expectOk(await saveProject(t.editor, project, "demo-arch-project", [featuring]));
    assert.deepEqual(await servicesOf(project), [featuring], "an archived service that features nothing is removed as before");

    const refused = await saveProject(t.editor, project, "demo-arch-project", []);
    assert.equal(refused.kind, "invalid");
    if (refused.kind === "invalid") {
      assert.equal(
        refused.errors["rel.services"],
        "This project is currently featured by “Test test-arch-featuring” (archived). Restore that service and remove the project from its Featured projects first, then remove the service here.",
      );
    }
    const readded = await saveProject(t.editor, project, "demo-arch-project", [featuring, plain]);
    assert.equal(readded.kind, "invalid", "an archived service is not linked anew");
    if (readded.kind === "invalid") assert.match(readded.errors["rel.services"] ?? "", /Archived items can stay linked/);
    assert.deepEqual(await pair(featuring, project), { featured: true, listed: true });
  });
});
