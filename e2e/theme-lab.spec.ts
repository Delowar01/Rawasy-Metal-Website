import { expect, test } from "@playwright/test";
import { horizontalOverflow, LOCALES, trackErrors } from "./helpers";

/**
 * Theme lab: isolated Modern Commerce explorations (A, its refinement A V2, B
 * and C). They must stay out of search engines, the sitemap and the site
 * navigation, leave the website's own pages untouched, and use only content and
 * photos cleared for featured spots. A V2's own behaviour: theme-lab-a-v2.spec.ts.
 */

const OPTIONS = ["a", "a-v2", "b", "c"] as const;
const SECTIONS = ["about", "services", "machinery", "projects", "clients", "contact"];
/** Root class of each option. */
const ROOT: Record<(typeof OPTIONS)[number], string> = { a: "lab-a", "a-v2": "lab-a2", b: "lab-b", c: "lab-c" };
/** Typefaces per option (English display, body, extras, Arabic) and the website's own. */
const FONTS: Record<(typeof OPTIONS)[number], string[]> = {
  a: ["Plus Jakarta Sans", "Inter", "Tajawal", "IBM Plex Sans Arabic"],
  "a-v2": ["Plus Jakarta Sans", "Inter", "Tajawal", "IBM Plex Sans Arabic"],
  b: ["Outfit", "Inter", "Geist Mono", "Alexandria", "Noto Sans Arabic"],
  c: ["Urbanist", "DM Sans", "Readex Pro"],
};
const SITE_FONTS = ["Sora", "Manrope", "Noto Kufi Arabic"];
const lab = (locale: string, option: string, system = false) => `/theme-lab/${locale}/modern-commerce-${option}${system ? "/system" : ""}`;

/** Photos kept off featured spots (docs/ASSET_INVENTORY.md). */
const FLAGGED = [
  "engraving-nameplates",
  "engraving-wood",
  "engraving-rotary",
  "canopy-tree-1",
  "wheat-monument-1",
  "stainless-landmark-1",
  "billboard-structure-1",
  "lattice-cubes-1",
  "seed-sculpture-1",
  "laser-cut-bench-1",
  "litter-bins",
];

