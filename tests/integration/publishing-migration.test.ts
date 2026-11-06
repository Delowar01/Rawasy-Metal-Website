/**
 * The A8 migrations (0010_publishing, 0011_seed_publishing, 0012_menu_positions) on a real MariaDB, as the A5–A7 proofs
 * A–G: A. an empty database takes every migration; B. a database at A7 (0000–0009) holding A2 accounts, A3 content, A4
 * media, A5 sections, A6 site controls (menus with top-level and nested items) and A7 enquiries takes exactly the three
 * A8 files; C. a second run is a no-op; D. the hash and order checks refuse a changed or reordered A8 file; E. every A8
 * table is InnoDB utf8mb4_unicode_520_ci with ids and keys ascii_bin, and the schema's own rules hold (the cache
 * singleton and positive generations, one live document per record and slug, a live document's revision kept, review
 * comments' keys, menu top-level positions unique and equal to position); F. no earlier row is lost or changed, the only
 * reshaped table is menu_items (one added column, filled from position for top-level items only), nothing is published
 * or indexed by a migration, and the seed writes exactly the cache generation's row; G. `npm run db:check` passes.
 * Run through scripts/db-migrate.mjs, as an operator would.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { after, describe, test } from "node:test";
import { MigrationError, readMigrations, runMigrations, verifyCharsets } from "../../src/server/db/migrate.ts";
import { FORM_IDS } from "../../src/server/forms/registry.ts";
import { INITIAL_CACHE_EPOCH } from "../../src/server/publishing/registry.ts";
import { createEmptyDatabase, MIGRATIONS, serverConfig, serverConnection } from "./helpers.ts";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "../..");
const CLI = join(ROOT, "scripts/db-migrate.mjs");
const A7_TAGS = [
  "0000_access_control",
  "0001_seed_access_control",
  "0002_core_cms",
  "0003_seed_core_cms",
  "0004_media_library",
  "0005_page_builder",
  "0006_site_controls",
  "0007_seed_site_controls",
  "0008_forms_enquiries",
  "0009_seed_forms_enquiries",
];
const A8_FILES = ["0010_publishing", "0011_seed_publishing", "0012_menu_positions"];
const ALL_TAGS = [...A7_TAGS, ...A8_FILES];
const A8_TABLES = ["cache_generation", "cache_invalidations", "content_references", "published_documents", "review_comments", "system_job_runs"];

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

/** A copy of the migrations as they stood at A7: the journal's first ten entries and files. */
function a7Folder() {
  const dir = mkdtempSync(join(tmpdir(), "rawasy-a7-migrations-"));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries.slice(10)) rmSync(join(dir, `${entry.tag}.sql`));
  journal.entries = journal.entries.slice(0, 10);
  writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

type Conn = Awaited<ReturnType<typeof serverConnection>>;
const rows = async <T = Record<string, unknown>>(c: Conn, statement: string, params: unknown[] = []) => (await c.query(statement, params))[0] as T[];
const count = async (c: Conn, table: string) => Number((await rows<{ n: number }>(c, `SELECT COUNT(*) AS n FROM \`${table}\``))[0].n);

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

const T = new Date("2026-11-06T09:00:00.000Z");
const USER = "01JA8MGTESTVSER0000000000Z";
const id = (n: number) => `01JA8MGTEST${String(n).padStart(15, "0")}`;

