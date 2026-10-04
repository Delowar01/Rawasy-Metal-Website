import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mediaRegistry } from "../src/content/media.generated";
import { servicePage } from "../src/content/pages";
import { expectFinished, inView, signatureAnimations } from "./a2-helpers";
import { HTML_LANG, hiddenReveals, horizontalOverflow, jsonLd, LOCALES, trackErrors } from "./helpers";

/**
 * Stage TM-2.4: the services overview and the six service pages in the Modern Commerce design
 * (src/app/(commerce)/[locale]/services/, components in src/components/commerce/services/). Migrated here, assertion by
 * assertion, from the Stage 1D spec (service-pages.spec.ts): routes, language and search metadata, the sourced
 * relations (machines, projects, related services), the quote action, imagery, keyboard use, reduced motion, layout at
 * phone widths and rendering without JavaScript. Added: the overview and its index, the dynamic route's localized 404,
 * the project cards' interim link to the gallery (decision D4), the Capabilities placeholder (D5),
 * the shared signatures (unforked) and the four restyled drawings, anchors under the header, containment, and the
 * header and footer marking a service page. The generic inner-page checks of stage-1c.spec.ts still run on the
 * overview (INNER_PAGES).
 */

const SERVICES = ["laser-cutting", "cnc-bending", "steel-structures", "fabrication", "laser-engraving", "scaffolding"] as const;
type Slug = (typeof SERVICES)[number];

const NAMES: Record<Slug, { en: string; ar: string }> = {
  "laser-cutting": { en: "Laser Cutting", ar: "القص بالليزر" },
  "cnc-bending": { en: "CNC Bending", ar: "الثني بتقنية CNC" },
  "steel-structures": { en: "Steel Structures", ar: "الهياكل الحديدية" },
  fabrication: { en: "Metal Fabrication", ar: "التصنيع المعدني" },
  "laser-engraving": { en: "Laser Engraving", ar: "الحفر بالليزر" },
  scaffolding: { en: "Scaffolding", ar: "السقالات" },
};

/** Machines the company profile ties to each service (machines.ts). */
const MACHINES: Record<Slug, string[]> = {
  "laser-cutting": ["tube-cutting-12kw", "fiber-laser-combo-12kw", "fiber-laser-6kw", "fiber-laser-3kw"],
  "cnc-bending": ["cnc-press-brake"],
  "steel-structures": [],
  fabrication: ["laser-welding"],
  "laser-engraving": [],
  scaffolding: [],
};

/** Projects whose own record lists the service, by their titles (each card opens the gallery until Stage 1F: D4). */
const PROJECTS: Record<Slug, string[]> = {
  "laser-cutting": ["Geometric Lanterns", "Perforated Canopy Screen", "Clock Tower Landmark", "Suspended Lantern"],
  "cnc-bending": ["Perforated Metal Seating"],
  "steel-structures": ["Palm-Leaf Shade Canopies", "Gateway Welcome Signs", "Car Park Shade Structures", "Curved Steel Frames"],
  fabrication: ["Heritage Cannon Replicas", "Dome Finial & Crescent", "Sculpture Fabrication", "Lattice Tower Replica"],
  "laser-engraving": [],
  scaffolding: [],
};

/** The same projects' slugs: each card opens its project's place in the Projects gallery (D4, since TM-2.5). */
const PROJECT_SLUGS: Record<Slug, string[]> = {
  "laser-cutting": ["geometric-lanterns", "perforated-canopy-screen", "clock-tower-landmark", "suspended-lantern"],
  "cnc-bending": ["perforated-metal-seating"],
  "steel-structures": ["palm-leaf-shade-canopies", "gateway-welcome-signs", "car-park-shade-structures", "curved-steel-frames"],
  fabrication: ["heritage-cannon-replicas", "dome-finial-and-crescent", "sculpture-fabrication", "lattice-tower-replica"],
  "laser-engraving": [],
  scaffolding: [],
};

const RELATED: Record<Slug, Slug[]> = {
  "laser-cutting": ["cnc-bending", "fabrication", "laser-engraving"],
  "cnc-bending": ["laser-cutting", "fabrication", "steel-structures"],
  "steel-structures": ["fabrication", "cnc-bending", "scaffolding"],
  fabrication: ["laser-cutting", "cnc-bending", "steel-structures"],
  "laser-engraving": ["laser-cutting", "fabrication"],
  scaffolding: ["steel-structures", "fabrication"],
};

/** Each page's sections, in their Stage 1D order (a section is left out when its content does not exist). */
const SECTIONS: Record<Slug, string[]> = {
  "laser-cutting": ["overview", "scope", "process", "machinery", "applications", "gallery", "why", "related", "projects"],
  "cnc-bending": ["overview", "scope", "process", "machinery", "applications", "gallery", "why", "related", "projects"],
  "steel-structures": ["overview", "scope", "process", "applications", "gallery", "why", "related", "projects"],
  fabrication: ["overview", "scope", "process", "machinery", "applications", "gallery", "why", "related", "projects"],
  "laser-engraving": ["overview", "scope", "process", "applications", "why", "related"],
  scaffolding: ["overview", "scope", "process", "applications", "gallery", "why", "related"],
};

const PAGES = ["services", ...SERVICES.map((s) => `services/${s}`)];
const IN_GALLERY = { en: "View in the gallery", ar: "عرض في معرض الأعمال" } as const;
const NOT_FOUND = { en: "Outside the blueprint", ar: "خارج المخطط" } as const;
const TITLE_404 = { en: "Page not found | RAWASY", ar: "الصفحة غير موجودة | رواسي" } as const;
const HERO = 'section[aria-labelledby="page-title"]';

/** Source size of every image in the media registry, by its file path. */
const SOURCE = new Map<string, readonly [number, number]>(Object.values(mediaRegistry).map((m) => [m.src, [m.width, m.height] as const]));
const mediaPath = (src: string) => decodeURIComponent(src.replace(/.*url=([^&]+).*/, "$1"));

/** Shows every reveal at once (measurements of whole pages). */
const revealAll = (page: Page) => page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-shown", "")));

async function newPage(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}): Promise<[Page, BrowserContext]> {
  const context = await browser.newContext(options);
  return [await context.newPage(), context];
}

// ---------------------------------------------------------------------------------------------------------------------
// Routes, language and search metadata (Stage 1D, kept)
// ---------------------------------------------------------------------------------------------------------------------

