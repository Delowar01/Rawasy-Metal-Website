/**
 * Media library (A4) — the upload protocol, the content checks and processing, on a real MariaDB and a temporary
 * RAWASY_DATA_DIR (A4 brief §24–§35, §71–§73): chunks and their owner, limits, signatures and polyglots, decompression
 * bombs, variants (widths, no upscale, orientation, no metadata, hashes, rows equal to files), duplicates without
 * leaking private items, and replacement. Every file here is synthetic, made at test time.
 */
import assert from "node:assert/strict";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import sharp from "sharp";
import { ulid } from "../../src/server/security/ids.ts";
import { MEDIA_LIMITS } from "../../src/server/media/registry.ts";
import { approveMedia, updateMediaMetadata } from "../../src/server/media/service.ts";
import { cancelUpload, completeUpload, openUpload, writePart } from "../../src/server/media/uploads.ts";
import { formOf, query } from "./cms-helpers.ts";
import { actorFor, createUser } from "./helpers.ts";
import { assertPublicMediaInvariant, avif, jpeg, mctx, once, pdf, png, pngBomb, setupMediaEnv, upload, uploadOk, webp, type MediaEnv } from "./media-helpers.ts";

let env: MediaEnv;
before(async () => {
  env = await setupMediaEnv("media_up");
});
after(async () => {
  await assertPublicMediaInvariant(env);
  await env.closeMedia();
});

const asset = async (id: string) => (await query<Record<string, unknown>>(env, "SELECT * FROM media_assets WHERE id = ?", [id]))[0];
const filesOf = (id: string) => query<Record<string, unknown>>(env, "SELECT * FROM media_files WHERE media_id = ? ORDER BY version", [id]);
const variantsOf = (fileId: string) => query<Record<string, unknown>>(env, "SELECT * FROM media_variants WHERE file_id = ? ORDER BY width", [fileId]);
const tmpEntries = () => readdirSync(env.store.areaRoot("tmp"));

/** Approves an item as the Admin after deciding its alt texts (the approval rule's preconditions). */
export async function approve(env_: MediaEnv, id: string) {
  const row = (await query<{ lock_version: number; kind: string }>(env_, "SELECT lock_version, kind FROM media_assets WHERE id = ?", [id]))[0];
  const meta = await updateMediaMetadata(
    mctx(env_, env_.team.admin),
    id,
    formOf({ lockVersion: String(row.lock_version), "en.title": "Test item", "ar.title": "عنصر تجريبي", "en.altMode": row.kind === "image" ? "decorative" : "undecided", "ar.altMode": row.kind === "image" ? "decorative" : "undecided" }),
  );
  assert.ok(meta.kind === "ok" || meta.kind === "unchanged", JSON.stringify(meta));
  const version = (await query<{ lock_version: number }>(env_, "SELECT lock_version FROM media_assets WHERE id = ?", [id]))[0].lock_version;
  const result = await approveMedia(mctx(env_, env_.team.admin), id, Number(version), "Synthetic test approval");
  assert.equal(result.kind, "ok", JSON.stringify(result));
}

