/**
 * Recovery codes (A1-SECURITY-RBAC §3.6; strengthened in A2 Correction 1). Ten per user, each single use, shown once,
 * stored only as a SHA-256 hash (never the code itself, never logged).
 *
 * Each code is 20 characters of Crockford base32 — 5 random bits a character, 100 random bits a code (it was 10
 * characters, 50 bits, before the correction) — shown as xxxxx-xxxxx-xxxxx-xxxxx. A typed code ignores case, spaces and
 * dashes, and reads i and l as 1 and o as 0 (Crockford's own reading), so the alphabet has no letters that could be
 * mistaken for others.
 */
import { randomInt } from "node:crypto";
import { sha256 } from "./ids.ts";

export const RECOVERY_CODE_COUNT = 10;
/** Crockford base32, lower case: digits and the letters without i, l, o and u. */
export const RECOVERY_CODE_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
export const RECOVERY_CODE_LENGTH = 20;
/** Random bits per code: log2(32) × 20 = 100. */
export const RECOVERY_CODE_BITS = Math.log2(RECOVERY_CODE_ALPHABET.length) * RECOVERY_CODE_LENGTH;

const GROUP = 5;
const NORMALIZED = new RegExp(`^[${RECOVERY_CODE_ALPHABET}]{${RECOVERY_CODE_LENGTH}}$`);

/** One new code, every character drawn uniformly (crypto `randomInt`), formatted xxxxx-xxxxx-xxxxx-xxxxx. */
export function generateRecoveryCode(): string {
  let code = "";
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) code += RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += GROUP) groups.push(code.slice(i, i + GROUP));
  return groups.join("-");
}

export const generateRecoveryCodes = (): string[] => Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);

/** A recovery code as typed, normalised (case, spaces and dashes ignored; i/l read as 1 and o as 0); null if it is not one. */
export function normalizeRecoveryCode(input: string): string | null {
  const value = String(input).toLowerCase().replace(/[\s-]/g, "").replace(/[il]/g, "1").replace(/o/g, "0");
  return NORMALIZED.test(value) ? value : null;
}

/** What is stored for a code: the SHA-256 of its normalised form (with a fixed prefix). */
export const recoveryCodeHash = (normalized: string) => sha256(`rawasy-recovery:${normalized}`);
