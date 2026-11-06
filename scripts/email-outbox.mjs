/**
 * The outgoing-mail queue (A7.6; A1 `email_outbox`): sends what is due, once — retries back off, a row is failed after
 * five attempts. Run by hand (`npm run email:outbox`); a schedule (the host's cron) is pre-staging work for the Owner.
 * Locally: `node --env-file=.env.local scripts/email-outbox.mjs`.
 *
 * The transport is A2's mailer (MAIL_TRANSPORT): `disabled` (default and the only one outside local development) sends
 * nothing — rows stay pending and say "mail_disabled"; `sink` (APP_ENV=local only) writes JSON files to MAIL_SINK_DIR.
 * No SMTP exists until the Owner chooses a provider (A7 report, item 9). Prints counts only, never an address or body.
 * Exit codes: 0 done · 1 configuration · 3 database error.
 */

const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { cliContext, cliDbError, parseArgs } = await import("../src/server/cli/runtime.ts");
const { processOutbox } = await import("../src/server/enquiries/outbox.ts");

try {
  parseArgs(process.argv.slice(2), { values: [], flags: [] });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let context;
try {
  context = cliContext();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let code = 0;
try {
  const report = await processOutbox(context.deps.db, context.deps.mailer, new Date());
  if (!context.deps.mailer.configured) console.log(`Mail is off (MAIL_TRANSPORT=disabled): nothing sent; ${report.waiting} notification(s) wait.`);
  else console.log(`Outbox: ${report.claimed} due, ${report.sent} sent, ${report.retrying} to retry later, ${report.failed} failed after five attempts.`);
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close();
}
process.exit(code);
