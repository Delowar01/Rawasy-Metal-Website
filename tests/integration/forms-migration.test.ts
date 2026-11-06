/**
 * The A7 migrations (0008_forms_enquiries, 0009_seed_forms_enquiries) on a real MariaDB, as A5's and A6's proofs A–G:
 * A. an empty database takes every migration; B. a database at A6 (0000–0007) holding A2 accounts, A3 content, A4
 * media, A5 sections and an A6 working copy takes exactly the two A7 files; C. a second run is a no-op; D. the hash and
 * order checks refuse a changed or reordered A7 file; E. every A7 table is InnoDB utf8mb4_unicode_520_ci with ids and
 * keys ascii_bin, and the schema's own rules hold (the form key, the limits, no retention period below 30 days, field
 * positions and keys, the reference's form, the statuses, the year, the cascades and RESTRICT keys); F. no earlier row is
 * lost or changed, no existing table changes shape, and the seed writes exactly the quote form's root row — handoff, no
 * retention period, no field, text or enquiry (the admin's set-up copies today's form); G. `npm run db:check` passes.
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
import { createEmptyDatabase, MIGRATIONS, serverConfig, serverConnection } from "./helpers.ts";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "../..");
const CLI = join(ROOT, "scripts/db-migrate.mjs");
const A5_TAGS = ["0000_access_control", "0001_seed_access_control", "0002_core_cms", "0003_seed_core_cms", "0004_media_library", "0005_page_builder"];
const A6_TAGS = [...A5_TAGS, "0006_site_controls", "0007_seed_site_controls"];
const ALL_TAGS = [...A6_TAGS, "0008_forms_enquiries", "0009_seed_forms_enquiries"];
/** A8 added 0010–0012 after the A7 files: every committed migration applies. */
const COMMITTED = [...ALL_TAGS, "0010_publishing", "0011_seed_publishing", "0012_menu_positions"];
const A7_TABLES = [
  "email_outbox",
  "enquiries",
  "enquiry_files",
  "enquiry_notes",
  "enquiry_reference_counters",
  "enquiry_status_history",
  "form_field_translations",
  "form_fields",
  "form_translations",
  "forms",
];

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

/** A copy of the migrations as they stood at A6: the journal's first eight entries and files. */
function a6Folder() {
  const dir = mkdtempSync(join(tmpdir(), "rawasy-a6-migrations-"));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries.slice(8)) rmSync(join(dir, `${entry.tag}.sql`));
  journal.entries = journal.entries.slice(0, 8);
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

const T = new Date("2026-10-30T09:00:00.000Z");
const USER = "01JA7MGTESTVSER0000000000Z";
const id = (n: number) => `01JA7MGTEST${String(n).padStart(15, "0")}`;

/** A2 accounts, A3 content, A4 media, A5 sections and an A6 working copy as an A6 installation holds them (raw SQL). */
async function seedA6(c: Conn) {
  await c.query(
    "INSERT INTO users (id, email, email_normalized, display_name, status, password_hash, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
    [USER, "owner@example.test", "owner@example.test", "Test Owner", "$argon2id$v=19$m=19456,t=2,p=1$dGVzdA$dGVzdGhhc2g", T, T, T],
  );
  await c.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'owner', ?)", [USER, T]);
  await c.query(
    "INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, idle_expires_at, absolute_expires_at, reauthenticated_at, mfa_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id(1), USER, Buffer.alloc(32, 7), T, T, T, T, T, T],
  );
  await c.query("INSERT INTO audit_events (occurred_at, request_id, actor_type, actor_user_id, action, outcome, summary) VALUES (?, ?, 'user', ?, 'layout.save', 'success', 'Test layout')", [
    T,
    id(2),
    USER,
  ]);
  // A3 content.
  await c.query("INSERT INTO pages (id, page_type, slug, system_key, created_by, updated_by) VALUES (?, 'generic', 'test-page', NULL, ?, ?)", [id(10), USER, USER]);
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
  // A4 media.
  await c.query("INSERT INTO media_assets (id, kind, visibility, usage_status) VALUES (?, 'image', 'public', 'approved')", [id(40)]);
  await c.query("INSERT INTO media_translations (media_id, locale, alt_text, title) VALUES (?, 'en', 'Test photo', 'Test photo')", [id(40)]);
  // A5 sections: a page's section with its texts, and a reusable section.
  await c.query("INSERT INTO page_sections (id, page_id, block_type, schema_version, position, settings) VALUES (?, ?, 'generic.heading', 1, 1, '{}')", [id(50), id(10)]);
  await c.query("INSERT INTO page_section_translations (section_id, locale, content) VALUES (?, 'en', '{\"title\":\"Test heading\"}')", [id(50)]);
  await c.query("INSERT INTO reusable_sections (id, name, block_type, schema_version, settings) VALUES (?, 'Test reusable', 'generic.cta', 1, '{}')", [id(60)]);
  // A6: a phone of the settings' working copy and a redirect.
  await c.query("INSERT INTO company_phones (id, settings_id, position, display, e164, has_whatsapp) VALUES (?, 'site', 1, '+966 50 000 0000', '+966500000000', 1)", [id(70)]);
  await c.query("INSERT INTO redirects (id, source_path, target_type, target_path, status_code, reason) VALUES (?, '/en/old-test', 'path', '/en/about', 308, 'manual')", [id(71)]);
}

