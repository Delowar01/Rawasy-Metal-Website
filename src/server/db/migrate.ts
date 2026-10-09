/**
 * The migration runner behind `scripts/db-migrate.mjs` (A1-DATABASE-SCHEMA §10). Never run at app start.
 *
 * Drizzle's stock migrator applies every file whose journal time is newer than the last applied one (so a file added
 * out of order is skipped silently), takes no lock, and cannot be trusted to roll back MariaDB DDL (DDL commits
 * implicitly). This runner keeps Drizzle's file format and bookkeeping table (`__drizzle_migrations`: the same SHA-256
 * of each file and the same journal time, so the stock migrator would read the same state) and adds:
 *
 * - one runner at a time: `GET_LOCK` (named after the database), refused at once if another runner holds it;
 * - journal checks: entries numbered 0, 1, 2… with strictly increasing times, a file for each, no unlisted `.sql` file,
 *   and explicit table options on every `CREATE TABLE`;
 * - applied-history checks: the applied rows must be exactly the first entries of the journal with unchanged hashes;
 * - the database's default character set set explicitly (utf8mb4 / utf8mb4_unicode_520_ci) before the first table, and
 *   every table and text column verified before and after;
 * - files applied statement by statement, so a failure names the file and the statement (DDL already run stays: the
 *   operator repairs from the reviewed SQL, or restores the pre-migration backup); a file without DDL runs in one
 *   transaction with its bookkeeping row;
 * - a backup requirement outside local development (a recent backup file), dormant locally;
 * - an `audit_events` row (`actor_type = 'cli'`) for each run once that table exists.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { ulid } from "../security/ids.ts";

export const MIGRATIONS_TABLE = "__drizzle_migrations";
export const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci";
export const DB_CHARSET = "utf8mb4";
export const DB_COLLATION = "utf8mb4_unicode_520_ci";
const BREAKPOINT = "--> statement-breakpoint";
/** Columns allowed a binary Unicode collation: the login key. (MariaDB's JSON columns are utf8mb4_bin by definition.) */
const BINARY_TEXT_COLUMNS = new Set(["users.email_normalized"]);
/** How fresh a backup must be when one is required (A1 §10.3). */
export const BACKUP_MAX_AGE_MS = 60 * 60 * 1000;

export type MigrationProblemKind = "journal" | "history" | "lock" | "charset" | "backup" | "apply";

export class MigrationError extends Error {
  readonly kind: MigrationProblemKind;
  constructor(kind: MigrationProblemKind, message: string) {
    super(message);
    this.name = "MigrationError";
    this.kind = kind;
  }
}

/** Exit codes of `scripts/db-migrate.mjs`. */
export const EXIT_CODES: Record<MigrationProblemKind | "ok" | "usage", number> = {
  ok: 0,
  usage: 1,
  lock: 2,
  journal: 3,
  history: 3,
  backup: 4,
  charset: 5,
  apply: 6,
};

export interface MigrationFile {
  idx: number;
  tag: string;
  when: number;
  /** SHA-256 (hex) of the whole file, as Drizzle computes it. */
  hash: string;
  statements: string[];
  hasDdl: boolean;
}

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints?: boolean;
}

const stripComments = (statement: string) => statement.replace(/^\s*(--[^\n]*\n\s*)*/g, "").trim();
const DDL = /^(CREATE|ALTER|DROP|RENAME|TRUNCATE)\b/i;

