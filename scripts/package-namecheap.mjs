/**
 * Packs the production build for Namecheap Stellar Plus (cPanel → Setup Node.js App) and checks the archive. Deployment
 * only: nothing in the website runs or imports it.
 *
 *   npm ci
 *   NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build
 *   node scripts/package-namecheap.mjs                     writes ../rawasy-app.tar.gz and checks it
 *   node scripts/package-namecheap.mjs --out=<file>        writes the archive there instead
 *   node scripts/package-namecheap.mjs --check=<archive>   only checks an archive made from this folder's build
 *
 * The archive holds what the host needs to run the build with `node server.js` (the README's "Namecheap Stellar Plus
 * deployment"), less the photos RAWASY has held back: `withheldMedia` and every photo of a project whose flags keep its
 * photos off the website (`projectDetailMedia` shows none of them), from src/content/projects.ts, each mapped to its
 * file through the media registry (src/content/media.generated.ts). The pages never show them; without the files the
 * host cannot serve them either. Pack right after the build; a server that has run on this folder wrote its route cache
 * into `.next/server/route-cache`, which the archive leaves out like `.next/cache` (nothing else in `.next` changes).
 *
 * The archive's listing is written beside it (<archive>.txt). The check fails (and a packing run deletes the archive)
 * unless:
 *  - none of the held-back files is in it, and no page of the build refers to one;
 *  - every file of public/ that the build's pages, page data, styles and scripts refer to is in it;
 *  - every sitemap page's prerendered HTML and page data are in it, with every public file each one refers to;
 *  - it holds exactly the INCLUDE files below, less SKIP and the held-back files: nothing else left out, nothing added
 *    (no .next/cache, route cache, node_modules, .git, .env file, tests or docs).
 * Needs Node 22.18 or later (the content modules are TypeScript, read with Node's type stripping) and tar.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Node warns that the content modules are TypeScript in a package without "type"; that warning only (others print).
const warn = process.rawListeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code === "MODULE_TYPELESS_PACKAGE_JSON" || warn.forEach((listener) => listener(w)));
const { projects, withheldMedia, projectDetailMedia } = await import("../src/content/projects.ts");
const { mediaRegistry } = await import("../src/content/media.generated.ts");

/** What the host needs: the server, the files Run NPM Install reads, the build and what Next.js reads when it starts. */
const INCLUDE = ["server.js", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "next-env.d.ts",
  "postcss.config.mjs", ".nvmrc", "src", "public", ".next"];
/** Left behind: the build cache (the host fills its own) and the route cache a server writes into `.next` as it runs. */
const SKIP = [".next/cache", ".next/server/route-cache"];
/** Never in an archive for the host. */
const FORBIDDEN =
  /^(?:node_modules|\.git|\.next\/cache|\.next\/server\/route-cache|e2e|docs|scripts|test-results|playwright-report)(?:\/|$)|(?:^|\/)\.env(?:\.|$)/;

const args = process.argv.slice(2);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const checkOnly = option("check");
const out = resolve(checkOnly ?? option("out") ?? join(root, "..", "rawasy-app.tar.gz"));
if (args.some((a) => !/^--(?:out|check)=./.test(a))) {
  console.error("Usage: node scripts/package-namecheap.mjs [--out=<archive> | --check=<archive>]");
  process.exit(2);
}
if (!existsSync(join(root, ".next/BUILD_ID"))) {
  console.error("No build in this folder: run `npm run build` first.");
  process.exit(2);
}
if (checkOnly && !existsSync(out)) {
  console.error(`${out} does not exist.`);
  process.exit(2);
}

/** Files (not folders) under a project-relative path, with forward slashes, in a stable order. */
const walk = (rel) =>
  lstatSync(join(root, rel)).isDirectory() ? readdirSync(join(root, rel)).sort().flatMap((name) => walk(`${rel}/${name}`)) : [rel];
const skipped = (rel) => SKIP.some((p) => rel === p || rel.startsWith(`${p}/`));

