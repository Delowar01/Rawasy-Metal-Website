/**
 * The first Owner of the admin, and recovery when no Owner can sign in (A1-SECURITY-RBAC §3.9). Run on the server
 * (cPanel Terminal or SSH) in the app's environment; locally: `node --env-file=.env.local scripts/admin-bootstrap.mjs …`.
 *
 *   node scripts/admin-bootstrap.mjs --email <owner email> --name "<name>"
 *       Refused while an active Owner exists. Creates the Owner as invited and prints a one-time setup link (30 minutes)
 *       where the Owner chooses the password (and then sets up two-factor authentication). Run it again to renew the
 *       link of an Owner who has not finished.
 *
 *   node scripts/admin-bootstrap.mjs --reset <email> [--remove-2fa]
 *       For an existing active account: unlocks it, signs it out everywhere and prints a 30-minute password-reset link.
 *       --remove-2fa also removes its two-factor authentication (lost phone and recovery codes).
 *
 * No password is ever typed on the command line, and none is printed. The links are single use; only their hashes are
 * stored. Every run is recorded in the audit log (actor "cli").
 * Exit codes: 0 done · 1 usage or configuration · 2 refused · 3 database error.
 */

// Node warns that the shared modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { cliContext, cliDbError, parseArgs } = await import("../src/server/cli/runtime.ts");
const { bootstrapOwner, recoveryReset } = await import("../src/server/auth/bootstrap.ts");
const { ConfigError } = await import("../src/server/config/env.ts");

const USAGE = `Usage:
  node scripts/admin-bootstrap.mjs --email <owner email> --name "<name>"
  node scripts/admin-bootstrap.mjs --reset <email> [--remove-2fa]`;

let args;
try {
  args = parseArgs(process.argv.slice(2), { values: ["email", "name", "reset"], flags: ["remove-2fa", "help"] });
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const bootstrap = typeof args.email === "string";
  const reset = typeof args.reset === "string";
  if (bootstrap === reset || (bootstrap && typeof args.name !== "string") || (bootstrap && args["remove-2fa"])) throw new Error("Invalid options.");
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

const minutesLeft = (date) => Math.round((date.getTime() - Date.now()) / 60_000);
let code = 0;
try {
  if (typeof args.email === "string") {
    const result = await bootstrapOwner(context.deps, { email: args.email, displayName: args.name }, context.operator);
    if (result.kind === "owner_exists") {
      console.error("Refused: an active Owner already exists. An Owner invites further users from the admin.");
      code = 2;
    } else if (result.kind === "email_in_use") {
      console.error("Refused: an account with this email already exists. For a locked-out Owner use --reset <email>.");
      code = 2;
    } else if (result.kind === "invalid") {
      console.error(result.field === "email" ? "Refused: the email address is not valid." : "Refused: the name is empty or too long.");
      code = 1;
    } else {
      console.log(result.kind === "created" ? "Owner invited." : "Owner setup link renewed (the previous link no longer works).");
      console.log(`Open this link within ${minutesLeft(result.expiresAt)} minutes to choose the Owner's password (it works once):`);
      console.log(`\n  ${result.link}\n`);
      console.log("Then sign in at /admin/login and set up two-factor authentication (required for the Owner).");
    }
  } else {
    const result = await recoveryReset(context.deps, { email: args.reset, removeMfa: Boolean(args["remove-2fa"]) }, context.operator);
    if (result.kind === "not_found") {
      console.error("Refused: no account with this email.");
      code = 2;
    } else if (result.kind === "not_active") {
      console.error(`Refused: the account is ${result.status}, not active.`);
      code = 2;
    } else {
      console.log(
        `Account unlocked; ${result.sessionsRevoked} session(s) signed out${result.mfaRemoved ? "; two-factor authentication removed" : ""}.`,
      );
      console.log(`Open this link within ${minutesLeft(result.expiresAt)} minutes to choose a new password (it works once):`);
      console.log(`\n  ${result.link}\n`);
    }
  }
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close().catch(() => {});
}
process.exit(code);
