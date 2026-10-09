/**
 * Single-use emailed or printed tokens in `auth_tokens` (A1-SECURITY-RBAC §3.1, §3.5, §3.9): 32 random bytes,
 * base64url; only their SHA-256 is stored. Invitation 72 hours, password reset 30 minutes, Owner setup 30 minutes.
 * Issuing a new token of a purpose for a user retires that user's unused ones of the same purpose.
 */
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { authTokens, users, TOKEN_PURPOSES } from "../db/schema.ts";
import { looksLikeToken, randomToken, sha256, ulid } from "../security/ids.ts";
import type { UserRow } from "./accounts.ts";

export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];
export type TokenRow = typeof authTokens.$inferSelect;

export const TOKEN_LIFETIME_MS: Record<TokenPurpose, number> = {
  invitation: 72 * 60 * 60 * 1000,
  password_reset: 30 * 60 * 1000,
  owner_setup: 30 * 60 * 1000,
  email_change: 30 * 60 * 1000,
};

export interface IssueTokenInput {
  userId: string;
  purpose: TokenPurpose;
  now: Date;
  createdBy?: string | null;
  createdIp?: string | null;
}

export async function issueToken(db: Db, input: IssueTokenInput): Promise<{ token: string; row: TokenRow }> {
  await retireTokens(db, input.userId, [input.purpose], input.now);
  const token = randomToken();
  const row: TokenRow = {
    id: ulid(input.now.getTime()),
    userId: input.userId,
    purpose: input.purpose,
    tokenHash: sha256(token),
    newEmail: null,
    expiresAt: new Date(input.now.getTime() + TOKEN_LIFETIME_MS[input.purpose]),
    usedAt: null,
    createdAt: input.now,
    createdBy: input.createdBy ?? null,
    createdIp: input.createdIp ? input.createdIp.slice(0, 45) : null,
  };
  await db.insert(authTokens).values(row);
  return { token, row };
}

/** Marks a user's unused tokens of the given purposes as used (so old links stop working). */
export async function retireTokens(db: Db, userId: string, purposes: TokenPurpose[], now: Date): Promise<void> {
  await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.userId, userId), inArray(authTokens.purpose, purposes), isNull(authTokens.usedAt)));
}

/** A usable token (right purpose, unused, unexpired) and its user, without consuming it. */
export async function findUsableToken(
  db: Db,
  token: unknown,
  purposes: TokenPurpose[],
  now: Date,
  options: { lock?: boolean } = {},
): Promise<{ token: TokenRow; user: UserRow } | null> {
  if (!looksLikeToken(token)) return null;
  const query = db
    .select()
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(
      and(
        eq(authTokens.tokenHash, sha256(token)),
        inArray(authTokens.purpose, purposes),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  const [row] = options.lock ? await query.for("update") : await query;
  return row ? { token: row.auth_tokens, user: row.users } : null;
}

/** Consumes a token; false when another request used it first. */
export async function consumeToken(db: Db, tokenId: string, now: Date): Promise<boolean> {
  const [result] = await db.update(authTokens).set({ usedAt: now }).where(and(eq(authTokens.id, tokenId), isNull(authTokens.usedAt)));
  return result.affectedRows === 1;
}
