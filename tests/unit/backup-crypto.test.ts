/**
 * A8.6 — backup encryption: a file encrypted to a public key opens only with its private key; a changed byte, a cut-off
 * file or another key fails the whole file; the manifest's fingerprint names the key; nothing of the plaintext is in the
 * encrypted file. Synthetic data only; temporary folders.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { decryptFile, encryptFile, generateBackupKeyPair, keyFingerprint, newDataKey, sha256File, unwrapKey, wrapKey } from "../../src/server/backup/crypto.ts";
import { repositoryOf } from "../../src/server/backup/backup.ts";

let dir: string;
const pair = generateBackupKeyPair();
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "rawasy-backup-test-"));
});
after(async () => rm(dir, { recursive: true, force: true }));

describe("backup encryption", () => {
  test("round trip, any size; the encrypted file holds no plaintext", async () => {
    for (const size of [0, 1, 4096, 1_000_003]) {
      const plain = join(dir, `plain-${size}`);
      const enc = join(dir, `enc-${size}`);
      const back = join(dir, `back-${size}`);
      const content = Buffer.concat([Buffer.from("Test Synthetic Backup Marker "), randomBytes(size)]).subarray(0, size);
      await writeFile(plain, content);
      const key = newDataKey();
      await encryptFile(plain, enc, key);
      await decryptFile(enc, back, key);
      assert.equal(await sha256File(back), await sha256File(plain), `size ${size}`);
      if (size > 40) assert.ok(!(await readFile(enc)).includes(Buffer.from("Synthetic Backup Marker")));
    }
  });

  test("a changed byte or a cut-off file fails; another key fails", async () => {
    const plain = join(dir, "p");
    const enc = join(dir, "e");
    await writeFile(plain, "Test backup content that must stay intact.");
    const key = newDataKey();
    await encryptFile(plain, enc, key);
    const bytes = await readFile(enc);
    const changed = Buffer.from(bytes);
    changed[changed.length - 20] ^= 1;
    await writeFile(join(dir, "changed"), changed);
    await assert.rejects(decryptFile(join(dir, "changed"), join(dir, "out1"), key));
    await writeFile(join(dir, "cut"), bytes.subarray(0, bytes.length - 3));
    await assert.rejects(decryptFile(join(dir, "cut"), join(dir, "out2"), key));
    await assert.rejects(decryptFile(enc, join(dir, "out3"), newDataKey()));
  });

  test("the data key is wrapped for the public key; only its private key unwraps it", () => {
    const key = newDataKey();
    const wrapped = wrapKey(pair.publicPem, key);
    assert.ok(unwrapKey(pair.privatePem, wrapped).equals(key));
    const other = generateBackupKeyPair();
    assert.throws(() => unwrapKey(other.privatePem, wrapped));
    assert.equal(keyFingerprint(pair.publicPem), pair.fingerprint);
    assert.notEqual(other.fingerprint, pair.fingerprint);
    assert.ok(!wrapped.includes(key.toString("base64")));
  });

  test("backups and keys are refused inside a Git repository", () => {
    assert.ok(repositoryOf(join(import.meta.dirname, "x")), "this file is in the repository");
    assert.equal(repositoryOf(dir), null, "a temporary folder is not");
  });
});
