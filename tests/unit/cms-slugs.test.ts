/**
 * Core CMS (A3) — slugs and the reserved-route source of truth (A3 brief §10–§11). The reserved list is checked against
 * the site itself, read from the source: every route of the route table, every top-level folder and file of the app
 * and of public/, every locale, and every element id of the pages whose anchors entity slugs become. A new route, file,
 * locale or id that the list does not cover fails here until src/i18n/reserved-slugs.ts lists it.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { RESERVED_ANCHORS, RESERVED_PAGE_SLUGS, reservedAnchor, reservedPageSlug, type AnchorNamespace } from "../../src/i18n/reserved-slugs.ts";
import { checkSlug, SLUG_MAX, SLUG_PATTERN, suggestSlug } from "../../src/server/cms/slug.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("slug rules", () => {
  test("lowercase ASCII words joined by single hyphens, 1–80 characters", () => {
    for (const ok of ["a", "laser-cutting", "6kw-laser", "x".repeat(SLUG_MAX), "a1-b2-c3"]) assert.equal(checkSlug(ok, null).ok, true, ok);
    for (const bad of ["", " ", "Laser", "laser_cutting", "laser--cutting", "-laser", "laser-", "läser", "قص", "a b", "a/b", "a.b", "x".repeat(SLUG_MAX + 1), "%2e%2e"]) {
      assert.equal(checkSlug(bad, null).ok, false, bad);
    }
    assert.equal(SLUG_PATTERN.test("a--b"), false);
  });

  test("surrounding spaces are ignored; nothing else is ever rewritten silently", () => {
    assert.deepEqual(checkSlug("  laser-cutting ", null), { ok: true, slug: "laser-cutting" });
    const result = checkSlug("Laser Cutting!", null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.suggestion, "laser-cutting");
  });

  test("suggestions: accents dropped, other characters a single hyphen, never more than 80, none from Arabic alone", () => {
    assert.equal(suggestSlug("Crème Brûlée & Co."), "creme-brulee-co");
    assert.equal(suggestSlug("  A  --  B  "), "a-b");
    assert.equal(suggestSlug("خدمة القص"), null);
    assert.equal(suggestSlug("x".repeat(100))?.length, SLUG_MAX);
    assert.equal(suggestSlug(`${"ab-".repeat(30)}c`)?.endsWith("-"), false);
  });

  test("a certificate's slug is its public anchor: no registration number in it (A3 security review, finding 1)", () => {
    for (const bad of ["cr-1010123456", "cr-1010-123-456", "licence-10-2034-5678"]) assert.equal(checkSlug(bad, "certificate").ok, false, bad);
    for (const ok of ["commercial-registration", "iso-9001", "licence-2024"]) assert.equal(checkSlug(ok, "certificate").ok, true, ok);
    // Only certificates: a project's slug may hold a long number (it is no registration).
    assert.equal(checkSlug("tower-1010123456", "project").ok, true);
  });
});

describe("reserved page slugs — one source of truth, checked against the site", () => {
  test("every route of the route table (first segment)", () => {
    const table = read("src/i18n/routes.ts").match(/export const routes = \{([\s\S]*?)\} as const/)?.[1] ?? "";
    const segments = [...table.matchAll(/:\s*"\/([^"/[]*)/g)].map((m) => m[1]).filter(Boolean);
    assert.ok(segments.length >= 10, "the route table was read");
    for (const segment of segments) assert.ok(RESERVED_PAGE_SLUGS.has(segment), segment);
  });

  test("every locale the site serves", () => {
    const locales = read("src/i18n/config.ts").match(/export const locales = \[([^\]]*)\]/)?.[1] ?? "";
    const codes = [...locales.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(codes, ["en", "ar"]);
    for (const code of codes) assert.ok(reservedPageSlug(code), code);
  });

  const METADATA_FILE = /^(icon|apple-icon|favicon|manifest|robots|sitemap|opengraph-image|twitter-image)(\.[a-z]+)+$/;

  test("every top-level folder and file of the app, the localized pages and public/", () => {
    const names = new Set<string>();
    const walkGroups = (dir: string) => {
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        if (entry.name.startsWith("(") && entry.isDirectory()) walkGroups(join(dir, entry.name));
        else if (entry.isDirectory() && !entry.name.startsWith("[") && !entry.name.startsWith("_")) names.add(entry.name);
        else if (entry.isFile() && METADATA_FILE.test(entry.name)) {
          // Metadata files are routes of their own (manifest.ts → /manifest.webmanifest, icon.svg → /icon.svg …); other
          // modules (fonts.ts) and stylesheets are not addresses.
          const base = entry.name.replace(/\.(ts|tsx|js)$/, "");
          const served: Record<string, string> = { manifest: "manifest.webmanifest", robots: "robots.txt", sitemap: "sitemap.xml" };
          names.add(served[base] ?? base);
          names.add(base.replace(/\.[a-z]+$/, ""));
        }
      }
    };
    walkGroups("src/app");
    walkGroups("src/app/(commerce)/[locale]");
    for (const entry of readdirSync(join(ROOT, "public"))) names.add(entry);
    assert.ok(names.has("admin") && names.has("about") && names.has("media"), [...names].join(","));
    for (const name of names) assert.ok(RESERVED_PAGE_SLUGS.has(name) || reservedPageSlug(name), name);
  });

  test("the brief's list, Next.js internals and A1's planned addresses", () => {
    for (const slug of ["en", "ar", "about", "services", "projects", "capabilities", "industries", "clients", "certificates", "contact", "privacy", "terms", "admin", "api"]) {
      assert.ok(reservedPageSlug(slug), slug);
    }
    for (const slug of ["sitemap.xml", "robots.txt", "_next", "_not-found", "404", "500", "media", "uploads", "preview", "login"]) assert.ok(RESERVED_PAGE_SLUGS.has(slug), slug);
    assert.ok(reservedPageSlug("fr"), "two letters: kept for languages");
    assert.ok(reservedPageSlug("en-gb"), "language-region");
    assert.equal(reservedPageSlug("careers"), null);
    assert.equal(reservedPageSlug("steel-works"), null);
  });

  test("checkSlug applies the page rules only to pages", () => {
    assert.equal(checkSlug("about", "page").ok, false);
    assert.equal(checkSlug("about", null).ok, true, "a service may be called about (its address is under /services)");
    const refused = checkSlug("admin", "page");
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.match(refused.message, /system route or a reserved address/);
  });
});

describe("reserved anchors — every id of the page the slug anchors on", () => {
  const PAGES: Record<AnchorNamespace, string[]> = {
    machine: ["src/components/commerce/capabilities"],
    project: ["src/components/commerce/projects"],
    certificate: ["src/components/commerce/certificates"],
  };
  const SHARED = ["src/components/commerce/shell", "src/components/commerce/inner"];
  const ids = (dirs: string[]) => {
    const literal = new Set<string>();
    const generated: string[] = [];
    for (const dir of dirs) {
      for (const file of readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".tsx"))) {
        const text = read(join(dir, file));
        for (const m of text.matchAll(/\bid="([^"]+)"/g)) literal.add(m[1]);
        for (const m of text.matchAll(/\bid=\{`([^`]+)`\}/g)) generated.push(m[1]);
      }
    }
    return { literal, generated };
  };

  for (const namespace of Object.keys(PAGES) as AnchorNamespace[]) {
    test(`${namespace}: literal ids are reserved, generated ids follow a reserved shape`, () => {
      const { literal, generated } = ids([...PAGES[namespace], ...SHARED]);
      assert.ok(literal.size > 1, `ids were read for ${namespace}`);
      for (const id of literal) assert.ok(reservedAnchor(namespace, id), `${namespace}: ${id}`);
      for (const template of generated) {
        // The item's own slug as a whole id (`id={`${m.slug}`}`) is the anchor itself.
        if (/^\$\{[^}]+\}$/.test(template)) continue;
        // A template such as `${m.slug}-name`, `line-${s.slug}` or `${id}-title`: whatever fills it, a slug of that shape
        // would repeat an id the page generates, so it must be refused.
        const sample = template.replace(/\$\{[^}]+\}/g, "anything");
        assert.ok(reservedAnchor(namespace, sample), `${namespace}: ${template}`);
      }
    });
  }

  test("ordinary slugs stay free", () => {
    for (const ns of ["machine", "project", "certificate"] as const) {
      assert.equal(reservedAnchor(ns, "fiber-laser-6kw"), false, ns);
      assert.equal(reservedAnchor(ns, "steel-gate"), false, ns);
    }
    assert.ok(RESERVED_ANCHORS.project.has("gallery"));
    assert.ok(reservedAnchor("machine", "laser-name"));
    assert.ok(reservedAnchor("machine", "line-cutting"));
  });
});
