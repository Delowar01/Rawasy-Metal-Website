/**
 * A9.4 — which content source this process serves (next.config.ts). The switch is fixed into a release when it is
 * built: `next build` reads `CONTENT_SOURCE`; a server that runs a build (`next start`, `server.js`) takes the source that
 * build was made with, from the build's own record, never from its environment alone.
 *
 * Why: Next.js evaluates next.config.ts again when a server starts. A database-content build served without
 * `CONTENT_SOURCE` in the server's environment otherwise got the static configuration at run time — no page cache
 * handler — and Next.js's own file-system cache then kept every rendered page with no generation check: stale after a
 * publication, and still answered while the database was down (found by the A9 fail-closed drill).
 *
 * The build's record is `.next/required-server-files.json`: Next.js writes the build's configuration there, and only a
 * database-content build sets `cacheHandler` (this folder's cache-handler.cjs). A server whose environment names the
 * other source refuses to start; a build without that record (none made yet) leaves the decision to `next start`'s own
 * error.
 *
 * Plain CommonJS (next.config.ts requires it; the unit tests load it with createRequire).
 */
"use strict";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS, required by next.config.ts.
const { readFileSync } = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS, required by next.config.ts.
const { join } = require("node:path");

const SOURCES = ["static", "database"];
const SERVER_PHASE = "phase-production-server";

/** The source a build was made with ("static" | "database"), or null when the folder holds no build's record. */
function builtSource(distDir) {
  let text;
  try {
    text = readFileSync(join(distDir, "required-server-files.json"), "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
  const handler = (JSON.parse(text).config || {}).cacheHandler;
  return typeof handler === "string" && /(?:^|[\\/])cache-handler\.cjs$/.test(handler) ? "database" : "static";
}

/**
 * The content source for this phase. `asked` is the environment's CONTENT_SOURCE (or undefined); `readBuilt` returns the
 * build's own source (builtSource) or null.
 */
function contentSourceFor(phase, asked, readBuilt) {
  if (asked !== undefined && !SOURCES.includes(asked)) throw new Error('CONTENT_SOURCE must be "static" or "database".');
  if (phase !== SERVER_PHASE) return asked ?? "static";
  const built = readBuilt();
  if (built === null) return asked ?? "static";
  if (asked !== undefined && asked !== built)
    throw new Error(`This release was built with CONTENT_SOURCE=${built}, but the server's environment sets CONTENT_SOURCE=${asked}. Build the release you mean to serve (the content source is fixed at build), or remove the setting.`);
  return built;
}

/**
 * Set in the process whose Next.js configuration installs the fail-closed page cache (next.config.ts calls it when it
 * returns the database configuration). That configuration is the one the response cache follows — the cache that keeps
 * and serves rendered pages — so the live loader (src/content/live/load.ts) serves nothing without this mark. A mark set
 * by the handler itself would prove nothing: Next.js also builds a cache from the configuration embedded in the bundle at
 * build, and that one constructs the handler whatever the server's own configuration says (the A9 guard drill).
 */
const PAGE_CACHE_CONFIGURED = Symbol.for("rawasy.public.pageCacheConfigured");
function markPageCacheConfigured() {
  globalThis[PAGE_CACHE_CONFIGURED] = true;
}

module.exports = { builtSource, contentSourceFor, markPageCacheConfigured, SERVER_PHASE, PAGE_CACHE_CONFIGURED };
