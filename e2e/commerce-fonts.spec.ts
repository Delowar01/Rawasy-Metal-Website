import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser } from "@playwright/test";

/**
 * Stage 1J: the Arabic faces' preload. next/font preloads a face on every page of the layout that loads it, and both
 * languages share one root layout, so the Arabic faces are declared in src/fonts/arabic.css and the root layout
 * preloads the files every Arabic page draws first on the Arabic pages only. The files are the ones next/font used to
 * download, byte for byte (the hashes below): the faces themselves did not change.
 */

/** SHA-1 of each Arabic face file (src/fonts), as next/font served them up to Stage 1I. */
const ARABIC_FILES: Record<string, string> = {
  "ibm-plex-sans-arabic-400-arabic": "9f1801b4f31a3bbf5048e0d4ed9e22344ff45bb0",
  "ibm-plex-sans-arabic-400-cyrillic-ext": "07d2d41f3c996d034d8bfd6e0471d757f0b18fa0",
  "ibm-plex-sans-arabic-400-latin-ext": "6b1f1c088115e04b580eeb7b2c51b509a99b21f1",
  "ibm-plex-sans-arabic-400-latin": "4ba1584abe3548f6e032e47dfc5668155b3fa7f0",
  "ibm-plex-sans-arabic-500-arabic": "cf5bfd34cf161f7a97997d87fe51a9551e4fc930",
  "ibm-plex-sans-arabic-500-cyrillic-ext": "10c4fec22ca2562300f86eadf328b4e7e6a158f4",
  "ibm-plex-sans-arabic-500-latin-ext": "2233b1c8b810f0d424a160a3e05b75aa0adeb391",
  "ibm-plex-sans-arabic-500-latin": "ce4a69220381b8a5410eb84b3169655409d2fe69",
  "tajawal-500-arabic": "2a5446b9a3bf4a4ff5dd3ebfe7d2198bf257db74",
  "tajawal-500-latin": "ff51e147f172afbe4c38e3983025ba19587265e6",
  "tajawal-700-arabic": "ab2e4bbd70a9a099d4df219fef0d922937587a30",
  "tajawal-700-latin": "f74b378c6b864c1b57b99575b1e5a4a74eeb54d4",
  "tajawal-800-arabic": "718b38ca11e188af1ff223015135351789654c48",
  "tajawal-800-latin": "b21554dbd83ff4ed961b98aee5433591c1ce737e",
};

/** The files every Arabic page draws on its first screen, at every width (Tajawal 500 is not among them). */
const PRELOADED = [
  "ibm-plex-sans-arabic-400-arabic",
  "ibm-plex-sans-arabic-400-latin",
  "ibm-plex-sans-arabic-500-arabic",
  "ibm-plex-sans-arabic-500-latin",
  "tajawal-700-arabic",
  "tajawal-700-latin",
  "tajawal-800-arabic",
  "tajawal-800-latin",
];

const ROUTES = [
  "",
  "/about",
  "/services",
  "/services/laser-engraving",
  "/services/steel-structures",
  "/capabilities",
  "/projects",
  "/projects/clock-tower-landmark",
  "/projects/laser-cut-bench",
  "/industries",
  "/clients",
  "/certificates",
  "/contact",
  "/privacy",
  "/terms",
];

