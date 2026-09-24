import { expect, test, type Page } from "@playwright/test";
import { HTML_LANG, hiddenReveals, horizontalOverflow, INNER_PAGES, jsonLd, LOCALES, skipIntro, trackErrors } from "./helpers";

/** Stage 1C inner pages: routes, SEO, breadcrumbs, page features, forms, legal pages, 404 and layout. */

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
  test("21 logos with names, seven across on desktop", async ({ page }) => {
    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const cells = page.locator("ul.client-grid > li");
    await expect(cells).toHaveCount(21);
    const alts = await cells.locator("img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt") ?? ""));
    expect(alts.every((alt) => alt.trim().length > 1)).toBe(true);
    const columns = await page.locator("ul.client-grid").evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(7);
  });

  test("three across on phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/clients", { waitUntil: "networkidle" });
    const columns = await page.locator("ul.client-grid").evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(3);
  });
});

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

async function fillValidQuote(page: Page, locale: "en" | "ar") {
  await page.fill("#quote-fullName", locale === "ar" ? "أحمد علي" : "Test Person");
  await page.fill("#quote-email", "test@example.com");
  // Arabic-Indic digits are accepted in the phone number.
  await page.fill("#quote-phone", locale === "ar" ? "٠٥٠١٢٣٤٥٦٧" : "+966 50 123 4567");
  await page.selectOption("#quote-service", "laser-cutting");
  await page.fill(
    "#quote-message",
    locale === "ar" ? "نحتاج قص ألواح حديد بالليزر حسب المخطط المرفق." : "We need laser-cut steel plates as per the attached drawing.",
  );
}

test.describe("contact and quote form", () => {
  test("validation, error summary and field errors", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    await expect(page.locator("form")).toHaveJSProperty("noValidate", true);
    await page.getByRole("button", { name: "Prepare request" }).click();

    const summary = page.locator('[role="alert"]');
    await expect(summary.locator("li")).toHaveCount(5);
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.querySelector('[role="alert"]')))
      .toBe(true);
    for (const name of ["fullName", "email", "phone", "service", "message"]) {
      await expect(page.locator(`#quote-${name}`)).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator(`#quote-${name}`)).toHaveAttribute("aria-describedby", new RegExp(`quote-${name}-error`));
    }
    await expect(page.locator("#quote-company")).not.toHaveAttribute("aria-invalid", "true");

    // Error links move focus to their field.
    await summary.locator("a").nth(1).click();
    await expect(page.locator("#quote-email")).toBeFocused();

    // Specific messages for malformed values; errors clear once fixed.
    await page.fill("#quote-email", "name@");
    await page.fill("#quote-phone", "12");
    await expect(page.locator("#quote-email-error")).toContainText("valid email");
    await expect(page.locator("#quote-phone-error")).toContainText("8 to 15 digits");
    await page.fill("#quote-email", "name@company.com");
    await expect(page.locator("#quote-email-error")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("file rules: type, size and removal", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    await page.setInputFiles("#quote-files", [
      { name: "drawing.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(2048) },
      { name: "setup.exe", mimeType: "application/octet-stream", buffer: Buffer.alloc(16) },
      { name: "large.dwg", mimeType: "application/octet-stream", buffer: Buffer.alloc(11 * 1024 * 1024) },
    ]);
    const list = page.locator(".dropzone ~ ul li");
    await expect(list).toHaveCount(1);
    await expect(list.first()).toContainText("drawing.pdf");
    await expect(page.getByText("isn't a supported file type")).toBeVisible();
    await expect(page.getByText("is larger than 10 MB")).toBeVisible();
    await list.first().getByRole("button", { name: /Remove/ }).click();
    await expect(list).toHaveCount(0);
  });

  for (const locale of LOCALES) {
    test(`prepared request hands off to email and WhatsApp without claiming delivery (${locale})`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      await fillValidQuote(page, locale);
      await page.setInputFiles("#quote-files", [{ name: "drawing.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(2048) }]);
      await page.locator('form button[type="submit"]').click();

      const heading = page.locator("h3[tabindex='-1']");
      await expect(heading).toBeFocused();
      await expect(heading).toHaveText(locale === "ar" ? "طلبك جاهز للإرسال" : "Your request is ready to send");

      const mailto = page.locator('a[href^="mailto:rawasymetal@gmail.com?subject="]');
      await expect(mailto).toHaveCount(1);
      const mailHref = decodeURIComponent((await mailto.getAttribute("href")) ?? "");
      expect(mailHref).toContain(locale === "ar" ? "طلب عرض سعر" : "Quote request");
      expect(mailHref).toContain("drawing.pdf");

      const whatsapp = page.locator('a[href^="https://wa.me/966537368310?text="]');
      await expect(whatsapp).toHaveAttribute("target", "_blank");
      await expect(page.locator("#quote-request")).toHaveValue(/test@example\.com/);

      // The page never says the request was sent.
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/sent successfully|has been sent|thank you for your request|تم إرسال|أُرسل طلبك/i);

      // Editing keeps what was entered.
      await page.getByRole("button", { name: locale === "ar" ? "تعديل الطلب" : "Edit request" }).click();
      await expect(page.locator("#quote-fullName")).toBeFocused();
      await expect(page.locator("#quote-fullName")).toHaveValue(locale === "ar" ? "أحمد علي" : "Test Person");
      expect(errors).toEqual([]);
    });
  }

  test("direct contact links", async ({ page }) => {
    await page.goto("/ar/contact", { waitUntil: "networkidle" });
    const sheet = page.locator("main address").first();
    await expect(sheet.locator('a[href="tel:+966537368310"]')).toHaveCount(1);
    await expect(sheet.locator('a[href="tel:+966552616189"]')).toHaveCount(1);
    await expect(sheet.locator('a[href="mailto:rawasymetal@gmail.com"]')).toHaveCount(1);
    await expect(sheet.locator('a[href^="https://wa.me/966537368310"]')).toHaveAttribute("rel", /noopener/);
  });
});

