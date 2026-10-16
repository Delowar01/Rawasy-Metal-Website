/**
 * Media library (A4) — delivery (A4 brief §44–§48, §69, §74, §75): the public address serves exactly the deliverable
 * item's current variants (or document) with the right headers, withdraws at once, answers 503 when the database
 * cannot answer; private originals are never public and reach only the Owner with a step-up, every download audited;
 * admin previews exist only for public-class images. Synthetic files only.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, afterEach, before, describe, test } from "node:test";
import { resolvePreview } from "../../src/server/media/delivery.ts";
import { auditDownload, decideDownload } from "../../src/server/media/download.ts";
import { answerPublic } from "../../src/server/media/public-delivery.ts";
import { addMediaFlag, approveMedia, clearMediaFlag, mediaFlagToken, updateMediaMetadata } from "../../src/server/media/service.ts";
import { openTarget } from "../../src/server/media/stream.ts";
import type { Db } from "../../src/server/db/client.ts";
import { ulid } from "../../src/server/security/ids.ts";
import { formOf, query } from "./cms-helpers.ts";
import { assertPublicMediaInvariant, jpeg, mctx, pdf, setupMediaEnv, upload, uploadOk, type MediaEnv } from "./media-helpers.ts";

let env: MediaEnv;
before(async () => {
  env = await setupMediaEnv("media_del");
});
afterEach(async () => {
  await assertPublicMediaInvariant(env);
});
after(async () => {
  await env.closeMedia();
});

let seed = 700;
const version = async (id: string) => Number((await query<{ lock_version: number }>(env, "SELECT lock_version FROM media_assets WHERE id = ?", [id]))[0].lock_version);

async function approvedImage() {
  const id = await uploadOk(env, env.team.editor, await jpeg(800, 500, { seed: seed++ }), `deliver-${seed}.jpg`);
  await updateMediaMetadata(mctx(env, env.team.editor), id, formOf({ lockVersion: String(await version(id)), "en.altMode": "decorative", "ar.altMode": "decorative" }));
  assert.equal((await approveMedia(mctx(env, env.team.admin), id, await version(id), "Delivery test")).kind, "ok");
  return id;
}

const ask = (id: string, name: string, extra: { ifNoneMatch?: string; head?: boolean; db?: () => Db } = {}) =>
  answerPublic({ db: extra.db ?? (() => env.deps.db), store: env.media.store, releaseDir: env.releaseDir, id, name, ifNoneMatch: extra.ifNoneMatch ?? null, head: extra.head ?? false });

async function bodyOf(stream: ReadableStream<Uint8Array> | null) {
  assert.ok(stream);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const variantNames = async (id: string) =>
  (
    await query<{ storage_key: string; variant_key: string; sha256: Buffer }>(
      env,
      "SELECT v.storage_key, v.variant_key, v.sha256 FROM media_variants v JOIN media_assets a ON a.current_file_id = v.file_id WHERE a.id = ? ORDER BY v.width",
      [id],
    )
  ).map((v) => ({ name: v.storage_key.slice(27), key: v.variant_key, sha: Buffer.from(v.sha256).toString("hex") }));

describe("public delivery (A4 brief §45, §74)", () => {
  test("200 with the variant's bytes, exact type and length, ETag, a year of immutable caching, nosniff, inline; HEAD; 304", async () => {
    const id = await approvedImage();
    const [w320] = (await variantNames(id)).filter((v) => v.key === "w320");
    const answer = await ask(id, w320.name);
    assert.equal(answer.status, 200);
    const bytes = await bodyOf(answer.body);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), w320.sha);
    assert.equal(answer.headers["Content-Type"], "image/webp");
    assert.equal(answer.headers["Content-Length"], String(bytes.length));
    assert.equal(answer.headers.ETag, `"${w320.sha}"`);
    assert.equal(answer.headers["Cache-Control"], "public, max-age=31536000, immutable");
    assert.equal(answer.headers["X-Content-Type-Options"], "nosniff");
    assert.equal(answer.headers["Content-Disposition"], "inline");
    assert.ok(!("Set-Cookie" in answer.headers));
    const head = await ask(id, w320.name, { head: true });
    assert.equal(head.status, 200);
    assert.equal(head.body, null);
    const cached = await ask(id, w320.name, { ifNoneMatch: `"${w320.sha}"` });
    assert.equal(cached.status, 304);
    assert.equal(cached.body, null);
  });

  test("never the original, the admin thumbnail, another item's variant or a name outside the grammar", async () => {
    const id = await approvedImage();
    const names = await variantNames(id);
    const thumb = names.find((v) => v.key === "thumb")!;
    assert.equal((await ask(id, thumb.name)).status, 404, "the admin thumbnail is not public");
    const other = await approvedImage();
    const foreign = (await variantNames(other)).find((v) => v.key === "w320")!;
    assert.equal((await ask(id, foreign.name)).status, 404, "a variant of another item under this id");
    const [file] = await query<{ storage_key: string }>(env, "SELECT f.storage_key FROM media_files f JOIN media_assets a ON a.current_file_id = f.id WHERE a.id = ?", [id]);
    for (const bad of [
      file.storage_key,
      file.storage_key.split("/").pop()!,
      "w320-00000000.webp",
      "../w320-00000000.webp",
      "w320-ABCDEF01.webp",
      "w320-0000000.webp",
      "w99999-00000000.webp",
      "thumb.webp",
      "document-00000000.pdf",
      "w320-00000000.jpg",
      "",
      "a".repeat(500),
    ]) {
      assert.equal((await ask(id, bad)).status, 404, bad);
    }
    for (const badId of ["", "x", "../..", id.toLowerCase(), `${id}A`, "%2e%2e"]) assert.equal((await ask(badId, names[1].name)).status, 404, badId);
  });

  test("a blocking flag withdraws at once; cleared and approved again, only the current version's variants are served", async () => {
    const id = await approvedImage();
    const old = (await variantNames(id)).find((v) => v.key === "w320")!;
    assert.equal((await ask(id, old.name)).status, 200);
    await addMediaFlag(mctx(env, env.team.reviewer), id, "contains_personal_data", "Delivery test");
    assert.equal((await ask(id, old.name)).status, 404, "withdrawn in the same transaction as the flag");
    const [f] = await query<{ created_at: string }>(env, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') AS created_at FROM media_flags WHERE media_id = ?", [id]);
    await clearMediaFlag(mctx(env, env.team.admin), id, "contains_personal_data", mediaFlagToken(new Date(`${f.created_at.slice(0, 23).replace(" ", "T")}Z`)), "Synthetic file has no personal data");
    assert.equal((await ask(id, old.name)).status, 200);
    // A replacement withdraws the item; the new hashed names are served only after the approval.
    const replaced = await upload(env, env.team.editor, await jpeg(820, 500, { seed: seed++ }), "v2.jpg", { purpose: "replace", mediaId: id });
    assert.equal(replaced.status, 201);
    const fresh = (await variantNames(id)).find((v) => v.key === "w320")!;
    assert.notEqual(fresh.name, old.name);
    assert.equal((await ask(id, old.name)).status, 404, "the old version is withdrawn");
    assert.equal((await ask(id, fresh.name)).status, 404, "pending review: not yet");
    await updateMediaMetadata(mctx(env, env.team.editor), id, formOf({ lockVersion: String(await version(id)), "en.altMode": "text", "en.alt": "Updated", "ar.altMode": "decorative" }));
    assert.equal((await approveMedia(mctx(env, env.team.admin), id, await version(id), "Approved again")).kind, "ok");
    assert.equal((await ask(id, fresh.name)).status, 200);
    assert.equal((await ask(id, old.name)).status, 404, "never an old version's variant");
  });

  test("a document is served as an attachment under its hashed name; the database unreachable answers 503", async () => {
    const doc = await uploadOk(env, env.team.editor, pdf("Synthetic public brochure"), "brochure.pdf");
    await updateMediaMetadata(mctx(env, env.team.editor), doc, formOf({ lockVersion: String(await version(doc)), "en.title": "Test brochure", "ar.title": "كتيب تجريبي" }));
    assert.equal((await approveMedia(mctx(env, env.team.owner), doc, await version(doc), "Public brochure test")).kind, "ok");
    const [pm] = await query<{ src: string }>(env, "SELECT src FROM public_media WHERE media_id = ?", [doc]);
    const name = pm.src.split("/").pop()!;
    const answer = await ask(doc, name);
    assert.equal(answer.status, 200);
    assert.equal(answer.headers["Content-Type"], "application/pdf");
    assert.equal(answer.headers["Content-Disposition"], `attachment; filename="${name}"`);
    assert.equal(answer.headers["Content-Security-Policy"], "default-src 'none'; sandbox");
    await bodyOf(answer.body);
    const broken = () => {
      throw new Error("ECONNREFUSED (synthetic)");
    };
    const down = await ask(doc, name, { db: broken as unknown as () => Db });
    assert.equal(down.status, 503);
    assert.equal(down.headers["Cache-Control"], "no-store");
    const failing = { select: () => { throw new Error("connection lost"); } } as unknown as Db;
    assert.equal((await ask(doc, name, { db: () => failing })).status, 503);
  });
});

async function certificate() {
  const id = ulid();
  await env.pool.query("INSERT INTO certificates (id, slug) VALUES (?, ?)", [id, `test-cert-${id.slice(-8).toLowerCase()}`]);
  return id;
}

describe("private originals (A4 brief §16, §49, §69, §75)", () => {
  test("stored under the private root, internal, linked to the certificate, no derivative, no public_media, no public address", async () => {
    const cert = await certificate();
    const id = await uploadOk(env, env.team.owner, pdf("Synthetic private original"), "original.pdf", { purpose: "private_original", certificateId: cert });
    const [row] = await query<Record<string, unknown>>(env, "SELECT a.visibility, a.usage_status, f.storage_area, f.storage_key FROM media_assets a JOIN media_files f ON f.id = a.current_file_id WHERE a.id = ?", [id]);
    assert.deepEqual([row.visibility, row.usage_status, row.storage_area], ["private", "internal", "private"]);
    assert.match(String(row.storage_key), new RegExp(`^${id}/[0-9A-HJKMNP-TV-Z]{26}\\.pdf$`));
    assert.equal((await query(env, "SELECT 1 FROM media_variants v JOIN media_files f ON f.id = v.file_id WHERE f.media_id = ?", [id])).length, 0);
    assert.deepEqual(await query(env, "SELECT role, locale FROM certificate_documents WHERE media_id = ?", [id]), [{ role: "private_original", locale: null }]);
    assert.equal((await query(env, "SELECT 1 FROM public_media WHERE media_id = ?", [id])).length, 0);
    for (const name of ["document-00000000.pdf", "w320-00000000.webp"]) assert.equal((await ask(id, name)).status, 404);
    assert.equal(await resolvePreview(env.deps.db, id, "thumb", null), null, "no preview, not even for the Owner");
    const image = await uploadOk(env, env.team.owner, await jpeg(400, 300, { seed: seed++ }), "scan.jpg", { purpose: "private_original", certificateId: cert });
    assert.equal((await query(env, "SELECT 1 FROM media_variants v JOIN media_files f ON f.id = v.file_id WHERE f.media_id = ?", [image])).length, 0, "a private image gets no derivative");
  });

  test("download: anonymous-like roles get 'not found', the Owner without a step-up is refused, with one it is served and audited", async () => {
    const cert = await certificate();
    const bytes = pdf("Synthetic private download");
    const id = await uploadOk(env, env.team.owner, bytes, "original.pdf", { purpose: "private_original", certificateId: cert });
    for (const actor of [env.team.editor, env.team.admin, env.team.reviewer]) assert.equal((await decideDownload(mctx(env, actor), id, null)).kind, "not_found");
    env.clock.advance(11 * 60_000);
    try {
      assert.equal((await decideDownload(mctx(env, env.team.owner), id, null)).kind, "step_up", "a step-up older than 10 minutes");
    } finally {
      env.clock.advance(-11 * 60_000);
    }
    const decision = await decideDownload(mctx(env, env.team.owner), id, null);
    assert.equal(decision.kind, "ok");
    if (decision.kind !== "ok") return;
    assert.equal(decision.file.area, "private");
    const opened = await openTarget(await env.media.store(), env.releaseDir, decision.file);
    assert.ok(opened);
    assert.deepEqual(await bodyOf(opened!.body), bytes);
    await auditDownload(mctx(env, env.team.owner), id, decision.file);
    const audit = await query<{ action: string; outcome: string }>(env, "SELECT action, outcome FROM audit_events WHERE entity_id = ? AND action LIKE 'media.%download' ORDER BY id", [id]);
    assert.deepEqual(
      audit.map((a) => `${a.action}:${a.outcome}`),
      ["media.download:denied", "media.download:denied", "media.download:denied", "media.download:denied", "media.private_download:success"],
    );
    const summaries = await query<{ summary: string }>(env, "SELECT summary FROM audit_events WHERE entity_id = ?", [id]);
    assert.ok(summaries.every((s) => !s.summary.includes("original.pdf")), "never the file's name in the log");
  });

  test("public-class originals: Owner and Admin (media.view_original); an Editor or Reviewer is denied", async () => {
    const id = await approvedImage();
    for (const actor of [env.team.editor, env.team.reviewer]) assert.equal((await decideDownload(mctx(env, actor), id, null)).kind, "denied");
    for (const actor of [env.team.owner, env.team.admin]) {
      const decision = await decideDownload(mctx(env, actor), id, null);
      assert.equal(decision.kind, "ok");
      if (decision.kind === "ok") assert.equal(decision.file.area, "originals");
    }
    assert.equal((await decideDownload(mctx(env, env.team.owner), id, ulid())).kind, "not_found", "an unknown version");
  });

  test("a private item can't be turned public: no path changes its visibility; the schema refuses a private approved row", async () => {
    const cert = await certificate();
    const id = await uploadOk(env, env.team.owner, pdf("Synthetic immutable private"), "original.pdf", { purpose: "private_original", certificateId: cert });
    await assert.rejects(env.pool.query("UPDATE media_assets SET usage_status = 'approved' WHERE id = ?", [id]), /ck_media_assets_private/);
    const replaced = await upload(env, env.team.owner, pdf("Synthetic replacement private"), "original-2.pdf", { purpose: "replace", mediaId: id });
    assert.equal(replaced.status, 201);
    const [row] = await query<{ visibility: string; storage_area: string }>(env, "SELECT a.visibility, f.storage_area FROM media_assets a JOIN media_files f ON f.id = a.current_file_id WHERE a.id = ?", [id]);
    assert.deepEqual([row.visibility, row.storage_area], ["private", "private"], "a replacement keeps the private class and root");
  });
});

describe("admin previews (A4 brief §47)", () => {
  test("thumbnail and mid-size variant of a public-class image; none for documents or private items", async () => {
    const id = await approvedImage();
    const thumb = await resolvePreview(env.deps.db, id, "thumb", null);
    assert.ok(thumb && thumb.key.includes("/thumb-"));
    const large = await resolvePreview(env.deps.db, id, "large", null);
    assert.ok(large && /\/w640-/.test(large.key), "the largest variant up to 1080 px");
    const doc = await uploadOk(env, env.team.editor, pdf("Synthetic preview document"), "p.pdf");
    assert.equal(await resolvePreview(env.deps.db, doc, "thumb", null), null);
    assert.equal(await resolvePreview(env.deps.db, "not-a-ulid", "thumb", null), null);
  });
});
