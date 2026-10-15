/**
 * Core CMS (A3) — page records on a real MariaDB: an English-only draft, Arabic added later, completeness and review
 * states, the stale save, duplicate and reserved slugs, archive and restore, fixed pages (type fixed at creation, never
 * archived, one record each), legal pages (legal.edit, the review label, no invented wording) and the robots /
 * canonical / sitemap fields that need seo.advanced. Test data only.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loadEditorItem } from "../../src/server/cms/engine.ts";
import { pageSpec } from "../../src/server/cms/kinds.ts";
import { createPage, newPageChoices, registeredSystemKeys, setPageArchived, updatePage } from "../../src/server/cms/pages.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { auditOf, ctxOf, expectOk, formOf, query, team, type Team } from "./cms-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_pages");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);

describe("a generic page", () => {
  let id = "";

  test("is created in English only, as a non-public draft, with its author recorded from the session", async () => {
    const result = expectOk(await createPage(ctxOf(env, t.editor), { kind: "generic" }, formOf({ slug: "test-careers", "en.title": "Test Careers Page" })));
    id = result.id;
    const [row] = await query(env, "SELECT page_type, slug, publication_status, draft_status, lock_version, created_by, updated_by, published_revision_id FROM pages WHERE id = ?", [id]);
    assert.deepEqual(row, {
      page_type: "generic",
      slug: "test-careers",
      publication_status: "unpublished",
      draft_status: "draft",
      lock_version: 0,
      created_by: t.editor.user.id,
      updated_by: t.editor.user.id,
      published_revision_id: null,
    });
    const item = await loadEditorItem(db(), pageSpec, id);
    assert.deepEqual(item?.states, { en: "draft", ar: "missing" });
    const [event] = await auditOf(env, "page", id);
    assert.equal(event.action, "page.create");
    assert.equal(event.outcome, "success");
    assert.equal(event.actorUserId, t.editor.user.id);
  });

  test("Arabic is added later on the same record (one identity, two translations)", async () => {
    const result = expectOk(
      await updatePage(ctxOf(env, t.editor), id, formOf({ lockVersion: "0", slug: "test-careers", "en.title": "Test Careers Page", "ar.title": "صفحة وظائف تجريبية" })),
    );
    assert.equal(result.lockVersion, 1);
    const rows = await query(env, "SELECT locale, title, translation_status FROM page_translations WHERE page_id = ? ORDER BY locale", [id]);
    assert.deepEqual(rows, [
      { locale: "ar", title: "صفحة وظائف تجريبية", translation_status: "draft" },
      { locale: "en", title: "Test Careers Page", translation_status: "draft" },
    ]);
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM pages"))[0].n, 1);
  });

  test("marking both languages complete, then changing English asks for an Arabic review — unless it does not affect Arabic", async () => {
    const base = { slug: "test-careers", "ar.title": "صفحة وظائف تجريبية", "en.complete": "1", "ar.complete": "1" };
    expectOk(await updatePage(ctxOf(env, t.editor), id, formOf({ ...base, lockVersion: "1", "en.title": "Test Careers Page" })));
    assert.deepEqual((await loadEditorItem(db(), pageSpec, id))?.states, { en: "complete", ar: "complete" });
    expectOk(await updatePage(ctxOf(env, t.editor), id, formOf({ ...base, lockVersion: "2", "en.title": "Test Careers Page (typo fixed)", otherUnaffected: "1" })));
    assert.deepEqual((await loadEditorItem(db(), pageSpec, id))?.states, { en: "complete", ar: "complete" });
    expectOk(await updatePage(ctxOf(env, t.editor), id, formOf({ ...base, lockVersion: "3", "en.title": "Test Careers and Training" })));
    assert.deepEqual((await loadEditorItem(db(), pageSpec, id))?.states, { en: "complete", ar: "needs_review" });
  });

  test("a language can't be marked complete while a required field is empty: field missing and language incomplete are told apart", async () => {
    const result = await updatePage(ctxOf(env, t.editor), id, formOf({ lockVersion: "4", slug: "test-careers", "en.title": "Test Careers and Training", "ar.navLabel": "وظائف", "ar.complete": "1" }));
    assert.equal(result.kind, "invalid");
    if (result.kind !== "invalid") return;
    assert.equal(result.errors["ar.title"], "Required before Arabic can be marked complete.");
    assert.match(result.errors["ar.complete"], /^Arabic is incomplete: Title is missing\.$/);
    // Saved without the tick, the same Arabic text is kept as an incomplete draft (never required to save).
    expectOk(
      await updatePage(
        ctxOf(env, t.editor),
        id,
        formOf({ lockVersion: "4", slug: "test-careers", "en.title": "Test Careers and Training", "en.complete": "1", "ar.navLabel": "وظائف", otherUnaffected: "1" }),
      ),
    );
    assert.deepEqual((await loadEditorItem(db(), pageSpec, id))?.states, { en: "complete", ar: "incomplete" });
  });

  test("invalid content is refused field by field: markup, control characters, overlong text", async () => {
    const result = await updatePage(
      ctxOf(env, t.editor),
      id,
      formOf({ lockVersion: "5", slug: "test-careers", "en.title": "<script>alert(1)</script>", "ar.title": "عنوان‮معكوس", "en.navLabel": "x".repeat(81) }),
    );
    assert.equal(result.kind, "invalid");
    if (result.kind !== "invalid") return;
    assert.match(result.errors["en.title"], /HTML or markup/);
    assert.match(result.errors["ar.title"], /direction-control/);
    assert.match(result.errors["en.navLabel"], /at most 80/);
  });

  test("a stale form is refused, audited, and changes nothing", async () => {
    const before = await query(env, "SELECT lock_version FROM pages WHERE id = ?", [id]);
    const result = await updatePage(ctxOf(env, t.admin), id, formOf({ lockVersion: "1", slug: "test-careers", "en.title": "An older form's title" }));
    assert.deepEqual(result, { kind: "stale" });
    assert.deepEqual(await query(env, "SELECT lock_version FROM pages WHERE id = ?", [id]), before);
    const [title] = await query(env, "SELECT title FROM page_translations WHERE page_id = ? AND locale = 'en'", [id]);
    assert.equal(title.title, "Test Careers and Training");
    const [event] = await auditOf(env, "page", id);
    assert.equal(event.action, "page.update");
    assert.equal(event.outcome, "failed");
    assert.match(event.summary, /changed after the form was opened/);
  });

  test("a duplicate slug is refused (an archived page keeps its slug too)", async () => {
    const result = await createPage(ctxOf(env, t.editor), { kind: "generic" }, formOf({ slug: "test-careers", "en.title": "Another Test Page" }));
    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") assert.match(result.errors.slug, /already used/);
  });

  test("reserved routes, locale-like segments and malformed slugs are refused, never rewritten", async () => {
    for (const slug of ["about", "admin", "api", "en", "ar", "privacy", "sitemap", "fr", "de-at", "media", "not-found"]) {
      const result = await createPage(ctxOf(env, t.editor), { kind: "generic" }, formOf({ slug, "en.title": "Test" }));
      assert.equal(result.kind, "invalid", slug);
      if (result.kind === "invalid") assert.ok(result.errors.slug, slug);
    }
    const spaced = await createPage(ctxOf(env, t.editor), { kind: "generic" }, formOf({ slug: "Test Careers 2", "en.title": "Test" }));
    assert.equal(spaced.kind, "invalid");
    if (spaced.kind === "invalid") assert.match(spaced.errors.slug, /Suggestion: test-careers-2/);
    for (const slug of ["_next", "über", "a--b", "-a", "a-", "x".repeat(81), "sitemap.xml"]) {
      const result = await createPage(ctxOf(env, t.editor), { kind: "generic" }, formOf({ slug, "en.title": "Test" }));
      assert.equal(result.kind, "invalid", slug);
    }
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM pages"))[0].n, 1);
  });

  test("the slug is changed only when asked, and the change is audited", async () => {
    const [{ lock_version }] = await query<{ lock_version: number }>(env, "SELECT lock_version FROM pages WHERE id = ?", [id]);
    expectOk(
      await updatePage(
        ctxOf(env, t.editor),
        id,
        formOf({ lockVersion: String(lock_version), slug: "test-jobs", "en.title": "Test Careers and Training", "en.complete": "1", "ar.navLabel": "وظائف" }),
      ),
    );
    const events = await auditOf(env, "page", id);
    const change = events.find((e) => e.action === "page.slug_change");
    assert.ok(change);
    assert.match(change.summary, /from test-careers to test-jobs/);
  });

  test("an Editor cannot archive; an Admin archives (kept, read-only, out of the active list) and restores to a draft", async () => {
    const version = async () => Number((await query(env, "SELECT lock_version AS v FROM pages WHERE id = ?", [id]))[0].v);
    const denied = await setPageArchived(ctxOf(env, t.editor), id, true, await version());
    assert.equal(denied.kind, "denied");
    assert.equal((await auditOf(env, "page", id))[0].outcome, "denied");
    const stale = await setPageArchived(ctxOf(env, t.admin), id, true, (await version()) - 1);
    assert.equal(stale.kind, "stale");
    expectOk(await setPageArchived(ctxOf(env, t.admin), id, true, await version()));
    const [row] = await query(env, "SELECT publication_status, draft_status, archived_by FROM pages WHERE id = ?", [id]);
    assert.deepEqual(row, { publication_status: "archived", draft_status: "none", archived_by: t.admin.user.id });
    assert.equal((await query(env, "SELECT COUNT(*) AS n FROM page_translations WHERE page_id = ?", [id]))[0].n, 2);
    const edit = await updatePage(ctxOf(env, t.admin), id, formOf({ lockVersion: String(await version()), slug: "test-jobs", "en.title": "Edited while archived" }));
    assert.deepEqual(edit, { kind: "archived" });
    expectOk(await setPageArchived(ctxOf(env, t.admin), id, false, await version()));
    const [restored] = await query(env, "SELECT publication_status, draft_status, archived_at, archived_by FROM pages WHERE id = ?", [id]);
    assert.deepEqual(restored, { publication_status: "unpublished", draft_status: "draft", archived_at: null, archived_by: null });
    const actions = (await auditOf(env, "page", id)).map((e) => e.action);
    assert.ok(actions.includes("page.archive") && actions.includes("page.restore"));
  });
});

describe("fixed pages of the site", () => {
  test("an Editor may not register a system page; an Admin registers it once, without a slug", async () => {
    const denied = await createPage(ctxOf(env, t.editor), { kind: "system", key: "about" }, formOf({ "en.title": "Test About Record" }));
    assert.equal(denied.kind, "denied");
    const { id } = expectOk(await createPage(ctxOf(env, t.admin), { kind: "system", key: "about" }, formOf({ "en.title": "Test About Record", slug: "ignored-for-fixed-pages" })));
    const [row] = await query(env, "SELECT page_type, system_key, slug FROM pages WHERE id = ?", [id]);
    assert.deepEqual(row, { page_type: "system", system_key: "about", slug: null });
    const again = await createPage(ctxOf(env, t.owner), { kind: "system", key: "about" }, formOf({ "en.title": "A second about record" }));
    assert.equal(again.kind, "invalid");
    assert.ok((await registeredSystemKeys(db())).has("about"));
    assert.deepEqual(
      newPageChoices(t.editor.permissions, await registeredSystemKeys(db())).fixed.map((c) => c.key),
      [],
      "Editors are offered generic pages only",
    );
    const unknown = await createPage(ctxOf(env, t.owner), { kind: "system", key: "careers" }, formOf({ "en.title": "Test" }));
    assert.equal(unknown.kind, "invalid");
  });

  test("a fixed page is never archived and its type cannot be changed by a form", async () => {
    const [{ id, lock_version }] = await query<{ id: string; lock_version: number }>(env, "SELECT id, lock_version FROM pages WHERE system_key = 'about'");
    const archived = await setPageArchived(ctxOf(env, t.owner), id, true, lock_version);
    assert.equal(archived.kind, "refused");
    expectOk(await updatePage(ctxOf(env, t.owner), id, formOf({ lockVersion: String(lock_version), "en.title": "Test About Record", pageType: "generic", systemKey: "terms", slug: "x" })));
    const [row] = await query(env, "SELECT page_type, system_key, slug, publication_status FROM pages WHERE id = ?", [id]);
    assert.deepEqual(row, { page_type: "system", system_key: "about", slug: null, publication_status: "unpublished" });
  });

  test("a legal page needs legal.edit, carries the review label and starts empty (no invented wording)", async () => {
    const editor = await createPage(ctxOf(env, t.editor), { kind: "system", key: "privacy" }, formOf({ "en.title": "Test Privacy" }));
    assert.equal(editor.kind, "denied");
    const { id } = expectOk(await createPage(ctxOf(env, t.admin), { kind: "system", key: "privacy" }, formOf({ "en.title": "Test Privacy Draft", effectiveDate: "2027-01-31" })));
    const [row] = await query(env, "SELECT page_type, requires_legal_review, CAST(effective_date AS CHAR) AS effective_date FROM pages WHERE id = ?", [id]);
    assert.deepEqual(row, { page_type: "legal", requires_legal_review: 1, effective_date: "2027-01-31" });
    const translations = await query(env, "SELECT locale, title, nav_label, seo_title, seo_description FROM page_translations WHERE page_id = ?", [id]);
    assert.deepEqual(translations, [{ locale: "en", title: "Test Privacy Draft", nav_label: null, seo_title: null, seo_description: null }]);
    const editorEdit = await updatePage(ctxOf(env, t.editor), id, formOf({ lockVersion: "0", "en.title": "Changed by an editor" }));
    assert.equal(editorEdit.kind, "denied");
    const [event] = await auditOf(env, "page", id);
    assert.equal(event.outcome, "denied");
    assert.match(event.summary, /legal\.edit/);
    const invalidDate = await updatePage(ctxOf(env, t.admin), id, formOf({ lockVersion: "0", "en.title": "Test Privacy Draft", effectiveDate: "2027-02-30" }));
    assert.equal(invalidDate.kind, "invalid");
  });
});

describe("per-record SEO", () => {
  test("titles and descriptions are per language; robots, canonical and sitemap need seo.advanced", async () => {
    const { id } = expectOk(
      await createPage(
        ctxOf(env, t.editor),
        { kind: "generic" },
        formOf({ slug: "test-seo-page", "en.title": "Test SEO Page", "en.seoTitle": "Test SEO title", "ar.seoDescription": "وصف تجريبي", "seo.advanced": "1", "seo.robotsIndex": "1", "seo.robotsFollow": "1", "seo.inSitemap": "1" }),
      ),
    );
    // The Editor's create above sent the advanced fields unchanged (the defaults): accepted. Changing them is not.
    const noindex = await updatePage(ctxOf(env, t.editor), id, formOf({ lockVersion: "0", slug: "test-seo-page", "en.title": "Test SEO Page", "seo.advanced": "1", "seo.robotsFollow": "1", "seo.inSitemap": "1" }));
    assert.equal(noindex.kind, "denied");
    const [event] = await auditOf(env, "page", id);
    assert.match(event.summary, /seo\.advanced/);
    expectOk(await updatePage(ctxOf(env, t.admin), id, formOf({ lockVersion: "0", slug: "test-seo-page", "en.title": "Test SEO Page", "seo.advanced": "1", "seo.robotsFollow": "1", "seo.canonicalOverride": "/en/test-seo-page" })));
    const [row] = await query(env, "SELECT robots_index, robots_follow, in_sitemap, canonical_override FROM pages WHERE id = ?", [id]);
    assert.deepEqual(row, { robots_index: 0, robots_follow: 1, in_sitemap: 0, canonical_override: "/en/test-seo-page" });
    // An Editor's save without the advanced fields leaves them as they are.
    expectOk(await updatePage(ctxOf(env, t.editor), id, formOf({ lockVersion: "1", slug: "test-seo-page", "en.title": "Test SEO Page 2", "en.seoTitle": "x".repeat(120) })));
    assert.deepEqual((await query(env, "SELECT robots_index, in_sitemap FROM pages WHERE id = ?", [id]))[0], { robots_index: 0, in_sitemap: 0 });
    const long = await updatePage(ctxOf(env, t.editor), id, formOf({ lockVersion: "2", slug: "test-seo-page", "en.title": "Test", "en.seoDescription": "x".repeat(321) }));
    assert.equal(long.kind, "invalid");
    const external = await updatePage(ctxOf(env, t.admin), id, formOf({ lockVersion: "2", slug: "test-seo-page", "en.title": "Test", "seo.advanced": "1", "seo.canonicalOverride": "https://example.com/x" }));
    assert.equal(external.kind, "invalid");
  });
});
