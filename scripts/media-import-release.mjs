/**
 * Registers today's release media (the 143 files of public/media) in the media library (A4 brief §11–§14), from the
 * committed baseline src/server/media/release-baseline.json. Idempotent (matched by legacy key); fails closed (any
 * file or record that differs stops the run with nothing written); never moves or rewrites a file. Run from the app
 * folder (it reads public/media); locally: `node --env-file=.env.local scripts/media-import-release.mjs`.
 *
 *   npm run media:import-release                       register what is missing; report the rest
 *   npm run media:import-release -- --dry-run          what would happen, nothing written
 *   npm run media:import-release -- --refresh=<key>    take a changed release file as the new one (regenerate the
 *                                                       baseline first; an approved item returns to review)
 *
 * Exit codes: 0 done (or nothing to do) · 1 usage or configuration · 2 verification failed (nothing written) ·
 * 3 database error.
 */

// Node warns that the shared modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { readFileSync } = await import("node:fs");
const { join, resolve, dirname } = await import("node:path");
const { fileURLToPath } = await import("node:url");
const { cliContext, cliDbError, parseArgs } = await import("../src/server/cli/runtime.ts");
const { importRelease, parseBaseline } = await import("../src/server/media/release.ts");
const { ulid } = await import("../src/server/security/ids.ts");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let args;
try {
  args = parseArgs(process.argv.slice(2), { values: ["refresh"], flags: ["dry-run"], multi: ["refresh"] });
} catch (error) {
  console.error(`${error.message}\nUsage: node scripts/media-import-release.mjs [--dry-run] [--refresh=<legacy key>]…`);
  process.exit(1);
}

let baseline;
try {
  baseline = parseBaseline(JSON.parse(readFileSync(join(root, "src/server/media/release-baseline.json"), "utf8")));
} catch (error) {
  console.error(`The release baseline is not valid: ${error.message.split("\n")[0]}`);
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
  const report = await importRelease(context.deps.pool, context.deps.db, baseline, {
    releaseDir: join(process.cwd(), "public"),
    actor: { type: "cli", label: context.operator },
    requestId: ulid(),
    now: new Date(),
    dryRun: args["dry-run"] === true,
    refresh: args.refresh ?? [],
  });
  if (report.problems.length) {
    console.error(`Nothing was written. ${report.problems.length} problem(s):`);
    for (const problem of report.problems) console.error(`  - ${problem}`);
    code = 2;
  } else {
    const verb = args["dry-run"] ? "Would register" : "Registered";
    console.log(`${verb} ${report.created.length} item(s); ${report.refreshed.length} refreshed; ${report.unchanged.length} unchanged (of ${baseline.count}).`);
    for (const key of report.refreshed) console.log(`  refreshed: ${key}`);
  }
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close().catch(() => {});
}
process.exit(code);
