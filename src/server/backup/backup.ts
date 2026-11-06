/**
 * Backups and restores (A8.6, A1-ARCHITECTURE §11, A1-SECURITY-RBAC §12): operator tools only — run by hand on the server
 * (or a disposable local copy), never by the app, never at start-up, no HTTP route.
 *
 * A backup is a folder outside the repository and outside anything served:
 * - `database.sql.gz`: `mariadb-dump --single-transaction --quick --routines --triggers --hex-blob` of every table but
 *   the four whose rows are secrets or throwaway (`sessions`, `auth_tokens`, `rate_limits`, `login_attempts`), whose
 *   structure is in `database-excluded-schema.sql.gz` (A1 §11: dumps exclude session and token tables);
 * - `files.tar.gz`: the data folder's media (public-class originals and derivatives, private certificate originals) and
 *   the private enquiry attachments — everything under `RAWASY_DATA_DIR` but `tmp/`;
 * - `config.json`: configuration metadata only — which variables are set (names, never values), the environment, the
 *   `AUTH_ENCRYPTION_KEY` versions rows still need (so the right escrowed keys can be found), the Node version;
 * - `manifest.json`: every file's size and SHA-256, the applied migrations, row counts, the encryption envelope.
 *
 * With a public key, every file is encrypted (`crypto.ts`); the manifest holds no secret. Credentials reach the MariaDB
 * tools through a temporary option file (mode 0600, removed afterwards), never a command line. A restore goes into an
 * EMPTY database and an empty data folder only (it never overwrites), then sets a new cache epoch (A1 §8.2) and records
 * itself. Framework-free; the commands run through an injected runner (the tests and the local drill use a container).
 */
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable, Writable } from "node:stream";
import { createGunzip, createGzip } from "node:zlib";
import { createPublicKey } from "node:crypto";
import { createConnection, type Connection } from "mysql2/promise";
import { decryptFile, encryptFile, keyFingerprint, newDataKey, sha256File, unwrapKey, wrapKey } from "./crypto.ts";

export const BACKUP_FORMAT = "rawasy-backup/1";
/** Tables whose rows are never backed up (secrets or throwaway); their structure is. */
export const EXCLUDED_DATA = ["sessions", "auth_tokens", "rate_limits", "login_attempts"] as const;
/** Configuration variables whose presence (never value) the backup records. */
const CONFIG_NAMES = [
  "APP_ENV",
  "ADMIN_ENABLED",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "DB_SOCKET_PATH",
  "DB_POOL_LIMIT",
  "RAWASY_DATA_DIR",
  "AUTH_ENCRYPTION_KEY",
  "AUTH_ENCRYPTION_KEY_VERSION",
  "AUTH_ENCRYPTION_RETIRED_KEYS",
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
  "TRUSTED_PROXY_HOPS",
  "CRON_SECRET",
  "MAIL_TRANSPORT",
  "SMTP_HOST",
  "NEXT_PUBLIC_SITE_URL",
  "BACKUP_ENCRYPTION_RECIPIENT",
];

export interface DbAccess {
  host: string;
  port: number;
  socketPath?: string;
  user: string;
  password: string;
  database: string;
}

export type Runner = (bin: string, args: string[], io: { stdin?: Readable; stdout?: Writable }) => Promise<{ code: number; stderr: string }>;

/** Runs a program with its own stdin/stdout streams; stderr is collected for the operator (never stored). */
export const spawnRunner: Runner = (bin, args, io) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { stdio: [io.stdin ? "pipe" : "ignore", io.stdout ? "pipe" : "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => (stderr = (stderr + chunk).slice(-4000)));
    child.on("error", reject);
    if (io.stdin && child.stdin) io.stdin.pipe(child.stdin);
    if (io.stdout && child.stdout) child.stdout.pipe(io.stdout);
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stderr }));
  });

export interface ManifestFile {
  name: string;
  kind: "database" | "database-schema" | "files" | "config";
  bytes: number;
  sha256: string;
  plain?: { bytes: number; sha256: string };
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  createdAt: string;
  environment: string;
  note: string | null;
  database: { name: string; serverVersion: string; migrations: string[]; tables: Record<string, number>; excludedData: string[] };
  files: ManifestFile[];
  encryption: null | { scheme: "aes-256-gcm+rsa-oaep-sha256"; recipient: string; wrappedKey: string };
}

