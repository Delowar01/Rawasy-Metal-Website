import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { legalChrome, legalDocuments } from "../src/content/legal";
import { getDictionary } from "../src/i18n/dictionaries";
import { HTML_LANG, horizontalOverflow, LOCALES, trackErrors } from "./helpers";

/**
 * Stage TM-2.1: the inner-page kit of the Modern Commerce design, the privacy policy and the website terms in it, and
 * the localized 404 with its catch-all (src/app/(commerce)/[locale]/). An unknown service slug has had this design's 404
 * since its route moved (TM-2.4: commerce-services.spec.ts), an unknown project slug since TM-2.6
 * (commerce-project-detail.spec.ts since Stage 1F). The generic inner-page checks (routes and search metadata, breadcrumbs, sideways
 * scrolling, reduced motion and no JavaScript) stay in stage-1c.spec.ts and run on these pages too.
 */

const LEGAL = ["privacy", "terms"] as const;
const CONTENTS = { en: legalChrome.onThisPage.en, ar: legalChrome.onThisPage.ar } as const;
const NOT_FOUND = { en: "Outside the blueprint", ar: "خارج المخطط" } as const;
const TITLE_404 = { en: "Page not found | RAWASY", ar: "الصفحة غير موجودة | رواسي" } as const;

const squash = (text: string) => text.replace(/\s+/g, " ").trim();
/** Whether a rule with this selector is in the page's stylesheets (`.btn-face` exists only in the previous design's). */
const stylesheetHas = (page: Page, selector: string) =>
  page.evaluate(
    (sel) =>
      [...document.styleSheets].some((s) => {
        try {
          return [...s.cssRules].some((rule) => rule.cssText.includes(sel));
        } catch {
          return false;
        }
      }),
    selector,
  );
const contents = (page: Page, locale: (typeof LOCALES)[number]) => page.getByRole("navigation", { name: CONTENTS[locale] });
/** The language group inside the open phone menu sheet. */
const sheetLanguages = (page: Page, locale: (typeof LOCALES)[number]) =>
  page.locator("details[data-sheet] .a2-sheet").getByRole("navigation", { name: getDictionary(locale).controls.language });
/** A language group as elements, classes, attributes and text, with the addresses set aside (they differ by page). */
const languageGroup = (nav: Locator) =>
  nav.evaluate((el) => ({
    nav: [el.tagName, el.className, el.getAttribute("aria-label")],
    links: [...el.children].map((a) => ({
      tag: a.tagName,
      text: a.textContent,
      attributes: [...a.attributes].filter((x) => x.name !== "href").map((x) => `${x.name}=${x.value}`).sort(),
    })),
  }));

