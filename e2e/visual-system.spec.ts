import { expect, test, type Page } from "@playwright/test";
import { skipIntro, trackErrors } from "./helpers";

/**
 * Stage 1C-V visual system: ambient layers, active states, the pointer light and decoration semantics, on the pages
 * still in that design (the homepage moved to the Modern Commerce design in Stage TM-1).
 */

test.beforeEach(async ({ context }) => {
  await skipIntro(context);
});

/** Decorative layers of the visual system. None of them may reach assistive technology. */
const DECORATION = [
  ".tf",
  ".tf-hl",
  ".tf-c",
  ".tf-m",
  ".backdrop",
  ".scan",
  ".plight",
  ".section-rule",
  ".reg-marks",
  ".rivets",
  ".ruler",
  ".wipe-line",
  ".client-line",
  ".service-row-edge",
  ".step-rail",
  ".step-node",
  ".outline-num",
  ".proj-shade",
  ".proj-flag",
  ".filter-chip-mark",
  ".map-plate",
  ".logo-toggle-track",
].join(", ");

function exposedDecoration(page: Page) {
  return page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].filter((el) => !el.closest('[aria-hidden="true"]')).map((el) => el.className),
    DECORATION,
  );
}

test("decorative layers are hidden from assistive technology", async ({ page }) => {
  test.setTimeout(120_000);
  // Contact (TM-2.2), About, Industries, Clients and Certificates (TM-2.3), the services overview and the six service
  // pages (TM-2.4) moved to the Modern Commerce design (their decoration: commerce-contact, commerce-company,
  // commerce-certificates and commerce-services.spec.ts); the pages left in this design stand in.
  for (const path of ["/en/projects", "/ar/projects", "/en/capabilities", "/ar/capabilities", "/en/projects/geometric-lanterns", "/ar/projects/clock-tower-landmark", "/en/projects/not-a-project"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    expect(await exposedDecoration(page), path).toEqual([]);
  }
});

test.describe("ambient motion", () => {
  test("drifting grids and scan lines run only while on screen", async ({ page }) => {
    const errors = trackErrors(page);
    // The projects overview stands in for About (Modern Commerce since Stage TM-2.3): its hero grid drifts in view.
    await page.goto("/en/projects", { waitUntil: "networkidle" });

    // The hero's grid is in view, so it drifts.
    const grid = page.locator("main .backdrop[data-drift]").first();
    await expect(grid).toHaveAttribute("data-live", "on");
    expect(await grid.evaluate((el) => getComputedStyle(el, "::before").animationPlayState)).toBe("running");

    // The first scan line is further down: paused until it is scrolled to, and again once it leaves.
    const scan = page.locator("main .scan").first();
    await expect(scan).toHaveAttribute("data-live", "off");
    await scan.evaluate((el) => el.parentElement!.scrollIntoView({ block: "center" }));
    await expect(scan).toHaveAttribute("data-live", "on");
    expect(await scan.evaluate((el) => getComputedStyle(el, "::before").animationName)).toBe("scan-y");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(scan).toHaveAttribute("data-live", "off");
    expect(errors).toEqual([]);
  });

  test("ambient motion rests while the page is being scrolled", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const grid = page.locator("main .backdrop[data-drift]").first();
    await expect(grid).toHaveAttribute("data-live", "on");
    const during = await page.evaluate(
      () =>
        new Promise<[boolean, string]>((resolve) => {
          window.scrollBy({ top: 40, behavior: "instant" });
          requestAnimationFrame(() =>
            resolve([
              document.documentElement.hasAttribute("data-scrolling"),
              getComputedStyle(document.querySelector("main .backdrop[data-drift]")!, "::before").animationPlayState,
            ]),
          );
        }),
    );
    expect(during).toEqual([true, "paused"]);
    await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-scrolling"))).toBe(false);
    expect(await grid.evaluate((el) => getComputedStyle(el, "::before").animationPlayState)).toBe("running");
  });

  // "line work draws itself once revealed, without a resize" moved to commerce-services.spec.ts with the last drawings
  // that used it (the service pages, Stage TM-2.4): "the four other drawings draw themselves once when revealed" checks
  // the same Chromium regression on their Modern Commerce versions (an inherited --draw, not an attribute selector).

  // "the pointer light follows a mouse over the services plate": the pointer light retired with its last page (the
  // services overview, Stage TM-2.4; decision D8). commerce-services.spec.ts checks the Modern Commerce pointer there
  // (desktop mouse only; never on touch or with reduced motion).
});

test.describe("ambient motion with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("layers stay still and scan lines are hidden", async ({ page }) => {
    // The projects overview stands in for the services overview (Modern Commerce since Stage TM-2.4); its pointer light
    // retired with it (D8), and the Modern Commerce pointer's reduced-motion check is in commerce-services.spec.ts.
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const grid = page.locator("main .backdrop[data-drift]").first();
    await grid.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    expect(await page.locator('[data-live="on"]').count()).toBe(0);
    expect(await grid.evaluate((el) => getComputedStyle(el, "::before").animationName)).toBe("none");
    await expect(page.locator("main .scan").first()).toBeHidden();
    await expect(page.locator(".plight")).toHaveCount(0);
  });
});

// "no pointer light on touch" (ambient motion on touch screens): the pointer light retired with the services overview
// (Stage TM-2.4, D8); commerce-services.spec.ts checks that the Modern Commerce pointer never switches on for touch.

test.describe("active states", () => {
  // "the services overview marks the row being read" moved to commerce-services.spec.ts with the overview (Stage TM-2.4):
  // "the index marks the service being read and jumps to it from the keyboard (one marked at a time)".

  // "legal contents mark the section being read" moved to commerce-inner.spec.ts with the legal pages (Stage TM-2.1).

  test("focus shows the same frame as hover", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const link = page.locator('main a[href^="/en/projects/"]:has(.tf-host .tf-hl)').first();
    await link.focus();
    const frame = link.locator(".tf-host");
    // Corner marks appear and the accent edge draws for keyboard focus too.
    await expect.poll(() => frame.locator(".tf-c").evaluate((el) => getComputedStyle(el).opacity)).toBe("0.9");
    await expect
      .poll(() => frame.locator(".tf-hl").evaluate((el) => getComputedStyle(el, "::before").transform))
      .toBe("none");
  });
});
