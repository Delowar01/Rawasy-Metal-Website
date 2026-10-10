/**
 * Whether this server serves the admin at all (A2 Correction 1: the pre-A9 release gate). Until the A9 cutover the
 * production site stays static (T1 = Option B), so a release built from the admin branch must not expose a dead or
 * half-configured `/admin`: outside local development the admin is off unless ADMIN_ENABLED is exactly "1".
 *
 *   ADMIN_ENABLED="1"            → on (any environment)
 *   ADMIN_ENABLED set otherwise  → off ("0", "true", "yes" … are not the enabling value)
 *   ADMIN_ENABLED unset or empty → on only in local development: APP_ENV=local, or no APP_ENV outside a production
 *                                  build (`next dev`, a script) — the same reading as `appEnv()` in
 *                                  src/server/config/env.ts; staging, production and an unknown APP_ENV are off.
 *
 * Read from the environment on every call, never from the database (the proxy and the build use it too), and never
 * inferred from DB_* or other settings. Framework-free: the proxy, the admin's server code and the unit tests share it.
 */
type Env = Record<string, string | undefined>;

export const ADMIN_ENABLED_VALUE = "1";

export function isAdminEnabled(env: Env = process.env): boolean {
  const flag = env.ADMIN_ENABLED?.trim();
  if (flag) return flag === ADMIN_ENABLED_VALUE;
  const app = env.APP_ENV?.trim();
  if (app) return app === "local";
  return env.NODE_ENV !== "production";
}
