/**
 * Media in content (A4 brief §52–§56, §79) on a real MariaDB: the pickers offer public-class working media only (never a
 * private item, whoever asks), each non-approved item with its warning; a save takes a newly chosen item only when it is
 * public-class, not in the Trash, not archived, ready and of the slot's kind, and keeps one it already had; the same item
 * read under a share lock, so a Trash or archive at the same moment can't slip between the check and the save; project
 * photos keep their order and stale saves are refused; client logos, a service's gallery and cover alt texts, and a
 * certificate's thumbnail and redacted previews follow the same rules, and a save never touches a certificate's private
 * original. Choosing never approves or publishes: `public_media` does not change, and its invariant holds after every test.
 * Synthetic media rows only.
 */
import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import { cardWarnings } from "../../src/server/admin/actions/media-model.ts";
import { createItem, loadEditorItem, updateItem } from "../../src/server/cms/engine.ts";
import { certificateSpec, clientSpec, projectSpec, serviceSpec } from "../../src/server/cms/kinds.ts";
import { MEDIA_UNAVAILABLE } from "../../src/server/cms/media-refs.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { mediaCards, pickerCards } from "../../src/server/media/cards.ts";
import { archiveMedia, trashMedia, type MediaContext } from "../../src/server/media/service.ts";
import type { Actor } from "../../src/server/auth/types.ts";
import { auditOf, ctxOf, expectOk, formOf, query, seedMedia, team, type Fields, type Team } from "./cms-helpers.ts";
import { meta, setupTestEnv, type TestEnv } from "./helpers.ts";
import { assertPublicMediaInvariant } from "./media-helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("cms_media");
  t = await team(env);
});
after(async () => env?.close());
// public_media agrees with every item after each test (A4 brief §68): choosing media in content never publishes.
afterEach(async () => assertPublicMediaInvariant(env));

const db = () => dbFor(env.pool);
const mediaCtx = (actor: Actor): MediaContext => ({ deps: { ...env.deps, store: async () => null, releaseDir: "/nonexistent-release" }, actor, meta: meta() });
const version = async (table: string, id: string) => (await query<{ v: number }>(env, `SELECT lock_version AS v FROM ${table} WHERE id = ?`, [id]))[0].v;
const publicMediaRows = async () => (await query<{ media_id: string }>(env, "SELECT media_id FROM public_media ORDER BY media_id")).map((r) => r.media_id);
const photos = (ids: string[]) => JSON.stringify(ids.map((media) => ({ media })));
const project = (slug: string, extra: Fields = {}): Fields => ({ slug, "en.title": `Demo ${slug}`, "en.summary": "Demo summary.", ...extra });
const service = (slug: string, extra: Fields = {}): Fields => ({ slug, serviceGroup: "metal", iconKey: "fabrication", "en.name": `Test ${slug}`, ...extra });

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
const stillWaiting = (change: Promise<unknown>, ms = 600) =>
  Promise.race([change.then(() => false, () => false), new Promise<boolean>((done) => setTimeout(() => done(true), ms))]);

