/**
 * Starts the database-mode E2E server (run by playwright.dbmode.config.ts). It needs a DATABASE-CONTENT build in the
 * folder it serves (default: this checkout; DBMODE_DIR names another):
 *   CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build && npm run test:dbmode
 *
 *   1. refuses unless that folder's build is a database-content one (its build record names the fail-closed page cache);
 *   2. a fresh local MariaDB database (rawasy_e2e_*), from TEST_DB_HOST / TEST_DB_PORT / TEST_DB_USER / TEST_DB_PASSWORD;
 *   3. the migrations, the release media and an import Owner, then the real content import (scripts/content-import.mjs,
 *      with a placeholder legal reviewer: the legal pages are published so that every page answers — not a legal review);
 *   4. `node server.js` on port 3402 with the admin on (ADMIN_ENABLED=1, APP_ENV=local), a disposable encryption key, the
 *      mail sink and a temporary media data folder: the admin and the public website from one release, as after a cutover.
 * The run's facts go to the admin suite's state file (the same shape), so e2e-admin/helpers.ts serves both suites; never
 * run the two suites at once. On SIGTERM the server stops, the database is dropped and the temporary folders are removed.
 * Local disposable databases only: never staging or production.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIR = resolve(process.env.DBMODE_DIR ?? ROOT);
const STATE_FILE = join(tmpdir(), "rawasy-admin-e2e.json");
const PORT = Number(process.env.DBMODE_E2E_PORT ?? 3402);

const { TEST_DB_HOST = "127.0.0.1", TEST_DB_PORT = "3306", TEST_DB_USER, TEST_DB_PASSWORD = "" } = process.env;
if (!TEST_DB_USER) {
  console.error("Database-mode E2E tests need a local MariaDB: set TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USER, TEST_DB_PASSWORD (README).");
  process.exit(1);
}
let record;
try {
  record = JSON.parse(readFileSync(join(DIR, ".next/required-server-files.json"), "utf8"));
} catch {
  console.error(`No build in ${DIR}: run CONTENT_SOURCE=database NEXT_PUBLIC_SITE_URL=… npm run build first.`);
  process.exit(1);
}
if (!/cache-handler\.cjs$/.test(String(record.config?.cacheHandler ?? ""))) {
  console.error(`The build in ${DIR} is a static-content build; these tests need CONTENT_SOURCE=database at build.`);
  process.exit(1);
}

const database = `rawasy_e2e_${randomBytes(4).toString("hex")}`;
const mailDir = mkdtempSync(join(tmpdir(), "rawasy-dbmode-e2e-mail-"));
const dataDir = mkdtempSync(join(tmpdir(), "rawasy-dbmode-e2e-data-"));
const authKey = randomBytes(32).toString("base64");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: "production",
  APP_ENV: "local",
  ADMIN_ENABLED: "1",
  PORT: String(PORT),
  DB_HOST: TEST_DB_HOST,
  DB_PORT: TEST_DB_PORT,
  DB_USER: TEST_DB_USER,
  DB_PASSWORD: TEST_DB_PASSWORD,
  DB_NAME: database,
  DB_POOL_LIMIT: "2",
  AUTH_ENCRYPTION_KEY: authKey,
  AUTH_ENCRYPTION_KEY_VERSION: "1",
  TRUSTED_PROXY_HOPS: "0",
  ADMIN_BASE_URL: `http://localhost:${PORT}`,
  MAIL_TRANSPORT: "sink",
  MAIL_SINK_DIR: mailDir,
  RAWASY_DATA_DIR: dataDir,
};

const mysql = await import("mysql2/promise");
const admin = await mysql.createConnection({ host: TEST_DB_HOST, port: Number(TEST_DB_PORT), user: TEST_DB_USER, password: TEST_DB_PASSWORD });
await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci`);
await admin.end();

let server = null;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  server?.kill("SIGTERM");
  try {
    const c = await mysql.createConnection({ host: TEST_DB_HOST, port: Number(TEST_DB_PORT), user: TEST_DB_USER, password: TEST_DB_PASSWORD });
    await c.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await c.end();
  } catch {
    // The database is a disposable local one; a failed drop leaves only test data behind.
  }
  rmSync(mailDir, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(STATE_FILE, { force: true });
  process.exit(code);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());

/** Runs one of the release's CLIs as the staging procedure does; stops the run when it fails. */
async function step(label, args, extra = {}) {
  const done = spawnSync(process.execPath, args, { env: { ...env, ...extra }, cwd: DIR, encoding: "utf8" });
  if (done.status !== 0) {
    console.error(`${label} failed (${done.status}):\n${done.stdout}\n${done.stderr}`);
    await stop(1);
  }
  return done.stdout;
}

await step("migrations", [join(DIR, "scripts/db-migrate.mjs"), "up"]);
await step("release media", [join(DIR, "scripts/media-import-release.mjs")]);
const importOwner = "import.owner@example.test";
await step("import owner", [join(DIR, "e2e-admin/seed-user.mjs"), "--email", importOwner, "--name", "Test Import Owner", "--roles", "owner"], { SEED_PASSWORD: randomBytes(18).toString("base64url") });
await step("content import", [join(DIR, "scripts/content-import.mjs"), `--owner=${importOwner}`, "--legal-reviewer=Database-mode E2E test (not a legal review)"]);

writeFileSync(STATE_FILE, JSON.stringify({ database, mailDir, dataDir, authKey, port: PORT }), { mode: 0o600 });
server = spawn(process.execPath, [join(DIR, "server.js")], { env, cwd: DIR, stdio: "inherit" });
server.on("exit", (code) => {
  if (!stopping) {
    console.error(`server.js exited (${code})`);
    void stop(1);
  }
});
