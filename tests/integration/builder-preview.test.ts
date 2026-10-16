/**
 * Page builder (A5) — the preview's data and the builder's reads on a real MariaDB (brief §36–§40, §52, §70, §82): the
 * sections a screen size shows, media seen only through the A4 delivery rule (a private item is "Not available" and
 * nothing of it reaches the model), linked reusable sections, unreadable sections as placeholders, batched reads (30
 * sections cost the same queries as 3: no query per section), concurrent reorders (exactly one wins, positions stay
 * dense) and the audit trail by kind of change. Test data only ("Test …").
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { loadBuilder } from "../../src/server/builder/editor.ts";
import { loadPreview } from "../../src/server/builder/preview.ts";
import { createReusable, updateReusable } from "../../src/server/builder/reusable.ts";
import { initializeLayout } from "../../src/server/builder/sections.ts";
import type { OwnerRef } from "../../src/server/builder/store.ts";
import { createItem } from "../../src/server/cms/engine.ts";
import { projectSpec } from "../../src/server/cms/kinds.ts";
import { dbFor, inTransaction, type Db } from "../../src/server/db/client.ts";
import { syncPublicMedia } from "../../src/server/media/deliverability.ts";
import { ulid } from "../../src/server/security/ids.ts";
import { auditOf, ctxOf, expectOk, formOf, query, seedMedia, team, type Team } from "./cms-helpers.ts";
import { changeOf, dataFor, entryOf, genericPage, layoutOf, save, versionOf } from "./builder-helpers.ts";
import { setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let t: Team;
before(async () => {
  env = await setupTestEnv("builder_preview");
  t = await team(env);
});
after(async () => env?.close());

const all = { desktop: true, tablet: true, mobile: true };
const db = () => dbFor(env.pool);

/** An approved release photo, delivered (its public_media row written by A4's own rule). */
async function releasePhoto(): Promise<string> {
  const id = ulid();
  const file = ulid();
  await query(env, "INSERT INTO media_assets (id, kind, visibility, usage_status, current_file_id) VALUES (?, 'image', 'public', 'approved', NULL)", [id]);
  await query(
    env,
    `INSERT INTO media_files (id, media_id, version, storage_area, storage_key, original_filename, mime_type, extension, byte_size, sha256, width, height, processing_status, uploaded_at)
     VALUES (?, ?, 1, 'release', ?, 'clock-tower-1.webp', 'image/webp', 'webp', 1000, UNHEX(SHA2(?, 256)), 640, 480, 'ready', ?)`,
    [file, id, `/media/projects/test-${id.slice(-6).toLowerCase()}.webp`, id, new Date()],
  );
  await query(env, "UPDATE media_assets SET current_file_id = ? WHERE id = ?", [file, id]);
  await inTransaction(env.pool, async (tx) => {
    await syncPublicMedia(tx, id, new Date());
  });
  return id;
}

async function initialized(owner: OwnerRef) {
  expectOk(await initializeLayout(changeOf(env, t.owner), owner, await versionOf(env, owner)));
  return layoutOf(env, owner);
}

const section = (ref: string, blockType: string, options: Parameters<typeof dataFor>[1] = {}, extra: Record<string, unknown> = {}) => ({
  ref,
  blockType,
  visible: true,
  devices: all,
  anchor: null,
  data: dataFor(blockType, options),
  ...extra,
});

