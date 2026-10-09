/** Helpers of the admin E2E tests: the run's facts, the server CLIs, the local mail sink and TOTP codes. */
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

const ROOT = resolve(__dirname, "..");

export interface RunState {
  database: string;
  mailDir: string;
  authKey: string;
  port: number;
}

/** Written by e2e-admin/server.mjs when the server starts (read lazily: test files load before the server). */
export const run = (): RunState => JSON.parse(readFileSync(join(tmpdir(), "rawasy-admin-e2e.json"), "utf8"));

export function cliEnv(): NodeJS.ProcessEnv {
  const s = run();
  return {
    PATH: process.env.PATH,
    NODE_ENV: "test",
    APP_ENV: "local",
    DB_HOST: process.env.TEST_DB_HOST ?? "127.0.0.1",
    DB_PORT: process.env.TEST_DB_PORT ?? "3306",
    DB_USER: process.env.TEST_DB_USER,
    DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? "",
    DB_NAME: s.database,
    AUTH_ENCRYPTION_KEY: s.authKey,
    AUTH_ENCRYPTION_KEY_VERSION: "1",
    ADMIN_BASE_URL: `http://localhost:${s.port}`,
    MAIL_TRANSPORT: "sink",
    MAIL_SINK_DIR: s.mailDir,
  };
}

/** Runs a server CLI (scripts/<name>) and returns its output. */
export function cli(script: string, args: string[]): string {
  return execFileSync(process.execPath, [join(ROOT, "scripts", script), ...args], { env: cliEnv(), encoding: "utf8" });
}

/** Runs one query against this run's test database (never another one: the name comes from the run's state file). */
export async function queryTestDb<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const mysql = await import("mysql2/promise");
  const env = cliEnv();
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  try {
    const [rows] = await connection.query(sql, params);
    return rows as T[];
  } finally {
    await connection.end();
  }
}

/**
 * Moves the last confirmation of a user's live sessions back past the 10-minute step-up window, in this run's test
 * database (a full sign-in counts as that confirmation, A1-SECURITY-RBAC §3.7).
 */
export async function ageAuthentication(email: string, minutes = 11) {
  await queryTestDb(
    "UPDATE sessions s JOIN users u ON u.id = s.user_id SET s.reauthenticated_at = s.reauthenticated_at - INTERVAL ? MINUTE " +
      "WHERE u.email_normalized = ? AND s.revoked_at IS NULL",
    [minutes, email.toLowerCase()],
  );
}

export function bootstrapLink(email: string, name: string): string {
  const out = cli("admin-bootstrap.mjs", ["--email", email, "--name", name]);
  const link = /http:\/\/localhost:\d+\/admin\/invite\/[A-Za-z0-9_-]{43}/.exec(out)?.[0];
  if (!link) throw new Error("No setup link in the bootstrap output.");
  return link;
}

export interface SinkMessage {
  kind: string;
  to: string;
  subject: string;
  text: string;
}

export function mailTo(address: string): SinkMessage[] {
  const dir = run().mailDir;
  return readdirSync(dir)
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as SinkMessage)
    .filter((m) => m.to.toLowerCase() === address.toLowerCase());
}

export function linkIn(message: SinkMessage | undefined, path: "invite" | "reset"): string {
  const link = new RegExp(`http://localhost:\\d+/admin/${path}/[A-Za-z0-9_-]{43}`).exec(message?.text ?? "")?.[0];
  if (!link) throw new Error(`No ${path} link in the message.`);
  return link;
}

// ---------------------------------------------------------------------------------------------------------------------
// TOTP (RFC 6238): each code is used once, so the helper remembers the last step per secret and waits if needed.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/\s/g, "").toUpperCase()) {
    value = (value << 5) | B32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secret: string, step: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", base32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

const lastStep = new Map<string, number>();
export async function freshCode(secret: string): Promise<string> {
  for (;;) {
    const current = Math.floor(Date.now() / 30_000);
    const last = lastStep.get(secret) ?? -1;
    for (const step of [current, current + 1]) {
      if (step > last) {
        lastStep.set(secret, step);
        return hotp(secret, step);
      }
    }
    await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 200));
  }
}

// ---------------------------------------------------------------------------------------------------------------------

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Completes the second factor when the verification page shows, and waits until the sign-in has gone through: the
 * Server Action redirects when it answers, and a navigation started before that would race the redirect.
 */
export async function verify(page: Page, secret: string) {
  await page.waitForURL("**/admin/login/verify**");
  await page.getByLabel("Authentication code").fill(await freshCode(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/login"));
}

/** Starts a 2FA set-up (required set-up or the Security page): the password, then the QR code. */
export async function beginSetUp(page: Page, password: string) {
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("img", { name: /QR code/ }).waitFor();
}

/** Confirms a started set-up with a first code from its key; returns the secret and the recovery codes. */
export async function finishSetUp(page: Page, confirm = "Turn on two-factor authentication"): Promise<{ secret: string; codes: string[] }> {
  await page.getByRole("button", { name: /Show the key/ }).click();
  const secret = ((await page.getByLabel("Setup key").textContent()) ?? "").replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await page.getByLabel("6-digit code").fill(await freshCode(secret));
  await page.getByRole("button", { name: confirm }).click();
  await page.getByRole("heading", { name: "Save your recovery codes" }).waitFor();
  const codes = await page.locator(".adm-codes li").allTextContents();
  expect(codes).toHaveLength(10);
  // 20 Crockford base32 characters (100 bits) in four groups (A2 Correction 1).
  for (const code of codes) expect(code).toMatch(/^[0-9a-hjkmnp-tv-z]{5}(-[0-9a-hjkmnp-tv-z]{5}){3}$/);
  return { secret, codes };
}

/** Sets up 2FA on the enrolment form (required set-up or the Security page) and returns the secret and codes. */
export async function enrol(page: Page, password: string): Promise<{ secret: string; codes: string[] }> {
  await beginSetUp(page, password);
  return finishSetUp(page);
}

/** Confirms identity on a step-up gate when it is shown. */
export async function stepUpIfAsked(page: Page, password: string, secret?: string) {
  const heading = page.getByRole("heading", { name: "Confirm it's you" });
  if (!(await heading.isVisible())) return;
  await page.getByLabel("Password", { exact: true }).fill(password);
  if (secret) await page.getByLabel("Authentication code").fill(await freshCode(secret));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(heading).toBeHidden();
}

export const PASSWORDS = {
  owner: "velvet tractor marmalade lantern",
  admin: "copper heron violin meadow",
  editor: "granite pelican sundial orchard",
  reviewer: "saffron glacier compass ribbon",
};