describe("the picker (A4 brief §53, §79)", () => {
  test("public-class working items with warnings; never a private, trashed, archived or unfinished item — for the Owner too", async () => {
    const approved = await seedMedia(env, { status: "approved", title: "Test picker approved" });
    const pending = await seedMedia(env, { title: "Test picker pending" });
    const restricted = await seedMedia(env, { status: "restricted", flags: ["ai_edited"], title: "Test picker restricted" });
    const privateItem = await seedMedia(env, { visibility: "private", title: "Test picker private" });
    const trashed = await seedMedia(env, { trashed: true, title: "Test picker trashed" });
    const archived = await seedMedia(env, { status: "archived", title: "Test picker archived" });
    const unfinished = await seedMedia(env, { ready: false, title: "Test picker unfinished" });
    const document = await seedMedia(env, { kind: "document", title: "Test picker document" });
    const page = await pickerCards(db(), { q: "test picker", kinds: ["image"], page: 1, pageSize: 50 });
    const ids = page.items.map((c) => c.id);
    for (const id of [approved, pending, restricted]) assert.ok(ids.includes(id), id);
    for (const id of [privateItem, trashed, archived, unfinished, document]) assert.ok(!ids.includes(id), id);
    const byId = new Map(page.items.map((c) => [c.id, c]));
    assert.deepEqual(cardWarnings(byId.get(approved)!), []);
    assert.deepEqual(cardWarnings(byId.get(pending)!), ["Pending review"]);
    assert.deepEqual(cardWarnings(byId.get(restricted)!), ["Restricted", "Blocking flag"]);
    assert.match(byId.get(approved)!.thumb ?? "", /^\/api\/admin\/media\/[0-9A-Z]{26}\/preview\/thumb\?file=[0-9A-Z]{26}$/, "an admin-only preview address, never a storage path");
    // Documents are offered only where a slot takes them (a certificate's previews).
    const docs = await pickerCards(db(), { q: "test picker", kinds: ["image", "document"], page: 1, pageSize: 50 });
    assert.ok(docs.items.some((c) => c.id === document));
    assert.ok(!docs.items.some((c) => c.id === privateItem), "never a private item, whatever the kinds");
    // A private item's card: unavailable to everyone without private access, exactly like an unknown id.
    const unknown = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const forAdmin = await mediaCards(db(), t.admin.permissions, [privateItem, unknown, approved]);
    assert.deepEqual(forAdmin[privateItem], { ...forAdmin[unknown], id: privateItem });
    assert.equal(forAdmin[privateItem].unavailable, true);
    assert.equal(forAdmin[approved].unavailable, undefined);
    const forOwner = await mediaCards(db(), t.owner.permissions, [privateItem]);
    assert.equal(forOwner[privateItem].visibility, "private");
    assert.equal(forOwner[privateItem].thumb, null, "a private item has no preview");
  });
});

