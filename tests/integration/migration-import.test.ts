/**
 * A9 — the static content import (A9.2 / A9.3), the public read model (A9.4) and the public redirects (A9.5), on a
 * disposable database with the release media registered as A4's importer does:
 *
 * - the import reconciles with today's content, publishes through A8, references only media A4 delivers (none of the
 *   13 held back), leaves the legal pages unpublished without a named reviewer, and is all or nothing (a refusal or a
 *   dry run writes nothing);
 * - it is repeatable and never overwrites: a second run changes nothing; an edit made in the admin is kept;
 * - the read model rebuilt from the published documents equals today's content except where the difference is the point
 *   (held-back photos, admin-only notes, unused monochrome logos), and only published versions reach it: a working copy,
 *   an unpublished record and a restricted photo never do;
 * - redirects resolve to live pages only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { after, before, describe, test } from "node:test";
import { staticContentSet, type ContentSet } from "../../src/content/static-set.ts";
import { runContentImport, type ImportReport } from "../../src/server/migration/importer.ts";
import { importRelease, parseBaseline } from "../../src/server/media/release.ts";
import { readPublicSnapshot } from "../../src/server/public/read-model.ts";
import { decodeContentSet } from "../../src/server/public/decode.ts";
import { resolvePublicRedirect, type LiveAddresses } from "../../src/server/public/redirects.ts";
import { updateItem } from "../../src/server/cms/engine.ts";
import { serviceSpec } from "../../src/server/cms/kinds.ts";
import { unpublish } from "../../src/server/publishing/workflow.ts";
import { restrictMedia } from "../../src/server/media/service.ts";
import { saveRedirect } from "../../src/server/site/redirects.ts";
import { ulid } from "../../src/server/security/ids.ts";
import { serviceForm, type ImportRefs } from "../../src/server/migration/records.ts";
import { ctxOf, query } from "./cms-helpers.ts";
import { mctx, setupMediaEnv, type MediaEnv } from "./media-helpers.ts";
import { siteChange } from "./site-helpers.ts";

const ROOT = join(import.meta.dirname, "../..");
const STATIC = staticContentSet();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function registerReleaseMedia(env: MediaEnv) {
  const baseline = parseBaseline(JSON.parse(readFileSync(join(ROOT, "src/server/media/release-baseline.json"), "utf8")));
  const report = await importRelease(env.pool, env.deps.db, baseline, { releaseDir: join(ROOT, "public"), actor: { type: "cli", label: "cli:test" }, requestId: ulid(), now: env.deps.clock(), dryRun: false, refresh: [] });
  assert.deepEqual(report.problems, []);
}

const run = (env: MediaEnv, options: { set?: ContentSet; legalReviewer?: string | null; dryRun?: boolean } = {}) =>
  runContentImport(env.deps, options.set ?? STATIC, { ownerEmail: env.team.owner.user.email, operator: "cli:test", legalReviewer: options.legalReviewer ?? null, requestId: ulid(), dryRun: options.dryRun });

const count = async (env: MediaEnv, sql: string) => Number((await query<{ n: number }>(env, sql))[0].n);
const decoded = async (env: MediaEnv) => decodeContentSet(await readPublicSnapshot(env.pool), STATIC);
const live = async (env: MediaEnv): Promise<LiveAddresses> => {
  const s = await readPublicSnapshot(env.pool);
  const ids = (t: string) => new Map(s.docs.filter((d) => d.type === t && d.slug).map((d) => [d.id, d.slug as string]));
  const pageKeys = new Map(s.docs.filter((d) => d.type === "page").map((d) => [d.id, String((d.document.root as Any)?.systemKey ?? "")]));
  return { services: new Set(ids("service").values()), projects: new Set(ids("project").values()), serviceSlugs: ids("service"), projectSlugs: ids("project"), pageKeys };
};

/** Differences between the rebuilt content and today's that are the point (each with its reason in the A9 report). */
const EXPECTED_DIFFERENCES = [
  /^\.services\.\d+\.(cover|supporting\.media)$/, // Laser Engraving's held-back photos (restricted)
  /^\.(services|industries|certificates)\.\d+\.source\.note$/, // source notes are admin-only
  /^\.projects\.\d+\.(media\.\d+|flags|note)$/, // held-back project photos; flags and notes are admin-only
  /^\.clients\.\d+\.logoMono$/, // the unused monochrome logos (pending in the library)
  /^\.mediaRegistry\.[a-z/0-9-]+$/, // the media the library does not deliver
];