/** What an A7 installation holds (raw SQL): accounts, content, media, sections, menus with nesting, an enquiry. */
async function seedA7(c: Conn) {
  await c.query(
    "INSERT INTO users (id, email, email_normalized, display_name, status, password_hash, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
    [USER, "owner@example.test", "owner@example.test", "Test Owner", "$argon2id$v=19$m=19456,t=2,p=1$dGVzdA$dGVzdGhhc2g", T, T, T],
  );
  await c.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'owner', ?)", [USER, T]);
  await c.query("INSERT INTO audit_events (occurred_at, request_id, actor_type, actor_user_id, action, outcome, summary) VALUES (?, ?, 'user', ?, 'client.update', 'success', 'Test client')", [
    T,
    id(2),
    USER,
  ]);
  await c.query("INSERT INTO pages (id, page_type, slug, system_key, created_by, updated_by) VALUES (?, 'generic', 'test-page', NULL, ?, ?)", [id(10), USER, USER]);
  await c.query("INSERT INTO page_translations (page_id, locale, title) VALUES (?, 'en', 'Test page'), (?, 'ar', 'صفحة تجريبية')", [id(10), id(10)]);
  await c.query("INSERT INTO projects (id, slug, is_featured) VALUES (?, 'test-project', 1)", [id(30)]);
  await c.query("INSERT INTO project_translations (project_id, locale, title, summary) VALUES (?, 'en', 'Test project', 'Summary')", [id(30)]);
  await c.query("INSERT INTO media_assets (id, kind, visibility, usage_status) VALUES (?, 'image', 'public', 'approved')", [id(40)]);
  await c.query("INSERT INTO page_sections (id, page_id, block_type, schema_version, position, settings) VALUES (?, ?, 'generic.heading', 1, 1, '{}')", [id(50), id(10)]);
  // A6 menus: three top-level items of the header and one nested item (a dropdown entry), two footer items.
  const item = (iid: string, menu: string, parent: string | null, position: number, route: string) =>
    c.query("INSERT INTO menu_items (id, menu_key, parent_id, position, link_type, route_key) VALUES (?, ?, ?, ?, 'route', ?)", [iid, menu, parent, position, route]);
  await item(id(60), "header_main", null, 1, "home");
  await item(id(61), "header_main", null, 2, "about");
  await item(id(62), "header_main", null, 3, "services");
  await item(id(63), "header_main", id(61), 1, "clients");
  await item(id(64), "footer_company", null, 1, "about");
  await item(id(65), "footer_company", null, 2, "contact");
  await c.query("INSERT INTO menu_item_translations (item_id, locale, label) VALUES (?, 'en', 'Test home')", [id(60)]);
  // A7: an enquiry (synthetic) on the seeded quote form.
  await c.query(
    "INSERT INTO enquiries (id, reference, form_id, locale, submitted_at, source_path, full_name, email, message) VALUES (?, 'Q-2026-00001', ?, 'en', ?, '/en/contact', 'Test', 'test@example.test', 'Test message')",
    [id(70), FORM_IDS.quote, T],
  );
}

describe("A. an empty database", () => {
  test("takes all thirteen migrations, then reports nothing pending", async () => {
    const database = await freshDatabase("a8mig_a");
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    for (const tag of ALL_TAGS) assert.match(up.stdout, new RegExp(`Applied ${tag}`));
    const status = await cli(database, ["status"]);
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, new RegExp(`Applied \\(13\\): ${ALL_TAGS.join(", ")}`));
    assert.match(status.stdout, /Pending \(0\): none/);
  });
});

