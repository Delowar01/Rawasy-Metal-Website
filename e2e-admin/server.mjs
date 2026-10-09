/**
 * Starts the admin E2E server (run by playwright.admin.config.ts; needs a build: `npm run build`):
 *   1. a fresh local MariaDB database (rawasy_e2e_*), from TEST_DB_HOST / TEST_DB_PORT / TEST_DB_USER / TEST_DB_PASSWORD;
 *   2. the reviewed migrations, applied by scripts/db-migrate.mjs;
 *   3. a disposable encryption key generated for this run (never written to the repository);
 *   4. `node server.js` on port 3401 with APP_ENV=local and the mail sink in a temporary folder.
 * The run's facts (database name, mail folder, key) go to a 0600 file in the temporary folder for the tests. On SIGTERM
 * the server stops and the database is dropped.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
export const STATE_FILE = join(tmpdir(), "rawasy-admin-e2e.json");
const PORT = Number(process.env.ADMIN_E2E_PORT ?? 3401);

const { TEST_DB_HOST = "127.0.0.1", TEST_DB_PORT = "3306", TEST_DB_USER, TEST_DB_PASSWORD = "" } = process.env;
if (!TEST_DB_USER) {
  console.error("Admin E2E tests need a local MariaDB: set TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USER, TEST_DB_PASSWORD (README).");
  process.exit(1);
}

const database = `rawasy_e2e_${randomBytes(4).toString("hex")}`;
const mailDir = mkdtempSync(join(tmpdir(), "rawasy-admin-e2e-mail-"));
const authKey = randomBytes(32).toString("base64");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: "production",
  APP_ENV: "local",
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
};

const mysql = await import("mysql2/promise");
const admin = await mysql.createConnection({ host: TEST_DB_HOST, port: Number(TEST_DB_PORT), user: TEST_DB_USER, password: TEST_DB_PASSWORD });
await admin.query(`CREATE DATABASE \`${database}\``);
await admin.end();

const migrated = spawnSync(process.execPath, [join(ROOT, "scripts/db-migrate.mjs"), "up"], { env, cwd: ROOT, encoding: "utf8" });
if (migrated.status !== 0) {
  console.error(migrated.stdout, migrated.stderr);
  process.exit(1);
}
writeFileSync(STATE_FILE, JSON.stringify({ database, mailDir, authKey, port: PORT }), { mode: 0o600 });

const server = spawn(process.execPath, [join(ROOT, "server.js")], { env, cwd: ROOT, stdio: "inherit" });

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.kill("SIGTERM");
  try {
    const c = await mysql.createConnection({ host: TEST_DB_HOST, port: Number(TEST_DB_PORT), user: TEST_DB_USER, password: TEST_DB_PASSWORD });
    await c.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await c.end();
  } catch {
    // The database is a disposable local one; a failed drop leaves only test data behind.
  }
  rmSync(mailDir, { recursive: true, force: true });
  rmSync(STATE_FILE, { force: true });
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
server.on("exit", (code) => {
  if (!stopping) {
    console.error(`server.js exited (${code})`);
    void stop();
  }
});