test.describe("legal pages", () => {
  for (const locale of LOCALES) {
    for (const slug of LEGAL) {
      test(`${slug} (${locale}): every section, anchor, pending note, date and contact detail of the content, unchanged`, async ({ page }) => {
        const errors = trackErrors(page);
        const doc = legalDocuments[slug];
        const response = await page.goto(`/${locale}/${slug}`, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);
        // The Modern Commerce design: its body class, its header and footer, none of the previous design's shell.
        await expect(page.locator("body.mc")).toHaveCount(1);
        await expect(page.locator(".a2-header")).toHaveCount(1);
        await expect(page.locator("footer.a2-footer")).toHaveCount(1);
        expect(await stylesheetHas(page, ".btn-face")).toBe(false);

        // The hero: one h1, the label, the lead and the page facts (the last-updated date as a machine-readable time).
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveText(doc.hero.title[locale]);
        await expect(page.locator("main")).toContainText(doc.hero.intro[locale]);
        await expect(page.locator(`main time[datetime="${doc.updated}"]`)).toHaveCount(1);
        await expect(page.locator("main .ip-meta")).toContainText(legalChrome.appliesToValue[locale]);

        // Every section in order, with its anchor, its h2 and every paragraph and list item of the content.
        const sections = page.locator("main section[id]");
        await expect(sections).toHaveCount(doc.sections.length);
        expect(await sections.evaluateAll((els) => els.map((el) => el.id))).toEqual(doc.sections.map((s) => s.id));
        for (const [i, section] of doc.sections.entries()) {
          const el = sections.nth(i);
          await expect(el.locator("h2")).toHaveText(section.title[locale]);
          const text = squash(await el.innerText());
          for (const block of section.body[locale]) {
            for (const line of typeof block === "string" ? [block] : block.list) expect(text, `${section.id}`).toContain(squash(line));
          }
          // Its pending note, named by its label (not by colour alone), or none.
          const note = el.locator('[role="note"]');
          if (section.pending) {
            await expect(note).toHaveCount(1);
            await expect(note).toContainText(legalChrome.pending[locale]);
            expect(squash(await note.innerText())).toContain(squash(section.pending[locale]));
          } else {
            await expect(note).toHaveCount(0);
          }
        }
        // The h2s follow the h1: no level is skipped.
        expect(await page.locator("main :is(h1, h2, h3)").evaluateAll((els) => els.map((e) => e.tagName))).toEqual([
          "H1",
          ...doc.sections.map(() => "H2"),
        ]);

        // The contents list one link per section, each to an anchor on the page.
        const links = contents(page, locale).locator("ol a");
        await expect(links).toHaveCount(doc.sections.length);
        expect(await links.evaluateAll((els) => els.map((a) => a.getAttribute("href")))).toEqual(doc.sections.map((s) => `#${s.id}`));

        // The company's contact details where the content asks for them: email and both phones, left to right.
        const address = page.locator("main address");
        await expect(address).toHaveCount(doc.sections.filter((s) => s.contact).length);
        if (doc.sections.some((s) => s.contact)) {
          await expect(address.locator('a[href="mailto:rawasymetal@gmail.com"]')).toHaveAttribute("dir", "ltr");
          await expect(address.locator('a[href^="tel:"]')).toHaveCount(2);
        }
        expect(await horizontalOverflow(page)).toBe(0);
        expect(errors).toEqual([]);
      });
    }
  }

  test("the shell: no header page is marked, the footer marks the page, the language switch opens the same page", async ({ page }) => {
    for (const locale of LOCALES) {
      for (const slug of LEGAL) {
        await page.goto(`/${locale}/${slug}`, { waitUntil: "networkidle" });
        await expect(page.locator(".a2-header [aria-current='page']")).toHaveCount(0);
        await expect(page.locator(`footer a[href="/${locale}/${slug}"]`)).toHaveAttribute("aria-current", "page");
        await expect(page.locator("footer a[aria-current]")).toHaveCount(1);
        const other = locale === "en" ? "ar" : "en";
        await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[other]}"]`).first()).toHaveAttribute("href", `/${other}/${slug}`);
      }
    }
    // A real switch: Arabic, right to left, the same page; the choice is remembered.
    await page.goto("/en/terms", { waitUntil: "networkidle" });
    await page.locator('.a2-header .a2-lang a[hreflang="ar-SA"]').first().click();
    await page.waitForURL("**/ar/terms");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveText(legalDocuments.terms.hero.title.ar);
    expect((await page.context().cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe("ar");
  });

  test("the contents mark the section being read, and a chosen entry at once", async ({ page }) => {
    await page.goto("/en/privacy", { waitUntil: "networkidle" });
    const nav = contents(page, "en");
    // Pinned beside the text: the toggle is for small screens only.
    await expect(nav.locator("button")).toBeHidden();
    const links = nav.locator("ol a");
    await expect(links.first()).toHaveAttribute("aria-current", "true");
    const third = links.nth(2);
    await third.click();
    await expect(third).toHaveAttribute("aria-current", "true");
    await expect(nav.locator('a[aria-current="true"]')).toHaveCount(1);
    await expect(page).toHaveURL(/#quote-form$/);
    // The chosen entry's section is reached with a glide (smooth once the page has loaded): wait until it has landed
    // below the header before scrolling on, or the glide can carry the page past the jump below under load (the Stage
    // 1F full run ended on the chosen section once).
    await page.waitForFunction(() => {
      const top = document.getElementById("quote-form")!.getBoundingClientRect().top;
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      return Math.abs(top - pad) < 2 || window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1;
    });
    // Scrolling on marks the section being read …
    await page.locator("#information").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await expect(nav.locator('a[href="#information"]')).toHaveAttribute("aria-current", "true");
    // … the contents stay in view below the header while the text scrolls …
    const box = await nav.boundingBox();
    const header = await page.locator(".a2-header").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    // … and back above the first section, the first entry is marked again.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(links.first()).toHaveAttribute("aria-current", "true");
  });

  test("anchor jumps land every heading below the sticky header, in both languages, on desktop and phone", async ({ browser }) => {
    test.setTimeout(120_000);
    // Instant jumps (the page scrolls smoothly otherwise); the landing is the same.
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const locale of LOCALES) {
        for (const slug of LEGAL) {
          await page.goto(`/${locale}/${slug}`, { waitUntil: "networkidle" });
          for (const { id } of legalDocuments[slug].sections) {
            await page.evaluate((hash) => (location.hash = hash), id);
            await page.waitForFunction((target) => {
              const top = document.getElementById(target)!.getBoundingClientRect().top;
              return Math.abs(top - 88) < 2 || window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1;
            }, id);
            const [heading, header] = await Promise.all([
              page.locator(`#${id}-title`).boundingBox(),
              page.locator(".a2-header").boundingBox(),
            ]);
            expect(heading!.y, `${locale}/${slug}#${id} at ${width}px`).toBeGreaterThanOrEqual(header!.y + header!.height);
            expect(heading!.y + heading!.height, `${locale}/${slug}#${id} at ${width}px`).toBeLessThan(height);
          }
        }
      }
    }
    await context.close();
  });

  test("decoration is hidden from assistive technology", async ({ page }) => {
    for (const path of ["/ar/privacy", "/en/terms", "/en/no-such-page", "/ar/no-such-page"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const exposed = await page.evaluate(() =>
        [...document.querySelectorAll(".a2-ambient, .a2-cursor, svg.mc-icon, .ip-404-code, .ip-toc-title")]
          .filter((el) => !el.closest('[aria-hidden="true"]'))
          .map((el) => el.className.toString()),
      );
      expect(exposed, path).toEqual([]);
    }
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the contents are a disclosure above the text: a button with aria-expanded, by touch and keyboard", async ({ page }) => {
      await page.goto("/ar/privacy", { waitUntil: "networkidle" });
      const nav = contents(page, "ar");
      const toggle = nav.locator("button");
      const first = nav.locator("ol a").first();
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toHaveText(CONTENTS.ar);
      await expect(first).toBeHidden();
      await toggle.tap();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(first).toBeVisible();
      // It sits in the flow (never over the text) and the list belongs to the button.
      expect(["static", "relative"]).toContain(await nav.evaluate((el) => getComputedStyle(el).position));
      const list = await toggle.getAttribute("aria-controls");
      await expect(nav.locator(`[id="${list}"]`)).toHaveCount(1);
      // By keyboard: Enter closes and opens it again; an entry jumps to its section.
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await page.keyboard.press("Space");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Tab");
      await expect(first).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#who-we-are$/);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the contents are open (no toggle), and every section is there", async ({ page }) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const slug of LEGAL) {
          await page.goto(`/en/${slug}`, { waitUntil: "load" });
          const nav = contents(page, "en");
          await expect(nav.locator("button")).toBeHidden();
          await expect(nav.locator("ol a").first()).toBeVisible();
          await expect(page.locator("main section[id]")).toHaveCount(legalDocuments[slug].sections.length);
        }
      }
    });
  });
});

