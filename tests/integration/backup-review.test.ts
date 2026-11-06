/**
 * A8 — backups after the review (L5, L6) on a real MariaDB test database, with a stand-in for mariadb-dump (the host
 * has no client programs; the real ones ran in the local restore drill) and the real tar: plain dumps and the archive are
 * staged in a private folder and never left behind, every backup file is 0600 in a 0700 folder, a run that fails leaves
 * nothing of itself; verify and restore refuse a manifest that doesn't match the fingerprint recorded when the backup was
 * made, and an archive with a member a restore must not write. Synthetic files only; temporary folders.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { createBackup, manifestFingerprint, restoreBackup, verifyBackup, type Runner } from "../../src/server/backup/backup.ts";
import { serverConfig, setupTestEnv, type TestEnv } from "./helpers.ts";

let env: TestEnv;
let dir: string;
before(async () => {
  env = await setupTestEnv("backup_review");
  dir = await mkdtemp(join(tmpdir(), "rawasy-backup-int-"));
});
after(async () => {
  await env?.close();
  await rm(dir, { recursive: true, force: true });
});

const access = () => {
  const { host, port, user, password } = serverConfig();
  return { host, port, user, password, database: env.database };
};

/** mariadb-dump stood in by a complete (empty) dump; tar is the real one. `failDump`: the second dump fails. */
function runner(options: { failDump?: boolean; tarSource?: string } = {}): Runner {
  let dumps = 0;
  return async (bin, args, io) => {
    if (bin === "fake-dump") {
      dumps += 1;
      if (options.failDump && dumps === 2) {
        io.stdout?.end();
        return { code: 2, stderr: "stand-in failure" };
      }
      io.stdout?.end("-- Test dump\n-- Dump completed on 2026-11-06\n");
      return { code: 0, stderr: "" };
    }
    if (bin === "tar" && options.tarSource && args.includes("-czf")) {
      const target = args[args.indexOf("-czf") + 1];
      await writeFile(target, await readFile(options.tarSource));
      return { code: 0, stderr: "" };
    }
    return new Promise((resolve) => {
      const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (c) => (stderr += c));
      child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    });
  };
}

async function dataDir(name: string) {
  const data = join(dir, name);
  await mkdir(join(data, "media", "originals"), { recursive: true });
  await mkdir(join(data, "enquiries"), { recursive: true });
  await mkdir(join(data, "tmp", "uploads"), { recursive: true });
  await writeFile(join(data, "media", "originals", "a.webp"), "synthetic image bytes");
  await writeFile(join(data, "enquiries", "c.pdf"), "synthetic private attachment");
  await writeFile(join(data, "tmp", "uploads", "part-1"), "never backed up");
  return data;
}

const backup = (out: string, data: string | null, run: Runner) =>
  createBackup({ out, access: access(), dataDir: data, publicKeyPem: null, note: "Test", env: { APP_ENV: "local" }, dumpBin: "fake-dump", run, now: env.deps.clock() });

describe("L5: plaintext staged privately, files 0600, nothing left after a failure", () => {
  test("a plain backup: 0700 folder, 0600 files, no staging folder left, the archive without tmp/", async () => {
    const out = join(dir, "plain");
    const data = await dataDir("data-plain");
    const { folder, manifest, manifestSha256 } = await backup(out, data, runner());
    assert.equal((await stat(folder)).mode & 0o777, 0o700);
    const names = (await readdir(folder)).sort();
    assert.deepEqual(names, ["config.json", "database-excluded-schema.sql.gz", "database.sql.gz", "files.tar.gz", "manifest.json"]);
    for (const name of names) assert.equal((await stat(join(folder, name))).mode & 0o777, 0o600, name);
    assert.equal(manifestSha256, manifestFingerprint(await readFile(join(folder, "manifest.json"))));
    const listed = execFileSync("tar", ["-tzf", join(folder, "files.tar.gz")], { encoding: "utf8" });
    assert.ok(listed.includes("enquiries/c.pdf") && !listed.includes("tmp/"), listed);
    assert.equal(manifest.files.length, 4);
  });

  test("an existing empty folder is tightened to 0700", async () => {
    const out = join(dir, "loose");
    await mkdir(out, { mode: 0o755 });
    const { folder } = await backup(out, null, runner());
    assert.equal((await stat(folder)).mode & 0o777, 0o700);
  });

  test("a dump that fails part-way leaves no plaintext, no staging folder and no manifest", async () => {
    const out = join(dir, "failed");
    const data = await dataDir("data-failed");
    await assert.rejects(backup(out, data, runner({ failDump: true })), /mariadb-dump failed/);
    assert.deepEqual(await readdir(out), []);
  });
});

describe("L6: the manifest's recorded fingerprint, and the archive's members, are checked", () => {
  test("verify passes with the recorded fingerprint and refuses a replaced manifest", async () => {
    const { folder, manifestSha256 } = await backup(join(dir, "printed"), null, runner());
    assert.equal((await verifyBackup(folder, null, { manifestSha256 })).ok, true);
    const forged = JSON.parse(await readFile(join(folder, "manifest.json"), "utf8"));
    forged.note = "Test forged";
    await writeFile(join(folder, "manifest.json"), `${JSON.stringify(forged, null, 2)}\n`);
    assert.equal((await verifyBackup(folder, null)).ok, true, "without the fingerprint the forged manifest still verifies — hence the record");
    const checked = await verifyBackup(folder, null, { manifestSha256 });
    assert.equal(checked.ok, false);
    assert.match(checked.problems.join(" "), /does not match the fingerprint/);
  });

  test("an archive with a link or a '..' member fails verification, and a restore refuses it before touching anything", async () => {
    const src = join(dir, "evil-src");
    await mkdir(join(src, "media"), { recursive: true });
    await writeFile(join(src, "media", "ok.webp"), "x");
    await symlink("/etc/passwd", join(src, "media", "link"));
    const evil = join(dir, "evil.tar.gz");
    execFileSync("tar", ["-C", src, "-czf", evil, "--", "media"]);
    const { folder, manifestSha256 } = await backup(join(dir, "evil"), await dataDir("data-evil"), runner({ tarSource: evil }));
    const checked = await verifyBackup(folder, null, { manifestSha256 });
    assert.equal(checked.ok, false);
    assert.match(checked.problems.join(" "), /media\/link is not a regular file or folder/);
    const target = join(dir, "restored-evil");
    await assert.rejects(
      restoreBackup({ from: folder, database: "rawasy_never_created_x", dataDir: target, privateKeyPem: null, access: access(), clientBin: "mariadb", run: runner(), now: env.deps.clock(), newEpoch: "01KA0000000000000000000000", manifestSha256 }),
      /did not verify/,
    );
    await assert.rejects(stat(target), "nothing was written");
  });
});
