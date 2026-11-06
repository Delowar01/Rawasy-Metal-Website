/**
 * A8 — the independent security review's findings, each with a test that fails on the code before the fixes (`d123462`):
 * M1 a legal page's publish, unpublish and rollback need a re-authentication within 10 minutes (A1-SECURITY-RBAC §3.7);
 * L1 a reusable section a live version still shows can't be archived; L2 discarding keeps "draft" when a field this
 * person may not change still differs from the live version; L3 concurrent creates and first publications by different
 * people, and an archive overlapping a collection order's publication, never deadlock (counted on this file's own
 * connections, so the suite's other files can't blur the count); L4 a first publication tells about a redirect from its
 * new address; and the Info items: a rollback's missing legal review is audited, the audit log's action filter takes `_`
 * literally. Test data only ("Test …", "Demo …").
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Pool, PoolConnection } from "mysql2/promise";
import { createItem, setItemArchived, updateItem } from "../../src/server/cms/engine.ts";
import { clientSpec, projectSpec } from "../../src/server/cms/kinds.ts";
import { createReusable, setReusableArchived } from "../../src/server/builder/reusable.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { listAudit, parseAuditQuery } from "../../src/server/audit/viewer.ts";
import { discardChanges, publish, rollback, unpublish, type PublishingChange } from "../../src/server/publishing/workflow.ts";
import type { Actor } from "../../src/server/auth/types.ts";
import { ctxOf, expectOk, formOf, query, team, type Fields, type Team } from "./cms-helpers.ts";
import { changeOf, systemPage } from "./builder-helpers.ts";
import { meta, setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("pub_review");
  t = await team(env);
});
after(async () => env?.close());

const change = (actor: Actor, deps = env.deps): PublishingChange => ({ deps, actor, meta: meta() });
const version = async (table: string, id: string, column = "id") => Number((await query(env, `SELECT lock_version AS v FROM ${table} WHERE ${column} = ?`, [id]))[0].v);
const state = async (table: string, id: string) => (await query<{ publication_status: string; draft_status: string }>(env, `SELECT publication_status, draft_status FROM ${table} WHERE id = ?`, [id]))[0];
const client = (name: string, extra: Fields = {}): Fields => ({ slug: name.toLowerCase().replace(/\s+/g, "-"), "en.name": name, "ar.name": `عميل ${name.length}`, "en.complete": "1", "ar.complete": "1", ...extra });
const project = (title: string, extra: Fields = {}): Fields => ({
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  "en.title": title,
  "en.summary": `${title} summary.`,
  "ar.title": `مشروع ${title.length}`,
  "ar.summary": "ملخص تجريبي.",
  "en.complete": "1",
  "ar.complete": "1",
  ...extra,
});
/** The same person, signed in longer ago than the 10-minute step-up window. */
const aged = (actor: Actor): Actor => ({ ...actor, session: { ...actor.session, reauthenticatedAt: new Date(env.deps.clock().getTime() - 11 * 60_000) } });

describe("M1: a legal page's publication needs a recent re-authentication", () => {
  let privacy: string;
  before(async () => {
    privacy = (await systemPage(env, t.owner, "privacy")).id;
  });

  test("publish, unpublish and rollback by an Owner signed in over 10 minutes ago are refused (step-up) and audited", async () => {
    const stale = aged(t.owner);
    const v = await version("pages", privacy);
    const published = await publish(change(stale), "page", privacy, v, { legalReviewer: "Test Counsel" });
    assert.equal(published.kind, "step_up", JSON.stringify(published));
    assert.equal((await unpublish(change(stale), "page", privacy, v)).kind, "step_up");
    assert.equal((await rollback(change(stale), "page", privacy, "01KA0000000000000000000000", v, { legalReviewer: "Test Counsel" })).kind, "step_up");
    const denied = await query<{ action: string; summary: string }>(env, "SELECT action, summary FROM audit_events WHERE entity_id = ? AND outcome = 'denied' ORDER BY id", [privacy]);
    assert.deepEqual(denied.map((d) => d.action), ["page.publish", "page.unpublish", "page.rollback"]);
    for (const row of denied) assert.match(row.summary, /legal\.publish confirmed within the last 10 minutes/);
    assert.equal(await version("pages", privacy), v, "nothing changed");
  });

  test("a recent sign-in goes on to the page's own checks; other records need no step-up", async () => {
    const fresh = await publish(change(t.owner), "page", privacy, await version("pages", privacy), { legalReviewer: "Test Counsel" });
    assert.notEqual(fresh.kind, "step_up", JSON.stringify(fresh));
    const id = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(client("Demo Step Client")))).id;
    expectOk(await publish(change(aged(t.owner)), "client", id, await version("clients", id)));
  });

  test("a rollback of a legal page without its reviewer is refused and audited (Info)", async () => {
    // An earlier published version of the page (its content is not read: the legal gate comes first).
    const earlier = "01KA0000000000000000RVW001";
    await query(env, "INSERT INTO revisions (id, entity_type, entity_id, revision_number, kind, schema_version, snapshot, snapshot_sha256, is_sealed, created_at) VALUES (?, 'page', ?, 99, 'publish', 1, '{}', UNHEX(SHA2('legal', 256)), 1, NOW(3))", [earlier, privacy]);
    const v = await version("pages", privacy);
    const result = await rollback(change(t.owner), "page", privacy, earlier, v, {});
    assert.equal(result.kind, "refused", JSON.stringify(result));
    assert.match((result as { message: string }).message, /legal text has been reviewed/);
    const failed = await query<{ summary: string }>(env, "SELECT summary FROM audit_events WHERE entity_id = ? AND action = 'page.rollback' AND outcome = 'failed'", [privacy]);
    assert.ok(failed.some((f) => /legal review was not confirmed/.test(f.summary)), JSON.stringify(failed));
    assert.equal(await version("pages", privacy), v);
  });
});