export class BackupError extends Error {}

/** The repository a path lies in (a folder holding `.git`), or null. */
export function repositoryOf(path: string): string | null {
  let dir = resolve(path);
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** A backup's folder must be new (or empty) and outside every repository (A1: never in Git). */
async function freshFolder(path: string, what: string): Promise<string> {
  const full = resolve(path);
  if (repositoryOf(full)) throw new BackupError(`Refused: the ${what} folder is inside a Git repository. Backups and keys never go into Git.`);
  if (existsSync(full) && (await readdir(full)).length) throw new BackupError(`Refused: the ${what} folder is not empty.`);
  await mkdir(full, { recursive: true, mode: 0o700 });
  return full;
}

const optionValue = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** A temporary MariaDB option file (0600) with the credentials; removed by the caller's `finally`. */
async function optionFile(access: DbAccess): Promise<{ path: string; remove: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "rawasy-db-"));
  const path = join(dir, "client.cnf");
  const lines = ["[client]", `user=${optionValue(access.user)}`, `password=${optionValue(access.password)}`];
  if (access.socketPath) lines.push(`socket=${optionValue(access.socketPath)}`);
  else lines.push(`host=${optionValue(access.host)}`, `port=${access.port}`);
  await writeFile(path, `${lines.join("\n")}\n`, { mode: 0o600 });
  return { path, remove: () => rm(dir, { recursive: true, force: true }) };
}

const connect = (access: DbAccess, database: string | null): Promise<Connection> =>
  createConnection({ host: access.socketPath ? undefined : access.host, port: access.port, socketPath: access.socketPath, user: access.user, password: access.password, database: database ?? undefined, multipleStatements: false, timezone: "Z" });

async function rows<T>(conn: Connection, statement: string, params: unknown[] = []): Promise<T[]> {
  const [result] = await conn.query(statement, params);
  return result as T[];
}

/** Row counts of every table (the excluded ones too: they restore empty). */
export async function tableCounts(conn: Connection, database: string): Promise<Record<string, number>> {
  const tables = await rows<{ name: string }>(conn, "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name", [database]);
  const out: Record<string, number> = {};
  for (const { name } of tables) {
    if (!/^[A-Za-z0-9_]{1,64}$/.test(name)) continue;
    const [count] = await rows<{ n: number }>(conn, `SELECT COUNT(*) AS n FROM \`${name}\``);
    out[name] = Number(count.n);
  }
  return out;
}

const DUMP_DONE = /-- Dump completed/;

/** Reads a gzipped SQL dump to its end and checks it completed (a cut-off dump has no completion line). */
async function dumpComplete(path: string): Promise<boolean> {
  let tail = "";
  await pipeline(createReadStream(path), createGunzip(), async function* (source: AsyncIterable<Buffer>) {
    for await (const chunk of source) tail = (tail + chunk.toString("utf8")).slice(-512);
    yield "";
  });
  return DUMP_DONE.test(tail);
}

export interface CreateOptions {
  out: string;
  access: DbAccess;
  dataDir: string | null;
  publicKeyPem: string | null;
  note: string | null;
  env: Record<string, string | undefined>;
  dumpBin: string;
  run: Runner;
  now: Date;
}

