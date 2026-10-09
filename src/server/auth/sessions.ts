/**
 * Database sessions (A1-SECURITY-RBAC §3.3). The cookie holds 32 random bytes; the table holds only their SHA-256.
 *
 * Lifetimes (A2 locked defaults): idle 2 hours, absolute 12 hours, re-authentication window 10 minutes, no "remember
 * me". A session waiting for the second factor lives 10 minutes. `last_seen_at` is written at most once a minute.
 * Rotation (a new token, the old row revoked as `rotated` and linked to the new one) happens on sign-in, after the
 * second factor, after re-authentication, on a password change and at least every 30 minutes of activity; a rotated
 * token is still honoured for 30 seconds (requests already in flight when the new cookie was set), resolving to its
 * replacement — never beyond the replacement's own limits.
 */
import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { sessions, users, SESSION_REVOKE_REASONS } from "../db/schema.ts";
import { looksLikeToken, randomToken, sha256, ulid } from "../security/ids.ts";
import type { UserRow } from "./accounts.ts";

export type SessionRow = typeof sessions.$inferSelect;
export type RevokeReason = (typeof SESSION_REVOKE_REASONS)[number];

export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const STEP_UP_MS = 10 * 60 * 1000;
export const PENDING_SESSION_MS = 10 * 60 * 1000;
export const TOUCH_INTERVAL_MS = 60 * 1000;
export const ROTATE_AFTER_MS = 30 * 60 * 1000;
export const ROTATION_GRACE_MS = 30 * 1000;

export const SESSION_COOKIE = "__Host-rawasy_admin";

const at = (d: Date, ms: number) => new Date(d.getTime() + ms);
const earliest = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b);
const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

export interface CreateSessionInput extends ClientInfo {
  userId: string;
  now: Date;
  /** The second factor was verified for this session. */
  mfaVerified: boolean;
  /** Waiting for the second factor: 10 minutes, and only the verification page accepts it. */
  pending?: boolean;
}

export async function createSession(db: Db, input: CreateSessionInput): Promise<{ token: string; session: SessionRow }> {
  const token = randomToken();
  const { now } = input;
  const absolute = at(now, input.pending ? PENDING_SESSION_MS : SESSION_ABSOLUTE_MS);
  const session: SessionRow = {
    id: ulid(now.getTime()),
    userId: input.userId,
    tokenHash: sha256(token),
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt: earliest(at(now, input.pending ? PENDING_SESSION_MS : SESSION_IDLE_MS), absolute),
    absoluteExpiresAt: absolute,
    reauthenticatedAt: now,
    mfaVerifiedAt: input.mfaVerified ? now : null,
    ip: clip(input.ip, 45),
    userAgent: clip(input.userAgent, 255),
    revokedAt: null,
    revokedReason: null,
    replacedById: null,
  };
  await db.insert(sessions).values(session);
  return { token, session };
}

const isLive = (session: SessionRow, user: UserRow, now: Date) =>
  !session.revokedAt &&
  session.idleExpiresAt.getTime() > now.getTime() &&
  session.absoluteExpiresAt.getTime() > now.getTime() &&
  user.status === "active" &&
  !user.deletedAt;

async function sessionWithUser(db: Db, where: ReturnType<typeof eq>) {
  const [row] = await db.select().from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(where).limit(1);
  return row ? { session: row.sessions, user: row.users } : null;
}

/**
 * The live session a cookie token names, with its user — or null (unknown, revoked, expired, user not active).
 * A token rotated less than 30 seconds ago resolves to its replacement.
 */
export async function findSessionByToken(db: Db, token: unknown, now: Date): Promise<{ session: SessionRow; user: UserRow } | null> {
  if (!looksLikeToken(token)) return null;
  const found = await sessionWithUser(db, eq(sessions.tokenHash, sha256(token)));
  if (!found) return null;
  if (found.session.revokedAt) {
    const { revokedAt, revokedReason, replacedById } = found.session;
    if (revokedReason !== "rotated" || !replacedById || now.getTime() - revokedAt.getTime() > ROTATION_GRACE_MS) return null;
    const next = await sessionWithUser(db, eq(sessions.id, replacedById));
    return next && isLive(next.session, next.user, now) ? next : null;
  }
  return isLive(found.session, found.user, now) ? found : null;
}