/** Reads and checks the journal and its files. Throws MigrationError("journal") on any inconsistency. */
export function readMigrations(folder: string): MigrationFile[] {
  const journalPath = join(folder, "meta", "_journal.json");
  if (!existsSync(journalPath)) throw new MigrationError("journal", `No journal at ${journalPath}.`);
  let entries: JournalEntry[];
  try {
    entries = (JSON.parse(readFileSync(journalPath, "utf8")) as { entries: JournalEntry[] }).entries;
  } catch {
    throw new MigrationError("journal", "The journal is not valid JSON.");
  }
  if (!Array.isArray(entries)) throw new MigrationError("journal", "The journal has no entries list.");
  const files: MigrationFile[] = [];
  const tags = new Set<string>();
  entries.forEach((entry, position) => {
    if (entry.idx !== position) throw new MigrationError("journal", `Journal entry ${position} is numbered ${entry.idx}.`);
    if (!/^\d{4}_[a-z0-9_]+$/.test(entry.tag) || Number(entry.tag.slice(0, 4)) !== position) {
      throw new MigrationError("journal", `Journal entry ${position} has an unexpected tag (${entry.tag}).`);
    }
    if (tags.has(entry.tag)) throw new MigrationError("journal", `Journal tag ${entry.tag} appears twice.`);
    tags.add(entry.tag);
    if (!Number.isSafeInteger(entry.when)) throw new MigrationError("journal", `Journal entry ${entry.tag} has no valid time.`);
    if (position > 0 && entry.when <= entries[position - 1].when) {
      throw new MigrationError("journal", `Journal entry ${entry.tag} is not later than the one before it (out of order).`);
    }
    const path = join(folder, `${entry.tag}.sql`);
    if (!existsSync(path)) throw new MigrationError("journal", `Migration file ${entry.tag}.sql is missing.`);
    const sql = readFileSync(path, "utf8");
    const statements = sql.split(BREAKPOINT).filter((s) => stripComments(s) !== "");
    if (statements.length === 0) throw new MigrationError("journal", `Migration file ${entry.tag}.sql is empty.`);
    for (const statement of statements) {
      const body = stripComments(statement);
      if (/^CREATE\s+TABLE\b/i.test(body) && !body.replace(/;\s*$/, "").endsWith(TABLE_OPTIONS)) {
        throw new MigrationError("journal", `${entry.tag}.sql has a CREATE TABLE without "${TABLE_OPTIONS}".`);
      }
    }
    files.push({
      idx: entry.idx,
      tag: entry.tag,
      when: entry.when,
      hash: createHash("sha256").update(sql).digest("hex"),
      statements,
      hasDdl: statements.some((s) => DDL.test(stripComments(s))),
    });
  });
  for (const name of readdirSync(folder)) {
    if (name.endsWith(".sql") && !tags.has(name.slice(0, -4))) {
      throw new MigrationError("journal", `${name} is not in the journal (it would never be applied).`);
    }
  }
  return files;
}

interface AppliedRow extends RowDataPacket {
  id: number;
  hash: string;
  created_at: number | string | null;
}

async function migrationsTableExists(connection: Connection): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [MIGRATIONS_TABLE],
  );
  return Number(rows[0].n) > 0;
}

async function readApplied(connection: Connection): Promise<AppliedRow[]> {
  if (!(await migrationsTableExists(connection))) return [];
  const [rows] = await connection.query<AppliedRow[]>(`SELECT id, hash, created_at FROM \`${MIGRATIONS_TABLE}\` ORDER BY id`);
  return rows;
}

export interface MigrationStatus {
  database: string;
  charset: string;
  collation: string;
  tableCount: number;
  applied: string[];
  pending: string[];
  problems: string[];
}

/** Compares the applied history with the journal: it must be exactly the journal's first entries, unchanged. */
export function checkHistory(files: MigrationFile[], applied: { hash: string; created_at: number | string | null }[]): string[] {
  const problems: string[] = [];
  if (applied.length > files.length) {
    problems.push(`The database has ${applied.length} applied migrations; the journal lists ${files.length} (database is newer).`);
  }
  applied.forEach((row, i) => {
    const file = files[i];
    if (!file) return;
    if (Number(row.created_at) !== file.when) {
      problems.push(`Applied migration ${i + 1} does not match journal entry ${file.tag} (time differs: out of order).`);
    } else if (row.hash !== file.hash) {
      problems.push(`${file.tag}.sql changed after it was applied (hash differs).`);
    }
  });
  return problems;
}

export async function databaseDefaults(connection: Connection) {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT DATABASE() AS db, DEFAULT_CHARACTER_SET_NAME AS cs, DEFAULT_COLLATION_NAME AS co FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()",
  );
  const [count] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
  );
  if (!rows[0]?.db) throw new MigrationError("charset", "No database selected (DB_NAME).");
  return { database: String(rows[0].db), charset: String(rows[0].cs), collation: String(rows[0].co), tableCount: Number(count[0].n) };
}

