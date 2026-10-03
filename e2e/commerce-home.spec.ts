import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, jsonLd, LOCALES, trackErrors } from "./helpers";
import {
  AMBIENT,
  ambientAnimations,
  expectCycles,
  expectFinished,
  expectPlateFinished,
  inView,
  plateClock,
  plateLog,
  plateLoop,
  recordPlate,
  signatureAnimations,
} from "./a2-helpers";

/**
 * Stage TM-1: the homepage in the Modern Commerce design (the approved A V2 direction) on the website's own routes,
 * /en and /ar. The components it shares with the theme lab (hero plate, signatures, ambient, pointer) are covered in
 * depth by theme-lab-a-v2.spec.ts; this spec checks them where visitors meet them, with the real navigation, the
 * quote actions, the shared theme and language, the footer, search metadata and the way to the other pages (one design
 * since Stage TM-2.6).
 */

const SERVICES = ["laser-cutting", "cnc-bending", "steel-structures", "fabrication", "laser-engraving", "scaffolding"];
const SECTIONS = ["home", "about", "services", "machinery", "projects", "industries", "clients", "contact"];
const PAGES = ["about", "capabilities", "projects", "industries", "clients", "contact"];
/** The header's pages, in order (Services is a menu between About and Capabilities). */
const navHrefs = (locale: string) => [`/${locale}`, ...PAGES.map((p) => `/${locale}/${p}`)];
/** Photos kept off featured spots (docs/ASSET_INVENTORY.md). */
const FLAGGED = ["engraving-nameplates", "engraving-wood", "engraving-rotary", "canopy-tree-1", "wheat-monument-1", "stainless-landmark-1", "billboard-structure-1", "lattice-cubes-1", "seed-sculpture-1", "laser-cut-bench-1", "litter-bins"];
const PAGE_COLOURS = { light: "rgb(244, 244, 241)", dark: "rgb(19, 24, 32)" };

const bodyColour = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
/** The theme as the page is first parsed: set by the boot script in <head> before <body> exists, so before any paint. */
const recordFirstTheme = (page: Page) =>
  page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.body) return;
      (window as unknown as { __firstTheme: string | null }).__firstTheme = document.documentElement.getAttribute("data-theme");
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
const firstTheme = (page: Page) => page.evaluate(() => (window as unknown as { __firstTheme: string | null }).__firstTheme);

