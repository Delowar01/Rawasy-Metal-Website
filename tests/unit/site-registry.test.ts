/**
 * Site controls (A6) — the code registry against what the public site holds today, so nothing drifts: the interface-text
 * keys against the dictionaries (every key there, minus the documented exclusion, plus the footer company column's
 * title), their maximum lengths against today's texts and the registry's own rule; the site routes against
 * `src/i18n/routes.ts`; the reference tokens against `system.css`; today's navigation against the menu rules; the theme's
 * value rule and the empty approved list (D-A6-3); the seed migration against the generator.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { getDictionary } from "../../src/i18n/dictionaries.ts";
import { menuIssues, type MenuItemModel } from "../../src/server/site/menus.ts";
import {
  APPROVED_TOKENS,
  LOCALES,
  MENU_SLOTS,
  REFERENCE_TOKENS,
  ROUTE_NAMES,
  SECTION_ROUTES,
  SITE_ROUTE_KEYS,
  SITE_ROUTES,
  tokenStyle,
  tokenValueProblem,
  UI_GROUPS,
  UI_STRING_EXCLUSIONS,
  UI_STRINGS,
  type TokenDef,
} from "../../src/server/site/registry.ts";
import { staticMenus, staticSettings, staticUiText, staticUiTexts } from "../../src/server/site/static-source.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("interface text keys", () => {
  test("are every text of the dictionaries (minus the documented exclusion) and the footer company column's title, once each", () => {
    const keys = new Set<string>();
    for (const locale of LOCALES) {
      const dict = getDictionary(locale) as unknown as Record<string, Record<string, unknown>>;
      for (const [group, entries] of Object.entries(dict)) for (const [name, value] of Object.entries(entries)) if (typeof value === "string") keys.add(`${group}.${name}`);
    }
    const expected = [...keys].filter((k) => !(UI_STRING_EXCLUSIONS as readonly string[]).includes(k)).concat("navigation.footerCompanyTitle").sort();
    assert.deepEqual(UI_STRINGS.map((s) => s.key).sort(), expected);
    assert.equal(new Set(UI_STRINGS.map((s) => s.key)).size, UI_STRINGS.length);
    assert.equal(UI_STRINGS.length, 34);
  });

  test("each belongs to a registered group, whose name is the key's own prefix", () => {
    const groups = new Set<string>(UI_GROUPS.map((g) => g.key));
    for (const s of UI_STRINGS) {
      assert.ok(groups.has(s.group), s.key);
      assert.equal(s.key.split(".")[0], s.group, s.key);
    }
  });

  test("today's text fits each key's maximum, which follows the registry's rule (twice the longest, rounded up to ten, 24–200)", () => {
    const today = staticUiTexts();
    for (const s of UI_STRINGS) {
      const longest = Math.max(...LOCALES.map((l) => [...today[s.key][l]].length));
      assert.ok(longest <= s.maxLength, `${s.key}: ${longest} > ${s.maxLength}`);
      assert.equal(s.maxLength, Math.min(200, Math.max(24, Math.ceil((2 * longest) / 10) * 10)), s.key);
    }
  });

  test("today's text is on one line, in the right language (the language switch's label is in the language it leads to)", () => {
    for (const s of UI_STRINGS) {
      for (const locale of LOCALES) {
        const text = staticUiText(s.key, locale)!;
        assert.ok(text.trim() === text && !/[\r\n]/.test(text), s.key);
        const written = s.otherLanguage ? (locale === "en" ? "ar" : "en") : locale;
        if (written === "ar" && /[A-Za-z]{3}/.test(text) && !/[\u0600-\u06ff]/.test(text)) assert.fail(`${s.key} (${locale}) reads as English: ${text}`);
      }
    }
    assert.equal(staticUiText("a11y.languageSwitch", "en"), getDictionary("en").a11y.languageSwitch);
    assert.match(staticUiText("a11y.languageSwitch", "en")!, /[\u0600-\u06ff]/);
  });
});

describe("site routes", () => {
  test("are the website's own pages with their addresses as src/i18n/routes.ts writes them (the record templates aside)", () => {
    const source = read("src/i18n/routes.ts");
    const table = source.slice(source.indexOf("export const routes = {"), source.indexOf("} as const;"));
    const routes = Object.fromEntries([...table.matchAll(/^\s+(\w+): "([^"]+)",$/gm)].map((m) => [m[1], m[2]]));
    const fixed = Object.fromEntries(Object.entries(routes).filter(([, path]) => !path.includes("[")));
    assert.deepEqual(SITE_ROUTES, fixed);
    assert.deepEqual(Object.keys(ROUTE_NAMES).sort(), [...SITE_ROUTE_KEYS].sort());
  });
});

describe("menus", () => {
  test("today's navigation passes every menu rule (the set-up copies a valid working copy)", () => {
    const menus = staticMenus();
    for (const slot of MENU_SLOTS) {
      const stored: MenuItemModel[] = menus[slot.key].map((item, i) => ({ id: `item-${i}`, ...item, isVisible: true }));
      const items = stored.map((item) => ({ id: item.id, route: item.route, label: item.label, isVisible: item.isVisible }));
      assert.deepEqual(menuIssues(slot, items, stored), [], slot.key);
    }
  });

  test("the header's Services item is third, as the design's header draws it (positionally)", () => {
    const header = MENU_SLOTS.find((s) => s.key === "header_main")!;
    assert.deepEqual(header.pinned, { position: 3, route: "services" });
    assert.equal(staticMenus().header_main[2].route, "services");
    const shell = read("src/components/commerce/shell/Header.tsx");
    assert.match(shell, /const \[home, about, servicesNav, \.\.\.rest\] = nav;/);
  });

  test("the rules refuse a moved Services item, a duplicate page, too long a label and a missing Arabic label", () => {
    const slot = MENU_SLOTS.find((s) => s.key === "header_main")!;
    const stored: MenuItemModel[] = staticMenus().header_main.map((item, i) => ({ id: `item-${i}`, ...item, isVisible: true }));
    const items = () => stored.map((item) => ({ id: item.id, route: item.route, label: item.label ? { ...item.label } : null, isVisible: item.isVisible }));
    const moved = items();
    [moved[2], moved[3]] = [moved[3], moved[2]];
    assert.ok(menuIssues(slot, moved, stored).length > 0);
    const duplicate = items();
    duplicate[4].route = "about";
    assert.ok(menuIssues(slot, duplicate, stored).some((i) => i.path === "items.4.route"));
    const long = items();
    long[4].label = { en: "x".repeat(slot.labelMax + 1), ar: "مشاريع" };
    assert.ok(menuIssues(slot, long, stored).some((i) => i.path === "items.4.label.en"));
    const missing = items();
    missing[5].label = { en: "Industries", ar: "" };
    assert.ok(menuIssues(slot, missing, stored).some((i) => i.path === "items.5.label.ar"));
    const hidden = items();
    hidden[1].isVisible = false;
    assert.ok(menuIssues(slot, hidden, stored).length > 0);
    // Projects (pages of its own) in the first two places, where the header marks the page only (A6 review I4).
    for (const at of [0, 1]) {
      const early = items();
      const from = early.findIndex((i) => i.route === "projects");
      [early[at], early[from]] = [early[from], early[at]];
      assert.ok(menuIssues(slot, early, stored).some((i) => i.path === `items.${at}.route` && /pages of its own/.test(i.message)), String(at));
    }
  });

  test("the header's page-mark-only places and its section routes are what Header.tsx draws (the first two links use `here`)", () => {
    const header = read("src/components/commerce/shell/Header.tsx");
    const flat = /const flat = \[([^\]]*)\];/.exec(header)?.[1].split(",").map((x) => x.trim());
    assert.deepEqual(flat, ["home", "about"]);
    assert.equal(MENU_SLOTS.find((s) => s.key === "header_main")!.pageMarkOnly, flat!.length);
    assert.match(header, /\{flat\.map\(\(item\) => \(\s*<li key=\{item\.key\}>\s*<a href=\{item\.href\} className="nav-link" aria-current=\{here\(item\.key\)\}>/);
    // The routes the header marks as a section on their own pages: services (a service's page) and projects (a project's).
    assert.match(header, /\(key === "services" && current === "service"\) \|\| \(key === "projects" && current === "project"\)/);
    assert.deepEqual([...SECTION_ROUTES], ["services", "projects"]);
  });
});

describe("company settings", () => {
  test("today's values copy without inventing anything: the map's place link and the default SEO description start empty", () => {
    const s = staticSettings();
    assert.equal(s.mapsPlaceUrl, "");
    for (const locale of LOCALES) assert.equal(s.texts[locale].defaultSeoDescription, "");
    assert.ok(s.phones.length >= 1 && s.phones.some((p) => p.hasWhatsapp));
    assert.match(s.websiteUrl, /^https:\/\//);
  });
});

describe("theme", () => {
  test("no token is approved for overriding (D-A6-3): the list is empty, so every override is refused and none is drawn", () => {
    assert.deepEqual(APPROVED_TOKENS, []);
    assert.deepEqual(tokenStyle([{ tokenKey: "brand", scheme: "all", value: "#000000" }], "light"), {});
  });

  test("the reference tokens are the colours system.css draws (light on .mc, dark under the dark theme)", () => {
    const css = read("src/components/commerce/system.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = (selector: string) => {
      const at = css.search(new RegExp(`(^|[\\s}])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`));
      assert.ok(at >= 0, selector);
      const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
      return new Map([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]));
    };
    const light = rule(".mc");
    const dark = rule('html[data-theme="dark"] .mc');
    for (const t of REFERENCE_TOKENS) {
      assert.equal(light.get(t.cssVar), t.light, `${t.cssVar} light`);
      assert.equal(dark.get(t.cssVar) ?? light.get(t.cssVar), t.dark, `${t.cssVar} dark`);
    }
  });

  test("a value is a #rrggbb colour that keeps its contrast; anything else (names, CSS, script) is refused", () => {
    const def: TokenDef = { key: "test", label: "Test", cssVar: "--brand", type: "color", schemes: ["all", "light", "dark"], against: { light: ["#f4f4f1"], dark: ["#131820"], minRatio: 3 } };
    assert.equal(tokenValueProblem(def, "light", "#2c5e86"), null);
    for (const value of ["red", "#fff", "#F15F22", "#f15f22; color: red", "url(x)", "<script>", "var(--ink)", "#2c5e86 !important"]) {
      assert.match(tokenValueProblem(def, "light", value) ?? "", /#rrggbb/, value);
    }
    assert.match(tokenValueProblem(def, "light", "#e0e0e0") ?? "", /contrast/);
    assert.match(tokenValueProblem(def, "all", "#2c5e86") ?? "", /dark theme/);
    // Drawn only when approved and valid: an unapproved key or a failing value is skipped.
    assert.deepEqual(tokenStyle([{ tokenKey: "test", scheme: "light", value: "#2c5e86" }], "light", [def]), { "--brand": "#2c5e86" });
    assert.deepEqual(tokenStyle([{ tokenKey: "test", scheme: "light", value: "#e0e0e0" }], "light", [def]), {});
    assert.deepEqual(tokenStyle([{ tokenKey: "other", scheme: "light", value: "#2c5e86" }], "light", [def]), {});
  });
});

describe("seed", () => {
  test("drizzle/0007 is what the generator writes from the registry (db:check's seed part)", () => {
    assert.match(read("scripts/generate-access-seed.mjs"), /"\.\.\/drizzle\/0007_seed_site_controls\.sql"\), siteSeed\]/);
    const out = execFileSync(process.execPath, [join(ROOT, "scripts/generate-access-seed.mjs"), "--check"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.match(out, /Seed migrations match the registries\./);
  });
});
