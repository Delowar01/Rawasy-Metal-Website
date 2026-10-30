/**
 * The A6 migrations (0006_site_controls, 0007_seed_site_controls) on a real MariaDB, as A5's proofs A–G:
 * A. an empty database takes every migration; B. a database at A5 (0000–0005) holding A2 accounts, A3 content, A4 media
 * and A5 sections takes exactly the two A6 files; C. a second run is a no-op; D. the hash and order checks refuse a
 * changed or reordered A6 file; E. every A6 table is InnoDB utf8mb4_unicode_520_ci with ids and keys ascii_bin, and the
 * schema's own rules hold (the singletons, positions, E.164 numbers, menu targets, a redirect's source, status and one
 * target, the unique source, token keys, the maximum lengths, the cascades); F. no earlier row is lost or changed, no
 * existing table changes shape, and the seed writes exactly the singletons, the four menu slots and the 34 interface-text
 * keys — no company fact, label, text, override or redirect (the admin's set-up copies today's website); G.
 * `npm run db:check` passes. Run through scripts/db-migrate.mjs, as an operator would.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { after, describe, test } from "node:test";
import { MigrationError, readMigrations, runMigrations, verifyCharsets } from "../../src/server/db/migrate.ts";
import { MENU_SLOTS, UI_STRINGS } from "../../src/server/site/registry.ts";
import { createEmptyDatabase, MIGRATIONS, serverConfig, serverConnection } from "./helpers.ts";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "../..");
const CLI = join(ROOT, "scripts/db-migrate.mjs");
const A5_TAGS = ["0000_access_control", "0001_seed_access_control", "0002_core_cms", "0003_seed_core_cms", "0004_media_library", "0005_page_builder"];
const ALL_TAGS = [...A5_TAGS, "0006_site_controls", "0007_seed_site_controls"];
const A6_TABLES = [
  "company_phones",
  "design_token_overrides",
  "menu_item_translations",
  "menu_items",
  "menus",
  "redirects",
  "site_setting_translations",
  "site_settings",
  "theme_settings",
  "ui_string_translations",
  "ui_strings",
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

/** A copy of the migrations as they stood at A5: the journal's first six entries and files. */
function a5Folder() {
  const dir = mkdtempSync(join(tmpdir(), "rawasy-a5-migrations-"));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries.slice(6)) rmSync(join(dir, `${entry.tag}.sql`));
  journal.entries = journal.entries.slice(0, 6);
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
const USER = "01JA6MIGTESTUSER0000000000";
const id = (n: number) => `01JA6MIGTEST${String(n).padStart(14, "0")}`;

/** A2 accounts, A3 content, A4 media and A5 sections as an A5 installation holds them (raw SQL: the A5 schema). */
async function seedA5(c: Conn) {
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
}

describe("A. an empty database", () => {
  test("takes all eight migrations, then reports nothing pending", async () => {
    const database = await freshDatabase("a6mig_a");
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    for (const tag of ALL_TAGS) assert.match(up.stdout, new RegExp(`Applied ${tag}`));
    const status = await cli(database, ["status"]);
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, new RegExp(`Applied \\(8\\): ${ALL_TAGS.join(", ")}`));
    assert.match(status.stdout, /Pending \(0\): none/);
  });
});

