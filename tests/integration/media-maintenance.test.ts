/**
 * Media library (A4) — the maintenance tool (A4 brief §59–§62): its report (abandoned temporary uploads, stuck
 * processing, records whose files are missing, files without a record, entries that are not files, purge candidates,
 * `public_media` drift) and its repairs, each only when asked: never an unknown file deleted, never a file marked ready
 * without its bytes, a regeneration that never touches another version's files, and the report as an Admin may see it
 * (without private items). On a real MariaDB and a temporary RAWASY_DATA_DIR; synthetic files only.
 */
import assert from "node:assert/strict";
import { mkdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, afterEach, before, describe, test } from "node:test";
import { cleanTmp, failStuck, privateMediaIds, publicView, rebuildPublicMedia, regenerateVariants, reportHasProblems, scanMedia, type MaintenanceContext } from "../../src/server/media/maintenance.ts";
import { MEDIA_LIMITS } from "../../src/server/media/registry.ts";
import { approveMedia, updateMediaMetadata } from "../../src/server/media/service.ts";
import { ulid } from "../../src/server/security/ids.ts";
import { formOf, query } from "./cms-helpers.ts";
import { assertPublicMediaInvariant, jpeg, mctx, pdf, setupMediaEnv, upload, uploadOk, type MediaEnv } from "./media-helpers.ts";

let env: MediaEnv;
before(async () => {
  env = await setupMediaEnv("media_mnt");
});
afterEach(async () => {
  await assertPublicMediaInvariant(env);
});
after(async () => {
  await env.closeMedia();
});

const maintenance = (): MaintenanceContext => ({ pool: env.pool, db: env.deps.db, store: env.store, releaseDir: env.releaseDir, now: env.deps.clock(), actor: { type: "cli", label: "Test operator" } });
const version = async (id: string) => Number((await query<{ lock_version: number }>(env, "SELECT lock_version FROM media_assets WHERE id = ?", [id]))[0].lock_version);
const currentVariants = (id: string) =>
  query<{ storage_key: string; byte_size: number; file_id: string; variant_key: string }>(
    env,
    "SELECT v.storage_key, v.byte_size, v.file_id, v.variant_key FROM media_variants v JOIN media_assets a ON a.current_file_id = v.file_id WHERE a.id = ? ORDER BY v.width",
    [id],
  );
const published = async (id: string) => (await query(env, "SELECT 1 FROM public_media WHERE media_id = ?", [id])).length === 1;

let seed = 900;
async function approvedImage() {
  const id = await uploadOk(env, env.team.editor, await jpeg(800, 500, { seed: seed++ }), `maintained-${seed}.jpg`);
  await updateMediaMetadata(mctx(env, env.team.editor), id, formOf({ lockVersion: String(await version(id)), "en.altMode": "decorative", "ar.altMode": "decorative" }));
  assert.equal((await approveMedia(mctx(env, env.team.admin), id, await version(id), "Maintenance test")).kind, "ok");
  return id;
}

async function certificate() {
  const id = ulid();
  await env.pool.query("INSERT INTO certificates (id, slug) VALUES (?, ?)", [id, `test-cert-${id.slice(-8).toLowerCase()}`]);
  return id;
}

