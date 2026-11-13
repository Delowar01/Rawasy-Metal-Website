/**
 * A9.2 — imports today's website (src/content, the dictionaries) into the CMS and publishes it through A8's pipeline
 * (src/server/migration/importer.ts). Run it by hand on the server (never at app start, never on a schedule), after the
 * migrations and the release media import (`npm run media:import-release`), as an existing active Owner account:
 *
 *   npm run content:import -- --owner=<email>                        import, publish, report
 *   npm run content:import -- --owner=<email> --dry-run              everything, then rolled back: nothing written
 *   npm run content:import -- --owner=<email> --legal-reviewer="…"   also publish the legal pages (who reviewed them)
 *   npm run content:import -- --owner=<email> --report=<file.json>   also write the full report as JSON
 *
 * All or nothing: the first refusal rolls the whole import back. Repeatable: what the import wrote and nobody changed is
 * updated only when today's source changed; anything else is left as it is and listed. Locally:
 * `node --env-file=.env.local scripts/content-import.mjs --owner=…`.
 *
 * Exit codes: 0 done · 1 usage or configuration · 2 refused (nothing written) · 3 database error.
 */

// Node warns that the shared modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));

const { writeFileSync } = await import("node:fs");
const { cliContext, cliDbError, parseArgs } = await import("../src/server/cli/runtime.ts");
const { runContentImport } = await import("../src/server/migration/importer.ts");
const { staticContentSet } = await import("../src/content/static-set.ts");
const { ulid } = await import("../src/server/security/ids.ts");

let args;
try {
  args = parseArgs(process.argv.slice(2), { values: ["owner", "legal-reviewer", "report"], flags: ["dry-run"] });
  if (typeof args.owner !== "string" || !args.owner.includes("@")) throw new Error("--owner=<email> is required (an active Owner account).");
} catch (error) {
  console.error(`${error.message}\nUsage: node scripts/content-import.mjs --owner=<email> [--dry-run] [--legal-reviewer=<name>] [--report=<file.json>]`);
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
  const report = await runContentImport(context.deps, staticContentSet(), {
    ownerEmail: args.owner,
    operator: context.operator,
    legalReviewer: typeof args["legal-reviewer"] === "string" ? args["legal-reviewer"] : null,
    requestId: ulid(),
    dryRun: args["dry-run"] === true,
  });
  if (typeof args.report === "string") writeFileSync(args.report, JSON.stringify(report, null, 1), { mode: 0o600 });
  if (!report.ok) {
    console.error(`Refused at ${report.failure.stage} (${report.failure.unit}): ${report.failure.message}`);
    console.error("Nothing was written.");
    code = 2;
  } else {
    console.log(report.dryRun ? "Dry run — nothing was written. What the import would do:" : "Imported.");
    const cols = ["source", "created", "updated", "unchanged", "leftAsTheyAre", "publishedNow", "live"];
    console.log(`${"type".padEnd(18)} ${["source", "created", "updated", "unchanged", "left", "published", "live"].map((c) => c.padStart(9)).join(" ")}`);
    for (const r of report.reconciliation) console.log(`${r.type.padEnd(18)} ${cols.map((c) => String(r[c]).padStart(9)).join(" ")}`);
    const kept = report.units.filter((u) => u.outcome === "edited_kept" || u.outcome === "conflict");
    for (const u of kept) console.log(`  left as it is: ${u.type} ${u.key} (${u.outcome === "conflict" ? "not written by the import" : "changed since the import"})${u.notes.length ? ` — ${u.notes.join("; ")}` : ""}`);
    for (const u of report.units.filter((x) => !x.published && x.notes.length && x.outcome !== "edited_kept" && x.outcome !== "conflict")) console.log(`  ${u.type} ${u.key}: ${u.notes.join("; ")}`);
    for (const note of report.notes) console.log(`  note: ${note}`);
    if (report.missingReferences.length) console.log(`  ${report.missingReferences.length} published reference(s) point at unpublished records.`);
  }
} catch (error) {
  console.error(cliDbError(error));
  code = 3;
} finally {
  await context.close().catch(() => {});
}
process.exit(code);
