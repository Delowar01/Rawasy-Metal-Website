/**
 * The A3 migrations (0002_core_cms, 0003_seed_core_cms) on a real MariaDB — the brief's proofs A–F:
 * A. an empty database takes every migration; B. a database at A2 (0000–0001, with users, roles, sessions, second
 * factors and audit rows) takes the A3 files; C. a second run is a no-op; D. the hash and order checks still refuse a
 * changed or reordered file; E. every A3 table and column has the reviewed engine, character set and collation;
 * F. no A2 row is lost or changed. Run through scripts/db-migrate.mjs, as an operator would.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { after, describe, test } from "node:test";
import { MigrationError, readMigrations, runMigrations, verifyCharsets } from "../../src/server/db/migrate.ts";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../../src/server/policy/registry.ts";
import { ORDERINGS } from "../../src/server/cms/registry.ts";
import { createEmptyDatabase, MIGRATIONS, serverConfig, serverConnection } from "./helpers.ts";

const run = promisify(execFile);
const CLI = resolve(import.meta.dirname, "../../scripts/db-migrate.mjs");

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

/** A copy of the migrations as they stood at A2: the journal's first two entries and their files. */
function a2Folder() {
  const dir = mkdtempSync(join(tmpdir(), "rawasy-a2-migrations-"));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries.slice(2)) rmSync(join(dir, `${entry.tag}.sql`));
  journal.entries = journal.entries.slice(0, 2);
  writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const A3_TABLES = [
  "revisions",
  "entity_orderings",
  "entity_ordering_items",
  "search_documents",
  "pages",
  "page_translations",
  "services",
  "service_translations",
  "machines",
  "machine_translations",
  "machine_attributes",
  "machine_attribute_translations",
  "clients",
  "client_translations",
  "projects",
  "project_translations",
  "project_categories",
  "project_category_translations",
  "project_category_assignments",
  "project_services",
  "project_flags",
  "service_machines",
  "service_related_services",
  "service_featured_projects",
  "industries",
  "industry_translations",
  "industry_services",
  "industry_projects",
  "certificates",
  "certificate_translations",
  "certificate_facts",
  "certificate_fact_translations",
];

type Conn = Awaited<ReturnType<typeof serverConnection>>;
const rows = async <T = Record<string, unknown>>(c: Conn, statement: string, params: unknown[] = []) => (await c.query(statement, params))[0] as T[];

/** Every row of every A2 table, as JSON per table (for a before/after comparison). */
async function a2Snapshot(c: Conn, tables: string[]) {
  const out: Record<string, string> = {};
  for (const table of tables) {
    const [first] = await rows<{ c: string }>(c, "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION LIMIT 1", [table]);
    out[table] = JSON.stringify(await rows(c, `SELECT * FROM \`${table}\` ORDER BY \`${first.c}\``), (_k, v) => (Buffer.isBuffer(v) ? v.toString("hex") : v));
  }
  return out;
}

describe("A. an empty database", () => {
  // A4 added 0004_media_library and A5 0005_page_builder after the A3 files: every committed migration applies, the A3
  // files among them.
  test("takes every migration (the A3 files, A4's 0004 and A5's 0005), then reports nothing pending", async () => {
    const database = await freshDatabase("a3mig_a");
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    for (const tag of ["0000_access_control", "0001_seed_access_control", "0002_core_cms", "0003_seed_core_cms", "0004_media_library", "0005_page_builder"])
      assert.match(up.stdout, new RegExp(`Applied ${tag}`));
    const status = await cli(database, ["status"]);
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, /Applied \(6\): 0000_access_control, 0001_seed_access_control, 0002_core_cms, 0003_seed_core_cms, 0004_media_library, 0005_page_builder/);
    assert.match(status.stdout, /Pending \(0\): none/);
  });
});

