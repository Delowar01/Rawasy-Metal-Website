/**
 * Drizzle over the process pool, core query builder only (A1-DATABASE-SCHEMA §1): `drizzle()` never receives the schema
 * or a mode, so the relational API (`db.query…`, which emits LATERAL joins MariaDB lacks) does not exist here; the lint
 * configuration forbids it as well.
 */
import { drizzle } from "drizzle-orm/mysql2";
import type { MySqlDatabase } from "drizzle-orm/mysql-core";
import type { MySql2PreparedQueryHKT, MySql2QueryResultHKT } from "drizzle-orm/mysql2";
import type { Pool } from "mysql2/promise";
import { dbErrorInfo } from "./pool.ts";

/** A database handle or a transaction (both run queries the same way). */
export type Db = MySqlDatabase<MySql2QueryResultHKT, MySql2PreparedQueryHKT>;

const handles = new WeakMap<Pool, Db>();

/** The Drizzle handle over a pool (one per pool). */
export function dbFor(pool: Pool): Db {
  let db = handles.get(pool);
  if (!db) {
    db = drizzle(pool);
    handles.set(pool, db);
  }
  return db;
}

const DEADLOCK = 1213;

/**
 * Runs `fn` in one transaction on one pooled connection. Unlike Drizzle's own pool transaction, the connection is
 * released even when BEGIN itself fails (A1 §4.3). A deadlock (InnoDB chose this transaction as the victim) is retried
 * once; any other error rolls back and propagates.
 */
export async function inTransaction<T>(pool: Pool, fn: (tx: Db) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const connection = await pool.getConnection();
    try {
      return await drizzle(connection).transaction(fn);
    } catch (error) {
      if (attempt === 0 && dbErrorInfo(error).errno === DEADLOCK) continue;
      throw error;
    } finally {
      connection.release();
    }
  }
}
