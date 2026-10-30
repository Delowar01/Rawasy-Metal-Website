/**
 * The A5 migration (0005_page_builder) on a real MariaDB — the A5 brief's proofs A–G (§8):
 * A. an empty database takes every migration; B. a database at A4 (0000–0004) holding A2 accounts, A3 content and A4
 * media takes the A5 file (and, since A6, 0006–0007 after it); C. a second run is a no-op; D. the hash and order checks still refuse a changed or
 * reordered A5 file; E. every A5 table is InnoDB utf8mb4_unicode_520_ci with ids and keys ascii_bin, and the schema's own
 * rules hold (one owner, a visible device, anchor and key formats, unique positions and anchors per owner, the reusable
 * link RESTRICT, the owner CASCADE); F. no A2, A3 or A4 row is lost or changed, no existing table changes shape and the
 * section tables start empty (nothing of today's website is imported); G. `npm run db:check` passes. Run through
 * scripts/db-migrate.mjs, as an operator would.
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
const ALL_TAGS = ["0000_access_control", "0001_seed_access_control", "0002_core_cms", "0003_seed_core_cms", "0004_media_library", "0005_page_builder"];
/** A6 added 0006_site_controls and 0007_seed_site_controls after the A5 file: every committed migration applies, A5's among them. */
const COMMITTED = [...ALL_TAGS, "0006_site_controls", "0007_seed_site_controls"];
/** The tables 0006 adds (A6's own proofs: tests/integration/site-migration.test.ts). */
const A6_TABLE_COUNT = 11;
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

/** A copy of the migrations as they stood at A4: the journal's first five entries and files. */
function a4Folder() {
  const dir = mkdtempSync(join(tmpdir(), "rawasy-a4-migrations-"));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries.slice(5)) rmSync(join(dir, `${entry.tag}.sql`));
  journal.entries = journal.entries.slice(0, 5);
  writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

type Conn = Awaited<ReturnType<typeof serverConnection>>;
const rows = async <T = Record<string, unknown>>(c: Conn, statement: string, params: unknown[] = []) => (await c.query(statement, params))[0] as T[];

async function columnsOf(c: Conn, table: string): Promise<string[]> {
  return (
    await rows<{ c: string }>(c, "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION", [table])
  ).map((r) => r.c);
}

/** Every row of every table, as JSON per table (binary values as hex). */
async function snapshot(c: Conn, columns: Record<string, string[]>) {
  const out: Record<string, string> = {};
  for (const [table, list] of Object.entries(columns)) {
    const select = list.map((col) => `\`${col}\``).join(", ");
    out[table] = JSON.stringify(await rows(c, `SELECT ${select} FROM \`${table}\` ORDER BY ${select}`), (_k, v) => (Buffer.isBuffer(v) ? v.toString("hex") : v));
  }
  return out;
}

const T = new Date("2026-10-16T09:00:00.000Z");
const USER = "01JA5MIGTESTUSER0000000000";
const id = (n: number) => `01JA5MIGTEST${String(n).padStart(14, "0")}`;

