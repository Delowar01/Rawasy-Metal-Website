/**
 * A8 — the backup tools after the review (L6, L7): the archive's member list is read without extracting anything and a
 * member that is not a regular file or folder, has an absolute name or climbs out with `..` is refused (crafted tar
 * headers and GNU tar's own long names); backup, key and data folders are refused inside a repository (symbolic links
 * resolved), inside the application's folder and under public_html; the manifest's fingerprint is its bytes' SHA-256.
 * Temporary folders only.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { after, before, describe, test } from "node:test";
import { APP_ROOT, manifestFingerprint, placeProblem, tarMemberProblem, tarMembers } from "../../src/server/backup/backup.ts";

let dir: string;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "rawasy-backup-review-"));
});
after(async () => rm(dir, { recursive: true, force: true }));

/** One ustar header block (name ≤ 100 bytes), with its checksum. */
function header(name: string, type: string, size = 0, linkname = ""): Buffer {
  const block = Buffer.alloc(512);
  block.write(name, 0, 100, "utf8");
  block.write("0000644\0", 100, "ascii");
  block.write("0000000\0", 108, "ascii");
  block.write("0000000\0", 116, "ascii");
  block.write(`${size.toString(8).padStart(11, "0")}\0`, 124, "ascii");
  block.write("00000000000\0", 136, "ascii");
  block.write("        ", 148, "ascii");
  block.write(type, 156, "ascii");
  block.write(linkname, 157, 100, "utf8");
  block.write("ustar\u000000", 257, "ascii");
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
  return block;
}

const data = (text: string) => {
  const raw = Buffer.from(text);
  return Buffer.concat([raw, Buffer.alloc((512 - (raw.length % 512)) % 512)]);
};

async function archive(name: string, parts: Buffer[]): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, gzipSync(Buffer.concat([...parts, Buffer.alloc(1024)])));
  return path;
}

describe("the archive's members", () => {
  test("regular files and folders pass; links, devices, absolute names and '..' are refused", async () => {
    const path = await archive("crafted.tar.gz", [
      header("media/", "5"),
      header("media/a.webp", "0", 5),
      data("hello"),
      header("media/link", "2", 0, "/etc/passwd"),
      header("media/hard", "1", 0, "media/a.webp"),
      header("/etc/cron.d/x", "0", 0),
      header("media/../../outside.txt", "0", 3),
      data("bad"),
      header("dev", "3"),
    ]);
    const members = await tarMembers(path);
    assert.deepEqual(
      members.map((m) => [m.name, m.type]),
      [
        ["media/", "5"],
        ["media/a.webp", "0"],
        ["media/link", "2"],
        ["media/hard", "1"],
        ["/etc/cron.d/x", "0"],
        ["media/../../outside.txt", "0"],
        ["dev", "3"],
      ],
    );
    const problems = members.map(tarMemberProblem);
    assert.deepEqual(
      problems.map((p) => p !== null),
      [false, false, true, true, true, true, true],
    );
  });

  test("GNU tar's own archive with a long name (an 'L' record) and a pax path are read by their full names", async () => {
    const src = join(dir, "src");
    const long = join("media", "originals", "2026", "11", "x".repeat(60), "y".repeat(60));
    await mkdir(join(src, long), { recursive: true });
    await writeFile(join(src, long, "file.webp"), "x");
    const gnu = join(dir, "gnu.tar.gz");
    execFileSync("tar", ["-C", src, "-czf", gnu, "--format=gnu", "--", "media"]);
    assert.ok((await tarMembers(gnu)).some((m) => m.name === `${long}/file.webp` && m.type === "0"));
    const pax = join(dir, "pax.tar.gz");
    execFileSync("tar", ["-C", src, "-czf", pax, "--format=posix", "--", "media"]);
    const members = await tarMembers(pax);
    assert.ok(members.some((m) => m.name === `${long}/file.webp`), JSON.stringify(members.map((m) => m.name)));
    assert.ok(members.every((m) => tarMemberProblem(m) === null));
  });
});

describe("where backups, keys and data may go", () => {
  test("inside the repository, through a symbolic link into it, inside the application or under public_html: refused", async () => {
    assert.match(placeProblem(join(APP_ROOT, "backups", "x"), "backup") ?? "", /Git repository/);
    const link = join(dir, "into-repo");
    await symlink(resolve(import.meta.dirname, ".."), link);
    assert.match(placeProblem(join(link, "backup"), "backup") ?? "", /Git repository/, "the link is followed");
    const app = join(dir, "release");
    await mkdir(join(app, "public"), { recursive: true });
    assert.match(placeProblem(join(app, "public", "b"), "backup", app) ?? "", /inside the application's folder/);
    assert.match(placeProblem(join(dir, "home", "public_html", "b"), "backup", app) ?? "", /public_html/);
    assert.equal(placeProblem(join(dir, "rawasy-backups", "one"), "backup", app), null);
  });

  test("the manifest fingerprint is the SHA-256 of its bytes", () => {
    assert.equal(manifestFingerprint('{"a":1}\n'), createHash("sha256").update('{"a":1}\n').digest("hex"));
  });
});