/** Every table InnoDB + utf8mb4_unicode_520_ci; every text column that collation, ascii_bin, or an allowed binary one. */
export async function verifyCharsets(connection: Connection): Promise<string[]> {
  const problems: string[] = [];
  const [tables] = await connection.query<RowDataPacket[]>(
    "SELECT TABLE_NAME AS t, ENGINE AS e, TABLE_COLLATION AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
  );
  for (const { t, e, c } of tables) {
    if (e !== "InnoDB") problems.push(`Table ${t} uses ${e}, not InnoDB.`);
    if (c !== DB_COLLATION) problems.push(`Table ${t} has collation ${c}, not ${DB_COLLATION}.`);
  }
  const [columns] = await connection.query<RowDataPacket[]>(
    `SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS col, c.DATA_TYPE AS dt, c.COLUMN_TYPE AS ct, c.COLLATION_NAME AS co,
            EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS k
                     WHERE k.CONSTRAINT_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME
                       AND k.CHECK_CLAUSE = CONCAT('json_valid(\`', c.COLUMN_NAME, '\`)')) AS is_json
       FROM information_schema.COLUMNS c
      WHERE c.TABLE_SCHEMA = DATABASE() AND c.COLLATION_NAME IS NOT NULL`,
  );
  for (const { t, col, dt, ct, co, is_json } of columns) {
    const name = `${t}.${col}`;
    if (ct === "char(26)" && co !== "ascii_bin") problems.push(`${name} (an id) has collation ${co}, not ascii_bin.`);
    if (co === DB_COLLATION || co === "ascii_bin") continue;
    if (co === "utf8mb4_bin" && (BINARY_TEXT_COLUMNS.has(name) || (dt === "longtext" && Number(is_json) === 1))) continue;
    problems.push(`${name} has collation ${co}.`);
  }
  return problems;
}

export async function migrationStatus(connection: Connection, files: MigrationFile[]): Promise<MigrationStatus> {
  const defaults = await databaseDefaults(connection);
  const applied = await readApplied(connection);
  const problems = checkHistory(files, applied);
  if (defaults.tableCount > 0) problems.push(...(await verifyCharsets(connection)));
  return {
    ...defaults,
    applied: files.slice(0, Math.min(applied.length, files.length)).map((f) => f.tag),
    pending: applied.length <= files.length ? files.slice(applied.length).map((f) => f.tag) : [],
    problems,
  };
}

/** The lock name: per database (GET_LOCK names are server-wide), at most 64 characters. */
export function lockName(database: string): string {
  const name = `rawasy_migrate.${database}`;
  return name.length <= 64 ? name : `rawasy_migrate.${createHash("sha256").update(database).digest("hex").slice(0, 40)}`;
}

export interface BackupCheck {
  appEnv: "local" | "staging" | "production";
  backupFile?: string;
  now?: number;
}

/** Outside local development a backup younger than an hour is required, unless the database has no table yet. */
export function checkBackup({ appEnv, backupFile, now = Date.now() }: BackupCheck, tableCount: number): string {
  if (appEnv === "local") return "backup hook dormant (APP_ENV=local)";
  if (tableCount === 0) return "no backup needed (the database has no table yet)";
  if (!backupFile) throw new MigrationError("backup", "A backup is required: pass --backup-file=<fresh database backup>.");
  if (!existsSync(backupFile)) throw new MigrationError("backup", "The backup file does not exist.");
  const stat = statSync(backupFile);
  if (!stat.isFile() || stat.size === 0) throw new MigrationError("backup", "The backup file is empty or not a file.");
  if (now - stat.mtimeMs > BACKUP_MAX_AGE_MS) throw new MigrationError("backup", "The backup file is older than 60 minutes.");
  return "backup file present and fresh";
}

export interface RunOptions extends BackupCheck {
  /** Allow `ALTER DATABASE … utf8mb4_unicode_520_ci` on a database that already has tables. */
  setDatabaseDefault?: boolean;
  operator?: string;
  log?: (line: string) => void;
}

export interface RunResult {
  applied: string[];
  alreadyApplied: number;
}

