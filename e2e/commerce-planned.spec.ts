import { expect, test, type Page } from "@playwright/test";
import { mediaRegistry } from "../src/content/media.generated";
import { routeLabels } from "../src/content/navigation";
import { projects, withheldMedia } from "../src/content/projects";
import { seo } from "../src/content/seo";
import { getDictionary } from "../src/i18n/dictionaries";
import { HTML_LANG, hiddenReveals, horizontalOverflow, jsonLd, LOCALES, trackErrors, type TestLocale } from "./helpers";

/**
 * Stage TM-2.6: the planned pages in the Modern Commerce design — Capabilities (Stage 1E) and the 34 project pages
 * (Stage 1F) — and the 404 of an unknown project. They keep the previous placeholders' addresses, titles, descriptions,
 * stages, breadcrumbs and search metadata (planned, noindex, follow), and show text only: no project photograph (some
 * held-back projects carry AI watermarks, renders or authorship questions), no machinery figures, no case-study parts.
 * Replaces the previous design's shell tests that ran on these pages (site, redesign-v2 and visual-system specs).
 */

const SITE = { en: "RAWASY", ar: "رواسي" } as const;
const NOT_FOUND = { en: "Outside the blueprint", ar: "خارج المخطط" } as const;
const TITLE_404 = { en: "Page not found | RAWASY", ar: "الصفحة غير موجودة | رواسي" } as const;
const BREADCRUMB = { en: "Breadcrumb", ar: "مسار التنقل" } as const;
const other = (locale: TestLocale) => (locale === "en" ? "ar" : "en");

/** Every file a project could show — its photos and the withheld ones — by registry id (as a quoted string, plain or
 * escaped inside the inline page data) and by file path. */
const PROJECT_MEDIA = [...new Set([...projects.flatMap((p) => p.media), ...withheldMedia])];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const MEDIA_MARKERS = PROJECT_MEDIA.flatMap((id) => [
  new RegExp(`\\\\?"${escape(id)}\\\\?"`),
  new RegExp(escape(mediaRegistry[id as keyof typeof mediaRegistry]?.src ?? `/media/${id}`)),
]);