describe("project photos (A4 brief §54)", () => {
  let id = "";
  let a = "";
  let b = "";
  let c = "";
  test("ordered, deterministic, audited; a reorder is a change of order only", async () => {
    [a, b, c] = [await seedMedia(env, { status: "approved" }), await seedMedia(env), await seedMedia(env, { status: "restricted" })];
    const before = await publicMediaRows();
    id = expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf(project("demo-photos", { "mediaList.photos": photos([a, b, c]) })))).id;
    const rows = await query<{ media_id: string; position: number }>(env, "SELECT media_id, position FROM project_media WHERE project_id = ? ORDER BY position", [id]);
    assert.deepEqual(rows, [{ media_id: a, position: 1 }, { media_id: b, position: 2 }, { media_id: c, position: 3 }]);
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: "0", "mediaList.photos": photos([c, a, b]) }))));
    const reordered = await query<{ media_id: string }>(env, "SELECT media_id FROM project_media WHERE project_id = ? ORDER BY position", [id]);
    assert.deepEqual(reordered.map((r) => r.media_id), [c, a, b]);
    const [change] = (await auditOf(env, "project", id)).filter((e) => e.action === "project.relations_change");
    assert.match(change.summary, /Photos \(\+0, −0, reordered\)/);
    const item = (await loadEditorItem(db(), projectSpec, id))!;
    assert.deepEqual(item.mediaLists.photos.map((e) => e.media), [c, a, b]);
    // Choosing is never approval and never publication.
    assert.deepEqual(await publicMediaRows(), before, "public_media did not change");
    const statuses = await query<{ id: string; s: string }>(env, "SELECT id, usage_status AS s FROM media_assets WHERE id IN (?, ?, ?) ORDER BY id", [a, b, c]);
    assert.deepEqual(Object.fromEntries(statuses.map((r) => [r.id, r.s])), { [a]: "approved", [b]: "pending_review", [c]: "restricted" });
  });

  test("a stale save is refused and changes nothing", async () => {
    const v = await version("projects", id);
    expectOk(await updateItem(ctxOf(env, t.admin), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(v), "mediaList.photos": photos([a]) }))));
    const stale = await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(v), "mediaList.photos": photos([c, b]) })));
    assert.equal(stale.kind, "stale");
    assert.deepEqual((await query<{ media_id: string }>(env, "SELECT media_id FROM project_media WHERE project_id = ?", [id])).map((r) => r.media_id), [a]);
  });

  test("never a private item; the trash, archive, unfinished and duplicate rules; documents refused", async () => {
    const privateItem = await seedMedia(env, { visibility: "private" });
    const cases: [string, string | RegExp][] = [
      [photos([privateItem]), MEDIA_UNAVAILABLE],
      [photos(["01ARZ3NDEKTSV4RRFFQ69G5FAV"]), MEDIA_UNAVAILABLE],
      [photos([await seedMedia(env, { trashed: true })]), /in the Trash/],
      [photos([await seedMedia(env, { status: "archived" })]), /archived/],
      [photos([await seedMedia(env, { ready: false })]), /no ready file/],
      [photos([await seedMedia(env, { kind: "document" })]), /Choose an image here/],
      [photos([a, a]), /can be in photos once/],
      ["not json", /could not be read/],
      [JSON.stringify([{ media: a, extra: 1 }]), /.+/],
    ];
    for (const [list, message] of cases) {
      const result = await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "mediaList.photos": list })));
      assert.equal(result.kind, "invalid", list);
      if (result.kind !== "invalid") continue;
      assert.deepEqual(Object.keys(result.errors), ["mediaList.photos"], `${list}: the problem is shown on the list`);
      if (typeof message === "string") assert.equal(result.errors["mediaList.photos"], message, list);
      else assert.match(result.errors["mediaList.photos"], message, list);
    }
    assert.deepEqual((await query<{ media_id: string }>(env, "SELECT media_id FROM project_media WHERE project_id = ?", [id])).map((r) => r.media_id), [a]);
  });

  test("an item already listed stays when it is moved to the Trash or archived later (shown with its warning); it can't be added anew", async () => {
    expectOk(await trashMedia(mediaCtx(t.owner), a));
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "en.summary": "Demo summary, changed.", "mediaList.photos": photos([a]) }))));
    const card = (await mediaCards(db(), t.editor.permissions, [a]))[a];
    assert.ok(cardWarnings(card).includes("In the Trash"));
    // Removed, then added again: a new choice, refused while it is in the Trash.
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "mediaList.photos": photos([]) }))));
    const again = await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "mediaList.photos": photos([a]) })));
    assert.equal(again.kind, "invalid");
  });

  test("race: an item moved to the Trash while a save chooses it — the save waits for it, then refuses (nothing linked)", async () => {
    const m = await seedMedia(env);
    const trash = await holding([["SELECT id FROM media_assets WHERE id = ? FOR UPDATE", [m]]]);
    const save = updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "mediaList.photos": photos([m]) })));
    assert.equal(await stillWaiting(save), true, "the save waits for the item's lock (a share-locked read)");
    await trash.run("UPDATE media_assets SET deleted_at = NOW(3) WHERE id = ?", [m]);
    await trash.commit();
    const result = await save;
    assert.equal(result.kind, "invalid", JSON.stringify(result));
    assert.deepEqual(await query(env, "SELECT media_id FROM project_media WHERE project_id = ? AND media_id = ?", [id, m]), []);
  });

  test("race: a save holding its choice makes the Trash wait until it commits (the item was never trashed before it was linked)", async () => {
    const m = await seedMedia(env);
    // Hold the project's English translation row: the save stops there, after its checks (the item share-locked).
    const hold = await holding([["SELECT project_id FROM project_translations WHERE project_id = ? AND locale = 'en' FOR UPDATE", [id]]]);
    const save = updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "en.summary": "Demo summary, raced.", "mediaList.photos": photos([m]) })));
    assert.equal(await stillWaiting(save), true, "the save is held at its translation row");
    const trash = trashMedia(mediaCtx(t.owner), m);
    assert.equal(await stillWaiting(trash), true, "the Trash waits for the save's share lock on the item");
    await hold.commit();
    expectOk(await save);
    expectOk(await trash);
    const [linked] = await query<{ media_id: string }>(env, "SELECT media_id FROM project_media WHERE project_id = ?", [id]);
    assert.equal(linked.media_id, m, "linked first, trashed after: it stays, shown in the Trash");
  });

  test("race: archiving the item at the same moment — the save waits, then refuses", async () => {
    const m = await seedMedia(env);
    const hold = await holding([["SELECT id FROM media_assets WHERE id = ? FOR UPDATE", [m]]]);
    const save = updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "mediaList.photos": photos([m]) })));
    assert.equal(await stillWaiting(save), true);
    await hold.run("UPDATE media_assets SET usage_status = 'archived' WHERE id = ?", [m]);
    await hold.commit();
    assert.equal((await save).kind, "invalid");
    // The real archive action, after: an item already listed may stay archived (kept), like the Trash.
    const kept = await seedMedia(env);
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "mediaList.photos": photos([kept]) }))));
    expectOk(await archiveMedia(mediaCtx(t.admin), kept));
    expectOk(await updateItem(ctxOf(env, t.editor), projectSpec, id, formOf(project("demo-photos", { lockVersion: String(await version("projects", id)), "mediaList.photos": photos([kept]) }))));
  });
});

