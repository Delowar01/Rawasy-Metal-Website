/**
 * Backup encryption (A8.6, A1-SECURITY-RBAC §12.1 "Backup decryption key"): a backup is encrypted to the Owner's public
 * key, so the server that makes it never holds what opens it. Each backup gets a fresh 256-bit data key; every file is
 * encrypted with AES-256-GCM under it (a random 96-bit IV per file, the 16-byte tag at the end); the data key is
 * wrapped with RSA-OAEP (SHA-256) for the public key and stored in the manifest with the key's fingerprint. Only the
 * matching private key — kept offline by the Owner, never on the server, in Git, in the database or in a backup —
 * unwraps it. Streams: files of any size, constant memory.
 *
 * Framework-free (the CLI and the tests import it).
 */
import { constants, createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

export const ENCRYPTED_MAGIC = Buffer.from("RWSYBK1\n", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** SHA-256 of a file (hex), streamed. */
export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), new Transform({ transform(chunk, _enc, done) { hash.update(chunk); done(); } }));
  return hash.digest("hex");
}

/** The fingerprint of a public key: SHA-256 of its DER (SPKI) form, hex. */
export function keyFingerprint(publicPem: string): string {
  return createHash("sha256").update(createPublicKey(publicPem).export({ type: "spki", format: "der" })).digest("hex");
}

/** A new RSA key pair for backup encryption (4096 bits). The private key goes into escrow, never onto the server. */
export function generateBackupKeyPair(): { publicPem: string; privatePem: string; fingerprint: string } {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 4096 });
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return { publicPem, privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), fingerprint: keyFingerprint(publicPem) };
}

export function wrapKey(publicPem: string, dataKey: Buffer): string {
  return publicEncrypt({ key: createPublicKey(publicPem), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, dataKey).toString("base64");
}

export function unwrapKey(privatePem: string, wrapped: string): Buffer {
  const key = privateDecrypt({ key: createPrivateKey(privatePem), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(wrapped, "base64"));
  if (key.length !== 32) throw new Error("The unwrapped backup key has the wrong length.");
  return key;
}

export const newDataKey = () => randomBytes(32);

/** Encrypts `src` into `dst`: magic | iv | ciphertext | tag. */
export async function encryptFile(src: string, dst: string, dataKey: Buffer): Promise<void> {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const out = createWriteStream(dst, { mode: 0o600 });
  out.write(Buffer.concat([ENCRYPTED_MAGIC, iv]));
  await pipeline(createReadStream(src), cipher, out, { end: false });
  await new Promise<void>((resolve, reject) => out.end(cipher.getAuthTag(), () => resolve()).on("error", reject));
}

/** Decrypts a file written by `encryptFile` (the tag is checked at the end: a changed byte fails the whole file). */
export async function decryptFile(src: string, dst: string, dataKey: Buffer): Promise<void> {
  const size = (await stat(src)).size;
  const head = ENCRYPTED_MAGIC.length + IV_BYTES;
  if (size < head + TAG_BYTES) throw new Error("The encrypted file is too short.");
  const handle = await open(src, "r");
  try {
    const header = Buffer.alloc(head);
    await handle.read(header, 0, head, 0);
    if (!header.subarray(0, ENCRYPTED_MAGIC.length).equals(ENCRYPTED_MAGIC)) throw new Error("Not a RAWASY encrypted backup file.");
    const tag = Buffer.alloc(TAG_BYTES);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", dataKey, header.subarray(ENCRYPTED_MAGIC.length));
    decipher.setAuthTag(tag);
    if (size - TAG_BYTES - head === 0) {
      decipher.final();
      await handle.close();
      await (await open(dst, "w", 0o600)).close();
      return;
    }
    await pipeline(createReadStream(src, { start: head, end: size - TAG_BYTES - 1 }), decipher, createWriteStream(dst, { mode: 0o600 }));
  } finally {
    await handle.close().catch(() => undefined);
  }
}