/** What <main> holds besides text: pictures, background images, tables, fact lists and extra sections. */
function mainParts(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const backgrounds = [...main.querySelectorAll("*")].filter((el) => /url\(/.test(getComputedStyle(el).backgroundImage)).length;
    return {
      images: main.querySelectorAll("img, picture, video, canvas, iframe, figure").length,
      drawings: main.querySelectorAll("svg:not(.mc-icon)").length,
      backgrounds,
      tables: main.querySelectorAll("table, dl").length,
      headings: [...main.querySelectorAll("h1, h2, h3, h4")].map((h) => h.tagName.toLowerCase()),
      sections: main.querySelectorAll("section").length,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Capabilities (Stage 1E)
// ---------------------------------------------------------------------------------------------------------------------

test.describe("Capabilities", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/capabilities: this design, the unchanged title and description, Stage 1E, planned and noindex`, async ({ page, request }) => {
      const errors = trackErrors(page);
      const dict = getDictionary(locale);
      const response = await page.goto(`/${locale}/capabilities`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page).toHaveTitle(`${seo.capabilities.title[locale]} | ${SITE[locale]}`);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(seo.capabilities.title[locale]);
      await expect(page.locator("main .t-lead")).toHaveText(seo.capabilities.description[locale]);
      // The in-development status and its stage, as before.
      await expect(page.locator("main .eyebrow")).toHaveText(`${dict.placeholder.badge} · 1E`);
      await expect(page.locator('main [role="note"]')).toContainText(`${dict.placeholder.body} 1E.`);
      await expect(page.locator(`main a.btn[href="/${locale}"]`)).toContainText(dict.placeholder.back);
      await expect(page.locator(`main a.btn[href="/${locale}/contact"]`)).toContainText(dict.placeholder.contact);
      // Breadcrumb: Home → Capabilities.
      const crumbs = page.getByRole("navigation", { name: BREADCRUMB[locale] }).locator("li");
      await expect(crumbs).toHaveCount(2);
      await expect(crumbs.first().locator("a")).toHaveAttribute("href", `/${locale}`);
      await expect(crumbs.last().locator('[aria-current="page"]')).toHaveText(routeLabels.capabilities[locale]);
      // Search: planned, never indexed; canonical, languages and social cards as before; not in the sitemap.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/capabilities$`));
      for (const lang of ["en", "ar", "x-default"]) await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", seo.capabilities.title[locale]);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", seo.capabilities.description[locale]);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/capabilities");
      // The header and the footer mark the page.
      await expect(page.locator('.a2-nav a[aria-current="page"]')).toHaveAttribute("href", `/${locale}/capabilities`);
      await expect(page.locator('footer a[aria-current="page"]')).toHaveAttribute("href", `/${locale}/capabilities`);
      // Nothing that Stage 1E builds: no machines, photos, figures, tables or further sections.
      expect(await mainParts(page)).toEqual({ images: 0, drawings: 0, backgrounds: 0, tables: 0, headings: ["h1"], sections: 0 });
      expect(await page.locator("main").innerText()).not.toMatch(/\b(kW|كيلوواط|Rated power)\b/);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(errors).toEqual([]);
    });
  }

  test("the language switch opens the page in the other language and remembers the choice; the theme applies and toggles", async ({ page, context }) => {
    const errors = trackErrors(page);
    await context.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("rawasy-theme", "dark");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(19, 24, 32)");
    await page.locator(".a2-header .a2-lang").first().locator('a[hreflang="ar-SA"]').click();
    await page.waitForURL("**/ar/capabilities");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect((await context.cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe("ar");
    await page.locator(".a2-header [role=group] button").first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => localStorage.getItem("rawasy-theme"))).toBe("light");
    expect(errors).toEqual([]);
  });

  test("Arabic: the Tajawal title, IBM Plex Sans Arabic text, never letter-spaced; self-hosted faces only", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => void (/fonts\.(googleapis|gstatic)\.com/.test(r.url()) && external.push(r.url())));
    await page.goto("/ar/capabilities", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const h1 = page.locator("h1");
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Tajawal/);
    expect(await h1.evaluate((el) => getComputedStyle(el).letterSpacing)).toMatch(/^(normal|0px)$/);
    expect(await page.locator("main .t-lead").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/IBM Plex Sans Arabic/);
    expect(external).toEqual([]);
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the menu sheet marks Capabilities; nothing spills sideways at 390 or 320 px", async ({ page }) => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const locale of LOCALES) {
          await page.goto(`/${locale}/capabilities`, { waitUntil: "networkidle" });
          expect(await horizontalOverflow(page), `${locale} ${width}`).toBe(0);
          const wide = await page.evaluate(() =>
            [...document.querySelectorAll("main *")].filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
            }).length,
          );
          expect(wide, `${locale} ${width}`).toBe(0);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("details[data-sheet] > summary").tap();
      await expect(page.locator('.a2-sheet a.a2-sheet-row[aria-current="page"]')).toHaveAttribute("href", "/ar/capabilities");
    });
  });

  test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing in view stays hidden", async ({ page }) => {
      for (const path of ["/en/capabilities", "/ar/projects/clock-tower-landmark"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expect.poll(() => hiddenReveals(page), { message: path, timeout: 3_000 }).toBe(0);
      }
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the planned pages are complete from the server, in the light theme", async ({ page }) => {
      for (const path of ["/en/capabilities", "/ar/capabilities", "/en/projects/geometric-lanterns", "/ar/projects/billboard-support-structure"]) {
        await page.goto(path, { waitUntil: "load" });
        await expect(page.locator("h1"), path).toHaveCount(1);
        await expect(page.locator('main [role="note"]'), path).toBeVisible();
        const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length);
        expect(hidden, path).toBe(0);
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), path).toBe("rgb(244, 244, 241)");
      }
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Project pages (Stage 1F)
// ---------------------------------------------------------------------------------------------------------------------