describe("the report (A4 brief §61–§62): read-only", () => {
  test("a healthy library reports nothing to look at", async () => {
    await approvedImage();
    await uploadOk(env, env.team.owner, pdf("Synthetic private maintenance document"), "private.pdf", { purpose: "private_original", certificateId: await certificate() });
    const report = await scanMedia(maintenance());
    assert.equal(reportHasProblems(report), false, JSON.stringify(report, null, 2));
    assert.deepEqual([report.missing, report.orphans, report.notFiles, report.stuck, report.publicMediaDrift, report.tmp.abandoned], [[], [], [], [], [], []]);
  });

  test("missing files, files without a record and links are reported — and nothing on disk is deleted or changed", async () => {
    const id = await approvedImage();
    const w320 = (await currentVariants(id)).find((v) => v.variant_key === "w320")!;
    rmSync(join(env.store.areaRoot("derived"), w320.storage_key));
    const stray = join(env.store.areaRoot("derived"), id, "w320-0f0f0f0f.webp");
    writeFileSync(stray, "a file no record names");
    const linkName = "01BX5ZZKBKACTAV9WEVGEMMVR1";
    symlinkSync(env.releaseDir, join(env.store.areaRoot("derived"), linkName));
    try {
      const report = await scanMedia(maintenance());
      assert.ok(reportHasProblems(report));
      const missing = report.missing.find((m) => m.mediaId === id);
      assert.ok(missing, "the record whose file is gone");
      assert.ok(missing.what.some((w) => w.includes("w320")), JSON.stringify(missing));
      assert.ok(report.orphans.some((o) => o.area === "derived" && o.key === `${id}/w320-0f0f0f0f.webp`), "the stray file");
      assert.ok(report.notFiles.some((o) => o.area === "derived" && o.key === linkName), "the link, reported, not followed");
      // Every repair runs, and the unknown file and the link are still there afterwards.
      await cleanTmp(maintenance(), report);
      await failStuck(maintenance());
      await rebuildPublicMedia(maintenance());
      assert.equal((await env.store.sizeOf("derived", `${id}/w320-0f0f0f0f.webp`)), "a file no record names".length, "an unknown file is never deleted");
      assert.equal(await published(id), true, "the record is reported; the item is not silently changed");
      // Regenerating the item's sizes brings the missing file back under the same name (same version, same bytes).
      assert.equal(await regenerateVariants(maintenance(), id), "ok");
      assert.equal(await env.store.sizeOf("derived", w320.storage_key), Number(w320.byte_size));
      assert.equal((await scanMedia(maintenance())).missing.some((m) => m.mediaId === id), false);
    } finally {
      rmSync(stray, { force: true });
      rmSync(join(env.store.areaRoot("derived"), linkName), { force: true });
    }
  });

  test("stuck processing is reported and, when asked, marked failed: nothing becomes current or deliverable", async () => {
    const id = await approvedImage();
    const [current] = await query<{ current_file_id: string }>(env, "SELECT current_file_id FROM media_assets WHERE id = ?", [id]);
    const stuckId = ulid();
    const long = new Date(env.deps.clock().getTime() - MEDIA_LIMITS.stuckProcessingMs - 60_000);
    await env.pool.query(
      "INSERT INTO media_files (id, media_id, version, storage_area, storage_key, original_filename, mime_type, extension, byte_size, sha256, processing_status, uploaded_at, uploaded_by) SELECT ?, media_id, 2, storage_area, ?, 'stuck.jpg', mime_type, extension, byte_size, UNHEX(SHA2('stuck', 256)), 'processing', ?, uploaded_by FROM media_files WHERE id = ?",
      [stuckId, `2026/01/${stuckId}.jpg`, long, current.current_file_id],
    );
    const report = await scanMedia(maintenance());
    assert.ok(report.stuck.some((s) => s.fileId === stuckId));
    assert.equal(await failStuck(maintenance()), 1);
    const [row] = await query<{ processing_status: string }>(env, "SELECT processing_status FROM media_files WHERE id = ?", [stuckId]);
    assert.equal(row.processing_status, "failed");
    const [after_] = await query<{ current_file_id: string }>(env, "SELECT current_file_id FROM media_assets WHERE id = ?", [id]);
    assert.equal(after_.current_file_id, current.current_file_id);
    assert.equal(await published(id), true);
  });

  test("temporary uploads older than 24 hours are abandoned; only those are removed, when asked", async () => {
    const old = ulid(env.deps.clock().getTime() - 2 * 86_400_000);
    const young = ulid(env.deps.clock().getTime());
    for (const uploadId of [old, young]) {
      mkdirSync(join(env.store.areaRoot("tmp"), uploadId), { recursive: true });
      writeFileSync(join(env.store.areaRoot("tmp"), uploadId, "manifest.json"), "{}");
    }
    const past = (env.deps.clock().getTime() - 25 * 3_600_000) / 1000;
    utimesSync(join(env.store.areaRoot("tmp"), old, "manifest.json"), past, past);
    const report = await scanMedia(maintenance());
    assert.deepEqual(report.tmp.abandoned.map((a) => a.uploadId), [old]);
    assert.equal(await cleanTmp(maintenance(), report), 1);
    const left = (await env.store.listArea("tmp")).files;
    assert.ok(!left.some((k) => k.startsWith(old)) && left.some((k) => k.startsWith(young)));
    rmSync(join(env.store.areaRoot("tmp"), young), { recursive: true, force: true });
  });

  test("public_media out of step is reported and rebuilt on request (the deliverability rule decides)", async () => {
    const id = await approvedImage();
    await env.pool.query("DELETE FROM public_media WHERE media_id = ?", [id]);
    const report = await scanMedia(maintenance());
    assert.deepEqual(report.publicMediaDrift.filter((d) => d.mediaId === id), [{ mediaId: id, expected: true, present: false }]);
    assert.ok((await rebuildPublicMedia(maintenance())) >= 1);
    assert.equal(await published(id), true);
  });

  test("old versions past 30 days are purge candidates — listed, never deleted", async () => {
    const id = await approvedImage();
    const [v1] = await currentVariants(id);
    assert.equal((await upload(env, env.team.editor, await jpeg(800, 500, { seed: seed++ }), "newer.jpg", { purpose: "replace", mediaId: id })).status, 201);
    env.clock.advance(MEDIA_LIMITS.versionRetentionMs + 86_400_000);
    try {
      const report = await scanMedia(maintenance());
      assert.ok(report.purgeCandidates.some((p) => p.mediaId === id && p.fileId === v1.file_id));
      assert.equal(await env.store.sizeOf("derived", v1.storage_key), Number(v1.byte_size), "nothing purged");
    } finally {
      env.clock.advance(-(MEDIA_LIMITS.versionRetentionMs + 86_400_000));
    }
  });
});

