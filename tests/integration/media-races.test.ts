/**
 * Media library (A4) — concurrency (A4 brief §66–§67): every state change locks the item's `media_assets` row; a change
 * that makes the item safer never needs the page's version, one that makes it less safe is decided on it. Each race is
 * made deterministic by a third connection holding the item's row: both changes are started, shown to wait, then the
 * row is released and they run one after the other — in either order the end state is one the rules allow, and the
 * `public_media` invariant holds (never a stale delivery row).
 */
import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import {
  addMediaFlag,
  approveMedia,
  clearMediaFlag,
  restoreMediaVersion,
  restrictMedia,
  trashMedia,
  updateMediaMetadata,
  type MediaResult,
} from "../../src/server/media/service.ts";
import { mediaFlagToken } from "../../src/server/media/service.ts";
import { formOf, query } from "./cms-helpers.ts";
import { assertPublicMediaInvariant, jpeg, mctx, setupMediaEnv, upload, uploadOk, type MediaEnv } from "./media-helpers.ts";

let env: MediaEnv;
before(async () => {
  env = await setupMediaEnv("media_race");
});
afterEach(async () => {
  await assertPublicMediaInvariant(env);
});
after(async () => {
  await env.closeMedia();
});

let seed = 500;
const row = async (id: string) => (await query<Record<string, unknown>>(env, "SELECT * FROM media_assets WHERE id = ?", [id]))[0];
const version = async (id: string) => Number((await row(id)).lock_version);
const published = async (id: string) => (await query(env, "SELECT 1 FROM public_media WHERE media_id = ?", [id])).length === 1;

async function readyImage(approved: boolean) {
  const id = await uploadOk(env, env.team.editor, await jpeg(480, 360, { seed: seed++ }), `race-${seed}.jpg`);
  const meta = await updateMediaMetadata(
    mctx(env, env.team.editor),
    id,
    formOf({ lockVersion: String(await version(id)), "en.altMode": "decorative", "ar.altMode": "decorative", "en.title": "Race", "ar.title": "سباق" }),
  );
  assert.equal(meta.kind, "ok");
  if (approved) assert.equal((await approveMedia(mctx(env, env.team.admin), id, await version(id), "Race setup")).kind, "ok");
  return id;
}

/** A third connection holding the item's row FOR UPDATE until `release`. */
async function hold(id: string) {
  const conn = await env.pool.getConnection();
  await conn.query("BEGIN");
  await conn.query("SELECT id FROM media_assets WHERE id = ? FOR UPDATE", [id]);
  return {
    release: async () => {
      await conn.query("COMMIT");
      conn.release();
    },
  };
}

const stillWaiting = (change: Promise<unknown>, ms = 400) =>
  Promise.race([change.then(() => false, () => false), new Promise<boolean>((done) => setTimeout(() => done(true), ms))]);

/** Starts `first`, then `second`, both waiting on the held row; releases it; returns both results. */
async function race<A, B>(id: string, first: () => Promise<A>, second: () => Promise<B>): Promise<[A, B]> {
  const held = await hold(id);
  const a = first();
  assert.ok(await stillWaiting(a), "the first change waits for the held row");
  const b = second();
  assert.ok(await stillWaiting(b), "the second change waits too");
  await held.release();
  return Promise.all([a, b]);
}

const kinds = (...results: { kind: string }[]) => results.map((r) => r.kind);

