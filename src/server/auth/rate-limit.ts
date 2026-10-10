/**
 * Limits shared by every app process, kept in `rate_limits` (A1-SECURITY-RBAC §3.4–§3.5): fixed-window counters, and
 * the credential-check slots of A2 Correction 1. A key is hashed (SHA-256) before it is stored, so the table holds no
 * email address or IP in clear.
 */
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rateLimits } from "../db/schema.ts";
import { sha256 } from "../security/ids.ts";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** A2 limits (brief §16; A1 §3.4–§3.5; the credential checks from A2 Correction 1). */
export const LIMITS = {
  loginPerIp: { limit: 30, windowMs: 15 * MINUTE },
  resetPerAccount: { limit: 3, windowMs: HOUR },
  resetPerIp: { limit: 10, windowMs: HOUR },
  /** Password checks (Argon2) per normalised email, known or not: the account policy's 5 in 15 minutes. */
  credentialChecks: { limit: 5, windowMs: 15 * MINUTE },
} as const;

export interface RateResult {
  allowed: boolean;
  count: number;
}

/** Counts one event for `key` in the current window and says whether the limit still allows it. */
export async function hitRateLimit(db: Db, key: string, rule: { limit: number; windowMs: number }, now: Date): Promise<RateResult> {
  const start = new Date(Math.floor(now.getTime() / rule.windowMs) * rule.windowMs);
  const keyHash = sha256(key);
  await db
    .insert(rateLimits)
    .values({ keyHash, windowStart: start, count: 1, expiresAt: new Date(start.getTime() + rule.windowMs) })
    .onDuplicateKeyUpdate({ set: { count: sql`${rateLimits.count} + 1` } });
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(and(eq(rateLimits.keyHash, keyHash), eq(rateLimits.windowStart, start)));
  const count = row?.count ?? 1;
  return { allowed: count <= rule.limit, count };
}

// ---------------------------------------------------------------------------------------------------------------------
// Credential checks before any password hash (A2 Correction 1)

/** The limiter's identity for an email (registered or not): only its SHA-256, never the address. */
export const credentialKey = (normalizedEmail: string) => `login:credential:${sha256(normalizedEmail).toString("hex")}`;

/** Every slot row has this window start; slots are told apart by key. */
const SLOT_ROW = new Date(0);

const slotHashes = (normalizedEmail: string) => {
  const key = credentialKey(normalizedEmail);
  return Array.from({ length: LIMITS.credentialChecks.limit }, (_, slot) => sha256(`${key}#${slot}`));
};

/**
 * Reserves one of the 5 credential-check slots of an email before its password is hashed — before the account is even
 * looked up, so a known and an unknown email are limited alike. A slot is a `rate_limits` row that holds when it frees
 * again (`expires_at`, 15 minutes after it was taken); taking one is a single UPDATE that matches only a free slot, so
 * concurrent requests, in any number of processes, never share one: at most 5 password checks for an email start in
 * any 15 minutes, however many arrive at once. False when all 5 are taken — the caller must not hash anything then.
 */
export async function reserveCredentialCheck(db: Db, normalizedEmail: string, now: Date): Promise<boolean> {
  const slots = slotHashes(normalizedEmail);
  // The slot rows exist from the first attempt on (as free slots); IGNORE leaves existing ones alone. Inserted in key
  // order, the order in which clearCredentialChecks' UPDATE locks the same rows, so the two never wait for each other in
  // a cycle (A2 Correction 1, third review).
  await db
    .insert(rateLimits)
    .ignore()
    .values([...slots].sort(Buffer.compare).map((keyHash) => ({ keyHash, windowStart: SLOT_ROW, count: 0, expiresAt: SLOT_ROW })));
  const freeAgainAt = new Date(now.getTime() + LIMITS.credentialChecks.windowMs);
  for (const keyHash of slots) {
    const [taken] = await db
      .update(rateLimits)
      .set({ count: sql`${rateLimits.count} + 1`, expiresAt: freeAgainAt })
      .where(and(eq(rateLimits.keyHash, keyHash), eq(rateLimits.windowStart, SLOT_ROW), lte(rateLimits.expiresAt, now)));
    if (taken.affectedRows === 1) return true;
  }
  return false;
}

/**
 * Frees every credential-check slot of an email: a successful password check, a password reset, an unlock. The rows are
 * freed, never deleted, so a reservation running at the same moment (its rows inserted, its claim not yet made) still
 * finds them and takes a slot instead of being refused.
 */
export async function clearCredentialChecks(db: Db, normalizedEmail: string): Promise<void> {
  await db
    .update(rateLimits)
    .set({ expiresAt: SLOT_ROW })
    .where(and(inArray(rateLimits.keyHash, slotHashes(normalizedEmail)), eq(rateLimits.windowStart, SLOT_ROW)));
}