function differences(a: unknown, b: unknown, path = ""): string[] {
  if (isDeepStrictEqual(a, b)) return [];
  if (a && b && typeof a === "object" && typeof b === "object") {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => differences((a as Any)[k], (b as Any)[k], `${path}.${k}`));
  }
  return [path];
}

let env: MediaEnv;
let first: ImportReport;
before(async () => {
  env = await setupMediaEnv("a9import");
  await registerReleaseMedia(env);
  first = await run(env);
});
after(async () => env?.closeMedia());

describe("A9.2 / A9.3: the import", () => {
  test("every aggregate of today's website is imported and published through A8; the reconciliation matches the source", () => {
    assert.equal(first.ok, true, JSON.stringify(first.failure));
    const row = (type: string) => first.reconciliation.find((r) => r.type === type)!;
    const expected: Record<string, number> = {
      project_category: STATIC.projectCategories.length,
      service: STATIC.services.length,
      machine: STATIC.machines.length,
      project: STATIC.projects.length,
      industry: STATIC.industries.length,
      client: STATIC.clients.length,
      certificate: STATIC.certificates.length,
      page: 13,
      ordering: 7,
      menu: 4,
      site_settings: 1,
      form: 1,
    };
    for (const [type, n] of Object.entries(expected)) {
      assert.equal(row(type).source, n, type);
      assert.equal(row(type).created, n, type);
      assert.equal(row(type).live, type === "page" ? n - 2 : n, `${type} live`);
    }
    assert.deepEqual(first.missingReferences, []);
  });

  test("the legal pages wait for a named reviewer: imported, not published", async () => {
    for (const key of ["privacy", "terms"]) {
      const unit = first.units.find((u) => u.type === "page" && u.key === key)!;
      assert.equal(unit.published, false);
      assert.match(unit.notes.join(" "), /no legal reviewer/);
    }
  });

  test("no held-back, restricted, pending or private item is referenced by any published document", async () => {
    const undelivered = await query<{ id: string; legacy_key: string | null }>(env, "SELECT a.id, a.legacy_key FROM media_assets a LEFT JOIN public_media p ON p.media_id = a.id WHERE p.media_id IS NULL");
    assert.ok(undelivered.length >= 13);
    const docs = (await query<{ document: string }>(env, "SELECT document FROM published_documents")).map((d) => (typeof d.document === "string" ? d.document : JSON.stringify(d.document))).join("\n");
    for (const item of undelivered) assert.equal(docs.includes(item.id), false, `${item.legacy_key ?? item.id} is referenced`);
    const restricted = await count(env, "SELECT COUNT(*) AS n FROM media_assets WHERE usage_status = 'restricted'");
    assert.equal(restricted, 13);
    // The report names every held-back photo today's content refers to.
    const leftOut = new Set(first.leftOut.map((l) => l.key));
    for (const key of ["projects/lattice-cubes-1", "projects/canopy-tree-1", "projects/litter-bins-3", "services/engraving-nameplates"]) assert.ok(leftOut.has(key), key);
  });

  test("every aggregate has its import revision, with today's source fingerprint", async () => {
    const revisions = await count(env, "SELECT COUNT(*) AS n FROM revisions WHERE kind = 'import' AND message LIKE '%Source fingerprint %'");
    assert.equal(revisions, first.units.length);
    const audit = await query<{ actor_type: string; outcome: string }>(env, "SELECT actor_type, outcome FROM audit_events WHERE action = 'content.import'");
    assert.deepEqual(audit, [{ actor_type: "cli", outcome: "success" }]);
  });
});