async function audit(connection: Connection, outcome: "success" | "failed", summary: string, changes: object, operator: string) {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_events'",
  );
  if (Number(rows[0].n) === 0) return;
  await connection.query(
    `INSERT INTO audit_events (occurred_at, request_id, actor_type, actor_label, action, entity_type, outcome, summary, changes)
     VALUES (UTC_TIMESTAMP(3), ?, 'cli', ?, 'db.migrate', 'database', ?, ?, ?)`,
    [ulid(), operator.slice(0, 200), outcome, summary.slice(0, 500), JSON.stringify(changes)],
  );
}

/**
 * Applies the pending migrations. The connection must be a single dedicated connection (the lock belongs to it).
 * Throws MigrationError with the kind that decides the exit code.
 */
export async function runMigrations(connection: Connection, files: MigrationFile[], options: RunOptions): Promise<RunResult> {
  const log = options.log ?? (() => {});
  const operator = options.operator ?? "cli";
  const before = await databaseDefaults(connection);
  const lock = lockName(before.database);
  const [got] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 0) AS got", [lock]);
  if (Number(got[0].got) !== 1) throw new MigrationError("lock", "Another migration runner holds the lock. Nothing was changed.");
  try {
    const defaults = await databaseDefaults(connection);
    if (defaults.charset !== DB_CHARSET || defaults.collation !== DB_COLLATION) {
      if (defaults.tableCount > 0 && !options.setDatabaseDefault) {
        throw new MigrationError(
          "charset",
          `The database default is ${defaults.charset} / ${defaults.collation} and it has tables. Check them, then rerun with --set-database-default.`,
        );
      }
      await connection.query(`ALTER DATABASE \`${defaults.database.replace(/`/g, "``")}\` CHARACTER SET ${DB_CHARSET} COLLATE ${DB_COLLATION}`);
      log(`Database default set to ${DB_CHARSET} / ${DB_COLLATION}.`);
    }
    if (defaults.tableCount > 0) {
      const problems = await verifyCharsets(connection);
      if (problems.length) throw new MigrationError("charset", problems.join("\n"));
    }
    const applied = await readApplied(connection);
    const history = checkHistory(files, applied);
    if (history.length) throw new MigrationError("history", history.join("\n"));
    const pending = files.slice(applied.length);
    if (pending.length === 0) {
      log("Nothing to apply: the database is up to date.");
      return { applied: [], alreadyApplied: applied.length };
    }
    log(checkBackup(options, defaults.tableCount));
    await connection.query(
      `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint) ${TABLE_OPTIONS}`,
    );
    const done: string[] = [];
    for (const file of pending) {
      let index = 0;
      try {
        if (!file.hasDdl) await connection.query("START TRANSACTION");
        for (const statement of file.statements) {
          index++;
          await connection.query(statement);
        }
        await connection.query(`INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at) VALUES (?, ?)`, [file.hash, file.when]);
        if (!file.hasDdl) await connection.query("COMMIT");
      } catch (error) {
        if (!file.hasDdl) await connection.query("ROLLBACK").catch(() => {});
        const code = (error as { code?: string }).code ?? "error";
        const where = `${file.tag}.sql, statement ${index} of ${file.statements.length}`;
        const note = file.hasDdl
          ? "Statements before it were committed (MariaDB commits DDL implicitly): repair by hand from the reviewed SQL, or restore the backup."
          : "The file ran in one transaction and was rolled back.";
        await audit(connection, "failed", `Migration failed at ${where} (${code}).`, { failed: file.tag, statement: index, code }, operator).catch(
          () => {},
        );
        throw new MigrationError("apply", `Failed at ${where} (${code}). ${note}`);
      }
      done.push(file.tag);
      log(`Applied ${file.tag} (${file.statements.length} statements).`);
    }
    const problems = await verifyCharsets(connection);
    if (problems.length) throw new MigrationError("charset", problems.join("\n"));
    await audit(connection, "success", `Applied ${done.length} migration(s): ${done.join(", ")}.`, { applied: done }, operator);
    return { applied: done, alreadyApplied: applied.length };
  } finally {
    await connection.query("SELECT RELEASE_LOCK(?)", [lock]).catch(() => {});
  }
}
