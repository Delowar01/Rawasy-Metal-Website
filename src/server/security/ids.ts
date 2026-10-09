/**
 * Identifiers and opaque tokens (A1-DATABASE-SCHEMA §3.2; A1-SECURITY-RBAC §3.3).
 *
 * - ULIDs for entity ids: 48-bit millisecond time + 80 random bits, Crockford base32, 26 characters, sortable by time.
 * - Tokens for cookies and emailed links: 32 random bytes, base64url. Only their SHA-256 is ever stored.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(now: number = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > 0xffffffffffff) throw new RangeError("ULID time out of range.");
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const random = randomBytes(10);
  let rand = "";
  // 80 bits = 16 base32 characters: read the bytes as one big number, 5 bits at a time.
  let value = BigInt(`0x${random.toString("hex")}`);
  for (let i = 0; i < 16; i++) {
    rand = CROCKFORD[Number(value & BigInt(31))] + rand;
    value >>= BigInt(5);
  }
  return time + rand;
}

export const isUlid = (value: unknown): value is string => typeof value === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);

/** A new random token (base64url, no padding). 32 bytes = 256 bits. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string | Buffer): Buffer {
  return createHash("sha256").update(input).digest();
}

/** Constant-time comparison of two byte strings of possibly different length. */
export function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** A cookie or link token as received: base64url of 32 bytes (43 characters). Anything else is rejected before a lookup. */
export const looksLikeToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