test.describe("isolation and indexing", () => {
  for (const locale of LOCALES) {
    for (const option of OPTIONS) {
      for (const system of [false, true]) {
        test(`${lab(locale, option, system)} is noindex and outside the site chrome`, async ({ page }) => {
          const errors = trackErrors(page);
          const response = await page.goto(lab(locale, option, system), { waitUntil: "networkidle" });
          expect(response?.status()).toBe(200);
          expect(response?.headers()["x-robots-tag"]).toContain("noindex");
          await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
          await expect(page.locator("html")).toHaveAttribute("lang", locale === "ar" ? "ar-SA" : "en");
          await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
          // Its own root layout and stylesheet: the website's CSS (e.g. its chamfered .btn-face) never loads here.
          expect(await page.locator(".lab-bar").count()).toBe(1);
          expect(await page.locator(`.${ROOT[option]}`).count()).toBe(1);
          const siteCss = await page.evaluate(() =>
            [...document.styleSheets].some((sheet) => {
              try {
                return [...sheet.cssRules].some((rule) => rule.cssText.includes(".btn-face"));
              } catch {
                return false;
              }
            }),
          );
          expect(siteCss).toBe(false);
          // Each option declares only its own typefaces (the other options' and the website's are absent).
          const families = await page.evaluate(() => [...new Set([...document.fonts].map((f) => f.family.replace(/['"]/g, "")))]);
          const own = FONTS[option];
          for (const family of Object.values(FONTS).flat().concat(SITE_FONTS)) {
            const declared = families.some((f) => f === family);
            expect(declared, family).toBe(own.includes(family));
          }
          expect(errors).toEqual([]);
        });
      }
    }
  }

  test("bare lab URLs redirect to a locale and the default option (A V2)", async ({ page }) => {
    await page.goto("/theme-lab");
    expect(new URL(page.url()).pathname).toBe("/theme-lab/en/modern-commerce-a-v2");
    await page.goto("/theme-lab/modern-commerce-c");
    expect(new URL(page.url()).pathname).toBe("/theme-lab/en/modern-commerce-c");
    await page.goto("/theme-lab/ar");
    expect(new URL(page.url()).pathname).toBe("/theme-lab/ar/modern-commerce-a-v2");
    // A stays available beside A V2 for comparison.
    expect((await page.goto("/theme-lab/en/modern-commerce-a"))?.status()).toBe(200);
  });

  test("the sitemap, robots and site navigation never mention the lab", async ({ page, request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("theme-lab");
    for (const path of ["/en", "/ar", "/en/about", "/en/services/laser-cutting", "/en/contact"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(await page.locator('a[href*="theme-lab"]').count()).toBe(0);
    }
  });
});

test.describe("homepage previews", () => {
  for (const option of OPTIONS) {
    test(`option ${option.toUpperCase()}: header, hero, the six sections and footer, in both languages`, async ({ page }) => {
      for (const locale of LOCALES) {
        await page.goto(lab(locale, option), { waitUntil: "networkidle" });
        await expect(page.locator("header").first()).toBeVisible();
        await expect(page.locator("h1")).toHaveCount(1);
        for (const id of SECTIONS) await expect(page.locator(`section#${id}`)).toHaveCount(1);
        await expect(page.locator("footer")).toHaveCount(1);
        // Every nav anchor points at a section on the page.
        const anchors = await page.locator('header nav a[href^="#"]').evaluateAll((els) => els.map((a) => a.getAttribute("href")));
        for (const href of anchors) expect(await page.locator(href!).count()).toBe(1);
        // All six services, all six machines' names and every client logo.
        await expect(page.locator("#services a[href*='/services/']")).not.toHaveCount(0);
        expect(await page.locator("#clients img").count()).toBe(21);
      }
    });

    test(`option ${option.toUpperCase()}: flagged photos stay out, decoration is hidden, clients carry no counts`, async ({ page }) => {
      for (const locale of LOCALES) {
        for (const system of [false, true]) {
          await page.goto(lab(locale, option, system), { waitUntil: "networkidle" });
          const sources = await page.locator("img").evaluateAll((els) => els.map((i) => (i as HTMLImageElement).currentSrc || i.getAttribute("src") || ""));
          for (const id of FLAGGED) expect(sources.filter((s) => s.includes(id))).toEqual([]);
          expect(await page.locator("svg.lab-icon:not([aria-hidden])").count()).toBe(0);
        }
        await page.goto(lab(locale, option), { waitUntil: "networkidle" });
        expect(await page.locator("#clients").innerText()).not.toMatch(/\b\d{2}\b/);
      }
    });

    test(`option ${option.toUpperCase()}: whole-card links stay inside their cards and the hero actions are clickable`, async ({ page }) => {
      for (const system of [false, true]) {
        await page.goto(lab("en", option, system), { waitUntil: "networkidle" });
        const escaped = await page.evaluate(() => {
          const containingBlock = (el: Element) => {
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              if (getComputedStyle(p).position !== "static") return p;
            }
            return document.body;
          };
          const overlays = [...document.querySelectorAll(".stretch")].filter((a) => {
            const card = a.closest("article, .card, .tile");
            return !card || !card.contains(containingBlock(a)) && containingBlock(a) !== card;
          });
          const edges = [...document.querySelectorAll(".card-link")].filter((el) => getComputedStyle(el).position === "static");
          return overlays.length + edges.length;
        });
        expect(escaped, system ? "system" : "home").toBe(0);
      }
      await page.goto(lab("en", option), { waitUntil: "networkidle" });
      const clickable = await page.evaluate(() =>
        [...document.querySelectorAll("main section:first-of-type a")]
          .map((a) => ({ a, r: a.getBoundingClientRect() }))
          .filter(({ r }) => r.height > 0 && r.y + r.height / 2 < innerHeight)
          .every(({ a, r }) => a.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))),
      );
      expect(clickable).toBe(true);
    });

    test(`option ${option.toUpperCase()}: no sideways scroll from phone to laptop widths`, async ({ page }) => {
      for (const width of [360, 390, 834, 1024, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        for (const locale of LOCALES) {
          await page.goto(lab(locale, option), { waitUntil: "networkidle" });
          expect(await horizontalOverflow(page), `${locale} at ${width}px`).toBe(0);
        }
      }
    });
  }
});

test.describe("progressive enhancement", () => {
  test.use({ javaScriptEnabled: false });

  for (const option of OPTIONS) {
    test(`option ${option.toUpperCase()} is complete without JavaScript`, async ({ page }) => {
      await page.goto(lab("en", option));
      // Reveal styles apply only with JS; everything is visible without it.
      const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length);
      expect(hidden).toBe(0);
      await expect(page.locator("h1")).toBeVisible();
      // The phone menu is a <details> disclosure, so it still opens.
      await page.setViewportSize({ width: 390, height: 800 });
      await page.locator("details[data-menu] > summary").click();
      await expect(page.locator("details[data-menu] nav a").first()).toBeVisible();
    });
  }
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("ambient motion stops and content is shown at once", async ({ page }) => {
    for (const option of OPTIONS) {
      await page.goto(lab("en", option), { waitUntil: "networkidle" });
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
      expect(running, option).toBe(0);
      const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length);
      expect(hidden, option).toBe(0);
    }
  });
});
