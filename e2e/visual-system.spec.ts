import { expect, test, type Page } from "@playwright/test";
import { skipIntro, trackErrors } from "./helpers";

/** Stage 1C-V visual system: ambient layers, active states, the pointer light and decoration semantics. */

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
  for (const path of ["/en", "/ar", "/en/about", "/ar/about", "/ar/services", "/en/projects", "/ar/projects", "/en/industries", "/en/clients", "/ar/certificates", "/en/contact", "/ar/privacy"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    expect(await exposedDecoration(page), path).toEqual([]);
  }
});

test.describe("ambient motion", () => {
  test("drifting grids and scan lines run only while on screen", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/about", { waitUntil: "networkidle" });

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
    await page.goto("/en/about", { waitUntil: "networkidle" });
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

  test("line work draws itself once revealed, without a resize", async ({ page }) => {
    // Regression: `[data-revealed] [pathLength]` selectors never restyled the SVG paths in Chromium.
    for (const [path, host] of [
      ["/en", ".beam-draw"],
      ["/en", ".pillar"],
      ["/en/about", ".line-draw"],
      ["/en/services/cnc-bending", ".line-draw"],
      ["/ar/services/laser-engraving", ".line-draw"],
    ]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const el = page.locator(host).first();
      await el.evaluate((node) => node.scrollIntoView({ block: "center" }));
      await expect(el).toHaveAttribute("data-revealed", "");
      await expect
        .poll(() => el.evaluate((node) => [...node.querySelectorAll("[pathLength]")].every((p) => getComputedStyle(p).strokeDashoffset === "0px")), {
          message: `${path} ${host}`,
          timeout: 6_000,
        })
        .toBe(true);
    }
  });

  test("the pointer light follows a mouse over the machinery stage", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const stage = page.locator("#machinery .machine-stage");
    await stage.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const light = stage.locator(".plight");
    await expect(light).not.toHaveAttribute("data-on", "");

    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
    await expect(light).toHaveAttribute("data-on", "");
    await expect.poll(() => light.evaluate((el) => parseFloat(el.style.getPropertyValue("--lx")))).toBeGreaterThan(box.width / 3);

    await page.mouse.move(4, 4);
    await expect(light).not.toHaveAttribute("data-on", "");
  });

  test("changing service on the homepage runs a cutting line with the wipe", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const figure = page.locator("#services figure").first();
    await expect(figure.locator(".wipe-line")).toHaveCount(0);
    await page.locator("#services ul li[data-row] a").nth(2).hover();
    await expect(figure.locator(".wipe-line")).toHaveCount(1);
    await expect(page.locator("#services ul li[data-row][data-active]")).toHaveCount(1);
  });
});

test.describe("ambient motion with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("layers stay still, scan lines are hidden and the pointer light never switches on", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const grid = page.locator("#capabilities .backdrop[data-drift]");
    await grid.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    expect(await page.locator('[data-live="on"]').count()).toBe(0);
    expect(await grid.evaluate((el) => getComputedStyle(el, "::before").animationName)).toBe("none");
    await expect(page.locator("#metrics .scan")).toBeHidden();

    const stage = page.locator("#machinery .machine-stage");
    await stage.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
    await page.waitForTimeout(300);
    await expect(stage.locator(".plight")).not.toHaveAttribute("data-on", "");
    await expect(stage.locator(".plight")).toBeHidden();

    // The explorer swaps figures without the cutting line.
    await page.locator("#services ul li[data-row] a").nth(3).hover();
    await expect(page.locator("#services .wipe-line")).toBeHidden();
  });
});

test.describe("ambient motion on touch screens", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("no pointer light on touch", async ({ page }) => {
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    const plate = page.locator('main a[aria-haspopup="dialog"]').first();
    const box = (await plate.boundingBox())!;
    await page.touchscreen.tap(box.x + 10, box.y + 10);
    await page.waitForTimeout(300);
    for (const light of await page.locator(".plight").all()) await expect(light).not.toHaveAttribute("data-on", "");
  });
});

test.describe("active states", () => {
  test("the services overview marks the row being read", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "networkidle" });
    await expect(page.locator("article#laser-cutting")).toHaveAttribute("data-active", "");
    await page.locator("article#steel-structures").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await expect(page.locator("article#steel-structures")).toHaveAttribute("data-active", "");
    await expect(page.locator("main article[data-active]")).toHaveCount(1);
    await expect(page.locator('nav a[href="#steel-structures"]').last()).toHaveAttribute("aria-current", "true");
  });

  test("legal contents mark the section being read", async ({ page }) => {
    await page.goto("/en/privacy", { waitUntil: "networkidle" });
    const toc = page.getByRole("navigation", { name: "On this page" }).locator("div.sticky a");
    await expect(toc.first()).toHaveAttribute("aria-current", "true");

    const third = toc.nth(2);
    await third.click();
    await expect(third).toHaveAttribute("aria-current", "true");
    await expect(page.locator('div.sticky a[aria-current="true"]')).toHaveCount(1);

    // Back above the first section, the first entry is marked again.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(toc.first()).toHaveAttribute("aria-current", "true");
  });

  test("focus shows the same frame as hover", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const link = page.locator("#projects ul li a").first();
    await link.focus();
    const frame = link.locator(".tf-host");
    // Corner marks appear and the accent edge draws for keyboard focus too.
    await expect.poll(() => frame.locator(".tf-c").evaluate((el) => getComputedStyle(el).opacity)).toBe("0.9");
    await expect
      .poll(() => frame.locator(".tf-hl").evaluate((el) => getComputedStyle(el, "::before").transform))
      .toBe("none");
  });
});
