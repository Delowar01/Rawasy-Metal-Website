/**
 * A9 F-1 (the staging preflight): in a database-content release a fixed page that is not live (the legal pages until
 * a legal reviewer is named, or any fixed page taken offline) calls notFound(), and with no not-found boundary above it
 * Next.js answered with its own bare English 404. Each fixed route now has a boundary that only a database build sees
 * (`not-found.db.tsx`, src/content/live/fixed-not-found.tsx); a static build must not see it at all, so the static
 * release stays exactly as it was. These tests pin both halves: the configuration of each kind of release, and the
 * inventory of the boundaries against the fixed routes. (What a visitor gets is in e2e-dbmode/publish-flow.spec.ts.)
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, test } from "node:test";

const ROOT = resolve(import.meta.dirname, "../..");
const LOCALE_TREE = join(ROOT, "src/app/(commerce)/[locale]");
const require = createRequire(import.meta.url);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * The configuration Next.js itself loads for a release of this kind: its own loader compiling next.config.ts, in a
 * process of its own (Next.js keeps the first configuration it loads in a process).
 */
function configFor(source: "static" | "database"): { pageExtensions: string[] } {
  const script = `require("next/dist/server/config.js").default("phase-production-build", ${JSON.stringify(ROOT)}).then((c) => process.stdout.write(JSON.stringify({ pageExtensions: c.pageExtensions })))`;
  const out = execFileSync(process.execPath, ["-e", script], {
    cwd: ROOT,
    env: { ...process.env, CONTENT_SOURCE: source, NEXT_PUBLIC_SITE_URL: "https://www.rawasymetal.com" },
    encoding: "utf8",
  });
  return JSON.parse(out.slice(out.indexOf("{")));
}

/** The extension Next.js reads from a convention file's name: everything after the first dot (its own helper). */
function conventionExtension(file: string): { base: string; extension: string } {
  const { getConventionFileBaseName } = require("next/dist/build/get-convention-file-base-name.js") as { getConventionFileBaseName: (name: string) => string };
  const base = getConventionFileBaseName(file);
  return { base, extension: file.slice(base.length + 1) };
}

/** Every page file under the locale that decides on a fixed page (`ensureContent("<key>")`), with its key. */
const fixedPages = walk(LOCALE_TREE)
  .filter((file) => file.endsWith("/page.tsx"))
  .flatMap((file) => {
    const key = /ensureContent\("([a-z_]+)"\)/.exec(readFileSync(file, "utf8"))?.[1];
    return key ? [{ file, dir: dirname(file), key }] : [];
  });

describe("A9 F-1: the fixed pages' localized 404 in a database-content release", () => {
  test("only a database build reads the boundaries' extension; a static build keeps Next.js's defaults", () => {
    const database = configFor("database");
    const staticRelease = configFor("static");
    assert.deepEqual(staticRelease.pageExtensions, ["tsx", "ts", "jsx", "js"]);
    assert.ok(database.pageExtensions.includes("db.tsx"), "a database build reads not-found.db.tsx");
    for (const ext of staticRelease.pageExtensions) assert.ok(database.pageExtensions.includes(ext), `a database build still reads .${ext}`);

    // Next.js's own reading of the file name: a convention named "not-found" whose extension is "db.tsx".
    assert.deepEqual(conventionExtension("not-found.db.tsx"), { base: "not-found", extension: "db.tsx" });
    assert.ok(!staticRelease.pageExtensions.includes(conventionExtension("not-found.db.tsx").extension), "a static build never takes it for a not-found file");
    assert.deepEqual(conventionExtension("page.tsx"), { base: "page", extension: "tsx" });
  });

  test("every fixed page has a not-found boundary beside it, and a database-only one names its own page", () => {
    assert.ok(fixedPages.length >= 12, `found ${fixedPages.length} fixed pages`);
    for (const page of fixedPages) {
      const where = relative(LOCALE_TREE, page.dir) || "(the homepage)";
      const own = join(page.dir, "not-found.tsx");
      const database = join(page.dir, "not-found.db.tsx");
      const hasOwn = (() => {
        try {
          return statSync(own).isFile();
        } catch {
          return false;
        }
      })();
      if (hasOwn) continue; // A boundary both kinds of release see (the project pages' own, since TM-2.6).
      const source = readFileSync(database, "utf8");
      assert.match(source, new RegExp(`fixedPageBoundary\\("${page.key}"\\)`), `${where}: the boundary decides on "${page.key}"`);
      assert.match(source, /export default boundary\.FixedPageNotFound;/, where);
      assert.match(source, /export const generateMetadata = boundary\.generateMetadata;/, where);
    }
  });

  test("the extension is used for these boundaries and nothing else", () => {
    const dbFiles = walk(join(ROOT, "src"))
      .filter((file) => /\.db\.[a-z]+$/.test(file))
      .sort();
    const expected = fixedPages
      .filter((page) => !readdirSync(page.dir).includes("not-found.tsx"))
      .map((page) => join(page.dir, "not-found.db.tsx"))
      .sort();
    assert.deepEqual(dbFiles.map((file) => relative(ROOT, file)), expected.map((file) => relative(ROOT, file)));
  });

  test("the boundary draws the existing localized 404, decided on the request's own content", () => {
    const helper = readFileSync(join(ROOT, "src/content/live/fixed-not-found.tsx"), "utf8");
    // The (missing) group's page itself, unchanged — no second 404 design.
    assert.match(helper, /from "@\/app\/\(commerce\)\/\[locale\]\/\(missing\)\/not-found"/);
    // The same per-request read the page decides on (never the module's last load).
    assert.match(helper, /await isLiveForRequest\(page\)\) return null/);
    const loader = readFileSync(join(ROOT, "src/content/live/load.ts"), "utf8");
    assert.match(loader, /export async function isLiveForRequest\(page: string\): Promise<boolean> \{\n {2}return \(await current\(\)\)\.livePages\.has\(page\);/);
  });
});
