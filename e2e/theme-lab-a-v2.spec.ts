import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, LOCALES, trackErrors } from "./helpers";

/**
 * Theme lab — Option A V2 (Modern Commerce, refined): navigation, the phone
 * menu, both languages, the signature laser illustrations, the motion system,
 * reduced motion, keyboard use and the no-JavaScript fallback. Isolation,
 * noindex, flagged photos and sideways scroll are covered for every option in
 * theme-lab.spec.ts.
 */

const home = (locale: string) => `/theme-lab/${locale}/modern-commerce-a-v2`;
const system = (locale: string) => `${home(locale)}/system`;
const NAV = ["home", "about", "services", "machinery", "projects", "industries", "clients", "contact"];

/** Animations currently attached to a signature illustration and its parts. */
const signatureAnimations = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const svg = document.querySelector(sel);
    return (svg?.getAnimations({ subtree: true }) ?? []).map((a) => ({
      state: a.playState,
      end: a.effect?.getComputedTiming().endTime as number,
      iterations: a.effect?.getComputedTiming().iterations as number,
    }));
  }, selector);

test.describe("A V2 · navigation and layout", () => {
  test("the header lists every main section, and the Services menu opens, lists the six services and closes", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(home("en"), { waitUntil: "networkidle" });
    const nav = page.locator(".a2-nav");
    // Home, About, Services (menu), Capabilities, Projects, Industries, Clients, Contact — each targets a section here.
    const targets = await nav.locator("[data-spy-link]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.spyLink));
    expect(targets).toEqual(NAV);
    for (const id of NAV) await expect(page.locator(`section#${id}`)).toHaveCount(1);
    await expect(page.locator(".a2-head-quote")).toBeVisible();

    const menu = nav.locator("details[data-dropdown]");
    await menu.locator("summary").click();
    await expect(menu.locator(".a2-dd-panel")).toBeVisible();
    await expect(menu.locator(".a2-dd-item")).toHaveCount(6);
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("SUMMARY");
    await menu.locator("summary").click();
    await page.mouse.click(700, 760);
    await expect(menu).not.toHaveAttribute("open");
    expect(errors).toEqual([]);
  });

  test("the active section is marked in the header as the page scrolls, and the header gains its shadow past the hero", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect(page.locator('.a2-nav [data-spy-link="home"]')).toHaveAttribute("data-active", "");
    await page.locator("#projects").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById("projects")!.scrollIntoView({ block: "start" }));
    await expect(page.locator('.a2-nav [data-spy-link="projects"]')).toHaveAttribute("data-active", "");
    await expect(page.locator("html")).toHaveAttribute("data-past-hero", "");
    await expect(page.locator("html")).toHaveAttribute("data-scrolled", "");
  });

  test("the phone menu fills the screen, locks the page, keeps Get a Quote in reach and closes after a choice", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect(page.locator(".a2-head-quote")).toBeVisible();
    const menu = page.locator("details[data-sheet]");
    await menu.locator(":scope > summary").click();
    const sheet = menu.locator(".a2-sheet");
    await expect(sheet).toBeVisible();
    await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
    const box = await sheet.boundingBox();
    const header = await page.locator(".a2-header").boundingBox();
    expect(Math.abs(box!.y - (header!.y + header!.height))).toBeLessThan(2);
    expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    // Large rows, the language switch and the quote button pinned to the bottom of the sheet.
    const rows = await sheet.locator(".a2-sheet-row").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(rows.length).toBe(8);
    for (const h of rows) expect(h).toBeGreaterThanOrEqual(44);
    await expect(sheet.locator(".a2-lang a")).toHaveCount(2);
    await expect(sheet.locator(".a2-sheet-foot a.btn-primary")).toBeInViewport();
    // Services open in place; a link closes the menu.
    await sheet.locator(".a2-sheet-sub > summary").click();
    await expect(sheet.locator(".a2-sheet-sub a.a2-dd-item")).toHaveCount(6);
    await sheet.locator('a[href="#projects"]').click();
    await expect(menu).not.toHaveAttribute("open");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
  });

  test("English and Arabic mirror each other; the language switch keeps the page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(home(locale), { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      const other = locale === "en" ? "ar" : "en";
      const bar = page.locator(".a2-header .a2-lang").first();
      await expect(bar.locator(`a[hreflang="${other}"]`)).toHaveAttribute("href", home(other));
      await expect(bar.locator(`a[hreflang="${locale}"]`)).toHaveAttribute("aria-current", "true");
      // Logical layout: the hero text starts on the reading side.
      const h1 = await page.locator("h1").boundingBox();
      const media = await page.locator(".a2-hero-media").boundingBox();
      expect(locale === "ar" ? h1!.x > media!.x : h1!.x < media!.x).toBe(true);
      // Arabic is never letter-spaced.
      if (locale === "ar") {
        const spaced = await page.evaluate(() => [...document.querySelectorAll("h1, h2, h3, p, a, button")].filter((el) => parseFloat(getComputedStyle(el).letterSpacing) > 0).length);
        expect(spaced).toBe(0);
      }
      await page.goto(system(locale), { waitUntil: "networkidle" });
      await expect(page.locator(".a2-header .a2-lang").first().locator(`a[hreflang="${other}"]`)).toHaveAttribute("href", system(other));
    }
  });

  test("industries keep the company profile's sectors apart from website classifications", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect(page.locator('#industries [data-basis="profile"]')).toHaveCount(4);
    await expect(page.locator('#industries [data-basis="inferred"]')).toHaveCount(4);
    await expect(page.locator("#industries")).toContainText("Named in the company profile");
    await expect(page.locator("#industries")).toContainText("Website classification");
  });

  test("the machinery selector switches the stage without moving the page", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await page.evaluate(() => document.querySelector(".a2-mx-pick:nth-child(1)")!.closest("ul")!.scrollIntoView({ block: "center", behavior: "instant" }));
    const picks = page.locator(".a2-mx-pick");
    await expect(picks).toHaveCount(6);
    // Let the section finish its reveal: Playwright re-scrolls elements that are still moving before it clicks.
    await expect(page.locator("#machinery [data-reveal]").last()).toHaveAttribute("data-shown", "");
    await page.locator("#machinery [data-reveal]").last().evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const before = await page.evaluate(() => scrollY);
    await picks.nth(4).click();
    await expect(picks.nth(4)).toHaveAttribute("aria-current", "true");
    await expect(page.locator(".a2-mx-panel.is-active")).toHaveCount(1);
    await expect(page.locator(".a2-mx-panel").nth(4)).toHaveClass(/is-active/);
    // No jump to the panel's anchor: the choice happens in place.
    expect(await page.evaluate(() => location.hash)).toBe("");
    await page.waitForTimeout(300);
    expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(2);
    // Hidden panels leave the accessibility tree and the tab order.
    await expect(page.locator(".a2-mx-panel").nth(0)).toHaveAttribute("aria-hidden", "true");
  });

  test("client logos switch to their original colours with the toggle", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    const toggle = page.locator("button[data-toggle=colour]");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#client-wall")).toHaveAttribute("data-colour", "");
    await expect.poll(() => page.locator("#client-wall img").first().evaluate((img) => getComputedStyle(img).filter)).toBe("none");
  });

  test("no sideways scroll on the design-system sheet, from phone to desktop", async ({ page }) => {
    for (const width of [360, 390, 834, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const locale of LOCALES) {
        await page.goto(system(locale), { waitUntil: "networkidle" });
        expect(await horizontalOverflow(page), `${locale} at ${width}px`).toBe(0);
      }
    }
  });
});