test.describe("routes, language and search metadata", () => {
  for (const locale of LOCALES) {
    for (const slug of SERVICES) {
      test(`/${locale}/services/${slug}`, async ({ page }) => {
        const errors = trackErrors(page);
        const response = await page.goto(`/${locale}/services/${slug}`, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);
        await expect(page.locator("body.mc")).toHaveCount(1);

        await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveText(NAMES[slug][locale]);

        // Heading levels never skip (h1 → h2 → h3).
        const levels = await page.locator("main :is(h1, h2, h3, h4)").evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
        for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1);

        // The sections in their Stage 1D order, each numbered and named by its heading.
        const ids = await page.locator("main > section[id]").evaluateAll((sections) => sections.map((s) => s.id));
        expect(ids).toEqual(SECTIONS[slug]);
        for (const [i, id] of SECTIONS[slug].entries()) {
          await expect(page.locator(`section#${id} .ip-index`).first(), id).toHaveText(String(i + 1).padStart(2, "0"));
          await expect(page.locator(`section#${id}`), id).toHaveAttribute("aria-labelledby", `${id}-title`);
        }

        // Breadcrumb: Home → Services → service, also as structured data, with a Service node.
        const crumbs = page.locator("main nav[aria-label] ol > li");
        await expect(crumbs).toHaveCount(3);
        await expect(crumbs.nth(1).locator("a")).toHaveAttribute("href", `/${locale}/services`);
        await expect(crumbs.nth(2).locator('[aria-current="page"]')).toHaveText(NAMES[slug][locale]);
        const data = await jsonLd(page);
        const service = data.find((d) => d["@type"] === "Service");
        expect(service?.name).toBe(NAMES[slug][locale]);
        expect(service?.url).toMatch(new RegExp(`/${locale}/services/${slug}$`));
        expect(service?.provider?.["@id"]).toMatch(/#organization$/);
        expect(data.find((d) => d["@type"] === "BreadcrumbList")?.itemListElement).toHaveLength(3);

        // Localized canonical and alternates; noindex until Stage 1J.
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/services/${slug}$`));
        for (const lang of ["en", "ar", "x-default"]) await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
        expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toContain(NAMES[slug][locale]);
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");

        // No development placeholder left, and a general-workflow note on the process.
        await expect(page.getByText(locale === "en" ? "This page is being engineered." : "نعمل على هندسة هذه الصفحة.")).toHaveCount(0);
        await expect(page.locator("#process")).toContainText(locale === "en" ? "not a certified procedure" : "وليست إجراءً معتمدًا");

        expect(await horizontalOverflow(page)).toBe(0);
        expect(errors).toEqual([]);
      });
    }
  }

  test("the service pages and the overview stay out of the sitemap", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).not.toContain("/services");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The services overview
// ---------------------------------------------------------------------------------------------------------------------

test.describe("the services overview", () => {
  test("links to all six service pages in order: the hero's tiles and the index jump to each row, each row opens its page", async ({ page }) => {
    for (const locale of LOCALES) {
      const errors = trackErrors(page);
      await page.goto(`/${locale}/services`, { waitUntil: "networkidle" });
      await expect(page.locator("body.mc")).toHaveCount(1);
      // Six rows, in order, each a named article with one link to its page ("Explore" and the name).
      expect(await page.locator("main article[id]").evaluateAll((rows) => rows.map((r) => r.id))).toEqual([...SERVICES]);
      for (const slug of SERVICES) {
        const row = page.locator(`article#${slug}`);
        await expect(row).toHaveAttribute("aria-labelledby", `${slug}-title`);
        await expect(page.locator(`#${slug}-title`)).toHaveText(NAMES[slug][locale]);
        const links = row.locator(`a[href="/${locale}/services/${slug}"]`);
        await expect(links).toHaveCount(1);
        await expect(links).toContainText(NAMES[slug][locale]);
        await expect(page.locator(`main a[href="/${locale}/services/${slug}"]`)).toHaveCount(1);
      }
      // The tiles (services at a glance) and the index: one jump per service, in order.
      for (const label of [servicesLabels.plate[locale], servicesLabels.index[locale]]) {
        const nav = page.locator(`main nav[aria-label="${label}"]`);
        await expect(nav).toHaveCount(1);
        expect(await nav.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(SERVICES.map((s) => `#${s}`));
      }
      // The closing panel: the quotation, the machinery (Capabilities placeholder) and the projects.
      const cta = page.locator('section[aria-labelledby="page-cta-title"] a');
      expect(await cta.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual([`/${locale}/contact`, `/${locale}/capabilities`, `/${locale}/projects`]);
      expect(errors).toEqual([]);
    }
  });

  test("the index marks the service being read and jumps to it from the keyboard (one marked at a time)", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "networkidle" });
    const index = page.locator('main nav[aria-label="Service index"]');
    await expect(index.locator('a[aria-current="true"]')).toHaveCount(1);
    await expect(index.locator('a[href="#laser-cutting"]')).toHaveAttribute("aria-current", "true");
    // Scrolled to a row, the index follows it.
    await page.locator("article#steel-structures").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await expect(index.locator('a[href="#steel-structures"]')).toHaveAttribute("aria-current", "true");
    await expect(index.locator('a[aria-current="true"]')).toHaveCount(1);
    // From the keyboard: Enter on an entry jumps to the row, marks it and keeps the address.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const link = index.locator('a[href="#cnc-bending"]');
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(link).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(/#cnc-bending$/);
    await expect(page.locator("article#cnc-bending")).toBeInViewport();
  });

  test("a tile lands its row below the header, on desktop and on phones", async ({ browser }) => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const [page, context] = await newPage(browser, { viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 });
      await page.goto("/ar/services", { waitUntil: "networkidle" });
      await page.locator('main nav[aria-label="الخدمات في لمحة"] a[href="#fabrication"]').click();
      await page.waitForURL(/#fabrication$/);
      await expect.poll(() => page.locator("article#fabrication").evaluate((el) => Math.round(el.getBoundingClientRect().top)), { timeout: 4000 }).toBeLessThan(120);
      const top = await page.locator("article#fabrication").evaluate((el) => el.getBoundingClientRect().top);
      const header = await page.locator(".a2-header").evaluate((el) => el.getBoundingClientRect().bottom);
      expect(top, `${width}`).toBeGreaterThanOrEqual(header);
      await context.close();
    }
  });

  test("equipment: the machines behind each service, rated power only where the profile states it", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "networkidle" });
    const tags = (slug: Slug) => page.locator(`article#${slug} .tag`).evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(await tags("laser-cutting")).toEqual(["Tube Cutting · 12 kW", "Fiber Laser Combo · 12 kW", "Fiber Laser · 6 kW", "Fiber Laser · 3 kW"]);
    expect(await tags("cnc-bending")).toEqual(["CNC Press Brake"]);
    expect(await tags("fabrication")).toEqual(["Laser Welding"]);
    for (const slug of ["steel-structures", "laser-engraving", "scaffolding"] as const) expect(await tags(slug)).toEqual([]);
  });
});