describe("L1: a reusable section a live version shows can't be archived", () => {
  test("unused in every working layout but linked by a page's live version: refused, audited, nothing changed", async () => {
    const created = await createReusable(changeOf(env, t.admin), { name: "Test Live Reusable", blockType: "generic.heading" });
    assert.equal(created.kind, "ok");
    const id = (created as { id: string }).id;
    // The live version of a page links it; that page's working copy detached it since (no working section links it).
    const page = (await systemPage(env, t.owner, "about")).id;
    await query(env, "INSERT INTO content_references (scope, source_type, source_id, source_section_id, field_path, target_type, target_id) VALUES ('published', 'page', ?, NULL, 'layout.0.reusable', 'reusable_section', ?)", [page, id]);
    const v = await version("reusable_sections", id);
    const refused = await setReusableArchived(changeOf(env, t.admin), { id, expectedVersion: v, archived: true });
    assert.equal(refused.kind, "denied", JSON.stringify(refused));
    assert.match((refused as { message: string }).message, /still shown by the live version of 1 page/);
    assert.equal(await version("reusable_sections", id), v);
    const audit = await query<{ summary: string }>(env, "SELECT summary FROM audit_events WHERE entity_id = ? AND action = 'reusable_section.archive' AND outcome = 'failed'", [id]);
    assert.match(audit[0].summary, /still shown by the live version of 1 page/);
    // Once that live version no longer links it, the archive goes through.
    await query(env, "DELETE FROM content_references WHERE scope = 'published' AND target_id = ?", [id]);
    expectOk(await setReusableArchived(changeOf(env, t.admin), { id, expectedVersion: v, archived: true }));
  });
});

describe("L2: discarding keeps a draft when a field the person may not change still differs", () => {
  test("an Editor discards after an Admin's noindex change: the item stays 'Published · changes in draft'", async () => {
    const id = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("Demo Discard Project")))).id;
    expectOk(await publish(change(t.admin), "project", id, await version("projects", id)));
    env.clock.advance(1000);
    // The Admin turns indexing off (seo.advanced) and edits the title; the Editor may not change robots settings.
    expectOk(
      await updateItem(
        ctxOf(env, t.admin),
        projectSpec,
        id,
        formOf(project("Demo Discard Project Edited", { slug: "demo-discard-project", lockVersion: String(await version("projects", id)), "seo.advanced": "1", "seo.robotsFollow": "1", "seo.inSitemap": "1" })),
      ),
    );
    env.clock.advance(1000);
    const discarded = expectOk(await discardChanges(change(t.editor), "project", id, await version("projects", id)));
    assert.match(discarded.summary, /stays a draft/);
    const s = await state("projects", id);
    assert.deepEqual([s.publication_status, s.draft_status], ["published", "draft"], "not 'none': the working copy still differs from the live version");
    const title = await query<{ title: string }>(env, "SELECT title FROM project_translations WHERE project_id = ? AND locale = 'en'", [id]);
    assert.equal(title[0].title, "Demo Discard Project", "what the Editor may change went back");
    // The Admin can discard all of it: then it is the live version again.
    env.clock.advance(1000);
    expectOk(await discardChanges(change(t.admin), "project", id, await version("projects", id)));
    assert.equal((await state("projects", id)).draft_status, "none");
  });
});

