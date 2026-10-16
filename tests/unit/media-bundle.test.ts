/**
 * Media library (A4) — sharp stays out of the bundler's module graph (the public freeze, report item 45).
 *
 * A static `import sharp from "sharp"` (or any `import("sharp")` the bundler resolves) makes Turbopack load sharp's ES
 * module entry as an external ES module, which is an "async module"; one async module anywhere in the module graph adds
 * Turbopack's async-module code to the browser runtime of every page, the public site's included (+1,225 bytes on all
 * 104 public pages, measured on `ead98a9`). Only `loadSharp()` in `src/server/media/images.ts` loads sharp, through an
 * `import()` the bundler leaves as written (`turbopackIgnore`); everything else may import its types only.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, test } from "node:test";

const ROOT = resolve(import.meta.dirname, "../..");
const LOADER = "src/server/media/images.ts";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(entry.name) ? [path] : [];
  });
}

/** Every place a source file names the module `sharp`, with how it does. */
function sharpReferences(text: string) {
  const found: { kind: "type import" | "value import" | "dynamic import" | "require" | "re-export"; text: string }[] = [];
  for (const m of text.matchAll(/^\s*import\s+(type\s+)?[^;]*?\bfrom\s*["']sharp["']/gm)) found.push({ kind: m[1] ? "type import" : "value import", text: m[0].trim() });
  for (const m of text.matchAll(/^\s*import\s*["']sharp["']/gm)) found.push({ kind: "value import", text: m[0].trim() });
  for (const m of text.matchAll(/^\s*export\s+[^;]*?\bfrom\s*["']sharp["']/gm)) found.push({ kind: "re-export", text: m[0].trim() });
  // `typeof import("sharp")` is a type (erased); any other `import("sharp")` loads the module at run time.
  for (const m of text.matchAll(/(\btypeof\s+)?\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*["']sharp["']\s*\)/g)) found.push({ kind: m[1] ? "type import" : "dynamic import", text: m[0] });
  for (const m of text.matchAll(/\brequire\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*["']sharp["']\s*\)/g)) found.push({ kind: "require", text: m[0] });
  return found;
}

describe("sharp is never part of the bundler's module graph (A4 public freeze)", () => {
  const files = sources(join(ROOT, "src")).map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));

  test("outside the loader, application code imports sharp's types only", () => {
    assert.ok(files.length > 100, "the application's sources were read");
    for (const { path, text } of files) {
      if (path === LOADER) continue;
      for (const ref of sharpReferences(text)) assert.equal(ref.kind, "type import", `${path}: ${ref.text}`);
    }
  });

  test("the loader has no value import and loads sharp once, through an import the bundler leaves as written", () => {
    const text = readFileSync(join(ROOT, LOADER), "utf8");
    const refs = sharpReferences(text);
    assert.deepEqual(refs.filter((r) => r.kind !== "type import" && r.kind !== "dynamic import"), [], "no static value import, re-export or require");
    const dynamic = refs.filter((r) => r.kind === "dynamic import");
    assert.equal(dynamic.length, 1, "one dynamic import");
    assert.match(dynamic[0].text, /\/\*\s*turbopackIgnore:\s*true\s*\*\//, "the bundler is told to leave it as written");
    // Its settings (one thread, no cache) apply when an image is processed, never when the module is loaded.
    assert.doesNotMatch(text.replace(/^\s*(\/\/|\*|\/\*).*$/gm, ""), /^sharp\.(concurrency|cache)\(/m);
  });
});