/** A2 accounts, A3 content and A4 media as an A4 installation holds them (raw SQL: the A4 schema, not today's). */
async function seedA4(c: Conn) {
  await c.query(
    "INSERT INTO users (id, email, email_normalized, display_name, status, password_hash, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
    [USER, "owner@example.test", "owner@example.test", "Test Owner", "$argon2id$v=19$m=19456,t=2,p=1$dGVzdA$dGVzdGhhc2g", T, T, T],
  );
  await c.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'owner', ?)", [USER, T]);
  await c.query(
    "INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, idle_expires_at, absolute_expires_at, reauthenticated_at, mfa_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id(1), USER, Buffer.alloc(32, 7), T, T, T, T, T, T],
  );
  await c.query("INSERT INTO audit_events (occurred_at, request_id, actor_type, actor_user_id, action, outcome, summary) VALUES (?, ?, 'user', ?, 'media.upload', 'success', 'Test media')", [
    T,
    id(2),
    USER,
  ]);
  // A3 content: a generic page, the homepage record, a service with a project.
  await c.query("INSERT INTO pages (id, page_type, slug, system_key, created_by, updated_by) VALUES (?, 'generic', 'test-page', NULL, ?, ?)", [id(10), USER, USER]);
  await c.query("INSERT INTO pages (id, page_type, slug, system_key) VALUES (?, 'home', NULL, 'home')", [id(11)]);
  await c.query("INSERT INTO page_translations (page_id, locale, title) VALUES (?, 'en', 'Test page'), (?, 'ar', 'صفحة تجريبية')", [id(10), id(10)]);
  await c.query("INSERT INTO services (id, slug, service_group, icon_key) VALUES (?, 'test-service', 'metal', 'laser-cutting')", [id(20)]);
  await c.query(
    `INSERT INTO service_translations (service_id, locale, name, tagline, summary, body, highlights)
     VALUES (?, 'en', 'Test service', 'Tagline', 'Summary', '{"type":"doc","content":[]}', '[]')`,
    [id(20)],
  );
  await c.query("INSERT INTO projects (id, slug, is_featured) VALUES (?, 'test-project', 1)", [id(30)]);
  await c.query("INSERT INTO project_translations (project_id, locale, title, summary) VALUES (?, 'en', 'Test project', 'Summary')", [id(30)]);
  await c.query("INSERT INTO entity_ordering_items (ordering_key, entity_id, position) VALUES ('services', ?, 1), ('projects', ?, 1)", [id(20), id(30)]);
  // A4 media: an approved upload with its file, a variant, texts, a flag and its delivery row, used by the project.
  await c.query("INSERT INTO media_assets (id, kind, visibility, usage_status, focal_x, focal_y) VALUES (?, 'image', 'public', 'approved', 0.25, 0.75)", [id(40)]);
  await c.query(
    `INSERT INTO media_files (id, media_id, version, storage_area, storage_key, original_filename, mime_type, extension, byte_size, sha256, width, height, processing_status, uploaded_at)
     VALUES (?, ?, 1, 'originals', '2026/10/01JA5MIGTEST.jpg', 'test.jpg', 'image/jpeg', 'jpg', 1000, ?, 640, 480, 'ready', ?)`,
    [id(41), id(40), Buffer.alloc(32, 1), T],
  );
  await c.query("UPDATE media_assets SET current_file_id = ? WHERE id = ?", [id(41), id(40)]);
  await c.query(
    "INSERT INTO media_variants (id, file_id, variant_key, format, width, height, byte_size, storage_key, sha256, created_at) VALUES (?, ?, 'w640', 'webp', 640, 480, 500, ?, ?, ?)",
    [id(42), id(41), `${id(40)}/w640-0a0b0c0d.webp`, Buffer.alloc(32, 2), T],
  );
  await c.query("INSERT INTO media_translations (media_id, locale, alt_text, title) VALUES (?, 'en', 'Test photo', 'Test photo')", [id(40)]);
  await c.query("INSERT INTO media_flags (media_id, flag, note, created_at, created_by) VALUES (?, 'ai_watermark', 'Test flag', ?, ?)", [id(40), T, USER]);
  await c.query("INSERT INTO public_media (media_id, file_id, kind, src, width, height, variants, updated_at) VALUES (?, ?, 'image', ?, 640, 480, ?, ?)", [
    id(40),
    id(41),
    `/media/u/${id(40)}/w640-0a0b0c0d.webp`,
    JSON.stringify([{ width: 640, url: `/media/u/${id(40)}/w640-0a0b0c0d.webp` }]),
    T,
  ]);
  await c.query("INSERT INTO project_media (project_id, media_id, position) VALUES (?, ?, 1)", [id(30), id(40)]);
}

describe("A. an empty database", () => {
  test("takes every migration (A5's six, then A6's 0006–0007), then reports nothing pending", async () => {
    const database = await freshDatabase("a5mig_a");
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    for (const tag of COMMITTED) assert.match(up.stdout, new RegExp(`Applied ${tag}`));
    const status = await cli(database, ["status"]);
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, new RegExp(`Applied \\(8\\): ${COMMITTED.join(", ")}`));
    assert.match(status.stdout, /Pending \(0\): none/);
  });
});

