/**
 * Backups, their verification and restore drills (A8.6; procedure: docs/admin/A8-BACKUP-RESTORE.md). An operator tool:
 * run by hand on the server or on a disposable local copy — never by the app, never at start-up, no HTTP route, no
 * schedule. The database settings come from the environment (DB_*), the data folder from RAWASY_DATA_DIR (or --data-dir);
 * credentials reach mariadb-dump / mariadb through a temporary option file (mode 0600), never a command line. Backups and
 * keys are refused inside a Git repository.
 *
 *   node scripts/backup.mjs keygen  --out <folder>                       a key pair for encrypted backups (the private
 *                                                                          key goes into escrow, never onto the server)
 *   node scripts/backup.mjs create  --out <folder> [--public-key <pem> | --unencrypted] [--no-files] [--note <text>]
 *   node scripts/backup.mjs verify  --from <folder> [--private-key <pem>] [--manifest-sha256 <hex>]
 *   node scripts/backup.mjs restore --from <folder> --database <new empty db> --data-dir <new empty folder> [--private-key <pem>]
 *                                   [--manifest-sha256 <hex>]
 *
 * `create` prints the manifest's SHA-256: record it outside the backup (the escrow record). `verify` and `restore` check
 * it when given; outside APP_ENV=local a restore requires it, and a backup without --public-key needs --unencrypted.
 * Backup, key and data folders are refused inside a Git repository, inside the application's folder and under
 * public_html (symbolic links resolved).
 *
 * `MARIADB_DUMP_BIN` / `MARIADB_BIN` name the client programs (default mariadb-dump / mariadb). Exit codes: 0 done · 1 usage
 * or configuration · 2 refused (a folder or database not empty, inside a repository, the wrong key) · 3 failed (a dump,
 * the database, a file) · 4 verification found problems.
 */

const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const { parseArgs, cliDbError } = await import("../src/server/cli/runtime.ts");
const { readDbConfig } = await import("../src/server/config/env.ts");
const { BackupError, createBackup, placeProblem, restoreBackup, spawnRunner, verifyBackup } = await import("../src/server/backup/backup.ts");
const { generateBackupKeyPair } = await import("../src/server/backup/crypto.ts");
const { ulid } = await import("../src/server/security/ids.ts");

