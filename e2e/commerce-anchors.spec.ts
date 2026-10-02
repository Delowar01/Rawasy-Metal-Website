import { expect, test } from "@playwright/test";
import { coldLanding, FONT_DELAYS, placed, placement, VIEWPORTS } from "./anchor-helpers";

/**
 * The first jump to an address's #anchor on the Modern Commerce pages (Stage TM-2.5's shared fix). The boot script
 * (src/lib/commerce-boot.ts) turns on gliding same-page jumps only once the page has loaded and its fonts are in, so the
 * browser's first jump is instant and the browser keeps it on its target while the page loads. Before the fix the first
 * jump glided (`scroll-behavior: smooth` from the start) and kept the position it set out for: a web font arriving on
 * the way left the target short of its place or under the header (up to 309 px off in the TM-2.5 measurements).
 *
 * Every cold case loads the page in a new browser context (nothing cached, the fonts included) with the font files held
 * back by the network, on a desktop and a phone, and checks the landing at the load event, once the fonts are in, two
 * frames later and after an idle moment: the target sits on its place below the sticky header (or the page ends first).
 */

/** The cold-load cases of the pages migrated before TM-2.5 (the Projects overview adds its own in commerce-projects). */
const CASES = {
  contact: ["/en/contact#quote", "/en/contact#location"],
  legal: ["/en/privacy#contact", "/ar/terms#contact"],
  services: ["/en/services/laser-cutting#gallery", "/ar/services/fabrication#projects"],
} as const;

for (const [family, paths] of Object.entries(CASES)) {
  test.describe(`cold load with delayed fonts: ${family}`, () => {
    for (const path of paths) {
      for (const view of VIEWPORTS) {
        test(`${path} on a ${view.name}: lands below the header and stays there`, async ({ browser }) => {
          for (const delay of FONT_DELAYS) {
            const { samples, glide, fonts } = await coldLanding(browser, path, view, delay);
            // The fonts really came from the network (a cold cache), late.
            expect(fonts, `${path} fonts requested`).toBeGreaterThan(0);
            for (const [moment, sample] of Object.entries(samples)) {
              expect(placed(sample), `${path} ${view.name} +${delay} ms, ${moment}: ${JSON.stringify(sample)}`).toBe(true);
            }
            // Instant while loading; same-page links glide once the page has settled.
            expect(glide).toEqual({ atStart: "auto", settled: "smooth" });
          }
        });
      }
    }
  });
}

test.describe("after the page has settled", () => {
  test("a same-page link glides to its target; Back and Forward return to each place", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-smooth-scroll"));
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("smooth");
    // The hero's address row jumps to the map: several frames on the way, not one jump.
    const frames = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const seen = new Set<number>();
          (document.querySelector('main a[href$="#location"]') as HTMLAnchorElement).click();
          const start = performance.now();
          const tick = () => {
            seen.add(Math.round(scrollY));
            if (performance.now() - start < 1500) requestAnimationFrame(tick);
            else resolve(seen.size);
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(frames).toBeGreaterThan(5);
    expect(placed(await placement(page, "location"))).toBe(true);
    await page.goBack();
    await expect.poll(() => page.evaluate(() => [location.hash, Math.round(scrollY)])).toEqual(["", 0]);
    await page.goForward();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("#location");
    await expect.poll(async () => placed(await placement(page, "location"))).toBe(true);
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("every jump stays instant, the first one lands on its target", async ({ browser }) => {
      for (const path of ["/en/contact#location", "/ar/terms#contact"]) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
        await context.route(/\.woff2$/, async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          await route.continue();
        });
        const page = await context.newPage();
        await page.goto(path, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => document.documentElement.hasAttribute("data-smooth-scroll"));
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), path).toBe("auto");
        expect(placed(await placement(page, path.split("#")[1])), path).toBe(true);
        await context.close();
      }
    });
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // Without script nothing glides, and the browser's instant first jump lands on the target. (It stops correcting that
  // jump at the load event, so a font that only swaps in after it — a cold cache on a slow line — can still move the
  // target: see the TM-2.5 report. Here the fonts are in the cache, as for a returning visitor.)
  test("a direct address with an #anchor lands below the header, on a desktop and a phone", async ({ browser }) => {
    for (const view of VIEWPORTS) {
      const context = await browser.newContext({ viewport: view.viewport, isMobile: view.isMobile, javaScriptEnabled: false });
      const page = await context.newPage();
      for (const path of Object.values(CASES).flat()) {
        await page.goto(path.split("#")[0], { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.goto("about:blank");
        await page.goto(path, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), path).toBe("auto");
        await expect.poll(async () => placed(await placement(page, path.split("#")[1])), { message: `${path} ${view.name}` }).toBe(true);
      }
      await context.close();
    }
  });
});
