/**
 * Integration-test harness: a real local MariaDB (never a hosted one), one fresh database per test file, the reviewed
 * migrations applied by the same runner as `scripts/db-migrate.mjs`, a movable clock, a mail sink in a temporary folder
 * and disposable encryption keys generated for the run (never written to disk or committed).
 *
 * Connection: TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USER, TEST_DB_PASSWORD (a local account allowed to create and drop
 * databases named rawasy_t_*). Without them the tests fail — they never pass without a database.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createConnection, type Pool } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { createAuthDeps, type AuthDeps } from "../../src/server/auth/deps.ts";
import { createSession } from "../../src/server/auth/sessions.ts";
import type { KeyRing } from "../../src/server/config/env.ts";
import { dbFor } from "../../src/server/db/client.ts";
import { readMigrations, runMigrations } from "../../src/server/db/migrate.ts";
import { CONNECTION_SETUP, createAppPool } from "../../src/server/db/pool.ts";
import { userMfa, userRoles, users } from "../../src/server/db/schema.ts";
import { sinkMailer, disabledMailer } from "../../src/server/mail/mailer.ts";
import { encryptSecret } from "../../src/server/security/encryption.ts";
import { ulid } from "../../src/server/security/ids.ts";
import { createPasswordHasher, type PasswordHasher } from "../../src/server/security/password.ts";
import { generateTotpSecret, totpCode } from "../../src/server/security/totp.ts";
import { permissionsOf, rankOf } from "../../src/server/policy/registry.ts";
import type { Actor, RequestMeta } from "../../src/server/auth/types.ts";

export const MIGRATIONS = resolve(import.meta.dirname, "../../drizzle");

export function serverConfig() {
  const { TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USER, TEST_DB_PASSWORD } = process.env;
  if (!TEST_DB_USER) {
    throw new Error("Integration tests need a local MariaDB: set TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USER, TEST_DB_PASSWORD (README).");
  }
  return { host: TEST_DB_HOST || "127.0.0.1", port: Number(TEST_DB_PORT || 3306), user: TEST_DB_USER, password: TEST_DB_PASSWORD ?? "" };
}

export async function serverConnection(database?: string) {
  const connection = await createConnection({
    ...serverConfig(),
    database,
    charset: "utf8mb4_unicode_520_ci",
    timezone: "Z",
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
  await connection.query(CONNECTION_SETUP);
  return connection;
}

/** A new, empty database for one test file. */
export async function createEmptyDatabase(prefix: string): Promise<{ name: string; drop: () => Promise<void> }> {
  const name = `rawasy_t_${prefix}_${randomBytes(4).toString("hex")}`.slice(0, 64);
  const admin = await serverConnection();
  await admin.query(`CREATE DATABASE \`${name}\``);
  await admin.end();
  return {
    name,
    drop: async () => {
      const c = await serverConnection();
      await c.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await c.end();
    },
  };
}

export async function migrate(database: string) {
  const connection = await serverConnection(database);
  try {
    return await runMigrations(connection, readMigrations(MIGRATIONS), { appEnv: "local", operator: "cli:test" });
  } finally {
    await connection.end();
  }
}

export const testKey = () => randomBytes(32);
export const ringOf = (active: number, keys: Record<number, Buffer>): KeyRing => ({
  activeVersion: active,
  keys: new Map(Object.entries(keys).map(([v, k]) => [Number(v), k])),
});

export interface TestEnv {
  database: string;
  pool: Pool;
  deps: AuthDeps;
  clock: { now: Date; advance(ms: number): void };
  mailDir: string;
  /** Messages written to the sink so far, oldest first. */
  mail(): { kind: string; to: string; subject: string; text: string }[];
  setKeyRing(ring: KeyRing): void;
  close(): Promise<void>;
}

const sharedHashers = new Map<string, PasswordHasher>();
const hasherOf = (kind: "argon2id" | "scrypt") => {
  let h = sharedHashers.get(kind);
  if (!h) sharedHashers.set(kind, (h = createPasswordHasher(kind)));
  return h;
};

