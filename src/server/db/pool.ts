/**
 * One mysql2 connection pool per Node process, created on first use (A1-DATABASE-SCHEMA §4.1–§4.3).
 *
 * - `DB_POOL_LIMIT` connections at most (production default 2 until the hosting account is measured; never derived
 *   from an assumed process count), `maxIdle` one less so idle connections are closed, a bounded queue that fails fast.
 * - Every new connection runs `SET time_zone = '+00:00'` and a strict `sql_mode` before its first query.
 * - Never during `next build`: the build machine has no database, and the public site is static (T1, Option B). Any
 *   attempt throws `BuildPhaseDatabaseError`, so a page that would need the database fails the build loudly.
 * - Errors name a class or code only, never the host, user, database name, SQL or the driver's message.
 *
 * Framework-free (explicit `.ts` imports): the CLIs and the integration tests use it too.
 */
import { createPool, type Pool, type PoolOptions } from "mysql2/promise";
import { readDbConfig, type DbConfig } from "../config/env.ts";

export const CONNECTION_SETUP =
  "SET time_zone = '+00:00', SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'";

/** Connection collation = table collation (mysql2 sends its id, 246, in the handshake). */
export const CONNECTION_CHARSET = "utf8mb4_unicode_520_ci";

export class BuildPhaseDatabaseError extends Error {
  constructor() {
    super("The database must not be used during `next build` (A1-DATABASE-SCHEMA §4.3): render this route at request time.");
    this.name = "BuildPhaseDatabaseError";
  }
}

/** Throws during `next build` (Next sets NEXT_PHASE before it prerenders pages). */
export function assertNotBuildPhase(env: Record<string, string | undefined> = process.env): void {
  if (env.NEXT_PHASE === "phase-production-build") throw new BuildPhaseDatabaseError();
}

export function poolOptions(config: DbConfig): PoolOptions {
  return {
    host: config.socketPath ? undefined : config.host,
    port: config.socketPath ? undefined : config.port,
    socketPath: config.socketPath,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.poolLimit,
    maxIdle: Math.max(0, config.poolLimit - 1),
    idleTimeout: 30_000,
    queueLimit: 50,
    waitForConnections: true,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    charset: CONNECTION_CHARSET,
    timezone: "Z",
    supportBigNumbers: true,
    bigNumberStrings: false,
    multipleStatements: false,
    maxPreparedStatements: 64,
    gracefulEnd: true,
  };
}

const HOLDER = Symbol.for("rawasy.admin.dbPool");
type Holder = { [HOLDER]?: Pool };

/** Creates a pool for the given configuration (tests and CLIs); the app uses `getPool()`. */
export function createAppPool(config: DbConfig): Pool {
  assertNotBuildPhase();
  const pool = createPool(poolOptions(config));
  // The core pool emits each new connection before handing it out; commands queue per connection, so the setup runs
  // first. A connection whose setup fails is destroyed (its queued query then fails instead of running unprepared).
  pool.pool.on("connection", (connection) => {
    connection.query(CONNECTION_SETUP, (err) => {
      if (err) connection.destroy();
    });
  });
  return pool;
}

/** This process's pool, created on first use from the DB_* environment variables. */
export function getPool(): Pool {
  assertNotBuildPhase();
  const holder = globalThis as Holder;
  holder[HOLDER] ??= createAppPool(readDbConfig());
  return holder[HOLDER];
}

/** Closes this process's pool (tests, CLIs, shutdown). */
export async function closePool(): Promise<void> {
  const holder = globalThis as Holder;
  const pool = holder[HOLDER];
  holder[HOLDER] = undefined;
  if (pool) await pool.end();
}

/**
 * The driver's error code (e.g. ER_DUP_ENTRY) or number behind an error, looking through Drizzle's wrapper (whose
 * message holds the SQL and its parameters, so it is never logged or shown).
 */
export function dbErrorInfo(error: unknown): { code?: string; errno?: number } {
  for (let current = error, depth = 0; current && typeof current === "object" && depth < 4; depth++) {
    const { code, errno, cause } = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if ((typeof code === "string" && /^[A-Z0-9_]{2,64}$/.test(code)) || typeof errno === "number") {
      return { code: typeof code === "string" ? code : undefined, errno: typeof errno === "number" ? errno : undefined };
    }
    current = cause;
  }
  return {};
}

/** A short, safe description of a database error for logs: its code, never its message. */
export function describeDbError(error: unknown): string {
  const { code, errno } = dbErrorInfo(error);
  if (code) return code;
  if (errno !== undefined) return `errno ${errno}`;
  return error instanceof Error ? error.name : "unknown error";
}