test.describe("project pages", () => {
  test("every project, both languages: 200 in this design, its title and summary from the record, Stage 1F, planned and noindex, Home → Projects → Project", async ({ page }) => {
    test.setTimeout(240_000);
    for (const locale of LOCALES) {
      const dict = getDictionary(locale);
      for (const project of projects) {
        const path = `/${locale}/projects/${project.slug}`;
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(response?.status(), path).toBe(200);
        await expect(page.locator("body.mc"), path).toHaveCount(1);
        await expect(page, path).toHaveTitle(`${project.title[locale]} | ${SITE[locale]}`);
        await expect(page.locator("h1"), path).toHaveText(project.title[locale]);
        await expect(page.locator("main .t-lead"), path).toHaveText(project.summary[locale]);
        await expect(page.locator("main .eyebrow"), path).toHaveText(`${dict.placeholder.badge} · 1F`);
        await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", "noindex, follow");
        await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute("href", new RegExp(`${path}$`));
        await expect(page.locator('meta[name="description"]'), path).toHaveAttribute("content", project.summary[locale]);
        // The visible trail and its structured data: Home → Projects → the project.
        const crumbs = page.getByRole("navigation", { name: BREADCRUMB[locale] }).locator("li");
        await expect(crumbs, path).toHaveCount(3);
        await expect(crumbs.nth(0).locator("a"), path).toHaveAttribute("href", `/${locale}`);
        await expect(crumbs.nth(1).locator("a"), path).toHaveAttribute("href", `/${locale}/projects`);
        await expect(crumbs.nth(2).locator('[aria-current="page"]'), path).toHaveText(project.title[locale]);
        const trail = (await jsonLd(page)).find((d) => d["@type"] === "BreadcrumbList");
        expect(trail?.itemListElement.map((i: { name: string }) => i.name), path).toEqual([dict.common.home, routeLabels.projects[locale], project.title[locale]]);
        expect(trail.itemListElement[2].item, path).toMatch(new RegExp(`${path}$`));
        // Text only: no photograph, drawing, table, fact list or case-study part.
        expect(await mainParts(page), path).toEqual({ images: 0, drawings: 0, backgrounds: 0, tables: 0, headings: ["h1"], sections: 0 });
      }
    }
  });

  test("no project media anywhere on a planned project page: no photo, background, withheld or watermarked file, render or photo payload", async ({ request }) => {
    test.setTimeout(120_000);
    expect(withheldMedia).toEqual(expect.arrayContaining(["projects/stainless-landmark-1", "projects/billboard-structure-1"]));
    for (const locale of LOCALES) {
      for (const project of projects) {
        const path = `/${locale}/projects/${project.slug}`;
        // The whole response: markup, the inline page data and the head (preloads).
        const html = await (await request.get(path)).text();
        expect(html, path).not.toMatch(/<img\b|<picture\b|imageSrcSet|background-image|\/_next\/image/);
        expect(html, path).not.toContain("/media/projects/");
        for (const marker of MEDIA_MARKERS) expect(marker.test(html), `${path} ${marker}`).toBe(false);
        // The page data a client navigation would fetch carries none either.
        const data = await (await request.get(path, { headers: { RSC: "1" } })).text();
        expect(data, path).not.toContain("/media/projects/");
      }
    }
  });

  for (const [slug, media] of [
    ["stainless-landmark-sculpture", "projects/stainless-landmark-1"],
    ["billboard-support-structure", "projects/billboard-structure-1"],
  ] as const) {
    test(`${slug}: the page whose photo carries an AI watermark shows no image in either language`, async ({ page }) => {
      const requested: string[] = [];
      page.on("request", (r) => void (r.resourceType() === "image" && requested.push(r.url())));
      for (const locale of LOCALES) {
        await page.goto(`/${locale}/projects/${slug}`, { waitUntil: "networkidle" });
        await expect(page.locator("h1")).toHaveText(projects.find((p) => p.slug === slug)!.title[locale]);
        expect(await page.locator("img").count()).toBe(0);
        expect(await page.content()).not.toContain(media);
        expect(await mainParts(page)).toEqual({ images: 0, drawings: 0, backgrounds: 0, tables: 0, headings: ["h1"], sections: 0 });
      }
      expect(requested.filter((u) => /\/media\/|\/_next\/image/.test(u))).toEqual([]);
    });
  }

  test("the header marks Projects as the section, the language switch keeps the project, the trail leads back", async ({ page, context }) => {
    const errors = trackErrors(page);
    await page.goto("/en/projects/geometric-lanterns", { waitUntil: "networkidle" });
    await expect(page.locator('.a2-nav a[aria-current="true"]')).toHaveAttribute("href", "/en/projects");
    await expect(page.locator('.a2-nav [aria-current="page"]')).toHaveCount(0);
    await expect(page.locator('footer [aria-current="page"]')).toHaveCount(0);
    await expect(page.locator('.a2-header .a2-lang a[hreflang="ar-SA"]').first()).toHaveAttribute("href", "/ar/projects/geometric-lanterns");
    await page.locator(".a2-header .a2-lang").first().locator('a[hreflang="ar-SA"]').click();
    await page.waitForURL("**/ar/projects/geometric-lanterns");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar-SA");
    expect((await context.cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe("ar");
    await page.locator('.ip-crumbs a[href="/ar/projects"]').click();
    await page.waitForURL(/\/ar\/projects$/);
    await expect(page.locator(".a2-nav a[aria-current='page']")).toHaveAttribute("href", "/ar/projects");
    expect(errors).toEqual([]);
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the menu sheet marks Projects and its language switch keeps the project; no sideways scroll at 390 or 320 px", async ({ page }) => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const path of ["/en/projects/stainless-landmark-sculpture", "/ar/projects/billboard-support-structure"]) {
          await page.goto(path, { waitUntil: "networkidle" });
          expect(await horizontalOverflow(page), `${path} ${width}`).toBe(0);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("details[data-sheet] > summary").tap();
      const sheet = page.locator(".a2-sheet");
      await expect(sheet.locator('a.a2-sheet-row[aria-current="true"]')).toHaveAttribute("href", "/ar/projects");
      await expect(sheet.locator('.a2-lang a[hreflang="en"]')).toHaveAttribute("href", "/en/projects/billboard-support-structure");
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// An unknown project
// ---------------------------------------------------------------------------------------------------------------------

test.describe("unknown project", () => {
  test("a real 404 with this design's localized page at one and more path segments, noindex, never redirected again", async ({ request }) => {
    for (const [path, locale] of [
      ["/en/projects/not-a-project", "en"],
      ["/ar/projects/not-a-project", "ar"],
      ["/en/projects/not-a-project/extra", "en"],
      ["/ar/projects/a/b/c", "ar"],
    ] as const) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      const html = await response.text();
      expect(html, path).toContain(`<title>${TITLE_404[locale]}</title>`);
      expect(html, path).toMatch(/<meta name="robots" content="noindex"\/>/);
    }
    // Page data: one redirect to the address with its cache key, then a 404 — never a loop.
    const headerSets: Record<string, string>[] = [{ RSC: "1" }, { RSC: "1", "Next-Router-Prefetch": "1" }];
    for (const headers of headerSets) {
      const first = await request.get("/en/projects/not-a-project", { maxRedirects: 0, headers });
      expect(first.status()).toBe(307);
      const next = await request.get(first.headers()["location"], { maxRedirects: 0, headers });
      expect(next.status()).toBe(404);
    }
  });

  for (const locale of LOCALES) {
    test(`/${locale}/projects/not-a-project: the localized 404 in this design, its language switch keeps the address, the theme applies`, async ({ page, context }) => {
      const errors = trackErrors(page);
      await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
      const documents: string[] = [];
      page.on("request", (r) => void (r.resourceType() === "document" && documents.push(r.url())));
      const response = await page.goto(`/${locale}/projects/not-a-project`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(404);
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.locator("h1")).toHaveText(NOT_FOUND[locale]);
      await expect(page).toHaveTitle(TITLE_404[locale]);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      await expect(page.locator("[aria-current='page']")).toHaveCount(0);
      const target = other(locale);
      await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[target]}"]`).first()).toHaveAttribute("href", `/${target}/projects/not-a-project`);
      await page.waitForTimeout(1000);
      expect(documents).toHaveLength(1);
      expect(errors).toEqual([]);
    });
  }

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the menu sheet opens and its language switch keeps the unknown address", async ({ page }) => {
      await page.goto("/en/projects/not-a-project", { waitUntil: "networkidle" });
      await page.locator("details[data-sheet] > summary").tap();
      const sheet = page.locator(".a2-sheet");
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('.a2-lang a[hreflang="ar-SA"]')).toHaveAttribute("href", "/ar/projects/not-a-project");
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });
});

test("decoration is hidden from assistive technology on the planned pages and the unknown-project 404", async ({ page }) => {
  for (const path of ["/en/capabilities", "/ar/capabilities", "/en/projects/geometric-lanterns", "/ar/projects/clock-tower-landmark", "/en/projects/not-a-project"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const exposed = await page.evaluate(() =>
      [...document.querySelectorAll(".a2-ambient, .a2-cursor, svg.mc-icon, .ip-404-code")]
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .map((el) => el.getAttribute("class")),
    );
    expect(exposed, path).toEqual([]);
  }
});