/** Records activity at most once a minute: moves the idle limit (never past the absolute one). */
export async function touchSession(db: Db, session: SessionRow, now: Date): Promise<SessionRow> {
  if (now.getTime() - session.lastSeenAt.getTime() < TOUCH_INTERVAL_MS) return session;
  const isPending = session.absoluteExpiresAt.getTime() - session.createdAt.getTime() <= PENDING_SESSION_MS;
  const idleExpiresAt = isPending ? session.idleExpiresAt : earliest(at(now, SESSION_IDLE_MS), session.absoluteExpiresAt);
  await db.update(sessions).set({ lastSeenAt: now, idleExpiresAt }).where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt)));
  return { ...session, lastSeenAt: now, idleExpiresAt };
}

export const isRotationDue = (session: SessionRow, now: Date) => now.getTime() - session.createdAt.getTime() >= ROTATE_AFTER_MS;
export const isRecentlyAuthenticated = (session: SessionRow, now: Date) =>
  now.getTime() - session.reauthenticatedAt.getTime() <= STEP_UP_MS;

export interface RotateOptions extends ClientInfo {
  now: Date;
  /** Password (and code) just confirmed: restart the re-authentication window. */
  reauthenticated?: boolean;
  /** Second factor just verified. */
  mfaVerified?: boolean;
  /** Second factor removed (disable or replace): the new session has none. */
  mfaCleared?: boolean;
  /** A completed sign-in (after the second factor): a fresh 12-hour session instead of the pending one's limits. */
  fullLifetime?: boolean;
}

/** Replaces a session by a new one (new token). Run inside a transaction. */
export async function rotateSession(db: Db, old: SessionRow, options: RotateOptions): Promise<{ token: string; session: SessionRow }> {
  const { now } = options;
  const token = randomToken();
  const absolute = options.fullLifetime ? at(now, SESSION_ABSOLUTE_MS) : old.absoluteExpiresAt;
  const session: SessionRow = {
    id: ulid(now.getTime()),
    userId: old.userId,
    tokenHash: sha256(token),
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt: earliest(at(now, SESSION_IDLE_MS), absolute),
    absoluteExpiresAt: absolute,
    reauthenticatedAt: options.reauthenticated ? now : old.reauthenticatedAt,
    mfaVerifiedAt: options.mfaCleared ? null : options.mfaVerified ? now : old.mfaVerifiedAt,
    ip: clip(options.ip ?? old.ip, 45),
    userAgent: clip(options.userAgent ?? old.userAgent, 255),
    revokedAt: null,
    revokedReason: null,
    replacedById: null,
  };
  await db.insert(sessions).values(session);
  await db
    .update(sessions)
    .set({ revokedAt: now, revokedReason: "rotated", replacedById: session.id })
    .where(and(eq(sessions.id, old.id), isNull(sessions.revokedAt)));
  return { token, session };
}

export async function revokeSession(db: Db, sessionId: string, reason: RevokeReason, now: Date): Promise<boolean> {
  const [result] = await db
    .update(sessions)
    .set({ revokedAt: now, revokedReason: reason })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  return result.affectedRows > 0;
}

/** Revokes every session of a user (but one, when given). Returns how many were live. */
export async function revokeUserSessions(db: Db, userId: string, reason: RevokeReason, now: Date, exceptSessionId?: string): Promise<number> {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.absoluteExpiresAt, now)];
  if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
  const [result] = await db.update(sessions).set({ revokedAt: now, revokedReason: reason }).where(and(...conditions));
  return result.affectedRows;
}

/** A user's live sessions, most recently used first. */
export async function listLiveSessions(db: Db, userId: string, now: Date): Promise<SessionRow[]> {
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.idleExpiresAt, now),
        gt(sessions.absoluteExpiresAt, now),
      ),
    )
    .orderBy(desc(sessions.lastSeenAt), asc(sessions.id));
}

export async function countLiveSessions(db: Db, userId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.idleExpiresAt, now), gt(sessions.absoluteExpiresAt, now)));
  return Number(row?.n ?? 0);
}