describe("B–G. a database at A7 with accounts, content, media, sections, menus and an enquiry, upgraded to A8", () => {
  let database = "";
  let tables: string[] = [];
  const columnsBefore: Record<string, string[]> = {};
  let before: Record<string, string> = {};

  test("B. an A7 database takes exactly the three A8 files", async () => {
    database = await freshDatabase("a8mig_b");
    const c = await serverConnection(database);
    try {
      const a7 = await runMigrations(c, readMigrations(a7Folder()), { appEnv: "local", operator: "cli:test" });
      assert.deepEqual(a7.applied, A7_TAGS);
      await seedA7(c);
      tables = (await rows<{ t: string }>(c, "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME")).map((r) => r.t);
      assert.equal(tables.length, 82, tables.join(","));
      for (const table of A8_TABLES) assert.ok(!tables.includes(table), `${table} exists before A8`);
      for (const table of tables) columnsBefore[table] = await columnsOf(c, table);
      before = await snapshot(c, columnsBefore);
    } finally {
      await c.end();
    }
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    for (const tag of A8_FILES) assert.match(up.stdout, new RegExp(`Applied ${tag}`));
    assert.doesNotMatch(up.stdout, /Applied 000\d/);
  });

  test("C. a second run is a no-op", async () => {
    const again = await cli(database, ["up"]);
    assert.equal(again.code, 0);
    assert.match(again.stdout, /Nothing to apply/);
    const status = await cli(database, ["status"]);
    assert.match(status.stdout, new RegExp(`Applied \\(13\\): ${ALL_TAGS.join(", ")}`));
  });

  test("D. the hash and order checks refuse a changed or reordered A8 file", async () => {
    for (const tag of A8_FILES) {
      const dir = mkdtempSync(join(tmpdir(), "rawasy-a8-migrations-"));
      cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
      cpSync(MIGRATIONS, dir, { recursive: true });
      const file = join(dir, `${tag}.sql`);
      writeFileSync(file, readFileSync(file, "utf8").replace("--", "-- changed:"));
      assert.notEqual(readFileSync(file, "utf8"), readFileSync(join(MIGRATIONS, `${tag}.sql`), "utf8"));
      const c = await serverConnection(database);
      try {
        await assert.rejects(
          runMigrations(c, readMigrations(dir), { appEnv: "local" }),
          (e: unknown) => e instanceof MigrationError && e.kind === "history" && new RegExp(`${tag}\\.sql changed after it was applied`).test(e.message),
          tag,
        );
      } finally {
        await c.end();
      }
    }
    const dir = mkdtempSync(join(tmpdir(), "rawasy-a8-migrations-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    cpSync(MIGRATIONS, dir, { recursive: true });
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
    journal.entries[12].when = journal.entries[11].when - 1;
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    assert.throws(() => readMigrations(dir), (e: unknown) => e instanceof MigrationError && e.kind === "journal" && /out of order/.test(e.message));
  });

  test("E. every A8 table is InnoDB utf8mb4_unicode_520_ci; ids and keys ascii_bin; the schema's rules hold", async () => {
    const c = await serverConnection(database);
    try {
      const all = await rows<{ t: string; e: string; co: string }>(
        c,
        "SELECT TABLE_NAME AS t, ENGINE AS e, TABLE_COLLATION AS co FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
      );
      const a8 = all.filter((r) => A8_TABLES.includes(r.t));
      assert.equal(a8.length, A8_TABLES.length);
      assert.equal(all.length, tables.length + A8_TABLES.length);
      for (const table of a8) assert.deepEqual([table.e, table.co], ["InnoDB", "utf8mb4_unicode_520_ci"], table.t);
      const keys = await rows<{ t: string; c: string; co: string }>(
        c,
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLLATION_NAME AS co FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL
            AND (COLUMN_NAME IN ('id', 'epoch', 'tag', 'locale', 'slug', 'scope', 'field_path', 'source_type', 'target_type', 'entity_type', 'job_key')
              OR COLUMN_NAME LIKE '%\\_id' OR COLUMN_NAME LIKE '%\\_by' OR COLUMN_NAME LIKE '%\\_request')`,
      );
      const a8Keys = keys.filter((k) => A8_TABLES.includes(k.t) && k.c !== "scope");
      assert.ok(a8Keys.length >= 20, a8Keys.map((k) => `${k.t}.${k.c}`).join(","));
      for (const key of a8Keys) assert.equal(key.co, "ascii_bin", `${key.t}.${key.c}`);
      for (const [table, column] of [
        ["review_comments", "body"],
        ["system_job_runs", "summary"],
      ]) {
        const [col] = await rows<{ co: string }>(c, "SELECT COLLATION_NAME AS co FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [table, column]);
        assert.equal(col.co, "utf8mb4_unicode_520_ci", `${table}.${column}`);
      }
      assert.deepEqual(await verifyCharsets(c), []);

      const insert = (table: string, row: Record<string, unknown>) => {
        const names = Object.keys(row);
        return c.query(`INSERT INTO \`${table}\` (${names.map((n) => `\`${n}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, Object.values(row));
      };
      // The cache generation is one row; invalidations carry a generation above 0.
      await assert.rejects(insert("cache_generation", { id: 2, epoch: INITIAL_CACHE_EPOCH, value: 0 }), /ck_cache_generation_singleton/);
      await assert.rejects(insert("cache_generation", { id: 1, epoch: INITIAL_CACHE_EPOCH, value: 0 }), /Duplicate|PRIMARY/);
      await assert.rejects(insert("cache_invalidations", { tag: "client:test", generation: 0, invalidated_at: T }), /ck_cache_invalidations_generation/);
      // A live document: one per record, one per slug within a type, and its revision is kept while it is live.
      const revision = (rid: string, n: number) =>
        insert("revisions", { id: rid, entity_type: "client", entity_id: id(100), revision_number: n, kind: "publish", schema_version: 1, snapshot: "{}", snapshot_sha256: Buffer.alloc(32, n), is_sealed: 1, created_at: T });
      await revision(id(101), 1);
      await revision(id(102), 2);
      const doc = (fields: Record<string, unknown>) =>
        insert("published_documents", { entity_type: "client", entity_id: id(100), revision_id: id(101), slug: "test-client", schema_version: 1, document: "{}", content_sha256: Buffer.alloc(32, 1), published_at: T, ...fields });
      await doc({});
      await assert.rejects(doc({ revision_id: id(102) }), /Duplicate|PRIMARY/);
      await assert.rejects(doc({ entity_id: id(103) }), /uq_published_documents_slug/);
      await doc({ entity_type: "project", entity_id: id(103) });
      await assert.rejects(doc({ entity_id: id(104), revision_id: "01JA8MGTESTN0REV000000000Z", slug: "other" }), /fk_published_documents_revision/);
      await assert.rejects(c.query("DELETE FROM revisions WHERE id = ?", [id(101)]), /fk_published_documents_revision/);
      // Review comments: a known language; a revision removed or a user removed leaves the comment (SET NULL).
      await assert.rejects(insert("review_comments", { id: id(110), entity_type: "client", entity_id: id(100), locale: "fr", body: "Test" }), /fk_review_comments_locale/);
      await insert("review_comments", { id: id(110), entity_type: "client", entity_id: id(100), revision_id: id(102), author_id: USER, body: "Test comment" });
      await c.query("DELETE FROM revisions WHERE id = ?", [id(102)]);
      assert.deepEqual(await rows(c, "SELECT revision_id FROM review_comments WHERE id = ?", [id(110)]), [{ revision_id: null }]);
      // Menu top-level positions: unique per menu and equal to position; nested items carry none.
      const item = (iid: string, fields: Record<string, unknown>) => insert("menu_items", { id: iid, menu_key: "header_main", link_type: "route", route_key: "contact", ...fields });
      await assert.rejects(item(id(120), { parent_id: null, position: 2, top_position: 2 }), /uq_menu_items_top_position/);
      await assert.rejects(item(id(120), { parent_id: null, position: 4, top_position: null }), /ck_menu_items_top/);
      await assert.rejects(item(id(120), { parent_id: null, position: 4, top_position: 5 }), /ck_menu_items_top/);
      await assert.rejects(item(id(120), { parent_id: id(61), position: 2, top_position: 2 }), /ck_menu_items_top/);
      await item(id(120), { parent_id: id(61), position: 2, top_position: null });
      await item(id(121), { parent_id: null, position: 4, top_position: 4 });
      // The probe rows go again (F compares what the migrations left).
      await c.query("DELETE FROM menu_items WHERE id IN (?, ?)", [id(120), id(121)]);
      await c.query("DELETE FROM review_comments");
      await c.query("DELETE FROM published_documents");
      await c.query("DELETE FROM revisions");
    } finally {
      await c.end();
    }
    assert.equal((await cli(database, ["status"])).code, 0);
  });

  test("F. no earlier row lost or changed; only menu_items gains a column (top-level items filled); nothing published", async () => {
    const c = await serverConnection(database);
    try {
      const after = await snapshot(c, columnsBefore);
      for (const table of tables) {
        if (table === "audit_events" || table === "__drizzle_migrations") continue;
        assert.equal(after[table], before[table], `${table} changed`);
      }
      for (const table of ["audit_events", "__drizzle_migrations"]) {
        const was = JSON.parse(before[table]) as unknown[];
        const now = JSON.parse(after[table]) as unknown[];
        assert.deepEqual(now.slice(0, was.length), was, table);
      }
      for (const table of tables) {
        const expected = table === "menu_items" ? [...columnsBefore[table], "top_position"] : columnsBefore[table];
        assert.deepEqual(await columnsOf(c, table), expected, `${table} changed shape`);
      }
      assert.deepEqual(await rows(c, "SELECT id, parent_id, position, top_position FROM menu_items ORDER BY id"), [
        { id: id(60), parent_id: null, position: 1, top_position: 1 },
        { id: id(61), parent_id: null, position: 2, top_position: 2 },
        { id: id(62), parent_id: null, position: 3, top_position: 3 },
        { id: id(63), parent_id: id(61), position: 1, top_position: null },
        { id: id(64), parent_id: null, position: 1, top_position: 1 },
        { id: id(65), parent_id: null, position: 2, top_position: 2 },
      ]);
      const [generation] = await rows<{ id: number; epoch: string; value: number }>(c, "SELECT id, epoch, value FROM cache_generation");
      assert.deepEqual({ ...generation, value: Number(generation.value) }, { id: 1, epoch: INITIAL_CACHE_EPOCH, value: 0 });
      assert.equal(await count(c, "cache_generation"), 1);
      for (const table of A8_TABLES.filter((t) => t !== "cache_generation")) assert.equal(await count(c, table), 0, `${table} starts empty`);
      assert.equal(await count(c, "revisions"), 0, "no revision is written by a migration");
    } finally {
      await c.end();
    }
  });

  test("G. npm run db:check passes (drizzle-kit check, the migration files, the seed against the registries)", async () => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const { stdout } = await run(npm, ["run", "--silent", "db:check"], { cwd: ROOT, env: { ...process.env, NODE_ENV: "test" } });
    assert.match(stdout, /Migration files OK: 13/);
    assert.match(stdout, /Seed migrations match the registries/);
  });
});