describe("client logos (A4 brief §55)", () => {
  test("colour and monochrome logos: images only, never private, unknown ids refused alike; slots audited as fields", async () => {
    const logo = await seedMedia(env, { status: "approved" });
    const mono = await seedMedia(env);
    const fields = (extra: Fields): Fields => ({ slug: "demo-logo-client", "en.name": "Demo Logo Client", ...extra });
    const id = expectOk(await createItem(ctxOf(env, t.editor), clientSpec, formOf(fields({ "media.logoMediaId": logo })))).id;
    expectOk(await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(fields({ lockVersion: "0", "media.logoMediaId": logo, "media.logoMonoMediaId": mono }))));
    assert.deepEqual((await query(env, "SELECT logo_media_id AS l, logo_mono_media_id AS m FROM clients WHERE id = ?", [id]))[0], { l: logo, m: mono });
    const [update] = (await auditOf(env, "client", id)).filter((e) => e.action === "client.update");
    assert.match(update.summary, /logo \(monochrome\)/);
    const privateItem = await seedMedia(env, { visibility: "private" });
    const refusals: [string, RegExp][] = [
      [privateItem, /can't be used here/],
      ["01BX5ZZKBKACTAV9WEVGEMMVRZ", /can't be used here/],
      [await seedMedia(env, { kind: "document" }), /Choose an image here/],
      ["../../etc/passwd", /.+/],
    ];
    for (const [value, message] of refusals) {
      const result = await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(fields({ lockVersion: "1", "media.logoMediaId": logo, "media.logoMonoMediaId": value })));
      assert.equal(result.kind, "invalid", value);
      if (result.kind === "invalid") assert.match(result.errors["media.logoMonoMediaId"] ?? "", message);
    }
    // Only the declared slots: a column named directly in the form is ignored (no mass assignment).
    expectOk(await updateItem(ctxOf(env, t.editor), clientSpec, id, formOf(fields({ lockVersion: "1", logoMediaId: privateItem, "media.logoMediaId": logo, "media.ogImageMediaId": privateItem }))));
    assert.deepEqual((await query(env, "SELECT logo_media_id AS l, logo_mono_media_id AS m FROM clients WHERE id = ?", [id]))[0], { l: logo, m: null }, "emptying a slot removes it");
  });
});