test.describe("the homepage", () => {
  test("both languages: one h1, the approved sections in order, landmarks, the client wall and no flagged photo", async ({ page }) => {
    for (const locale of LOCALES) {
      const errors = trackErrors(page);
      const response = await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.locator("main section[id]").evaluateAll((els) => els.map((el) => el.id))).toEqual(SECTIONS);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      // Headings never skip a level.
      const levels = await page.locator("main :is(h1, h2, h3, h4)").evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
      for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1);
      expect(await page.locator("#clients img").count()).toBe(21);
      expect(await page.locator("#clients").innerText()).not.toMatch(/\b\d{2}\b/);
      const sources = await page.locator("img").evaluateAll((els) => els.map((i) => (i as HTMLImageElement).currentSrc || i.getAttribute("src") || ""));
      for (const id of FLAGGED) expect(sources.filter((s) => s.includes(id)), id).toEqual([]);
      // Preview chrome and lab links stay in the lab.
      await expect(page.locator('.lab-bar, a[href*="theme-lab"]')).toHaveCount(0);
      expect(errors).toEqual([]);
    }
  });

  test("its own stylesheet and typefaces, the same on a planned page: none of the previous design's load anywhere", async ({ page }) => {
    const sheet = (selector: string) =>
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
    // Declared typefaces, without next/font's metric-matched fallbacks ("Inter Fallback" …).
    const families = () =>
      page.evaluate(() => [...new Set([...document.fonts].map((f) => f.family.replace(/['"]/g, "")))].filter((f) => !f.endsWith(" Fallback")).sort());
    const preloads = () => page.locator('link[rel="preload"][as="font"]').count();
    await page.goto("/en", { waitUntil: "networkidle" });
    expect(await sheet(".btn-face")).toBe(false);
    expect(await families()).toEqual(["IBM Plex Sans Arabic", "Inter", "Plus Jakarta Sans", "Tajawal"]);
    // Only the Latin faces of this design are preloaded; the previous design's six files no longer are.
    expect(await preloads()).toBe(2);
    // A project page (planned, in this design since Stage TM-2.6) has the same stylesheet, faces and preloads; the
    // previous design's (Sora, Manrope, Noto Kufi Arabic, Geist Mono) are gone from the website.
    await page.goto("/en/projects/geometric-lanterns", { waitUntil: "networkidle" });
    expect(await sheet(".mc .a2-header")).toBe(true);
    expect(await sheet(".btn-face")).toBe(false);
    expect(await families()).toEqual(["IBM Plex Sans Arabic", "Inter", "Plus Jakarta Sans", "Tajawal"]);
    expect(await preloads()).toBe(2);
  });
});

test.describe("navigation", () => {
  test("the header links the website's pages, marks the homepage and lists the six services", async ({ page }) => {
    const errors = trackErrors(page);
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const nav = page.locator(".a2-nav");
      expect(await nav.locator("a.nav-link").evaluateAll((els) => els.map((a) => a.getAttribute("href")))).toEqual(navHrefs(locale));
      await expect(nav.locator("a.nav-link[aria-current=page]")).toHaveAttribute("href", `/${locale}`);
      await expect(page.locator(".a2-header a[aria-label]").first()).toHaveAttribute("href", `/${locale}`);
      const menu = nav.locator("details[data-dropdown]");
      await menu.locator("summary").click();
      await expect(menu.locator(".a2-dd-panel")).toBeVisible();
      expect(await menu.locator(".a2-dd-item").evaluateAll((els) => els.map((a) => a.getAttribute("href")))).toEqual(SERVICES.map((s) => `/${locale}/services/${s}`));
      await expect(menu.locator(`a[href="/${locale}/services"]`)).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(menu).not.toHaveAttribute("open");
      await expect(menu.locator("summary")).toBeFocused();
    }
    expect(errors).toEqual([]);
  });

  test("every quote action opens the quotation form on the contact page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const label = locale === "en" ? "^(Get a Quote|Request a Quote)$" : "^اطلب عرض سعر$";
      const quotes = await page.locator("a").evaluateAll((els, re) => els.filter((a) => new RegExp(re).test(a.textContent!.trim())).map((a) => a.getAttribute("href")), label);
      // Header, Services menu, phone menu, the six machines, the contact band and the footer.
      expect(quotes).toHaveLength(11);
      expect(new Set(quotes)).toEqual(new Set([`/${locale}/contact#quote`]));
    }
    await page.goto("/en", { waitUntil: "networkidle" });
    await page.locator(".a2-head-quote").click();
    await page.waitForURL("**/en/contact#quote");
    await expect(page.locator("#quote")).toBeInViewport();
  });

  test("the hero's Start a Project opens the quotation form in each language; Explore Our Capabilities stays on the page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const primary = page.locator(".a2-hero .btn-primary");
      await expect(primary).toHaveAttribute("href", `/${locale}/contact#quote`);
      await expect(primary).toHaveText(locale === "en" ? "Start a Project" : "ابدأ مشروعك");
      await expect(page.locator(".a2-hero .btn-secondary")).toHaveAttribute("href", "#machinery");
      await primary.click();
      await page.waitForURL(`**/${locale}/contact#quote`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale === "en" ? "en" : "ar-SA");
      await expect(page.locator("#quote")).toBeInViewport();
    }
  });

  test("the six project cards open the Projects gallery and say so; no card leads to an unfinished project page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const cards = page.locator("#projects a.a2-proj");
      await expect(cards).toHaveCount(6);
      expect(new Set(await cards.evaluateAll((els) => els.map((a) => a.getAttribute("href"))))).toEqual(new Set([`/${locale}/projects#gallery`]));
      for (const cta of await cards.locator(".a2-proj-cta").allTextContents()) expect(cta.trim()).toBe(locale === "en" ? "View in the gallery" : "عرض في معرض الأعمال");
      // Nothing on the homepage links a project detail page (Stage 1F) any more.
      expect(await page.locator(`a[href^="/${locale}/projects/"]`).count()).toBe(0);
    }
    // Following a card: the Projects overview opens at its gallery, with each of the six projects shown there.
    await page.goto("/en", { waitUntil: "networkidle" });
    const titles = await page.locator("#projects .a2-proj-title").allTextContents();
    await page.locator("#projects a.a2-proj").nth(1).click();
    await page.waitForURL("**/en/projects#gallery");
    await expect(page.locator("#gallery")).toBeInViewport();
    for (const title of titles) await expect(page.locator("#gallery li[data-project]:not([hidden])").filter({ hasText: title }).first()).toBeAttached();
  });

  test("Capabilities opens from the header in this design, marked as the page, and leads back", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en", { waitUntil: "networkidle" });
    // Capabilities (Stage 1E) is in this design.
    await page.locator('.a2-nav a[href="/en/capabilities"]').click();
    await page.waitForURL("**/en/capabilities");
    await expect(page.locator("main h1")).toContainText("Capabilities");
    await expect(page.locator("body.mc")).toHaveCount(1);
    await expect(page.locator('.a2-nav a[aria-current="page"]')).toHaveAttribute("href", "/en/capabilities");
    await page.locator('header a[href="/en"]').first().click();
    await page.waitForURL(/\/en$/);
    await expect(page.locator("body.mc")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("Engineering metal");
    // An unknown page under a locale is the localized 404, in the Modern Commerce design since Stage TM-2.1.
    const missing = await page.goto("/en/no-such-page", { waitUntil: "networkidle" });
    expect(missing?.status()).toBe(404);
    await expect(page.locator("body.mc")).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("the language switch opens this page in the other language, sets RTL and remembers the choice", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en", { waitUntil: "networkidle" });
    const lang = page.locator(".a2-header .a2-lang").first();
    await expect(lang.locator('a[hreflang="en"]')).toHaveAttribute("aria-current", "true");
    await lang.locator('a[hreflang="ar-SA"]').click();
    await page.waitForURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar-SA");
    expect(await page.evaluate(() => document.cookie)).toMatch(/NEXT_LOCALE=ar/);
    // The bare address follows the choice.
    await page.goto("/", { waitUntil: "networkidle" });
    expect(new URL(page.url()).pathname).toBe("/ar");
    await page.locator(".a2-header .a2-lang").first().locator('a[hreflang="en"]').click();
    await page.waitForURL(/\/en$/);
    expect(await page.evaluate(() => document.cookie)).toMatch(/NEXT_LOCALE=en/);
    expect(errors).toEqual([]);
  });

  test("Arabic mirrors the page: the reading side, Arabic faces, never letter-spaced; the plate stays an object", async ({ page }) => {
    await page.goto("/ar", { waitUntil: "networkidle" });
    const logo = (await page.locator(".a2-header a[aria-label]").first().boundingBox())!;
    const quote = (await page.locator(".a2-head-quote").boundingBox())!;
    expect(logo.x).toBeGreaterThan(quote.x);
    const h1 = (await page.locator("h1").boundingBox())!;
    const plate = (await page.locator(".a2-hero .a2-plate-stage").boundingBox())!;
    expect(h1.x).toBeGreaterThan(plate.x);
    expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Tajawal/);
    expect(await page.locator(".a2-hero .t-lead").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/IBM Plex Sans Arabic/);
    const spaced = await page.evaluate(() => [...document.querySelectorAll("h1, h2, h3, p, a, button, li")].filter((el) => parseFloat(getComputedStyle(el).letterSpacing) > 0).length);
    expect(spaced).toBe(0);
    expect(await page.locator(".a2-hero .a2-plate").evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
  });

  test("the footer: the website's pages, both phones, email, WhatsApp and the legal pages", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const footer = page.locator("footer");
      const hrefs = await footer.locator("a").evaluateAll((els) => els.map((a) => a.getAttribute("href")!));
      expect(hrefs).toEqual(
        expect.arrayContaining([
          `/${locale}/contact#quote`,
          ...SERVICES.map((s) => `/${locale}/services/${s}`),
          ...["about", "projects", "clients", "industries", "capabilities", "certificates", "privacy", "terms"].map((p) => `/${locale}/${p}`),
          "tel:+966537368310",
          "tel:+966552616189",
          "mailto:rawasymetal@gmail.com",
          "https://wa.me/966537368310",
          "#top",
        ]),
      );
      expect(hrefs.filter((h) => !h.startsWith(`/${locale}`) && !/^(tel:|mailto:|https:\/\/wa\.me\/|#top$)/.test(h))).toEqual([]);
      // "Co. Ltd. All rights reserved.", as on the pages in the previous design.
      await expect(footer).not.toContainText("..");
    }
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the menu sheet lists the real pages, locks the page, closes with Escape and opens the page chosen", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/ar", { waitUntil: "networkidle" });
    await expect(page.locator(".a2-head-quote")).toBeVisible();
    const menu = page.locator("details[data-sheet]");
    const summary = menu.locator(":scope > summary");
    await summary.click();
    const sheet = menu.locator(".a2-sheet");
    await expect(sheet).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
    expect(await sheet.locator("a.a2-sheet-row").evaluateAll((els) => els.map((a) => a.getAttribute("href")))).toEqual(navHrefs("ar"));
    await expect(sheet.locator('a.a2-sheet-row[aria-current="page"]')).toHaveAttribute("href", "/ar");
    await sheet.locator(".a2-sheet-sub > summary").click();
    expect(await sheet.locator(".a2-sheet-sub a.a2-dd-item").evaluateAll((els) => els.map((a) => a.getAttribute("href")))).toEqual(SERVICES.map((s) => `/ar/services/${s}`));
    await expect(sheet.locator(".a2-sheet-foot a.btn-primary")).toHaveAttribute("href", "/ar/contact#quote");
    await expect(sheet.locator('.a2-lang a[hreflang="en"]')).toHaveAttribute("href", "/en");
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open");
    await expect(summary).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
    // Tabbing on past its last link closes it: focus never lands on the page hidden under the sheet.
    await summary.click();
    await sheet.locator(".a2-sheet-foot a.btn-primary").focus();
    await page.keyboard.press("Tab");
    await expect(menu).not.toHaveAttribute("open");
    expect(await page.evaluate(() => !!document.activeElement?.closest("details[data-sheet]"))).toBe(false);
    await summary.click();
    await sheet.locator('a.a2-sheet-row[href="/ar/about"]').click();
    await page.waitForURL("**/ar/about");
    expect(errors).toEqual([]);
  });

  test("a project card in the swipe rail opens the Projects gallery", async ({ page }) => {
    await page.goto("/ar", { waitUntil: "networkidle" });
    const card = page.locator("#projects a.a2-proj").first();
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    await page.waitForURL("**/ar/projects#gallery");
    await expect(page.locator("#gallery")).toBeInViewport();
    expect(await page.locator("#gallery li[data-project][hidden]").count()).toBe(0);
  });

  test("no custom pointer on touch: the system cursor stays and taps work", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    await page.locator(".a2-hero .btn-secondary").tap();
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on");
    await expect(page.locator(".a2-cursor")).toBeHidden();
    expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).cursor)).not.toBe("none");
  });
});