describe("a new upload becomes a pending item with its variants", () => {
  test("an Editor's JPEG: original stored, widths not wider than the source, thumbnail, blur, hashes, no metadata, not public", async () => {
    const bytes = await jpeg(1500, 1000, { seed: 11 });
    const id = await uploadOk(env, env.team.editor, bytes, "workshop.JPG");
    const row = await asset(id);
    assert.equal(row.usage_status, "pending_review");
    assert.equal(row.visibility, "public");
    assert.equal(row.kind, "image");
    const [file] = await filesOf(id);
    assert.equal(file.processing_status, "ready");
    assert.equal(file.storage_area, "originals");
    assert.match(String(file.storage_key), /^\d{4}\/\d{2}\/[0-9A-HJKMNP-TV-Z]{26}\.jpg$/);
    assert.equal(file.original_filename, "workshop.JPG");
    assert.equal(file.mime_type, "image/jpeg");
    assert.equal(Number(file.byte_size), bytes.length);
    assert.deepEqual([file.width, file.height], [1500, 1000]);
    assert.match(String(file.blur_data_url), /^data:image\/webp;base64,/);
    assert.equal(row.current_file_id, file.id);
    const variants = await variantsOf(String(file.id));
    assert.deepEqual(
      variants.map((v) => [v.variant_key, v.width]),
      [
        ["thumb", 256],
        ["w320", 320],
        ["w640", 640],
        ["w1080", 1080],
      ],
    );
    for (const v of variants) {
      assert.match(String(v.storage_key), new RegExp(`^${id}/(thumb|w\\d+)-[0-9a-f]{8}\\.webp$`));
      const disk = await env.store.openRead("derived", String(v.storage_key));
      assert.ok(disk, "the variant is on disk");
      const data = await disk!.handle.readFile();
      await disk!.handle.close();
      assert.equal(data.length, Number(v.byte_size), "the row's size is the file's");
      const { createHash } = await import("node:crypto");
      assert.equal(createHash("sha256").update(data).digest("hex"), Buffer.from(v.sha256 as Buffer).toString("hex"), "the row's hash is the file's");
      assert.ok(String(v.storage_key).includes(createHash("sha256").update(data).digest("hex").slice(0, 8)), "the name carries the hash");
      const metaData = await sharp(data).metadata();
      assert.equal(metaData.format, "webp");
      assert.equal(metaData.exif, undefined, "no EXIF in a variant");
      assert.equal(metaData.icc, undefined, "no ICC profile copied");
      if (v.variant_key !== "thumb") assert.ok(Math.abs(Number(v.height) / Number(v.width) - 1000 / 1500) < 0.01, "aspect ratio kept");
    }
    assert.equal((await query(env, "SELECT 1 FROM public_media WHERE media_id = ?", [id])).length, 0, "pending: not public");
    assert.deepEqual(tmpEntries(), [], "the temporary upload is gone");
    const audit = await query<{ action: string; outcome: string }>(env, "SELECT action, outcome FROM audit_events WHERE entity_id = ? ORDER BY id", [id]);
    assert.deepEqual(audit.at(-1), { action: "media.upload", outcome: "success" });
  });

  test("the EXIF orientation is applied (a portrait photo stays portrait) and its metadata, GPS included, is not copied", async () => {
    const landscapeStored = await sharp(await jpeg(1200, 800, { seed: 12 }))
      .withExif({ IFD0: { Make: "SyntheticCam" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "21/1 29/1 0/1" } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const source = await sharp(landscapeStored).metadata();
    assert.equal(source.orientation, 6, "the fixture carries orientation 6");
    assert.ok(source.exif?.includes(Buffer.from("SyntheticCam")), "the fixture carries EXIF");
    assert.ok(source.exif?.includes(Buffer.from("N\0")), "the fixture carries a GPS tag");
    const id = await uploadOk(env, env.team.editor, landscapeStored, "rotated.jpg");
    const [file] = await filesOf(id);
    assert.deepEqual([file.width, file.height], [800, 1200], "stored as displayed");
    for (const v of await variantsOf(String(file.id))) {
      const opened = await env.store.openRead("derived", String(v.storage_key));
      const data = await opened!.handle.readFile();
      await opened!.handle.close();
      const m = await sharp(data).metadata();
      assert.equal(m.exif, undefined, `no EXIF (GPS) in ${v.variant_key}`);
      assert.equal(m.orientation, undefined);
      if (v.variant_key !== "thumb") assert.ok(Number(v.height) > Number(v.width), `${v.variant_key} is portrait`);
    }
  });

  test("never an upscale: a 200 px image gets one variant at its own width; a 2500 px one stops at 2048", async () => {
    const small = await uploadOk(env, env.team.editor, await png(200, 100), "small.png");
    const [smallFile] = await filesOf(small);
    assert.deepEqual(
      (await variantsOf(String(smallFile.id))).map((v) => `${v.variant_key}:${v.width}`).sort(),
      ["thumb:200", "w200:200"],
    );
    const large = await uploadOk(env, env.team.editor, await jpeg(2500, 1000, { seed: 13 }), "large.jpeg");
    const [largeFile] = await filesOf(large);
    const keys = (await variantsOf(String(largeFile.id))).map((v) => v.variant_key);
    assert.deepEqual(keys.sort(), ["thumb", "w1080", "w1600", "w2048", "w320", "w640"].sort());
  });

  test("WebP, AVIF (AV1) and PDF are accepted; a PDF is a document without variants", async () => {
    const w = await uploadOk(env, env.team.editor, await webp(700, 500), "plate.webp");
    assert.equal((await filesOf(w))[0].mime_type, "image/webp");
    const a = await uploadOk(env, env.team.editor, await avif(640, 480), "plate.avif");
    assert.equal((await filesOf(a))[0].mime_type, "image/avif");
    const d = await uploadOk(env, env.team.editor, pdf(), "brochure.pdf");
    const row = await asset(d);
    assert.equal(row.kind, "document");
    const [file] = await filesOf(d);
    assert.equal(file.mime_type, "application/pdf");
    assert.equal((await variantsOf(String(file.id))).length, 0);
  });

  test("permissions: a Reviewer may not upload; a private original is not for an Admin or Editor (they don't know it exists)", async () => {
    const reviewer = await upload(env, env.team.reviewer, await png(50, 50), "x.png");
    assert.equal(reviewer.status, 403);
    const certificate = await newCertificate();
    for (const actor of [env.team.admin, env.team.editor, env.team.reviewer]) {
      const answer = await upload(env, actor, pdf(), "original.pdf", { purpose: "private_original", certificateId: certificate });
      assert.equal(answer.status, 404, "private uploads look absent");
    }
  });
});

let certificateCounter = 0;
export async function newCertificate(): Promise<string> {
  const id = ulid();
  await env.pool.query("INSERT INTO certificates (id, slug) VALUES (?, ?)", [id, `test-certificate-${++certificateCounter}-${id.slice(-6).toLowerCase()}`]);
  return id;
}

describe("chunks (A4 brief §72)", () => {
  /** A synthetic PDF longer than one part (comment lines pad it; the cross-reference offsets stay right). */
  const bigPdf = (bytes: number) => {
    const base = pdf("Synthetic multi-part test document").toString("latin1");
    const pad = `%${"x".repeat(78)}\n`.repeat(Math.ceil(bytes / 80));
    const withPad = base.replace("%PDF-1.4\n", `%PDF-1.4\n${pad}`);
    // Recompute the offsets after the padding.
    const shift = pad.length;
    return Buffer.from(
      withPad
        .replace(/(\d{10}) 00000 n /g, (_m, o) => `${String(Number(o) + shift).padStart(10, "0")} 00000 n `)
        .replace(/startxref\n(\d+)\n/, (_m, o) => `startxref\n${Number(o) + shift}\n`),
      "latin1",
    );
  };

  test("parts out of order and a part sent twice still assemble exactly", async () => {
    const bytes = bigPdf(9 * 1024 * 1024);
    const ctx = mctx(env, env.team.editor);
    const opened = await openUpload(ctx, env.store, { purpose: "new", filename: "long.pdf", size: bytes.length });
    assert.equal(opened.status, 201);
    const uploadId = String(opened.body!.uploadId);
    assert.equal(opened.body!.parts, 3);
    const part = (n: number) => bytes.subarray((n - 1) * MEDIA_LIMITS.chunkBytes, n * MEDIA_LIMITS.chunkBytes);
    for (const n of [3, 1, 2, 1]) assert.equal((await writePart(ctx, env.store, uploadId, String(n), String(part(n).length), once(part(n)))).status, 204);
    const done = await completeUpload(ctx, env.store, uploadId, {});
    assert.equal(done.status, 201, JSON.stringify(done.body));
    const [file] = await filesOf(String(done.body!.mediaId));
    const { createHash } = await import("node:crypto");
    assert.equal(Buffer.from(file.sha256 as Buffer).toString("hex"), createHash("sha256").update(bytes).digest("hex"));
  });

  test("a missing part: refused, the upload kept; once sent, it completes", async () => {
    const bytes = bigPdf(5 * 1024 * 1024);
    const ctx = mctx(env, env.team.editor);
    const opened = await openUpload(ctx, env.store, { purpose: "new", filename: "two.pdf", size: bytes.length });
    const uploadId = String(opened.body!.uploadId);
    const first = bytes.subarray(0, MEDIA_LIMITS.chunkBytes);
    await writePart(ctx, env.store, uploadId, "1", String(first.length), once(first));
    const missing = await completeUpload(ctx, env.store, uploadId, {});
    assert.equal(missing.status, 400);
    assert.match(String(missing.body!.error), /Part 2 is missing/);
    const second = bytes.subarray(MEDIA_LIMITS.chunkBytes);
    assert.equal((await writePart(ctx, env.store, uploadId, "2", String(second.length), once(second))).status, 204);
    assert.equal((await completeUpload(ctx, env.store, uploadId, {})).status, 201);
  });

  test("part lengths: too large, too short, no length, a body longer than its length, bad part numbers", async () => {
    const ctx = mctx(env, env.team.editor);
    const opened = await openUpload(ctx, env.store, { purpose: "new", filename: "sizes.pdf", size: MEDIA_LIMITS.chunkBytes + 10 });
    const uploadId = String(opened.body!.uploadId);
    const four = Buffer.alloc(MEDIA_LIMITS.chunkBytes, 0x25);
    assert.equal((await writePart(ctx, env.store, uploadId, "1", String(four.length + 1), once(Buffer.alloc(four.length + 1)))).status, 413);
    assert.equal((await writePart(ctx, env.store, uploadId, "1", "100", once(Buffer.alloc(100)))).status, 400);
    assert.equal((await writePart(ctx, env.store, uploadId, "1", null, once(four))).status, 411);
    assert.equal((await writePart(ctx, env.store, uploadId, "2", "10", once(Buffer.alloc(11)))).status, 413, "more bytes than announced are refused");
    for (const bad of ["0", "3", "1a", "-1", "01", "99"]) assert.equal((await writePart(ctx, env.store, uploadId, bad, "10", once(Buffer.alloc(10)))).status, 400, bad);
    assert.deepEqual(readdirSync(join(env.store.areaRoot("tmp"), uploadId)).sort(), ["manifest.json"], "nothing partial was kept");
    assert.equal((await cancelUpload(ctx, env.store, uploadId)).status, 204);
  });

  test("another user, or another session of the same user, can't append, complete or cancel (404, never a hint)", async () => {
    const owner = mctx(env, env.team.editor);
    const opened = await openUpload(owner, env.store, { purpose: "new", filename: "mine.png", size: 100 });
    const uploadId = String(opened.body!.uploadId);
    const editorUser = await createUser(env, { roles: ["editor"], name: "Test Other Editor" });
    const other = mctx(env, await actorFor(env, editorUser));
    const sameUserNewSession = mctx(env, { ...(await actorFor(env, { id: env.team.editor.user.id, email: env.team.editor.user.email, password: "", roles: ["editor"] })) });
    for (const ctx of [other, sameUserNewSession, mctx(env, env.team.owner)]) {
      assert.equal((await writePart(ctx, env.store, uploadId, "1", "100", once(Buffer.alloc(100)))).status, 404);
      assert.equal((await completeUpload(ctx, env.store, uploadId, {})).status, 404);
      assert.equal((await cancelUpload(ctx, env.store, uploadId)).status, 404);
    }
    for (const guess of [ulid(), "../../etc", "01ARZ3NDEKTSV4RRFFQ69G5FA", "%2e%2e"]) assert.equal((await completeUpload(owner, env.store, guess, {})).status, 404);
    assert.equal((await cancelUpload(owner, env.store, uploadId)).status, 204);
  });

  test("a session rotated during the upload keeps it (the new token of the same session lineage)", async () => {
    const editor = env.team.editor;
    const ctx = mctx(env, editor);
    const bytes = await png(64, 64, 9);
    const opened = await openUpload(ctx, env.store, { purpose: "new", filename: "rotated.png", size: bytes.length });
    const uploadId = String(opened.body!.uploadId);
    const successor = await actorFor(env, { id: editor.user.id, email: editor.user.email, password: "", roles: ["editor"] });
    await env.pool.query("UPDATE sessions SET revoked_at = ?, revoked_reason = 'rotated', replaced_by_id = ? WHERE id = ?", [env.deps.clock(), successor.session.id, editor.session.id]);
    const next = mctx(env, successor);
    assert.equal((await writePart(next, env.store, uploadId, "1", String(bytes.length), once(bytes))).status, 204);
    assert.equal((await completeUpload(next, env.store, uploadId, {})).status, 201);
    // Restore the team's session for later tests.
    await env.pool.query("UPDATE sessions SET revoked_at = NULL, revoked_reason = NULL, replaced_by_id = NULL WHERE id = ?", [editor.session.id]);
  });

  test("complete twice, cancel twice, cancel while completing", async () => {
    const ctx = mctx(env, env.team.editor);
    const bytes = await png(40, 40, 21);
    const done = await upload(env, env.team.editor, bytes, "twice.png");
    assert.equal(done.status, 201);
    assert.equal((await completeUpload(ctx, env.store, done.uploadId!, {})).status, 404, "the second complete finds nothing");
    const opened = await openUpload(ctx, env.store, { purpose: "new", filename: "cancel.png", size: 10 });
    const uploadId = String(opened.body!.uploadId);
    writeFileSync(join(env.store.areaRoot("tmp"), uploadId, "complete.lock"), "");
    assert.equal((await cancelUpload(ctx, env.store, uploadId)).status, 409, "not while completing");
    assert.equal((await completeUpload(ctx, env.store, uploadId, {})).status, 409, "one completion at a time");
    const { rmSync } = await import("node:fs");
    rmSync(join(env.store.areaRoot("tmp"), uploadId, "complete.lock"));
    assert.equal((await cancelUpload(ctx, env.store, uploadId)).status, 204);
    assert.equal((await cancelUpload(ctx, env.store, uploadId)).status, 404);
  });

  test("an expired upload answers 410 and is cleaned up; a part tampered on disk is refused at completion", async () => {
    const ctx = mctx(env, env.team.editor);
    const opened = await openUpload(ctx, env.store, { purpose: "new", filename: "late.png", size: 10 });
    const uploadId = String(opened.body!.uploadId);
    env.clock.advance(MEDIA_LIMITS.uploadTtlMs + 1000);
    try {
      assert.equal((await writePart(ctx, env.store, uploadId, "1", "10", once(Buffer.alloc(10)))).status, 410);
      assert.ok(!tmpEntries().includes(uploadId), "the expired upload's folder is gone");
    } finally {
      env.clock.advance(-(MEDIA_LIMITS.uploadTtlMs + 1000));
    }
    const bytes = await png(30, 30, 31);
    const second = await openUpload(ctx, env.store, { purpose: "new", filename: "tamper.png", size: bytes.length });
    const id2 = String(second.body!.uploadId);
    assert.equal((await writePart(ctx, env.store, id2, "1", String(bytes.length), once(bytes))).status, 204);
    writeFileSync(join(env.store.areaRoot("tmp"), id2, "part-1"), Buffer.concat([bytes, Buffer.from("extra")]));
    const done = await completeUpload(ctx, env.store, id2, {});
    assert.equal(done.status, 400);
    assert.match(String(done.body!.error), /wrong length/);
    await cancelUpload(ctx, env.store, id2);
  });

  test("limits: 20 MiB declared, 5 open uploads per user, 60 new uploads per hour", async () => {
    const ctx = mctx(env, await actorFor(env, await createUser(env, { roles: ["editor"], name: "Test Busy Editor" })));
    assert.equal((await openUpload(ctx, env.store, { purpose: "new", filename: "huge.jpg", size: MEDIA_LIMITS.maxBytes + 1 })).status, 413);
    assert.equal((await openUpload(ctx, env.store, { purpose: "new", filename: "empty.jpg", size: 0 })).status, 400);
    const open: string[] = [];
    for (let i = 0; i < 5; i++) {
      const answer = await openUpload(ctx, env.store, { purpose: "new", filename: `slot-${i}.png`, size: 10 });
      assert.equal(answer.status, 201);
      open.push(String(answer.body!.uploadId));
    }
    assert.equal((await openUpload(ctx, env.store, { purpose: "new", filename: "sixth.png", size: 10 })).status, 409);
    assert.equal((await cancelUpload(ctx, env.store, open.pop()!)).status, 204);
    const again = await openUpload(ctx, env.store, { purpose: "new", filename: "again.png", size: 10 });
    assert.equal(again.status, 201, "a cancelled upload frees its slot");
    open.push(String(again.body!.uploadId));
    for (const id of open) await cancelUpload(ctx, env.store, id);
    // 60 per hour: this user has opened 7 so far in this window.
    let status = 201;
    let opened = 7;
    while (status === 201 && opened < 70) {
      const answer = await openUpload(ctx, env.store, { purpose: "new", filename: "hourly.png", size: 10 });
      status = answer.status;
      if (status === 201) await cancelUpload(ctx, env.store, String(answer.body!.uploadId));
      opened++;
    }
    assert.equal(status, 429);
    assert.equal(opened, MEDIA_LIMITS.uploadsPerHour + 1);
  });
});

describe("content checks (A4 brief §28, §71): the bytes decide, never the name or the browser", () => {
  const refused = async (bytes: Buffer, name: string, status: number, pattern?: RegExp) => {
    const answer = await upload(env, env.team.editor, bytes, name);
    assert.equal(answer.status, status, `${name}: ${JSON.stringify(answer.body)}`);
    if (pattern) assert.match(String(answer.body!.error), pattern);
  };

  test("a type the extension does not allow is refused before any byte is read", async () => {
    for (const name of ["logo.svg", "anim.gif", "photo.heic", "photo.heif", "scan.tiff", "scan.tif", "clip.mp4", "page.html", "data.xml", "archive.zip", "tool.exe", "letter.docx", "plan.dwg", "plan.dxf", "part.step", "noextension"]) {
      await refused(Buffer.from("x"), name, 415);
    }
  });

  test("renamed and forged files are refused: PNG as .jpg, JPEG as .png, HTML or SVG as .jpg, fake WebP, fake AVIF", async () => {
    await refused(await png(20, 20), "photo.jpg", 422, /content is PNG/);
    await refused(await jpeg(20, 20), "photo.png", 422, /content is JPEG/);
    await refused(Buffer.from("<!doctype html><script>alert(1)</script>"), "photo.jpg", 422);
    await refused(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "photo.jpg", 422);
    const fakeWebp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([40, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(32, 7)]);
    await refused(fakeWebp, "photo.webp", 422);
    const ftyp = Buffer.alloc(24);
    ftyp.writeUInt32BE(24, 0);
    ftyp.write("ftypavif", 4, "latin1");
    ftyp.write("mif1avif", 16, "latin1");
    await refused(Buffer.concat([ftyp, Buffer.alloc(64, 3)]), "photo.avif", 422);
    const heicAsAvif = Buffer.from(ftyp);
    heicAsAvif.write("heic", 8, "latin1");
    heicAsAvif.write("mif1heic", 16, "latin1");
    await refused(heicAsAvif, "photo.avif", 422);
  });

  test("a damaged PDF is refused (no end marker, or no cross-reference before it)", async () => {
    const good = pdf().toString("latin1");
    await refused(Buffer.from(good.replace("%%EOF\n", ""), "latin1"), "doc.pdf", 422, /end-of-file/);
    await refused(Buffer.from(good.replace(/startxref\n\d+\n/, ""), "latin1"), "doc.pdf", 422, /cross-reference/);
    await refused(Buffer.from("%PDF-1.4\n%%EOF", "latin1"), "doc.pdf", 422);
  });

  test("a decompression bomb (a tiny file announcing 400 megapixels) is refused before it is decoded", async () => {
    const bomb = pngBomb();
    assert.ok(bomb.length < 200_000, "the file itself is small");
    await refused(bomb, "bomb.png", 422, /megapixels/);
  });

  test("a truncated image passes the header check but not the decoding: refused, nothing stored, nothing public", async () => {
    const full = await jpeg(900, 600, { seed: 41 });
    const truncated = full.subarray(0, Math.floor(full.length * 0.6));
    const answer = await upload(env, env.team.editor, truncated, "cut.jpg");
    assert.equal(answer.status, 422);
    const mediaId = String(answer.body!.mediaId);
    const [file] = await filesOf(mediaId);
    assert.equal(file.processing_status, "failed");
    assert.ok(String(file.processing_error).length > 0 && !String(file.processing_error).includes("/"), "a safe reason, no path");
    assert.equal(await env.store.sizeOf("originals", String(file.storage_key)), null, "the original was removed");
    assert.equal((await asset(mediaId)).current_file_id, null);
    assert.deepEqual(tmpEntries(), []);
  });

  test("a polyglot (a JPEG with an HTML page appended) is accepted only as pixels: its variants hold none of the page", async () => {
    const page = Buffer.from("<html><body><script>alert('polyglot')</script></body></html>");
    const id = await uploadOk(env, env.team.editor, Buffer.concat([await jpeg(400, 300, { seed: 42 }), page]), "poly.jpg");
    const [file] = await filesOf(id);
    for (const v of await variantsOf(String(file.id))) {
      const opened = await env.store.openRead("derived", String(v.storage_key));
      const data = await opened!.handle.readFile();
      await opened!.handle.close();
      assert.equal(data.includes(Buffer.from("script")), false, "re-encoded: no trace of the appended page");
    }
  });

  test("a file name never forms a path: traversal, separators, control and direction characters are shown cleaned", async () => {
    const id = await uploadOk(env, env.team.editor, await png(30, 30, 51), "..\\..\\..\\etc/pass‮wd\u0007.png");
    const [file] = await filesOf(id);
    assert.equal(file.original_filename, "pass" + "wd.png");
    assert.match(String(file.storage_key), /^\d{4}\/\d{2}\/[0-9A-HJKMNP-TV-Z]{26}\.png$/);
  });
});

describe("duplicates (A4 brief §35): offered for reuse, never a private item to someone who may not know it", () => {
  test("the same bytes are offered as the existing item; reuse leaves nothing behind; upload anyway makes a separate item", async () => {
    const bytes = await png(70, 70, 61);
    const first = await uploadOk(env, env.team.editor, bytes, "first.png");
    const ctx = mctx(env, env.team.editor);
    const opened = await openUpload(ctx, env.store, { purpose: "new", filename: "second.png", size: bytes.length });
    const uploadId = String(opened.body!.uploadId);
    await writePart(ctx, env.store, uploadId, "1", String(bytes.length), once(bytes));
    const asked = await completeUpload(ctx, env.store, uploadId, {});
    assert.equal(asked.status, 409);
    assert.deepEqual((asked.body!.duplicates as { id: string }[]).map((d) => d.id), [first]);
    // "Use the existing item": the browser cancels; the duplicate bytes go.
    assert.equal((await cancelUpload(ctx, env.store, uploadId)).status, 204);
    assert.deepEqual(tmpEntries(), []);
    const anyway = await upload(env, env.team.editor, bytes, "third.png", { keepDuplicate: true });
    assert.equal(anyway.status, 201);
    assert.notEqual(anyway.body!.mediaId, first);
  });

  test("a private original's bytes are never offered to an Editor or Admin; the Owner sees the match", async () => {
    const certificate = await newCertificate();
    const bytes = pdf("Synthetic private original for the duplicate test");
    const privateId = await uploadOk(env, env.team.owner, bytes, "original.pdf", { purpose: "private_original", certificateId: certificate });
    assert.equal((await asset(privateId)).visibility, "private");
    // The Editor's upload is the first public copy: no duplicate question (the private item stays unknown).
    const editor = await upload(env, env.team.editor, bytes, "copy.pdf");
    assert.equal(editor.status, 201, "no duplicate question: the private item stays unknown");
    const publicCopy = String(editor.body!.mediaId);
    // The Admin is offered the Editor's public copy — never the private original.
    const admin = await upload(env, env.team.admin, bytes, "copy.pdf");
    assert.equal(admin.status, 409);
    assert.deepEqual((admin.body!.duplicates as { id: string }[]).map((d) => d.id), [publicCopy]);
    assert.ok(!JSON.stringify(admin.body).includes(privateId));
    await cancelUpload(mctx(env, env.team.admin), env.store, admin.uploadId!);
    const owner = await upload(env, env.team.owner, bytes, "copy.pdf");
    assert.equal(owner.status, 409);
    assert.ok((owner.body!.duplicates as { id: string }[]).some((d) => d.id === privateId), "the Owner is warned the file equals a private document");
    await cancelUpload(mctx(env, env.team.owner), env.store, owner.uploadId!);
  });
});

describe("replacement (A4 brief §33; Owner decision 8)", () => {
  test("the old version stays live until the new one is ready; then the item returns to review and is withdrawn", async () => {
    const id = await uploadOk(env, env.team.editor, await jpeg(800, 600, { seed: 71 }), "v1.jpg");
    await approve(env, id);
    assert.equal((await query(env, "SELECT 1 FROM public_media WHERE media_id = ?", [id])).length, 1);
    const replaced = await upload(env, env.team.editor, await jpeg(900, 600, { seed: 72 }), "v2.jpg", { purpose: "replace", mediaId: id });
    assert.equal(replaced.status, 201, JSON.stringify(replaced.body));
    const row = await asset(id);
    assert.equal(row.usage_status, "pending_review", "reapproval always required");
    assert.equal(row.approved_at, null);
    const files = await filesOf(id);
    assert.deepEqual(
      files.map((f) => [f.version, f.processing_status]),
      [
        [1, "ready"],
        [2, "ready"],
      ],
    );
    assert.equal(row.current_file_id, files[1].id);
    assert.ok(files[0].superseded_at, "the old version's retention clock starts");
    assert.equal((await query(env, "SELECT 1 FROM public_media WHERE media_id = ?", [id])).length, 0, "withdrawn until approved again");
    await assertPublicMediaInvariant(env);
  });

  test("a failed replacement leaves the item exactly as it was (still approved and delivered)", async () => {
    const id = await uploadOk(env, env.team.editor, await jpeg(700, 500, { seed: 73 }), "keep.jpg");
    await approve(env, id);
    const before = await asset(id);
    const broken = (await jpeg(700, 500, { seed: 74 })).subarray(0, 900);
    const answer = await upload(env, env.team.editor, broken, "broken.jpg", { purpose: "replace", mediaId: id });
    assert.equal(answer.status, 422);
    const after_ = await asset(id);
    assert.equal(after_.usage_status, "approved");
    assert.equal(after_.current_file_id, before.current_file_id);
    assert.equal(after_.lock_version, before.lock_version);
    assert.equal((await query(env, "SELECT 1 FROM public_media WHERE media_id = ?", [id])).length, 1, "still delivered");
    const files = await filesOf(id);
    assert.equal(files.at(-1)!.processing_status, "failed");
  });

  test("a replacement keeps the kind; identical bytes are refused; a Reviewer may not replace", async () => {
    const bytes = await jpeg(300, 200, { seed: 75 });
    const id = await uploadOk(env, env.team.editor, bytes, "same.jpg");
    assert.equal((await upload(env, env.team.editor, pdf(), "other.pdf", { purpose: "replace", mediaId: id })).status, 415);
    const identical = await upload(env, env.team.editor, bytes, "same-again.jpg", { purpose: "replace", mediaId: id });
    assert.equal(identical.status, 409);
    assert.match(String(identical.body!.error), /identical/);
    assert.equal((await upload(env, env.team.reviewer, await jpeg(300, 200, { seed: 76 }), "r.jpg", { purpose: "replace", mediaId: id })).status, 403);
  });
});
