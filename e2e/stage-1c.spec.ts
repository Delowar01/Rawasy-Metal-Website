import { expect, test, type Page } from "@playwright/test";
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

test("dark theme applies to inner pages and toggles back", async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
  await page.goto("/en/certificates", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.click('header button[aria-label*="light" i]');
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test.describe("clients", () => {
  test("21 logos with names on one wall, six across on desktop, every row full", async ({ page }) => {
    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const cells = page.locator("ul.logo-wall > li");
    await expect(cells).toHaveCount(21);
    const alts = await cells.locator("img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt") ?? ""));
    expect(alts.every((alt) => alt.trim().length > 1)).toBe(true);
    const columns = await page.locator("ul.logo-wall").evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(6);
    expect(await lastRowGap(page)).toBe(0);
  });

  test("two across on phones, every row full", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/clients", { waitUntil: "networkidle" });
    const columns = await page.locator("ul.logo-wall").evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(2);
    expect(await lastRowGap(page)).toBe(0);
  });
});

/** Empty width at the end of the wall's last row, in px (0 when every row is full). */
function lastRowGap(page: Page) {
  return page.locator("ul.logo-wall").evaluate((ul) => {
    const cells = [...ul.children].map((li) => li.getBoundingClientRect());
    const bottom = Math.max(...cells.map((r) => r.bottom));
    const lastRow = cells.filter((r) => Math.abs(r.bottom - bottom) < 2);
    const box = ul.getBoundingClientRect();
    const used = lastRow.reduce((sum, r) => sum + r.width, 0) + (lastRow.length - 1);
    return Math.max(0, Math.round(box.width - 2 - used));
  });
}

test.describe("certificates", () => {
  test("register, keyboard dialog, focus return and redaction", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    for (const id of ["commercial-registration", "vat-registration", "commercial-activity-licence"]) {
      await expect(page.locator(`main li#${id}`)).toHaveCount(1);
    }

    const trigger = page.locator('#vat-registration a[aria-haspopup="dialog"]').last();
    await expect(trigger).toHaveAttribute("href", /\/media\/certificates\/.+\.webp$/);
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((d) => d.matches(":modal"))).toBe(true);
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    await expect(dialog.locator("img")).toHaveCount(1);
    await expect(dialog).toContainText(/redacted/i);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // Nothing sensitive or unverified in the page text.
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\bISO\b/);
    expect(text).not.toMatch(/expir/i);
    expect(text).not.toMatch(/1447/);
    expect(errors).toEqual([]);
  });

  test("Arabic shows the Arabic version of a bilingual document first", async ({ page }) => {
    await page.goto("/ar/certificates", { waitUntil: "networkidle" });
    await page.locator('#commercial-registration a[aria-haspopup="dialog"]').first().click();
    const figures = page.locator("dialog[open] figure");
    await expect(figures).toHaveCount(2);
    await expect(figures.first().locator("figcaption")).toHaveText("النسخة العربية");
    await expect(figures.first().locator("img")).toHaveAttribute("src", /commercial-registration-ar/);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/انتهاء/);
    await page.locator("dialog[open]").getByRole("button", { name: "إغلاق" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });
});

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

  test("industries preview follows keyboard focus", async ({ page }) => {
    await page.goto("/en/industries", { waitUntil: "networkidle" });
    const items = page.locator("#sectors ol > li");
    const third = items.nth(2);
    const name = (await third.locator("h3").innerText()).trim();
    await third.locator("a").first().focus();
    await expect(page.locator("#sectors figure figcaption")).toContainText(name);
  });
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
