/**
 * Fixed-window counters in `rate_limits`, shared by every app process (A1-SECURITY-RBAC §3.4–§3.5). A key is hashed
 * (SHA-256) before it is stored, so the table holds no email address or IP in clear.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rateLimits } from "../db/schema.ts";
import { sha256 } from "../security/ids.ts";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** A2 limits (brief §16; A1 §3.4–§3.5). */
export const LIMITS = {
  loginPerIp: { limit: 30, windowMs: 15 * MINUTE },
  resetPerAccount: { limit: 3, windowMs: HOUR },
  resetPerIp: { limit: 10, windowMs: HOUR },
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