export async function createBackup(options: CreateOptions): Promise<{ folder: string; manifest: BackupManifest }> {
  const folder = await freshFolder(options.out, "backup");
  const { access } = options;
  const option = await optionFile(access);
  const conn = await connect(access, access.database);
  try {
    const files: ManifestFile[] = [];
    const base = [`--defaults-extra-file=${option.path}`, "--single-transaction", "--quick", "--routines", "--triggers", "--hex-blob", "--default-character-set=utf8mb4", "--no-tablespaces"];
    const dump = async (name: string, kind: ManifestFile["kind"], args: string[]) => {
      const path = join(folder, name);
      const gzip = createGzip();
      const out = createWriteStream(path, { mode: 0o600 });
      const written = pipeline(gzip, out);
      const result = await options.run(options.dumpBin, [...base, ...args], { stdout: gzip });
      await written;
      if (result.code !== 0) throw new BackupError(`mariadb-dump failed (exit ${result.code}): ${result.stderr.trim().split("\n").slice(-2).join(" ")}`);
      if (!(await dumpComplete(path))) throw new BackupError(`The dump ${name} is incomplete.`);
      files.push({ name, kind, bytes: (await stat(path)).size, sha256: await sha256File(path) });
    };
    await dump("database.sql.gz", "database", [...EXCLUDED_DATA.map((t) => `--ignore-table=${access.database}.${t}`), access.database]);
    await dump("database-excluded-schema.sql.gz", "database-schema", ["--no-data", access.database, ...EXCLUDED_DATA]);

    if (options.dataDir) {
      const parts = (await readdir(options.dataDir)).filter((name) => name !== "tmp" && !name.startsWith("."));
      const path = join(folder, "files.tar.gz");
      const result = parts.length
        ? await options.run("tar", ["-C", options.dataDir, "-czf", path, "--no-xattrs", ...parts], {})
        : await options.run("tar", ["-czf", path, "--files-from=/dev/null"], {});
      if (result.code !== 0) throw new BackupError(`tar failed (exit ${result.code}): ${result.stderr.trim().split("\n").slice(-2).join(" ")}`);
      files.push({ name: "files.tar.gz", kind: "files", bytes: (await stat(path)).size, sha256: await sha256File(path) });
    }

    const keyVersions = (await rows<{ v: number }>(conn, "SELECT DISTINCT key_version AS v FROM user_mfa ORDER BY key_version")).map((r) => Number(r.v));
    const config = {
      environment: options.env.APP_ENV ?? "(unset)",
      variablesSet: CONFIG_NAMES.filter((name) => options.env[name] !== undefined && options.env[name] !== ""),
      authEncryptionKeyVersionsInUse: keyVersions,
      node: process.version,
      note: "Names only: no value of any variable is in this backup. Restore the recovery-critical keys from escrow (docs/admin/A8-BACKUP-RESTORE.md).",
    };
    const configPath = join(folder, "config.json");
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    files.push({ name: "config.json", kind: "config", bytes: (await stat(configPath)).size, sha256: await sha256File(configPath) });

    const [version] = await rows<{ v: string }>(conn, "SELECT VERSION() AS v");
    const migrations = (await rows<{ hash: string }>(conn, "SELECT hash FROM __drizzle_migrations ORDER BY id")).map((r) => r.hash);
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      createdAt: options.now.toISOString(),
      environment: options.env.APP_ENV ?? "(unset)",
      note: options.note ? options.note.slice(0, 300) : null,
      database: { name: access.database, serverVersion: version.v, migrations, tables: await tableCounts(conn, access.database), excludedData: [...EXCLUDED_DATA] },
      files,
      encryption: null,
    };
    if (options.publicKeyPem) {
      const dataKey = newDataKey();
      for (const file of files) {
        const plain = join(folder, file.name);
        const encrypted = `${plain}.enc`;
        await encryptFile(plain, encrypted, dataKey);
        file.plain = { bytes: file.bytes, sha256: file.sha256 };
        await rm(plain);
        file.name = `${file.name}.enc`;
        file.bytes = (await stat(encrypted)).size;
        file.sha256 = await sha256File(encrypted);
      }
      manifest.encryption = { scheme: "aes-256-gcm+rsa-oaep-sha256", recipient: keyFingerprint(options.publicKeyPem), wrappedKey: wrapKey(options.publicKeyPem, dataKey) };
      dataKey.fill(0);
    }
    await writeFile(join(folder, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    return { folder, manifest };
  } finally {
    await conn.end().catch(() => undefined);
    await option.remove();
  }
}

export interface VerifyResult {
  ok: boolean;
  manifest: BackupManifest | null;
  problems: string[];
  /** Plain files ready to restore (decrypted into `workDir` when the backup is encrypted). */
  plainFiles: Record<string, string>;
  workDir: string | null;
}

const SAFE_NAME = /^[a-z][a-z0-9-]*\.(sql\.gz|tar\.gz|json)(\.enc)?$/;

/**
 * Checks a backup: the manifest's shape, every file's size and SHA-256, and — when the files can be read (not encrypted,
 * or the private key given) — the decrypted contents' hashes and the dumps' completion. `keepPlain`: leaves decrypted
 * files in a private temporary folder for a restore (the caller removes it).
 */
export async function verifyBackup(folder: string, privateKeyPem: string | null, options: { keepPlain?: boolean } = {}): Promise<VerifyResult> {
  const problems: string[] = [];
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await readFile(join(folder, "manifest.json"), "utf8")) as BackupManifest;
  } catch {
    return { ok: false, manifest: null, problems: ["manifest.json is missing or unreadable."], plainFiles: {}, workDir: null };
  }
  if (manifest.format !== BACKUP_FORMAT || !Array.isArray(manifest.files)) return { ok: false, manifest, problems: [`Unknown backup format (${String(manifest.format)}).`], plainFiles: {}, workDir: null };
  for (const file of manifest.files) {
    if (typeof file.name !== "string" || !SAFE_NAME.test(file.name)) {
      problems.push(`A file name in the manifest is not allowed: ${String(file.name).slice(0, 60)}.`);
      continue;
    }
    const path = join(folder, file.name);
    if (!existsSync(path)) {
      problems.push(`${file.name} is missing.`);
      continue;
    }
    if ((await stat(path)).size !== file.bytes) problems.push(`${file.name} has the wrong size.`);
    else if ((await sha256File(path)) !== file.sha256) problems.push(`${file.name} does not match its SHA-256 (changed or damaged).`);
  }
  const plainFiles: Record<string, string> = {};
  let workDir: string | null = null;
  if (!problems.length) {
    if (manifest.encryption) {
      if (privateKeyPem) {
        if (keyFingerprint(privateKeyPemToPublic(privateKeyPem)) !== manifest.encryption.recipient) problems.push("The private key is not the one this backup was encrypted for.");
        else {
          const dataKey = unwrapKey(privateKeyPem, manifest.encryption.wrappedKey);
          workDir = await mkdtemp(join(tmpdir(), "rawasy-restore-"));
          for (const file of manifest.files) {
            const plainName = file.name.replace(/\.enc$/, "");
            const target = join(workDir, plainName);
            try {
              await decryptFile(join(folder, file.name), target, dataKey);
            } catch {
              problems.push(`${file.name} could not be decrypted (damaged, or another key).`);
              continue;
            }
            if (file.plain && (await sha256File(target)) !== file.plain.sha256) problems.push(`${plainName} does not match its SHA-256 after decryption.`);
            plainFiles[file.kind] = target;
          }
          dataKey.fill(0);
        }
      }
    } else for (const file of manifest.files) plainFiles[file.kind] = join(folder, file.name);
    for (const kind of ["database", "database-schema"] as const) {
      if (plainFiles[kind] && !(await dumpComplete(plainFiles[kind]).catch(() => false))) problems.push(`The ${kind === "database" ? "database dump" : "excluded tables' schema"} is incomplete.`);
    }
  }
  if (!options.keepPlain && workDir) {
    await rm(workDir, { recursive: true, force: true });
    workDir = null;
  }
  return { ok: problems.length === 0, manifest, problems, plainFiles, workDir };
}