test.describe("light and dark", () => {
  test("the website's theme: chosen here, kept on the other pages and back, set before the first paint", async ({ page }) => {
    await recordFirstTheme(page);
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await bodyColour(page)).toBe(PAGE_COLOURS.light);
    const dark = page.locator(".a2-header [role=group] button").nth(1);
    await dark.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(dark).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("rawasy-theme"))).toBe("dark");
    await expect.poll(() => bodyColour(page)).toBe(PAGE_COLOURS.dark);
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#131820");
    // Another page (Capabilities) opens dark from its first paint ...
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    expect(await firstTheme(page)).toBe("dark");
    // ... and a choice made there comes back to the homepage from its first paint too.
    await page.locator(".a2-header [role=group] button").first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("rawasy-theme"))).toBe("light");
    await page.goto("/ar", { waitUntil: "networkidle" });
    expect(await firstTheme(page)).toBe("light");
    expect(await bodyColour(page)).toBe(PAGE_COLOURS.light);
  });

  test.describe("with a dark system setting", () => {
    test.use({ colorScheme: "dark" });

    test("follows the system until a choice is made", async ({ page }) => {
      await recordFirstTheme(page);
      await page.goto("/en", { waitUntil: "networkidle" });
      expect(await firstTheme(page)).toBe("dark");
      expect(await bodyColour(page)).toBe(PAGE_COLOURS.dark);
      expect(await page.evaluate(() => localStorage.getItem("rawasy-theme"))).toBeNull();
    });
  });

  test("no sideways scroll from 360 to 1920 px, in both languages and both themes", async ({ page, context }) => {
    test.setTimeout(150_000);
    for (const theme of ["light", "dark"]) {
      await context.addInitScript((t) => localStorage.setItem("rawasy-theme", t), theme);
      for (const width of [360, 390, 834, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const locale of LOCALES) {
          await page.goto(`/${locale}`, { waitUntil: "networkidle" });
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          expect(await horizontalOverflow(page), `${locale} ${theme} at ${width}px`).toBe(0);
        }
      }
    }
  });
});

