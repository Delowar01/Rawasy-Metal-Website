/**
 * Media library (A4) — rights and safety: flags, approval, restriction, archive, the Trash, version restore, metadata
 * and the role matrix (A4 brief §15–§21, §33–§34, §40–§43, §58, §65, §76–§77), with the `public_media` invariant
 * (§68) checked after every test. Synthetic files only.
 */
import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import {
  addMediaFlag,
  approveMedia,
  archiveMedia,
  clearMediaFlag,
  restoreMediaFromTrash,
  restoreMediaVersion,
  restrictMedia,
  trashMedia,
  unarchiveMedia,
  unrestrictMedia,
  updateMediaMetadata,
} from "../../src/server/media/service.ts";
import { mediaFlagToken } from "../../src/server/media/service.ts";
import { createFolder, folderTree } from "../../src/server/media/folders.ts";
import { formOf, query } from "./cms-helpers.ts";
import { assertPublicMediaInvariant, jpeg, mctx, pdf, setupMediaEnv, upload, uploadOk, type MediaEnv } from "./media-helpers.ts";

let env: MediaEnv;
before(async () => {
  env = await setupMediaEnv("media_st");
});
afterEach(async () => {
  await assertPublicMediaInvariant(env);
});
after(async () => {
  await env.closeMedia();
});