/** The overview's two navigation labels. */
const servicesLabels = {
  plate: { en: "Services at a glance", ar: "الخدمات في لمحة" },
  index: { en: "Service index", ar: "فهرس الخدمات" },
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// The dynamic route: the language switch, the localized 404, the current page in the header and footer
// ---------------------------------------------------------------------------------------------------------------------

test.describe("the dynamic route", () => {
  test("the language switch keeps the service, in the header and the phone menu, and remembers the choice", async ({ page, browser }) => {
    for (const slug of SERVICES) {
      for (const locale of LOCALES) {
        await page.goto(`/${locale}/services/${slug}`, { waitUntil: "domcontentloaded" });
        const other = locale === "en" ? "ar" : "en";
        const links = page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[other]}"]`);
        expect(await links.evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))])).toEqual([`/${other}/services/${slug}`]);
      }
    }
    await page.goto("/en/services/scaffolding", { waitUntil: "networkidle" });
    await page.locator('.a2-header .a2-lang a[hreflang="ar-SA"]').first().click();
    await page.waitForURL("**/ar/services/scaffolding");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveText(NAMES.scaffolding.ar);
    expect((await page.context().cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe("ar");

    // On a phone, from the menu sheet.
    const [phone, context] = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phone.goto("/ar/services/laser-engraving", { waitUntil: "networkidle" });
    await phone.locator("details[data-menu] > summary").tap();
    await phone.locator('.a2-sheet .a2-lang a[hreflang="en"]').tap();
    await phone.waitForURL("**/en/services/laser-engraving");
    await expect(phone.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(phone.locator("h1")).toHaveText(NAMES["laser-engraving"].en);
    await context.close();
  });

  test("an unknown service is a real 404 with this design's localized page: lang and dir, noindex, the address kept", async ({ page, request }) => {
    for (const locale of LOCALES) {
      const path = `/${locale}/services/not-a-service`;
      const html = await (await request.get(path)).text();
      expect((await request.get(path)).status()).toBe(404);
      expect(html).toContain(`<title>${TITLE_404[locale]}</title>`);
      expect(html).toMatch(/<meta name="robots" content="noindex"\/>/);

      const errors = trackErrors(page);
      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(404);
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(NOT_FOUND[locale]);
      await expect(page).toHaveTitle(TITLE_404[locale]);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      // Nothing is marked as the current page, and the language switch keeps the unknown address.
      await expect(page.locator("[aria-current='page']")).toHaveCount(0);
      const other = locale === "en" ? "ar" : "en";
      await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[other]}"]`).first()).toHaveAttribute("href", `/${other}/services/not-a-service`);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(errors).toEqual([]);
    }
    // A deeper unknown address under a service is the catch-all's 404 (also this design's).
    expect((await request.get("/en/services/laser-cutting/extra")).status()).toBe(404);
  });

  test("no page-data loop for an unknown service: one redirect to the page-data address, then a 404", async ({ request }) => {
    for (const headers of [{ RSC: "1" }, { RSC: "1", "Next-Router-Prefetch": "1" }] as Record<string, string>[]) {
      const first = await request.get("/ar/services/not-a-service", { maxRedirects: 0, headers });
      expect(first.status()).toBe(307);
      const next = await request.get(first.headers()["location"], { maxRedirects: 0, headers });
      expect(next.status()).toBe(404);
    }
  });

  test("the header and footer mark a service page: Services as the section, the service as the page (the homepage marks none)", async ({ page, browser }) => {
    await page.goto("/en/services/cnc-bending", { waitUntil: "networkidle" });
    await expect(page.locator(".a2-nav summary.nav-link")).toHaveAttribute("aria-current", "true");
    await expect(page.locator(".a2-nav .a2-dd-item[aria-current]")).toHaveCount(1);
    await expect(page.locator('.a2-nav .a2-dd-item[href="/en/services/cnc-bending"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".a2-footer a[aria-current='page']")).toHaveCount(1);
    await expect(page.locator('.a2-footer a[href="/en/services/cnc-bending"]')).toHaveAttribute("aria-current", "page");
    // The overview: Services is the page itself; no service is marked.
    await page.goto("/en/services", { waitUntil: "networkidle" });
    await expect(page.locator(".a2-nav summary.nav-link")).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".a2-dd-item[aria-current], .a2-footer a[aria-current]")).toHaveCount(0);
    // The homepage: none of it.
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator(".a2-nav summary.nav-link")).not.toHaveAttribute("aria-current", /.+/);
    await expect(page.locator(".a2-dd-item[aria-current], .a2-footer a[aria-current], .a2-nav [aria-current='true'], .a2-sheet [aria-current='true']:not(.a2-lang a)")).toHaveCount(0);
    // The phone menu sheet marks the same.
    const [phone, context] = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phone.goto("/ar/services/scaffolding", { waitUntil: "networkidle" });
    await expect(phone.locator(".a2-sheet summary.a2-sheet-row")).toHaveAttribute("aria-current", "true");
    await expect(phone.locator('.a2-sheet .a2-dd-item[href="/ar/services/scaffolding"]')).toHaveAttribute("aria-current", "page");
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Sourced relations
// ---------------------------------------------------------------------------------------------------------------------

test.describe("sourced relations", () => {
  for (const slug of SERVICES) {
    test(`${slug}: machines, projects, related services, the quote action and the call`, async ({ page }) => {
      for (const locale of LOCALES) {
        await page.goto(`/${locale}/services/${slug}`, { waitUntil: "networkidle" });
        const main = page.locator("main");

        // Machines: only those the profile ties to the service, each linking to its place on Capabilities (D5).
        const machineLinks = main.locator(`#machinery a[href^="/${locale}/capabilities#"]`);
        await expect(machineLinks).toHaveCount(MACHINES[slug].length);
        if (MACHINES[slug].length === 0) await expect(page.locator("#machinery")).toHaveCount(0);
        for (const machine of MACHINES[slug]) await expect(main.locator(`#machinery a[href="/${locale}/capabilities#${machine}"]`)).toHaveCount(1);
        if (MACHINES[slug].length) await expect(main.locator(`#machinery a[href="/${locale}/capabilities"]`)).toHaveCount(1);

        // Projects: only those whose own record lists the service, each opening its own place in the gallery and saying so
        // (D4; #<slug> since TM-2.5, unchanged by Stage 1F: never a project page).
        if (PROJECTS[slug].length === 0) await expect(page.locator("#projects")).toHaveCount(0);
        else {
          const cards = main.locator("#projects a.ab-proj");
          await expect(cards).toHaveCount(PROJECTS[slug].length);
          expect(await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(PROJECT_SLUGS[slug].map((p) => `/${locale}/projects#${p}`));
          for (const card of await cards.all()) await expect(card).toContainText(IN_GALLERY[locale]);
          if (locale === "en") expect(await cards.locator("h3").allInnerTexts()).toEqual(PROJECTS[slug]);
          await expect(main.locator(`#projects a[href="/${locale}/projects"]`)).toHaveCount(1);
        }

        // Related services, in order.
        const related = await main.locator(`#related a[href^="/${locale}/services/"]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
        expect(related).toEqual(RELATED[slug].map((s) => `/${locale}/services/${s}`));
        await expect(main.locator(`#related a[href="/${locale}/services"]`)).toHaveCount(1);

        // The quote action (hero and closing panel) opens the contact page's request form; one direct call.
        await expect(main.locator(`a[href="/${locale}/contact#quote"]`)).toHaveCount(2);
        await expect(page.locator('section[aria-labelledby="page-cta-title"] a[href^="tel:+966"]')).toHaveCount(1);
        expect(await page.locator('section[aria-labelledby="page-cta-title"] li a').evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual([
          `/${locale}/services`,
          `/${locale}/projects`,
        ]);
      }
    });
  }

  test("no link to an unfinished project page on any of the fourteen pages; every machine link names a machine on Capabilities (D4, D5)", async ({ page, request }) => {
    for (const locale of LOCALES) {
      for (const path of PAGES) {
        await page.goto(`/${locale}/${path}`, { waitUntil: "domcontentloaded" });
        const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
        expect(hrefs.filter((h) => /\/projects\/[^/#?]/.test(h)), path).toEqual([]);
        for (const href of hrefs.filter((h) => h.includes("/capabilities"))) expect(href, path).toMatch(new RegExp(`^/${locale}/capabilities(#[a-z0-9-]+)?$`));
      }
    }
    // Since Stage 1E the destination is the Capabilities page itself: every machine a service page names is a panel there,
    // under its slug (commerce-capabilities.spec.ts follows the links and checks the landing).
    const capabilities = await (await request.get("/en/capabilities")).text();
    expect(capabilities).not.toContain("In development");
    for (const machine of new Set(Object.values(MACHINES).flat())) expect(capabilities).toMatch(new RegExp(`<article[^>]*\\bid="${machine}"[^>]*data-machine`));
  });

  test("rated power appears only where the profile states it; nothing else is stated about the machines", async ({ page }) => {
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    for (const [machine, power] of [
      ["tube-cutting-12kw", "12,000"],
      ["fiber-laser-combo-12kw", "12,000"],
      ["fiber-laser-6kw", "6,000"],
      ["fiber-laser-3kw", "3,000"],
    ]) {
      await expect(page.locator(`#machinery a[href="/en/capabilities#${machine}"]`)).toContainText(power);
      await expect(page.locator(`#machinery a[href="/en/capabilities#${machine}"] .sv-power`)).toContainText("Rated power");
    }
    for (const slug of ["cnc-bending", "fabrication"] as const) {
      await page.goto(`/en/services/${slug}`, { waitUntil: "networkidle" });
      await expect(page.locator("#machinery")).toContainText(slug === "cnc-bending" ? "CNC Press Brake Machine" : "Laser Welding Machine");
      await expect(page.locator("#machinery")).not.toContainText("Rated power");
      await expect(page.locator("#machinery .sv-power")).toHaveCount(0);
    }
    // No bed sizes, thicknesses, tolerances, speeds or capacities anywhere on the machine cards.
    for (const slug of ["laser-cutting", "cnc-bending", "fabrication"] as const) {
      await page.goto(`/en/services/${slug}`, { waitUntil: "networkidle" });
      expect(await page.locator("#machinery").innerText()).not.toMatch(/\b(mm|tonnes?|tons?|m\/min|±|bed|thickness|tolerance|capacity)\b/i);
    }
  });

  test("every process carries the general-workflow note, in both languages", async ({ page }) => {
    for (const locale of LOCALES) {
      for (const slug of SERVICES) {
        await page.goto(`/${locale}/services/${slug}`, { waitUntil: "domcontentloaded" });
        const notes = page.locator("#process .sv-note");
        await expect(notes, slug).toHaveCount(1);
        await expect(notes).toHaveText(servicePage.processNote[locale]);
        // An ordered list of steps.
        expect(await page.locator("#process ol > li").count(), slug).toBeGreaterThanOrEqual(5);
      }
    }
  });

  test("Laser Engraving: no photographs, machinery, gallery or projects; Scaffolding: no machinery or projects", async ({ page, request }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/services/laser-engraving`, { waitUntil: "networkidle" });
      expect(await page.locator("main img").count()).toBe(0);
      await expect(page.locator("#machinery, #gallery, #projects")).toHaveCount(0);
      // The hero shows the approved drawing; its "see the work" action is left out (nothing to see yet).
      await expect(page.locator(`${HERO} .sig-engrave`)).toHaveCount(1);
      await expect(page.locator(`${HERO} a[href^="#"]`)).toHaveCount(0);
      const html = await (await request.get(`/${locale}/services/laser-engraving`)).text();
      // Third-party branding with part/serial numbers, and renders: not on the engraving page.
      for (const id of ["engraving-nameplates", "engraving-wood", "engraving-rotary"]) expect(html).not.toContain(id);

      await page.goto(`/${locale}/services/scaffolding`, { waitUntil: "networkidle" });
      await expect(page.locator("#machinery, #projects")).toHaveCount(0);
      await expect(page.locator(`main a[href*="/capabilities"]`)).toHaveCount(0);
      await expect(page.locator(`${HERO} a[href="#gallery"]`)).toHaveCount(1);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Imagery
// ---------------------------------------------------------------------------------------------------------------------

test.describe("imagery", () => {
  test("images have text alternatives (or are named by their caption) and questionable images stay off the pages", async ({ page, request }) => {
    for (const path of PAGES) {
      await page.goto(`/en/${path}`, { waitUntil: "networkidle" });
      // Every image has alt text, or alt="" where a link, its caption or hidden decoration names it.
      const missing = await page.locator("main img").evaluateAll((imgs) =>
        imgs
          .filter((img) => !img.hasAttribute("alt") || (img.getAttribute("alt") === "" && !img.closest("a, [aria-hidden='true'], figure:has(figcaption)")))
          .map((img) => img.getAttribute("src")),
      );
      expect(missing, path).toEqual([]);
      if (path !== "services/laser-engraving") expect(await page.locator("main img").count(), path).toBeGreaterThan(2);
    }
    // The overview's engraving row: the drawing, never the flagged photographs (D6).
    for (const locale of LOCALES) {
      const html = await (await request.get(`/${locale}/services`)).text();
      for (const id of ["engraving-nameplates", "engraving-wood", "engraving-rotary"]) expect(html).not.toContain(id);
    }
    const cutting = await (await request.get("/en/services/laser-cutting")).text();
    // Authorship still to be confirmed: kept out of the laser-cutting gallery.
    expect(cutting).not.toContain("canopy-tree-1");
    for (const slug of SERVICES) {
      const html = await (await request.get(`/ar/services/${slug}`)).text();
      for (const id of ["wheat-monument-1", "stainless-landmark-1", "billboard-structure-1", "canopy-tree-1"]) expect(html, slug).not.toContain(id);
    }
  });

  test("no photograph is shown wider or taller than its source, on desktop and on phones", async ({ browser }) => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const [page, context] = await newPage(browser, { viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800, reducedMotion: "reduce" });
      for (const path of PAGES) {
        await page.goto(`/en/${path}`, { waitUntil: "networkidle" });
        await revealAll(page);
        const shown = await page.locator("main img").evaluateAll((imgs) =>
          imgs
            .filter((img) => img.checkVisibility())
            .map((img) => {
              const r = img.getBoundingClientRect();
              return { src: img.getAttribute("src") ?? "", w: r.width, h: r.height, fit: getComputedStyle(img).objectFit };
            }),
        );
        const enlarged = shown
          .map((img) => {
            const size = SOURCE.get(mediaPath(img.src));
            if (!size) return null;
            const scale = img.fit === "contain" ? Math.min(img.w / size[0], img.h / size[1]) : Math.max(img.w / size[0], img.h / size[1]);
            return scale > 1.005 ? `${mediaPath(img.src)} ×${scale.toFixed(3)}` : null;
          })
          .filter(Boolean);
        expect(enlarged, `${path} at ${width}`).toEqual([]);
        expect(shown.every((img) => SOURCE.has(mediaPath(img.src))), path).toBe(true);
      }
      await context.close();
    }
  });

  test("no gallery photo is repeated in the same page's project cards", async ({ page }) => {
    for (const slug of SERVICES) {
      await page.goto(`/en/services/${slug}`, { waitUntil: "networkidle" });
      const sources = (selector: string) => page.locator(selector).evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src") ?? ""));
      const gallery = (await sources("#gallery img")).map(mediaPath);
      const projects = (await sources("#projects img")).map(mediaPath);
      expect(gallery.filter((src) => projects.includes(src)), slug).toEqual([]);
      // Each photo appears once in the gallery.
      expect(new Set(gallery).size, slug).toBe(gallery.length);
    }
  });

  test("decoration is hidden from assistive technology; the previous design's decoration is retired (D8)", async ({ page }) => {
    for (const locale of LOCALES) {
      for (const path of PAGES) {
        await page.goto(`/${locale}/${path}`, { waitUntil: "domcontentloaded" });
        const exposed = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              "main svg, main .sig, main .sv-axes, main .sv-bench-plate, main .sv-swatch, main .sv-phase-n, main .sv-support-n, main .sv-row-n, main .sv-phase-link, main .sv-cycle-link, main .sv-cycle-return, main .ab-proj-flag, main .sv-basis-mark, main .sv-eyebrow-rule, .a2-ambient, .a2-cursor",
            ),
          ]
            .filter((el) => !el.closest('[aria-hidden="true"]'))
            .map((el) => el.getAttribute("class")),
        );
        expect(exposed, path).toEqual([]);
        // No grid backdrops, scan lines, frame or registration marks, rulers, pointer light or outlined numerals.
        await expect(page.locator("main :is(.backdrop, .scan, .plight, .tf, .tf-host, .reg-marks, .ruler, .outline-num, .line-draw, .section-rule)"), path).toHaveCount(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Signatures and drawings
// ---------------------------------------------------------------------------------------------------------------------

/** A signature's markup, with the ids React gives its gradients normalised. */
const signatureMarkup = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => el.outerHTML.replace(/\b(lc|le)[A-Za-z0-9]+(?=-(halo|flash|trail|line|beam))/g, "$1ID"));

test.describe("signatures and drawings", () => {
  test.describe("the same components as the homepage", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("Laser Cutting shows the homepage's LaserCut, unforked: the same markup, sized by its container", async ({ page }) => {
      for (const locale of LOCALES) {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        const home = await signatureMarkup(page, "#services .sig-cut");
        await page.goto(`/${locale}/services/laser-cutting`, { waitUntil: "networkidle" });
        await expect(page.locator(".sig-cut")).toHaveCount(1);
        expect(await signatureMarkup(page, `${HERO} .sig-cut`)).toBe(home);
        // It fills its stage on the page (the service page's own container), never wider than the stage.
        const fit = await page.locator(".sv-cut-sheet").evaluate((stage) => {
          const s = stage.getBoundingClientRect();
          const sig = stage.querySelector(".sig")!.getBoundingClientRect();
          const pad = parseFloat(getComputedStyle(stage).paddingLeft);
          return { sig: sig.width, room: s.width - 2 * pad - 2 };
        });
        expect(Math.abs(fit.sig - fit.room)).toBeLessThan(1.5);
      }
    });

    test("Laser Engraving and the overview's engraving row show the homepage's LaserEngrave, unforked", async ({ page }) => {
      for (const locale of LOCALES) {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        const home = await signatureMarkup(page, "#services .sig-engrave");
        await page.goto(`/${locale}/services/laser-engraving`, { waitUntil: "networkidle" });
        await expect(page.locator(".sig-engrave")).toHaveCount(1);
        expect(await signatureMarkup(page, `${HERO} .sig-engrave`)).toBe(home);
        await page.goto(`/${locale}/services`, { waitUntil: "networkidle" });
        await expect(page.locator(".sig-engrave")).toHaveCount(1);
        await expect(page.locator(".sig-cut")).toHaveCount(0);
        expect(await signatureMarkup(page, "article#laser-engraving .sig-engrave")).toBe(home);
      }
    });
  });

  test("Laser Cutting: plays once half in view, completes where the service page parks the head, replays on hover and on keyboard focus", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    // The hero is the signature's host; the sheet is in view at once, so the run starts.
    await expect(page.locator(HERO)).toHaveAttribute("data-sig-host", "");
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).length).toBeGreaterThan(20);
    const run = await signatureAnimations(page, ".sig-cut");
    for (const a of run) {
      // One pass on a shared clock, never looping.
      expect(a.iterations).toBe(1);
      expect(a.end).toBeLessThanOrEqual(8500);
    }
    // Mid-run: the head is on its way (not parked yet).
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).some((a) => a.state === "running")).toBe(true);
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    await expectFinished(page, ["cut"]);

    // Scrolled away and back: a one-time run does not start again.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(500);
    expect((await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished")).toBe(true);

    // A mouse coming back to the hero replays it.
    await page.mouse.move(700, 20);
    await page.locator(`${HERO} h1`).hover();
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).some((a) => a.state === "running")).toBe(true);
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    // A replay is the run without the sheet's entrance, plus one fade of the finished work: one more animation than the
    // first run's own, with the entrance's kept ones (which outlive replays) counted once.
    const replayed = (await signatureAnimations(page, ".sig-cut")).length;
    expect(replayed).toBe(run.length + 1);
    // The keyboard moving into the hero replays it too.
    await page.mouse.move(700, 20);
    await page.locator(`${HERO} a[href="/en/contact#quote"]`).focus();
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).some((a) => a.state === "running")).toBe(true);
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    // No duplicate animations (a replay replaces the previous run, never adds to it) and no stuck head after the replays.
    expect((await signatureAnimations(page, ".sig-cut")).length).toBe(replayed);
    await expectFinished(page, ["cut"]);
    expect(errors).toEqual([]);
  });

  test("Laser Engraving: plays in view and finishes; mirrored in Arabic; no listener growth after replays", async ({ page }) => {
    let engraveRun = 0;
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/services/laser-engraving`, { waitUntil: "networkidle" });
      await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).length).toBeGreaterThan(20);
      await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
      await expectFinished(page, ["engrave"]);
      expect(await page.locator(".sig-engrave .sig-art").evaluate((el) => getComputedStyle(el).scale)).toBe(locale === "ar" ? "-1 1" : "none");
      engraveRun = (await signatureAnimations(page, ".sig-engrave")).length;
    }
    // The host keeps one listener of each kind, however often it replays.
    const session = await page.context().newCDPSession(page);
    const listeners = async () => {
      const { result } = await session.send("Runtime.evaluate", { expression: `document.querySelector('${HERO}')` });
      const { listeners } = await session.send("DOMDebugger.getEventListeners", { objectId: result.objectId! });
      return listeners.map((l) => l.type).sort();
    };
    const before = await listeners();
    expect(before.filter((t) => t === "pointerenter")).toHaveLength(1);
    expect(before.filter((t) => t === "focusin")).toHaveLength(1);
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(700, 20);
      await page.locator(`${HERO} h1`).hover();
      await page.waitForTimeout(150);
      await page.locator(".sig-engrave").evaluate((el) => el.dispatchEvent(new CustomEvent("sig:replay")));
    }
    expect(await listeners()).toEqual(before);
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    // A replay is the run without the plate's entrance, plus one fade of each engraved layer: no duplicates however
    // often it replays (each replay replaces the previous one).
    const layers = await page.locator(".sig-engrave .sig-engr").count();
    const replayed = (await signatureAnimations(page, ".sig-engrave")).length;
    expect(replayed).toBe(engraveRun + layers);
    await page.locator(".sig-engrave").evaluate((el) => el.dispatchEvent(new CustomEvent("sig:replay")));
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    expect((await signatureAnimations(page, ".sig-engrave")).length).toBe(replayed);
    await expectFinished(page, ["engrave"]);
  });

  test("phones: the signature waits until it is half in view, plays, and a touch never replays it", async ({ browser }) => {
    const [page, context] = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    const ratio = await page.locator(".sig-cut").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height;
    });
    if (ratio < 0.5) expect(await signatureAnimations(page, ".sig-cut")).toEqual([]);
    await inView(page, ".sig-cut");
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).length).toBeGreaterThan(20);
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    await page.locator(".sv-cut-sheet").tap();
    await page.waitForTimeout(300);
    expect((await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished")).toBe(true);
    await context.close();
  });

  test("dark theme: the signatures finish on their stages, the drawings stay visible", async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
    await page.goto("/ar/services/laser-cutting", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished") && (await signatureAnimations(page, ".sig-cut")).length > 0, { timeout: 14000 }).toBe(true);
    await expectFinished(page, ["cut"]);
    // The restyled drawings take the dark theme's lifted tones (not the light theme's).
    await page.goto("/ar/services/cnc-bending", { waitUntil: "networkidle" });
    const stroke = await page.locator(".sv-press path[stroke='var(--brand)']").first().evaluate((el) => getComputedStyle(el).stroke);
    expect(stroke).toBe("rgb(242, 106, 46)");
  });

  test("the four other drawings draw themselves once when revealed, with no other motion", async ({ page }) => {
    // The drawing's state before the page script reveals it (undrawn), recorded as soon as the document is parsed.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const path = document.querySelector(".sv-draw [pathLength]");
        const axis = document.querySelector(".sv-axis-v");
        (window as unknown as { __before: unknown }).__before = {
          offset: path ? getComputedStyle(path).strokeDashoffset : null,
          axis: axis ? getComputedStyle(axis).transform : null,
        };
      });
    });
    for (const [slug, drawing] of [
      ["cnc-bending", ".sv-press"],
      ["fabrication", ".sv-seam"],
      ["scaffolding", ".sv-tower"],
      ["steel-structures", ".sv-axes"],
    ] as const) {
      await page.goto(`/en/services/${slug}`, { waitUntil: "networkidle" });
      const before = await page.evaluate(() => (window as unknown as { __before: { offset: string | null; axis: string | null } }).__before);
      const el = page.locator(drawing);
      await expect(el).toHaveCount(1);
      await expect(el).toHaveAttribute("aria-hidden", "true");
      await el.evaluate((node) => node.scrollIntoView({ block: "center" }));
      if (drawing === ".sv-axes") {
        // The column axes scale in from the top, the rows from the side; then they stay drawn.
        expect(before.axis).toMatch(/^matrix\(1, 0, 0, 0,/);
        await expect.poll(() => el.evaluate((node) => [...node.querySelectorAll(".sv-axis")].every((a) => getComputedStyle(a).transform === "none")), { timeout: 5000 }).toBe(true);
      } else {
        expect(before.offset, slug).toBe("1.05px");
        await expect(el).toHaveAttribute("data-shown", "");
        await expect
          .poll(() => el.evaluate((node) => [...node.querySelectorAll("[pathLength]")].every((p) => getComputedStyle(p).strokeDashoffset === "0px")), { timeout: 6000, message: slug })
          .toBe(true);
      }
      // No script-driven sequence, and nothing keeps moving once drawn (the reveal transitions end).
      expect(await el.evaluate((node) => node.getAnimations({ subtree: true }).filter((a) => a.constructor === Animation).length), slug).toBe(0);
      await expect.poll(() => el.evaluate((node) => node.getAnimations({ subtree: true }).length), { timeout: 6000, message: slug }).toBe(0);
    }
  });

  test("the homepage's signatures are untouched: still on the cards' own stages, no service-page styles", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await expect(page.locator("#services .a2-stage-sig .sig-cut")).toHaveCount(1);
      await expect(page.locator("#services .a2-stage-sig .sig-engrave")).toHaveCount(1);
      expect(await page.evaluate(() => document.querySelectorAll('[class*="sv-"]').length)).toBe(0);
      // Each signature is as large as its stage allows (the homepage's own container rule).
      const fits = await page.locator("#services .a2-stage-sig").evaluateAll((stages) =>
        stages.map((stage) => {
          const cs = getComputedStyle(stage);
          const w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          const h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          const sig = stage.querySelector<HTMLElement>(".sig")!;
          const ratio = parseFloat(getComputedStyle(sig).getPropertyValue("--sig-ratio"));
          return Math.abs(sig.getBoundingClientRect().width - Math.min(w, h * ratio));
        }),
      );
      for (const off of fits) expect(off).toBeLessThan(1.5);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Reduced motion and no JavaScript
// ---------------------------------------------------------------------------------------------------------------------

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("nothing in view stays hidden; drawings and signatures are finished, with no animation running", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(`/en/${path}`, { waitUntil: "networkidle" });
      await expect.poll(() => hiddenReveals(page), { message: path, timeout: 3_000 }).toBe(0);
      const state = await page.evaluate(() => ({
        undrawn: [...document.querySelectorAll(".sv-draw [pathLength]")].filter((p) => !["0px", "0"].includes(getComputedStyle(p).strokeDashoffset)).length,
        axes: [...document.querySelectorAll(".sv-axis")].filter((a) => getComputedStyle(a).transform !== "none").length,
        running: document.getAnimations().filter((a) => a.constructor === Animation).length,
      }));
      expect(state, path).toEqual({ undrawn: 0, axes: 0, running: 0 });
    }
    // The signatures show their finished pictures at once.
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    await expectFinished(page, ["cut"]);
    await page.goto("/ar/services/laser-engraving", { waitUntil: "networkidle" });
    await expectFinished(page, ["engrave"]);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the overview and the six pages render everything: content visible, drawings and signatures finished", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(`/en/${path}`, { waitUntil: "load" });
      await expect(page.locator("h1"), path).toHaveCount(1);
      const state = await page.evaluate(() => ({
        hidden: [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length,
        undrawn: [...document.querySelectorAll(".sv-draw [pathLength]")].filter((p) => !["0px", "0"].includes(getComputedStyle(p).strokeDashoffset)).length,
        axes: [...document.querySelectorAll(".sv-axis")].filter((a) => getComputedStyle(a).transform !== "none").length,
      }));
      expect(state, path).toEqual({ hidden: 0, undrawn: 0, axes: 0 });
      if (path !== "services") await expect(page.locator("#process li").first()).toBeVisible();
    }
    // The finished signatures (the markup is the finished picture).
    await page.goto("/en/services/laser-cutting", { waitUntil: "load" });
    expect(await page.locator(".sig-cut .sig-head").getAttribute("style")).toContain("translate(176");
    // The index is open without script, its toggle hidden.
    await page.goto("/en/services", { waitUntil: "load" });
    await expect(page.locator('main nav[aria-label="Service index"] ol a')).toHaveCount(6);
    await expect(page.locator('main nav[aria-label="Service index"] ol a').first()).toBeVisible();
    await expect(page.locator("main .ip-toc-toggle")).toBeHidden();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------------------------------------

test.describe("layout", () => {
  test("RTL mirrors the hero and the process; photos and the cutting sheet are never mirrored", async ({ page }) => {
    await page.goto("/ar/services/laser-cutting", { waitUntil: "networkidle" });
    const h1 = (await page.locator("h1").boundingBox())!;
    const visual = (await page.locator(`${HERO} figure`).first().boundingBox())!;
    expect(h1.x).toBeGreaterThan(visual.x);
    // The first process station sits at the right in Arabic.
    const stations = page.locator("#process ol > li");
    const first = (await stations.first().boundingBox())!;
    const last = (await stations.last().boundingBox())!;
    expect(first.x).toBeGreaterThan(last.x);
    expect(await page.locator(`${HERO} img`).first().evaluate((el) => [getComputedStyle(el).transform, getComputedStyle(el).scale])).toEqual(["none", "none"]);
    expect(await page.locator(".sig-cut svg").evaluate((el) => getComputedStyle(el).scale)).toBe("none");
    // The structural axes keep their letters left to right.
    await page.goto("/ar/services/steel-structures", { waitUntil: "networkidle" });
    const bubbles = await page.locator(".sv-bubble").evaluateAll((els) => els.slice(0, 4).map((el) => [el.textContent, el.getBoundingClientRect().x]));
    expect(bubbles.map((b) => b[0])).toEqual(["A", "B", "C", "D"]);
    expect((bubbles[0][1] as number) < (bubbles[3][1] as number)).toBe(true);
  });

  test("dark theme applies to the service pages", async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
    for (const path of ["/en/services/steel-structures", "/ar/services"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(19, 24, 32)");
    }
  });

  for (const width of [320, 360, 390, 834]) {
    test(`no sideways scrolling at ${width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 900 });
      const overflowing: string[] = [];
      for (const locale of LOCALES) {
        for (const path of PAGES) {
          await page.goto(`/${locale}/${path}`, { waitUntil: "networkidle" });
          if ((await horizontalOverflow(page)) > 0) overflowing.push(`${locale}/${path}`);
        }
      }
      expect(overflowing).toEqual([]);
    });
  }

  test("nothing spills out of its card or is cut off by it, at 1440, 1024 and 320", async ({ browser }) => {
    test.setTimeout(240_000);
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [320, 700],
    ] as const) {
      const [page, context] = await newPage(browser, { viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800, reducedMotion: "reduce" });
      for (const path of [...PAGES.map((p) => `/en/${p}`), "/ar/services", "/ar/services/fabrication", "/ar/services/scaffolding"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await revealAll(page);
        await page.evaluate(async () => {
          await Promise.all([...document.images].map((img) => ((img.loading = "eager"), img.decode().catch(() => {}))));
        });
        const escaping = await page.locator("main").evaluate((main) => {
          const found: string[] = [];
          const draws = (s: CSSStyleDeclaration) =>
            (s.borderTopStyle !== "none" && parseFloat(s.borderTopWidth) > 0) || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor) || s.boxShadow !== "none";
          for (const box of main.querySelectorAll<HTMLElement>("*")) {
            if (!box.checkVisibility()) continue;
            const bs = getComputedStyle(box);
            if (!draws(bs) || /auto|scroll/.test(bs.overflowX + bs.overflowY)) continue;
            const b = box.getBoundingClientRect();
            if (b.width < 4 || b.height < 4) continue;
            for (const el of box.querySelectorAll<HTMLElement>("img, h2, h3, p, span, a, dt, dd, li, figcaption")) {
              if (!el.checkVisibility() || el.closest(".sr-only") || /absolute|fixed/.test(getComputedStyle(el).position)) continue;
              if (el.tagName !== "IMG" && (el.closest("[aria-hidden='true']") || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))) continue;
              const r = el.getBoundingClientRect();
              if (r.width < 1 || r.height < 1) continue;
              if (Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom) > 1.5)
                found.push(`${el.tagName.toLowerCase()} «${(el.getAttribute("alt") || el.textContent || "").trim().slice(0, 24)}» in ${box.className}`);
            }
          }
          return found;
        });
        expect(escaping, `${path} at ${width}`).toEqual([]);
      }
      await context.close();
    }
  });

  test("the work anchors land below the header, on desktop and phones, from the address and from the hero's action", async ({ browser }) => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      const [page, context] = await newPage(browser, { viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 });
      // The section settles below the sticky header (the browser keeps the target in place while fonts and photos
      // load), with its heading in view.
      const landing = async (id: string) => {
        await page.evaluate(() => document.fonts.ready);
        await expect
          .poll(
            () =>
              page.evaluate((id) => {
                const top = document.getElementById(id)!.getBoundingClientRect().top;
                const header = document.querySelector(".a2-header")!.getBoundingClientRect().bottom;
                return top >= header - 0.5 && top < 140 ? "below the header" : `top ${top}, header ${header}, scrollY ${scrollY}`;
              }, id),
            { timeout: 6000, message: `#${id} at ${width}` },
          )
          .toBe("below the header");
        await expect(page.locator(`#${id}-title`)).toBeInViewport();
      };
      for (const [path, id] of [
        ["/en/services/laser-cutting#gallery", "gallery"],
        ["/ar/services/fabrication#projects", "projects"],
        ["/en/services/scaffolding#gallery", "gallery"],
      ] as const) {
        // With the page's fonts in the cache (a returning visitor). Cold loads with late fonts, which a gliding first jump
        // left short of its target before TM-2.5's shared fix, are tested in commerce-anchors.spec.ts.
        await page.goto(path.split("#")[0], { waitUntil: "networkidle" });
        await page.goto("about:blank");
        await page.goto(path, { waitUntil: "networkidle" });
        await landing(id);
      }
      // From the hero's "see the work" action.
      await page.goto("/en/services/steel-structures", { waitUntil: "networkidle" });
      await page.locator(`${HERO} a[href="#gallery"]`).click();
      await page.waitForURL(/#gallery$/);
      await landing("gallery");
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Keyboard and pointer
// ---------------------------------------------------------------------------------------------------------------------

test.describe("keyboard", () => {
  test("the quote action is reachable and shows focus", async ({ page }) => {
    await page.goto("/en/services/fabrication", { waitUntil: "networkidle" });
    const quote = page.locator(`${HERO} a[href="/en/contact#quote"]`);
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await quote.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    const outline = await quote.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("related service cards are links that can be focused and followed", async ({ page }) => {
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    const card = page.locator('#related a[href="/en/services/cnc-bending"]');
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/en/services/cnc-bending");
    await expect(page.locator("h1")).toHaveText(NAMES["cnc-bending"].en);
  });

  test("the quote link lands on the request form", async ({ page }) => {
    await page.goto("/ar/services/scaffolding", { waitUntil: "networkidle" });
    await page.locator('main a[href="/ar/contact#quote"]').first().click();
    await page.waitForURL("**/ar/contact#quote");
    await expect(page.locator("#quote")).toBeInViewport();
  });
});

test.describe("pointer", () => {
  test("the custom pointer follows a desktop mouse over the pages (the previous design's pointer light is retired)", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "networkidle" });
    await expect(page.locator(".plight")).toHaveCount(0);
    await page.mouse.move(300, 300);
    await page.mouse.move(420, 360, { steps: 5 });
    await expect(page.locator("html")).toHaveAttribute("data-cursor-on", "");
  });

  test("never on touch screens or with reduced motion", async ({ browser }) => {
    for (const options of [{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { reducedMotion: "reduce" as const }]) {
      const [page, context] = await newPage(browser, options);
      await page.goto("/en/services/scaffolding", { waitUntil: "networkidle" });
      if (options.reducedMotion) {
        await page.mouse.move(300, 300);
        await page.mouse.move(420, 360, { steps: 5 });
      } else await page.locator("h1").tap();
      await page.waitForTimeout(300);
      await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
      await context.close();
    }
  });
});