describe("a service's gallery and cover photo (A4 brief §56)", () => {
  test("captioned entries per language; alt texts NULL / decorative / written; an entry keeps its photo; a photo once", async () => {
    const [p1, p2, cover] = [await seedMedia(env), await seedMedia(env, { status: "approved" }), await seedMedia(env)];
    const entry = (media: string, enCaption: string, arCaption: string, enAlt: string | null, id: string | null = null) => ({ id, media, en: { caption: enCaption, alt: enAlt }, ar: { caption: arCaption, alt: null } });
    const id = expectOk(
      await createItem(
        ctxOf(env, t.editor),
        serviceSpec,
        formOf(
          service("test-gallery", {
            "media.coverMediaId": cover,
            "en.coverAlt": "Test cover description",
            "en.coverAltMode": "text",
            "ar.coverAltMode": "decorative",
            children: JSON.stringify([entry(p1, "Test caption one", "تعليق تجريبي", ""), entry(p2, "Test caption two", "", "Test alt two")]),
          }),
        ),
      ),
    ).id;
    const items = await query<{ id: string; media_id: string; position: number }>(env, "SELECT id, media_id, position FROM service_gallery_items WHERE service_id = ? ORDER BY position", [id]);
    assert.deepEqual(items.map((i) => i.media_id), [p1, p2]);
    const trs = await query<{ item_id: string; locale: string; caption: string; alt: string | null }>(env, "SELECT item_id, locale, caption, alt FROM service_gallery_item_translations");
    assert.deepEqual(
      trs
        .filter((r) => items.some((i) => i.id === r.item_id))
        .map((r) => [items.find((i) => i.id === r.item_id)!.position, r.locale, r.caption, r.alt])
        .sort((x, y) => Number(x[0]) - Number(y[0]) || String(x[1]).localeCompare(String(y[1]))),
      [
        [1, "ar", "تعليق تجريبي", null],
        [1, "en", "Test caption one", ""],
        [2, "en", "Test caption two", "Test alt two"],
      ],
    );
    assert.deepEqual((await query(env, "SELECT locale, cover_alt AS a FROM service_translations WHERE service_id = ? ORDER BY locale", [id])).map((r) => [r.locale, r.a]), [
      ["ar", ""],
      ["en", "Test cover description"],
    ]);
    // The second entry has no Arabic caption: Arabic is incomplete.
    const item = (await loadEditorItem(db(), serviceSpec, id))!;
    assert.equal(item.states.ar, "incomplete");
    assert.equal(item.values.en.coverAltMode, "text");
    assert.equal(item.values.ar.coverAltMode, "decorative");
    const kept = items.map((i) => i.id);
    const save = (children: unknown[], extra: Fields = {}) =>
      updateItem(ctxOf(env, t.editor), serviceSpec, id, formOf(service("test-gallery", { lockVersion: "0", "media.coverMediaId": cover, children: JSON.stringify(children), ...extra })));
    // A kept entry can't swap its photo (remove it and add the new one instead).
    let result = await save([entry(p2, "Test caption one", "", "", kept[0])]);
    assert.equal(result.kind, "invalid");
    // The same photo twice.
    result = await save([entry(p1, "A", "", null, kept[0]), entry(p1, "B", "", null)]);
    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") assert.match(result.errors.children ?? "", /once/);
    // "Written" with nothing written is a question, not a decision.
    result = await save([], { "en.coverAltMode": "text", "en.coverAlt": "   " });
    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") assert.match(result.errors["en.coverAlt"] ?? "", /Write the alt text/);
    // A private item is never a gallery photo.
    result = await save([entry(await seedMedia(env, { visibility: "private" }), "Test", "", null)]);
    assert.equal(result.kind, "invalid");
    if (result.kind === "invalid") assert.equal(result.errors.children, MEDIA_UNAVAILABLE);
    // Reorder and remove: kept entries keep their ids and photos.
    expectOk(await save([entry(p2, "Test caption two", "تعليق ثان", null, kept[1])]));
    assert.deepEqual(await query(env, "SELECT id, media_id, position FROM service_gallery_items WHERE service_id = ?", [id]), [{ id: kept[1], media_id: p2, position: 1 }]);
  });
});