let seed = 100;
const image = async () => uploadOk(env, env.team.editor, await jpeg(640, 480, { seed: seed++ }), `photo-${seed}.jpg`);
const row = async (id: string) => (await query<Record<string, unknown>>(env, "SELECT * FROM media_assets WHERE id = ?", [id]))[0];
const version = async (id: string) => Number((await row(id)).lock_version);
const published = async (id: string) => (await query(env, "SELECT 1 FROM public_media WHERE media_id = ?", [id])).length === 1;
const flagToken = async (id: string, flag: string) => {
  const [f] = await query<{ created_at: string }>(env, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') AS created_at FROM media_flags WHERE media_id = ? AND flag = ?", [id, flag]);
  return mediaFlagToken(new Date(`${f.created_at.slice(0, 23).replace(" ", "T")}Z`));
};

/** Decides the alt texts (decorative) and titles, as an approver must before approving. */
async function prepare(id: string, kind: "image" | "document" = "image") {
  const result = await updateMediaMetadata(
    mctx(env, env.team.editor),
    id,
    formOf({
      lockVersion: String(await version(id)),
      "en.title": "Test title",
      "ar.title": "عنوان تجريبي",
      "en.altMode": kind === "image" ? "text" : "undecided",
      "en.alt": kind === "image" ? "A grey test rectangle" : "",
      "ar.altMode": kind === "image" ? "decorative" : "undecided",
    }),
  );
  assert.ok(result.kind === "ok" || result.kind === "unchanged", JSON.stringify(result));
}

const approveAs = async (id: string, actor = env.team.admin, note = "Checked synthetic test file") => approveMedia(mctx(env, actor), id, await version(id), note);

describe("approval (A4 brief §20, §42, §76)", () => {
  test("needs the alt decision in both languages, a note, no blocking flag, the current version; then the item is delivered", async () => {
    const id = await image();
    assert.equal((await approveAs(id)).kind, "refused", "no alt decision yet");
    await prepare(id);
    assert.equal((await approveMedia(mctx(env, env.team.admin), id, await version(id), "  ")).kind, "invalid", "a note is required");
    assert.equal((await approveMedia(mctx(env, env.team.admin), id, (await version(id)) - 1, "Stale page")).kind, "stale");
    const ok = await approveAs(id);
    assert.equal(ok.kind, "ok");
    assert.equal((await row(id)).usage_status, "approved");
    assert.equal((await row(id)).approval_note, "Checked synthetic test file");
    assert.ok(await published(id));
    const [pm] = await query<{ src: string; variants: unknown; default_alt: unknown }>(env, "SELECT src, variants, default_alt FROM public_media WHERE media_id = ?", [id]);
    assert.match(pm.src, new RegExp(`^/media/u/${id}/w640-[0-9a-f]{8}\\.webp$`), "the largest variant");
    const variants = typeof pm.variants === "string" ? JSON.parse(pm.variants) : pm.variants;
    assert.deepEqual(
      (variants as { width: number }[]).map((v) => v.width),
      [320, 640],
    );
    const alt = typeof pm.default_alt === "string" ? JSON.parse(pm.default_alt) : pm.default_alt;
    assert.deepEqual(alt, { en: "A grey test rectangle", ar: "" }, "decorative is an empty alt, not a missing one");
  });

  test("only Owner and Admin approve; an Editor or Reviewer is denied and audited", async () => {
    const id = await image();
    await prepare(id);
    for (const actor of [env.team.editor, env.team.reviewer]) {
      const result = await approveAs(id, actor);
      assert.equal(result.kind, "denied");
    }
    const denied = await query<{ outcome: string }>(env, "SELECT outcome FROM audit_events WHERE entity_id = ? AND action = 'media.approve'", [id]);
    assert.equal(denied.filter((d) => d.outcome === "denied").length, 2);
    assert.equal((await approveAs(id, env.team.owner)).kind, "ok");
  });

  test("a document needs its library title in both languages; a blocking flag refuses; an unknown flag blocks", async () => {
    const doc = await uploadOk(env, env.team.editor, pdf("Synthetic approval document"), "doc.pdf");
    assert.equal((await approveAs(doc)).kind, "refused");
    await prepare(doc, "document");
    const id = await image();
    await prepare(id);
    assert.equal((await addMediaFlag(mctx(env, env.team.reviewer), id, "rights_pending", "Synthetic reason")).kind, "ok");
    const refused = await approveAs(id);
    assert.equal(refused.kind, "refused");
    assert.match((refused as { message: string }).message, /Rights pending/);
    // A flag the code does not know (from data) blocks like any other.
    const other = await image();
    await prepare(other);
    await env.pool.query("INSERT INTO media_flags (media_id, flag, created_at) VALUES (?, 'future_flag', ?)", [other, env.deps.clock()]);
    assert.equal((await approveAs(other)).kind, "refused");
    assert.equal((await approveAs(doc)).kind, "ok", "a titled document is approved");
    assert.ok(await published(doc));
    const [pm] = await query<{ src: string }>(env, "SELECT src FROM public_media WHERE media_id = ?", [doc]);
    assert.match(pm.src, new RegExp(`^/media/u/${doc}/document-[0-9a-f]{8}\\.pdf$`));
  });

  test("approving a private item is impossible, even for the Owner", async () => {
    const certId = await newCertificate();
    const id = await uploadOk(env, env.team.owner, pdf("Synthetic private original"), "original.pdf", { purpose: "private_original", certificateId: certId });
    const result = await approveMedia(mctx(env, env.team.owner), id, await version(id), "Trying to publish a private file");
    assert.equal(result.kind, "refused");
    assert.equal((await row(id)).usage_status, "internal");
    assert.equal(await published(id), false);
  });
});

async function newCertificate(): Promise<string> {
  const { ulid } = await import("../../src/server/security/ids.ts");
  const id = ulid();
  await env.pool.query("INSERT INTO certificates (id, slug) VALUES (?, ?)", [id, `test-cert-${id.slice(-8).toLowerCase()}`]);
  return id;
}

describe("flags (A4 brief §15, §41, §43)", () => {
  test("any role adds a flag, never needing the page's version; a blocking flag withdraws an approved item at once", async () => {
    const id = await image();
    await prepare(id);
    await approveAs(id);
    assert.ok(await published(id));
    const before = await version(id);
    assert.equal((await addMediaFlag(mctx(env, env.team.reviewer), id, "ai_edited", "")).kind, "ok");
    assert.equal(await published(id), false, "withdrawn in the same transaction");
    assert.equal(await version(id), before, "flags do not move the version");
    assert.equal((await addMediaFlag(mctx(env, env.team.editor), id, "ai_edited", "")).kind, "unchanged");
    assert.equal((await addMediaFlag(mctx(env, env.team.editor), id, "not_a_flag", "")).kind, "invalid");
  });

  test("an informative flag (low resolution) does not withdraw; clearing needs Owner/Admin, a reason, and the flag the page showed", async () => {
    const id = await image();
    await prepare(id);
    await approveAs(id);
    assert.equal((await addMediaFlag(mctx(env, env.team.editor), id, "low_resolution", "")).kind, "ok");
    assert.ok(await published(id), "informative only");
    assert.equal((await addMediaFlag(mctx(env, env.team.editor), id, "third_party_branding", "Synthetic")).kind, "ok");
    assert.equal(await published(id), false);
    const token = await flagToken(id, "third_party_branding");
    assert.equal((await clearMediaFlag(mctx(env, env.team.editor), id, "third_party_branding", token, "Checked")).kind, "denied");
    assert.equal((await clearMediaFlag(mctx(env, env.team.admin), id, "third_party_branding", token, "")).kind, "invalid");
    assert.equal((await clearMediaFlag(mctx(env, env.team.admin), id, "third_party_branding", "123", "Checked the synthetic file")).kind, "stale");
    assert.equal((await clearMediaFlag(mctx(env, env.team.admin), id, "third_party_branding", token, "Checked the synthetic file")).kind, "ok");
    assert.ok(await published(id), "an approved item is delivered again once nothing blocks it");
    const audit = await query<{ action: string; changes: unknown }>(env, "SELECT action, changes FROM audit_events WHERE entity_id = ? AND action = 'media.flag_clear' AND outcome = 'success'", [id]);
    assert.match(typeof audit[0].changes === "string" ? audit[0].changes : JSON.stringify(audit[0].changes), /Checked the synthetic file/);
  });

  test("clear vs re-add: a flag cleared and added again since the page was opened is not cleared by that page", async () => {
    const id = await image();
    await addMediaFlag(mctx(env, env.team.reviewer), id, "rights_pending", "first");
    const oldToken = await flagToken(id, "rights_pending");
    assert.equal((await clearMediaFlag(mctx(env, env.team.owner), id, "rights_pending", oldToken, "Cleared once")).kind, "ok");
    env.clock.advance(5);
    await addMediaFlag(mctx(env, env.team.reviewer), id, "rights_pending", "again");
    assert.equal((await clearMediaFlag(mctx(env, env.team.owner), id, "rights_pending", oldToken, "Stale clear")).kind, "stale");
    assert.equal((await query(env, "SELECT 1 FROM media_flags WHERE media_id = ? AND flag = 'rights_pending'", [id])).length, 1);
  });
});

describe("restriction, archive, the Trash (A4 brief §17, §43, §58)", () => {
  test("restrict (Owner/Admin, no version needed) withdraws; lifting it needs the version and returns to review, never to approved", async () => {
    const id = await image();
    await prepare(id);
    await approveAs(id);
    const stale = (await version(id)) - 1;
    assert.equal((await restrictMedia(mctx(env, env.team.editor), id, "Synthetic reason")).kind, "denied", "Editors add flags instead");
    assert.equal((await restrictMedia(mctx(env, env.team.admin), id, "")).kind, "invalid");
    assert.equal((await restrictMedia(mctx(env, env.team.admin), id, "Synthetic rights question")).kind, "ok");
    assert.equal(await published(id), false);
    assert.equal((await row(id)).usage_status, "restricted");
    assert.equal((await unrestrictMedia(mctx(env, env.team.admin), id, stale, "Resolved")).kind, "stale");
    assert.equal((await unrestrictMedia(mctx(env, env.team.admin), id, await version(id), "Resolved the synthetic question")).kind, "ok");
    assert.equal((await row(id)).usage_status, "pending_review");
    assert.equal(await published(id), false, "approval is needed again");
    assert.equal((await approveAs(id)).kind, "ok");
  });

  test("archive and restore from the archive", async () => {
    const id = await image();
    await prepare(id);
    await approveAs(id);
    assert.equal((await archiveMedia(mctx(env, env.team.admin), id)).kind, "ok");
    assert.equal(await published(id), false);
    assert.equal((await unarchiveMedia(mctx(env, env.team.admin), id, await version(id), "Needed again")).kind, "ok");
    assert.equal((await row(id)).usage_status, "pending_review");
  });

  test("the Trash: withdraws at once and keeps everything; restored into review (restricted stays restricted)", async () => {
    const id = await image();
    await prepare(id);
    await approveAs(id);
    assert.equal((await trashMedia(mctx(env, env.team.editor), id)).kind, "denied", "Owner and Admin move to the Trash");
    assert.equal((await trashMedia(mctx(env, env.team.admin), id)).kind, "ok");
    assert.equal(await published(id), false);
    const files = await query(env, "SELECT 1 FROM media_files WHERE media_id = ?", [id]);
    assert.equal(files.length, 1, "files and versions stay");
    assert.equal((await approveAs(id)).kind, "refused", "nothing is approved in the Trash");
    assert.equal((await updateMediaMetadata(mctx(env, env.team.admin), id, formOf({ lockVersion: String(await version(id)) }))).kind, "refused", "read-only in the Trash");
    assert.equal((await restoreMediaFromTrash(mctx(env, env.team.admin), id, (await version(id)) - 1)).kind, "stale");
    assert.equal((await restoreMediaFromTrash(mctx(env, env.team.admin), id, await version(id))).kind, "ok");
    assert.equal((await row(id)).usage_status, "pending_review", "an approved item comes back pending review");
    const restricted = await image();
    await restrictMedia(mctx(env, env.team.admin), restricted, "Synthetic restriction");
    await trashMedia(mctx(env, env.team.admin), restricted);
    await restoreMediaFromTrash(mctx(env, env.team.admin), restricted, await version(restricted));
    assert.equal((await row(restricted)).usage_status, "restricted");
  });

  test("in the Trash nothing changes its status: lifting a restriction or leaving the archive is refused until it is restored (review I1)", async () => {
    const restricted = await image();
    assert.equal((await restrictMedia(mctx(env, env.team.admin), restricted, "Synthetic restriction")).kind, "ok");
    assert.equal((await trashMedia(mctx(env, env.team.admin), restricted)).kind, "ok");
    const lifted = await unrestrictMedia(mctx(env, env.team.admin), restricted, await version(restricted), "Resolved the synthetic question");
    assert.equal(lifted.kind, "refused", JSON.stringify(lifted));
    assert.equal((await row(restricted)).usage_status, "restricted");
    const archived = await image();
    assert.equal((await archiveMedia(mctx(env, env.team.admin), archived)).kind, "ok");
    assert.equal((await trashMedia(mctx(env, env.team.admin), archived)).kind, "ok");
    assert.equal((await unarchiveMedia(mctx(env, env.team.admin), archived, await version(archived), "Needed again")).kind, "refused");
    assert.equal((await row(archived)).usage_status, "archived");
    const audit = await query<{ action: string; outcome: string }>(env, "SELECT action, outcome FROM audit_events WHERE entity_id IN (?, ?) AND outcome = 'failed' ORDER BY id", [restricted, archived]);
    assert.deepEqual(audit.map((a) => `${a.action}:${a.outcome}`), ["media.unrestrict:failed", "media.unarchive:failed"]);
    // Restored from the Trash, the usual way back works.
    assert.equal((await restoreMediaFromTrash(mctx(env, env.team.admin), restricted, await version(restricted))).kind, "ok");
    assert.equal((await unrestrictMedia(mctx(env, env.team.admin), restricted, await version(restricted), "Resolved the synthetic question")).kind, "ok");
  });
});

describe("versions (A4 brief §34)", () => {
  test("restoring an earlier version: Owner/Admin, on the page's version; it becomes current, the item returns to review, nothing is deleted", async () => {
    const id = await image();
    await prepare(id);
    await approveAs(id);
    const replaced = await upload(env, env.team.editor, await jpeg(500, 400, { seed: 900 }), "v2.jpg", { purpose: "replace", mediaId: id });
    assert.equal(replaced.status, 201);
    await prepare(id);
    await approveAs(id);
    const [v1, v2] = await query<{ id: string }>(env, "SELECT id FROM media_files WHERE media_id = ? ORDER BY version", [id]);
    assert.equal((await restoreMediaVersion(mctx(env, env.team.editor), id, v1.id, await version(id))).kind, "denied");
    assert.equal((await restoreMediaVersion(mctx(env, env.team.admin), id, v1.id, (await version(id)) - 1)).kind, "stale");
    assert.equal((await restoreMediaVersion(mctx(env, env.team.admin), id, v1.id, await version(id))).kind, "ok");
    const now = await row(id);
    assert.equal(now.current_file_id, v1.id);
    assert.equal(now.usage_status, "pending_review");
    assert.equal(await published(id), false);
    assert.equal((await query(env, "SELECT 1 FROM media_files WHERE id = ?", [v2.id])).length, 1, "the newer version stays");
    const [superseded] = await query<{ superseded_at: unknown }>(env, "SELECT superseded_at FROM media_files WHERE id = ?", [v2.id]);
    assert.ok(superseded.superseded_at);
  });

  test("a version whose files are missing on disk is not restored (never made current without its bytes)", async () => {
    const id = await image();
    await upload(env, env.team.editor, await jpeg(520, 400, { seed: 901 }), "v2.jpg", { purpose: "replace", mediaId: id });
    const [v1] = await query<{ id: string }>(env, "SELECT id FROM media_files WHERE media_id = ? AND version = 1", [id]);
    const [variant] = await query<{ storage_key: string }>(env, "SELECT storage_key FROM media_variants WHERE file_id = ? AND variant_key <> 'thumb' LIMIT 1", [v1.id]);
    await env.store.remove("derived", variant.storage_key);
    const result = await restoreMediaVersion(mctx(env, env.team.admin), id, v1.id, await version(id));
    assert.equal(result.kind, "refused");
    assert.match((result as { message: string }).message, /missing/);
  });
});

describe("metadata (A4 brief §38–§40)", () => {
  test("bilingual title, alt (text / decorative / undecided) and caption; plain text only; Arabic kept as typed", async () => {
    const id = await image();
    const ctx = mctx(env, env.team.editor);
    const bad = await updateMediaMetadata(ctx, id, formOf({ lockVersion: String(await version(id)), "en.title": "<script>alert(1)</script>" }));
    assert.equal(bad.kind, "invalid");
    const text = await updateMediaMetadata(ctx, id, formOf({ lockVersion: String(await version(id)), "en.altMode": "text", "en.alt": "" }));
    assert.equal(text.kind, "invalid", "text mode needs the text");
    const ok = await updateMediaMetadata(
      ctx,
      id,
      formOf({
        lockVersion: String(await version(id)),
        "en.title": "Test panel",
        "en.altMode": "text",
        "en.alt": "A test panel",
        "en.caption": "Synthetic caption",
        "ar.title": "لوحة تجريبية",
        "ar.altMode": "undecided",
        focalX: "0.25",
        focalY: "0.75",
        rightsHolder: "Test Rights Holder",
        licenceExpiresOn: "2030-01-31",
      }),
    );
    assert.equal(ok.kind, "ok", JSON.stringify(ok));
    const tr = await query<{ locale: string; title: string; alt_text: string | null; caption: string | null }>(env, "SELECT locale, title, alt_text, caption FROM media_translations WHERE media_id = ? ORDER BY locale", [id]);
    assert.deepEqual(tr, [
      { locale: "ar", title: "لوحة تجريبية", alt_text: null, caption: null },
      { locale: "en", title: "Test panel", alt_text: "A test panel", caption: "Synthetic caption" },
    ]);
    const r = await row(id);
    assert.deepEqual([Number(r.focal_x), Number(r.focal_y)], [0.25, 0.75]);
    assert.equal((await updateMediaMetadata(ctx, id, formOf({ lockVersion: String(await version(id)), focalX: "0.5" }))).kind, "invalid", "both coordinates or neither");
    assert.equal((await updateMediaMetadata(ctx, id, formOf({ lockVersion: String(await version(id)), focalX: "1.5", focalY: "0.5" }))).kind, "invalid");
    assert.equal((await updateMediaMetadata(ctx, id, formOf({ lockVersion: "0" }))).kind, "stale");
    assert.equal((await updateMediaMetadata(mctx(env, env.team.reviewer), id, formOf({ lockVersion: String(await version(id)) }))).kind, "denied");
  });

  test("mass assignment: a form can't set the status, visibility, approval or file", async () => {
    const id = await image();
    await updateMediaMetadata(
      mctx(env, env.team.editor),
      id,
      formOf({ lockVersion: String(await version(id)), usageStatus: "approved", visibility: "private", approvedBy: env.team.editor.user.id, currentFileId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", "en.title": "Plain" }),
    );
    const r = await row(id);
    assert.equal(r.usage_status, "pending_review");
    assert.equal(r.visibility, "public");
    assert.equal(r.approved_by, null);
  });

  test("an approved image keeps its alt decision: removing it is refused", async () => {
    const id = await image();
    await prepare(id);
    await approveAs(id);
    const result = await updateMediaMetadata(mctx(env, env.team.editor), id, formOf({ lockVersion: String(await version(id)), "en.altMode": "undecided", "ar.altMode": "decorative" }));
    assert.equal(result.kind, "invalid");
    assert.ok(await published(id));
  });
});

describe("the role matrix (A4 brief §21, §65): hidden buttons are not the security", () => {
  test("Reviewer: view and flag only; Editor: no approval, restriction, Trash or version restore; private items absent for all but the Owner", async () => {
    const id = await image();
    const reviewer = mctx(env, env.team.reviewer);
    assert.equal((await addMediaFlag(reviewer, id, "low_resolution", "")).kind, "ok");
    assert.equal((await updateMediaMetadata(reviewer, id, formOf({ lockVersion: String(await version(id)) }))).kind, "denied");
    assert.equal((await restrictMedia(reviewer, id, "Not allowed")).kind, "denied");
    assert.equal((await trashMedia(reviewer, id)).kind, "denied");
    const certId = await newCertificate();
    const privateId = await uploadOk(env, env.team.owner, pdf("Synthetic private matrix document"), "private.pdf", { purpose: "private_original", certificateId: certId });
    for (const actor of [env.team.admin, env.team.editor, env.team.reviewer]) {
      const ctx = mctx(env, actor);
      assert.equal((await addMediaFlag(ctx, privateId, "rights_pending", "")).kind, "not_found");
      assert.equal((await updateMediaMetadata(ctx, privateId, formOf({ lockVersion: "0" }))).kind, "not_found");
      assert.equal((await trashMedia(ctx, privateId)).kind, "not_found");
      assert.equal((await restrictMedia(ctx, privateId, "Probe")).kind, "not_found");
    }
    const audit = await query<{ outcome: string }>(env, "SELECT outcome FROM audit_events WHERE entity_id = ? AND outcome = 'denied'", [privateId]);
    assert.ok(audit.length >= 12, "every probe of a private item is audited");
  });

  test("a private document is never filed in a folder, which every role sees with its item count (review L5)", async () => {
    const folder = await createFolder(mctx(env, env.team.admin), "Test folder for the private rule", null);
    assert.equal(folder.kind, "ok", JSON.stringify(folder));
    const privateId = await uploadOk(env, env.team.owner, pdf("Synthetic private folder probe"), "private.pdf", { purpose: "private_original", certificateId: await newCertificate() });
    const filed = await updateMediaMetadata(mctx(env, env.team.owner), privateId, formOf({ lockVersion: String(await version(privateId)), folderId: folder.id! }));
    assert.equal(filed.kind, "invalid", JSON.stringify(filed));
    assert.ok(filed.kind === "invalid" && filed.errors?.folderId);
    assert.equal((await row(privateId)).folder_id, null);
    const [node] = (await folderTree(env.deps.db)).filter((f) => f.id === folder.id);
    assert.equal(node.items, 0, "nothing for an Admin to count");
    // A public item is filed as before.
    const publicId = await image();
    assert.equal((await updateMediaMetadata(mctx(env, env.team.editor), publicId, formOf({ lockVersion: String(await version(publicId)), folderId: folder.id! }))).kind, "ok");
    assert.equal((await row(publicId)).folder_id, folder.id);
  });

  test("the audit log never holds a private document's words: it is always “private document” there (review I2)", async () => {
    const privateId = await uploadOk(env, env.team.owner, pdf("Synthetic private audit probe"), "probe-name.pdf", { purpose: "private_original", certificateId: await newCertificate() });
    const titled = await updateMediaMetadata(
      mctx(env, env.team.owner),
      privateId,
      formOf({ lockVersion: String(await version(privateId)), "en.title": "Synthetic secret title", "ar.title": "عنوان سري تجريبي", "en.altMode": "undecided", "ar.altMode": "undecided" }),
    );
    assert.equal(titled.kind, "ok", JSON.stringify(titled));
    assert.equal((await addMediaFlag(mctx(env, env.team.owner), privateId, "rights_pending", "")).kind, "ok");
    const events = await query<{ entity_label: string | null; summary: string }>(env, "SELECT entity_label, summary FROM audit_events WHERE entity_id = ?", [privateId]);
    assert.ok(events.length >= 3);
    for (const event of events) {
      assert.ok(event.entity_label === null || event.entity_label === "private document", `label: ${event.entity_label}`);
      for (const word of ["Synthetic secret title", "عنوان سري", "probe-name"]) assert.ok(!event.summary.includes(word), `summary: ${event.summary}`);
    }
  });
});
