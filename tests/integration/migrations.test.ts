/**
 * The migration CLI on a real MariaDB: empty database, second run, the lock, changed or out-of-order files, unlisted
 * files, missing table options, character-set checks, the backup rule — run through scripts/db-migrate.mjs itself so
 * the exit codes are tested too — and the build-time database guard.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { after, before, describe, test } from "node:test";
import { checkBackup, lockName, MigrationError, readMigrations, runMigrations } from "../../src/server/db/migrate.ts";
import { assertNotBuildPhase, BuildPhaseDatabaseError, createAppPool } from "../../src/server/db/pool.ts";
import { createEmptyDatabase, MIGRATIONS, serverConfig, serverConnection } from "./helpers.ts";

const run = promisify(execFile);
const CLI = resolve(import.meta.dirname, "../../scripts/db-migrate.mjs");

async function cli(database: string, args: string[], extraEnv: Record<string, string> = {}) {
  const { host, port, user, password } = serverConfig();
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args], {
      env: { PATH: process.env.PATH, NODE_ENV: "test", APP_ENV: "local", DB_HOST: host, DB_PORT: String(port), DB_USER: user, DB_PASSWORD: password, DB_NAME: database, ...extraEnv },
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

/** A copy of the migrations folder that a test may change. */
function folderCopy() {
  const dir = mkdtempSync(join(tmpdir(), "rawasy-migrations-"));
  cpSync(MIGRATIONS, dir, { recursive: true });
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

describe("applying", () => {
  let database: string;
  before(async () => {
    database = await freshDatabase("mig");
  });

  test("an empty database: collation set, both files applied, audit row, then status clean", async () => {
    const first = await cli(database, ["up"]);
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /Database default set to utf8mb4 \/ utf8mb4_unicode_520_ci\./);
    assert.match(first.stdout, /Applied 0000_access_control/);
    assert.match(first.stdout, /Applied 0001_seed_access_control/);
    assert.match(first.stdout, /backup hook dormant \(APP_ENV=local\)/);
    const status = await cli(database, ["status"]);
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, /Applied \(2\): 0000_access_control, 0001_seed_access_control/);
    assert.match(status.stdout, /Pending \(0\): none/);
    const c = await serverConnection(database);
    const [audit] = (await c.query("SELECT action, actor_type, outcome FROM audit_events")) as unknown as [{ action: string; actor_type: string; outcome: string }[]];
    assert.deepEqual(audit, [{ action: "db.migrate", actor_type: "cli", outcome: "success" }]);
    await c.end();
  });

  test("a second run changes nothing", async () => {
    const second = await cli(database, ["up"]);
    assert.equal(second.code, 0);
    assert.match(second.stdout, /Nothing to apply/);
  });

  test("another runner holding the lock: exit 2, nothing changed", async () => {
    const holder = await serverConnection(database);
    await holder.query("SELECT GET_LOCK(?, 0)", [lockName(database)]);
    try {
      const blocked = await cli(database, ["up"]);
      assert.equal(blocked.code, 2);
      assert.match(blocked.stderr, /\[lock\]/);
    } finally {
      await holder.end();
    }
  });

  test("an applied file that changed afterwards: exit 3", async () => {
    const dir = folderCopy();
    const file = join(dir, "0001_seed_access_control.sql");
    writeFileSync(file, readFileSync(file, "utf8").replace("'Preview unpublished work.'", "'Preview unpublished work!'"));
    const c = await serverConnection(database);
    await assert.rejects(
      runMigrations(c, readMigrations(dir), { appEnv: "local" }),
      (e: unknown) => e instanceof MigrationError && e.kind === "history" && /changed after it was applied/.test(e.message),
    );
    await c.end();
  });

  test("character sets are verified: a table with another collation fails the run (exit 5)", async () => {
    const c = await serverConnection(database);
    await c.query("CREATE TABLE stray_latin (id INT PRIMARY KEY, name VARCHAR(20)) ENGINE=InnoDB DEFAULT CHARSET=latin1");
    await c.end();
    const result = await cli(database, ["up"]);
    assert.equal(result.code, 5);
    assert.match(result.stderr, /stray_latin has collation latin1/);
    const status = await cli(database, ["status"]);
    assert.equal(status.code, 5);
    const d = await serverConnection(database);
    await d.query("DROP TABLE stray_latin");
    await d.end();
    assert.equal((await cli(database, ["status"])).code, 0);
  });
});

