/**
 * The form's signed timing token (A1-SECURITY-RBAC §3: "Origin check, honeypot, signed timing token and rate limits"):
 * issued when the form is drawn, sent back with the submission. It proves the form came from this site, that at least
 * the form's minimum fill time passed (a script that posts at once is refused) and that it is not older than two hours.
 * Each token is used once: its nonce is claimed when a submission is stored (`claimToken`), so a replay is refused.
 *
 * The key is derived from the active AUTH_ENCRYPTION_KEY with HKDF (its own purpose label), so no new secret exists; a
 * key rotation invalidates outstanding tokens (a visitor reloads the form). Pure functions but `claimToken`.
 */
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { sha256 } from "../security/ids.ts";
import { SUBMISSION_LIMITS } from "../forms/registry.ts";

const VERSION = "v1";
const PURPOSE = "rawasy:enquiry-form-token:v1";

/** The token key from the active encryption key (never the key itself). */
export function tokenKeyFrom(activeKey: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", activeKey, Buffer.alloc(0), PURPOSE, 32));
}

const mac = (key: Buffer, payload: string) => createHmac("sha256", key).update(payload).digest("base64url");

/** A new token for a form, issued now. */
export function issueToken(key: Buffer, formKey: string, now: Date, nonce: Buffer = randomBytes(16)): string {
  const payload = `${VERSION}.${now.getTime().toString(36)}.${nonce.toString("base64url")}.${formKey}`;
  return `${payload}.${mac(key, payload)}`;
}

export type TokenCheck = { ok: true; nonce: string; issuedAt: Date } | { ok: false; reason: "token" | "too_fast" | "expired" };

/** Checks a token for a form: its signature, its form, its age (at least `minFillSeconds`, at most two hours). */
export function verifyToken(key: Buffer, token: unknown, formKey: string, now: Date, minFillSeconds: number): TokenCheck {
  if (typeof token !== "string" || token.length > 200) return { ok: false, reason: "token" };
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION || parts[3] !== formKey) return { ok: false, reason: "token" };
  const payload = parts.slice(0, 4).join(".");
  const expected = Buffer.from(mac(key, payload));
  const given = Buffer.from(parts[4]);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "token" };
  if (!/^[0-9a-z]{1,12}$/.test(parts[1]) || !/^[A-Za-z0-9_-]{22}$/.test(parts[2])) return { ok: false, reason: "token" };
  const issuedAt = new Date(parseInt(parts[1], 36));
  const age = now.getTime() - issuedAt.getTime();
  if (!Number.isFinite(age) || age < -60_000) return { ok: false, reason: "token" };
  if (age < minFillSeconds * 1000) return { ok: false, reason: "too_fast" };
  if (age > SUBMISSION_LIMITS.tokenMaxAgeMs) return { ok: false, reason: "expired" };
  return { ok: true, nonce: parts[2], issuedAt };
}

/**
 * Claims a token's nonce, once: a row in A2's shared `rate_limits` keyed by the nonce's hash and the token's issue time
 * (its primary key), kept until the token expires. False when it was already used.
 */
export async function claimToken(db: Db, nonce: string, issuedAt: Date): Promise<boolean> {
  const keyHash = sha256(`enquiry:token:${nonce}`);
  const expiresAt = new Date(issuedAt.getTime() + SUBMISSION_LIMITS.tokenMaxAgeMs);
  const result = await db.execute(sql`INSERT IGNORE INTO rate_limits (key_hash, window_start, count, expires_at) VALUES (${keyHash}, ${issuedAt}, 1, ${expiresAt})`);
  const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: number };
  return (header?.affectedRows ?? 0) === 1;
}
