import { expect, test } from "@playwright/test";
import { hiddenReveals, INNER_PAGES, skipIntro, trackErrors } from "./helpers";

/**
 * Site shell and homepage behaviour (stages 1A–1B): intro loader, theme,
 * language switching, mobile menu, homepage explorers, page transitions,
 * reduced motion, no-JavaScript rendering and internal links.
 */

test("intro loader shows once per session", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/en", { waitUntil: "domcontentloaded" });
  const loaderShown = () =>
    page.evaluate(() => {
      const loader = document.querySelector(".loader");
      return !!loader && getComputedStyle(loader).display !== "none" && getComputedStyle(loader).visibility !== "hidden";
    });
  expect(await loaderShown()).toBe(true);
  await expect.poll(loaderShown, { timeout: 5_000 }).toBe(false);
  await page.goto("/en", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveClass(/no-loader/);
  expect(errors).toEqual([]);
});

test.describe("theme", () => {
  test.use({ colorScheme: "dark" });

  test("follows the OS, toggles, persists and applies before hydration", async ({ page, context }) => {
    await skipIntro(context);
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.click('header button[aria-label*="light" i]');
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => localStorage.getItem("rawasy-theme"))).toBe("light");
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  });
});

test("language switch keeps the page, sets RTL and remembers the choice", async ({ page, context }) => {
  await skipIntro(context);
  const errors = trackErrors(page);
  await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
  await page.click('header a[hreflang="ar-SA"]');
  await page.waitForURL("**/ar/services/laser-cutting");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar-SA");
  expect(await page.evaluate(() => document.cookie)).toMatch(/NEXT_LOCALE=ar/);
  expect(errors).toEqual([]);
});

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("opens, traps focus, and Escape closes it and restores focus", async ({ page, context }) => {
    await skipIntro(context);
    const errors = trackErrors(page);
    await page.goto("/ar", { waitUntil: "networkidle" });
    const toggle = page.locator('header button[aria-controls="mobile-menu"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#mobile-menu")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.getElementById("mobile-menu")!.contains(document.activeElement)))
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
    for (let i = 0; i < 30; i++) await page.keyboard.press("Tab");
    const trapped = await page.evaluate(() => {
      const menu = document.getElementById("mobile-menu")!;
      return menu.contains(document.activeElement) || document.activeElement?.getAttribute("aria-controls") === "mobile-menu";
    });
    expect(trapped).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-menu")).toBeHidden();
    await expect(toggle).toBeFocused();
    expect(errors).toEqual([]);
  });
});

test("homepage explorers and certificate dialog", async ({ page, context }) => {
  await skipIntro(context);
  const errors = trackErrors(page);
  await page.goto("/en", { waitUntil: "networkidle" });

  const rows = page.locator("#services ul li[data-row] a");
  await rows.nth(2).scrollIntoViewIfNeeded();
  await rows.nth(2).hover();
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll(".service-figure")].findIndex((f) => (f as HTMLElement).dataset.state === "active")))
    .toBe(2);

  const firstTab = page.locator('#machinery [role="tab"]').first();
  await firstTab.scrollIntoViewIfNeeded();
  await firstTab.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const tabs = page.locator('#machinery [role="tab"]');
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(page.locator("#machinery h3").first()).toContainText("6000W");

  const trigger = page.locator("#certificates li button").first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = page.locator("dialog.cert-dialog");
  await expect(dialog).toHaveJSProperty("open", true);
  expect(await dialog.locator("img").count()).toBeGreaterThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveJSProperty("open", false);
  expect(errors).toEqual([]);
});

test("client navigation runs the page transition", async ({ page, context }) => {
  await skipIntro(context);
  const errors = trackErrors(page);
  await page.goto("/en", { waitUntil: "networkidle" });
  await page.click('header nav a[href="/en/about"]');
  await page.waitForURL("**/en/about");
  await expect(page.locator(".page-wipe")).toHaveAttribute("data-state", "run", { timeout: 1_000 });
  await expect(page.locator("main h1")).toContainText("engineered in Riyadh");
  await page.goBack();
  await page.waitForURL(/\/en$/);
  expect(errors).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("skips the loader and the custom cursor, and hides nothing", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveClass(/no-loader/);
    expect(await page.locator(".cursor-ring").count()).toBe(0);
    await expect.poll(() => hiddenReveals(page), { timeout: 3_000 }).toBe(0);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the homepage is fully rendered by the server", async ({ page }) => {
    await page.goto("/en", { waitUntil: "load" });
    await expect(page.locator("h1")).toContainText(/engineering/i);
    const hidden = await page.evaluate(
      () => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length,
    );
    expect(hidden).toBe(0);
  });
});

test("internal links on the homepage and inner pages resolve", async ({ page, request }) => {
  test.setTimeout(180_000);
  const links = new Set<string>();
  for (const locale of ["en", "ar"]) {
    for (const route of ["", ...INNER_PAGES.map((p) => `/${p}`)]) {
      await page.goto(`/${locale}${route}`, { waitUntil: "domcontentloaded" });
      const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
      for (const href of hrefs) {
        if (href && href.startsWith("/") && !href.startsWith("//")) links.add(href.split("#")[0] || "/");
      }
    }
  }
  const broken: string[] = [];
  for (const href of links) {
    const response = await request.get(href, { maxRedirects: 0 });
    if (response.status() >= 400) broken.push(`${href} → ${response.status()}`);
  }
  expect(links.size).toBeGreaterThan(40);
  expect(broken).toEqual([]);
});
