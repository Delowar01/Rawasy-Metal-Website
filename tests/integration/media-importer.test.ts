/**
 * Media library (A4) — the release import (A4 brief §11–§14, §19, §78): the committed baseline is the repository's
 * (143 files, the 13 held back restricted with their documented flags and no `public_media` row), every file is verified
 * before anything is written, the run is idempotent, a changed binary fails closed, and the refresh workflow takes a
 * changed file only when asked, returning an approved item to review. The real `public/media` files are read, never
 * written; the fail-closed and refresh cases run on a copy in a temporary folder.
 */
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { createHash } from "node:crypto";
import { importRelease, parseBaseline, type Baseline } from "../../src/server/media/release.ts";
import { MEDIA_FLAGS } from "../../src/server/media/registry.ts";
import { ulid } from "../../src/server/security/ids.ts";
import { query } from "./cms-helpers.ts";
import { assertPublicMediaInvariant, setupMediaEnv, type MediaEnv } from "./media-helpers.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const PUBLIC = join(ROOT, "public");
const baseline: Baseline = parseBaseline(JSON.parse(readFileSync(join(ROOT, "src/server/media/release-baseline.json"), "utf8")));

let env: MediaEnv;
before(async () => {
  env = await setupMediaEnv("media_imp");
});
after(async () => {
  await assertPublicMediaInvariant(env);
  await env.closeMedia();
});

const options = (releaseDir = PUBLIC, extra: Partial<Parameters<typeof importRelease>[3]> = {}) => ({
  releaseDir,
  actor: { type: "cli" as const, label: "cli:test" },
  requestId: ulid(),
  now: env.deps.clock(),
  dryRun: false,
  refresh: [],
  ...extra,
});

describe("the baseline (derived from the repository)", () => {
  test("143 files: 108 used and approved, 22 unused and pending review, 13 held back and restricted", () => {
    const by = (status: string) => baseline.items.filter((i) => i.status === status);
    assert.equal(baseline.items.length, 143);
    assert.equal(by("approved").length, 108);
    assert.equal(by("pending_review").length, 22);
    assert.equal(by("restricted").length, 13);
    assert.ok(by("approved").every((i) => i.used && i.flags.length === 0));
    assert.ok(by("restricted").every((i) => !i.used), "the built site uses no held-back file");
  });

  test("the 13 held-back files carry only their documented flags, every one blocking", () => {
    const held = Object.fromEntries(baseline.items.filter((i) => i.flags.length).map((i) => [i.legacyKey, i.flags]));
    assert.deepEqual(held, {
      "projects/billboard-structure-1": ["ai_watermark"],
      "projects/canopy-tree-1": ["authorship_unconfirmed"],
      "projects/laser-cut-bench-1": ["product_render"],
      "projects/lattice-cubes-1": ["authorship_unconfirmed"],
      "projects/litter-bins-1": ["product_render"],
      "projects/litter-bins-2": ["product_render"],
      "projects/litter-bins-3": ["product_render"],
      "projects/seed-sculpture-1": ["authorship_unconfirmed"],
      "projects/stainless-landmark-1": ["ai_watermark"],
      "projects/wheat-monument-1": ["ai_watermark"],
      "services/engraving-nameplates": ["contains_identifiers", "rights_pending", "third_party_branding"],
      "services/engraving-rotary": ["product_render"],
      "services/engraving-wood": ["product_render"],
    });
    for (const flags of Object.values(held)) for (const flag of flags) assert.equal(MEDIA_FLAGS[flag as keyof typeof MEDIA_FLAGS].blocking, true);
  });

  test("the same 13 files the packaging script holds back (its own exclusion list)", () => {
    const packaging = readFileSync(join(ROOT, "scripts/package-namecheap.mjs"), "utf8");
    const explicit = JSON.parse(/const HELD_BACK_MEDIA = (\[[^\]]*\]);/.exec(packaging)![1]) as string[];
    const restricted = baseline.items.filter((i) => i.status === "restricted").map((i) => i.legacyKey);
    for (const id of explicit) assert.ok(restricted.includes(id), id);
    assert.equal(restricted.length, 13);
  });

  test("the baseline's hashes are the release files' (nothing in public/media changed)", () => {
    for (const item of baseline.items) {
      const bytes = readFileSync(join(PUBLIC, item.src));
      assert.equal(bytes.length, item.byteSize, item.legacyKey);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.legacyKey);
    }
  });

  test("alt texts are never invented: one consistent value per language from the built site, '' for decorative, else undecided", () => {
    for (const item of baseline.items) {
      for (const locale of ["en", "ar"] as const) {
        const alt = item.alt[locale];
        assert.ok(alt === null || typeof alt === "string");
        if (item.status === "restricted") assert.equal(alt, null, `${item.legacyKey}: held back, no alt from the site`);
        if (!item.used) assert.equal(alt, null, `${item.legacyKey}: unused, no alt`);
      }
    }
    assert.ok(baseline.items.some((i) => i.alt.en === "" && i.alt.ar === ""), "decorative images exist");
    assert.ok(baseline.items.some((i) => i.alt.en && i.alt.ar), "described images exist");
  });
});