const [command, ...rest] = process.argv.slice(2);
const SPECS = {
  keygen: { values: ["out"], flags: [] },
  create: { values: ["out", "public-key", "note", "data-dir"], flags: ["no-files", "unencrypted"] },
  verify: { values: ["from", "private-key", "manifest-sha256"], flags: [] },
  restore: { values: ["from", "database", "data-dir", "private-key", "manifest-sha256"], flags: [] },
};
if (!Object.hasOwn(SPECS, command ?? "")) {
  console.error("Usage: node scripts/backup.mjs keygen|create|verify|restore … (see the file's header).");
  process.exit(1);
}
let args;
try {
  args = parseArgs(rest, SPECS[command]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const need = (name) => {
  if (typeof args[name] !== "string" || !args[name]) {
    console.error(`--${name} is required.`);
    process.exit(1);
  }
  return args[name];
};
const local = process.env.APP_ENV === "local";
const fingerprint = () => {
  const value = args["manifest-sha256"];
  if (value === undefined) return null;
  if (typeof value !== "string" || !/^[0-9a-fA-F]{64}$/.test(value)) {
    console.error("--manifest-sha256 takes the 64 hexadecimal characters printed when the backup was made.");
    process.exit(1);
  }
  return value.toLowerCase();
};
const access = () => {
  const config = readDbConfig(process.env);
  return { host: config.host, port: config.port, socketPath: config.socketPath, user: config.user, password: config.password, database: config.database };
};

/** Records a run in the source database's job log and audit log (counts and names only). */
async function record(db, run) {
  const { createConnection } = await import("mysql2/promise");
  const connection = await createConnection({ host: db.socketPath ? undefined : db.host, port: db.port, socketPath: db.socketPath, user: db.user, password: db.password, database: db.database, timezone: "Z" });
  try {
    const now = new Date();
    await connection.query("INSERT INTO system_job_runs (job_key, started_at, finished_at, status, summary, details) VALUES (?, ?, ?, ?, ?, ?)", [run.job, run.started, now, run.status, run.summary.slice(0, 500), JSON.stringify(run.details)]);
    await connection.query(
      "INSERT INTO audit_events (occurred_at, request_id, actor_type, actor_label, action, entity_type, entity_id, entity_label, outcome, summary) VALUES (?, ?, 'cli', ?, ?, 'system', 'backup', 'Backups', ?, ?)",
      [now, ulid(now.getTime()), `cli:${process.env.USER ?? "operator"}`.slice(0, 200), run.action, run.status === "success" ? "success" : "failed", run.summary.slice(0, 500)],
    );
  } finally {
    await connection.end();
  }
}

let code = 0;
try {
  if (command === "keygen") {
    const out = resolve(need("out"));
    const problem = placeProblem(out, "key");
    if (problem) throw new BackupError(problem);
    await mkdir(out, { recursive: true, mode: 0o700 });
    const pair = generateBackupKeyPair();
    await writeFile(join(out, "backup-public.pem"), pair.publicPem, { mode: 0o644, flag: "wx" });
    await writeFile(join(out, "backup-private.pem"), pair.privatePem, { mode: 0o600, flag: "wx" });
    console.log(`Key pair written to ${out} (fingerprint ${pair.fingerprint}).`);
    console.log("Put backup-private.pem into escrow (two offline copies, never on the server, in Git, email or chat), then delete it here.");
    console.log("Only backup-public.pem goes to the server. Nothing has been escrowed by this tool.");
  } else if (command === "create") {
    const db = access();
    const started = new Date();
    const dataDir = args["no-files"] ? null : (args["data-dir"] ?? process.env.RAWASY_DATA_DIR ?? null);
    if (!args["no-files"] && !dataDir) throw new BackupError("Set RAWASY_DATA_DIR (or --data-dir), or pass --no-files for a database-only backup.");
    const publicKeyPem = typeof args["public-key"] === "string" ? await readFile(resolve(args["public-key"]), "utf8") : null;
    if (publicKeyPem && args.unencrypted) throw new BackupError("Refused: --public-key and --unencrypted contradict each other.");
    if (!publicKeyPem && !local && !args.unencrypted) throw new BackupError("Refused: outside APP_ENV=local a backup is encrypted (--public-key), or made plain on purpose with --unencrypted.");
    try {
      const { folder, manifest, manifestSha256 } = await createBackup({
        out: need("out"),
        access: db,
        dataDir: dataDir ? resolve(dataDir) : null,
        publicKeyPem,
        note: typeof args.note === "string" ? args.note : null,
        env: process.env,
        dumpBin: process.env.MARIADB_DUMP_BIN || "mariadb-dump",
        run: spawnRunner,
        now: started,
      });
      const bytes = manifest.files.reduce((sum, f) => sum + f.bytes, 0);
      const summary = `Backup made: ${manifest.files.length} files, ${bytes} bytes, ${Object.keys(manifest.database.tables).length} tables${manifest.encryption ? ", encrypted" : ", NOT encrypted"}.`;
      console.log(`${summary}\nFolder: ${folder}`);
      console.log(`Manifest fingerprint (SHA-256): ${manifestSha256}\nRecord it outside the backup (the escrow record); verify and restore check it with --manifest-sha256.`);
      if (!manifest.encryption) console.log("This backup is not encrypted: keep it only where the database itself may be kept, or pass --public-key.");
      await record(db, { job: "backup", started, status: "success", action: "system.backup", summary, details: { files: manifest.files.length, bytes, encrypted: Boolean(manifest.encryption), tables: Object.keys(manifest.database.tables).length } });
    } catch (error) {
      await record(db, { job: "backup", started, status: "failed", action: "system.backup", summary: `Backup failed: ${error instanceof BackupError ? error.message : cliDbError(error)}`, details: {} }).catch(() => undefined);
      throw error;
    }
  } else if (command === "verify") {
    const privateKeyPem = typeof args["private-key"] === "string" ? await readFile(resolve(args["private-key"]), "utf8") : null;
    const expected = fingerprint();
    const result = await verifyBackup(resolve(need("from")), privateKeyPem, { manifestSha256: expected });
    if (result.ok) {
      console.log(`Verified: ${expected ? "the manifest matches its recorded fingerprint; " : "(manifest fingerprint not checked: pass --manifest-sha256) "}${result.manifest.files.length} files match their SHA-256${result.manifest.encryption ? (privateKeyPem ? ", decrypt and match their contents" : " (encrypted: contents not checked without the private key)") : ""}; the dumps are complete.`);
    } else {
      console.error(`Problems:\n${result.problems.map((p) => `  - ${p}`).join("\n")}`);
      code = 4;
    }
  } else if (command === "restore") {
    const target = access();
    const expected = fingerprint();
    if (!expected && !local) throw new BackupError("Refused: outside APP_ENV=local a restore needs --manifest-sha256 (the fingerprint recorded when the backup was made).");
    const privateKeyPem = typeof args["private-key"] === "string" ? await readFile(resolve(args["private-key"]), "utf8") : null;
    const now = new Date();
    const result = await restoreBackup({
      from: resolve(need("from")),
      database: need("database"),
      dataDir: args["data-dir"] ? resolve(args["data-dir"]) : null,
      privateKeyPem,
      access: { host: target.host, port: target.port, socketPath: target.socketPath, user: target.user, password: target.password },
      clientBin: process.env.MARIADB_BIN || "mariadb",
      run: spawnRunner,
      now,
      newEpoch: ulid(now.getTime()),
      manifestSha256: expected,
    });
    console.log(`Restored into ${result.database}: ${result.tables} tables${result.filesRestored ? ", files restored" : ", no files"}; a new cache epoch is set.`);
    if (result.countDifferences.length) console.log(`Row counts that differ from the backup's (a busy source changes between the dump and its count):\n  ${result.countDifferences.join("\n  ")}`);
    console.log("Next (docs/admin/A8-BACKUP-RESTORE.md): restore the recovery-critical keys from escrow, issue new replaceable secrets, then start the app.");
  }
} catch (error) {
  if (error instanceof BackupError) {
    console.error(error.message);
    code = /^Refused/.test(error.message) ? 2 : 3;
  } else if (error?.code === "ENOENT" || error?.code === "EEXIST") {
    console.error(`File problem: ${error.code} (${error.path ?? "path"}).`);
    code = 3;
  } else if (error?.name === "ConfigError") {
    console.error(error.message);
    code = 1;
  } else {
    console.error(cliDbError(error));
    code = 3;
  }
}
process.exit(code);
