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
import { createReadStream, createWriteStream, existsSync, realpathSync } from "node:fs";
import { chmod, copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import type { Readable, Writable } from "node:stream";
import { createGunzip, createGzip } from "node:zlib";
import { createHash, createPublicKey } from "node:crypto";
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

/** A path with its existing part's symbolic links resolved (the rest, not yet created, appended as given). */
export function realPathOf(path: string): string {
  let dir = resolve(path);
  const tail: string[] = [];
  for (;;) {
    try {
      return join(realpathSync(dir), ...tail);
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return resolve(path);
      tail.unshift(basename(dir));
      dir = parent;
    }
  }
}

/** The repository a path lies in (a folder holding `.git`, symbolic links resolved), or null. */
export function repositoryOf(path: string): string | null {
  let dir = realPathOf(path);
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** The application's own folder (the release: its code, `public/` and `.next`), from this file's place in it. */
export const APP_ROOT = realPathOf(resolve(dirname(fileURLToPath(import.meta.url)), "../../.."));

/**
 * Why a backup, key or restored-data folder may not be at `path` (A8 review L7), or null: never inside a Git repository,
 * never inside the application's folder (its `public/` is served, a release folder is replaced), never under a
 * `public_html` (the host's web root). Symbolic links are resolved first.
 */
export function placeProblem(path: string, what: string, appRoot = APP_ROOT): string | null {
  const real = realPathOf(path);
  if (repositoryOf(real)) return `Refused: the ${what} folder is inside a Git repository. Backups and keys never go into Git.`;
  if (real === appRoot || real.startsWith(appRoot + sep)) return `Refused: the ${what} folder is inside the application's folder (${appRoot}). Keep backups, keys and data outside the release.`;
  if (real.split(sep).includes("public_html")) return `Refused: the ${what} folder is inside public_html (the web root).`;
  return null;
}

/** A backup's folder must be new (or empty), private (0700) and in an allowed place. */
async function freshFolder(path: string, what: string): Promise<string> {
  const full = resolve(path);
  const problem = placeProblem(full, what);
  if (problem) throw new BackupError(problem);
  if (existsSync(full) && (await readdir(full)).length) throw new BackupError(`Refused: the ${what} folder is not empty.`);
  await mkdir(full, { recursive: true, mode: 0o700 });
  await chmod(full, 0o700);
  return full;
}

/** The SHA-256 of a manifest file's bytes: printed when a backup is made, to be recorded outside it (A8 review L6). */
export const manifestFingerprint = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

export interface TarMember {
  name: string;
  type: string;
}

/** The 512-byte blocks of a gzipped tar file. */
async function* tarBlocks(path: string): AsyncGenerator<Buffer> {
  let pending: Buffer = Buffer.alloc(0);
  for await (const chunk of createReadStream(path).pipe(createGunzip())) {
    pending = pending.length ? Buffer.concat([pending, chunk as Buffer]) : (chunk as Buffer);
    while (pending.length >= 512) {
      yield pending.subarray(0, 512);
      pending = pending.subarray(512);
    }
  }
}

const cString = (block: Buffer, start: number, length: number) => {
  const raw = block.subarray(start, start + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString("utf8");
};

function tarSize(block: Buffer): number {
  const field = block.subarray(124, 136);
  if (field[0] & 0x80) {
    let n = 0;
    for (let i = 1; i < field.length; i++) n = n * 256 + field[i];
    return n;
  }
  const text = cString(block, 124, 12).trim();
  return text ? parseInt(text, 8) : 0;
}

/**
 * Reads a gzipped tar archive's member list without extracting anything (ustar, GNU long names, pax paths), so a
 * restore can refuse an archive whose members would land outside the target folder or are anything but regular files
 * and folders (A8 review L6: links, devices, absolute paths, `..`).
 */
export async function tarMembers(path: string, limit = 2_000_000): Promise<TarMember[]> {
  const members: TarMember[] = [];
  let zeros = 0;
  let longName: string | null = null;
  let paxPath: string | null = null;
  let collecting: { type: string; left: number; parts: Buffer[]; size: number } | null = null;
  let skip = 0;
  for await (const block of tarBlocks(path)) {
    if (collecting) {
      collecting.parts.push(Buffer.from(block));
      collecting.left -= 1;
      if (collecting.left === 0) {
        const data = Buffer.concat(collecting.parts).subarray(0, collecting.size);
        if (collecting.type === "L") longName = cString(data, 0, data.length);
        else if (collecting.type === "x") {
          for (const record of data.toString("utf8").split("\n")) {
            const match = /^\d+ path=(.*)$/.exec(record);
            if (match) paxPath = match[1];
          }
        }
        collecting = null;
      }
      continue;
    }
    if (skip) {
      skip -= 1;
      continue;
    }
    if (block.every((byte) => byte === 0)) {
      zeros += 1;
      if (zeros >= 2) break;
      continue;
    }
    zeros = 0;
    const type = block[156] === 0 ? "0" : String.fromCharCode(block[156]);
    const size = tarSize(block);
    const blocks = Math.ceil(size / 512);
    if (type === "L" || type === "x" || type === "g") {
      if (blocks) collecting = { type, left: blocks, parts: [], size };
      continue;
    }
    const prefix = cString(block, 257, 6).startsWith("ustar") ? cString(block, 345, 155) : "";
    const plain = prefix ? `${prefix}/${cString(block, 0, 100)}` : cString(block, 0, 100);
    members.push({ name: longName ?? paxPath ?? plain, type });
    if (members.length > limit) throw new BackupError("The file archive holds too many members.");
    longName = null;
    paxPath = null;
    skip = type === "5" ? 0 : blocks;
  }
  return members;
}

/** What makes a member unsafe to extract, or null. */
export function tarMemberProblem(member: TarMember): string | null {
  if (member.type !== "0" && member.type !== "5") return `${member.name.slice(0, 80)} is not a regular file or folder (type ${member.type}).`;
  if (!member.name || member.name.startsWith("/") || member.name.includes("\0")) return `${member.name.slice(0, 80)} has an absolute or empty name.`;
  if (member.name.split("/").some((part) => part === "..")) return `${member.name.slice(0, 80)} climbs out of the folder.`;
  return null;
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

export async function createBackup(options: CreateOptions): Promise<{ folder: string; manifest: BackupManifest; manifestSha256: string }> {
  const folder = await freshFolder(options.out, "backup");
  const { access } = options;
  // Plain dumps and the archive are made in a private (0700) staging folder inside the backup folder (same disk), then
  // encrypted (or copied, 0600) into it; the staging folder goes whatever happens, and a failed run leaves nothing of
  // itself behind (A8 review L5).
  const stage = await mkdtemp(join(folder, ".stage-"));
  const written: string[] = [];
  let finished = false;
  const option = await optionFile(access);
  const conn = await connect(access, access.database);
  try {
    const files: ManifestFile[] = [];
    const base = [`--defaults-extra-file=${option.path}`, "--single-transaction", "--quick", "--routines", "--triggers", "--hex-blob", "--default-character-set=utf8mb4", "--no-tablespaces"];
    const dump = async (name: string, kind: ManifestFile["kind"], args: string[]) => {
      const path = join(stage, name);
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
      const path = join(stage, "files.tar.gz");
      const result = parts.length
        ? await options.run("tar", ["-C", options.dataDir, "-czf", path, "--no-xattrs", "--", ...parts], {})
        : await options.run("tar", ["-czf", path, "--files-from=/dev/null"], {});
      if (result.code !== 0) throw new BackupError(`tar failed (exit ${result.code}): ${result.stderr.trim().split("\n").slice(-2).join(" ")}`);
      await chmod(path, 0o600);
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
    const configPath = join(stage, "config.json");
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
        const plain = join(stage, file.name);
        const encrypted = join(folder, `${file.name}.enc`);
        written.push(`${file.name}.enc`);
        await encryptFile(plain, encrypted, dataKey);
        file.plain = { bytes: file.bytes, sha256: file.sha256 };
        await rm(plain);
        file.name = `${file.name}.enc`;
        file.bytes = (await stat(encrypted)).size;
        file.sha256 = await sha256File(encrypted);
      }
      manifest.encryption = { scheme: "aes-256-gcm+rsa-oaep-sha256", recipient: keyFingerprint(options.publicKeyPem), wrappedKey: wrapKey(options.publicKeyPem, dataKey) };
      dataKey.fill(0);
    } else {
      for (const file of files) {
        written.push(file.name);
        await copyFile(join(stage, file.name), join(folder, file.name));
        await chmod(join(folder, file.name), 0o600);
      }
    }
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    written.push("manifest.json");
    await writeFile(join(folder, "manifest.json"), manifestText, { mode: 0o600 });
    finished = true;
    return { folder, manifest, manifestSha256: manifestFingerprint(manifestText) };
  } finally {
    await conn.end().catch(() => undefined);
    await option.remove();
    await rm(stage, { recursive: true, force: true });
    if (!finished) for (const name of written) await rm(join(folder, name), { force: true });
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
export async function verifyBackup(folder: string, privateKeyPem: string | null, options: { keepPlain?: boolean; manifestSha256?: string | null } = {}): Promise<VerifyResult> {
  const problems: string[] = [];
  let manifest: BackupManifest;
  try {
    const bytes = await readFile(join(folder, "manifest.json"));
    // Anyone who can write to the backup storage can make a manifest that matches its files, and anyone with the public
    // key can encrypt to it: only the fingerprint recorded elsewhere when the backup was made proves it is that backup.
    if (options.manifestSha256 && manifestFingerprint(bytes) !== options.manifestSha256.trim().toLowerCase()) {
      return { ok: false, manifest: null, problems: ["manifest.json does not match the fingerprint recorded when the backup was made (replaced or changed)."], plainFiles: {}, workDir: null };
    }
    manifest = JSON.parse(bytes.toString("utf8")) as BackupManifest;
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
    if (plainFiles.files) {
      try {
        const unsafe = (await tarMembers(plainFiles.files)).map(tarMemberProblem).filter((p): p is string => p !== null);
        if (unsafe.length) problems.push(`The file archive holds ${unsafe.length} member${unsafe.length === 1 ? "" : "s"} a restore must not write: ${unsafe.slice(0, 3).join(" ")}`);
      } catch {
        problems.push("The file archive could not be read.");
      }
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
  /** The manifest's fingerprint as recorded when the backup was made (checked when given; see the runbook). */
  manifestSha256?: string | null;
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
  const verified = await verifyBackup(options.from, options.privateKeyPem, { keepPlain: true, manifestSha256: options.manifestSha256 ?? null });
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
      const problem = placeProblem(options.dataDir, "data");
      if (problem) throw new BackupError(problem);
    }
    const option = await optionFile({ ...options.access, database: options.database });
    try {
      for (const kind of ["database", "database-schema"] as const) {
        // --sandbox: a dump runs no client command that reaches the file system or a shell (`\!`, `source`…; A8 review L6).
        const result = await options.run(options.clientBin, [`--defaults-extra-file=${option.path}`, "--sandbox", "--default-character-set=utf8mb4", options.database], { stdin: createReadStream(verified.plainFiles[kind]).pipe(createGunzip()) });
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