test.describe("localized 404", () => {
  const status = async (request: APIRequestContext, path: string, headers: Record<string, string> = {}) => {
    const response = await request.get(path, { maxRedirects: 0, headers: { "accept-language": "en", ...headers } });
    return { status: response.status(), location: response.headers()["location"] ?? "", html: await response.text() };
  };

  test("real HTTP status codes: unknown pages, unknown service and project slugs, addresses without a language, known pages", async ({ request }) => {
    // Unknown pages under a locale (the catch-all), at any depth: a 404 with its localized title and noindex.
    for (const [path, locale] of [
      ["/en/no-such-page", "en"],
      ["/ar/no-such-page", "ar"],
      ["/en/foo/bar", "en"],
      ["/ar/foo/bar", "ar"],
      ["/en/services/laser-cutting/extra", "en"],
    ] as const) {
      const { status: code, html } = await status(request, path);
      expect(code, path).toBe(404);
      expect(html, path).toContain(`<title>${TITLE_404[locale]}</title>`);
      expect(html, path).toMatch(/<meta name="robots" content="noindex"\/>/);
    }
    // Unknown service slugs (this design since TM-2.4) and project slugs (since TM-2.6): a real 404 too, with this
    // design's localized title.
    for (const path of ["/en/services/not-a-service", "/ar/services/not-a-service", "/en/projects/not-a-project", "/ar/projects/not-a-project"]) {
      const { status: code, html } = await status(request, path);
      expect(code, path).toBe(404);
      expect(html, path).toMatch(/<meta name="robots" content="noindex"\/>/);
      expect(html, path).toContain(`<title>${TITLE_404[path.startsWith("/ar") ? "ar" : "en"]}</title>`);
    }
    // Without a language: the visitor's language (here English, or Arabic when asked for), then the 404.
    expect(await status(request, "/no-such-page")).toMatchObject({ status: 307, location: expect.stringMatching(/\/en\/no-such-page$/) });
    expect(await status(request, "/foo/bar", { "accept-language": "ar" })).toMatchObject({ status: 307, location: expect.stringMatching(/\/ar\/foo\/bar$/) });
    expect((await request.get("/no-such-page")).status()).toBe(404);
    // Known pages still answer 200 (Capabilities since Stage 1E; the project pages built in Stage 1F).
    for (const path of ["/en", "/ar", "/en/privacy", "/ar/privacy", "/en/terms", "/ar/terms", "/en/about", "/ar/contact", "/en/services/laser-cutting", "/en/projects", "/ar/projects", "/en/capabilities", "/en/projects/geometric-lanterns"]) {
      expect((await status(request, path)).status, path).toBe(200);
    }
  });

  test("an unknown page shows the new design's 404 in each language: one h1, noindex, the ways on, the address kept by the language switch", async ({ page }) => {
    for (const locale of LOCALES) {
      const errors = trackErrors(page);
      const response = await page.goto(`/${locale}/foo/bar`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(404);
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(NOT_FOUND[locale]);
      await expect(page).toHaveTitle(TITLE_404[locale]);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      await expect(page.locator(`main a[href="/${locale}"]`)).toHaveCount(1);
      await expect(page.locator(`main a[href="/${locale}/contact"]`)).toHaveCount(1);
      // No page of the website is marked current; the language switch keeps the unknown address.
      await expect(page.locator("[aria-current='page']")).toHaveCount(0);
      const other = locale === "en" ? "ar" : "en";
      await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[other]}"]`).first()).toHaveAttribute("href", `/${other}/foo/bar`);
      await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[locale]}"]`).first()).toHaveAttribute("aria-current", "true");
      expect(await horizontalOverflow(page)).toBe(0);
      expect(errors).toEqual([]);
    }
    // Following the switch: the same address, in Arabic.
    await page.goto("/en/foo/bar", { waitUntil: "networkidle" });
    await page.locator('.a2-header .a2-lang a[hreflang="ar-SA"]').first().click();
    await page.waitForURL("**/ar/foo/bar");
    await expect(page.locator("h1")).toHaveText(NOT_FOUND.ar);
  });

  test.describe("phone menu", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the menu sheet's language switch on the 404 shows both languages and keeps the unknown address, in each language", async ({ page }) => {
      for (const locale of LOCALES) {
        const other = locale === "en" ? "ar" : "en";
        const dict = getDictionary(locale);
        const errors = trackErrors(page);
        const response = await page.goto(`/${locale}/foo/bar`, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(404);
        await expect(page.locator("body.mc")).toHaveCount(1);
        const menu = page.locator("details[data-sheet]");
        const summary = menu.locator(":scope > summary");
        await expect(summary).toHaveAttribute("aria-label", dict.a11y.openMenu);
        await summary.tap();
        await expect(menu).toHaveAttribute("open", "");
        await expect(menu.locator(".a2-sheet").getByRole("navigation", { name: dict.a11y.mobileNav })).toBeVisible();
        // The sheet's own language group: both languages, the current one marked, each to the address being viewed.
        const languages = sheetLanguages(page, locale);
        const current = languages.locator(`a[hreflang="${HTML_LANG[locale]}"]`);
        const switchTo = languages.locator(`a[hreflang="${HTML_LANG[other]}"]`);
        await expect(languages.locator("a")).toHaveText(["EN", "عربي"]);
        await expect(current).toBeVisible();
        await expect(switchTo).toBeVisible();
        await expect(current).toHaveAttribute("aria-current", "true");
        await expect(current).toHaveAttribute("href", `/${locale}/foo/bar`);
        expect(await switchTo.getAttribute("aria-current")).toBeNull();
        await expect(switchTo).toHaveAttribute("href", `/${other}/foo/bar`);
        // Escape still closes the sheet and returns focus to its button.
        await page.keyboard.press("Escape");
        await expect(menu).not.toHaveAttribute("open");
        await expect(summary).toBeFocused();
        // Choosing the other language (by touch from English, by keyboard from Arabic): the same unknown address in
        // that language, still a real 404, and the choice remembered.
        await summary.tap();
        const answer = page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === `/${other}/foo/bar`);
        if (locale === "en") await switchTo.tap();
        else {
          await switchTo.focus();
          await page.keyboard.press("Enter");
        }
        expect((await answer).status()).toBe(404);
        await page.waitForURL(`**/${other}/foo/bar`);
        await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[other]);
        await expect(page.locator("html")).toHaveAttribute("dir", other === "ar" ? "rtl" : "ltr");
        await expect(page.locator("h1")).toHaveText(NOT_FOUND[other]);
        expect((await page.context().cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe(other);
        expect(errors).toEqual([]);
      }
    });

    test("on a page with an address of its own the menu's language switch is unchanged, and the 404's is built the same way", async ({ page }) => {
      const menuButton = page.locator("details[data-sheet] > summary");
      await page.goto("/en/privacy", { waitUntil: "networkidle" });
      await menuButton.tap();
      const languages = sheetLanguages(page, "en");
      await expect(languages.locator("a")).toHaveText(["EN", "عربي"]);
      await expect(languages.locator('a[hreflang="en"]')).toHaveAttribute("aria-current", "true");
      await expect(languages.locator('a[hreflang="en"]')).toHaveAttribute("href", "/en/privacy");
      await expect(languages.locator('a[hreflang="ar-SA"]')).toHaveAttribute("href", "/ar/privacy");
      const normal = await languageGroup(languages);
      // The 404's group: the same elements, classes, labels, marks and text; only the addresses differ.
      await page.goto("/en/foo/bar", { waitUntil: "networkidle" });
      await menuButton.tap();
      expect(await languageGroup(sheetLanguages(page, "en"))).toEqual(normal);
      // Back on the page: the switch opens the same page in Arabic and remembers the choice, as before.
      await page.goto("/en/privacy", { waitUntil: "networkidle" });
      await menuButton.tap();
      await languages.locator('a[hreflang="ar-SA"]').tap();
      await page.waitForURL("**/ar/privacy");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("h1")).toHaveText(legalDocuments.privacy.hero.title.ar);
      expect((await page.context().cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe("ar");
    });
  });

  test("an unknown service slug (since TM-2.4) and an unknown project slug (since TM-2.6) have this design's 404", async ({ page }) => {
    for (const [path, locale] of [
      ["/en/services/not-a-service", "en"],
      ["/ar/services/not-a-service", "ar"],
      ["/en/projects/not-a-project", "en"],
      ["/ar/projects/not-a-project", "ar"],
    ] as const) {
      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status(), path).toBe(404);
      await expect(page.locator("body.mc"), path).toHaveCount(1);
      await expect(page.locator("h1"), path).toHaveText(NOT_FOUND[locale]);
      await expect(page.locator("html"), path).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    }
  });

  test("the visitor's theme survives the 404 that Next.js builds in the browser", async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
    await page.goto("/ar/no-such-page", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveClass(/\bjs\b/);
    // The script-only theme control is there, and the page colour is the dark one.
    await expect(page.locator(".a2-header [role=group] button").nth(1)).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(19, 24, 32)");
  });

  test("no page-data or prefetch loop: one redirect to the page-data address, then an answer; the page loads once", async ({ page, request }) => {
    // As for every page, a page-data request without its cache key is sent once to the address with it; then it is
    // answered (the catch-all's 404 sends its payload; a route's own unknown slug answers 404: the services since TM-2.4,
    // the projects since TM-2.6) — never redirected again.
    for (const [path, final] of [
      ["/en/no-such-page", 200],
      ["/ar/foo/bar", 200],
      ["/en/services/not-a-service", 404],
      ["/en/projects/not-a-project", 404],
    ] as const) {
      const headerSets: Record<string, string>[] = [{ RSC: "1" }, { RSC: "1", "Next-Router-Prefetch": "1" }];
      for (const headers of headerSets) {
        const first = await request.get(path, { maxRedirects: 0, headers });
        expect(first.status(), path).toBe(307);
        const next = await request.get(first.headers()["location"], { maxRedirects: 0, headers });
        expect(next.status(), path).toBe(final);
      }
    }
    const documents: string[] = [];
    page.on("request", (r) => void (r.resourceType() === "document" && documents.push(r.url())));
    await page.goto("/en/no-such-page", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    expect(documents).toHaveLength(1);
  });

  test("without JavaScript the 404 still answers 404 with its localized title and noindex", async ({ request }) => {
    // Next.js 16 builds a 404 raised during a dynamic render in the browser (an error shell from the server), in both
    // designs and before TM-2.1 as well; what a crawler or a script-less visitor receives is the status, the title and
    // the robots rule.
    for (const locale of LOCALES) {
      const response = await request.get(`/${locale}/no-such-page`);
      expect(response.status()).toBe(404);
      const html = await response.text();
      expect(html).toContain(`<title>${TITLE_404[locale]}</title>`);
      expect(html).toMatch(/<meta name="robots" content="noindex"\/>/);
    }
  });

  test("outside any language (paths the locale handling never sees), the fallback is unchanged", async ({ page }) => {
    // As before TM-2.1: Next.js's own 404 answers these paths (the bilingual global-not-found.tsx page moves in TM-2.6).
    const response = await page.goto("/api/no-such", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
    await expect(page.locator("body.mc")).toHaveCount(0);
    await expect(page).toHaveTitle("404: This page could not be found.");
  });

  test("the sitemap and robots: unchanged, nothing new listed", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).sort()).toEqual(["/ar", "/en"]);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/User-Agent: \*\s+Allow: \//);
  });
});
