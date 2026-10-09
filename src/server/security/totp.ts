/**
 * Time-based one-time passwords, RFC 6238 over RFC 4226 (HMAC-SHA1, 30-second steps, 6 digits), the profile every
 * authenticator app supports (A1-SECURITY-RBAC §3.6). Codes from one step either side of now are accepted, and a step
 * is never accepted twice for the same user (the caller stores the last accepted step).
 */
import { createHmac, randomBytes } from "node:crypto";

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 without padding (the form authenticator apps expect in otpauth URIs). */
export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 character.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new shared secret: 20 random bytes (160 bits, RFC 4226's recommendation). */
export const generateTotpSecret = () => randomBytes(20);

export const totpStep = (nowMs: number) => Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);

/** The code for one counter value (RFC 4226 §5.3, dynamic truncation). */
export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export const totpCode = (secret: Buffer, nowMs: number) => hotp(secret, totpStep(nowMs));

/** A code as typed: spaces and dashes are ignored; anything but six digits is rejected. */
export function normalizeTotpInput(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/**
 * The step a code belongs to (now ± TOTP_WINDOW), or null. A step at or below `lastUsedStep` is refused (replay). Every
 * candidate is compared, so the time taken does not reveal which one matched.
 */
export function verifyTotp(secret: Buffer, input: string, nowMs: number, lastUsedStep: number | null): number | null {
  const code = normalizeTotpInput(input);
  if (!code) return null;
  const current = totpStep(nowMs);
  let matched: number | null = null;
  for (let step = current - TOTP_WINDOW; step <= current + TOTP_WINDOW; step++) {
    const expected = hotp(secret, step);
    let diff = 0;
    for (let i = 0; i < TOTP_DIGITS; i++) diff |= expected.charCodeAt(i) ^ code.charCodeAt(i);
    if (diff === 0 && (lastUsedStep === null || step > lastUsedStep) && matched === null) matched = step;
  }
  return matched;
}

/** The otpauth URI that authenticator apps read from the QR code (Key Uri Format). */
export function otpauthUri(secret: Buffer, account: string, issuer = "RAWASY Admin"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: base32Encode(secret),
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString().replace(/\+/g, "%20")}`;
}