test.describe("hero plate", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });
  const plate = ".a2-hero .a2-plate";

  test("the complete cutting sequence repeats every 10 s, start to start, in English and Arabic", async ({ page }) => {
    test.setTimeout(100_000);
    const errors = trackErrors(page);
    await recordPlate(page);
    for (const [locale, cycles] of [
      ["en", 3],
      ["ar", 2],
    ] as const) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await expect.poll(async () => (await plateLog(page)).cycles.length, { timeout: 45_000, intervals: [1000] }).toBeGreaterThanOrEqual(cycles);
      expectCycles(await plateLog(page), cycles);
    }
    expect(errors).toEqual([]);
  });

  test("it rests off screen and in a hidden tab, carries on from the same frame, and reads X / Y under the mouse", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator(plate)).toHaveAttribute("data-cycle", "1");
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector("#contact")!.scrollIntoView({ behavior: "instant", block: "start" }));
    await expect.poll(async () => (await plateLoop(page, plate)).filter((a) => a.state !== "paused").length).toBe(0);
    const rested = await plateClock(page, plate);
    await page.waitForTimeout(1200);
    expect(await plateClock(page, plate)).toEqual(rested);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(async () => (await plateClock(page, plate)).state).toBe("running");
    const resumed = await plateClock(page, plate);
    expect(resumed.cycle).toBe(rested.cycle);
    expect(resumed.time).toBeGreaterThanOrEqual(rested.time);
    expect(resumed.time).toBeLessThan(rested.time + 1000);
    const visibility = (state: "hidden" | "visible") =>
      page.evaluate((v) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
    await visibility("hidden");
    await expect.poll(async () => (await plateClock(page, plate)).state).toBe("paused");
    await visibility("visible");
    await expect.poll(async () => (await plateClock(page, plate)).state).toBe("running");
    // The mouse leans the plate and reads its coordinates; the loop carries on underneath.
    const read = page.locator(".a2-hero .a2-plate-read");
    const box = (await page.locator(`${plate} svg`).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await expect(read).toHaveAttribute("data-pointer", "");
    await expect(read.locator("[dir=ltr]")).toHaveText(/^X \d{3}\.\d · Y \d{3}\.\d$/);
    await expect.poll(() => page.locator(".a2-hero .a2-plate-tilt").evaluate((el) => (el as HTMLElement).style.transform)).toContain("rotateY");
    expect((await plateClock(page, plate)).state).toBe("running");
  });
});

