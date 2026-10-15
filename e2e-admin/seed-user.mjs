/**
 * Test only (the admin browser tests): adds an active admin user with the given roles — and, with --mfa, a confirmed
 * authenticator — to the admin E2E run's database, so the Core CMS tests start from known users of every role without
 * depending on another spec's state. Never part of the site or the deployment archive.
 *
 *   node e2e-admin/seed-user.mjs --email <email> --name "<name>" --roles editor[,reviewer] [--mfa]
 *
 * The password comes from the SEED_PASSWORD environment variable (never the command line). Refuses anything but
 * APP_ENV=local and a database named rawasy_e2e_*. Prints {"id","secret"} — the base32 key of a throwaway test
 * authenticator (with --mfa), nothing else.
 */
import { parseArgs } from "node:util";

const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, roles: { type: "string" }, mfa: { type: "boolean", default: false } } });
const password = process.env.SEED_PASSWORD ?? "";
if (process.env.APP_ENV !== "local" || !/^rawasy_e2e_[0-9a-f]+$/.test(process.env.DB_NAME ?? "")) {
  console.error("seed-user: only for the local admin E2E database (APP_ENV=local, DB_NAME=rawasy_e2e_*).");
  process.exit(2);
}
if (!values.email || !values.name || !values.roles || password.length < 12) {
  console.error("Usage: SEED_PASSWORD=<12+ characters> node e2e-admin/seed-user.mjs --email <email> --name <name> --roles <role,…> [--mfa]");
  process.exit(1);
}

const { createConnection } = await import("mysql2/promise");
const { readDbConfig, readKeyRing } = await import("../src/server/config/env.ts");
const { CONNECTION_CHARSET, CONNECTION_SETUP } = await import("../src/server/db/pool.ts");
const { normalizeEmail } = await import("../src/server/auth/accounts.ts");
const { createPasswordHasher } = await import("../src/server/security/password.ts");
const { encryptSecret } = await import("../src/server/security/encryption.ts");
const { base32Encode, generateTotpSecret } = await import("../src/server/security/totp.ts");
const { ulid } = await import("../src/server/security/ids.ts");

const config = readDbConfig();
const connection = await createConnection({
  host: config.socketPath ? undefined : config.host,
  port: config.socketPath ? undefined : config.port,
  socketPath: config.socketPath,
  user: config.user,
  password: config.password,
  database: config.database,
  charset: CONNECTION_CHARSET,
  timezone: "Z",
});
await connection.query(CONNECTION_SETUP);
try {
  const now = new Date();
  const id = ulid(now.getTime());
  const hash = await createPasswordHasher("argon2id").hash(password);
  await connection.query(
    "INSERT INTO users (id, email, email_normalized, display_name, status, password_hash, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)",
    [id, values.email, normalizeEmail(values.email), values.name, hash, now, now, now],
  );
  for (const role of values.roles.split(",")) await connection.query("INSERT INTO user_roles (user_id, role_key, granted_at) VALUES (?, ?, ?)", [id, role, now]);
  let secret = null;
  if (values.mfa) {
    const key = generateTotpSecret();
    const { blob, version } = encryptSecret(readKeyRing(), key, `user_mfa:${id}`);
    await connection.query("INSERT INTO user_mfa (user_id, totp_secret_enc, key_version, confirmed_at, created_at) VALUES (?, ?, ?, ?, ?)", [id, blob, version, now, now]);
    secret = base32Encode(key);
  }
  console.log(JSON.stringify({ id, secret }));
} finally {
  await connection.end();
}
