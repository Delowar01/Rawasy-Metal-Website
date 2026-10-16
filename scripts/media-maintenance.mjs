/**
 * Media maintenance (A4 brief §59–§62): a report, and repairs only when asked. No schedule: run it by hand (a cron job
 * is pre-staging work for the Owner). Locally: `node --env-file=.env.local scripts/media-maintenance.mjs …`.
 *
 *   npm run media:maintenance                         report only (nothing changed); saved for the admin dashboard
 *   npm run media:maintenance -- --clean-tmp          also remove temporary uploads older than 24 hours
 *   npm run media:maintenance -- --fail-stuck         also mark processing older than 15 minutes failed
 *   npm run media:maintenance -- --regenerate=<id>    regenerate one item's variants from its original (repeatable)
 *   npm run media:maintenance -- --regenerate-all     … every uploaded public image
 *   npm run media:maintenance -- --rebuild-public     rebuild public_media for every item
 *   npm run media:maintenance -- --purge-dry-run      list old versions past the 30-day retention (purging is
 *                                                     disabled in A4: nothing is ever deleted by this tool)
 *
 * Files on disk without a record are reported, never deleted. Prints ids, counts and areas — never a server path.
 * Exit codes: 0 nothing to look at · 1 usage or configuration · 2 the report lists problems · 3 database error.
 */

// Node warns that the shared modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { join } = await import("node:path");
const { cliContext, cliDbError, parseArgs } = await import("../src/server/cli/runtime.ts");
const maintenance = await import("../src/server/media/maintenance.ts");
const { mediaStore, StorageConfigError } = await import("../src/server/media/storage.ts");
const { isUlid } = await import("../src/server/security/ids.ts");

let args;
try {
  args = parseArgs(process.argv.slice(2), {
    values: ["regenerate"],
    flags: ["clean-tmp", "fail-stuck", "regenerate-all", "rebuild-public", "purge-dry-run"],
    multi: ["regenerate"],
  });
  for (const id of args.regenerate ?? []) if (!isUlid(id)) throw new Error(`--regenerate needs a media id (ULID): ${id}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let context;
let store = null;
try {
  context = cliContext();
  store = await mediaStore();
} catch (error) {
  if (error instanceof StorageConfigError) console.error(`${error.message} The report covers the database and release files only.`);
  else {
    console.error(error.message);
    process.exit(1);
  }
}

const ctx = () => ({
  pool: context.deps.pool,
  db: context.deps.db,
  store,
  releaseDir: join(process.cwd(), "public"),
  now: new Date(),
  actor: { type: "cli", label: context.operator },
});

let code = 0;
try {
  let report = await maintenance.scanMedia(ctx());
  if (args["clean-tmp"]) console.log(`Removed ${await maintenance.cleanTmp(ctx(), report)} abandoned temporary upload(s).`);
  if (args["fail-stuck"]) console.log(`Marked ${await maintenance.failStuck(ctx())} stuck file(s) failed.`);
  const regenerate = args["regenerate-all"]
    ? (await context.deps.db.select().from((await import("../src/server/db/schema-media.ts")).mediaAssets)).filter((a) => a.kind === "image" && a.visibility === "public").map((a) => a.id)
    : (args.regenerate ?? []);
  for (const id of regenerate) console.log(`Regenerate ${id}: ${await maintenance.regenerateVariants(ctx(), id)}.`);
  if (args["rebuild-public"]) console.log(`Rebuilt public_media: ${await maintenance.rebuildPublicMedia(ctx())} row(s) changed.`);
  if (args["clean-tmp"] || args["fail-stuck"] || regenerate.length || args["rebuild-public"]) report = await maintenance.scanMedia(ctx());
  if (store) await maintenance.saveReport(store, report);
  console.log(`Media maintenance report (${report.at}):`);
  console.log(`  temporary uploads: ${report.tmp.open} open, ${report.tmp.abandoned.length} abandoned (older than 24 h), ${report.tmp.other.length} unknown entries`);
  console.log(`  processing: ${report.stuck.length} stuck (older than 15 min), ${report.failed} failed`);
  console.log(`  records with missing files: ${report.missing.length}`);
  for (const m of report.missing.slice(0, 50)) console.log(`    media ${m.mediaId} version ${m.version}: ${m.what.join(", ")}`);
  console.log(`  files without a record (never deleted): ${report.orphans.length}; entries that are not files: ${report.notFiles.length}`);
  for (const o of [...report.orphans, ...report.notFiles].slice(0, 50)) console.log(`    ${o.area}: ${o.key}`);
  console.log(`  public_media disagreeing with the deliverability rule: ${report.publicMediaDrift.length}`);
  console.log(`  old versions past the 30-day retention (purge candidates; never purged in A4): ${report.purgeCandidates.length}`);
  if (args["purge-dry-run"]) for (const p of report.purgeCandidates) console.log(`    media ${p.mediaId} version ${p.version}: ${p.byteSize} bytes, replaced ${p.supersededAt}`);
  if (maintenance.reportHasProblems(report)) code = 2;
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close().catch(() => {});
}
process.exit(code);