test.describe("contact without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the form falls back to the visitor's email app", async ({ page, request }) => {
    await page.goto("/en/contact", { waitUntil: "load" });
    const form = page.locator("form");
    await expect(form).toHaveAttribute("action", /^mailto:rawasymetal@gmail\.com/);
    await expect(form).toHaveAttribute("method", "post");
    await expect(page.locator("#quote-files")).toBeHidden();
    await expect(page.locator("#quote-fullName")).toHaveAttribute("required", "");
    // Playwright's no-JS mode still parses <noscript> as text, so check the server HTML for the note.
    const html = await (await request.get("/en/contact")).text();
    expect(html).toMatch(/<noscript><p[^>]*>JavaScript is off/);
  });
});

test.describe("legal pages", () => {
  for (const route of ["privacy", "terms"] as const) {
    test(`${route}: contents, sections, pending notes and contact`, async ({ page }) => {
      await page.goto(`/en/${route}`, { waitUntil: "networkidle" });
      const sections = page.locator("main section[id]");
      const toc = page.getByRole("navigation", { name: "On this page" }).locator("div.sticky a");
      const count = await sections.count();
      expect(count).toBeGreaterThan(5);
      await expect(toc).toHaveCount(count);
      for (const href of await toc.evaluateAll((links) => links.map((a) => a.getAttribute("href")))) {
        await expect(page.locator(href!)).toHaveCount(1);
      }
      expect(await page.getByText("Pending confirmation").count()).toBeGreaterThan(0);
      await expect(page.locator('main time[datetime="2026-09-24"]')).toHaveCount(1);
      await expect(page.locator('main address a[href="mailto:rawasymetal@gmail.com"]')).toHaveCount(1);
    });
  }

  test("the table of contents is a disclosure on phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/privacy", { waitUntil: "networkidle" });
    const details = page.locator("main details");
    await expect(details.locator("a").first()).toBeHidden();
    await details.locator("summary").click();
    await expect(details.locator("a").first()).toBeVisible();
  });
});

test.describe("localized 404", () => {
  for (const [locale, title] of [
    ["en", "Outside the blueprint"],
    ["ar", "خارج المخطط"],
  ] as const) {
    test(`${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}/no-such-page`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(404);
      await expect(page.locator("h1")).toHaveText(title);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    });
  }
});

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