describe("races on one item (A4 brief §67)", () => {
  test("approve vs a blocking flag: never delivered with the flag", async () => {
    for (const order of ["approve-first", "flag-first"] as const) {
      const id = await readyImage(false);
      const v = await version(id);
      const approve = () => approveMedia(mctx(env, env.team.admin), id, v, "Race approval");
      const flag = () => addMediaFlag(mctx(env, env.team.reviewer), id, "rights_pending", "Race flag");
      const results = order === "approve-first" ? await race(id, approve, flag) : (await race(id, flag, approve)).reverse();
      const [approved, flagged] = results as [MediaResult, MediaResult];
      assert.equal(flagged.kind, "ok", "the flag always lands (it needs no version)");
      assert.ok(["ok", "refused"].includes(approved.kind), order);
      assert.equal(await published(id), false, `${order}: never delivered while the flag is set`);
    }
  });

  test("approve vs trash: the Trash always wins in the end", async () => {
    for (const order of ["approve-first", "trash-first"] as const) {
      const id = await readyImage(false);
      const v = await version(id);
      const approve = () => approveMedia(mctx(env, env.team.admin), id, v, "Race approval");
      const trash = () => trashMedia(mctx(env, env.team.owner), id);
      const [a, t] = order === "approve-first" ? await race(id, approve, trash) : ((await race(id, trash, approve)).reverse() as [MediaResult, MediaResult]);
      assert.equal(t.kind, "ok");
      assert.ok(["ok", "stale"].includes(a.kind), `${order}: ${a.kind}`);
      assert.ok((await row(id)).deleted_at);
      assert.equal(await published(id), false);
    }
  });

  test("metadata vs approve on the same page version: one wins, the other is stale", async () => {
    const id = await readyImage(false);
    const v = await version(id);
    const [m, a] = await race(
      id,
      () => updateMediaMetadata(mctx(env, env.team.editor), id, formOf({ lockVersion: String(v), "en.altMode": "text", "en.alt": "Changed during the approval", "ar.altMode": "decorative" })),
      () => approveMedia(mctx(env, env.team.admin), id, v, "Race approval"),
    );
    assert.deepEqual(kinds(m, a).sort(), ["ok", "stale"].sort(), JSON.stringify([m, a]));
  });

  test("approve vs a replacement being processed: an approval of the old version never outlives the new one", async () => {
    const id = await readyImage(false);
    const v = await version(id);
    const held = await hold(id);
    const replacing = upload(env, env.team.editor, await jpeg(500, 360, { seed: seed++ }), "new.jpg", { purpose: "replace", mediaId: id });
    assert.ok(await stillWaiting(replacing), "the replacement waits for the row (its new version row)");
    const approving = approveMedia(mctx(env, env.team.admin), id, v, "Approving what the page showed");
    assert.ok(await stillWaiting(approving));
    await held.release();
    const [replaced, approved] = await Promise.all([replacing, approving]);
    assert.equal(replaced.status, 201, JSON.stringify(replaced.body));
    assert.ok(["ok", "stale"].includes(approved.kind));
    const now = await row(id);
    assert.equal(now.usage_status, "pending_review", "a replacement always returns to review");
    assert.equal(await published(id), false);
  });

  test("replace vs restrict: a replacement finishing after a restriction never lifts it", async () => {
    const id = await readyImage(true);
    const held = await hold(id);
    const replacing = upload(env, env.team.editor, await jpeg(510, 360, { seed: seed++ }), "new.jpg", { purpose: "replace", mediaId: id });
    assert.ok(await stillWaiting(replacing));
    const restricting = restrictMedia(mctx(env, env.team.admin), id, "Race restriction");
    assert.ok(await stillWaiting(restricting));
    await held.release();
    const [replaced, restricted] = await Promise.all([replacing, restricting]);
    assert.equal(replaced.status, 201);
    assert.equal(restricted.kind, "ok");
    assert.equal((await row(id)).usage_status, "restricted");
    assert.equal(await published(id), false);
  });

  test("two replacements at once: both versions kept, the newer is current", async () => {
    const id = await readyImage(true);
    const held = await hold(id);
    const first = upload(env, env.team.editor, await jpeg(520, 360, { seed: seed++ }), "a.jpg", { purpose: "replace", mediaId: id });
    assert.ok(await stillWaiting(first));
    const second = upload(env, env.team.admin, await jpeg(530, 360, { seed: seed++ }), "b.jpg", { purpose: "replace", mediaId: id });
    assert.ok(await stillWaiting(second));
    await held.release();
    const results = await Promise.all([first, second]);
    for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));
    const files = await query<{ id: string; version: number; processing_status: string; superseded_at: unknown }>(env, "SELECT id, version, processing_status, superseded_at FROM media_files WHERE media_id = ? ORDER BY version", [id]);
    assert.deepEqual(
      files.map((f) => [f.version, f.processing_status]),
      [
        [1, "ready"],
        [2, "ready"],
        [3, "ready"],
      ],
    );
    assert.equal((await row(id)).current_file_id, files[2].id, "the highest version is current, whatever finished last");
    assert.ok(files[0].superseded_at && files[1].superseded_at);
    assert.equal((await row(id)).usage_status, "pending_review");
  });

  test("restore a version vs a replacement: decided on the version the page showed", async () => {
    const id = await readyImage(true);
    const second = await upload(env, env.team.editor, await jpeg(540, 360, { seed: seed++ }), "v2.jpg", { purpose: "replace", mediaId: id });
    assert.equal(second.status, 201);
    const [v1] = await query<{ id: string }>(env, "SELECT id FROM media_files WHERE media_id = ? AND version = 1", [id]);
    const v = await version(id);
    const held = await hold(id);
    const replacing = upload(env, env.team.editor, await jpeg(550, 360, { seed: seed++ }), "v3.jpg", { purpose: "replace", mediaId: id });
    assert.ok(await stillWaiting(replacing));
    const restoring = restoreMediaVersion(mctx(env, env.team.admin), id, v1.id, v);
    assert.ok(await stillWaiting(restoring));
    await held.release();
    const [replaced, restored] = await Promise.all([replacing, restoring]);
    assert.equal(replaced.status, 201);
    assert.ok(["ok", "stale"].includes(restored.kind), restored.kind);
    const files = await query<{ id: string; version: number }>(env, "SELECT id, version FROM media_files WHERE media_id = ? ORDER BY version", [id]);
    assert.equal(files.length, 3, "nothing deleted");
    assert.equal((await row(id)).usage_status, "pending_review");
    assert.equal(await published(id), false);
  });

  test("clear vs clear-and-re-add: a stale clear never removes the newer flag", async () => {
    const id = await readyImage(false);
    await addMediaFlag(mctx(env, env.team.reviewer), id, "authorship_unconfirmed", "Race");
    const [f] = await query<{ created_at: string }>(env, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') AS created_at FROM media_flags WHERE media_id = ?", [id]);
    const token = mediaFlagToken(new Date(`${f.created_at.slice(0, 23).replace(" ", "T")}Z`));
    const [a, b] = await race(
      id,
      () => clearMediaFlag(mctx(env, env.team.owner), id, "authorship_unconfirmed", token, "First clear"),
      () => clearMediaFlag(mctx(env, env.team.admin), id, "authorship_unconfirmed", token, "Second clear"),
    );
    assert.deepEqual(kinds(a, b).sort(), ["ok", "stale"]);
    env.clock.advance(3);
    await addMediaFlag(mctx(env, env.team.reviewer), id, "authorship_unconfirmed", "Again");
    assert.equal((await clearMediaFlag(mctx(env, env.team.owner), id, "authorship_unconfirmed", token, "Stale page")).kind, "stale");
    assert.equal((await query(env, "SELECT 1 FROM media_flags WHERE media_id = ?", [id])).length, 1);
  });
});
