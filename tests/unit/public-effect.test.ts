/**
 * A9 acceptance review: what the admin says about the public website follows the release's content source
 * (src/server/admin/public-effect.ts). A database-content release must never tell its editors that publishing, a
 * rollback, an unpublication or a media change leaves the public pages alone; a static release keeps its texts.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, test } from "node:test";
import { publicEffectTexts } from "../../src/server/admin/public-effect.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const STATIC = publicEffectTexts(false);
const DATABASE = publicEffectTexts(true);
/** Phrases that say the public website does not read the admin's published versions yet. */
const NOT_YET = /cutover|today's|public read model|keeps its own files|switch, A9/i;

describe("the admin's texts about the public website", () => {
  test("both releases have every text", () => {
    assert.deepEqual(Object.keys(DATABASE).sort(), Object.keys(STATIC).sort());
    for (const [key, text] of [...Object.entries(STATIC), ...Object.entries(DATABASE)]) assert.ok(text.trim().length > 20, key);
  });

  test("a database-content release never says the public website ignores what is published", () => {
    for (const [key, text] of Object.entries(DATABASE)) assert.doesNotMatch(text, NOT_YET, key);
    assert.match(DATABASE.panelPublic, /next request/);
    assert.match(DATABASE.mediaLead, /offline/, "a withdrawn photo on a fixed spot takes its page offline");
  });

  test("a static release still says nothing reaches visitors before the cutover", () => {
    for (const [key, text] of Object.entries(STATIC)) assert.match(text, /cutover|switch, A9/, key);
  });

  test("no admin screen writes the claim itself: every such text comes from the one definition", () => {
    const dirs = ["src/app/(admin)", "src/components/admin", "src/server/admin"].map((d) => join(ROOT, d));
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
    const claim = /content cutover \(A9\)|cutover, A9|cutover \(A9\)|switch, A9|keeps its own files/;
    const found = dirs
      .flatMap(walk)
      .filter((f) => /\.(tsx?|mts)$/.test(f) && !f.endsWith(join("src", "server", "admin", "public-effect.ts")))
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .map((line, i) => ({ f, line, i }))
          .filter(({ line }) => claim.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)),
      )
      .map(({ f, i }) => `${relative(ROOT, f)}:${i + 1}`);
    assert.deepEqual(found, []);
  });
});