describe("B–G. a database at A5 with accounts, content, media and sections, upgraded to A6", () => {
  let database = "";
  let tables: string[] = [];
  const columnsBefore: Record<string, string[]> = {};
  let before: Record<string, string> = {};

  test("B. an A5 database takes exactly the two A6 files", async () => {
    database = await freshDatabase("a6mig_b");
    const c = await serverConnection(database);
    try {
      const a5 = await runMigrations(c, readMigrations(a5Folder()), { appEnv: "local", operator: "cli:test" });
      assert.deepEqual(a5.applied, A5_TAGS);
      await seedA5(c);
      tables = (await rows<{ t: string }>(c, "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME")).map((r) => r.t);
      assert.equal(tables.length, 61, tables.join(","));
      for (const table of A6_TABLES) assert.ok(!tables.includes(table), `${table} exists before A6`);
      for (const table of tables) columnsBefore[table] = await columnsOf(c, table);
      before = await snapshot(c, columnsBefore);
    } finally {
      await c.end();
    }
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    assert.match(up.stdout, /Applied 0006_site_controls/);
    assert.match(up.stdout, /Applied 0007_seed_site_controls/);
    assert.doesNotMatch(up.stdout, /Applied 000[0-5]/);
  });

  test("C. a second run is a no-op", async () => {
    const again = await cli(database, ["up"]);
    assert.equal(again.code, 0);
    assert.match(again.stdout, /Nothing to apply/);
    const status = await cli(database, ["status"]);
    assert.match(status.stdout, new RegExp(`Applied \\(8\\): ${ALL_TAGS.join(", ")}`));
  });

  test("D. the hash and order checks refuse a changed or reordered A6 file", async () => {
    for (const tag of ["0006_site_controls", "0007_seed_site_controls"]) {
      const dir = mkdtempSync(join(tmpdir(), "rawasy-a6-migrations-"));
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
    const dir = mkdtempSync(join(tmpdir(), "rawasy-a6-migrations-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    cpSync(MIGRATIONS, dir, { recursive: true });
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
    journal.entries[7].when = journal.entries[6].when - 1;
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    assert.throws(() => readMigrations(dir), (e: unknown) => e instanceof MigrationError && e.kind === "journal" && /out of order/.test(e.message));
  });

  test("E. every A6 table is InnoDB utf8mb4_unicode_520_ci; ids and keys ascii_bin; the schema's rules hold", async () => {
    const c = await serverConnection(database);
    try {
      const all = await rows<{ t: string; e: string; co: string }>(
        c,
        "SELECT TABLE_NAME AS t, ENGINE AS e, TABLE_COLLATION AS co FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
      );
      const a6 = all.filter((r) => A6_TABLES.includes(r.t));
      assert.equal(a6.length, A6_TABLES.length);
      assert.equal(all.length, tables.length + A6_TABLES.length);
      for (const table of a6) assert.deepEqual([table.e, table.co], ["InnoDB", "utf8mb4_unicode_520_ci"], table.t);
      const keys = await rows<{ t: string; c: string; co: string }>(
        c,
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLLATION_NAME AS co FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL
            AND (COLUMN_NAME IN ('id', 'key', 'locale', 'e164', 'menu_key', 'route_key', 'collection', 'string_key', 'group_key', 'token_key', 'source_path', 'target_path')
              OR COLUMN_NAME LIKE '%\\_id' OR COLUMN_NAME LIKE '%\\_by')`,
      );
      const a6Keys = keys.filter((k) => A6_TABLES.includes(k.t));
      assert.ok(a6Keys.length >= 40, a6Keys.map((k) => `${k.t}.${k.c}`).join(","));
      for (const key of a6Keys) assert.equal(key.co, "ascii_bin", `${key.t}.${key.c}`);
      for (const [table, column] of [
        ["site_setting_translations", "legal_name"],
        ["menu_item_translations", "label"],
        ["ui_string_translations", "value"],
        ["redirects", "note"],
        ["company_phones", "display"],
      ]) {
        const [col] = await rows<{ co: string }>(c, "SELECT COLLATION_NAME AS co FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [table, column]);
        assert.equal(col.co, "utf8mb4_unicode_520_ci", `${table}.${column}`);
      }
      assert.deepEqual(await verifyCharsets(c), []);

      // The singletons: one settings row, one theme row, never another.
      await assert.rejects(c.query("INSERT INTO site_settings (id, website_url, email, country_code, maps_query) VALUES ('othr', '', '', 'SA', '')"), /ck_site_settings_id/);
      await assert.rejects(c.query("INSERT INTO theme_settings (id) VALUES ('other')"), /ck_theme_settings_id/);
      // Phones: an E.164 number, a position from 1, unique per settings.
      const phone = (pid: string, fields: Record<string, unknown>) => {
        const row = { id: pid, settings_id: "site", position: 1, display: "+966 50 000 0000", e164: "+966500000000", has_whatsapp: 1, ...fields };
        const names = Object.keys(row);
        return c.query(`INSERT INTO company_phones (${names.map((n) => `\`${n}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, Object.values(row));
      };
      await phone(id(100), {});
      for (const bad of ["966500000000", "+0966500000", "+96650", "+966 50 000", "+9665000000000000"]) await assert.rejects(phone(id(101), { position: 2, e164: bad }), /ck_company_phones_e164|Data too long/, bad);
      await assert.rejects(phone(id(101), { position: 0 }), /ck_company_phones_position/);
      await assert.rejects(phone(id(101), {}), /uq_company_phones_position/);
      // Menu items: exactly one target, a position from 1, shown on some device. One position per item within a menu is
      // kept by the menu service (the slot's root lock and the renumbering): A1's unique (menu, parent, position) index
      // covers nested items only, since top-level items have no parent and a unique index admits repeated NULLs.
      const item = (iid: string, fields: Record<string, unknown>) => {
        const row = { id: iid, menu_key: "footer_legal", position: 1, link_type: "route", route_key: "privacy", ...fields };
        const names = Object.keys(row);
        return c.query(`INSERT INTO menu_items (${names.map((n) => `\`${n}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, Object.values(row));
      };
      await item(id(110), {});
      await assert.rejects(item(id(111), { position: 2, route_key: null }), /ck_menu_items_target/);
      await assert.rejects(item(id(111), { position: 2, link_type: "collection", route_key: "privacy", collection: "services" }), /ck_menu_items_target/);
      await assert.rejects(item(id(111), { position: 2, link_type: "external", route_key: null }), /ck_menu_items_target/);
      await assert.rejects(item(id(111), { position: 2, show_desktop: 0, show_mobile: 0 }), /ck_menu_items_devices/);
      await assert.rejects(item(id(111), { position: 0 }), /ck_menu_items_position/);
      await assert.rejects(item(id(111), { menu_key: "no_such_menu", position: 2 }), /fk_menu_items_menu/);
      await assert.rejects(item(id(111), { page_id: "01JA6MIGTESTNOPAGE00000000", link_type: "page", route_key: null, position: 2 }), /fk_menu_items_page/);
      await c.query("INSERT INTO menu_item_translations (item_id, locale, label) VALUES (?, 'en', 'Test privacy'), (?, 'ar', 'تجربة')", [id(110), id(110)]);
      await assert.rejects(c.query("INSERT INTO menu_item_translations (item_id, locale, label) VALUES (?, 'fr', 'x')", [id(110)]), /fk_menu_item_translations_locale/);
      // Redirects: a normalised source with its language, 307 or 308, exactly one target, one redirect per source.
      const redirect = (rid: string, fields: Record<string, unknown>) => {
        const row = { id: rid, source_path: "/en/old-page", target_type: "path", target_path: "/en/about", status_code: 308, reason: "manual", ...fields };
        const names = Object.keys(row);
        return c.query(`INSERT INTO redirects (${names.map((n) => `\`${n}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, Object.values(row));
      };
      await redirect(id(120), {});
      await redirect(id(121), { source_path: "/ar/%D8%B5%D9%81%D8%AD%D8%A9", target_type: "page", target_path: null, target_page_id: id(10), status_code: 307 });
      for (const bad of ["/old-page", "/fr/old", "/en", "/en/", "/en//x", "/en/a b", "/en/x?y=1", "/en/%d8%b5", "https://example.test/en/x", "/en/صفحة"]) {
        await assert.rejects(redirect(id(122), { source_path: bad }), /ck_redirects_source|Incorrect string value/, bad);
      }
      for (const status of [301, 302, 200]) await assert.rejects(redirect(id(122), { source_path: "/en/x", status_code: status }), /ck_redirects_status/);
      await assert.rejects(redirect(id(122), { source_path: "/en/x", target_path: null }), /ck_redirects_target/);
      await assert.rejects(redirect(id(122), { source_path: "/en/x", target_type: "page", target_page_id: id(10) }), /ck_redirects_target/);
      await assert.rejects(redirect(id(122), {}), /uq_redirects_source/);
      await assert.rejects(redirect(id(122), { source_path: "/en/x", target_type: "service", target_path: null, target_service_id: "01JA6MIGTESTNOSERVICE00000" }), /fk_redirects_service/);
      // A record a redirect leads to can't be removed while it does (RESTRICT).
      await assert.rejects(c.query("DELETE FROM pages WHERE id = ?", [id(10)]), /fk_redirects_page/);
      // Interface text: a known key, a maximum between 1 and 500; token keys are lower-case dotted names.
      await assert.rejects(c.query("INSERT INTO ui_string_translations (string_key, locale, value) VALUES ('no.such.key', 'en', 'x')"), /fk_ui_string_translations/);
      await assert.rejects(c.query("INSERT INTO ui_strings (`key`, settings_id, group_key, max_length) VALUES ('test.zero', 'site', 'test', 0)"), /ck_ui_strings_max_length/);
      await assert.rejects(c.query("INSERT INTO ui_strings (`key`, settings_id, group_key, max_length) VALUES ('test.big', 'site', 'test', 501)"), /ck_ui_strings_max_length/);
      for (const bad of ["Brand", "brand", "brand.", ".brand", "color.Brand", "color brand", "color.brand;x"]) {
        await assert.rejects(c.query("INSERT INTO design_token_overrides (theme_id, token_key, scheme, value) VALUES ('theme', ?, 'all', '#000000')", [bad]), /ck_design_token_overrides_key/, bad);
      }
      // Cascades: a menu item's texts go with it. The probe rows go again (F counts what the seed wrote).
      await c.query("DELETE FROM menu_items WHERE id = ?", [id(110)]);
      assert.equal(await count(c, "menu_item_translations"), 0);
      await c.query("DELETE FROM redirects");
      await c.query("DELETE FROM company_phones");
    } finally {
      await c.end();
    }
    assert.equal((await cli(database, ["status"])).code, 0);
  });

  test("F. no earlier row lost or changed, no table reshaped; the seed writes only the singletons, the slots and the keys", async () => {
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
        assert.ok(now.length > was.length, table);
      }
      for (const table of tables) assert.deepEqual(await columnsOf(c, table), columnsBefore[table], `${table} changed shape`);
      // The seed: the two singletons (no company fact: the website, email and map search are empty, the country SA), the
      // design's four menu slots and the registry's interface-text keys — nothing else.
      assert.deepEqual(await rows(c, "SELECT id, website_url, email, postal_code, country_code, maps_query, maps_place_url, facebook_url, lock_version FROM site_settings"), [
        { id: "site", website_url: "", email: "", postal_code: null, country_code: "SA", maps_query: "", maps_place_url: null, facebook_url: null, lock_version: 0 },
      ]);
      assert.deepEqual(await rows(c, "SELECT id, lock_version FROM theme_settings"), [{ id: "theme", lock_version: 0 }]);
      assert.deepEqual(
        (await rows<{ key: string; name: string }>(c, "SELECT `key`, name FROM menus ORDER BY `key`")).map((r) => [r.key, r.name]),
        MENU_SLOTS.map((s) => [s.key, s.name]).sort(),
      );
      assert.deepEqual(
        await rows(c, "SELECT `key`, group_key, max_length FROM ui_strings ORDER BY `key`"),
        UI_STRINGS.map((s) => ({ key: s.key, group_key: s.group, max_length: s.maxLength })).sort((a, b) => (a.key < b.key ? -1 : 1)),
      );
      for (const table of ["site_setting_translations", "company_phones", "ui_string_translations", "menu_items", "menu_item_translations", "design_token_overrides", "redirects"]) {
        assert.equal(await count(c, table), 0, `${table} starts empty`);
      }
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