/** A Drizzle handle over the test pool that counts every statement sent (no transactions in the reads measured). */
function counting(pool: Pool): { db: Db; count: () => number } {
  let n = 0;
  const proxy = new Proxy(pool, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if ((prop === "query" || prop === "execute") && typeof value === "function")
        return (...args: unknown[]) => {
          n++;
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { db: drizzle(proxy) as unknown as Db, count: () => n };
}

describe("the preview's model", () => {
  let page: OwnerRef;
  let photo: string;
  let pending: string;
  let restricted: string;
  let trashed: string;
  let privateDoc: string;

  before(async () => {
    page = await genericPage(env, t.editor, "Test Preview Page");
    photo = await releasePhoto();
    pending = await seedMedia(env, { status: "pending_review" });
    restricted = await seedMedia(env, { status: "restricted", flags: ["restricted"] });
    trashed = await seedMedia(env, { status: "approved", trashed: true });
    privateDoc = await seedMedia(env, { visibility: "private", kind: "document" });
  });

  test("the sections a screen size shows; hidden ones and those off on that screen are listed, not drawn", async () => {
    const [hero] = await initialized(page);
    expectOk(
      await save(env, t.editor, page, [
        entryOf(hero),
        section("new:1", "generic.heading", { texts: { en: { title: "Test shown everywhere" } } }),
        section("new:2", "generic.heading", { texts: { en: { title: "Test hidden" } } }, { visible: false }),
        section("new:3", "generic.heading", { texts: { en: { title: "Test desktop only" } } }, { devices: { desktop: true, tablet: false, mobile: false } }),
      ]),
    );
    const desktop = (await loadPreview(db(), "page", page.id, { locale: "en", device: "desktop" }))!;
    const phone = (await loadPreview(db(), "page", page.id, { locale: "en", device: "mobile" }))!;
    assert.equal(desktop.sections.length, 3);
    assert.equal(phone.sections.length, 2);
    assert.deepEqual(
      desktop.skipped.map((s) => s.reason),
      ["Hidden"],
    );
    assert.deepEqual(
      phone.skipped.map((s) => s.reason).sort(),
      ["Hidden", "Not shown on phones"],
    );
    // The chosen language's texts only; a language without texts is noted, never filled from the other.
    const ar = (await loadPreview(db(), "page", page.id, { locale: "ar", device: "desktop" }))!;
    const heading = ar.sections.find((s) => s.blockType === "generic.heading")!;
    assert.equal(heading.content, null);
    assert.ok(heading.notes.some((n) => /Arabic/.test(n)), JSON.stringify(heading.notes));
  });

  test("media through A4's delivery rule only: a delivered photo is an image; the rest are reasons; a private item leaves no trace", async () => {
    const sections = await layoutOf(env, page);
    const image = (ref: string, media: string) => section(ref, "generic.image", { settings: { media }, texts: { en: { alt: "Test photo" } } });
    expectOk(await save(env, t.editor, page, [...sections.map(entryOf), image("new:1", photo), image("new:2", pending), image("new:3", restricted)]));
    // A private, trashed or archived item can't be chosen (A5 refuses it), so a stored reference to one is made by SQL:
    // the preview must still never draw it.
    const stored = await layoutOf(env, page);
    const last = stored[stored.length - 1];
    for (const [target, id] of [
      [privateDoc, ulid()],
      [trashed, ulid()],
    ] as const) {
      const settings = JSON.stringify({ ...(last.settings as Record<string, unknown>), media: target });
      await query(
        env,
        "INSERT INTO page_sections (id, page_id, block_type, schema_version, position, settings) VALUES (?, ?, 'generic.image', 1, ?, ?)",
        [id, page.id, stored.length + (target === privateDoc ? 1 : 2), settings],
      );
    }
    const model = (await loadPreview(db(), "page", page.id, { locale: "en", device: "desktop" }))!;
    const of = (id: string) => model.media.get(id);
    assert.equal(of(photo)?.ok, true);
    assert.match(String((of(photo) as { image: { src: string } }).image.src), /^\/media\/projects\//);
    assert.deepEqual(of(pending), { id: pending, ok: false, reason: "Pending review" });
    assert.equal(of(restricted)?.ok, false);
    assert.equal(of(trashed)?.ok, false);
    assert.deepEqual(of(privateDoc), { id: privateDoc, ok: false, reason: "Not available" });
    // Nothing of the private item — its file name, storage key or kind — is anywhere in the model.
    const [file] = await query<{ storage_key: string; original_filename: string }>(env, "SELECT storage_key, original_filename FROM media_files WHERE media_id = ?", [privateDoc]);
    const json = JSON.stringify({ ...model, media: [...model.media.values()] });
    assert.ok(!json.includes(file.storage_key) && !json.includes(file.original_filename));
    assert.ok(!json.includes("/media/u/"), "no uploaded-media address is offered for an undeliverable item");
  });

  test("a linked reusable section shows the reusable section's own texts", async () => {
    const created = expectOk(await createReusable(changeOf(env, t.editor), { name: "Test linked heading", blockType: "generic.heading" }));
    const data = dataFor("generic.heading", { texts: { en: { title: "Test reusable title" } } });
    expectOk(await updateReusable(changeOf(env, t.editor), { id: created.id, expectedVersion: 0, name: "Test linked heading", data }));
    const sections = await layoutOf(env, page);
    expectOk(await save(env, t.editor, page, [...sections.map(entryOf), { ref: "new:1", reusableId: created.id, visible: true, devices: all, anchor: null }]));
    const model = (await loadPreview(db(), "page", page.id, { locale: "en", device: "desktop" }))!;
    const linked = model.sections.find((s) => s.linked)!;
    assert.equal((linked.content as { title: string }).title, "Test reusable title");
    const alone = (await loadPreview(db(), "reusable", created.id, { locale: "en", device: "desktop" }))!;
    assert.equal(alone.sections.length, 1);
  });

  test("an unreadable section (unknown type, future version) is a placeholder with its reason, never a crash", async () => {
    const sections = (await layoutOf(env, page)).filter((s) => s.visible && s.devices.desktop && !s.locked);
    await query(env, "UPDATE page_sections SET schema_version = 99 WHERE id = ?", [sections[1].id]);
    await query(env, "UPDATE page_sections SET block_type = 'generic.not_a_block' WHERE id = ?", [sections[2].id]);
    const model = (await loadPreview(db(), "page", page.id, { locale: "en", device: "desktop" }))!;
    const states = new Map(model.sections.map((s) => [s.id, s]));
    assert.notEqual(states.get(sections[1].id)!.state, "ok");
    assert.ok(states.get(sections[1].id)!.problem);
    assert.notEqual(states.get(sections[2].id)!.state, "ok");
    assert.equal(await loadPreview(db(), "page", ulid(), { locale: "en", device: "desktop" }), null);
    assert.equal(await loadPreview(db(), "service", page.id, { locale: "en", device: "desktop" }), null, "a page id is never read as a service");
  });
});

describe("batched reads (§82): no query per section", () => {
  test("the builder's model and the preview of 30 sections take the same number of queries as 3", async (ctx) => {
    const photo = await releasePhoto();
    const [project] = [
      expectOk(await createItem(ctxOf(env, t.editor), projectSpec, formOf({ slug: "test-preview-project", "en.title": "Test Preview Project", "en.summary": "Test." }))).id,
    ];
    // The small page names the same kinds of things (a photo, a project) as the large one: only the number differs.
    const kinds = ["generic.image", "generic.projects_grid", "generic.heading", "generic.rich_text", "generic.feature_cards", "generic.statistics", "generic.faq", "generic.cta"];
    const data = (blockType: string) =>
      blockType === "generic.image"
        ? { settings: { media: photo }, texts: { en: { alt: "Test" }, ar: { alt: "تجربة" } } }
        : blockType === "generic.projects_grid"
          ? { settings: { projects: { mode: "manual", ids: [project] } }, texts: { en: { title: "Test" } } }
          : { texts: { en: { title: "Test" }, ar: { title: "تجربة" } } };
    async function pageWith(count: number): Promise<OwnerRef> {
      const owner = await genericPage(env, t.editor, `Test Stress ${count}`);
      const [hero] = await initialized(owner);
      const used = new Map<string, number>();
      const entries = [];
      for (let i = 0; i < count - 1; i++) {
        let blockType = kinds[i % kinds.length];
        // Stay inside each block's maximum per page.
        if ((used.get(blockType) ?? 0) >= (blockType === "generic.projects_grid" || blockType === "generic.faq" || blockType === "generic.cta" ? 4 : 6)) blockType = "generic.heading";
        used.set(blockType, (used.get(blockType) ?? 0) + 1);
        entries.push(section(`new:${i + 1}`, blockType, data(blockType)));
      }
      expectOk(await save(env, t.editor, owner, [entryOf(hero), ...entries]));
      assert.equal((await layoutOf(env, owner)).length, count);
      return owner;
    }
    const small = await pageWith(3);
    const large = await pageWith(30);
    const measure = async (owner: OwnerRef) => {
      const builder = counting(env.pool);
      const model = await loadBuilder(builder.db, t.editor.permissions, owner);
      const preview = counting(env.pool);
      const started = performance.now();
      const shown = await loadPreview(preview.db, "page", owner.id, { locale: "en", device: "desktop" });
      return { builder: builder.count(), preview: preview.count(), sections: model!.sections.length, shown: shown!.sections.length, ms: performance.now() - started };
    };
    const a = await measure(small);
    const b = await measure(large);
    assert.equal(a.sections, 3);
    assert.equal(b.sections, 30);
    assert.equal(b.shown, 30);
    assert.equal(b.builder, a.builder, `builder queries: ${a.builder} for 3 sections, ${b.builder} for 30`);
    assert.equal(b.preview, a.preview, `preview queries: ${a.preview} for 3 sections, ${b.preview} for 30`);
    assert.ok(b.ms < 5000, `the preview of 30 sections loaded in ${Math.round(b.ms)} ms`);
    ctx.diagnostic(`builder model: ${b.builder} queries; preview: ${b.preview} queries (3 and 30 sections alike); preview of 30 sections read in ${Math.round(b.ms)} ms`);
  });
});

describe("concurrency and audit", () => {
  test("eight editors reorder the same version at once: exactly one wins, the rest are stale, positions stay dense", async () => {
    const owner = await genericPage(env, t.editor, "Test Reorder Race");
    const [hero] = await initialized(owner);
    expectOk(
      await save(env, t.editor, owner, [
        entryOf(hero),
        ...[1, 2, 3, 4].map((n) => section(`new:${n}`, "generic.heading", { texts: { en: { title: `Test ${n}` } } })),
      ]),
    );
    const sections = await layoutOf(env, owner);
    const v = await versionOf(env, owner);
    // Eight different new orders (the stored order itself would be a save with nothing to change).
    const orders = [
      [1, 2, 4, 3],
      [4, 3, 2, 1],
      [2, 1, 4, 3],
      [3, 4, 1, 2],
      [1, 3, 2, 4],
      [4, 1, 3, 2],
      [2, 4, 1, 3],
      [3, 1, 4, 2],
    ];
    const results = await Promise.all(orders.map((order, i) => save(env, i % 2 ? t.owner : t.editor, owner, [entryOf(sections[0]), ...order.map((n) => entryOf(sections[n]))], v)));
    assert.deepEqual(results.map((r) => r.kind).sort(), ["ok", ...Array(7).fill("stale")]);
    assert.equal(await versionOf(env, owner), v + 1);
    const after = await layoutOf(env, owner);
    assert.deepEqual(
      after.map((s) => s.position),
      [1, 2, 3, 4, 5],
    );
    const winner = orders[results.findIndex((r) => r.kind === "ok")];
    assert.deepEqual(
      after.slice(1).map((s) => s.id),
      winner.map((n) => sections[n].id),
    );
  });

  test("every kind of change writes its audit event; a refusal is audited too; texts never enter the audit", async () => {
    const owner = await genericPage(env, t.editor, "Test Audit Page");
    const [hero] = await initialized(owner);
    expectOk(await save(env, t.editor, owner, [entryOf(hero), section("new:1", "generic.heading", { texts: { en: { title: "Test secret words" } } }), section("new:2", "generic.heading", { texts: { en: { title: "Test two" } } })]));
    let [, a, b] = await layoutOf(env, owner);
    expectOk(await save(env, t.editor, owner, [entryOf(hero), { ...entryOf(b) }, { ...entryOf(a) }]));
    [, b, a] = await layoutOf(env, owner);
    expectOk(await save(env, t.editor, owner, [entryOf(hero), { ...entryOf(b), visible: false }, { ...entryOf(a), anchor: "test-anchor" }]));
    expectOk(await save(env, t.editor, owner, [entryOf(hero), { ...entryOf(b), visible: false, ref: b.id, data: dataFor("generic.heading", { texts: { en: { title: "Test changed words" } } }) }]));
    const refused = await save(env, t.reviewer, owner, [entryOf(hero)]);
    assert.equal(refused.kind, "denied");
    const pageEvents = await auditOf(env, "page", owner.id);
    const sectionEvents = [...(await auditOf(env, "page_section", a.id)), ...(await auditOf(env, "page_section", b.id))];
    const actions = new Set([...pageEvents, ...sectionEvents].map((e) => `${e.action}:${e.outcome}`));
    for (const expected of ["layout.initialize:success", "layout.reorder:success", "section.create:success", "section.visibility:success", "section.anchor:success", "section.update:success", "section.remove:success", "layout.save:denied"]) {
      assert.ok(actions.has(expected), `${expected} in ${[...actions].join(", ")}`);
    }
    const all = JSON.stringify([...pageEvents, ...sectionEvents]);
    assert.ok(!all.includes("secret words") && !all.includes("changed words"), "the audit holds no texts");
  });
});
