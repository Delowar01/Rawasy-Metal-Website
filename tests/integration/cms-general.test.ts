/**
 * Core CMS (A3) — rules every content type shares, on a real MariaDB: list search (English, normalized Arabic, slug,
 * wildcards taken literally), filters, sorting and bounded pagination; the dashboard's real counts; attribution from the
 * session only (forged actor, status or version fields change nothing); nothing can become public (the database
 * refuses it); concurrent saves, archives and moves (one wins, the other is told the content changed); an id of another
 * type or another record changes nothing; an ended session or a disabled account changes nothing. Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { revokeSession, SessionEndedError } from "../../src/server/auth/sessions.ts";
import { createItem, setItemArchived, updateItem } from "../../src/server/cms/engine.ts";
import { addProjectFlag } from "../../src/server/cms/flags.ts";
import { categorySpec, clientSpec, industrySpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { countItems, listHref, listItems, parseListParams } from "../../src/server/cms/list.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { users } from "../../src/server/db/schema.ts";
import { eq } from "drizzle-orm";
import { actorFor, createUser } from "./helpers.ts";
import { auditOf, ctxOf, expectOk, formOf, query, team, type Fields, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_general");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const list = (type: Parameters<typeof parseListParams>[0], params: Record<string, string>) => listItems(db(), type, parseListParams(type, params));
const version = async (table: string, id: string) => Number((await query(env, `SELECT lock_version AS v FROM ${table} WHERE id = ?`, [id]))[0].v);

describe("lists: search, filters, sorting and pagination", () => {
  const ids: string[] = [];
  before(async () => {
    for (let i = 1; i <= 30; i++) {
      const n = String(i).padStart(2, "0");
      const fields: Fields = { slug: `demo-client-${n}`, "en.name": `Demo Client ${n}`, ...(i % 3 === 0 ? { "ar.name": `شركة تجريبيّة رقم ${n}` } : {}), ...(i % 5 === 0 ? { isFeatured: "1" } : {}) };
      ids.push(expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(fields))).id);
      env.clock.advance(1000);
    }
    expectOk(await setItemArchived(ctxOf(env, t.admin), clientSpec, ids[0], true, 0));
  });

  test("pagination: 25 by default, bounded sizes, the last page clamps, never unlimited", async () => {
    const first = await list("client", {});
    assert.equal(first.total, 29);
    assert.equal(first.rows.length, 25);
    assert.equal(first.pages, 2);
    assert.equal((await list("client", { page: "2" })).rows.length, 4);
    assert.equal((await list("client", { page: "99" })).params.page, 2);
    assert.equal((await list("client", { size: "5" })).params.size, 25);
    assert.equal((await list("client", { size: "100000" })).params.size, 25);
    assert.equal((await list("client", { size: "10" })).rows.length, 10);
    assert.equal((await list("client", { page: "-1" })).params.page, 1);
  });

  test("the archived filter shows only archived items; all shows both", async () => {
    const archived = await list("client", { status: "archived" });
    assert.deepEqual(archived.rows.map((r) => r.id), [ids[0]]);
    assert.equal(archived.rows[0].archived, true);
    assert.equal((await list("client", { status: "all" })).total, 30);
    assert.equal((await list("client", { status: "bogus" })).total, 29);
  });

  test("search: English text, slug and Arabic compared without diacritics or letter-form differences", async () => {
    assert.deepEqual((await list("client", { q: "client 07" })).rows.map((r) => r.slug), ["demo-client-07"]);
    assert.deepEqual((await list("client", { q: "demo-client-1" })).rows.length, 10);
    // Stored "تجريبيّة" (with shadda, ta marbuta); searched "تجريبيه" (without).
    assert.equal((await list("client", { q: "تجريبيه رقم 09" })).total, 1);
    assert.equal((await list("client", { q: "%" })).total, 0);
    assert.equal((await list("client", { q: "_" })).total, 0);
    assert.equal((await list("client", { q: "x".repeat(500) })).params.q.length, 100);
  });

  test("language filters: Arabic missing, Arabic not complete", async () => {
    assert.equal((await list("client", { lang: "ar-missing" })).total, 19);
    assert.equal((await list("client", { lang: "ar-incomplete" })).total, 29);
    assert.equal((await list("client", { lang: "en-missing" })).total, 0);
  });

  test("featured filter and sorting by title, slug and site order", async () => {
    assert.equal((await list("client", { featured: "1" })).total, 6);
    const byTitle = await list("client", { sort: "title", size: "100" });
    assert.equal(byTitle.rows[0].title.en, "Demo Client 02");
    const byOrder = await list("client", { sort: "order", size: "100" });
    assert.deepEqual(
      byOrder.rows.map((r) => r.position),
      [...byOrder.rows.map((r) => r.position)].sort((a, b) => (a ?? 0) - (b ?? 0)),
    );
    const recent = await list("client", { sort: "updated" });
    assert.equal(recent.rows[0].id, ids[29]);
    assert.equal(recent.rows[0].updatedBy, "Test Editor");
  });

  test("list addresses keep only what differs from the defaults (bookmarkable)", () => {
    const params = parseListParams("client", { q: "demo", status: "archived", page: "3" });
    assert.equal(listHref("/admin/clients", params, { page: 2 }), "/admin/clients?q=demo&status=archived&page=2");
    assert.equal(listHref("/admin/clients", params, { status: "active" }), "/admin/clients?q=demo");
  });

  test("project filters: restricted (a blocking flag), category, featured", async () => {
    const cat = expectOk(await createItem(ctxOf(env, t.editor), categorySpec, formOf({ slug: "demo-cat", "en.label": "Demo Category" }))).id;
    const a = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf({ slug: "demo-a", "en.title": "Demo A", "en.summary": "A.", "rel.categories": [cat] }))).id;
    const b = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf({ slug: "demo-b", "en.title": "Demo B", "en.summary": "B.", isFeatured: "1" }))).id;
    expectOk(await addProjectFlag(ctxOf(env, t.reviewer), a, "restricted", ""));
    expectOk(await addProjectFlag(ctxOf(env, t.reviewer), b, "ai_watermark", ""));
    assert.deepEqual((await list("project", { restricted: "1" })).rows.map((r) => r.id), [a]);
    assert.deepEqual((await list("project", { category: cat })).rows.map((r) => r.id), [a]);
    assert.deepEqual((await list("project", { featured: "1" })).rows.map((r) => r.id), [b]);
    assert.equal((await list("project", { category: "not-an-id" })).total, 2);
    const counts = await countItems(db(), "project");
    assert.deepEqual([counts.active, counts.restricted, counts.arMissing], [2, 1, 2]);
  });

  test("dashboard counts are real: active, archived, missing and incomplete languages", async () => {
    const counts = await countItems(db(), "client");
    assert.deepEqual(
      [counts.active, counts.archived, counts.enMissing, counts.arMissing, counts.notComplete, counts.needsReview, counts.restricted],
      [29, 1, 0, 19, 29, 0, null],
    );
    const empty = await countItems(db(), "certificate");
    assert.deepEqual([empty.active, empty.archived], [0, 0]);
  });
});

describe("attribution and nothing public", () => {
  test("actor, status and version fields in a form are ignored: authority comes from the session", async () => {
    const forged: Fields = {
      slug: "test-forged",
      serviceGroup: "metal",
      iconKey: "fabrication",
      "en.name": "Test Forged",
      "en.tagline": "T",
      "en.summary": "S",
      "en.body": "B",
      createdBy: t.owner.user.id,
      updatedBy: t.owner.user.id,
      publicationStatus: "published",
      draftStatus: "in_review",
      lockVersion: "41",
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      publishedRevisionId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      "en.translationStatus": "complete",
    };
    const { id } = expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(forged)));
    assert.notEqual(id, "01ARZ3NDEKTSV4RRFFQ69G5FAV");
    const [row] = await query(env, "SELECT created_by, updated_by, publication_status, draft_status, lock_version, published_revision_id FROM services WHERE id = ?", [id]);
    assert.deepEqual(row, {
      created_by: t.editor.user.id,
      updated_by: t.editor.user.id,
      publication_status: "unpublished",
      draft_status: "draft",
      lock_version: 0,
      published_revision_id: null,
    });
    assert.equal((await query(env, "SELECT translation_status FROM service_translations WHERE service_id = ?", [id]))[0].translation_status, "draft");
    const [event] = await auditOf(env, "service", id);
    assert.equal(event.actorUserId, t.editor.user.id);
  });

  test("the database itself refuses a published state without a published revision (none exists in A3)", async () => {
    const [{ id }] = await query<{ id: string }>(env, "SELECT id FROM services LIMIT 1");
    await assert.rejects(env.pool.query("UPDATE services SET publication_status = 'published' WHERE id = ?", [id]), /CONSTRAINT|ck_services_live/i);
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM revisions"))[0].n, 0);
  });

  test("audit summaries name the item and what changed, never its long texts", async () => {
    const body = "Long confidential body text ".repeat(100);
    const { id } = expectOk(
      await createItem(
        ctxOf(env, t.editor),
        serviceSpec,
        formOf({ slug: "test-audit", serviceGroup: "metal", iconKey: "fabrication", "en.name": "Test Audit", "en.tagline": "T", "en.summary": "S", "en.body": body.trim() }),
      ),
    );
    for (const event of await auditOf(env, "service", id)) {
      assert.ok(!event.summary.includes("confidential"));
      assert.ok(!JSON.stringify(event.changes ?? {}).includes("confidential"));
    }
  });
});

describe("concurrency and boundaries", () => {
  const svc = (extra: Fields = {}): Fields => ({
    slug: "test-race",
    serviceGroup: "metal",
    iconKey: "fabrication",
    "en.name": "Test Race",
    "en.tagline": "T",
    "en.summary": "S",
    "en.body": "B",
    ...extra,
  });
  let id = "";
  before(async () => {
    id = expectOk(await createItem(ctxOf(env, t.editor), serviceSpec, formOf(svc()))).id;
  });

  test("two saves of the same version at once: one is saved, the other is refused as stale (no silent overwrite)", async () => {
    const v = String(await version("services", id));
    const results = await Promise.all([
      updateItem(ctxOf(env, t.editor), serviceSpec, id, formOf(svc({ lockVersion: v, "en.name": "Test Race A" }))),
      updateItem(ctxOf(env, t.admin), serviceSpec, id, formOf(svc({ lockVersion: v, "en.name": "Test Race B" }))),
    ]);
    assert.deepEqual(results.map((r) => r.kind).sort(), ["ok", "stale"]);
    const winner = results.findIndex((r) => r.kind === "ok");
    assert.equal((await query(env, "SELECT name FROM service_translations WHERE service_id = ? AND locale = 'en'", [id]))[0].name, winner === 0 ? "Test Race A" : "Test Race B");
  });

  test("a save and an archive of the same version at once: one applies, the other is refused", async () => {
    const v = await version("services", id);
    const [save, archive] = await Promise.all([
      updateItem(ctxOf(env, t.editor), serviceSpec, id, formOf(svc({ lockVersion: String(v), "en.name": "Test Race C" }))),
      setItemArchived(ctxOf(env, t.admin), serviceSpec, id, true, v),
    ]);
    assert.equal([save.kind, archive.kind].filter((k) => k === "ok").length, 1, `${save.kind} ${archive.kind}`);
    assert.ok(["stale", "archived"].includes(save.kind) || archive.kind === "stale");
    const [{ publication_status }] = await query(env, "SELECT publication_status FROM services WHERE id = ?", [id]);
    if (archive.kind === "ok") {
      assert.equal(publication_status, "archived");
      expectOk(await setItemArchived(ctxOf(env, t.admin), serviceSpec, id, false, v + 1));
    }
  });

  test("an id of another type or a made-up id changes nothing", async () => {
    const project = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf({ slug: "demo-idor", "en.title": "Demo", "en.summary": "D." }))).id;
    assert.deepEqual(await updateItem(ctxOf(env, t.editor), serviceSpec, project, formOf(svc({ lockVersion: "0" }))), { kind: "not_found" });
    assert.deepEqual(await setItemArchived(ctxOf(env, t.admin), industrySpec, project, true, 0), { kind: "not_found" });
    assert.deepEqual(await addProjectFlag(ctxOf(env, t.editor), id, "hidden", ""), { kind: "not_found" });
    assert.deepEqual(await updateItem(ctxOf(env, t.editor), serviceSpec, "../../etc", formOf(svc({ lockVersion: "0" }))), { kind: "not_found" });
    assert.equal((await query<{ n: number }>(env, "SELECT COUNT(*) AS n FROM project_flags WHERE project_id = ?", [id]))[0].n, 0, "no flag on a service id");
  });

  test("a signed-out session or a disabled account changes nothing (the A2 invariant holds for content)", async () => {
    const user = await createUser(env, { roles: ["editor"], name: "Test Leaving Editor" });
    const actor = await actorFor(env, user);
    await revokeSession(db(), actor.session.id, "logout", env.deps.clock());
    await assert.rejects(createItem(ctxOf(env, actor), serviceSpec, formOf(svc({ slug: "test-after-signout" }))), SessionEndedError);
    const second = await actorFor(env, user);
    await db().update(users).set({ status: "disabled" }).where(eq(users.id, user.id));
    await assert.rejects(updateItem(ctxOf(env, second), serviceSpec, id, formOf(svc({ lockVersion: String(await version("services", id)) }))), SessionEndedError);
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM services WHERE slug = 'test-after-signout'"))[0].n, 0);
  });
});
