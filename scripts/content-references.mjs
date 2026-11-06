/**
 * Rebuilds the content reference index whole (A8.3): every aggregate's working references and every live aggregate's
 * published references. Run by hand once after the A8 migration, after a database restore, or when "Used by" looks
 * wrong; never at app start, no schedule. Prints counts only. Locally: `node --env-file=.env.local scripts/…`.
 *
 *   npm run content:references
 *
 * Exit codes: 0 done · 1 configuration · 3 database error.
 */

const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { cliContext, cliDbError } = await import("../src/server/cli/runtime.ts");
const { rebuildAllReferences } = await import("../src/server/publishing/rebuild.ts");

let context;
try {
  context = cliContext();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
let code = 0;
try {
  const report = await rebuildAllReferences(context.deps.pool, context.deps.db, new Date());
  console.log(`Reference index rebuilt: ${report.aggregates} aggregates, ${report.working} working and ${report.published} published references (${report.changed} changed).`);
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close();
}
process.exit(code);
