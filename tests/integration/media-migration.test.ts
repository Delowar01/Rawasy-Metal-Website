/**
 * The A4 migration (0004_media_library) on a real MariaDB — the A4 brief's proofs A–G (§8):
 * A. an empty database takes every migration; B. a database at A3 (0000–0003) holding A2 accounts and A3 content takes
 * exactly the A4 file; C. a second run is a no-op; D. the hash and order checks still refuse a changed or reordered A4
 * file; E. every A4 table is InnoDB utf8mb4_unicode_520_ci with ids and keys ascii_bin (and the schema's own rules hold);
 * F. no A2 or A3 row is lost or changed, the new columns of A3 tables start NULL and the media tables start empty (the
 * release import is a command, never a migration); G. `npm run db:check` passes. Run through scripts/db-migrate.mjs,
 * as an operator would.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { after, describe, test } from "node:test";
import { MigrationError, readMigrations, runMigrations, verifyCharsets } from "../../src/server/db/migrate.ts";
import { createEmptyDatabase, MIGRATIONS, serverConfig, serverConnection } from "./helpers.ts";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "../..");
const CLI = join(ROOT, "scripts/db-migrate.mjs");
const ALL_TAGS = ["0000_access_control", "0001_seed_access_control", "0002_core_cms", "0003_seed_core_cms", "0004_media_library"];
/** A5 added 0005_page_builder after the A4 file: every committed migration applies, A4's among them. */
const COMMITTED = [...ALL_TAGS, "0005_page_builder"];
/** The tables 0005 adds (A5's own proofs: tests/integration/builder-migration.test.ts). */
const A5_TABLES = ["page_sections", "page_section_translations", "reusable_sections", "reusable_section_translations"];

