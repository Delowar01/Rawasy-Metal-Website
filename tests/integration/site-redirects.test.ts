/**
 * Site controls (A6) — redirects on a real MariaDB: normalised sources, unique; never an address a page answers (the
 * site's own pages and files, today's services and projects, the working records' slugs); targets that are pages of the
 * website, or working pages, services and projects (not archived), in the source's language; no loop and no chain;
 * edits and (de)activation decided on the redirect's version, reactivation checked again; 308 / 307 only; permissions
 * (Owner, Admin manage; every role reads) and the audit trail. Stored and validated only: nothing resolves before A9.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { services as staticServices } from "../../src/content/services.ts";
import { projects as staticProjects } from "../../src/content/projects.ts";
import { listRedirects, readRedirect, saveRedirect, setRedirectActive, type RedirectInput } from "../../src/server/site/redirects.ts";
import { setItemArchived } from "../../src/server/cms/engine.ts";
import { serviceSpec } from "../../src/server/cms/kinds.ts";
import { auditOf, ctxOf, query, team, type Team } from "./cms-helpers.ts";
import { genericPage, service } from "./builder-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";
import type { SiteResult } from "../../src/server/site/common.ts";
import { expectKind, issuesOf, siteChange } from "./site-helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("site_redirects");
  t = await team(env);
});
after(async () => env?.close());

const input = (fields: Partial<RedirectInput> = {}): RedirectInput => ({
  id: "",
  expectedVersion: 0,
  sourcePath: "/en/old-page",
  targetType: "path",
  targetPath: "/en/about",
  targetId: "",
  statusCode: 308,
  note: "",
  ...fields,
});

const create = (fields: Partial<RedirectInput> = {}, actor = t.admin) => saveRedirect(siteChange(env, actor), input(fields));

describe("creating", () => {
  test("an Admin creates a permanent redirect; it is listed, audited, and stored in the normalised form", async () => {
    const created = expectKind(await create({ sourcePath: " /en/old-page/ ", note: "Test note" }), "ok");
    const stored = await readRedirect(env.deps.db, created.id);
    assert.equal(stored?.sourcePath, "/en/old-page");
    assert.equal(stored?.targetAddress, "/en/about");
    assert.equal(stored?.statusCode, 308);
    assert.equal(stored?.isActive, true);
    const [row] = await query(env, "SELECT reason, last_hit_at FROM redirects WHERE id = ?", [created.id]);
    assert.equal(row.reason, "manual");
    assert.equal(row.last_hit_at, null, "nothing resolves before the cutover");
    const list = await listRedirects(env.deps.db, { state: "all", q: "old-page", page: 1 });
    assert.equal(list.total, 1);
    const [event] = await auditOf(env, "redirect", created.id);
    assert.equal(event.action, "redirect.create");
  });

  test("addresses are normalised or refused with a reason", async () => {
    const cases: [string, RegExp][] = [
      ["/en/old-page", /already has a redirect/],
      ["/EN/x", /Start the address with the language/],
      ["/fr/x", /Start the address with the language/],
      ["https://www.rawasymetal.com/en/x", /without the domain/],
      ["/en/x?ref=1", /Leave out the query/],
      ["/en/x#part", /Leave out the query/],
      ["/old-page", /Start the address with the language/],
      ["/en", /Add the old page's address/],
      ["/en//x", /empty parts/],
      ["/en/a b", /spaces/],
      ["/en/%E0%A4", /can't be read/],
      ["/en/../admin", /can't be read/],
    ];
    for (const [source, pattern] of cases) assert.match(issuesOf(await create({ sourcePath: source })), pattern, source);
    const arabic = expectKind(await create({ sourcePath: "/ar/مشاريع-قديمة", targetPath: "/ar/projects" }), "ok");
    assert.equal((await readRedirect(env.deps.db, arabic.id))?.sourcePath, `/ar/${encodeURIComponent("مشاريع-قديمة")}`);
  });

  test("never an address a page answers: the site's pages and files, today's services and projects, working records", async () => {
    const svc = await service(env, t.owner);
    const [svcRow] = await query<{ slug: string }>(env, "SELECT slug FROM services WHERE id = ?", [svc.id]);
    const page = await genericPage(env, t.owner);
    const [pageRow] = await query<{ slug: string }>(env, "SELECT slug FROM pages WHERE id = ?", [page.id]);
    const cases: [string, RegExp][] = [
      ["/en/about", /website's own pages or files/],
      ["/ar/contact", /website's own pages or files/],
      ["/en/admin", /website's own pages or files/],
      ["/en/media", /website's own pages or files/],
      [`/ar/services/${staticServices[0].slug}`, /A service uses this address/],
      [`/en/projects/${staticProjects[0].slug}`, /A project uses this address/],
      [`/en/services/${svcRow.slug}`, /A service uses this address/],
      [`/en/${pageRow.slug}`, /A page uses this address/],
    ];
    for (const [source, pattern] of cases) assert.match(issuesOf(await create({ sourcePath: source })), pattern, source);
    expectKind(await create({ sourcePath: "/en/services/old-laser" }), "ok");
    expectKind(await create({ sourcePath: "/en/about/team" }), "ok");
  });

  test("an address target must be a page of the website; 308 and 307 only", async () => {
    assert.match(issuesOf(await create({ sourcePath: "/en/t1", targetPath: "/en/nowhere" })), /isn't a page of the website/);
    assert.match(issuesOf(await create({ sourcePath: "/en/t1", targetPath: "https://example.com/" })), /without the domain/);
    expectKind(await create({ sourcePath: "/en/t2", targetPath: "/en" }), "ok");
    expectKind(await create({ sourcePath: "/en/t3", targetPath: `/ar/services/${staticServices[1].slug}`, statusCode: 307 }), "ok");
    assert.equal((await saveRedirect(siteChange(env, t.admin), { ...input({ sourcePath: "/en/t4" }), statusCode: 301 as 308 })).kind, "invalid");
  });

  test("record targets: a working service (its address in the source's language); an archived one is refused", async () => {
    const svc = await service(env, t.owner);
    const [row] = await query<{ slug: string }>(env, "SELECT slug FROM services WHERE id = ?", [svc.id]);
    const ok = expectKind(await create({ sourcePath: "/ar/old-service", targetType: "service", targetPath: "", targetId: svc.id }), "ok");
    const stored = await readRedirect(env.deps.db, ok.id);
    assert.equal(stored?.targetAddress, `/ar/services/${row.slug}`);
    assert.match(stored?.targetLabel ?? "", /^Service: Test Builder Service/);
    assert.match(issuesOf(await create({ sourcePath: "/en/x1", targetType: "service", targetPath: "", targetId: "" })), /Choose the service/);
    // Archived later: the list warns; a new redirect to it is refused.
    const [{ lock_version }] = await query<{ lock_version: number }>(env, "SELECT lock_version FROM services WHERE id = ?", [svc.id]);
    assert.equal((await setItemArchived(ctxOf(env, t.owner), serviceSpec, svc.id, true, Number(lock_version))).kind, "ok");
    assert.match((await readRedirect(env.deps.db, ok.id))?.warning ?? "", /archived/);
    assert.match(issuesOf(await create({ sourcePath: "/en/x2", targetType: "service", targetPath: "", targetId: svc.id })), /archived/);
  });

  test("no chain: a target that is itself an active redirect's source is refused", async () => {
    // Only possible with an address a page answers today (which a source can never be): put one in directly.
    await query(env, "INSERT INTO redirects (id, source_path, target_type, target_path, status_code, is_active, reason) VALUES (?, '/en/clients', 'path', '/en/about', 308, 1, 'import')", ["01JA6CHA1NTEST0000000000AA"]);
    assert.match(issuesOf(await create({ sourcePath: "/en/old-clients", targetPath: "/en/clients" })), /redirected itself/);
    await query(env, "DELETE FROM redirects WHERE id = ?", ["01JA6CHA1NTEST0000000000AA"]);
  });
});

describe("editing and (de)activating", () => {
  test("edits are decided on the version; deactivation always; reactivation checks again", async () => {
    const created = expectKind(await create({ sourcePath: "/en/edit-me" }), "ok");
    const edited = expectKind(await saveRedirect(siteChange(env, t.owner), input({ id: created.id, expectedVersion: 0, sourcePath: "/en/edit-me", targetPath: "/en/contact", statusCode: 307 })), "ok");
    assert.equal(edited.lockVersion, 1);
    assert.match(expectKind(await saveRedirect(siteChange(env, t.admin), input({ id: created.id, expectedVersion: 0, sourcePath: "/en/edit-me" })), "stale").message, /changed after you opened it/);
    const off = expectKind(await setRedirectActive(siteChange(env, t.admin), { id: created.id, expectedVersion: 1, active: false }), "ok");
    assert.equal((await readRedirect(env.deps.db, created.id))?.isActive, false);
    // A working page takes the source's address meanwhile: reactivation is refused.
    const page = await genericPage(env, t.owner);
    await query(env, "UPDATE pages SET slug = 'edit-me' WHERE id = ?", [page.id]);
    assert.match(issuesOf(await setRedirectActive(siteChange(env, t.admin), { id: created.id, expectedVersion: off.lockVersion, active: true })), /A page uses this address/);
    assert.equal((await readRedirect(env.deps.db, created.id))?.isActive, false);
    const events = await auditOf(env, "redirect", created.id);
    assert.deepEqual(events.map((e) => [e.action, e.outcome]).slice(0, 3), [["redirect.activate", "failed"], ["redirect.deactivate", "success"], ["redirect.update", "failed"]]);
  });

  test("an Editor and a Reviewer may read but not change redirects (audited denied)", async () => {
    for (const actor of [t.editor, t.reviewer]) {
      assert.equal((await create({ sourcePath: "/en/by-editor" }, actor)).kind, "denied");
      assert.ok(actor.permissions.has("redirects.view"));
    }
    const [first] = (await listRedirects(env.deps.db, { state: "active", q: "", page: 1 })).rows;
    assert.equal((await setRedirectActive(siteChange(env, t.editor), { id: first.id, expectedVersion: first.lockVersion, active: false })).kind, "denied");
    const denied = await query(env, "SELECT * FROM audit_events WHERE entity_type = 'redirect' AND outcome = 'denied'");
    assert.equal(denied.length, 3);
  });

  test("the list: server-side filters and pages", async () => {
    const active = await listRedirects(env.deps.db, { state: "active", q: "", page: 1 });
    const inactive = await listRedirects(env.deps.db, { state: "inactive", q: "", page: 1 });
    const all = await listRedirects(env.deps.db, { state: "all", q: "", page: 1 });
    assert.equal(active.total + inactive.total, all.total);
    assert.ok(inactive.rows.every((r) => !r.isActive));
    const percent = await listRedirects(env.deps.db, { state: "all", q: "%", page: 1 });
    assert.ok(percent.total < all.total && percent.rows.every((r) => r.sourcePath.includes("%") || r.targetPath?.includes("%")), "a % is matched literally");
    const arabic = await listRedirects(env.deps.db, { state: "all", q: "مشاريع", page: 1 });
    assert.equal(arabic.total, 1, "an Arabic fragment finds the encoded address");
  });
});

describe("A6 review corrections", () => {
  test("L2: a stored redirect that a later change elsewhere breaks says so (a slug given to its old address; a target redirected since)", async () => {
    const db = env.deps.db;
    // An old address no page answers today, then a service is given that slug (A3 never reads redirects).
    const a = expectKind(await create({ sourcePath: "/en/services/test-later-service", targetPath: "/en/contact" }), "ok");
    assert.equal((await readRedirect(db, a.id))?.warning, null);
    const svc = await service(env, t.owner);
    await query(env, "UPDATE services SET slug = 'test-later-service' WHERE id = ?", [svc.id]);
    assert.match((await readRedirect(db, a.id))?.warning ?? "", /^A service uses this address now: the page wins/);
    // A redirect to a service whose slug later becomes another active redirect's old address: two steps.
    const svc2 = await service(env, t.owner);
    const b = expectKind(await create({ sourcePath: "/en/test-old-b", targetType: "service", targetPath: "", targetId: svc2.id }), "ok");
    const c = expectKind(await create({ sourcePath: "/en/services/test-renamed", targetPath: "/en/about" }), "ok");
    assert.equal((await readRedirect(db, b.id))?.warning, null);
    await query(env, "UPDATE services SET slug = 'test-renamed' WHERE id = ?", [svc2.id]);
    assert.match((await readRedirect(db, b.id))?.warning ?? "", /redirected itself \(two steps\)/);
    assert.match((await readRedirect(db, c.id))?.warning ?? "", /^A service uses this address now/);
    // The list shows the same, and an inactive redirect no longer counts as a step.
    const listed = (await listRedirects(db, { state: "all", q: "test-old-b", page: 1 })).rows[0];
    assert.match(listed.warning ?? "", /two steps/);
    expectKind(await setRedirectActive(siteChange(env, t.admin), { id: c.id, expectedVersion: 0, active: false }), "ok");
    assert.equal((await readRedirect(db, b.id))?.warning, null);
  });

  test("I2: saving a redirect never waits on another redirect held by an edit in progress", async () => {
    const one = expectKind(await create({ sourcePath: "/en/test-held-one" }), "ok");
    const two = expectKind(await create({ sourcePath: "/en/test-held-two" }), "ok");
    const held = await env.pool.getConnection();
    try {
      await held.query("BEGIN");
      await held.query("SELECT id FROM redirects WHERE id = ? FOR UPDATE", [one.id]);
      const saved = await Promise.race([
        saveRedirect(siteChange(env, t.admin), input({ id: two.id, expectedVersion: 0, sourcePath: "/en/test-held-two", targetPath: "/en/contact" })),
        new Promise<"waited">((resolve) => setTimeout(() => resolve("waited"), 4000)),
      ]);
      assert.notEqual(saved, "waited", "the save waited on the other redirect's lock");
      expectKind(saved as SiteResult, "ok");
    } finally {
      await held.query("ROLLBACK");
      held.release();
    }
  });

  test("L4: a search cut inside an emoji (a lone surrogate) is read, never thrown", async () => {
    for (const q of [`${"a".repeat(199)}\uD83D`, `\uDE00old`, `old\uD83D\uDE00`]) {
      const list = await listRedirects(env.deps.db, { state: "all", q, page: 1 });
      assert.ok(list.total >= 0, q);
    }
  });
});