test.describe("signatures, ambient and pointer", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("Laser Cutting and Laser Engraving play once in view and finish on the service pages' pictures", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = trackErrors(page);
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await expect(page.locator("#services .sig-cut")).toHaveCount(1);
      await expect(page.locator("#services .sig-engrave")).toHaveCount(1);
      // The rejected concepts stay gone: no star cut, lifted part or medallion.
      await expect(page.locator(".sig-piece, .sig-rim, .sig-medallion, .sig-raster")).toHaveCount(0);
      expect(await signatureAnimations(page, ".sig-cut")).toEqual([]);
      for (const sel of [".sig-cut", ".sig-engrave"]) {
        await inView(page, sel);
        await expect.poll(async () => (await signatureAnimations(page, sel)).length).toBeGreaterThan(20);
        for (const a of await signatureAnimations(page, sel)) expect(a.iterations).toBe(1);
      }
      for (const sel of [".sig-cut", ".sig-engrave"])
        await expect.poll(async () => (await signatureAnimations(page, sel)).every((a) => a.state === "finished"), { timeout: 15_000 }).toBe(true);
      await expectFinished(page);
    }
    expect(errors).toEqual([]);
  });

  test("one fixed ambient behind the page: two moving layers, hidden from assistive technology, resting while the page scrolls", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const layer = await page.evaluate((sel) => {
        const all = document.querySelectorAll(sel);
        const el = all[0];
        const cs = getComputedStyle(el);
        return { count: all.length, hidden: el.getAttribute("aria-hidden"), position: cs.position, z: cs.zIndex, events: cs.pointerEvents, layers: [...el.children].map((c) => c.className) };
      }, AMBIENT);
      expect(layer).toEqual({ count: 1, hidden: "true", position: "fixed", z: "-1", events: "none", layers: ["a2-ambient-field", "a2-ambient-sweep"] });
      const anims = await ambientAnimations(page);
      const drift = locale === "ar" ? "a2-amb-drift-rtl" : "a2-amb-drift";
      expect(anims.map((a) => a.name).sort()).toEqual(["a2-amb-breathe", drift, drift, "a2-amb-sweep"]);
      expect(anims.every((a) => a.state === "running" && a.iterations === Infinity)).toBe(true);
    }
    // Motion marks the hero live once it runs; scrolled, every layer pauses and its clock holds.
    await expect(page.locator(".a2-hero")).toHaveAttribute("data-live", "");
    const samples = await page.evaluate(
      (sel) =>
        new Promise<{ marked: boolean; states: string[]; times: number[] }[]>((resolve) => {
          const take = () => {
            const anims = document.querySelector(sel)!.getAnimations({ subtree: true });
            return { marked: document.documentElement.hasAttribute("data-scrolling"), states: anims.map((a) => a.playState), times: anims.map((a) => Number(a.currentTime)) };
          };
          addEventListener(
            "scroll",
            async () => {
              const out = [take()];
              for (let i = 0; i < 10; i++) {
                scrollBy(0, 40);
                await new Promise((r) => setTimeout(r, 50));
                out.push(take());
              }
              resolve(out);
            },
            { once: true },
          );
          scrollBy(0, 300);
        }),
      AMBIENT,
    );
    const marked = samples.filter((s) => s.marked);
    expect(marked.length).toBeGreaterThan(3);
    for (const s of marked) expect(s.states).toEqual(Array(4).fill("paused"));
    await expect.poll(async () => (await ambientAnimations(page)).map((a) => a.state)).toEqual(Array(4).fill("running"));
  });

  test("the pointer: desktop mouse only, marks links and the plate, leaves text selectable, gives text fields the I-beam", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on");
    await page.mouse.move(400, 420);
    await page.mouse.move(420, 440);
    await expect(page.locator("html")).toHaveAttribute("data-cursor-on", "");
    const cursor = page.locator(".a2-cursor");
    await expect(cursor).toHaveAttribute("data-shown", "");
    await expect(cursor).toHaveAttribute("aria-hidden", "true");
    expect(await cursor.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    const dot = (await page.locator(".a2-cursor-dot").boundingBox())!;
    expect(Math.round(dot.x + dot.width / 2)).toBe(420);
    expect(Math.round(dot.y + dot.height / 2)).toBe(440);
    await page.locator('.a2-nav a[href="/en/about"]').hover();
    await expect(cursor).toHaveAttribute("data-state", "active");
    await page.locator(".a2-hero .a2-plate").hover();
    await expect(cursor).toHaveAttribute("data-state", "plate");
    // Text can still be selected under it.
    await page.locator(".a2-hero .t-lead").click({ clickCount: 3 });
    expect(await page.evaluate(() => getSelection()!.toString())).toContain("Advanced metal fabrication");
    // Text fields keep the system I-beam (the homepage has none, so one is added for the check).
    await page.evaluate(() => {
      const field = Object.assign(document.createElement("input"), { id: "probe", type: "text" });
      field.style.cssText = "position:fixed;top:200px;left:200px;width:240px;height:40px;z-index:5";
      document.querySelector("main")!.append(field);
    });
    await page.locator("#probe").hover();
    await expect(cursor).not.toHaveAttribute("data-shown");
    expect(await page.locator("#probe").evaluate((el) => getComputedStyle(el).cursor)).toBe("text");
    // Keyboard focus never lands on it.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest(".a2-cursor"))).toBe(false);
    }
  });
});

