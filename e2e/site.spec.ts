import { expect, test } from "@playwright/test";
import { hiddenReveals, INNER_PAGES, skipIntro, trackErrors } from "./helpers";

/**
 * Site shell (stages 1A–1B) on the pages still in the previous design: intro
 * loader, theme, language switching, mobile menu, page transitions, reduced
 * motion and no-JavaScript rendering; and internal links on every page. The
 * homepage moved to the Modern Commerce design in Stage TM-1 (commerce-home.spec.ts), the services in Stage TM-2.4;
 * the pages left in the previous design (the projects overview, the Capabilities and project placeholders) stand in.
 */

test("intro loader shows once per session", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/en/projects", { waitUntil: "domcontentloaded" });
  const loaderShown = () =>
    page.evaluate(() => {
      const loader = document.querySelector(".loader");
      return !!loader && getComputedStyle(loader).display !== "none" && getComputedStyle(loader).visibility !== "hidden";
    });
  expect(await loaderShown()).toBe(true);
  await expect.poll(loaderShown, { timeout: 5_000 }).toBe(false);
  await page.goto("/en/capabilities", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveClass(/no-loader/);
  expect(errors).toEqual([]);
});

test.describe("theme", () => {
  test.use({ colorScheme: "dark" });

  test("follows the OS, toggles, persists and applies before hydration", async ({ page, context }) => {
    await skipIntro(context);
    await page.goto("/en/projects", { waitUntil: "networkidle" });
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
  // A project placeholder (a dynamic route still in this design); the service pages' switch is in commerce-services.spec.ts.
  await page.goto("/en/projects/geometric-lanterns", { waitUntil: "networkidle" });
  await page.click('header a[hreflang="ar-SA"]');
  await page.waitForURL("**/ar/projects/geometric-lanterns");
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
    await page.goto("/ar/projects", { waitUntil: "networkidle" });
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

test("client navigation runs the page transition", async ({ page, context }) => {
  await skipIntro(context);
  const errors = trackErrors(page);
  await page.goto("/en/capabilities", { waitUntil: "networkidle" });
  await page.click('header nav a[href="/en/projects"]');
  await page.waitForURL("**/en/projects");
  await expect(page.locator(".page-wipe")).toHaveAttribute("data-state", "run", { timeout: 1_000 });
  await expect(page.locator("main h1")).toContainText("Built in metal");
  await page.goBack();
  await page.waitForURL(/\/en\/capabilities$/);
  expect(errors).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("skips the loader and the custom cursor, and hides nothing", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveClass(/no-loader/);
    expect(await page.locator(".cursor-ring").count()).toBe(0);
    await expect.poll(() => hiddenReveals(page), { timeout: 3_000 }).toBe(0);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the pages are fully rendered by the server", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "load" });
    await expect(page.locator("h1")).toContainText("Built in metal");
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