describe("A. an empty database", () => {
  test("takes every committed migration (A7's ten, then A8's 0010–0012), then reports nothing pending", async () => {
    const database = await freshDatabase("a7mig_a");
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    for (const tag of COMMITTED) assert.match(up.stdout, new RegExp(`Applied ${tag}`));
    const status = await cli(database, ["status"]);
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, new RegExp(`Applied \\(13\\): ${COMMITTED.join(", ")}`));
    assert.match(status.stdout, /Pending \(0\): none/);
  });
});

describe("B–G. a database at A6 with accounts, content, media, sections and site controls, upgraded to A7", () => {
  let database = "";
  let tables: string[] = [];
  const columnsBefore: Record<string, string[]> = {};
  let before: Record<string, string> = {};

  test("B. an A6 database takes exactly the two A7 files", async () => {
    database = await freshDatabase("a7mig_b");
    const c = await serverConnection(database);
    try {
      const a6 = await runMigrations(c, readMigrations(a6Folder()), { appEnv: "local", operator: "cli:test" });
      assert.deepEqual(a6.applied, A6_TAGS);
      await seedA6(c);
      tables = (await rows<{ t: string }>(c, "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME")).map((r) => r.t);
      assert.equal(tables.length, 72, tables.join(","));
      for (const table of A7_TABLES) assert.ok(!tables.includes(table), `${table} exists before A7`);
      for (const table of tables) columnsBefore[table] = await columnsOf(c, table);
      before = await snapshot(c, columnsBefore);
    } finally {
      await c.end();
    }
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    assert.match(up.stdout, /Applied 0008_forms_enquiries/);
    assert.match(up.stdout, /Applied 0009_seed_forms_enquiries/);
    assert.doesNotMatch(up.stdout, /Applied 000[0-7]/);
  });

  test("C. a second run is a no-op", async () => {
    const again = await cli(database, ["up"]);
    assert.equal(again.code, 0);
    assert.match(again.stdout, /Nothing to apply/);
    const status = await cli(database, ["status"]);
    assert.match(status.stdout, new RegExp(`Applied \\(13\\): ${COMMITTED.join(", ")}`));
  });

  test("D. the hash and order checks refuse a changed or reordered A7 file", async () => {
    for (const tag of ["0008_forms_enquiries", "0009_seed_forms_enquiries"]) {
      const dir = mkdtempSync(join(tmpdir(), "rawasy-a7-migrations-"));
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
    const dir = mkdtempSync(join(tmpdir(), "rawasy-a7-migrations-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    cpSync(MIGRATIONS, dir, { recursive: true });
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
    journal.entries[9].when = journal.entries[8].when - 1;
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    assert.throws(() => readMigrations(dir), (e: unknown) => e instanceof MigrationError && e.kind === "journal" && /out of order/.test(e.message));
  });

  test("E. every A7 table is InnoDB utf8mb4_unicode_520_ci; ids and keys ascii_bin; the schema's rules hold", async () => {
    const c = await serverConnection(database);
    try {
      const all = await rows<{ t: string; e: string; co: string }>(
        c,
        "SELECT TABLE_NAME AS t, ENGINE AS e, TABLE_COLLATION AS co FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
      );
      const a7 = all.filter((r) => A7_TABLES.includes(r.t));
      assert.equal(a7.length, A7_TABLES.length);
      assert.equal(all.length, tables.length + A7_TABLES.length + 6); // A8 (0010–0012) added six tables after them.
      for (const table of a7) assert.deepEqual([table.e, table.co], ["InnoDB", "utf8mb4_unicode_520_ci"], table.t);
      const keys = await rows<{ t: string; c: string; co: string }>(
        c,
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLLATION_NAME AS co FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL
            AND (COLUMN_NAME IN ('id', 'key', 'locale', 'reference', 'field_key', 'group_key', 'storage_key', 'mime_type', 'extension', 'service_key', 'project_type', 'accepted_extensions')
              OR COLUMN_NAME LIKE '%\\_id' OR COLUMN_NAME LIKE '%\\_by' OR COLUMN_NAME = 'assigned_to')`,
      );
      const a7Keys = keys.filter((k) => A7_TABLES.includes(k.t));
      assert.ok(a7Keys.length >= 40, a7Keys.map((k) => `${k.t}.${k.c}`).join(","));
      for (const key of a7Keys) assert.equal(key.co, "ascii_bin", `${key.t}.${key.c}`);
      for (const [table, column] of [
        ["enquiries", "full_name"],
        ["enquiries", "message"],
        ["enquiry_notes", "body"],
        ["form_field_translations", "label"],
        ["email_outbox", "subject"],
      ]) {
        const [col] = await rows<{ co: string }>(c, "SELECT COLLATION_NAME AS co FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [table, column]);
        assert.equal(col.co, "utf8mb4_unicode_520_ci", `${table}.${column}`);
      }
      assert.deepEqual(await verifyCharsets(c), []);

      const insert = (table: string, row: Record<string, unknown>) => {
        const names = Object.keys(row);
        return c.query(`INSERT INTO \`${table}\` (${names.map((n) => `\`${n}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, Object.values(row));
      };
      // Forms: a lower-case key, unique; limits inside the registry's bounds; a retention period of 30 days or more.
      const form = (fields: Record<string, unknown>) => insert("forms", { id: id(200), key: "test_form", ...fields });
      for (const [fields, rule] of [
        [{ key: "Test" }, /ck_forms_key/],
        [{ key: "quote" }, /uq_forms_key/],
        [{ retention_days: 7 }, /ck_forms_retention/],
        [{ min_fill_seconds: 0 }, /ck_forms_min_fill/],
        [{ max_files: 6 }, /ck_forms_max_files/],
        [{ max_file_mb: 11 }, /ck_forms_max_file_mb/],
        [{ delivery_mode: "email" }, /delivery_mode|Data truncated/],
      ] as [Record<string, unknown>, RegExp][]) {
        await assert.rejects(form(fields), rule, JSON.stringify(fields));
      }
      // Fields: one key and one position per form, positions from 1; texts in a known language.
      const field = (fid: string, fields: Record<string, unknown>) => insert("form_fields", { id: fid, form_id: FORM_IDS.quote, field_key: "fullName", field_type: "text", group_key: "details", position: 1, is_required: 1, is_system: 1, ...fields });
      await field(id(210), {});
      await assert.rejects(field(id(211), { position: 2 }), /uq_form_fields_key/);
      await assert.rejects(field(id(211), { field_key: "email" }), /uq_form_fields_position/);
      await assert.rejects(field(id(211), { field_key: "email", position: 0 }), /ck_form_fields_position/);
      await assert.rejects(field(id(211), { field_key: "email", position: 2, field_type: "html" }), /field_type|Data truncated/);
      await insert("form_field_translations", { field_id: id(210), locale: "en", label: "Test name" });
      await assert.rejects(insert("form_field_translations", { field_id: id(210), locale: "fr", label: "x" }), /fk_form_field_translations_locale/);
      // Enquiries: the reference's form, unique; the statuses of the workflow; a known form, kept while enquiries refer to it.
      const enquiry = (eid: string, fields: Record<string, unknown>) =>
        insert("enquiries", { id: eid, reference: "Q-2026-00001", form_id: FORM_IDS.quote, locale: "en", submitted_at: T, source_path: "/en/contact", full_name: "Test", email: "test@example.test", message: "Test message", ...fields });
      await enquiry(id(220), {});
      for (const bad of ["Q-26-00001", "Q-2026-1", "q-2026-00001", "X-2026-00001", "Q-2026-0000a"]) await assert.rejects(enquiry(id(221), { reference: bad }), /ck_enquiries_reference/, bad);
      await assert.rejects(enquiry(id(221), {}), /uq_enquiries_reference/);
      for (const status of ["contacted", "spam", "qualified"]) await assert.rejects(enquiry(id(221), { reference: "Q-2026-00002", status }), /status|Data truncated/, status);
      await assert.rejects(enquiry(id(221), { reference: "Q-2026-00002", form_id: "01JA7MGTESTN0F0RM00000000Z" }), /fk_enquiries_form/);
      await assert.rejects(c.query("DELETE FROM forms WHERE id = ?", [FORM_IDS.quote]), /fk_enquiries_form/);
      await assert.rejects(insert("enquiry_reference_counters", { year: 1999, last_number: 1 }), /ck_enquiry_reference_counters_year/);
      // An enquiry's files, notes and history go with it (CASCADE); a storage key is unique.
      await insert("enquiry_files", { id: id(230), enquiry_id: id(220), storage_key: "2026/10/01JA7MGTEST000000000000230.pdf", original_filename: "t.pdf", mime_type: "application/pdf", extension: "pdf", byte_size: 10, sha256: Buffer.alloc(32, 1) });
      await assert.rejects(insert("enquiry_files", { id: id(231), enquiry_id: id(220), storage_key: "2026/10/01JA7MGTEST000000000000230.pdf", original_filename: "t.pdf", mime_type: "application/pdf", extension: "pdf", byte_size: 10, sha256: Buffer.alloc(32, 1) }), /uq_enquiry_files_storage/);
      await insert("enquiry_notes", { id: id(240), enquiry_id: id(220), author_id: USER, body: "Test note" });
      await insert("enquiry_status_history", { enquiry_id: id(220), to_status: "new", changed_at: T });
      await c.query("DELETE FROM enquiries WHERE id = ?", [id(220)]);
      for (const table of ["enquiry_files", "enquiry_notes", "enquiry_status_history"]) assert.equal(await count(c, table), 0, table);
      // A form's fields and texts go with it; the probe rows go again (F counts what the seed wrote).
      await c.query("DELETE FROM form_fields WHERE id = ?", [id(210)]);
      assert.equal(await count(c, "form_field_translations"), 0);
    } finally {
      await c.end();
    }
    assert.equal((await cli(database, ["status"])).code, 0);
  });

  test("F. no earlier row lost or changed, no table reshaped; the seed writes only the quote form's root (handoff, no retention)", async () => {
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
        // A8 (0012) gave menu_items one column; A8's own proof checks it.
        const expected = table === "menu_items" ? [...columnsBefore[table], "top_position"] : columnsBefore[table];
        assert.deepEqual(await columnsOf(c, table), expected, `${table} changed shape`);
      }
      assert.deepEqual(
        await rows(c, "SELECT id, `key`, delivery_mode, is_enabled, notification_emails, retention_days, honeypot_enabled, min_fill_seconds, consent_mode, accept_files, max_files, max_file_mb, accepted_extensions, publication_status, lock_version FROM forms"),
        [
          {
            id: FORM_IDS.quote,
            key: "quote",
            delivery_mode: "handoff",
            is_enabled: 1,
            notification_emails: null,
            retention_days: null,
            honeypot_enabled: 1,
            min_fill_seconds: 3,
            consent_mode: "notice",
            accept_files: 0,
            max_files: 5,
            max_file_mb: 10,
            accepted_extensions: ".pdf,.jpg,.jpeg,.png",
            publication_status: "unpublished",
            lock_version: 0,
          },
        ],
      );
      for (const table of A7_TABLES.filter((t) => t !== "forms")) assert.equal(await count(c, table), 0, `${table} starts empty`);
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
