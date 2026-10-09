/**
 * Database migrations for the admin (A1-DATABASE-SCHEMA §10). Run by hand from the release folder, before the new
 * release serves requests — never at app start. Reads the DB_* variables (for local development:
 * `node --env-file=.env.local scripts/db-migrate.mjs …`).
 *
 *   node scripts/db-migrate.mjs check                 the migration files only (journal order, table options); no database
 *   node scripts/db-migrate.mjs status                the database: defaults, applied and pending files, problems
 *   node scripts/db-migrate.mjs up [options]          apply the pending files
 *       --backup-file=<path>     required outside APP_ENV=local once the database has tables: a backup < 60 minutes old
 *       --set-database-default   allow setting the database's default collation when it already has tables
 *
 * Exit codes: 0 done · 1 usage or configuration · 2 another runner holds the lock · 3 journal or applied history
 * mismatch · 4 backup missing · 5 character-set mismatch · 6 a statement failed. Errors name codes, never credentials.
 */
import { userInfo } from "node:os";
import { resolve } from "node:path";

// Node warns that the shared modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { createConnection } = await import("mysql2/promise");
const { appEnv, readDbConfig, ConfigError } = await import("../src/server/config/env.ts");
const { CONNECTION_SETUP, describeDbError, poolOptions } = await import("../src/server/db/pool.ts");
const { EXIT_CODES, MigrationError, migrationStatus, readMigrations, runMigrations } = await import("../src/server/db/migrate.ts");

const FOLDER = resolve(import.meta.dirname, "../drizzle");
const [command, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(
  rest.map((arg) => {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) {
      console.error(`Unknown argument: ${arg}`);
      process.exit(EXIT_CODES.usage);
    }
    return [match[1], match[2] ?? true];
  }),
);
const KNOWN = new Set(["backup-file", "set-database-default"]);
for (const flag of Object.keys(flags)) {
  if (!KNOWN.has(flag)) {
    console.error(`Unknown option: --${flag}`);
    process.exit(EXIT_CODES.usage);
  }
}

function fail(error) {
  if (error instanceof MigrationError) {
    console.error(`[${error.kind}] ${error.message}`);
    process.exit(EXIT_CODES[error.kind]);
  }
  if (error instanceof ConfigError) {
    console.error(`[config] ${error.message}`);
    process.exit(EXIT_CODES.usage);
  }
  console.error(`[database] ${describeDbError(error)}`);
  process.exit(EXIT_CODES.apply);
}

if (!["check", "status", "up"].includes(command)) {
  console.error("Usage: node scripts/db-migrate.mjs check | status | up [--backup-file=<path>] [--set-database-default]");
  process.exit(EXIT_CODES.usage);
}

let files;
try {
  files = readMigrations(FOLDER);
} catch (error) {
  fail(error);
}
if (command === "check") {
  console.log(`Migration files OK: ${files.length} (${files.map((f) => f.tag).join(", ")}).`);
  process.exit(EXIT_CODES.ok);
}

let connection;
try {
  const config = readDbConfig();
  const options = poolOptions(config);
  connection = await createConnection({
    host: options.host,
    port: options.port,
    socketPath: options.socketPath,
    user: options.user,
    password: options.password,
    database: options.database,
    charset: options.charset,
    timezone: options.timezone,
    supportBigNumbers: true,
    bigNumberStrings: false,
    multipleStatements: false,
    connectTimeout: options.connectTimeout,
  });
  await connection.query(CONNECTION_SETUP);
  if (command === "status") {
    const status = await migrationStatus(connection, files);
    console.log(`Database default: ${status.charset} / ${status.collation}; tables: ${status.tableCount}`);
    console.log(`Applied (${status.applied.length}): ${status.applied.join(", ") || "none"}`);
    console.log(`Pending (${status.pending.length}): ${status.pending.join(", ") || "none"}`);
    if (status.problems.length) {
      console.error(`Problems:\n- ${status.problems.join("\n- ")}`);
      process.exitCode = status.problems.some((p) => p.includes("collation") || p.includes("InnoDB")) ? EXIT_CODES.charset : EXIT_CODES.history;
    }
  } else {
    const result = await runMigrations(connection, files, {
      appEnv: appEnv(),
      backupFile: typeof flags["backup-file"] === "string" ? flags["backup-file"] : undefined,
      setDatabaseDefault: flags["set-database-default"] === true,
      operator: `cli:${userInfo().username}`,
      log: (line) => console.log(line),
    });
    console.log(`Done: ${result.applied.length} applied, ${result.alreadyApplied} already applied.`);
  }
} catch (error) {
  await connection?.end().catch(() => {});
  fail(error);
}
await connection?.end();
