/**
 * AES-256-GCM encryption of TOTP secrets with versioned keys (A1-SECURITY-RBAC §3.6, §12.2).
 *
 * Stored form: iv (12 bytes) | tag (16 bytes) | ciphertext, in `user_mfa.totp_secret_enc`, with the key's version in
 * `user_mfa.key_version`. New values always use the active key; reading uses the version the row names, so a rotation
 * can re-encrypt rows one by one. The associated data binds a value to its row (e.g. "user_mfa:<user id>"), so a
 * ciphertext copied into another user's row does not decrypt.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { KeyRing } from "../config/env.ts";

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** The key version a stored value needs is not configured (lost or retired too early): see the emergency 2FA reset. */
export class KeyUnavailableError extends Error {
  readonly version: number;
  constructor(version: number) {
    super(`Encryption key version ${version} is not configured.`);
    this.name = "KeyUnavailableError";
    this.version = version;
  }
}

/** The value does not decrypt with the key it names (tampered, wrong key material, or moved to another row). */
export class DecryptionError extends Error {
  constructor() {
    super("Stored secret could not be decrypted.");
    this.name = "DecryptionError";
  }
}

export function encryptSecret(ring: KeyRing, plaintext: Buffer, associatedData: string): { blob: Buffer; version: number } {
  const key = ring.keys.get(ring.activeVersion);
  if (!key) throw new KeyUnavailableError(ring.activeVersion);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { blob: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]), version: ring.activeVersion };
}

export function decryptSecret(ring: KeyRing, blob: Buffer, version: number, associatedData: string): Buffer {
  const key = ring.keys.get(version);
  if (!key) throw new KeyUnavailableError(version);
  if (blob.length <= IV_BYTES + TAG_BYTES) throw new DecryptionError();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, blob.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
    decipher.setAuthTag(blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(blob.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
  } catch {
    throw new DecryptionError();
  }
}