// The held-back photos and their files: the registry's own paths, never a guessed name.
const heldIds = new Set(withheldMedia);
for (const project of projects) {
  const shown = new Set(projectDetailMedia(project));
  for (const id of project.media) if (!shown.has(id)) heldIds.add(id);
}
const held = [...heldIds].sort().map((id) => {
  const src = mediaRegistry[id]?.src;
  if (!src || !existsSync(join(root, "public", src))) {
    console.error(`${id}: ${src ? `public${src} does not exist` : "not in the media registry"}`);
    process.exit(1);
  }
  return `public${src}`;
});

console.log(`Held back (${held.length} files: projects.ts through the media registry):`);
for (const file of held) console.log(`  ${file}`);

if (!checkOnly) {
  if (INCLUDE.some((p) => out.startsWith(join(root, p) + sep))) {
    console.error("Write the archive outside src, public and .next.");
    process.exit(2);
  }
  // The exclusions come before the names: GNU tar applies an --exclude only to the names after it.
  const tar = ["-czf", out, ...SKIP.map((p) => `--exclude=${p}`), ...held.map((f) => `--exclude=${f}`), ...INCLUDE];
  console.log(`\ntar ${tar.join(" ")}`);
  execFileSync("tar", tar, { cwd: root, stdio: "inherit" });
}

