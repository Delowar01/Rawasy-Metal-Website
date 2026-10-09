/**
 * Emergency two-factor reset (A1-SECURITY-RBAC §12.4): when the AUTH_ENCRYPTION_KEY version that protects stored TOTP
 * secrets is lost for good, those secrets can never be read again. Run on the server only (access to the hosting
 * account is the proof of authority); locally: `node --env-file=.env.local scripts/admin-2fa-reset.mjs …`.
 *
 *   node scripts/admin-2fa-reset.mjs --user <email> [--user <email> …]
 *   node scripts/admin-2fa-reset.mjs --all --confirm
 *
 * For each user: deletes the TOTP secret and recovery codes, revokes every session and issues a 30-minute password-
 * reset link — emailed when mail is configured, otherwise printed here for you to pass on by a trusted channel.
 * At the next sign-in each user chooses a new password and sets up two-factor authentication again (at once for
 * Owner and Admin). Audited (actor "cli"). Afterwards, generate a new key version and put it in escrow BEFORE
 * configuring it (README, "Admin: keys"); never store key material in Git, the database or backups.
 * Exit codes: 0 done · 1 usage or configuration · 2 nothing to do / unknown user · 3 database error.
 */

// Node warns that the shared modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { cliContext, cliDbError, parseArgs } = await import("../src/server/cli/runtime.ts");
const { emergencyMfaReset } = await import("../src/server/auth/mfa.ts");
const { findUserByEmail } = await import("../src/server/auth/accounts.ts");
const { ConfigError } = await import("../src/server/config/env.ts");
const { ulid } = await import("../src/server/security/ids.ts");

const USAGE = `Usage:
  node scripts/admin-2fa-reset.mjs --user <email> [--user <email> …]
  node scripts/admin-2fa-reset.mjs --all --confirm`;

let args;
try {
  args = parseArgs(process.argv.slice(2), { values: ["user"], flags: ["all", "confirm", "help"], multi: ["user"] });
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (Boolean(args.all) === Boolean(args.user)) throw new Error("Give --user (one or more) or --all.");
  if (args.all && !args.confirm) throw new Error("--all resets every user's two-factor authentication: add --confirm.");
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(1);
}

let context;
try {
  context = cliContext();
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : "Configuration error.");
  process.exit(1);
}

let code = 0;
try {
  let target;
  if (args.all) {
    target = { all: true };
  } else {
    const ids = [];
    for (const email of args.user) {
      const user = await findUserByEmail(context.deps.db, email);
      if (!user) {
        console.error(`Unknown user: ${email}`);
        code = 2;
      } else ids.push(user.id);
    }
    target = { userIds: ids };
  }
  if (code === 0) {
    const result = await emergencyMfaReset(context.deps, target, context.operator, ulid());
    if (result.users.length === 0) {
      console.log("Nobody has two-factor authentication set up: nothing to reset.");
      code = 2;
    }
    for (const user of result.users) {
      console.log(`${user.email}: two-factor authentication removed; ${user.sessionsRevoked} session(s) revoked.`);
      if (user.delivered) console.log("  Password-reset link emailed.");
      else if (user.link) console.log(`  No email was sent. Pass on this password-reset link (30 minutes, single use):\n  ${user.link}`);
      else console.log("  The account is not active: no reset link was issued.");
    }
    if (result.users.length) {
      console.log("\nNext: generate a new AUTH_ENCRYPTION_KEY version, put it in escrow first, then configure it (README).");
    }
  }
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close().catch(() => {});
}
process.exit(code);
