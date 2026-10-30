/**
 * Site controls (A6.5) — redirect addresses as pure functions: the stored form of a typed address (language first, no
 * domain, query, fragment, empty part or trailing slash; one percent-encoding; no control character or invisible
 * formatting mark, typed or %-coded), the readable form the screens show (which types back to the same stored form),
 * "a page answers this address" (a source never may) and "this is a page of the website" (a target always must).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { answeredBy, isLiveAddress, normalizeSitePath, readablePath, type LiveSlugs } from "../../src/server/site/paths.ts";

const ok = (input: string, options?: { allowLocaleRoot?: boolean }) => {
  const result = normalizeSitePath(input, options);
  assert.ok(result.ok, `${input}: ${result.ok ? "" : result.message}`);
  return result.path;
};
const refused = (input: string, options?: { allowLocaleRoot?: boolean }) => {
  const result = normalizeSitePath(input, options);
  assert.ok(!result.ok, `${input} was accepted as ${result.ok ? result.path : ""}`);
  return result.message;
};

describe("normalizeSitePath", () => {
  test("one stored form: trailing slashes go, unreserved characters are decoded, the rest is upper-case %XX", () => {
    assert.equal(ok("/en/old-page/"), "/en/old-page");
    assert.equal(ok("  /en/old-page  "), "/en/old-page");
    assert.equal(ok("/en/%6Fld-page"), "/en/old-page");
    assert.equal(ok("/en/a%2fb"), "/en/a%2Fb");
    assert.equal(ok("/en/old%20page"), "/en/old%20page");
    assert.equal(ok("/ar/صفحة-قديمة"), "/ar/%D8%B5%D9%81%D8%AD%D8%A9-%D9%82%D8%AF%D9%8A%D9%85%D8%A9");
    assert.equal(ok("/ar/%d8%b5%d9%81%d8%ad%d8%a9-%d9%82%d8%af%d9%8a%d9%85%d8%a9"), ok("/ar/صفحة-قديمة"));
    assert.equal(ok("/en/Old_Page.html"), "/en/Old_Page.html");
    assert.equal(ok("/en", { allowLocaleRoot: true }), "/en");
  });

  test("refuses what can't be a redirect's address, each with its reason", () => {
    assert.match(refused(""), /Enter an address/);
    assert.match(refused("https://rawasy.example.test/en/x"), /without the domain/);
    assert.match(refused("//rawasy.example.test/en/x"), /without the domain/);
    assert.match(refused("javascript:alert(1)"), /without the domain/);
    assert.match(refused("en/old"), /Start the address with a slash/);
    assert.match(refused("/en/old?x=1"), /query/);
    assert.match(refused("/en/old#top"), /fragment/);
    assert.match(refused("/en/old page"), /spaces/);
    assert.match(refused("/en/old\\page"), /backslashes/);
    assert.match(refused("/en//old"), /empty parts/);
    assert.match(refused("/fr/old"), /language/);
    assert.match(refused("/old"), /language/);
    assert.match(refused("/en"), /after the language/);
    assert.match(refused("/en/%E0%A4"), /can't be read/);
    assert.match(refused("/en/.."), /can't be read/);
    assert.match(refused("/en/%2e%2e"), /can't be read/);
    assert.match(refused(`/en/${"a".repeat(600)}`), /too long/);
  });

  test("never holds a character that draws nothing (controls, formatting marks, default-ignorables), typed or %-coded", () => {
    // Controls and formatting marks, then the default-ignorable letters and marks the A6 review found accepted before.
    const hidden = ["\u200b", "\u200e", "\u202e", "\u2066", "\ufeff", "\u00ad", "\u0000", "\u007f", "\u0085"];
    const ignorable = ["\u034f", "\ufe0f", "\u3164", "\u115f", "\u1160", "\uffa0", "\u180b", "\u17b4", "\u{e0100}"];
    for (const char of [...hidden, ...ignorable]) {
      const name = `U+${char.codePointAt(0)!.toString(16)}`;
      const encoded = [...new TextEncoder().encode(char)].map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
      assert.ok(!normalizeSitePath(`/en/old${char}page`).ok, `typed ${name}`);
      assert.match(refused(`/en/old${encoded}page`), /invisible marks/, `encoded ${name}`);
    }
  });

  test("two spellings of one text are one address (NFC): a composed and a combining accent store alike", () => {
    assert.equal(ok("/en/caf%C3%A9"), "/en/caf%C3%A9");
    assert.equal(ok("/en/cafe%CC%81"), "/en/caf%C3%A9");
    assert.equal(ok("/en/cafe\u0301"), "/en/caf%C3%A9");
    assert.equal(readablePath(ok("/en/cafe%CC%81")), "/en/caf\u00e9");
  });
});

describe("readablePath", () => {
  test("shows letters, marks and digits of any script as themselves and keeps everything else encoded", () => {
    assert.equal(readablePath("/ar/%D8%B5%D9%81%D8%AD%D8%A9-%D9%82%D8%AF%D9%8A%D9%85%D8%A9"), "/ar/صفحة-قديمة");
    assert.equal(readablePath("/en/old%20page"), "/en/old%20page");
    assert.equal(readablePath("/en/a%2Fb"), "/en/a%2Fb");
    assert.equal(readablePath("/en/100%25"), "/en/100%25");
    assert.equal(readablePath("/en/old-page"), "/en/old-page");
  });

  test("typed back, gives the same stored form", () => {
    for (const input of ["/ar/صفحة-قديمة", "/en/old%20page", "/en/a%2Fb", "/en/100%25", "/ar/مشروع-٢٠٢٤", "/en/caf%C3%A9", "/en/%E2%9C%93-done", "/en/x%3Fy"]) {
      const stored = ok(input);
      assert.equal(ok(readablePath(stored)), stored, input);
    }
  });
});

describe("answeredBy and isLiveAddress", () => {
  const slugs: LiveSlugs = { services: new Set(["laser-cutting"]), projects: new Set(["clock-tower"]), pages: new Set(["test-page"]) };

  test("a source a page answers is refused: the site's pages and files, a working page, service or project", () => {
    assert.match(answeredBy("/en/about", slugs) ?? "", /website's own pages or files/);
    assert.match(answeredBy("/ar/contact", slugs) ?? "", /website's own pages or files/);
    assert.match(answeredBy("/en/admin", slugs) ?? "", /website's own pages or files/);
    assert.match(answeredBy("/en/test-page", slugs) ?? "", /A page uses this address/);
    assert.match(answeredBy("/en/services/laser-cutting", slugs) ?? "", /A service uses/);
    assert.match(answeredBy("/ar/projects/clock-tower", slugs) ?? "", /A project uses/);
    assert.equal(answeredBy("/en/old-page", slugs), null);
    assert.equal(answeredBy("/en/services/old-service", slugs), null);
    assert.equal(answeredBy("/en/about/old", slugs), null);
  });

  test("a target must be a page of the website", () => {
    for (const path of ["/en", "/ar", "/en/about", "/ar/privacy", "/en/services/laser-cutting", "/en/projects/clock-tower"]) assert.ok(isLiveAddress(path, slugs), path);
    for (const path of ["/en/old-page", "/en/services/old", "/en/projects/old", "/en/about/x", "/en/test-page"]) assert.ok(!isLiveAddress(path, slugs), path);
  });
});