describe("B–G. a database at A4 with accounts, content and media, upgraded to A5", () => {
  let database = "";
  let tables: string[] = [];
  const columnsBefore: Record<string, string[]> = {};
  let before: Record<string, string> = {};

  test("B. an A4 database with A2 accounts, A3 content and A4 media takes the A5 file (and, since A6, 0006–0007 after it)", async () => {
    database = await freshDatabase("a5mig_b");
    const c = await serverConnection(database);
    try {
      const a4 = await runMigrations(c, readMigrations(a4Folder()), { appEnv: "local", operator: "cli:test" });
      assert.deepEqual(a4.applied, ALL_TAGS.slice(0, 5));
      await seedA4(c);
      tables = (await rows<{ t: string }>(c, "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME")).map((r) => r.t);
      assert.equal(tables.length, 57, tables.join(","));
      for (const table of A5_TABLES) assert.ok(!tables.includes(table), `${table} exists before A5`);
      for (const table of tables) columnsBefore[table] = await columnsOf(c, table);
      before = await snapshot(c, columnsBefore);
    } finally {
      await c.end();
    }
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    assert.match(up.stdout, /Applied 0005_page_builder/);
    assert.match(up.stdout, /Applied 0006_site_controls/);
    assert.match(up.stdout, /Applied 0007_seed_site_controls/);
    assert.doesNotMatch(up.stdout, /Applied 000[0-4]/);
  });

  test("C. a second run is a no-op", async () => {
    const again = await cli(database, ["up"]);
    assert.equal(again.code, 0);
    assert.match(again.stdout, /Nothing to apply/);
    const status = await cli(database, ["status"]);
    assert.match(status.stdout, new RegExp(`Applied \\(8\\): ${COMMITTED.join(", ")}`));
  });

  test("D. the hash and order checks still refuse a changed or reordered A5 file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rawasy-a5-migrations-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    cpSync(MIGRATIONS, dir, { recursive: true });
    const file = join(dir, "0005_page_builder.sql");
    writeFileSync(file, readFileSync(file, "utf8").replace("no row is\n-- written.", "no row is\n-- written!"));
    assert.notEqual(readFileSync(file, "utf8"), readFileSync(join(MIGRATIONS, "0005_page_builder.sql"), "utf8"));
    const c = await serverConnection(database);
    try {
      await assert.rejects(
        runMigrations(c, readMigrations(dir), { appEnv: "local" }),
        (e: unknown) => e instanceof MigrationError && e.kind === "history" && /0005_page_builder\.sql changed after it was applied/.test(e.message),
      );
    } finally {
      await c.end();
    }
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
    journal.entries[5].when = journal.entries[4].when - 1;
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    assert.throws(() => readMigrations(dir), (e: unknown) => e instanceof MigrationError && e.kind === "journal" && /out of order/.test(e.message));
  });

  test("E. every A5 table is InnoDB utf8mb4_unicode_520_ci; ids and keys ascii_bin; the schema's rules hold", async () => {
    const c = await serverConnection(database);
    try {
      const all = await rows<{ t: string; e: string; co: string }>(
        c,
        "SELECT TABLE_NAME AS t, ENGINE AS e, TABLE_COLLATION AS co FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
      );
      const a5 = all.filter((r) => A5_TABLES.includes(r.t));
      assert.equal(a5.length, A5_TABLES.length);
      assert.equal(all.length, tables.length + A5_TABLES.length + A6_TABLE_COUNT);
      for (const table of a5) assert.deepEqual([table.e, table.co], ["InnoDB", "utf8mb4_unicode_520_ci"], table.t);
      const keys = await rows<{ t: string; c: string; co: string }>(
        c,
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLLATION_NAME AS co FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL
            AND (COLUMN_NAME IN ('id', 'locale', 'block_type', 'anchor') OR COLUMN_NAME LIKE '%\\_id' OR COLUMN_NAME LIKE '%\\_by')`,
      );
      const a5Keys = keys.filter((k) => A5_TABLES.includes(k.t));
      assert.equal(a5Keys.length, 26, a5Keys.map((k) => `${k.t}.${k.c}`).join(","));
      for (const key of a5Keys) assert.equal(key.co, "ascii_bin", `${key.t}.${key.c}`);
      const [name] = await rows<{ co: string }>(c, "SELECT COLLATION_NAME AS co FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reusable_sections' AND COLUMN_NAME = 'name'");
      assert.equal(name.co, "utf8mb4_unicode_520_ci");
      assert.deepEqual(await verifyCharsets(c), []);

      // The schema's own rules (the application validates the same before any write).
      const S = (n: number) => id(500 + n);
      const insert = (sid: string, fields: Record<string, unknown>) => {
        const row = { id: sid, block_type: "generic.rich_text", schema_version: 1, position: 1, settings: "{}", ...fields };
        const names = Object.keys(row);
        return c.query(`INSERT INTO page_sections (${names.map((n) => `\`${n}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, Object.values(row));
      };
      await insert(S(1), { page_id: id(10) });
      await assert.rejects(insert(S(2), { page_id: null, service_id: null, position: 2 }), /ck_page_sections_owner/);
      await assert.rejects(insert(S(2), { page_id: id(10), service_id: id(20), position: 2 }), /ck_page_sections_owner/);
      await assert.rejects(insert(S(2), { page_id: id(10), position: 2, show_desktop: 0, show_tablet: 0, show_mobile: 0 }), /ck_page_sections_devices/);
      await assert.rejects(insert(S(2), { page_id: id(10), position: 0 }), /ck_page_sections_position/);
      await assert.rejects(insert(S(2), { page_id: id(10), position: 2, schema_version: 0 }), /ck_page_sections_schema_version/);
      for (const bad of ["Generic.hero", "generic", "generic.hero.x", "generic.he-ro", "<script>.x", "1generic.hero"]) {
        await assert.rejects(insert(S(2), { page_id: id(10), position: 2, block_type: bad }), /ck_page_sections_block_type/, bad);
      }
      for (const bad of ["Quote", "-quote", "quote-", "quote--form", "1quote", "quote form", "quöte"]) {
        await assert.rejects(insert(S(2), { page_id: id(10), position: 2, anchor: bad }), /ck_page_sections_anchor|Incorrect string value/, bad);
      }
      await assert.rejects(insert(S(2), { page_id: id(10), position: 2, settings: "{not json" }), /settings|CONSTRAINT/);
      // One position and one anchor per owner; another owner may use the same ones.
      await assert.rejects(insert(S(2), { page_id: id(10), position: 1 }), /uq_page_sections_page_position/);
      await c.query("UPDATE page_sections SET anchor = 'faq' WHERE id = ?", [S(1)]);
      await assert.rejects(insert(S(2), { page_id: id(10), position: 2, anchor: "faq" }), /uq_page_sections_page_anchor/);
      await insert(S(2), { service_id: id(20), position: 1, anchor: "faq" });
      await insert(S(3), { service_id: id(20), position: 2 });
      await insert(S(4), { service_id: id(20), position: 3 });
      await assert.rejects(insert(S(5), { service_id: id(20), position: 2 }), /uq_page_sections_service_position/);
      await assert.rejects(insert(S(5), { page_id: "01JA5MIGTESTNOPAGE00000000", position: 9 }), /fk_page_sections_page/);
      // Translations: one row per language, a known language, CASCADE with the section.
      await c.query("INSERT INTO page_section_translations (section_id, locale, content) VALUES (?, 'en', '{}'), (?, 'ar', '{}')", [S(1), S(1)]);
      await assert.rejects(c.query("INSERT INTO page_section_translations (section_id, locale, content) VALUES (?, 'fr', '{}')", [S(1)]), /fk_page_section_translations_locale/);
      // A reusable section is RESTRICTed while a section links it; detaching (clearing the link) frees it.
      await c.query("INSERT INTO reusable_sections (id, name, block_type, schema_version, settings) VALUES (?, 'Test reusable', 'generic.faq', 1, '{}')", [id(600)]);
      await c.query("INSERT INTO reusable_section_translations (reusable_section_id, locale, content) VALUES (?, 'en', '{}')", [id(600)]);
      await assert.rejects(c.query("INSERT INTO reusable_sections (id, name, block_type, schema_version, settings, publication_status) VALUES (?, 'Live', 'generic.faq', 1, '{}', 'published')", [id(601)]), /ck_reusable_sections_live/);
      await assert.rejects(c.query("INSERT INTO reusable_sections (id, name, block_type, schema_version, settings, publication_status) VALUES (?, 'Archived', 'generic.faq', 1, '{}', 'archived')", [id(601)]), /ck_reusable_sections_archived/);
      await c.query("UPDATE page_sections SET reusable_section_id = ? WHERE id = ?", [id(600), S(3)]);
      await assert.rejects(c.query("DELETE FROM reusable_sections WHERE id = ?", [id(600)]), /fk_page_sections_reusable/);
      await c.query("UPDATE page_sections SET reusable_section_id = NULL, detached_from_id = ? WHERE id = ?", [id(600), S(3)]);
      await c.query("DELETE FROM reusable_sections WHERE id = ?", [id(600)]);
      assert.equal(Number((await rows<{ n: number }>(c, "SELECT COUNT(*) AS n FROM reusable_section_translations"))[0].n), 0, "translations cascade");
      // Removing the owner removes its sections and their texts (CASCADE).
      await c.query("DELETE FROM page_sections WHERE service_id = ?", [id(20)]);
      await c.query("DELETE FROM page_sections WHERE id = ?", [S(1)]);
      for (const table of A5_TABLES) assert.equal(Number((await rows<{ n: number }>(c, `SELECT COUNT(*) AS n FROM \`${table}\``))[0].n), 0, `${table} cleaned up`);
    } finally {
      await c.end();
    }
    assert.equal((await cli(database, ["status"])).code, 0);
  });

  test("F. no A2, A3 or A4 row is lost or changed; no existing table changes shape; the section tables start empty", async () => {
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
      for (const table of tables) assert.deepEqual(await columnsOf(c, table), columnsBefore[table], `${table} changed shape`);
      // E removed its own probe rows: nothing of today's website is in the section tables (A9 imports it).
      for (const table of A5_TABLES) assert.equal(Number((await rows<{ n: number }>(c, `SELECT COUNT(*) AS n FROM \`${table}\``))[0].n), 0, `${table} starts empty`);
    } finally {
      await c.end();
    }
  });

  test("G. npm run db:check passes (drizzle-kit check, the migration files, the seed against the registries)", async () => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const { stdout } = await run(npm, ["run", "--silent", "db:check"], { cwd: ROOT, env: { ...process.env, NODE_ENV: "test" } });
    assert.match(stdout, /Migration files OK: 8/);
    assert.match(stdout, /Seed migrations match the registries/);
  });
});