const sha1 = (data: Buffer) => createHash("sha1").update(data).digest("hex");
const fontPreloads = (html: string) =>
  [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"([^>]*)\/>/g)].map((m) => ({ href: m[1], attrs: m[2].trim() }));
/** A served file's name without its content hash: /_next/static/media/tajawal-700-arabic.14yt….woff2 → tajawal-700-arabic. */
const faceName = (href: string) => href.split("/").pop()!.replace(/\.[^.]+\.woff2$/, "");
const isArabicFace = (href: string) => /\/(tajawal|ibm-plex-sans-arabic)-/.test(href);

test.describe("the Arabic faces", () => {
  test("Arabic pages preload the Arabic files every Arabic page draws first; English pages only the two Latin faces", async ({ request }) => {
    for (const route of ROUTES) {
      const en = fontPreloads(await (await request.get(`/en${route}`)).text());
      const ar = fontPreloads(await (await request.get(`/ar${route}`)).text());
      // next/font's two Latin faces, on every page in both languages.
      const latin = en.map((p) => p.href);
      expect(latin, `/en${route}`).toHaveLength(2);
      expect(latin.some(isArabicFace), `/en${route}`).toBe(false);
      expect(ar.filter((p) => !isArabicFace(p.href)).map((p) => p.href), `/ar${route}`).toEqual(latin);
      // The Arabic files, once each, as next/font writes its own: CORS mode and the font type.
      expect(ar.filter((p) => isArabicFace(p.href)).map((p) => faceName(p.href)).sort(), `/ar${route}`).toEqual(PRELOADED);
      for (const p of ar) expect(p.attrs, `/ar${route} ${p.href}`).toBe('crossorigin="" type="font/woff2"');
    }
  });

  test("the files are the faces' own, byte for byte, on disk and as served; none comes from Google", async ({ page, request }) => {
    for (const [name, hash] of Object.entries(ARABIC_FILES)) expect(sha1(readFileSync(join(process.cwd(), "src/fonts", `${name}.woff2`))), name).toBe(hash);
    const google: string[] = [];
    page.on("request", (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) google.push(r.url());
    });
    await page.goto("/ar", { waitUntil: "networkidle" });
    // Every Arabic face rule of the page's stylesheet, by the URL it is served from.
    // (a rule's URL is relative to its stylesheet)
    const served = await page.evaluate(() =>
      [...document.styleSheets].flatMap((sheet) =>
        [...sheet.cssRules]
          .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
          .map((rule) => rule.style.getPropertyValue("src").match(/url\("?([^")]+)"?\)/)?.[1] ?? "")
          .filter((src) => /\/(tajawal|ibm-plex-sans-arabic)-/.test(src))
          .map((src) => new URL(src, sheet.href ?? location.href).pathname),
      ),
    );
    expect(served.map(faceName).sort()).toEqual(Object.keys(ARABIC_FILES).sort());
    for (const path of served) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["cache-control"], path).toContain("immutable");
      expect(sha1(await response.body()), path).toBe(ARABIC_FILES[faceName(path)]);
    }
    expect(google).toEqual([]);
  });

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    test(`at ${width} px every preloaded file is the one the page draws with, fetched once and used, with no console warning`, async ({ browser }) => {
      test.setTimeout(90_000);
      for (const path of ["/ar", "/ar/about", "/ar/services/steel-structures", "/ar/projects/laser-cut-bench"]) {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
        const page = await context.newPage();
        const fonts: string[] = [];
        const warnings: string[] = [];
        page.on("request", (r) => {
          if (r.url().endsWith(".woff2")) fonts.push(new URL(r.url()).pathname);
        });
        page.on("console", (m) => {
          if (m.type() === "warning" || m.type() === "error") warnings.push(m.text());
        });
        await page.goto(path, { waitUntil: "load" });
        // Chromium warns about a preload the page has not used within a few seconds of the load event.
        await page.waitForTimeout(3500);
        const preloaded = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map((l) => new URL(l.href).pathname));
        for (const href of preloaded) expect(fonts.filter((f) => f === href), `${path} ${href}`).toHaveLength(1);
        expect(new Set(fonts).size, `${path}: no file fetched twice`).toBe(fonts.length);
        expect(warnings, path).toEqual([]);
        // The faces are in use: Tajawal 700 / 800 and IBM Plex Sans Arabic 400 / 500 have loaded.
        const loaded = await page.evaluate(() =>
          [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family.replace(/"/g, "")} ${f.weight}`),
        );
        for (const face of ["Tajawal 700", "Tajawal 800", "IBM Plex Sans Arabic 400", "IBM Plex Sans Arabic 500"]) expect(loaded, `${path} ${face}`).toContain(face);
        await context.close();
      }
    });
  }

  test("English pages keep the Arabic language label in its Arabic face, without preloading Arabic files", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const label = page.locator('header a[hreflang="ar-SA"]').first();
    expect(await label.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Tajawal"?/);
    expect(await page.evaluate(() => document.fonts.check('700 14px "Tajawal"', "عربي"))).toBe(true);
    expect(await page.locator('link[rel="preload"][as="font"][href*="tajawal"], link[rel="preload"][as="font"][href*="ibm-plex"]').count()).toBe(0);
  });
});

/** Cumulative layout shift of a fresh load (the largest session window, as web-vitals measures it). */
async function freshCls(browser: Browser, path: string, width: number, height: number) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
  await context.addInitScript(() => {
    const w = window as unknown as { __shifts: { value: number; time: number }[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; startTime: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) w.__shifts.push({ value: e.value, time: e.startTime });
    }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await context.newPage();
  await page.goto(path, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const cls = await page.evaluate(() => {
    const shifts = (window as unknown as { __shifts: { value: number; time: number }[] }).__shifts;
    let best = 0;
    let current = 0;
    let first = 0;
    let last = 0;
    for (const s of shifts) {
      if (current && s.time - last < 1000 && s.time - first < 5000) {
        current += s.value;
        last = s.time;
      } else {
        current = s.value;
        first = last = s.time;
      }
      best = Math.max(best, current);
    }
    return best;
  });
  await context.close();
  return cls;
}

test.describe("Arabic pages hold still while their faces load", () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const)
    test(`a fresh load's layout shift stays below 0.1 at ${width} px (the steel-structures hero moved 0.262 before Stage 1J)`, async ({ browser }) => {
      test.setTimeout(90_000);
      for (const path of ["/ar", "/ar/about", "/ar/services", "/ar/services/steel-structures", "/ar/capabilities", "/ar/projects"]) {
        expect(await freshCls(browser, path, width, height), path).toBeLessThan(0.1);
      }
    });
});