describe("the import (A4 brief §78)", () => {
  test("registers 143 items from the release, files untouched; a second run is a no-op", async () => {
    const before_ = Object.fromEntries(baseline.items.map((i) => [i.src, readFileSync(join(PUBLIC, i.src)).length]));
    const report = await importRelease(env.pool, env.deps.db, baseline, options());
    assert.deepEqual(report.problems, []);
    assert.equal(report.created.length, 143);
    const counts = await query<{ s: string; n: number }>(env, "SELECT usage_status AS s, COUNT(*) AS n FROM media_assets WHERE legacy_key IS NOT NULL GROUP BY usage_status ORDER BY s");
    assert.deepEqual(
      counts.map((c) => [c.s, Number(c.n)]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      [
        ["approved", 108],
        ["pending_review", 22],
        ["restricted", 13],
      ],
    );
    const files = await query<{ storage_area: string; processing_status: string; n: number }>(env, "SELECT storage_area, processing_status, COUNT(*) AS n FROM media_files GROUP BY storage_area, processing_status");
    assert.deepEqual(files.map((f) => [f.storage_area, f.processing_status, Number(f.n)]), [["release", "ready", 143]]);
    assert.equal(Number((await query<{ n: number }>(env, "SELECT COUNT(*) AS n FROM public_media"))[0].n), 108, "exactly the approved release items are delivered");
    const heldPublic = await query(env, "SELECT a.legacy_key FROM public_media p JOIN media_assets a ON a.id = p.media_id WHERE a.usage_status <> 'approved' OR EXISTS (SELECT 1 FROM media_flags f WHERE f.media_id = a.id)");
    assert.deepEqual(heldPublic, [], "no held-back or pending item has a public_media row");
    const src = await query<{ legacy_key: string; src: string; storage_key: string }>(env, "SELECT a.legacy_key, p.src, f.storage_key FROM public_media p JOIN media_assets a ON a.id = p.media_id JOIN media_files f ON f.id = p.file_id");
    for (const r of src) assert.equal(r.src, r.storage_key, "a release item keeps its static address");
    for (const item of baseline.items) assert.equal(readFileSync(join(PUBLIC, item.src)).length, before_[item.src], "never moved or rewritten");
    const again = await importRelease(env.pool, env.deps.db, baseline, options());
    assert.deepEqual([again.created.length, again.unchanged.length, again.problems], [0, 143, []]);
    assert.equal(Number((await query<{ n: number }>(env, "SELECT COUNT(*) AS n FROM media_assets"))[0].n), 143, "no duplicate rows");
    const audit = await query<{ n: number }>(env, "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'media.import_release'");
    assert.equal(Number(audit[0].n), 1, "a no-op run writes nothing, not even an event");
  });

  test("held-back items are restricted with their reasons and notes; approved release items carry the baseline note", async () => {
    const held = await query<{ legacy_key: string; usage_status: string; restriction_reason: string; source_note: string }>(
      env,
      "SELECT legacy_key, usage_status, restriction_reason, source_note FROM media_assets WHERE usage_status = 'restricted' ORDER BY legacy_key",
    );
    assert.equal(held.length, 13);
    for (const h of held) {
      assert.match(h.restriction_reason, /Asset inventory item/);
      assert.match(h.source_note, /Asset inventory item/);
    }
    const nameplates = await query<{ flag: string }>(env, "SELECT f.flag FROM media_flags f JOIN media_assets a ON a.id = f.media_id WHERE a.legacy_key = 'services/engraving-nameplates' ORDER BY f.flag");
    assert.deepEqual(nameplates.map((n) => n.flag), ["contains_identifiers", "rights_pending", "third_party_branding"]);
    const [approved] = await query<{ approval_note: string; approved_by: string | null; rights_holder: string | null }>(
      env,
      "SELECT approval_note, approved_by, rights_holder FROM media_assets WHERE usage_status = 'approved' LIMIT 1",
    );
    assert.match(approved.approval_note, /Not a rights claim/);
    assert.equal(approved.approved_by, null, "approved by the import, not by a person");
    assert.equal(approved.rights_holder, null, "no rights holder invented");
  });

  test("fails closed: a release file that differs from the baseline stops the run before anything is written", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rawasy-release-copy-"));
    try {
      cpSync(join(PUBLIC, "media"), join(dir, "media"), { recursive: true });
      const victim = baseline.items.find((i) => i.status === "pending_review")!;
      writeFileSync(join(dir, victim.src), Buffer.concat([readFileSync(join(dir, victim.src)), Buffer.from([0])]));
      const fresh = await setupMediaEnv("media_imp_b");
      try {
        const report = await importRelease(fresh.pool, fresh.deps.db, baseline, { ...options(dir), now: fresh.deps.clock() });
        assert.equal(report.problems.length, 1);
        assert.match(report.problems[0], new RegExp(`${victim.legacyKey}: .* differs from the baseline`));
        assert.equal(Number((await query<{ n: number }>(fresh, "SELECT COUNT(*) AS n FROM media_assets"))[0].n), 0, "nothing written");
        rmSync(join(dir, victim.src));
        const missing = await importRelease(fresh.pool, fresh.deps.db, baseline, { ...options(dir), now: fresh.deps.clock() });
        assert.match(missing.problems.join(" "), /is missing/);
      } finally {
        await fresh.closeMedia();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a changed release file is a refresh only when named: the record follows it and an approved item returns to review", async () => {
    const item = baseline.items.find((i) => i.status === "approved")!;
    const changedBytes = readFileSync(join(PUBLIC, item.src));
    const altered = { ...item, sha256: createHash("sha256").update(Buffer.concat([changedBytes, Buffer.from([1])])).digest("hex"), byteSize: changedBytes.length + 1 };
    const changedBaseline: Baseline = { ...baseline, items: baseline.items.map((i) => (i.legacyKey === item.legacyKey ? altered : i)) };
    const dir = mkdtempSync(join(tmpdir(), "rawasy-release-copy-"));
    try {
      cpSync(join(PUBLIC, "media"), join(dir, "media"), { recursive: true });
      writeFileSync(join(dir, item.src), Buffer.concat([changedBytes, Buffer.from([1])]));
      const refused = await importRelease(env.pool, env.deps.db, changedBaseline, options(dir));
      assert.match(refused.problems.join(" "), new RegExp(`${item.legacyKey}: the release file differs from the stored record`));
      const refreshed = await importRelease(env.pool, env.deps.db, changedBaseline, options(dir, { refresh: [item.legacyKey] }));
      assert.deepEqual(refreshed.problems, []);
      assert.deepEqual(refreshed.refreshed, [item.legacyKey]);
      const [row] = await query<{ usage_status: string; byte_size: number }>(
        env,
        "SELECT a.usage_status, f.byte_size FROM media_assets a JOIN media_files f ON f.id = a.current_file_id WHERE a.legacy_key = ?",
        [item.legacyKey],
      );
      assert.equal(row.usage_status, "pending_review", "a changed binary needs approval again");
      assert.equal(Number(row.byte_size), altered.byteSize);
      assert.equal((await query(env, "SELECT 1 FROM public_media p JOIN media_assets a ON a.id = p.media_id WHERE a.legacy_key = ?", [item.legacyKey])).length, 0);
      const audit = await query<{ action: string }>(env, "SELECT action FROM audit_events WHERE action = 'media.release_refresh'");
      assert.equal(audit.length, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a baseline that is not the repository's is refused (count, flags, statuses)", () => {
    assert.throws(() => parseBaseline({ ...baseline, items: baseline.items.slice(1), count: 142 }));
    assert.throws(() => parseBaseline({ ...baseline, items: baseline.items.map((i, n) => (n === 0 ? { ...i, status: "restricted", flags: [] } : i)) }));
    assert.throws(() => parseBaseline({ ...baseline, items: baseline.items.map((i, n) => (n === 0 ? { ...i, flags: ["made_up_flag"], status: "restricted" } : i)) }));
    assert.throws(() => parseBaseline({ ...baseline, items: baseline.items.map((i) => (i.status === "restricted" ? { ...i, status: "approved", flags: [] } : i)) }));
  });
});