async function cli(database: string, args: string[]) {
  const { host, port, user, password } = serverConfig();
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args], {
      env: { PATH: process.env.PATH, NODE_ENV: "test", APP_ENV: "local", DB_HOST: host, DB_PORT: String(port), DB_USER: user, DB_PASSWORD: password, DB_NAME: database },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

const cleanups: (() => Promise<void> | void)[] = [];
after(async () => {
  for (const fn of cleanups.reverse()) await fn();
});

async function freshDatabase(prefix: string) {
  const db = await createEmptyDatabase(prefix);
  cleanups.push(db.drop);
  return db.name;
}

/** A copy of the migrations as they stood at A3 (Correction 1 included): the journal's first four entries and files. */
function a3Folder() {
  const dir = mkdtempSync(join(tmpdir(), "rawasy-a3-migrations-"));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries.slice(4)) rmSync(join(dir, `${entry.tag}.sql`));
  journal.entries = journal.entries.slice(0, 4);
  writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const A4_TABLES = [
  "media_folders",
  "media_assets",
  "media_files",
  "media_variants",
  "media_translations",
  "media_flags",
  "public_media",
  "project_media",
  "certificate_documents",
  "service_gallery_items",
  "service_gallery_item_translations",
];

/** Columns A4 adds to A3 tables (A1's media references; every one nullable). */
const A4_COLUMNS: Record<string, string[]> = {
  pages: ["og_image_media_id"],
  services: ["cover_media_id", "supporting_media_id", "og_image_media_id"],
  service_translations: ["cover_alt", "supporting_alt"],
  machines: ["media_id"],
  projects: ["og_image_media_id"],
  industries: ["media_id", "feature_media_id"],
  clients: ["logo_media_id", "logo_mono_media_id"],
  certificates: ["thumb_media_id"],
};

type Conn = Awaited<ReturnType<typeof serverConnection>>;
const rows = async <T = Record<string, unknown>>(c: Conn, statement: string, params: unknown[] = []) => (await c.query(statement, params))[0] as T[];

async function columnsOf(c: Conn, table: string): Promise<string[]> {
  return (
    await rows<{ c: string }>(c, "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [table])
  ).map((r) => r.c);
}

/** Every row of every table, as JSON per table, reading only the given columns per table (the columns before A4). */
async function snapshot(c: Conn, columns: Record<string, string[]>) {
  const out: Record<string, string> = {};
  for (const [table, list] of Object.entries(columns)) {
    const select = list.map((col) => `\`${col}\``).join(", ");
    out[table] = JSON.stringify(await rows(c, `SELECT ${select} FROM \`${table}\` ORDER BY ${select}`), (_k, v) => (Buffer.isBuffer(v) ? v.toString("hex") : v));
  }
  return out;
}

const T = new Date("2026-10-15T09:00:00.000Z");
const USER = "01JA4MIGTESTUSER0000000000";
const id = (n: number) => `01JA4MIGTEST${String(n).padStart(14, "0")}`;

/** A2 accounts and A3 content written as an A3 installation holds them (raw SQL: the A3 schema, not today's). */
async function seedA3(c: Conn) {
  await c.query(
    "INSERT INTO users (id, email, email_normalized, display_name, status, password_hash, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
    [USER, "owner@example.test", "owner@example.test", "Test Owner", "$argon2id$v=19$m=19456,t=2,p=1$dGVzdA$dGVzdGhhc2g", T, T, T],
  );
  await c.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'owner', ?)", [USER, T]);
  await c.query("INSERT INTO user_mfa (user_id, totp_secret_enc, key_version, confirmed_at, created_at) VALUES (?, ?, 1, ?, ?)", [USER, Buffer.from("not-a-real-sealed-secret"), T, T]);
  await c.query(
    "INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, idle_expires_at, absolute_expires_at, reauthenticated_at, mfa_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id(1), USER, Buffer.alloc(32, 9), T, T, T, T, T, T],
  );
  await c.query("INSERT INTO audit_events (occurred_at, request_id, actor_type, actor_user_id, action, outcome, summary) VALUES (?, ?, 'user', ?, 'page.create', 'success', 'Test content')", [
    T,
    id(2),
    USER,
  ]);
  // Content: one item of every A3 type with its translations, relations and children.
  await c.query("INSERT INTO pages (id, page_type, slug, system_key, created_by, updated_by) VALUES (?, 'generic', 'test-page', NULL, ?, ?)", [id(10), USER, USER]);
  await c.query("INSERT INTO page_translations (page_id, locale, title, seo_title) VALUES (?, 'en', 'Test page', 'Test page'), (?, 'ar', 'صفحة تجريبية', NULL)", [id(10), id(10)]);
  await c.query("INSERT INTO services (id, slug, service_group, icon_key) VALUES (?, 'test-service', 'metal', 'laser'), (?, 'demo-service', 'scaffolding', 'scaffold')", [id(20), id(21)]);
  await c.query(
    `INSERT INTO service_translations (service_id, locale, name, tagline, summary, body, highlights)
     VALUES (?, 'en', 'Test service', 'Tagline', 'Summary', '{"type":"doc","content":[]}', '[]'), (?, 'ar', 'خدمة تجريبية', 'شعار', 'ملخص', '{"type":"doc","content":[]}', '[]')`,
    [id(20), id(20)],
  );
  await c.query("INSERT INTO service_related_services (service_id, related_service_id, position) VALUES (?, ?, 1)", [id(20), id(21)]);
  await c.query("INSERT INTO machines (id, slug, power_watts) VALUES (?, 'test-machine', 6000)", [id(30)]);
  await c.query("INSERT INTO machine_translations (machine_id, locale, name, short_name, category, capability) VALUES (?, 'en', 'Test machine', 'Test', 'Laser', 'Cuts')", [id(30)]);
  await c.query("INSERT INTO machine_attributes (id, machine_id, position) VALUES (?, ?, 1)", [id(31), id(30)]);
  await c.query("INSERT INTO machine_attribute_translations (attribute_id, locale, label, value) VALUES (?, 'en', 'Bed', 'Test value')", [id(31)]);
  await c.query("INSERT INTO service_machines (service_id, machine_id, position) VALUES (?, ?, 1)", [id(20), id(30)]);
  await c.query("INSERT INTO project_categories (id, slug) VALUES (?, 'test-category')", [id(40)]);
  await c.query("INSERT INTO project_category_translations (category_id, locale, label) VALUES (?, 'en', 'Test category')", [id(40)]);
  await c.query("INSERT INTO projects (id, slug, is_featured) VALUES (?, 'test-project', 1)", [id(41)]);
  await c.query("INSERT INTO project_translations (project_id, locale, title, summary) VALUES (?, 'en', 'Test project', 'Summary'), (?, 'ar', 'مشروع تجريبي', 'ملخص')", [id(41), id(41)]);
  await c.query("INSERT INTO project_category_assignments (project_id, category_id, position) VALUES (?, ?, 1)", [id(41), id(40)]);
  await c.query("INSERT INTO project_services (project_id, service_id, position) VALUES (?, ?, 1)", [id(41), id(20)]);
  await c.query("INSERT INTO service_featured_projects (service_id, project_id, position) VALUES (?, ?, 1)", [id(20), id(41)]);
  await c.query("INSERT INTO project_flags (project_id, flag, note, created_at, created_by) VALUES (?, 'authorship_unconfirmed', 'Test flag', ?, ?)", [id(41), T, USER]);
  await c.query("INSERT INTO industries (id, slug, classification) VALUES (?, 'test-industry', 'profile_sector')", [id(50)]);
  await c.query("INSERT INTO industry_translations (industry_id, locale, name, description) VALUES (?, 'en', 'Test industry', 'Description')", [id(50)]);
  await c.query("INSERT INTO industry_services (industry_id, service_id, position) VALUES (?, ?, 1)", [id(50), id(20)]);
  await c.query("INSERT INTO industry_projects (industry_id, project_id, position) VALUES (?, ?, 1)", [id(50), id(41)]);
  await c.query("INSERT INTO clients (id, slug, is_featured) VALUES (?, 'test-client', 0)", [id(60)]);
  await c.query("INSERT INTO client_translations (client_id, locale, name) VALUES (?, 'en', 'Test client'), (?, 'ar', 'عميل تجريبي')", [id(60), id(60)]);
  await c.query("INSERT INTO certificates (id, slug) VALUES (?, 'test-certificate')", [id(70)]);
  await c.query("INSERT INTO certificate_translations (certificate_id, locale, title, issuer) VALUES (?, 'en', 'Test certificate', 'Test issuer')", [id(70)]);
  await c.query("INSERT INTO certificate_facts (id, certificate_id, position) VALUES (?, ?, 1)", [id(71), id(70)]);
  await c.query("INSERT INTO certificate_fact_translations (fact_id, locale, label, value) VALUES (?, 'en', 'Scope', 'Test scope')", [id(71)]);
  await c.query("INSERT INTO entity_ordering_items (ordering_key, entity_id, position) VALUES ('services', ?, 1), ('services', ?, 2), ('projects', ?, 1)", [id(20), id(21), id(41)]);
  await c.query("INSERT INTO search_documents (entity_type, entity_id, locale, scope, title, body, updated_at) VALUES ('project', ?, 'en', 'working', 'test project', 'summary', ?)", [id(41), T]);
}

describe("A. an empty database", () => {
  test("takes every migration (the A4 file and A5's 0005 after it), then reports nothing pending", async () => {
    const database = await freshDatabase("a4mig_a");
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    for (const tag of COMMITTED) assert.match(up.stdout, new RegExp(`Applied ${tag}`));
    const status = await cli(database, ["status"]);
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, new RegExp(`Applied \\(6\\): ${COMMITTED.join(", ")}`));
    assert.match(status.stdout, /Pending \(0\): none/);
  });
});