/** A migrated database with services wired to it. */
export async function setupTestEnv(prefix: string, options: { mail?: "sink" | "disabled"; hasher?: "argon2id" | "scrypt" } = {}): Promise<TestEnv> {
  const { name, drop } = await createEmptyDatabase(prefix);
  await migrate(name);
  const pool = createAppPool({ ...serverConfig(), database: name, poolLimit: 4 });
  const clock = {
    now: new Date("2026-10-09T08:00:00.000Z"),
    advance(ms: number) {
      this.now = new Date(this.now.getTime() + ms);
    },
  };
  const mailDir = mkdtempSync(join(tmpdir(), "rawasy-mail-test-"));
  let ring = ringOf(1, { 1: testKey() });
  const deps = createAuthDeps(pool, { APP_ENV: "local", ADMIN_BASE_URL: "http://localhost:3401" }, {
    clock: () => new Date(clock.now),
    hasher: hasherOf(options.hasher ?? "argon2id"),
    keyRing: () => ring,
    mailer: options.mail === "disabled" ? disabledMailer : sinkMailer(mailDir, () => new Date(clock.now)),
  });
  return {
    database: name,
    pool,
    deps,
    clock,
    mailDir,
    mail: () =>
      readdirSync(mailDir)
        .sort()
        .map((file) => JSON.parse(readFileSync(join(mailDir, file), "utf8"))),
    setKeyRing(next) {
      ring = next;
    },
    async close() {
      await pool.end();
      rmSync(mailDir, { recursive: true, force: true });
      await drop();
    },
  };
}

export const meta = (ip = "203.0.113.5"): RequestMeta => ({ requestId: ulid(), ip, userAgent: "integration-test" });

let counter = 0;
/** A unique, strong test password (never a real one). */
export const strongPassword = () => `correct horse ${randomBytes(6).toString("hex")} staple ${++counter}`;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  roles: string[];
  totpSecret?: Buffer;
}

/** Inserts an active user directly (bypassing invitation) with the given roles, optionally with confirmed 2FA. */
export async function createUser(
  env: TestEnv,
  options: { roles: string[]; name?: string; email?: string; mfa?: boolean; status?: "active" | "invited" | "disabled"; hasher?: PasswordHasher },
): Promise<TestUser> {
  const now = env.deps.clock();
  const id = ulid(now.getTime());
  const email = options.email ?? `${options.roles[0] ?? "user"}-${id.slice(-6).toLowerCase()}@example.test`;
  const password = strongPassword();
  const db = dbFor(env.pool);
  await db.insert(users).values({
    id,
    email,
    emailNormalized: email.toLowerCase(),
    displayName: options.name ?? `Test ${options.roles.join(" ")}`,
    status: options.status ?? "active",
    passwordHash: options.status === "invited" ? null : await (options.hasher ?? env.deps.hasher).hash(password),
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  if (options.roles.length) await db.insert(userRoles).values(options.roles.map((roleKey) => ({ userId: id, roleKey, grantedAt: now })));
  let totpSecret: Buffer | undefined;
  if (options.mfa) {
    totpSecret = generateTotpSecret();
    const { blob, version } = encryptSecret(env.deps.keyRing(), totpSecret, `user_mfa:${id}`);
    await db.insert(userMfa).values({ userId: id, totpSecretEnc: blob, keyVersion: version, confirmedAt: now, lastUsedStep: null, createdAt: now });
  }
  return { id, email, password, roles: options.roles, totpSecret };
}

/** A signed-in actor for a test user (a full session, created directly). */
export async function actorFor(env: TestEnv, user: TestUser): Promise<Actor & { token: string }> {
  const db = dbFor(env.pool);
  const [row] = await db.select().from(users).where(eq(users.id, user.id));
  const { token, session } = await createSession(db, {
    userId: user.id,
    now: env.deps.clock(),
    ip: "203.0.113.5",
    userAgent: "integration-test",
    mfaVerified: Boolean(user.totpSecret),
  });
  return { user: row, roles: user.roles, permissions: permissionsOf(user.roles), rank: rankOf(user.roles), session, token };
}

/** The current TOTP code of a test user's secret at the env's clock (optionally some steps away). */
export const codeFor = (env: TestEnv, user: TestUser, stepOffset = 0) =>
  totpCode(user.totpSecret as Buffer, env.deps.clock().getTime() + stepOffset * 30_000);

/** Extracts a /admin/<path>/<token> link from a sink message. */
export function linkToken(text: string, path: "invite" | "reset"): string {
  const match = new RegExp(`/admin/${path}/([A-Za-z0-9_-]{43})`).exec(text);
  if (!match) throw new Error(`No ${path} link in the message.`);
  return match[1];
}