test.describe("A V2 · signature illustrations and motion", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("laser cutting plays once in view, finishes, and replays on hover", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(home("en"), { waitUntil: "networkidle" });
    expect(await signatureAnimations(page, ".sig-cut")).toEqual([]);
    await page.evaluate(() => document.querySelector(".a2-svc-laser")!.scrollIntoView({ block: "center" }));
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).length).toBeGreaterThan(10);
    const run = await signatureAnimations(page, ".sig-cut");
    // One pass on a shared clock, about 2.5 s, never looping.
    for (const a of run) {
      expect(a.iterations).toBe(1);
      expect(a.end).toBeGreaterThan(1500);
      expect(a.end).toBeLessThanOrEqual(2600);
    }
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished"), { timeout: 5000 }).toBe(true);
    // The finished picture: the part lifted out of the plate.
    expect(await page.locator(".sig-cut .sig-piece").evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
    await page.locator(".a2-svc-laser").hover();
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).some((a) => a.state === "running")).toBe(true);
    // The card turns its edge orange on hover.
    await expect.poll(() => page.locator(".a2-svc-laser").evaluate((el) => getComputedStyle(el).borderColor)).toBe("rgb(241, 95, 34)");
    expect(errors).toEqual([]);
  });

  test("laser engraving plays once in view and replays on keyboard focus", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    const card = page.locator("article:has(.sig-engrave)");
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector(".sig-engrave")!.scrollIntoView({ block: "center" }));
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).length).toBeGreaterThan(4);
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).every((a) => a.state === "finished"), { timeout: 5000 }).toBe(true);
    await card.locator("a.stretch").focus();
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).some((a) => a.state === "running")).toBe(true);
  });

  test("the engraving carries RAWASY's own mark only: no photos, text, part or serial numbers", async ({ page }) => {
    for (const path of [home("en"), system("en")]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const plates = page.locator("svg.sig-engrave");
      expect(await plates.count()).toBeGreaterThan(0);
      for (const plate of await plates.all()) {
        expect(await plate.locator("image, text, foreignObject").count()).toBe(0);
        expect(await plate.locator(".sig-engr path").count()).toBeGreaterThan(4);
        await expect(plate).toHaveAttribute("aria-hidden", "true");
      }
    }
  });

  test("the hero enters, the pointer parallax moves its layers, and ambient light runs only on screen", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect(page.locator(".a2-hero")).toHaveAttribute("data-live", "");
    const card = page.locator(".a2-hero .a2-float").first();
    await page.mouse.move(1300, 300);
    await expect.poll(async () => page.locator(".a2-hero").evaluate((el) => el.style.getPropertyValue("--px"))).not.toBe("");
    await page.waitForTimeout(1000);
    expect(await card.evaluate((el) => getComputedStyle(el).translate)).not.toBe("0px");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator(".a2-hero")).not.toHaveAttribute("data-live", "");
    const glow = await page.locator(".a2-glow").evaluate((el) => el.getAnimations().map((a) => a.playState));
    expect(glow).toEqual(["paused"]);
  });

  test("the design-system sheet replays each signature on demand", async ({ page }) => {
    await page.goto(system("en"), { waitUntil: "networkidle" });
    for (const id of ["demo-cut", "demo-engrave"]) {
      await page.evaluate((i) => document.getElementById(i)!.scrollIntoView({ block: "center" }), id);
      const svg = `#${id} svg.sig`;
      await expect.poll(async () => (await signatureAnimations(page, svg)).length).toBeGreaterThan(4);
      await expect.poll(async () => (await signatureAnimations(page, svg)).every((a) => a.state === "finished"), { timeout: 5000 }).toBe(true);
      await page.locator("section", { has: page.locator(`#${id}`) }).locator("button.sig-replay").click();
      await expect.poll(async () => (await signatureAnimations(page, svg)).some((a) => a.state === "running")).toBe(true);
    }
  });
});

