/**
 * Everything the authentication services need, passed in explicitly so the same code runs in the Next.js admin, in the
 * command-line tools and in the integration tests (each test gets its own database and a movable clock).
 */
import type { Pool } from "mysql2/promise";
import {
  adminBaseUrl,
  appEnv,
  mailConfig,
  passwordHasherKind,
  readKeyRing,
  type AppEnv,
  type KeyRing,
} from "../config/env.ts";
import { dbFor, type Db } from "../db/client.ts";
import { createMailer, type Mailer } from "../mail/mailer.ts";
import { createPasswordHasher, type PasswordHasher } from "../security/password.ts";

export interface AuthDeps {
  pool: Pool;
  db: Db;
  /** The current time (UTC instants). Tests move it to cross expiry limits. */
  clock: () => Date;
  hasher: PasswordHasher;
  /** The TOTP encryption keys; throws ConfigError when AUTH_ENCRYPTION_KEY is missing or malformed. */
  keyRing: () => KeyRing;
  mailer: Mailer;
  /** Origin of the admin, for links in emails and CLI output (never taken from a request). */
  baseUrl: string;
  appEnv: AppEnv;
}

export function createAuthDeps(pool: Pool, env: Record<string, string | undefined> = process.env, overrides: Partial<AuthDeps> = {}): AuthDeps {
  let ring: KeyRing | undefined;
  const clock = overrides.clock ?? (() => new Date());
  return {
    pool,
    db: dbFor(pool),
    clock,
    hasher: createPasswordHasher(passwordHasherKind(env)),
    keyRing: () => (ring ??= readKeyRing(env)),
    mailer: createMailer(mailConfig(env), clock),
    baseUrl: adminBaseUrl(env),
    appEnv: appEnv(env),
    ...overrides,
  };
}

/** The admin path of a token link, e.g. `/admin/reset/<token>`. */
export const adminLink = (deps: Pick<AuthDeps, "baseUrl">, path: string) => `${deps.baseUrl}/admin/${path}`;
