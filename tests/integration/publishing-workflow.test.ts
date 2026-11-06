/**
 * A8 — revisions and publishing on a real MariaDB: every save leaves an immutable snapshot (a save that changes nothing
 * leaves none), history and comparison per language, restore as a new revision (never a rewrite), the review workflow
 * with the seeded keys (submit, request changes with a comment, withdraw, approve and publish, publish directly),
 * strict publication checks (languages, media, flags), the projection into `published_documents`, unpublish, archive,
 * discard, rollback to an earlier published version, the version check on every step, the reference index and the
 * redirects of a live slug change. Test data only ("Test …", "Demo …").
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createItem, setItemArchived, updateItem } from "../../src/server/cms/engine.ts";
import { addProjectFlag } from "../../src/server/cms/flags.ts";
import { clientSpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { changeLabel, diffSnapshots, localesOf } from "../../src/server/publishing/compare.ts";
import { usedBy } from "../../src/server/publishing/references.ts";
import { listRevisions, readRevision } from "../../src/server/publishing/revisions.ts";
import { discardChanges, publish, requestChanges, restoreRevision, rollback, submitForReview, unpublish, withdrawFromReview, type PublishingChange } from "../../src/server/publishing/workflow.ts";
import { auditOf, ctxOf, expectOk, formOf, query, seedMedia, team, type Fields, type Team } from "./cms-helpers.ts";
import { meta, setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("pub_workflow");
  t = await team(env);
});
after(async () => env?.close());

const db = () => dbFor(env.pool);
const change = (actor: Team[keyof Team]): PublishingChange => ({ deps: env.deps, actor, meta: meta() });
const version = async (table: string, id: string) => Number((await query(env, `SELECT lock_version AS v FROM ${table} WHERE id = ?`, [id]))[0].v);
const state = async (table: string, id: string) => (await query<{ publication_status: string; draft_status: string; published_revision_id: string | null }>(env, `SELECT publication_status, draft_status, published_revision_id FROM ${table} WHERE id = ?`, [id]))[0];
const doc = async (type: string, id: string) => (await query<{ revision_id: string; slug: string | null; document: unknown }>(env, "SELECT revision_id, slug, document FROM published_documents WHERE entity_type = ? AND entity_id = ?", [type, id]))[0];
const json = <T>(value: unknown): T => (typeof value === "string" ? JSON.parse(value) : value) as T;
const generation = async () => Number((await query<{ value: number }>(env, "SELECT value FROM cache_generation WHERE id = 1"))[0].value);

const client = (name: string, extra: Fields = {}): Fields => ({ slug: name.toLowerCase().replace(/\s+/g, "-"), "en.name": name, ...extra });
const complete = (name: string, arabic: string, extra: Fields = {}): Fields => client(name, { "ar.name": arabic, "en.complete": "1", "ar.complete": "1", ...extra });
const service = (name: string, extra: Fields = {}): Fields => ({
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  serviceGroup: "metal",
  iconKey: "laser-cutting",
  "en.name": name,
  "en.tagline": `${name} tagline`,
  "en.summary": `${name} summary for tests.`,
  "en.body": "First test paragraph.",
  "en.highlights": "Test point one",
  ...extra,
});
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

describe("revisions: every save leaves a snapshot", () => {
  let id: string;
  before(async () => {
    id = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(client("Demo Revision Client")))).id;
  });

  test("a create is revision 1, a change revision 2, a save that changes nothing adds none", async () => {
    let history = await listRevisions(db(), "client", id);
    assert.deepEqual(history.rows.map((r) => [r.number, r.kind]), [[1, "save"]]);
    assert.equal(history.rows[0].createdBy, t.editor.user.id);
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(client("Demo Revision Client", { lockVersion: "0", "ar.name": "عميل تجريبي" }))));
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(client("Demo Revision Client", { lockVersion: "1", "ar.name": "عميل تجريبي" }))));
    history = await listRevisions(db(), "client", id);
    assert.deepEqual(history.rows.map((r) => [r.number, r.kind]), [[2, "save"], [1, "save"]]);
    assert.deepEqual(history.rows[0].localesChanged, ["ar"]);
    assert.equal(history.rows[0].isSealed, false);
    const current = await query<{ current_revision_id: string }>(env, "SELECT current_revision_id FROM clients WHERE id = ?", [id]);
    assert.equal(current[0].current_revision_id, history.rows[0].id);
  });

  test("comparison is field by field and names the language", async () => {
    const history = await listRevisions(db(), "client", id);
    const older = await readRevision(db(), "client", id, history.rows[1].id);
    const newer = await readRevision(db(), "client", id, history.rows[0].id);
    const changes = diffSnapshots(older!.snapshot, newer!.snapshot);
    assert.deepEqual(localesOf(changes), ["ar"]);
    const labels = changes.map((c) => changeLabel(c, { before: older!.snapshot, after: newer!.snapshot, fieldLabel: (k) => clientSpec.fields.find((f) => f.key === k)?.label }));
    assert.ok(labels.some((l) => l === "Arabic"), labels.join(" | "));
  });

  test("a revision of another record is never read through this one", async () => {
    const other = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(client("Demo Other Client")))).id;
    const [otherRevision] = (await listRevisions(db(), "client", other)).rows;
    assert.equal(await readRevision(db(), "client", id, otherRevision.id), null);
    const result = await restoreRevision(change(t.editor), "client", id, otherRevision.id, await version("clients", id));
    assert.equal(result.kind, "refused");
  });

  test("restore writes a new revision from the old one; history is never rewritten", async () => {
    const history = await listRevisions(db(), "client", id);
    const first = history.rows[history.rows.length - 1];
    env.clock.advance(1000);
    const result = expectOk(await restoreRevision(change(t.editor), "client", id, first.id, await version("clients", id)));
    assert.match(result.summary, /Restored revision 1/);
    const after = await listRevisions(db(), "client", id);
    assert.equal(after.total, history.total + 1);
    assert.equal(after.rows[0].kind, "restore");
    assert.equal(after.rows[0].restoredFromNumber, 1);
    const ar = await query(env, "SELECT * FROM client_translations WHERE client_id = ? AND locale = 'ar'", [id]);
    assert.equal(ar.length, 0, "the Arabic text added later is gone again");
    const rev1 = await readRevision(db(), "client", id, first.id);
    assert.ok(rev1, "revision 1 is still there, unchanged");
  });

  test("a reviewer can't restore (no restore key); a stale version is refused and audited", async () => {
    const history = await listRevisions(db(), "client", id);
    const denied = await restoreRevision(change(t.reviewer), "client", id, history.rows[1].id, await version("clients", id));
    assert.equal(denied.kind, "denied");
    const stale = await restoreRevision(change(t.editor), "client", id, history.rows[1].id, (await version("clients", id)) - 1);
    assert.equal(stale.kind, "stale");
    const events = await auditOf(env, "client", id);
    assert.ok(events.some((e) => e.action === "client.restore_revision" && e.outcome === "denied"));
    assert.ok(events.some((e) => e.action === "client.restore_revision" && e.outcome === "failed"));
  });
});

describe("publishing: review, publish, unpublish, discard, rollback", () => {
  let id: string;
  before(async () => {
    id = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(client("Demo Publish Client")))).id;
  });

  test("an incomplete version can't be submitted; a complete one goes to review", async () => {
    const refused = await submitForReview(change(t.editor), "client", id, await version("clients", id));
    assert.equal(refused.kind, "refused");
    assert.ok(refused.kind === "refused" && refused.issues?.some((i) => i.code.startsWith("language.ar")), JSON.stringify(refused));
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(complete("Demo Publish Client", "عميل النشر", { lockVersion: String(await version("clients", id)) }))));
    const submitted = expectOk(await submitForReview(change(t.editor), "client", id, await version("clients", id), "Ready for a look."));
    assert.equal((await state("clients", id)).draft_status, "in_review");
    const history = await listRevisions(db(), "client", id);
    assert.equal(history.rows[0].kind, "submit");
    assert.equal(history.rows[0].isSealed, true);
    assert.equal(history.rows[0].message, "Ready for a look.");
    assert.ok(submitted.lockVersion > 0);
  });

  test("an editor can't publish; a reviewer must comment to send it back", async () => {
    const denied = await publish(change(t.editor), "client", id, await version("clients", id));
    assert.equal(denied.kind, "denied");
    const noComment = await requestChanges(change(t.reviewer), "client", id, await version("clients", id), "   ");
    assert.equal(noComment.kind, "refused");
    expectOk(await requestChanges(change(t.reviewer), "client", id, await version("clients", id), "Please check the Arabic name."));
    assert.equal((await state("clients", id)).draft_status, "draft");
    const comments = await query<{ body: string; status: string }>(env, "SELECT body, status FROM review_comments WHERE entity_id = ?", [id]);
    assert.deepEqual(comments, [{ body: "Please check the Arabic name.", status: "open" }]);
    const events = await auditOf(env, "client", id);
    const requested = events.find((e) => e.action === "client.request_changes");
    assert.ok(requested && !requested.summary.includes("Arabic name"), "the comment's words stay out of the audit summary");
  });

  test("withdraw returns a submission to draft; the reviewer approves and publishes someone else's submission", async () => {
    expectOk(await submitForReview(change(t.editor), "client", id, await version("clients", id)));
    expectOk(await withdrawFromReview(change(t.editor), "client", id, await version("clients", id)));
    assert.equal((await state("clients", id)).draft_status, "draft");
    const reviewerDirect = await publish(change(t.reviewer), "client", id, await version("clients", id));
    assert.equal(reviewerDirect.kind, "denied", "a reviewer publishes only what someone else submitted");
    expectOk(await submitForReview(change(t.editor), "client", id, await version("clients", id)));
    const before = await generation();
    env.clock.advance(1000);
    const published = expectOk(await publish(change(t.reviewer), "client", id, await version("clients", id)));
    const s = await state("clients", id);
    assert.deepEqual([s.publication_status, s.draft_status, s.published_revision_id], ["published", "none", published.revisionId]);
    const live = await doc("client", id);
    assert.equal(live.revision_id, published.revisionId);
    const document = json(live.document) as { texts: { en: { name: string }; ar: { name: string } }; root: Record<string, unknown> };
    assert.equal(document.texts.ar.name, "عميل النشر");
    assert.equal("translationStatus" in document.texts.en, false);
    assert.equal("sourceNote" in document.root, false, "provenance stays admin-only");
    assert.equal(await generation(), before + 1);
    const tags = await query<{ tag: string; generation: number }>(env, "SELECT tag, generation FROM cache_invalidations WHERE tag = ?", [`doc:client:${id}`]);
    assert.equal(Number(tags[0].generation), before + 1);
    const history = await listRevisions(db(), "client", id);
    assert.equal(history.rows[0].kind, "publish");
    assert.ok(history.rows[0].liveFrom);
    const comments = await query<{ status: string }>(env, "SELECT status FROM review_comments WHERE entity_id = ?", [id]);
    assert.deepEqual(comments.map((c) => c.status), ["resolved"]);
    const events = await auditOf(env, "client", id);
    const event = events.find((e) => e.action === "client.publish" && e.outcome === "success");
    assert.ok(event && /after review/.test(event.summary));
  });

  test("an edit after publishing is a draft; the live document stays the published revision", async () => {
    const live = await doc("client", id);
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(complete("Demo Publish Client Renamed", "عميل النشر", { slug: "demo-publish-client", lockVersion: String(await version("clients", id)) }))));
    const s = await state("clients", id);
    assert.deepEqual([s.publication_status, s.draft_status], ["published", "draft"]);
    assert.equal((await doc("client", id)).revision_id, live.revision_id);
    const nothing = await publish(change(t.admin), "client", id, (await version("clients", id)) - 1);
    assert.equal(nothing.kind, "stale");
  });

  test("discard returns the working copy to the live version", async () => {
    expectOk(await discardChanges(change(t.editor), "client", id, await version("clients", id)));
    const s = await state("clients", id);
    assert.deepEqual([s.publication_status, s.draft_status], ["published", "none"]);
    const en = await query<{ name: string }>(env, "SELECT name FROM client_translations WHERE client_id = ? AND locale = 'en'", [id]);
    assert.equal(en[0].name, "Demo Publish Client");
    const history = await listRevisions(db(), "client", id);
    assert.equal(history.rows[0].kind, "restore");
  });

  test("rollback publishes an earlier published version again", async () => {
    const firstLive = (await doc("client", id)).revision_id;
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(complete("Demo Publish Client Two", "عميل النشر ٢", { slug: "demo-publish-client", lockVersion: String(await version("clients", id)) }))));
    expectOk(await publish(change(t.admin), "client", id, await version("clients", id)));
    const secondLive = (await doc("client", id)).revision_id;
    assert.notEqual(secondLive, firstLive);
    const notPublished = (await listRevisions(db(), "client", id)).rows.find((r) => r.kind === "save")!;
    assert.equal((await rollback(change(t.admin), "client", id, notPublished.id, await version("clients", id))).kind, "refused", "only a published version can be rolled back to");
    assert.equal((await rollback(change(t.editor), "client", id, firstLive, await version("clients", id))).kind, "denied");
    env.clock.advance(1000);
    const rolled = expectOk(await rollback(change(t.admin), "client", id, firstLive, await version("clients", id)));
    const live = await doc("client", id);
    assert.equal(live.revision_id, rolled.revisionId);
    assert.equal((json(live.document) as { texts: { en: { name: string } } }).texts.en.name, "Demo Publish Client");
    const closed = await query<{ live_until: unknown }>(env, "SELECT live_until FROM revisions WHERE id = ?", [secondLive]);
    assert.ok(closed[0].live_until, "the replaced live version is closed (live_until)");
    const [top, next] = (await listRevisions(db(), "client", id)).rows;
    assert.deepEqual([top.kind, next.kind], ["publish", "restore"]);
  });

  test("unpublish takes it offline; archive of a published record takes it offline too", async () => {
    expectOk(await unpublish(change(t.admin), "client", id, await version("clients", id)));
    assert.equal(await doc("client", id), undefined);
    const s = await state("clients", id);
    assert.deepEqual([s.publication_status, s.draft_status, s.published_revision_id], ["unpublished", "draft", null]);
    assert.equal((await listRevisions(db(), "client", id)).rows[0].kind, "unpublish");
    expectOk(await publish(change(t.admin), "client", id, await version("clients", id)));
    assert.ok(await doc("client", id));
    expectOk(await setItemArchived(ctxOf(env, t.admin), clientSpec, id, true, await version("clients", id)));
    assert.equal(await doc("client", id), undefined);
    assert.equal((await state("clients", id)).publication_status, "archived");
    assert.equal((await listRevisions(db(), "client", id)).rows[0].kind, "archive");
    const archivedPublish = await publish(change(t.admin), "client", id, await version("clients", id));
    assert.equal(archivedPublish.kind, "refused");
  });
});

describe("publication checks, references and redirects", () => {
  let serviceId: string;
  before(async () => {
    serviceId = expectOk(await createItem(ctxOf(env, t.admin), serviceSpec, formOf(service("Test Publish Service")))).id;
  });

  test("references: a project's services are indexed; Used by lists the project; unpublished links only warn", async () => {
    const id = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("Demo Linked Project", { "rel.services": serviceId })))).id;
    const used = await usedBy(db(), "service", serviceId);
    assert.ok(used.some((u) => u.sourceType === "project" && u.sourceId === id && u.scope === "working"), JSON.stringify(used));
    const published = expectOk(await publish(change(t.admin), "project", id, await version("projects", id)));
    assert.ok(published.warnings?.some((w) => /not published/.test(w)), JSON.stringify(published.warnings));
    const after = await usedBy(db(), "service", serviceId);
    assert.ok(after.some((u) => u.sourceId === id && u.scope === "published"));
  });

  test("media that isn't deliverable blocks publishing", async () => {
    const pending = await seedMedia(env, { status: "pending_review" });
    const id = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(complete("Demo Logo Client", "عميل الشعار", { "media.logoMediaId": pending })))).id;
    const result = await publish(change(t.admin), "client", id, await version("clients", id));
    assert.ok(result.kind === "refused" && result.issues?.some((i) => i.code === "media"), JSON.stringify(result));
    assert.equal(await doc("client", id), undefined);
  });

  test("a blocking flag refuses publishing; added to a live project, it takes it offline at once", async () => {
    const id = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("Demo Flag Project")))).id;
    expectOk(await publish(change(t.admin), "project", id, await version("projects", id)));
    const v = await version("projects", id);
    expectOk(await addProjectFlag(ctxOf(env, t.editor), id, "rights_pending", "Test: rights not confirmed."));
    assert.equal(await version("projects", id), v, "a flag never changes the item's version");
    assert.equal(await doc("project", id), undefined);
    assert.equal((await state("projects", id)).publication_status, "unpublished");
    const refused = await publish(change(t.admin), "project", id, await version("projects", id));
    assert.ok(refused.kind === "refused" && refused.issues?.some((i) => i.code === "flags"));
  });

  test("a live slug change adds a redirect per language; a conflicting old address refuses the publish", async () => {
    const id = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("Demo Moving Project")))).id;
    expectOk(await publish(change(t.admin), "project", id, await version("projects", id)));
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("Demo Moving Project", { slug: "demo-moved-project", lockVersion: String(await version("projects", id)) }))));
    expectOk(await publish(change(t.admin), "project", id, await version("projects", id)));
    const redirects = await query<{ source_path: string; target_project_id: string; status_code: number; reason: string; is_active: number }>(env, "SELECT source_path, target_project_id, status_code, reason, is_active FROM redirects WHERE target_project_id = ? ORDER BY source_path", [id]);
    assert.deepEqual(
      redirects.map((r) => [r.source_path, r.status_code, r.reason, Number(r.is_active)]),
      [
        ["/ar/projects/demo-moving-project", 308, "slug_change", 1],
        ["/en/projects/demo-moving-project", 308, "slug_change", 1],
      ],
    );
    // Moving back: the redirects from the address it takes again are turned off (pages win), new ones added.
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("Demo Moving Project", { slug: "demo-moving-project", lockVersion: String(await version("projects", id)) }))));
    expectOk(await publish(change(t.admin), "project", id, await version("projects", id)));
    const back = await query<{ source_path: string; is_active: number }>(env, "SELECT source_path, is_active FROM redirects WHERE target_project_id = ? ORDER BY source_path", [id]);
    assert.deepEqual(
      back.map((r) => [r.source_path, Number(r.is_active)]),
      [
        ["/ar/projects/demo-moved-project", 1],
        ["/ar/projects/demo-moving-project", 0],
        ["/en/projects/demo-moved-project", 1],
        ["/en/projects/demo-moving-project", 0],
      ],
    );
    // A conflict: the old address already redirects somewhere else.
    const other = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("Demo Other Target")))).id;
    await query(env, "INSERT INTO redirects (id, source_path, target_type, target_project_id, status_code, is_active, reason, created_at, updated_at) VALUES ('01KA00000000000000000TEST1', '/en/projects/demo-conflict-old', 'project', ?, 308, 1, 'manual', NOW(3), NOW(3))", [other]);
    const moving = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("Demo Conflict Old")))).id;
    expectOk(await publish(change(t.admin), "project", moving, await version("projects", moving)));
    env.clock.advance(1000);
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, moving, formOf(project("Demo Conflict Old", { slug: "demo-conflict-new", lockVersion: String(await version("projects", moving)) }))));
    const refused = await publish(change(t.admin), "project", moving, await version("projects", moving));
    assert.ok(refused.kind === "refused" && refused.issues?.some((i) => i.code === "redirect.source"), JSON.stringify(refused));
    assert.equal((await doc("project", moving)).slug, "demo-conflict-old", "nothing changed: the old version stays live");
    const events = await auditOf(env, "project", moving);
    assert.ok(events.some((e) => e.action === "project.publish" && e.outcome === "failed"));
  });
});