describe("A9.4: the public read model", () => {
  test("rebuilt from the published documents, it is today's content except the differences that are the point", async () => {
    const { set, livePages } = await decoded(env);
    const unexpected = differences(STATIC, set).filter((p) => !EXPECTED_DIFFERENCES.some((re) => re.test(p)));
    assert.deepEqual(unexpected, []);
    assert.equal(livePages.has("privacy"), false, "an unpublished legal page is not live");
    assert.equal(livePages.has("about"), true);
  });

  test("a working copy never reaches it; the import keeps an edit made in the admin", async () => {
    const [svc] = await query<{ id: string; lock_version: number }>(env, "SELECT id, lock_version FROM services WHERE slug = 'cnc-bending'");
    const before = (await decoded(env)).set.services.find((s) => s.slug === "cnc-bending")!;
    const edited = structuredClone(STATIC.services.find((x) => x.slug === "cnc-bending")!);
    edited.tagline.en = "Edited in the admin, not published";
    const form = { ...serviceForm(edited, await refsOf(env), true, STATIC.serviceDetails["cnc-bending"].related), lockVersion: String(svc.lock_version) };
    const saved = await updateItem(ctxOf(env, env.team.admin), serviceSpec, svc.id, form as Any);
    assert.equal(saved.kind, "ok", JSON.stringify(saved));
    const after = (await decoded(env)).set.services.find((s) => s.slug === "cnc-bending")!;
    assert.deepEqual(after.tagline, before.tagline, "the published version still holds");
    const again = await run(env);
    assert.equal(again.ok, true);
    assert.equal(again.units.find((u) => u.type === "service" && u.key === "cnc-bending")!.outcome, "edited_kept");
    const [stored] = await query<{ tagline: string }>(env, "SELECT t.tagline FROM service_translations t JOIN services s ON s.id = t.service_id WHERE s.slug = 'cnc-bending' AND t.locale = 'en'");
    assert.equal(stored.tagline, "Edited in the admin, not published");
  });

  test("a repeated import changes nothing else and writes no revision; with a reviewer it publishes the legal pages", async () => {
    const revisions = await count(env, "SELECT COUNT(*) AS n FROM revisions");
    const again = await run(env);
    assert.equal(again.ok, true);
    const outcomes = new Set(again.units.filter((u) => !(u.type === "service" && u.key === "cnc-bending")).map((u) => u.outcome));
    assert.deepEqual([...outcomes], ["unchanged"]);
    assert.equal(await count(env, "SELECT COUNT(*) AS n FROM revisions"), revisions);
    const reviewed = await run(env, { legalReviewer: "Integration test reviewer (not a legal review)" });
    assert.equal(reviewed.ok, true, JSON.stringify(reviewed.failure));
    assert.deepEqual(reviewed.units.filter((u) => u.published).map((u) => u.key).sort(), ["privacy", "terms"]);
    const { set, livePages } = await decoded(env);
    assert.equal(livePages.has("privacy"), true);
    assert.deepEqual(set.legalDocuments.privacy.sections, STATIC.legalDocuments.privacy.sections);
  });

  test("an unpublished record leaves the public site, and every published list that named it", async () => {
    const [p] = await query<{ id: string; lock_version: number }>(env, "SELECT id, lock_version FROM projects WHERE slug = 'clock-tower-landmark'");
    const generation = await count(env, "SELECT value AS n FROM cache_generation WHERE id = 1");
    const result = await unpublish(ctxOf(env, env.team.owner), "project", p.id, Number(p.lock_version));
    assert.equal(result.kind, "ok", JSON.stringify(result));
    assert.ok((await count(env, "SELECT value AS n FROM cache_generation WHERE id = 1")) > generation, "the cache generation moved");
    const { set } = await decoded(env);
    assert.equal(set.projects.some((x) => x.slug === "clock-tower-landmark"), false);
    for (const s of set.services) assert.equal(s.projects.includes("clock-tower-landmark"), false, s.slug);
  });

  test("a photo restricted in the library leaves the public site at once, without a republication", async () => {
    const key = "projects/geometric-lanterns-1";
    const [item] = await query<{ id: string }>(env, "SELECT id FROM media_assets WHERE legacy_key = ?", [key]);
    const before = (await decoded(env)).set;
    assert.ok(before.projects.find((x) => x.slug === "geometric-lanterns")!.media.includes(key as Any));
    const result = await restrictMedia(mctx(env, env.team.owner), item.id, "Integration test: rights in question");
    assert.equal(result.kind, "ok", JSON.stringify(result));
    const after = (await decoded(env)).set;
    assert.equal(after.projects.find((x) => x.slug === "geometric-lanterns")!.media.includes(key as Any), false);
    assert.equal(key in after.mediaRegistry, false);
  });
});

