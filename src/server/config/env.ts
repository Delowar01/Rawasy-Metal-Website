/**
 * Server configuration for the admin (Phase A2), read from environment variables only. Values never appear in errors or
 * logs: a problem names the variable, not what it holds.
 *
 * Framework-free on purpose: the Next.js admin, the command-line tools (scripts/*.mjs) and the integration tests import
 * this module, so it uses explicit `.ts` imports and no Next.js API (Node 22 runs it through type stripping).
 *
 * Variable names and their meaning: docs/admin/A1-SECURITY-RBAC.md §12 and `.env.example`.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export type AppEnv = "local" | "staging" | "production";

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const APP_ENVS = ["local", "staging", "production"] as const;

/**
 * The environment the app runs in. Without APP_ENV a production build counts as `production` (the strictest), and only
 * `next dev` (or a script outside Next) counts as `local`: forgetting the variable never unlocks local-only behaviour.
 */
export function appEnv(env: Env = process.env): AppEnv {
  const raw = env.APP_ENV?.trim();
  if (raw) {
    if (!(APP_ENVS as readonly string[]).includes(raw)) throw new ConfigError("APP_ENV must be local, staging or production.");
    return raw as AppEnv;
  }
  return env.NODE_ENV === "production" ? "production" : "local";
}

export const isLocal = (env: Env = process.env) => appEnv(env) === "local";

function parse<T>(schema: z.ZodType<T>, value: unknown, name: string, rule: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ConfigError(`${name} ${rule}.`);
  return result.data;
}

const intIn = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

// ---------------------------------------------------------------------------------------------------------------------
// Database (A1-DATABASE-SCHEMA §4)

export interface DbConfig {
  host: string;
  port: number;
  socketPath?: string;
  user: string;
  password: string;
  database: string;
  /** Connections one app process may open. Production default 2 until the account is measured (A1 §4.2); cap 4. */
  poolLimit: number;
}

export const DB_POOL_LIMIT_DEFAULT = 2;
export const DB_POOL_LIMIT_MAX = 4;

export function readDbConfig(env: Env = process.env): DbConfig {
  const required = (name: string) => {
    const value = env[name];
    if (value === undefined || value === "") throw new ConfigError(`${name} is not set (database configuration).`);
    return value;
  };
  const database = required("DB_NAME");
  if (!/^[A-Za-z0-9_]{1,64}$/.test(database)) throw new ConfigError("DB_NAME may hold letters, digits and _ only.");
  return {
    host: env.DB_HOST?.trim() || "127.0.0.1",
    port: parse(intIn(1, 65535), env.DB_PORT ?? 3306, "DB_PORT", "must be a port number"),
    socketPath: env.DB_SOCKET_PATH?.trim() || undefined,
    user: required("DB_USER"),
    password: env.DB_PASSWORD ?? "",
    database,
    poolLimit: parse(
      intIn(1, DB_POOL_LIMIT_MAX),
      env.DB_POOL_LIMIT ?? DB_POOL_LIMIT_DEFAULT,
      "DB_POOL_LIMIT",
      `must be a whole number from 1 to ${DB_POOL_LIMIT_MAX} (connection budget: A1-DATABASE-SCHEMA §4.2)`,
    ),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// TOTP secret encryption keys (A1-SECURITY-RBAC §12.2)

export interface KeyRing {
  activeVersion: number;
  /** Every key the app may decrypt with, by version; the active one included. */
  keys: ReadonlyMap<number, Buffer>;
}

function decodeKey(value: string, name: string): Buffer {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed)) throw new ConfigError(`${name} must be base64 (32 random bytes).`);
  const key = Buffer.from(trimmed.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (key.length !== 32) throw new ConfigError(`${name} must decode to exactly 32 bytes.`);
  return key;
}

/**
 * The active key (AUTH_ENCRYPTION_KEY + AUTH_ENCRYPTION_KEY_VERSION) and the retired versions still needed
 * (AUTH_ENCRYPTION_RETIRED_KEYS = "1:base64,2:base64"). Throws ConfigError when the active key is missing.
 */
export function readKeyRing(env: Env = process.env): KeyRing {
  const raw = env.AUTH_ENCRYPTION_KEY;
  if (!raw) throw new ConfigError("AUTH_ENCRYPTION_KEY is not set (needed for two-factor authentication).");
  const activeVersion = parse(
    intIn(1, 255),
    env.AUTH_ENCRYPTION_KEY_VERSION ?? "",
    "AUTH_ENCRYPTION_KEY_VERSION",
    "must be a whole number from 1 to 255",
  );
  const keys = new Map<number, Buffer>([[activeVersion, decodeKey(raw, "AUTH_ENCRYPTION_KEY")]]);
  const retired = env.AUTH_ENCRYPTION_RETIRED_KEYS?.trim();
  if (retired) {
    for (const entry of retired.split(",").map((s) => s.trim()).filter(Boolean)) {
      const separator = entry.indexOf(":");
      if (separator < 1) throw new ConfigError("AUTH_ENCRYPTION_RETIRED_KEYS must list version:base64 pairs.");
      const version = parse(intIn(1, 255), entry.slice(0, separator), "AUTH_ENCRYPTION_RETIRED_KEYS", "has a version outside 1–255");
      if (keys.has(version)) throw new ConfigError("AUTH_ENCRYPTION_RETIRED_KEYS repeats a version (or the active one).");
      keys.set(version, decodeKey(entry.slice(separator + 1), "AUTH_ENCRYPTION_RETIRED_KEYS"));
    }
  }
  return { activeVersion, keys };
}

// ---------------------------------------------------------------------------------------------------------------------
// Requests, links, mail, hashing

/**
 * How many X-Forwarded-For entries the host's own proxies add (A1-SECURITY-RBAC §3.4). Local default 0; staging and
 * production must set it explicitly once verified on the account (A1-ARCHITECTURE §7.3).
 */
export function trustedProxyHops(env: Env = process.env): number {
  const raw = env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw === "") {
    if (appEnv(env) === "local") return 0;
    throw new ConfigError("TRUSTED_PROXY_HOPS must be set outside local development (verify it on the host first).");
  }
  return parse(intIn(0, 5), raw, "TRUSTED_PROXY_HOPS", "must be a whole number from 0 to 5");
}