describe("journal checks (before any database work)", () => {
  test("out of order: an entry not later than the one before it", () => {
    const dir = folderCopy();
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
    journal.entries[1].when = journal.entries[0].when - 1;
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    assert.throws(() => readMigrations(dir), (e: unknown) => e instanceof MigrationError && e.kind === "journal" && /out of order/.test(e.message));
  });

  test("a .sql file missing from the journal (would be skipped silently by the stock migrator)", () => {
    const dir = folderCopy();
    writeFileSync(join(dir, "0002_forgotten.sql"), "CREATE TABLE x (id INT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;");
    assert.throws(() => readMigrations(dir), /not in the journal/);
  });

  test("a CREATE TABLE without the reviewed table options", () => {
    const dir = folderCopy();
    const file = join(dir, "0000_access_control.sql");
    writeFileSync(file, readFileSync(file, "utf8").replace(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;", ");"));
    assert.throws(() => readMigrations(dir), /CREATE TABLE without/);
  });

  test("the committed migrations pass (check)", async () => {
    const result = await cli("unused_db", ["check"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Migration files OK: 2/);
  });
});

describe("history and backups", () => {
  test("a database newer than the code, or a history out of journal order, is refused", async () => {
    const database = await freshDatabase("hist");
    assert.equal((await cli(database, ["up"])).code, 0);
    const c = await serverConnection(database);
    await c.query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('f00', 99999999999999)");
    await assert.rejects(runMigrations(c, readMigrations(MIGRATIONS), { appEnv: "local" }), /database is newer/);
    await c.query("DELETE FROM __drizzle_migrations WHERE hash = 'f00'");
    await c.query("UPDATE __drizzle_migrations SET created_at = created_at + 1 WHERE id = 2");
    await assert.rejects(runMigrations(c, readMigrations(MIGRATIONS), { appEnv: "local" }), /out of order/);
    await c.end();
    assert.equal((await cli(database, ["status"])).code, 3);
  });

  test("outside local development a fresh backup is required once tables exist", () => {
    assert.match(checkBackup({ appEnv: "local" }, 14), /dormant/);
    assert.match(checkBackup({ appEnv: "production" }, 0), /no table yet/);
    assert.throws(() => checkBackup({ appEnv: "staging" }, 14), (e: unknown) => e instanceof MigrationError && e.kind === "backup");
    const dir = mkdtempSync(join(tmpdir(), "rawasy-backup-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    const file = join(dir, "dump.sql");
    writeFileSync(file, "-- dump");
    assert.match(checkBackup({ appEnv: "production", backupFile: file }, 14), /fresh/);
    assert.throws(() => checkBackup({ appEnv: "production", backupFile: file, now: Date.now() + 61 * 60_000 }, 14), /older than 60 minutes/);
    assert.throws(() => checkBackup({ appEnv: "production", backupFile: join(dir, "missing.sql") }, 14), /does not exist/);
  });

  test("the CLI refuses a production migration without a backup (exit 4) and never prints credentials", async () => {
    const database = await freshDatabase("prod");
    assert.equal((await cli(database, ["up"])).code, 0);
    const dir = folderCopy();
    writeFileSync(join(dir, "0002_extra.sql"), "CREATE TABLE extra_t (id INT PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;");
    const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8"));
    journal.entries.push({ idx: 2, version: "5", when: journal.entries[1].when + 1, tag: "0002_extra", breakpoints: true });
    writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify(journal));
    const c = await serverConnection(database);
    await assert.rejects(runMigrations(c, readMigrations(dir), { appEnv: "production" }), (e: unknown) => e instanceof MigrationError && e.kind === "backup");
    await c.end();
    const wrong = await cli(database, ["status"], { DB_PASSWORD: "definitely-wrong-password" });
    assert.notEqual(wrong.code, 0);
    assert.doesNotMatch(wrong.stdout + wrong.stderr, /definitely-wrong-password|Access denied for user/);
    assert.match(wrong.stderr, /ER_ACCESS_DENIED_ERROR/);
  });
});

describe("no database during `next build`", () => {
  test("the pool refuses to exist in the production build phase", () => {
    assert.throws(() => assertNotBuildPhase({ NEXT_PHASE: "phase-production-build" }), BuildPhaseDatabaseError);
    assert.doesNotThrow(() => assertNotBuildPhase({ NEXT_PHASE: "phase-production-server" }));
    const previous = process.env.NEXT_PHASE;
    process.env.NEXT_PHASE = "phase-production-build";
    try {
      assert.throws(() => createAppPool({ ...serverConfig(), database: "x", poolLimit: 1 }), BuildPhaseDatabaseError);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PHASE;
      else process.env.NEXT_PHASE = previous;
    }
  });
});