describe("B–G. a database at A3 with accounts and content, upgraded to A4", () => {
  let database = "";
  let tables: string[] = [];
  const columnsBefore: Record<string, string[]> = {};
  let before: Record<string, string> = {};

  test("B. an A3 database with A2 accounts and A3 content takes the A4 file (and, since A5, 0005 after it)", async () => {
    database = await freshDatabase("a4mig_b");
    const c = await serverConnection(database);
    try {
      const a3 = await runMigrations(c, readMigrations(a3Folder()), { appEnv: "local", operator: "cli:test" });
      assert.deepEqual(a3.applied, ALL_TAGS.slice(0, 4));
      await seedA3(c);
      tables = (await rows<{ t: string }>(c, "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME")).map((r) => r.t);
      assert.equal(tables.length, 46, tables.join(","));
      for (const table of tables) columnsBefore[table] = await columnsOf(c, table);
      before = await snapshot(c, columnsBefore);
    } finally {
      await c.end();
    }
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    assert.match(up.stdout, /Applied 0004_media_library/);
    assert.match(up.stdout, /Applied 0005_page_builder/);
    assert.doesNotMatch(up.stdout, /Applied 000[0-3]/);
  });

  test("C. a second run is a no-op", async () => {
    const again = await cli(database, ["up"]);
    assert.equal(again.code, 0);
    assert.match(again.stdout, /Nothing to apply/);
    const status = await cli(database, ["status"]);
    assert.match(status.stdout, new RegExp(`Applied \\(6\\): ${COMMITTED.join(", ")}`));
  });

  test("D. the hash and order checks still refuse a changed or reordered A4 file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rawasy-a4-migrations-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    cpSync(MIGRATIONS, dir, { recursive: true });
    const file = join(dir, "0004_media_library.sql");
    writeFileSync(file, readFileSync(file, "utf8").replace("no row is written.", "no row is written!"));
    const c = await serverConnection(database);
    try {
      await assert.rejects(
        runMigrations(c, readMigrations(dir), { appEnv: "local" }),
        (e: unknown) => e instanceof MigrationError && e.kind === "history" && /0004_media_library\.sql changed after it was applied/.test(e.message),
      );
    } finally {
      await c.end();
    }
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
    journal.entries[4].when = journal.entries[3].when - 1;
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    assert.throws(() => readMigrations(dir), (e: unknown) => e instanceof MigrationError && e.kind === "journal" && /out of order/.test(e.message));
  });

  test("E. every A4 table is InnoDB utf8mb4_unicode_520_ci; ids, keys and storage keys ascii_bin; the schema's rules hold", async () => {
    const c = await serverConnection(database);
    try {
      const all = await rows<{ t: string; e: string; co: string }>(
        c,
        "SELECT TABLE_NAME AS t, ENGINE AS e, TABLE_COLLATION AS co FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
      );
      const a4 = all.filter((r) => A4_TABLES.includes(r.t));
      assert.equal(a4.length, A4_TABLES.length);
      assert.equal(all.length, tables.length + A4_TABLES.length + A5_TABLES.length);
      for (const table of a4) assert.deepEqual([table.e, table.co], ["InnoDB", "utf8mb4_unicode_520_ci"], table.t);
      const keys = await rows<{ t: string; c: string; co: string }>(
        c,
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLLATION_NAME AS co FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL
            AND (COLUMN_NAME IN ('id', 'locale', 'flag', 'legacy_key', 'storage_key', 'variant_key') OR COLUMN_NAME LIKE '%\\_id')`,
      );
      const a4Keys = keys.filter((k) => A4_TABLES.includes(k.t) || (A4_COLUMNS[k.t] ?? []).includes(k.c));
      assert.ok(a4Keys.length >= 40, String(a4Keys.length));
      for (const key of a4Keys) assert.equal(key.co, "ascii_bin", `${key.t}.${key.c}`);
      const texts = await rows<{ t: string; c: string; co: string }>(
        c,
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLLATION_NAME AS co FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
            AND COLUMN_NAME IN ('name', 'title', 'alt_text', 'caption', 'alt', 'original_filename', 'rights_holder', 'rights_note', 'source_note', 'note', 'cover_alt', 'supporting_alt')`,
      );
      const a4Texts = texts.filter((k) => A4_TABLES.includes(k.t) || (A4_COLUMNS[k.t] ?? []).includes(k.c));
      assert.ok(a4Texts.length >= 12, String(a4Texts.length));
      for (const text of a4Texts) assert.equal(text.co, "utf8mb4_unicode_520_ci", `${text.t}.${text.c}`);
      assert.deepEqual(await verifyCharsets(c), []);

      // The schema's own rules: a private item is never pending review or approved; no folder is its own parent; a
      // focal point is both coordinates in 0..1 or neither; a media item that content refers to cannot be deleted.
      await c.query("INSERT INTO media_assets (id, kind, visibility, usage_status) VALUES (?, 'image', 'public', 'pending_review')", [id(80)]);
      await assert.rejects(c.query("INSERT INTO media_assets (id, kind, visibility, usage_status) VALUES (?, 'document', 'private', 'approved')", [id(81)]), /ck_media_assets_private/);
      await assert.rejects(c.query("INSERT INTO media_assets (id, kind, visibility, usage_status) VALUES (?, 'document', 'private', 'pending_review')", [id(81)]), /ck_media_assets_private/);
      await c.query("INSERT INTO media_assets (id, kind, visibility, usage_status) VALUES (?, 'document', 'private', 'internal')", [id(81)]);
      await assert.rejects(c.query("UPDATE media_assets SET focal_x = 0.5 WHERE id = ?", [id(80)]), /ck_media_assets_focal/);
      await assert.rejects(c.query("UPDATE media_assets SET focal_x = 1.5, focal_y = 0.5 WHERE id = ?", [id(80)]), /ck_media_assets_focal|Out of range/);
      await c.query("UPDATE media_assets SET focal_x = 0.25, focal_y = 0.75 WHERE id = ?", [id(80)]);
      await assert.rejects(c.query("INSERT INTO media_folders (id, parent_id, name, position) VALUES (?, ?, 'Self', 1)", [id(82), id(82)]), /ck_media_folders_self|fk_media_folders_parent/);
      await c.query("UPDATE machines SET media_id = ? WHERE id = ?", [id(80), id(30)]);
      await assert.rejects(c.query("DELETE FROM media_assets WHERE id = ?", [id(80)]), /fk_machines_media_id/);
      await c.query("UPDATE machines SET media_id = NULL WHERE id = ?", [id(30)]);
      await c.query("DELETE FROM media_assets WHERE id IN (?, ?)", [id(80), id(81)]);
    } finally {
      await c.end();
    }
    assert.equal((await cli(database, ["status"])).code, 0);
  });

  test("F. no A2 or A3 row is lost or changed; new columns start NULL; the media tables start empty", async () => {
    const c = await serverConnection(database);
    try {
      const after = await snapshot(c, columnsBefore);
      for (const table of tables) {
        if (table === "audit_events" || table === "__drizzle_migrations") continue;
        assert.equal(after[table], before[table], `${table} changed`);
      }
      // Audit rows and the migration history only grew (append-only).
      for (const table of ["audit_events", "__drizzle_migrations"]) {
        const was = JSON.parse(before[table]) as unknown[];
        const now = JSON.parse(after[table]) as unknown[];
        assert.deepEqual(now.slice(0, was.length), was, table);
        assert.ok(now.length > was.length, table);
      }
      // Each A3 table gained exactly the A1 media columns (all NULL on the existing rows), and nothing else changed shape.
      for (const table of tables) {
        const added = (await columnsOf(c, table)).filter((col) => !columnsBefore[table].includes(col));
        assert.deepEqual(added.sort(), [...(A4_COLUMNS[table] ?? [])].sort(), table);
        for (const col of added) {
          const [{ n }] = await rows<{ n: number }>(c, `SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${col}\` IS NOT NULL`);
          assert.equal(Number(n), 0, `${table}.${col}`);
        }
      }
      for (const table of A4_TABLES) assert.equal(Number((await rows<{ n: number }>(c, `SELECT COUNT(*) AS n FROM \`${table}\``))[0].n), 0, `${table} starts empty`);
    } finally {
      await c.end();
    }
  });

  test("G. npm run db:check passes (drizzle-kit check, the migration files, the seed against the registries)", async () => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const { stdout } = await run(npm, ["run", "--silent", "db:check"], { cwd: ROOT, env: { ...process.env, NODE_ENV: "test" } });
    assert.match(stdout, /Migration files OK: 6/);
    assert.match(stdout, /Seed migrations match the registries/);
  });
});