/** A pool whose connections count the deadlocks InnoDB reports to them (this file's transactions only). */
function countingPool(pool: Pool) {
  const counted = new WeakSet<object>();
  const counter = { deadlocks: 0 };
  const wrap = (connection: PoolConnection) => {
    if (counted.has(connection)) return connection;
    counted.add(connection);
    for (const method of ["query", "execute"] as const) {
      const original = (connection[method] as (...args: unknown[]) => Promise<unknown>).bind(connection);
      Object.defineProperty(connection, method, {
        configurable: true,
        writable: true,
        value: async (...args: unknown[]) => {
          try {
            return await original(...args);
          } catch (error) {
            if ((error as { errno?: number }).errno === 1213) counter.deadlocks += 1;
            throw error;
          }
        },
      });
    }
    return connection;
  };
  const proxy = new Proxy(pool, {
    get(target, prop) {
      if (prop === "getConnection") return async () => wrap(await target.getConnection());
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { pool: proxy as Pool, counter };
}

describe("L3: no deadlock between concurrent creates, first publications, and an archive with an order's publication", () => {
  test("three people create and first-publish records at the same moment, 12 rounds: no deadlock at all", async () => {
    const { pool, counter } = countingPool(env.pool);
    const deps = { ...env.deps, pool, db: dbFor(pool) };
    const ctx = (actor: Actor) => ({ ...ctxOf(env, actor), deps });
    for (let round = 0; round < 12; round++) {
      const people = [t.owner, t.admin, t.editor];
      const ids = await Promise.all(people.map(async (actor, i) => expectOk(await createItem(ctx(actor), clientSpec, formOf(client(`Demo Race ${round} ${i}`)))).id));
      const publishers = [t.owner, t.admin];
      await Promise.all(
        ids.slice(0, 2).map(async (id, i) => {
          const result = await publish(change(publishers[i], deps), "client", id, await version("clients", id));
          assert.equal(result.kind, "ok", JSON.stringify(result));
        }),
      );
    }
    assert.equal(counter.deadlocks, 0, `${counter.deadlocks} deadlocks (each was settled by inTransaction's single retry)`);
  });

  test("archiving a live record while its collection's order is published, 12 rounds: no deadlock", async () => {
    const { pool, counter } = countingPool(env.pool);
    const deps = { ...env.deps, pool, db: dbFor(pool) };
    for (let round = 0; round < 12; round++) {
      const id = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(client(`Demo Archive Race ${round}`)))).id;
      expectOk(await publish(change(t.admin), "client", id, await version("clients", id)));
      env.clock.advance(1000);
      const [archived, ordered] = await Promise.all([
        setItemArchived({ ...ctxOf(env, t.admin), deps }, clientSpec, id, true, await version("clients", id)),
        publish(change(t.owner, deps), "ordering", "clients", await version("entity_orderings", "clients", "`key`")),
      ]);
      assert.equal(archived.kind, "ok", JSON.stringify(archived));
      assert.ok(["ok", "stale", "refused"].includes(ordered.kind), JSON.stringify(ordered));
    }
    assert.equal(counter.deadlocks, 0, `${counter.deadlocks} deadlocks`);
  });
});

describe("L4: a first publication checks a redirect from its new address", () => {
  test("project A moves from 'a' to 'b' (redirect a → A); project B, published first as 'a', is told the redirect stops applying", async () => {
    const a = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("Demo First Address")))).id;
    expectOk(await publish(change(t.admin), "project", a, await version("projects", a)));
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, a, formOf(project("Demo First Address", { slug: "demo-second-address", lockVersion: String(await version("projects", a)) }))));
    expectOk(await publish(change(t.admin), "project", a, await version("projects", a)));
    const b = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("Demo Taking Address", { slug: "demo-first-address" })))).id;
    const published = expectOk(await publish(change(t.admin), "project", b, await version("projects", b)));
    assert.ok(published.warnings?.some((w) => /\/en\/projects\/demo-first-address stops applying/.test(w)), JSON.stringify(published.warnings));
    const redirect = await query<{ is_active: number; target_project_id: string }>(env, "SELECT is_active, target_project_id FROM redirects WHERE source_path = '/en/projects/demo-first-address'");
    assert.deepEqual([Number(redirect[0].is_active), redirect[0].target_project_id], [1, a], "someone else's redirect is told about, not changed (A6: marked; pages win at A9)");
  });
});

describe("Info: the audit log's action filter", () => {
  test("a kind of action takes '_' literally (not a LIKE wildcard)", async () => {
    await query(env, "INSERT INTO audit_events (occurred_at, request_id, actor_type, action, outcome, summary) VALUES (NOW(3), '01KA0000000000000000AUDIT1', 'system', 'client.publish', 'success', 'Test wildcard one')");
    const loose = await listAudit(dbFor(env.pool), parseAuditQuery({ action: "c_ient" }, ""));
    assert.equal(loose.rows.filter((r) => r.summary === "Test wildcard one").length, 0, "c_ient is not client");
    const exact = await listAudit(dbFor(env.pool), parseAuditQuery({ action: "client" }, ""));
    assert.ok(exact.rows.some((r) => r.summary === "Test wildcard one"));
  });
});