describe("a certificate's thumbnail and redacted previews (A4 brief §49–§50, §79–§80)", () => {
  test("previews: public-class images or PDFs, each with a language or both; never a private item; the private original is never touched", async () => {
    const certificate = (extra: Fields = {}): Fields => ({ slug: "test-preview-licence", "en.title": "Test Preview Licence", "en.issuer": "Test Body", ...extra });
    const id = expectOk(await createItem(ctxOf(env, t.admin), certificateSpec, formOf(certificate()))).id;
    // A private original, linked the way the Owner's private upload links it.
    const original = await seedMedia(env, { visibility: "private", kind: "document" });
    await query(env, "INSERT INTO certificate_documents (certificate_id, media_id, role, locale, position) VALUES (?, ?, 'private_original', NULL, 1)", [id, original]);
    const [enPreview, arPreview, both] = [await seedMedia(env, { kind: "document" }), await seedMedia(env), await seedMedia(env, { kind: "document" })];
    const thumb = await seedMedia(env);
    const previews = JSON.stringify([
      { media: enPreview, locale: "en" },
      { media: arPreview, locale: "ar" },
      { media: both, locale: null },
    ]);
    expectOk(await updateItem(ctxOf(env, t.admin), certificateSpec, id, formOf(certificate({ lockVersion: "0", "media.thumbMediaId": thumb, "mediaList.previews": previews }))));
    const docs = await query(env, "SELECT media_id AS m, role, locale, position FROM certificate_documents WHERE certificate_id = ? ORDER BY role, position", [id]);
    assert.deepEqual(docs, [
      { m: enPreview, role: "public_preview", locale: "en", position: 1 },
      { m: arPreview, role: "public_preview", locale: "ar", position: 2 },
      { m: both, role: "public_preview", locale: null, position: 3 },
      { m: original, role: "private_original", locale: null, position: 1 },
    ]);
    // Emptying the previews leaves the private original exactly as it was.
    expectOk(await updateItem(ctxOf(env, t.admin), certificateSpec, id, formOf(certificate({ lockVersion: "1", "media.thumbMediaId": thumb, "mediaList.previews": "[]" }))));
    assert.deepEqual(await query(env, "SELECT media_id AS m, role FROM certificate_documents WHERE certificate_id = ?", [id]), [{ m: original, role: "private_original" }]);
    // The private original can't become a preview or the thumbnail — refused like an unknown id, for the Owner too.
    for (const [field, value] of [
      ["mediaList.previews", JSON.stringify([{ media: original, locale: null }])],
      ["media.thumbMediaId", original],
    ] as const) {
      const result = await updateItem(ctxOf(env, t.owner), certificateSpec, id, formOf(certificate({ lockVersion: "2", [field]: value })));
      assert.equal(result.kind, "invalid", field);
      if (result.kind === "invalid") assert.equal(result.errors[field], MEDIA_UNAVAILABLE, field);
    }
    // The thumbnail takes images only; a preview's language is English, Arabic or none.
    const docThumb = await updateItem(ctxOf(env, t.admin), certificateSpec, id, formOf(certificate({ lockVersion: "2", "media.thumbMediaId": enPreview })));
    assert.equal(docThumb.kind, "invalid");
    const badLocale = await updateItem(ctxOf(env, t.admin), certificateSpec, id, formOf(certificate({ lockVersion: "2", "mediaList.previews": JSON.stringify([{ media: enPreview, locale: "fr" }]) })));
    assert.equal(badLocale.kind, "invalid");
    // Editing a certificate (and so its media) stays Owner/Admin (certificates.edit).
    const denied = await updateItem(ctxOf(env, t.editor), certificateSpec, id, formOf(certificate({ lockVersion: "2", "mediaList.previews": JSON.stringify([{ media: enPreview, locale: "en" }]) })));
    assert.equal(denied.kind, "denied");
    assert.equal((await query(env, "SELECT visibility, usage_status AS s FROM media_assets WHERE id = ?", [original]))[0].s, "internal", "the private original stays internal");
  });
});