describe("regeneration (review M2): one version's files only", () => {
  test("regenerating the current version keeps every earlier version's files; regenerating twice changes nothing", async () => {
    const id = await approvedImage();
    const v1 = await currentVariants(id);
    assert.equal((await upload(env, env.team.editor, await jpeg(800, 500, { seed: seed++ }), "second.jpg", { purpose: "replace", mediaId: id })).status, 201);
    const v2 = await currentVariants(id);
    assert.equal(await regenerateVariants(maintenance(), id), "ok");
    assert.deepEqual((await currentVariants(id)).map((v) => v.storage_key), v2.map((v) => v.storage_key), "the same version and bytes: the same names");
    assert.equal(await regenerateVariants(maintenance(), id), "ok");
    for (const v of [...v1, ...v2]) assert.equal(await env.store.sizeOf("derived", v.storage_key), Number(v.byte_size), `kept: ${v.storage_key}`);
    assert.equal((await scanMedia(maintenance())).orphans.length, 0, "no file left without a record");
  });
});

describe("what an Admin is shown (review I3): no private item", () => {
  test("the dashboard's view of the report leaves out private items and the private area; the Owner's keeps them", async () => {
    const privateId = await uploadOk(env, env.team.owner, pdf("Synthetic private missing file"), "private.pdf", { purpose: "private_original", certificateId: await certificate() });
    const [file] = await query<{ storage_key: string }>(env, "SELECT f.storage_key FROM media_files f JOIN media_assets a ON a.current_file_id = f.id WHERE a.id = ?", [privateId]);
    const stray = join(env.store.areaRoot("private"), privateId, `${ulid()}.pdf`);
    rmSync(join(env.store.areaRoot("private"), file.storage_key));
    writeFileSync(stray, "an unknown private file");
    await env.pool.query("UPDATE media_files SET processing_status = 'failed' WHERE id = (SELECT current_file_id FROM media_assets WHERE id = ?)", [privateId]);
    try {
      const owner = await scanMedia(maintenance());
      assert.ok(owner.orphans.some((o) => o.area === "private"), "the Owner's report covers the private area");
      assert.ok(owner.failed >= 1 && (owner.failedPrivate ?? 0) >= 1);
      const admin = publicView(owner, await privateMediaIds(env.deps.db));
      assert.equal(JSON.stringify(admin).includes(privateId), false, "no private id");
      assert.equal(admin.orphans.some((o) => o.area === "private"), false);
      assert.equal(admin.failed, owner.failed - (owner.failedPrivate ?? 0));
    } finally {
      rmSync(stray, { force: true });
      await env.pool.query("DELETE FROM certificate_documents WHERE media_id = ?", [privateId]);
    }
  });
});