describe("B–F. a database at A2 upgraded to A3", () => {
  let database = "";
  let a2Tables: string[] = [];
  let before: Record<string, string> = {};

  test("B. an A2 database with users, roles, a second factor, sessions and audit rows takes the A3 files", async () => {
    database = await freshDatabase("a3mig_b");
    const c = await serverConnection(database);
    try {
      const a2 = await runMigrations(c, readMigrations(a2Folder()), { appEnv: "local", operator: "cli:test" });
      assert.deepEqual(a2.applied, ["0000_access_control", "0001_seed_access_control"]);
      const now = new Date("2026-10-09T08:00:00.000Z");
      await c.query(
        "INSERT INTO users (id, email, email_normalized, display_name, status, password_hash, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
        ["01J9A2TESTUSER00000000000A", "owner@example.test", "owner@example.test", "Test Owner", "$argon2id$v=19$m=19456,t=2,p=1$dGVzdA$dGVzdGhhc2g", now, now, now],
      );
      await c.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, 'owner', ?)", ["01J9A2TESTUSER00000000000A", now]);
      await c.query(
        "INSERT INTO user_mfa (user_id, totp_secret_enc, key_version, confirmed_at, created_at) VALUES (?, ?, 1, ?, ?)",
        ["01J9A2TESTUSER00000000000A", Buffer.from("not-a-real-sealed-secret"), now, now],
      );
      await c.query(
        "INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, idle_expires_at, absolute_expires_at, reauthenticated_at, mfa_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["01J9A2TESTSESS10N000000000", "01J9A2TESTUSER00000000000A", Buffer.alloc(32, 7), now, now, now, now, now, now],
      );
      await c.query(
        "INSERT INTO audit_events (occurred_at, request_id, actor_type, actor_user_id, action, outcome, summary) VALUES (?, '01J9A2TESTREQUEST000000000', 'user', ?, 'auth.sign_in', 'success', 'Test sign-in')",
        [now, "01J9A2TESTUSER00000000000A"],
      );
      a2Tables = (await rows<{ t: string }>(c, "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME")).map((r) => r.t);
      assert.equal(a2Tables.length, 14, a2Tables.join(","));
      before = await a2Snapshot(c, a2Tables);
    } finally {
      await c.end();
    }
    const up = await cli(database, ["up"]);
    assert.equal(up.code, 0, up.stderr);
    assert.match(up.stdout, /Applied 0002_core_cms/);
    assert.match(up.stdout, /Applied 0003_seed_core_cms/);
    assert.doesNotMatch(up.stdout, /Applied 0000|Applied 0001/);
  });

  test("C. a second run is a no-op", async () => {
    const again = await cli(database, ["up"]);
    assert.equal(again.code, 0);
    assert.match(again.stdout, /Nothing to apply/);
  });

  test("D. the hash and order checks still refuse a changed or reordered A3 file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rawasy-a3-migrations-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    cpSync(MIGRATIONS, dir, { recursive: true });
    const seed = join(dir, "0003_seed_core_cms.sql");
    writeFileSync(seed, readFileSync(seed, "utf8").replace("never clears one", "never clears one!"));
    const c = await serverConnection(database);
    try {
      await assert.rejects(
        runMigrations(c, readMigrations(dir), { appEnv: "local" }),
        (e: unknown) => e instanceof MigrationError && e.kind === "history" && /0003_seed_core_cms\.sql changed after it was applied/.test(e.message),
      );
    } finally {
      await c.end();
    }
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
    journal.entries[3].when = journal.entries[2].when - 1;
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    assert.throws(() => readMigrations(dir), (e: unknown) => e instanceof MigrationError && e.kind === "journal" && /out of order/.test(e.message));
  });

  test("E. every A3 table is InnoDB utf8mb4_unicode_520_ci; ids and keys ascii_bin; the database check passes", async () => {
    const c = await serverConnection(database);
    try {
      const tables = await rows<{ t: string; e: string; co: string }>(
        c,
        "SELECT TABLE_NAME AS t, ENGINE AS e, TABLE_COLLATION AS co FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
      );
      const a3 = tables.filter((r) => A3_TABLES.includes(r.t));
      assert.equal(a3.length, A3_TABLES.length);
      for (const table of a3) assert.deepEqual([table.e, table.co], ["InnoDB", "utf8mb4_unicode_520_ci"], table.t);
      const keys = await rows<{ t: string; c: string; co: string }>(
        c,
        `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLLATION_NAME AS co FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND (COLUMN_NAME IN ('id', 'slug', 'locale', 'flag', 'ordering_key', 'system_key', 'icon_key') OR COLUMN_NAME LIKE '%\\_id')
            AND COLLATION_NAME IS NOT NULL`,
      );
      for (const key of keys.filter((k) => A3_TABLES.includes(k.t))) assert.equal(key.co, "ascii_bin", `${key.t}.${key.c}`);
      const texts = await rows<{ t: string; c: string; co: string }>(
        c,
        "SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLLATION_NAME AS co FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('title', 'name', 'label', 'summary', 'capability')",
      );
      for (const text of texts.filter((k) => A3_TABLES.includes(k.t))) assert.equal(text.co, "utf8mb4_unicode_520_ci", `${text.t}.${text.c}`);
      assert.deepEqual(await verifyCharsets(c), []);
    } finally {
      await c.end();
    }
    assert.equal((await cli(database, ["status"])).code, 0);
  });

  test("F. no A2 row is lost or changed; the A3 seed adds only its own rows", async () => {
    const c = await serverConnection(database);
    try {
      const after = await a2Snapshot(c, a2Tables);
      for (const table of a2Tables) {
        if (table === "permissions" || table === "role_permissions" || table === "audit_events" || table === "__drizzle_migrations") continue;
        assert.equal(after[table], before[table], `${table} changed`);
      }
      // Audit rows and the migration history only grew (append-only).
      for (const table of ["audit_events", "__drizzle_migrations"]) {
        const was = JSON.parse(before[table]) as unknown[];
        const now = JSON.parse(after[table]) as unknown[];
        assert.deepEqual(now.slice(0, was.length), was, table);
        assert.ok(now.length > was.length, table);
      }
      // Permissions: the A2 rows unchanged, plus exactly projects.add_flags and its four grants.
      const permissionKeys = (await rows<{ k: string }>(c, "SELECT `key` AS k FROM permissions ORDER BY `key`")).map((r) => r.k);
      assert.equal(permissionKeys.length, PERMISSIONS.length);
      const wasPermissions = (JSON.parse(before.permissions) as { key: string }[]).map((p) => p.key);
      assert.deepEqual(
        permissionKeys.filter((k) => !wasPermissions.includes(k)),
        ["projects.add_flags"],
      );
      const grants = await rows<{ r: string; p: string }>(c, "SELECT role_key AS r, permission_key AS p FROM role_permissions WHERE permission_key = 'projects.add_flags' ORDER BY role_key");
      assert.deepEqual(
        grants.map((g) => g.r),
        ["admin", "editor", "owner", "reviewer"],
      );
      const totalGrants = Object.values(ROLE_PERMISSIONS).reduce((n, keys) => n + keys.length, 0);
      assert.equal((await rows<{ n: number }>(c, "SELECT COUNT(*) AS n FROM role_permissions"))[0].n, totalGrants);
      const orderings = await rows<{ key: string; entity_type: string; lock_version: number }>(c, "SELECT `key`, entity_type, lock_version FROM entity_orderings ORDER BY `key`");
      assert.deepEqual(
        orderings,
        Object.entries(ORDERINGS)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, type]) => ({ key, entity_type: type, lock_version: 0 })),
      );
      for (const table of A3_TABLES.filter((t) => t !== "entity_orderings")) {
        assert.equal((await rows<{ n: number }>(c, `SELECT COUNT(*) AS n FROM \`${table}\``))[0].n, 0, `${table} starts empty (no content imported)`);
      }
    } finally {
      await c.end();
    }
  });
});