describe("A9.5: redirects resolve to live pages only", () => {
  test("a redirect to a published service follows it; to an unpublished one, a live address or itself, never", async () => {
    const [svc] = await query<{ id: string }>(env, "SELECT id FROM services WHERE slug = 'laser-cutting'");
    const saved = await saveRedirect(siteChange(env, env.team.admin), { id: "", expectedVersion: 0, sourcePath: "/en/old-laser", targetType: "service", targetPath: "", targetId: svc.id, statusCode: 308, note: "" });
    assert.equal(saved.kind, "ok", JSON.stringify(saved));
    const db = env.deps.db;
    assert.deepEqual(await resolvePublicRedirect(db, "/en/old-laser", await live(env)), { location: "/en/services/laser-cutting", permanent: true });
    assert.equal(await resolvePublicRedirect(db, "/en/old-laser/", await live(env)).then((r) => r?.location), "/en/services/laser-cutting", "the address is normalised");
    assert.equal(await resolvePublicRedirect(db, "/en/about", await live(env)), null, "a live page wins");
    assert.equal(await resolvePublicRedirect(db, "/en/never-redirected", await live(env)), null);
    const moved = await saveRedirect(siteChange(env, env.team.admin), { id: "", expectedVersion: 0, sourcePath: "/en/old-tower", targetType: "path", targetPath: "/en/projects/clock-tower-landmark", targetId: "", statusCode: 307, note: "" });
    // The target was unpublished above: A6 refuses it, and were it stored, the public site would not follow it.
    if (moved.kind === "ok") assert.equal(await resolvePublicRedirect(db, "/en/old-tower", await live(env)), null);
    const [s] = await query<{ id: string; lock_version: number }>(env, "SELECT id, lock_version FROM services WHERE slug = 'laser-cutting'");
    assert.equal((await unpublish(ctxOf(env, env.team.owner), "service", s.id, Number(s.lock_version))).kind, "ok");
    assert.equal(await resolvePublicRedirect(db, "/en/old-laser", await live(env)), null, "the target is no longer live");
  });
});

describe("A9.2: all or nothing", () => {
  test("a refused import and a dry run write nothing at all", async () => {
    const fresh = await setupMediaEnv("a9fail");
    try {
      await registerReleaseMedia(fresh);
      const broken = structuredClone(STATIC);
      broken.projects[5].galleryRef = "<b>bold</b>";
      const refused = await run(fresh, { set: broken });
      assert.equal(refused.ok, false);
      assert.equal(refused.failure?.stage, "records");
      const dry = await run(fresh, { dryRun: true });
      assert.equal(dry.ok, true);
      assert.equal(dry.dryRun, true);
      for (const table of ["services", "projects", "machines", "pages", "page_sections", "published_documents", "revisions"]) assert.equal(await count(fresh, `SELECT COUNT(*) AS n FROM ${table}`), 0, table);
      const audit = await query<{ outcome: string }>(fresh, "SELECT outcome FROM audit_events WHERE action = 'content.import' ORDER BY id");
      assert.deepEqual(audit.map((a) => a.outcome), ["failed", "success"]);
    } finally {
      await fresh.closeMedia();
    }
  });
});

/** Names the database's records and delivered media as the importer does (to fill an editor's form in a test). */
async function refsOf(e: MediaEnv): Promise<ImportRefs> {
  const media = new Map((await query<{ k: string; id: string }>(e, "SELECT a.legacy_key AS k, a.id FROM media_assets a JOIN public_media p ON p.media_id = a.id WHERE a.legacy_key IS NOT NULL")).map((r) => [r.k, r.id]));
  const ids = new Map<string, string>();
  for (const [type, table] of [["service", "services"], ["machine", "machines"], ["project", "projects"]])
    for (const r of await query<{ id: string; slug: string }>(e, `SELECT id, slug FROM ${table}`)) ids.set(`${type}:${r.slug}`, r.id);
  return { media: (k) => media.get(k) ?? null, id: (t, slug) => ids.get(`${t}:${slug}`)!, leftOut: () => undefined };
}
