/**
 * A9.4 — the fail-closed page cache of a database-content release (A1-PUBLISHING-VERSIONS §8; next.config.ts sets it
 * only when CONTENT_SOURCE=database). Next.js keeps a rendered page here (its whole response: HTML and page data); this
 * handler serves it only while it is still the content's current version:
 *
 * - Every lookup reads the shared cache generation (`cache_generation`: A8 moves it on every publication,
 *   unpublication, rollback and restore; a restore also starts a new epoch). No entry is served without that read
 *   succeeding — the database down means the lookup fails and so does the request (500), never a stale page.
 * - An entry is stamped with the generation read *before* its render (the lookup that missed), never after: a
 *   publication committed while the page rendered leaves the entry older than the content, so it is rendered again.
 *   When several renders of one page overlap, only the oldest stamp is kept.
 * - Entries live in this process's memory only (bounded); every process decides on the same shared generation, so no
 *   process serves what another invalidated. Tags are not used: the generation is the invalidation.
 * - Logs name error codes only.
 *
 * Plain CommonJS with mysql2 (Next.js loads this file itself, outside the bundle); the same DB_* variables as the app.
 */
"use strict";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Next.js loads this CommonJS file itself, outside the bundle.
const mysql = require("mysql2/promise");

const MAX_ENTRIES = 400;
const POOL = Symbol.for("rawasy.public.cachePool");

function pool() {
  const holder = globalThis;
  if (!holder[POOL]) {
    const env = process.env;
    if (!env.DB_NAME || !env.DB_USER) throw new Error("The page cache needs the DB_* settings.");
    holder[POOL] = mysql.createPool({
      host: env.DB_HOST || "127.0.0.1",
      port: Number(env.DB_PORT || 3306),
      socketPath: env.DB_SOCKET_PATH || undefined,
      user: env.DB_USER,
      password: env.DB_PASSWORD || "",
      database: env.DB_NAME,
      connectionLimit: 1,
      connectTimeout: 5000,
    });
  }
  return holder[POOL];
}

async function sharedState() {
  try {
    const [rows] = await pool().query("SELECT value, epoch FROM cache_generation WHERE id = 1");
    const row = rows[0];
    if (!row) throw Object.assign(new Error("no generation row"), { code: "NO_GENERATION" });
    return { generation: Number(row.value), epoch: String(row.epoch) };
  } catch (error) {
    console.error(`page cache: the shared generation could not be read (${(error && error.code) || "error"})`);
    throw new Error("The page cache could not check the content's version.");
  }
}

/** The handler class over a way to read the shared state (the tests pass their own). */
function createHandlerClass(readState = sharedState, maxEntries = MAX_ENTRIES) {
  const entries = new Map();
  const pending = new Map();
  return class ContentCacheHandler {
    async get(key) {
      const state = await readState();
      const entry = entries.get(key);
      if (entry && entry.generation === state.generation && entry.epoch === state.epoch) {
        // Most recently used last (the bound evicts the oldest).
        entries.delete(key);
        entries.set(key, entry);
        return entry.value;
      }
      if (entry) entries.delete(key);
      // The render that follows is stamped with this state; overlapping renders keep the oldest.
      if (!pending.has(key)) pending.set(key, state);
      return null;
    }

    async set(key, data) {
      const stamp = pending.get(key);
      pending.delete(key);
      if (!stamp || !data) return;
      entries.set(key, { generation: stamp.generation, epoch: stamp.epoch, value: { lastModified: Date.now(), value: data } });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    }

    async revalidateTag() {}

    resetRequestCache() {}
  };
}

module.exports = createHandlerClass();
module.exports.createHandlerClass = createHandlerClass;