/**
 * Where the admin is reached, for links printed by the CLI or sent by email (never taken from the request). Local
 * default http://localhost:3000; elsewhere the public origin (NEXT_PUBLIC_SITE_URL) unless ADMIN_BASE_URL says otherwise.
 */
export function adminBaseUrl(env: Env = process.env): string {
  const raw = env.ADMIN_BASE_URL?.trim() || (appEnv(env) === "local" ? "http://localhost:3000" : env.NEXT_PUBLIC_SITE_URL?.trim());
  if (!raw) throw new ConfigError("ADMIN_BASE_URL (or NEXT_PUBLIC_SITE_URL) is not set.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError("ADMIN_BASE_URL must be an absolute URL.");
  }
  if (appEnv(env) !== "local" && url.protocol !== "https:") throw new ConfigError("ADMIN_BASE_URL must use https outside local development.");
  return url.origin;
}

export type MailTransport = "disabled" | "sink";

/**
 * Outgoing mail (A2): `disabled` (default — nothing is sent and the admin says so) or `sink` (local development and
 * tests only: messages are written as JSON files to MAIL_SINK_DIR). A real SMTP transport is not part of A2.
 */
export function mailConfig(env: Env = process.env): { transport: MailTransport; sinkDir: string } {
  const transport = (env.MAIL_TRANSPORT?.trim() || "disabled") as MailTransport;
  if (transport !== "disabled" && transport !== "sink") throw new ConfigError("MAIL_TRANSPORT must be disabled or sink (A2).");
  if (transport === "sink" && appEnv(env) !== "local") throw new ConfigError("MAIL_TRANSPORT=sink is allowed only with APP_ENV=local.");
  return { transport, sinkDir: env.MAIL_SINK_DIR?.trim() || join(tmpdir(), "rawasy-mail-sink") };
}

export type PasswordHasherKind = "argon2id" | "scrypt";

/** Argon2id by default; `scrypt` (Node's built-in) only where the native Argon2 module cannot load (A1 §3.2). */
export function passwordHasherKind(env: Env = process.env): PasswordHasherKind {
  const raw = env.AUTH_PASSWORD_HASHER?.trim() || "argon2id";
  if (raw !== "argon2id" && raw !== "scrypt") throw new ConfigError("AUTH_PASSWORD_HASHER must be argon2id or scrypt.");
  return raw;
}

/** The public site's content source. A2 supports only `static` (T1 = Option B: the switch is A9's). */
export function contentSource(env: Env = process.env): "static" {
  const raw = env.CONTENT_SOURCE?.trim() || "static";
  if (raw !== "static") throw new ConfigError("CONTENT_SOURCE must be static until the A9 cutover.");
  return raw;
}