test.describe("A V2 · reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the finished illustrations show at once and nothing animates", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    for (const sel of [".sig-cut", ".sig-engrave"]) {
      await page.evaluate((s) => document.querySelector(s)!.scrollIntoView({ block: "center" }), sel);
      await page.waitForTimeout(400);
      expect(await signatureAnimations(page, sel)).toEqual([]);
      expect(await page.locator(`${sel} .sig-plate`).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
    expect(await page.locator(".sig-cut .sig-piece").evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
    expect(await page.locator(".sig-cut .sig-hole").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await page.locator(".sig-cut .sig-head-in").evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    expect(await page.locator(".sig-engrave .sig-engr").evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
    // No hero entrance, no parallax, no replay buttons on the sheet.
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
    await page.goto(system("en"), { waitUntil: "networkidle" });
    await expect(page.locator("button.sig-replay").first()).toBeHidden();
  });
});

test.describe("A V2 · keyboard", () => {
  test("skip link, header, Services menu, cards, machine selector and colour toggle all work from the keyboard", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    // Past the lab bar to the logo, then along the header.
    let guard = 0;
    while (!(await page.evaluate(() => !!document.activeElement?.closest(".a2-header"))) && guard++ < 20) await page.keyboard.press("Tab");
    await expect(page.locator(".a2-header a[aria-label]").first()).toBeFocused();
    await page.locator(".a2-nav details[data-dropdown] > summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".a2-nav details[data-dropdown]")).toHaveAttribute("open", "");
    await page.keyboard.press("Tab");
    await expect(page.locator(".a2-dd-item").first()).toBeFocused();
    // Leaving the menu with Tab closes it.
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    await expect(page.locator(".a2-nav details[data-dropdown]")).not.toHaveAttribute("open");

    // A focused card lifts and takes its accent edge, as on hover.
    await page.locator(".a2-svc-laser a.stretch").focus();
    await expect.poll(() => page.locator(".a2-svc-laser").evaluate((el) => getComputedStyle(el).translate)).not.toBe("none");
    await expect.poll(() => page.locator(".a2-svc-laser").evaluate((el) => getComputedStyle(el).borderColor)).toBe("rgb(241, 95, 34)");

    await page.locator(".a2-mx-pick").nth(2).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".a2-mx-pick").nth(2)).toHaveAttribute("aria-current", "true");

    await page.locator("button[data-toggle=colour]").focus();
    await page.keyboard.press("Space");
    await expect(page.locator("button[data-toggle=colour]")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("A V2 · without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("everything is shown, the illustrations are finished and the machine stage shows one complete panel", async ({ page }) => {
    await page.goto(home("en"));
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => [...document.querySelectorAll("[data-reveal], [data-enter]")].filter((el) => getComputedStyle(el).opacity === "0").length)).toBe(0);
    expect(await page.locator(".sig-cut .sig-plate").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await page.locator(".sig-engrave .sig-engr").evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
    const shown = await page.locator(".a2-mx-panel").evaluateAll((els) => els.filter((el) => getComputedStyle(el).visibility === "visible").length);
    expect(shown).toBe(1);
    expect(await page.locator(".a2-mx-panel").first().locator(".a2-mx-spec").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    // Script-only controls stay out of the way.
    await expect(page.locator("button[data-toggle=colour]")).toBeHidden();
    // The Services menu is a disclosure, so it still opens.
    await page.locator(".a2-nav details[data-dropdown] > summary").click();
    await expect(page.locator(".a2-dd-item").first()).toBeVisible();
  });
});