// The listing, with folders told apart from files (some tar programs print a folder without its trailing slash).
const entries = execFileSync("tar", ["-tzf", out], { maxBuffer: 256 * 1024 * 1024, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .map((e) => e.replace(/^\.\//, ""));
writeFileSync(`${out}.txt`, `${entries.join("\n")}\n`);
const names = entries.map((e) => e.replace(/\/$/, ""));
const folders = new Set(entries.filter((e) => e.endsWith("/")).map((e) => e.slice(0, -1)));
for (const name of names) for (let i = name.indexOf("/"); i > 0; i = name.indexOf("/", i + 1)) folders.add(name.slice(0, i));
const files = new Set(names.filter((n) => !folders.has(n)));
const archiveBuild = files.has(".next/BUILD_ID") ? execFileSync("tar", ["-xzOf", out, ".next/BUILD_ID"], { encoding: "utf8" }).trim() : "";
const buildId = readFileSync(join(root, ".next/BUILD_ID"), "utf8").trim();

const failures = [];
const check = (ok, line, problems = []) => {
  console.log(`${ok ? "✓" : "✗"} ${line}`);
  for (const p of problems.slice(0, 20)) console.log(`    ${p}`);
  if (problems.length > 20) console.log(`    … and ${problems.length - 20} more`);
  if (!ok) failures.push(line);
};

const bytes = readFileSync(out);
console.log(`\nArchive: ${out}`);
console.log(`  ${(bytes.length / 1024 / 1024).toFixed(1)} MB · sha256 ${createHash("sha256").update(bytes).digest("hex")}`);
const tops = {};
for (const f of files) tops[f.split("/")[0]] = (tops[f.split("/")[0]] ?? 0) + 1;
console.log(`  ${files.size} files: ${Object.entries(tops).map(([t, n]) => `${t} ${n}`).join(" · ")}`);
console.log(`  listing: ${out}.txt\n`);

check(archiveBuild === buildId, `the archive's build (${archiveBuild || "none"}) is this folder's build (${buildId})`);

// What the archive must hold: every file under INCLUDE, less SKIP and the held-back files.
const heldSet = new Set(held);
const expected = INCLUDE.filter((p) => existsSync(join(root, p))).flatMap(walk).filter((f) => !skipped(f) && !heldSet.has(f));
const expectedSet = new Set(expected);
check(held.every((f) => !files.has(f)), `held-back files in the archive: ${held.filter((f) => files.has(f)).length} of ${held.length}`,
  held.filter((f) => files.has(f)));
check(INCLUDE.every((p) => files.has(p) || folders.has(p)), `every packed name is there: ${INCLUDE.join(" ")}`,
  INCLUDE.filter((p) => !files.has(p) && !folders.has(p)));
check(expected.every((f) => files.has(f)), `nothing else left out: ${expected.filter((f) => files.has(f)).length} of ${expected.length} files`,
  expected.filter((f) => !files.has(f)));
check([...files].every((f) => expectedSet.has(f)), `nothing added: ${[...files].filter((f) => !expectedSet.has(f)).length} unexpected files`,
  [...files].filter((f) => !expectedSet.has(f)));
check(names.every((n) => !FORBIDDEN.test(n)), "no node_modules, .next/cache, route cache, .git, .env file, tests or docs",
  names.filter((n) => FORBIDDEN.test(n)));

// Every public file the build refers to: in the prerendered pages, their page data and the files the server answers
// with (.html, .rsc, .body), and in the browser's styles and scripts. Paths appear as written ("/media/x.webp") or
// encoded in an optimized image's address ("/_next/image?url=%2Fmedia%2Fx.webp").
const publicFiles = new Set(walk("public").map((f) => f.slice("public".length)));
const topNames = readdirSync(join(root, "public")).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const REF = new RegExp(`(?:/|%2F)(?:${topNames.join("|")})(?:(?:/|%2F)[A-Za-z0-9._~-]+)*`, "gi");
const refsIn = (rel) => {
  const found = new Set();
  for (const m of readFileSync(join(root, rel), "latin1").matchAll(REF)) {
    const path = m[0].replace(/%2F/gi, "/");
    if (publicFiles.has(path)) found.add(`public${path}`);
  }
  return found;
};
const served = [
  ...walk(".next/server/app").filter((f) => /\.(?:html|rsc|body)$/.test(f)),
  ...walk(".next/static").filter((f) => /\.(?:js|css)$/.test(f)),
];
const used = new Set();
for (const f of served) for (const ref of refsIn(f)) used.add(ref);
const usedHeld = held.filter((f) => used.has(f));
check(usedHeld.length === 0, `pages, page data, styles or scripts referring to a held-back file: ${usedHeld.length}`, usedHeld);
const usedMissing = [...used].filter((f) => !files.has(f));
const byTop = {};
for (const f of used) byTop[f.split("/")[1]] = (byTop[f.split("/")[1]] ?? 0) + 1;
check(usedMissing.length === 0,
  `public files the build refers to, in the archive: ${used.size - usedMissing.length} of ${used.size} (${Object.entries(byTop).map(([t, n]) => `${t} ${n}`).join(", ")}; ${served.length} files read)`,
  usedMissing);

// Every sitemap page: its prerendered HTML and page data, and every public file they refer to.
const sitemap = readFileSync(join(root, ".next/server/app/sitemap.xml.body"), "utf8");
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const pageProblems = [];
let pageRefs = 0;
const pageFiles = new Set();
for (const path of pages) {
  const base = `.next/server/app${path}`;
  for (const f of [`${base}.html`, `${base}.rsc`]) if (!files.has(f)) pageProblems.push(`${path}: ${f} is not in the archive`);
  const own = [`${base}.html`, `${base}.rsc`, ...(existsSync(join(root, `${base}.segments`)) ? walk(`${base}.segments`) : [])];
  const refs = new Set();
  for (const f of own.filter((f) => existsSync(join(root, f)))) for (const ref of refsIn(f)) refs.add(ref);
  pageRefs += refs.size;
  for (const ref of refs) {
    pageFiles.add(ref);
    if (!files.has(ref)) pageProblems.push(`${path}: ${ref} is not in the archive`);
    if (heldSet.has(ref)) pageProblems.push(`${path}: refers to held-back ${ref}`);
  }
}
check(pages.length > 0 && pageProblems.length === 0,
  `sitemap pages: ${pages.length}, each with its HTML and page data and the ${pageRefs} public file references they make (${pageFiles.size} files) in the archive`,
  pageProblems);

const unused = [...publicFiles].map((p) => `public${p}`).filter((f) => !used.has(f) && !heldSet.has(f));
console.log(`\nIn the archive, referred to by no page (kept, like the rest of public/): ${unused.length}`);
for (const f of unused) console.log(`  ${f}`);

if (failures.length) {
  if (!checkOnly) {
    unlinkSync(out);
    unlinkSync(`${out}.txt`);
  }
  console.log(`\nFAIL: ${failures.length} check${failures.length > 1 ? "s" : ""} failed${checkOnly ? "" : "; the archive was deleted"}.`);
  process.exit(1);
}
console.log(`\nPASS: every check passed for ${out}.`);
