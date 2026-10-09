/**
 * Reading accounts: users, their roles and second factor (A1-SECURITY-RBAC §3.1). Writes live with the operation that
 * needs them (sign-in, invitations, user management), each in its own transaction.
 */
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { userMfa, userRoles, users } from "../db/schema.ts";
import { permissionsOf, rankOf, requiresMfa } from "../policy/registry.ts";

export type UserRow = typeof users.$inferSelect;

/** Login identifier: trimmed, Unicode-normalized, lower-cased (A1 §3.1). */
export const normalizeEmail = (email: string) => email.normalize("NFKC").trim().toLowerCase();

/** A deliberately loose check (one @, a dot in the domain, no spaces, ≤ 254 characters). */
export const isPlausibleEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.emailNormalized, normalizeEmail(email)), isNull(users.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function findUserById(db: Db, id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt))).limit(1);
  return row ?? null;
}

export async function rolesOf(db: Db, userId: string): Promise<string[]> {
  const rows = await db.select({ key: userRoles.roleKey }).from(userRoles).where(eq(userRoles.userId, userId)).orderBy(asc(userRoles.roleKey));
  return rows.map((r) => r.key);
}

export async function rolesOfMany(db: Db, userIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(userIds.map((id) => [id, []]));
  if (userIds.length === 0) return out;
  const rows = await db
    .select({ userId: userRoles.userId, key: userRoles.roleKey })
    .from(userRoles)
    .where(inArray(userRoles.userId, userIds))
    .orderBy(asc(userRoles.roleKey));
  for (const row of rows) out.get(row.userId)?.push(row.key);
  return out;
}

export interface MfaState {
  /** A confirmed authenticator is set up. */
  enrolled: boolean;
  /** The user's roles require two-factor authentication (Owner, Admin). */
  required: boolean;
}

export async function mfaStateOf(db: Db, userId: string, roles: readonly string[]): Promise<MfaState> {
  const [row] = await db.select({ confirmedAt: userMfa.confirmedAt }).from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
  return { enrolled: Boolean(row?.confirmedAt), required: requiresMfa(roles) };
}

export interface Principal {
  user: UserRow;
  roles: string[];
  permissions: Set<string>;
  rank: number;
}

export async function principalOf(db: Db, user: UserRow): Promise<Principal> {
  const roles = await rolesOf(db, user.id);
  return { user, roles, permissions: permissionsOf(roles), rank: rankOf(roles) };
}

/**
 * Active Owners (status active, not deleted), locked FOR UPDATE when inside a transaction that is about to remove one:
 * concurrent attempts then wait for each other and the second sees the first's change (A1 §3.1, last-Owner rule).
 */
export async function activeOwnerIds(db: Db, options: { lock?: boolean } = {}): Promise<string[]> {
  const query = db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.roleKey, "owner")))
    .where(and(eq(users.status, "active"), isNull(users.deletedAt)));
  const rows = options.lock ? await query.for("update") : await query;
  return rows.map((r) => r.id);
}

export async function countUsersByStatus(db: Db): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: users.status, n: sql<number>`COUNT(*)` })
    .from(users)
    .where(isNull(users.deletedAt))
    .groupBy(users.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}
