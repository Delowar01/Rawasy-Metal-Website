/**
 * Enquiry retention (A7.8): a report of what a retention period would anonymize, and — only with `--apply` — the
 * anonymization. Inactive today: no period is chosen (the Owner decides one, with legal review), so the report lists
 * nothing and `--apply` refuses. Never scheduled; run by hand. Locally: `node --env-file=.env.local scripts/…`.
 *
 *   npm run enquiries:retention                 report only (nothing changed)
 *   npm run enquiries:retention -- --apply      anonymize what is past its keep-until date (audited, counts only)
 *
 * Anonymizing empties an enquiry's personal fields, deletes its notes and its files (disk and rows) and clears its
 * notification bodies; the reference, dates, status and history stay. Prints references and counts — never personal data.
 * Exit codes: 0 done · 1 usage or configuration · 2 no retention period chosen (with --apply) · 3 database error ·
 * 4 done, but some attachment files could not be removed (their keys are printed; the media maintenance report lists them).
 */

const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { cliContext, cliDbError, parseArgs } = await import("../src/server/cli/runtime.ts");
const { applyRetention, planRetention } = await import("../src/server/enquiries/retention.ts");
const { mediaStore, StorageConfigError } = await import("../src/server/media/storage.ts");

let args;
try {
  args = parseArgs(process.argv.slice(2), { values: ["form"], flags: ["apply"] });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const formKey = args.form ?? "quote";

let context;
try {
  context = cliContext();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let code = 0;
try {
  const plan = await planRetention(context.deps.db, formKey, new Date());
  if (plan.retentionDays === null) {
    console.log(`No retention period is chosen for the form "${formKey}": nothing is due, nothing is anonymized.`);
    if (args.apply) code = 2;
  } else {
    console.log(`Retention period: ${plan.retentionDays} days. Due now: ${plan.due.length} enquir${plan.due.length === 1 ? "y" : "ies"}.`);
    for (const item of plan.due.slice(0, 200)) console.log(`  ${item.reference} (keep until ${item.keepUntil})`);
    if (args.apply) {
      let store = null;
      try {
        store = await mediaStore();
      } catch (error) {
        if (!(error instanceof StorageConfigError)) throw error;
        console.error(`${error.message} Attachment files can't be removed; refusing.`);
        code = 1;
      }
      if (code === 0) {
        const run = await applyRetention(context.deps, store, formKey, context.operator);
        if (run.kind === "done") {
          console.log(`Anonymized ${run.anonymized} enquir${run.anonymized === 1 ? "y" : "ies"}; removed ${run.files} file(s).`);
          if (run.failedFiles.length) {
            console.error(`${run.failedFiles.length} attachment file(s) could not be removed (keys only):`);
            for (const key of run.failedFiles) console.error(`  enquiries/${key}`);
            code = 4;
          }
        }
      }
    }
  }
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close();
}
process.exit(code);
