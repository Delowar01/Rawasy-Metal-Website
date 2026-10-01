import { expect, test } from "@playwright/test";
import { HTML_LANG, hiddenReveals, horizontalOverflow, INNER_PAGES, jsonLd, LOCALES, skipIntro, trackErrors } from "./helpers";

/** Stage 1C inner pages: routes, SEO, breadcrumbs, page features, forms and layout (legal pages and 404: commerce-inner.spec.ts). */

const BREADCRUMB = { en: "Breadcrumb", ar: "مسار التنقل" } as const;

test.beforeEach(async ({ context }) => {
  await skipIntro(context);
});

test.describe("routes, language and SEO", () => {
  for (const locale of LOCALES) {
    for (const route of INNER_PAGES) {
      test(`/${locale}/${route}`, async ({ page }) => {
        const errors = trackErrors(page);
        const response = await page.goto(`/${locale}/${route}`, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);

        const html = page.locator("html");
        await expect(html).toHaveAttribute("lang", HTML_LANG[locale]);
        await expect(html).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(page.locator("h1")).toHaveCount(1);
        expect((await page.locator("h1").innerText()).trim().length).toBeGreaterThan(3);

        // Visible breadcrumb: Home → page.
        const crumbs = page.getByRole("navigation", { name: BREADCRUMB[locale] }).locator("li");
        await expect(crumbs).toHaveCount(2);
        await expect(crumbs.first().locator("a")).toHaveAttribute("href", `/${locale}`);
        await expect(crumbs.last().locator('[aria-current="page"]')).toHaveCount(1);

        // Structured data: a WebPage node and a matching BreadcrumbList.
        const data = await jsonLd(page);
        const trail = data.find((d) => d["@type"] === "BreadcrumbList");
        expect(trail?.itemListElement).toHaveLength(2);
        expect(trail.itemListElement[1].item).toMatch(new RegExp(`/${locale}/${route}$`));
        expect(data.some((d) => ["WebPage", "AboutPage", "CollectionPage", "ContactPage"].includes(d["@type"]))).toBe(true);

        // Canonical, hreflang, social tags and the review gate (noindex until approved).
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/${route}$`));
        for (const lang of ["en", "ar", "x-default"]) {
          await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
        }
        await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

        expect(await horizontalOverflow(page)).toBe(0);
        expect(errors).toEqual([]);
      });
    }
  }

  test("the sitemap lists published pages only", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toMatch(/\/en<\/loc>/);
    expect(xml).toMatch(/\/ar<\/loc>/);
    for (const route of INNER_PAGES) expect(xml).not.toContain(`/${route}</loc>`);
  });
});

test.describe("no sideways scrolling", () => {
  for (const width of [360, 390, 834]) {
    test(`all inner pages at ${width}px`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      const errors = trackErrors(page);
      const overflowing: string[] = [];
      for (const locale of LOCALES) {
        for (const route of INNER_PAGES) {
          await page.goto(`/${locale}/${route}`, { waitUntil: "networkidle" });
          const overflow = await horizontalOverflow(page);
          if (overflow > 0) overflowing.push(`/${locale}/${route} (+${overflow}px)`);
        }
      }
      expect(overflowing).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});

// The pages still in the previous design: the services overview stands in since Certificates moved (TM-2.3).
test("dark theme applies to inner pages and toggles back", async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
  await page.goto("/en/services", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.click('header button[aria-label*="light" i]');
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

// Clients, Certificates, Industries and About moved to the Modern Commerce design in Stage TM-2.3: the clients wall (21
// logos, six across, two on phones, every row full), the certificate register and dialog (keyboard, focus return, Arabic
// first, redaction) and the industries preview (keyboard focus) are tested in commerce-company.spec.ts and
// commerce-certificates.spec.ts. The generic checks in this file still run on them through INNER_PAGES.

// The contact page moved to the Modern Commerce design in Stage TM-2.2: its form, file, hand-off, direct-contact and
// no-JavaScript tests are in commerce-contact.spec.ts (with explicit golden outputs). The generic checks here still cover it.

// The legal pages and the localized 404 moved to the Modern Commerce design in Stage TM-2.1: their tests (contents,
// sections, pending notes, contact details, the contents disclosure on phones, the localized 404) are in
// commerce-inner.spec.ts. The checks above and below still run on them through INNER_PAGES.

test.describe("keyboard", () => {
  test("skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    const skip = page.locator('a[href="#main"]');
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("services index jumps to a service", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "networkidle" });
    const link = page.locator('nav a[href="#cnc-bending"]').last();
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(link).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(/#cnc-bending$/);
    await expect(page.locator("article#cnc-bending")).toBeInViewport();
  });

  // "industries preview follows keyboard focus" moved to commerce-company.spec.ts with the industries page (Stage TM-2.3).
});

test.describe("reduced motion on inner pages", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("nothing in view stays hidden", async ({ page }) => {
    for (const route of INNER_PAGES) {
      await page.goto(`/ar/${route}`, { waitUntil: "networkidle" });
      await expect.poll(() => hiddenReveals(page), { message: route, timeout: 3_000 }).toBe(0);
    }
  });
});

test.describe("inner pages without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("all content is rendered and visible", async ({ page }) => {
    for (const route of INNER_PAGES) {
      await page.goto(`/en/${route}`, { waitUntil: "load" });
      await expect(page.locator("h1")).toHaveCount(1);
      const hidden = await page.evaluate(
        () => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length,
      );
      expect(hidden, route).toBe(0);
    }
  });
});
