/**
 * TOTP encryption key versions (A1-SECURITY-RBAC §12.2): which versions the stored secrets use, and re-encryption to
 * the active version after a rotation. Run on the server; locally: `node --env-file=.env.local scripts/admin-keys.mjs …`.
 *
 *   node scripts/admin-keys.mjs status    rows per key version, and whether each version is configured
 *   node scripts/admin-keys.mjs rekey     re-encrypt every row stored under an older version with the active key
 *
 * Rotation: put the new key in escrow first; move the current key to AUTH_ENCRYPTION_RETIRED_KEYS ("version:base64");
 * set the new key and AUTH_ENCRYPTION_KEY_VERSION (+1); restart; run `rekey`; run `status` until only the active
 * version remains. A retired version leaves the environment once no row uses it, and escrow once no retained backup can
 * need it. Prints counts and versions only — never key material or secrets.
 * Exit codes: 0 done · 1 usage or configuration · 2 rows need the emergency reset (unreadable) · 3 database error.
 */

// Node warns that the shared modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { cliContext, cliDbError } = await import("../src/server/cli/runtime.ts");
const { mfaKeyVersions, reencryptMfaSecrets } = await import("../src/server/auth/mfa.ts");
const { ConfigError } = await import("../src/server/config/env.ts");

const command = process.argv[2];
if (!["status", "rekey"].includes(command) || process.argv.length > 3) {
  console.error("Usage: node scripts/admin-keys.mjs status | rekey");
  process.exit(1);
}

let context;
let ring;
try {
  context = cliContext();
  ring = context.deps.keyRing();
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : "Configuration error.");
  await context?.close().catch(() => {});
  process.exit(1);
}

let code = 0;
try {
  if (command === "rekey") {
    const result = await reencryptMfaSecrets(context.deps);
    console.log(`Re-encrypted ${result.reencrypted} row(s) with the active key (version ${ring.activeVersion}).`);
    if (result.unreadable.length) {
      const versions = [...new Set(result.unreadable.map((r) => r.version))].join(", ");
      console.error(`${result.unreadable.length} row(s) could not be read (key version ${versions} missing or wrong): see admin-2fa-reset.mjs.`);
      code = 2;
    }
  }
  const versions = await mfaKeyVersions(context.deps.db);
  console.log(`Active key version: ${ring.activeVersion}. Configured versions: ${[...ring.keys.keys()].sort((a, b) => a - b).join(", ")}.`);
  if (versions.length === 0) console.log("No two-factor secrets are stored.");
  for (const { version, rows } of versions) {
    const state = version === ring.activeVersion ? "active" : ring.keys.has(version) ? "retired, configured" : "NOT CONFIGURED";
    console.log(`  version ${version}: ${rows} row(s) — ${state}`);
    if (!ring.keys.has(version)) code = 2;
  }
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close().catch(() => {});
}
process.exit(code);