/** The public half of a private key (PEM), to compare its fingerprint with the backup's recipient. */
function privateKeyPemToPublic(privatePem: string): string {
  return createPublicKey(privatePem).export({ type: "spki", format: "pem" }).toString();
}

export interface RestoreOptions {
  from: string;
  database: string;
  dataDir: string | null;
  privateKeyPem: string | null;
  access: Omit<DbAccess, "database">;
  clientBin: string;
  run: Runner;
  now: Date;
  newEpoch: string;
}

export interface RestoreResult {
  database: string;
  tables: number;
  countDifferences: string[];
  filesRestored: boolean;
}

/** Restores a verified backup into an empty database (created if missing) and an empty data folder. */
export async function restoreBackup(options: RestoreOptions): Promise<RestoreResult> {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(options.database)) throw new BackupError("The target database name may hold letters, digits and _ only.");
  const verified = await verifyBackup(options.from, options.privateKeyPem, { keepPlain: true });
  try {
    if (!verified.ok || !verified.manifest) throw new BackupError(`The backup did not verify: ${verified.problems.join(" ")}`);
    if (verified.manifest.encryption && !options.privateKeyPem) throw new BackupError("This backup is encrypted: give the private key (from escrow).");
    if (!verified.plainFiles.database || !verified.plainFiles["database-schema"]) throw new BackupError("The backup holds no database dump.");
    const server = await connect({ ...options.access, database: "" }, null);
    try {
      await server.query(`CREATE DATABASE IF NOT EXISTS \`${options.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci`);
      const [count] = await rows<{ n: number }>(server, "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?", [options.database]);
      if (Number(count.n) > 0) throw new BackupError(`Refused: the database ${options.database} is not empty. A restore never overwrites: use a new, empty database.`);
    } finally {
      await server.end().catch(() => undefined);
    }
    if (options.dataDir) {
      if (existsSync(options.dataDir) && (await readdir(options.dataDir)).length) throw new BackupError("Refused: the data folder is not empty. A restore never overwrites files.");
      if (repositoryOf(options.dataDir)) throw new BackupError("Refused: the data folder is inside a Git repository.");
    }
    const option = await optionFile({ ...options.access, database: options.database });
    try {
      for (const kind of ["database", "database-schema"] as const) {
        const result = await options.run(options.clientBin, [`--defaults-extra-file=${option.path}`, "--default-character-set=utf8mb4", options.database], { stdin: createReadStream(verified.plainFiles[kind]).pipe(createGunzip()) });
        if (result.code !== 0) throw new BackupError(`mariadb failed (exit ${result.code}): ${result.stderr.trim().split("\n").slice(-2).join(" ")}`);
      }
    } finally {
      await option.remove();
    }
    let filesRestored = false;
    if (options.dataDir && verified.plainFiles.files) {
      await mkdir(options.dataDir, { recursive: true, mode: 0o700 });
      const result = await options.run("tar", ["-xzf", verified.plainFiles.files, "-C", options.dataDir, "--no-same-owner", "--no-same-permissions"], {});
      if (result.code !== 0) throw new BackupError(`tar failed (exit ${result.code}): ${result.stderr.trim().split("\n").slice(-2).join(" ")}`);
      filesRestored = true;
    }
    const conn = await connect({ ...options.access, database: options.database }, options.database);
    try {
      // A1 §8.2: no page cached before the restore is served; no session or link from before it exists (not in the dump).
      await conn.query("UPDATE cache_generation SET epoch = ?, updated_at = ? WHERE id = 1", [options.newEpoch, options.now]);
      const counts = await tableCounts(conn, options.database);
      const differences: string[] = [];
      for (const [table, n] of Object.entries(verified.manifest.database.tables)) {
        const expected = (EXCLUDED_DATA as readonly string[]).includes(table) ? 0 : n;
        if (counts[table] !== expected) differences.push(`${table}: ${counts[table] ?? "missing"} (backup ${expected})`);
      }
      await conn.query("INSERT INTO system_job_runs (job_key, started_at, finished_at, status, summary, details) VALUES ('restore', ?, ?, 'success', ?, ?)", [
        options.now,
        new Date(),
        `Restored the backup of ${verified.manifest.createdAt} into this database.`.slice(0, 500),
        JSON.stringify({ tables: Object.keys(counts).length, differences: differences.length, files: filesRestored, source: relative(process.cwd(), options.from).slice(0, 120) }),
      ]);
      return { database: options.database, tables: Object.keys(counts).length, countDifferences: differences, filesRestored };
    } finally {
      await conn.end().catch(() => undefined);
    }
  } finally {
    if (verified.workDir) await rm(verified.workDir, { recursive: true, force: true });
  }
}