test.describe("keyboard", () => {
  test("the skip link comes first, focus is visible, and the header and Services menu work from the keyboard", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Tab");
    const logo = page.locator(".a2-header a[aria-label]").first();
    await expect(logo).toBeFocused();
    expect(await logo.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.locator(".a2-nav details[data-dropdown] > summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".a2-nav details[data-dropdown]")).toHaveAttribute("open", "");
    await page.keyboard.press("Tab");
    await expect(page.locator(".a2-dd-item").first()).toBeFocused();
    // Leaving the menu with Tab closes it.
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    await expect(page.locator(".a2-nav details[data-dropdown]")).not.toHaveAttribute("open");
    // The skip link lands on the main content.
    await skip.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the finished plate and signatures at once, no loop, a still background and the system pointer", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      await expectPlateFinished(page);
      await page.waitForTimeout(1200);
      expect(await page.locator(".a2-hero .a2-plate").getAttribute("data-cycle")).toBeNull();
      for (const sel of [".sig-cut", ".sig-engrave"]) {
        await inView(page, sel);
        await page.waitForTimeout(300);
        expect(await signatureAnimations(page, sel)).toEqual([]);
      }
      await expectFinished(page);
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
      await page.mouse.move(700, 400);
      await page.mouse.move(720, 420);
      await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on");
    }
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("everything is shown: the finished plate and signatures, one machine panel, menus as disclosures, a light page", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => [...document.querySelectorAll("[data-reveal], [data-enter]")].filter((el) => getComputedStyle(el).opacity === "0").length)).toBe(0);
    await expectFinished(page);
    await expectPlateFinished(page);
    expect(await bodyColour(page)).toBe(PAGE_COLOURS.light);
    await expect(page.locator(".a2-cursor")).toBeHidden();
    expect(await page.locator(".a2-mx-panel").evaluateAll((els) => els.filter((el) => getComputedStyle(el).visibility === "visible").length)).toBe(1);
    // Script-only controls stay out of the way.
    expect(await page.locator(".a2-header [role=group]").evaluateAll((els) => els.every((el) => !(el as HTMLElement).offsetParent))).toBe(true);
    await expect(page.locator("button[data-toggle=colour]")).toBeHidden();
    await page.locator(".a2-nav details[data-dropdown] > summary").click();
    await expect(page.locator(".a2-dd-item").first()).toBeVisible();
  });
});

test.describe("search", () => {
  test("the homepage stays published and indexable, with its canonical, languages and organisation data; the lab stays out", async ({ page, request }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });
      expect(await page.locator('meta[name="robots"]').count()).toBe(0);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://www.rawasymetal.com/${locale}`);
      for (const [lang, path] of [
        ["en", "en"],
        ["ar", "ar"],
        ["x-default", "en"],
      ])
        await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveAttribute("href", `https://www.rawasymetal.com/${path}`);
      const types = (await jsonLd(page)).flatMap((d) => (d["@graph"] ?? [d]).map((g: { "@type": string | string[] }) => g["@type"]).flat());
      expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
      await expect(page).toHaveTitle(locale === "en" ? /^RAWASY — Laser Cutting/ : /^رواسي — /);
    }
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toMatch(/\/en<\/loc>/);
    expect(xml).toMatch(/\/ar<\/loc>/);
    expect(xml).not.toContain("theme-lab");
    expect((await request.get("/theme-lab/en/modern-commerce-a-v2")).headers()["x-robots-tag"]).toContain("noindex");
  });
});
