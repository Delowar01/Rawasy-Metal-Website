import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, LOCALES, trackErrors } from "./helpers";
import {
  AMBIENT,
  ambientAnimations,
  expectCycles,
  expectFinished,
  expectPlateFinished,
  inView,
  plateClock,
  plateCount,
  plateLog,
  plateLoop,
  recordPlate,
  signatureAnimations,
  textContrast,
} from "./a2-helpers";

/**
 * Theme lab — Option A V2 (Modern Commerce, refined): navigation, the phone
 * menu, both languages, the hero plate, the signature laser illustrations, the
 * pointer, the light and dark themes, readability, the motion system, reduced
 * motion, touch, keyboard use and the no-JavaScript fallback. Isolation,
 * noindex, flagged photos and sideways scroll are covered for every option in
 * theme-lab.spec.ts.
 */

const home = (locale: string) => `/theme-lab/${locale}/modern-commerce-a-v2`;
const system = (locale: string) => `${home(locale)}/system`;
const NAV = ["home", "about", "services", "machinery", "projects", "industries", "clients", "contact"];

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
      const media = await page.locator(".a2-hero .a2-plate-stage").boundingBox();
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

  test("one laser-cutting and one laser-engraving signature, on the service pages' own artwork", async ({ page }) => {
    // The service pages' drawings: the nesting sheet (Laser Cutting) and the engraved plate (Laser Engraving).
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    const sheet = await page.evaluate(() => [...document.querySelectorAll('svg.line-draw[viewBox="0 0 260 160"] path')].map((p) => p.getAttribute("d")));
    await page.goto("/en/services/laser-engraving", { waitUntil: "networkidle" });
    const plate = await page.evaluate(() => {
      const svg = document.querySelector("svg.engrave .engr-cut")!;
      return { lines: [...svg.querySelectorAll(":scope > path")].map((p) => p.getAttribute("d")), ellipses: svg.querySelectorAll("ellipse").length };
    });
    expect(sheet).toHaveLength(7);

    for (const path of [home("en"), home("ar")]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page.locator("#services .sig-cut")).toHaveCount(1);
      await expect(page.locator("#services .sig-engrave")).toHaveCount(1);
      await expect(page.locator(".sig-cut")).toHaveCount(1);
      await expect(page.locator(".sig-engrave")).toHaveCount(1);
      // The retired concepts are gone: no lifted star part, no medallion or raster scan.
      await expect(page.locator(".sig-piece, .sig-rim, .sig-medallion, .sig-raster")).toHaveCount(0);
      const lab = await page.evaluate(() => ({
        sheet: [...document.querySelectorAll(".sig-cut :is(.sig-nest, .sig-dims, .sig-kerf, .sig-pierces, .sig-ring) path")].map((p) => p.getAttribute("d")),
        lines: [...document.querySelectorAll(".sig-engrave .sig-engr-cut > path[data-g^='l'], .sig-engrave .sig-engr-cut > path[data-g^='c']")].map((p) => p.getAttribute("d")),
        ellipses: document.querySelectorAll(".sig-engrave .sig-engr-cut ellipse").length,
      }));
      // Every line of the service page's nesting sheet is in the signature: nested part, dimensions, lead-in, outline, pierce points, head.
      for (const d of sheet) expect(lab.sheet.join("")).toContain(d!);
      for (const d of plate.lines) expect(lab.lines.join("")).toContain(d!);
      expect(lab.ellipses).toBe(plate.ellipses);
    }
  });

  test("laser cutting plays once in view, finishes, and replays on hover", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(home("en"), { waitUntil: "networkidle" });
    expect(await signatureAnimations(page, ".sig-cut")).toEqual([]);
    await inView(page, ".sig-cut");
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).length).toBeGreaterThan(20);
    const run = await signatureAnimations(page, ".sig-cut");
    // One pass on a shared clock, about 7.6 s, never looping.
    for (const a of run) {
      expect(a.iterations).toBe(1);
      expect(a.end).toBeGreaterThan(6000);
      expect(a.end).toBeLessThanOrEqual(8500);
    }
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    const card = page.locator("article:has(.sig-cut)");
    await card.hover();
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).some((a) => a.state === "running")).toBe(true);
    // The card turns its edge orange on hover.
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).borderColor)).toBe("rgb(241, 95, 34)");
    expect(errors).toEqual([]);
  });

  test("the cutting head follows the part: holes and slot first, then the outer contour from its lead-in, then parks", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await inView(page, ".sig-cut");
    await expect.poll(async () => (await signatureAnimations(page, ".sig-cut")).length).toBeGreaterThan(20);
    const result = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".sig-cut")!;
      root.dispatchEvent(new CustomEvent("sig:replay", { detail: { intro: true } }));
      const anims = root.getAnimations({ subtree: true });
      anims.forEach((a) => a.pause());
      const total = Math.max(...anims.map((a) => a.effect!.getComputedTiming().endTime as number));
      // The part, contour by contour (lead-in and cut), every half unit.
      const contours = [...root.querySelectorAll(".sig-kerf > g")].map((g) =>
        [...g.querySelectorAll<SVGGeometryElement>("path")].flatMap((p) => {
          const length = p.getTotalLength();
          return Array.from({ length: Math.ceil(length / 0.5) + 1 }, (_, i) => p.getPointAtLength(Math.min(length, i * 0.5)));
        }),
      );
      const head = root.querySelector(".sig-head")!;
      const beam = root.querySelector(".sig-hot")!;
      const order: number[] = [];
      let worst = 0;
      let cutting = 0;
      for (let t = 0; t <= total; t += 20) {
        anims.forEach((a) => (a.currentTime = t));
        if (+getComputedStyle(beam).opacity < 0.95) continue;
        const m = new DOMMatrix(getComputedStyle(head).transform);
        let best = Infinity;
        let nearest = -1;
        contours.forEach((points, i) =>
          points.forEach((p) => {
            const d = Math.hypot(p.x - m.e, p.y - m.f);
            if (d < best) [best, nearest] = [d, i];
          }),
        );
        worst = Math.max(worst, best);
        cutting++;
        if (order[order.length - 1] !== nearest) order.push(nearest);
      }
      anims.forEach((a) => a.finish());
      return { order, worst, cutting, contours: contours.length };
    });
    // With the beam on, the head is always on the part's geometry (within the kerf), one contour after another.
    expect(result.contours).toBe(5);
    expect(result.cutting).toBeGreaterThan(150);
    expect(result.worst).toBeLessThan(0.8);
    expect(result.order).toEqual([0, 1, 2, 3, 4]);
    await expectFinished(page, ["cut"]);
  });

  test("laser engraving plays once in view, replays on keyboard focus, and develops groove by groove as the laser moves", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    expect(await signatureAnimations(page, ".sig-engrave")).toEqual([]);
    const card = page.locator("article:has(.sig-engrave)");
    await inView(page, ".sig-engrave");
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).length).toBeGreaterThan(20);
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    // Keyboard focus on its card replays it.
    await card.locator("a.stretch").focus();
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).some((a) => a.state === "running")).toBe(true);
    await expect.poll(async () => (await signatureAnimations(page, ".sig-engrave")).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
    const result = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".sig-engrave")!;
      root.dispatchEvent(new CustomEvent("sig:replay", { detail: { intro: true } }));
      const anims = root.getAnimations({ subtree: true });
      anims.forEach((a) => a.pause());
      const total = Math.max(...anims.map((a) => a.effect!.getComputedTiming().endTime as number));
      const grooves = [...root.querySelectorAll(".sig-engr-cut [pathLength]")];
      const head = root.querySelector(".sig-head")!;
      const done: number[] = [];
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k <= 20; k++) {
        anims.forEach((a) => (a.currentTime = (total * k) / 20));
        done.push(grooves.filter((g) => parseFloat(getComputedStyle(g).strokeDashoffset) < 0.001).length);
        const m = new DOMMatrix(getComputedStyle(head).transform);
        xs.push(m.e);
        ys.push(m.f);
      }
      anims.forEach((a) => a.finish());
      return { done, grooves: grooves.length, xs, ys, total };
    });
    expect(result.total).toBeGreaterThan(6000);
    expect(result.total).toBeLessThanOrEqual(8000);
    // None engraved at first, all at the end, never fewer as time goes on, in many visible steps.
    expect(result.done[0]).toBe(0);
    expect(result.done[result.done.length - 1]).toBe(result.grooves);
    for (let i = 1; i < result.done.length; i++) expect(result.done[i]).toBeGreaterThanOrEqual(result.done[i - 1]);
    expect(new Set(result.done).size).toBeGreaterThan(6);
    // The laser works across the whole plate.
    expect(Math.max(...result.xs) - Math.min(...result.xs)).toBeGreaterThan(250);
    expect(Math.max(...result.ys) - Math.min(...result.ys)).toBeGreaterThan(150);
    await expectFinished(page, ["engrave"]);
  });

  test("the finished pictures persist, in English and Arabic; the plate mirrors in Arabic as on its service page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(home(locale), { waitUntil: "networkidle" });
      for (const sel of [".sig-cut", ".sig-engrave"]) {
        await inView(page, sel);
        await expect.poll(async () => (await signatureAnimations(page, sel)).length).toBeGreaterThan(20);
      }
      for (const sel of [".sig-cut", ".sig-engrave"]) {
        await expect.poll(async () => (await signatureAnimations(page, sel)).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
      }
      await page.waitForTimeout(600);
      await expectFinished(page);
      expect(await page.locator(".sig-engrave .sig-art").evaluate((el) => getComputedStyle(el).scale)).toBe(locale === "ar" ? "-1 1" : "none");
      expect(await page.locator(".sig-cut svg").evaluate((el) => getComputedStyle(el).scale)).toBe("none");
    }
  });

  test("large enough to read: each illustration fills most of its stage and the cut line stays bold, on desktop and phone", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(home("en"), { waitUntil: "networkidle" });
      const sizes = await page.evaluate(() =>
        [...document.querySelectorAll("#services .a2-stage-sig")].map((stage) => {
          const s = stage.getBoundingClientRect();
          const sig = stage.querySelector(".sig")!.getBoundingClientRect();
          const svg = stage.querySelector("svg")!;
          const kerf = svg.querySelector(".sig-kerf");
          return {
            share: (sig.width * sig.height) / (s.width * s.height),
            kerf: kerf ? parseFloat(getComputedStyle(kerf).strokeWidth) * (svg.getBoundingClientRect().width / 260) : null,
          };
        }),
      );
      expect(sizes).toHaveLength(2);
      for (const { share } of sizes) expect(share, `${width}px`).toBeGreaterThan(0.5);
      expect(sizes[0].kerf!, `${width}px`).toBeGreaterThanOrEqual(2);
    }
  });

  test("no photos, text, brands or serial numbers in the engraving; the flagged nameplates photo stays off", async ({ page }) => {
    for (const path of [home("en"), home("ar"), system("en")]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const plates = page.locator(".sig-engrave");
      expect(await plates.count()).toBeGreaterThan(0);
      for (const plate of await plates.all()) {
        expect(await plate.locator("img, image, text, foreignObject").count()).toBe(0);
        expect((await plate.textContent())!.trim()).toBe("");
        await expect(plate).toHaveAttribute("aria-hidden", "true");
      }
      const flagged = await page.evaluate(() => [...document.images].filter((img) => `${img.src} ${img.srcset}`.includes("engraving-nameplates")).length);
      expect(flagged).toBe(0);
    }
  });

  test("the hero enters, the mouse tilts the plate, and ambient light runs only on screen", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect(page.locator(".a2-hero")).toHaveAttribute("data-live", "");
    const tilt = page.locator(".a2-hero .a2-plate-tilt");
    const rest = await tilt.evaluate((el) => getComputedStyle(el).transform);
    const stage = (await page.locator(".a2-hero .a2-plate-stage").boundingBox())!;
    await page.mouse.move(stage.x + stage.width * 0.85, stage.y + stage.height * 0.2, { steps: 5 });
    await expect.poll(async () => tilt.evaluate((el) => el.style.transform)).toContain("rotateY");
    await page.waitForTimeout(1100);
    expect(await tilt.evaluate((el) => getComputedStyle(el).transform)).not.toBe(rest);
    expect(await page.locator(".a2-hero .a2-plate-shine > span").evaluate((el) => el.style.translate)).not.toBe("");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator(".a2-hero")).not.toHaveAttribute("data-live", "");
    // The plate's hot points pause off screen; the hero's own glow is still (the site-wide ambient carries the motion).
    const pulse = await page.locator(".a2-hero .a2-plate-pulse > span").first().evaluate((el) => el.getAnimations().map((a) => a.playState));
    expect(pulse).toEqual(["paused"]);
    expect(await page.locator(".a2-glow").evaluate((el) => el.getAnimations().length)).toBe(0);
  });

  test("the design-system sheet shows each signature first, with a replay and still frames of its initial, active and finished states", async ({ page }) => {
    await page.goto(system("en"), { waitUntil: "networkidle" });
    // The three signature blocks lead the sheet: the hero plate, then the two laser illustrations.
    const firstBlocks = await page.locator("main > section").evaluateAll((els) => els.slice(0, 3).map((el) => el.querySelector("[id^=demo-]")?.id));
    expect(firstBlocks).toEqual(["demo-plate", "demo-cut", "demo-engrave"]);
    // The plate: the hero's loop with a replay from the start, and still frames with no, some and every opening cut.
    await inView(page, "#demo-plate");
    await expect.poll(async () => (await signatureAnimations(page, "#demo-plate .a2-plate")).length).toBeGreaterThan(60);
    await expect(page.locator("#demo-plate .a2-plate-read [dir=ltr]")).toHaveText("07/07", { timeout: 12000 });
    await page.locator("section", { has: page.locator("#demo-plate") }).locator("button.sig-replay").click();
    // Back to the first cycle: the plate rises again and the count starts from zero.
    await expect(page.locator("#demo-plate .a2-plate-read [dir=ltr]")).toHaveText("00/07");
    await expect(page.locator("#demo-plate .a2-plate")).toHaveAttribute("data-cycle", "1");
    expect((await plateClock(page, "#demo-plate .a2-plate")).time).toBeLessThan(1150);
    await expect.poll(async () => (await plateLoop(page, "#demo-plate .a2-plate")).every((a) => a.state === "running")).toBe(true);
    const cuts = await page
      .locator("section", { has: page.locator("#demo-plate") })
      .locator(".a2-plate[data-frozen]")
      .evaluateAll((els) => els.map((el) => [...el.querySelectorAll("[data-slug]")].filter((g) => parseFloat(getComputedStyle(g).opacity) < 0.5 || getComputedStyle(g).clipPath.includes("100%")).length));
    expect(cuts).toEqual([0, 4, 10]);
    for (const [id, part] of [
      ["demo-cut", ".sig-kerf .sig-path"],
      ["demo-engrave", ".sig-engr-cut [pathLength]"],
    ] as const) {
      await inView(page, `#${id}`);
      const sig = `#${id} .sig`;
      await expect.poll(async () => (await signatureAnimations(page, sig)).length).toBeGreaterThan(20);
      await expect.poll(async () => (await signatureAnimations(page, sig)).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
      await page.locator("section", { has: page.locator(`#${id}`) }).locator("button.sig-replay").click();
      await expect.poll(async () => (await signatureAnimations(page, sig)).some((a) => a.state === "running")).toBe(true);
      // Still frames: nothing drawn at first, part of it while active, everything when finished.
      const stills = await page
        .locator("section", { has: page.locator(`#${id}`) })
        .locator("[data-frozen]")
        .evaluateAll((els, sel) => els.map((el) => [...el.querySelectorAll(sel)].filter((p) => parseFloat(getComputedStyle(p).strokeDashoffset) < 0.001).length), part);
      expect(stills).toHaveLength(3);
      expect(stills[0]).toBe(0);
      expect(stills[1]).toBeGreaterThan(0);
      expect(stills[2]).toBeGreaterThan(stills[1]);
    }
  });
});

test.describe("A V2 · signatures on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, contextOptions: { reducedMotion: "no-preference" } });

  test("each signature plays once as it enters the viewport; touch and scrolling back do not replay it", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    for (const sel of [".sig-cut", ".sig-engrave"]) {
      expect(await signatureAnimations(page, sel)).toEqual([]);
      await inView(page, sel);
      await expect.poll(async () => (await signatureAnimations(page, sel)).length).toBeGreaterThan(20);
      await expect.poll(async () => (await signatureAnimations(page, sel)).every((a) => a.state === "finished"), { timeout: 12000 }).toBe(true);
      await page.evaluate((s) => document.querySelector(s)!.closest("[data-sig-host]")!.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" })), sel);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await inView(page, sel);
      await page.waitForTimeout(600);
      expect((await signatureAnimations(page, sel)).every((a) => a.state === "finished"), sel).toBe(true);
    }
    await expectFinished(page);
  });
});

test.describe("A V2 · reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the finished illustrations show at once and nothing animates", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(home(locale), { waitUntil: "networkidle" });
      for (const sel of [".sig-cut", ".sig-engrave"]) {
        await inView(page, sel);
        await page.waitForTimeout(400);
        expect(await signatureAnimations(page, sel)).toEqual([]);
      }
      await expectFinished(page);
      await expectPlateFinished(page);
      // The hero plate does not loop: no cycle, no animation, the finished plate held.
      await page.waitForTimeout(1200);
      expect(await page.locator(".a2-hero .a2-plate").getAttribute("data-cycle")).toBeNull();
      expect(await signatureAnimations(page, ".a2-hero .a2-plate")).toEqual([]);
      await expectPlateFinished(page);
      // No hero entrance, no parallax, no signature runs; and the system cursor stays.
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
      await page.mouse.move(700, 400);
      await page.mouse.move(720, 420);
      await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on");
      expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).cursor)).not.toBe("none");
    }
    // The sheet's still frames are still frames; the replay buttons have nothing to play.
    await page.goto(system("en"), { waitUntil: "networkidle" });
    await expect(page.locator("button.sig-replay").first()).toBeHidden();
    await expect(page.locator("[data-frozen]")).toHaveCount(9);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
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
    const laser = page.locator("article:has(.sig-cut)");
    await laser.locator("a.stretch").focus();
    await expect.poll(() => laser.evaluate((el) => getComputedStyle(el).translate)).not.toBe("none");
    await expect.poll(() => laser.evaluate((el) => getComputedStyle(el).borderColor)).toBe("rgb(241, 95, 34)");

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
    await expectFinished(page);
    await expectPlateFinished(page);
    await expect(page.locator(".a2-cursor")).toBeHidden();
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

test.describe("A V2 · hero plate", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });
  const plate = ".a2-hero .a2-plate";

  test("each cycle cuts in order — bolt holes, the star, the slot, the perforation rows — holds the finished plate, then resets to the blank plate", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect(page.locator(plate)).toHaveAttribute("data-cycle", "1");
    // The finished plate holds, the laser off and the count complete.
    const read = page.locator(".a2-hero .a2-plate-read");
    await expect(read.locator("[dir=ltr]")).toHaveText("07/07", { timeout: 12000 });
    await expect(read).not.toHaveAttribute("data-running", "", { timeout: 4000 });
    await expectPlateFinished(page);
    // Hovering the plate reads it; it does not restart the cycle.
    const before = await plateClock(page, plate);
    await page.locator(plate).hover();
    await page.waitForTimeout(500);
    const after = await plateClock(page, plate);
    expect(after.cycle).toBe(before.cycle);
    expect(after.time).toBeGreaterThan(before.time + 300);

    // One clock for the whole cycle: step through it and read which openings are cut.
    const opened = (time: number) =>
      page.evaluate(
        ([sel, t]) => {
          const root = document.querySelector(sel)!;
          root
            .getAnimations({ subtree: true })
            .filter((a) => a.constructor === Animation)
            .forEach((a) => {
              a.pause();
              a.currentTime = t;
            });
          return [...root.querySelectorAll<HTMLElement>("[data-slug]")]
            .filter((g) => parseFloat(getComputedStyle(g).opacity) < 0.5 || getComputedStyle(g).clipPath.includes("100%"))
            .map((g) => g.dataset.slug);
        },
        [plate, time] as const,
      );
    expect(await opened(0)).toEqual([]);
    expect(await opened(1100)).toEqual([]);
    expect(await opened(2600)).toEqual(["h0", "h1", "h2", "h3"]);
    expect(await opened(3700)).toEqual(["h0", "h1", "h2", "h3", "star"]);
    expect(await opened(4200)).toEqual(["h0", "h1", "h2", "h3", "star", "slot", "r0", "r1"]);
    expect(await opened(5300)).toHaveLength(10);
    expect(await opened(9300)).toHaveLength(10);
    // The reset closes every opening and takes the measurements away: the cycle ends on the frame it starts with.
    expect(await opened(9900)).toEqual([]);
    const blank = await page.evaluate((sel) => {
      const root = document.querySelector(sel)!;
      const css = (el: Element) => getComputedStyle(el);
      return {
        dims: [...root.querySelectorAll(".a2-plate-dim, .a2-plate-label")].map((d) => css(d).opacity),
        nodes: [...root.querySelectorAll(".a2-plate-node, .a2-plate-pulse")].map((n) => css(n).opacity),
        laser: [...root.querySelectorAll(".a2-plate-hot, .a2-plate-pierce")].map((n) => css(n).opacity),
      };
    }, plate);
    expect(new Set([...blank.dims, ...blank.nodes, ...blank.laser])).toEqual(new Set(["0"]));
    // Every animation of the loop spans exactly one 10 s cycle.
    const runs = await plateLoop(page, plate);
    expect(runs.length).toBeGreaterThan(60);
    expect(new Set(runs.map((a) => Math.round(a.end)))).toEqual(new Set([10000]));
    expect(runs.every((a) => a.iterations === 1)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("the whole sequence repeats every 10 s, start to start, without drifting; the readout counts each cycle and resets; nothing shifts", async ({ page }) => {
    test.setTimeout(75_000);
    const errors = trackErrors(page);
    await recordPlate(page);
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect.poll(async () => (await plateLog(page)).cycles.length, { timeout: 45_000, intervals: [1000] }).toBeGreaterThanOrEqual(4);
    const log = await plateLog(page);
    expectCycles(log, 4);
    expect(await horizontalOverflow(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test("off screen, or in a hidden tab, the loop rests where it is, and carries on from the same frame when it returns", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    const read = page.locator(".a2-hero .a2-plate-read");
    // While the laser traces the star.
    await page.waitForFunction(() => document.querySelector(".a2-hero .a2-plate-read [dir=ltr]")?.textContent === "05/07", null, { polling: "raf", timeout: 12000 });
    // Scrolled away: every animation of the loop pauses, the count and the laser light hold, the time stands still.
    await page.evaluate(() => document.querySelector("#contact")!.scrollIntoView({ behavior: "instant", block: "start" }));
    await expect.poll(async () => (await plateLoop(page, plate)).filter((a) => a.state !== "paused").length).toBe(0);
    const rested = await plateClock(page, plate);
    const text = await read.locator("[dir=ltr]").textContent();
    await expect(read).not.toHaveAttribute("data-running");
    // The count is the one for the frame it rests at, not one step behind.
    const resting = await plateCount(page, plate);
    expect(resting.text).toBe(resting.expected);
    await page.waitForTimeout(1500);
    expect(await plateClock(page, plate)).toEqual(rested);
    expect(await read.locator("[dir=ltr]").textContent()).toBe(text);
    // Back on screen: the same cycle carries on from the frame it rested at.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(async () => (await plateClock(page, plate)).state).toBe("running");
    const resumed = await plateClock(page, plate);
    expect(resumed.cycle).toBe(rested.cycle);
    expect(resumed.time).toBeGreaterThanOrEqual(rested.time);
    expect(resumed.time).toBeLessThan(rested.time + 1000);
    expect((await plateLoop(page, plate)).every((a) => a.state === "running")).toBe(true);
    await expect(read).toHaveAttribute("data-running", "");
    await expect.poll(async () => { const c = await plateCount(page, plate); return c.text === c.expected; }).toBe(true);
    // A hidden page rests it too.
    const visibility = (state: "hidden" | "visible") =>
      page.evaluate((v) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
    await visibility("hidden");
    await expect.poll(async () => (await plateClock(page, plate)).state).toBe("paused");
    await visibility("visible");
    await expect.poll(async () => (await plateClock(page, plate)).state).toBe("running");
  });

  test("the mouse tilts the plate and reads X / Y while the loop carries on underneath; the live count returns when it leaves", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect(page.locator(plate)).toHaveAttribute("data-cycle", "1");
    const read = page.locator(".a2-hero .a2-plate-read");
    const box = (await page.locator(`${plate} svg`).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await expect(read).toHaveAttribute("data-pointer", "");
    await expect(read.locator("[dir=ltr]")).toHaveText(/^X \d{3}\.\d · Y \d{3}\.\d$/);
    await expect.poll(async () => page.locator(".a2-hero .a2-plate-tilt").evaluate((el) => el.style.transform)).toContain("rotateY");
    // The pointer stays on the plate through the reset and into the next cycle: the reading holds, the light and
    // the loop carry on.
    await page.waitForFunction((sel) => document.querySelector(sel)!.getAttribute("data-cycle") === "2", plate, { polling: "raf", timeout: 15000 });
    await expect(read).toHaveAttribute("data-running", "");
    await expect(read).toHaveAttribute("data-pointer", "");
    await expect(read.locator("[dir=ltr]")).toHaveText(/^X /);
    // Leaving early in the new cycle shows its count (reset to zero), not the count the pointer covered.
    await page.mouse.move(20, 400, { steps: 2 });
    await expect(read).not.toHaveAttribute("data-pointer");
    await expect(read.locator("[dir=ltr]")).toHaveText("00/07");
    // ... and it carries on counting.
    await expect(read.locator("[dir=ltr]")).toHaveText(/^0[1-7]\/07$/, { timeout: 3000 });
  });

  test("Arabic: the same loop; the plate is an object, never mirrored, its readout words in the Arabic face with no letter-spacing", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = trackErrors(page);
    await recordPlate(page);
    await page.goto(home("ar"), { waitUntil: "networkidle" });
    expect(await page.locator(plate).evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
    const words = await page.locator(".a2-hero .a2-plate-read :is(.a2-plate-part, .a2-plate-seq)").evaluateAll((els) =>
      els.map((el) => ({ spacing: getComputedStyle(el).letterSpacing, font: getComputedStyle(el).fontFamily })),
    );
    expect(words).toHaveLength(2);
    for (const w of words) {
      expect(["normal", "0px"]).toContain(w.spacing);
      expect(w.font).not.toMatch(/^ui-monospace/);
    }
    await expect.poll(async () => (await plateLog(page)).cycles.length, { timeout: 25_000, intervals: [1000] }).toBeGreaterThanOrEqual(2);
    expectCycles(await plateLog(page), 2);
    expect(await horizontalOverflow(page)).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe("A V2 · hero plate on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, contextOptions: { reducedMotion: "no-preference" } });

  test("the same 10 s loop once the plate is in view; a tap never reads X / Y; the readout never overflows and nothing shifts", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = trackErrors(page);
    await recordPlate(page);
    await page.goto(home("en"), { waitUntil: "networkidle" });
    // Below the fold on a phone: the first cycle waits until half the plate is in view.
    await page.waitForTimeout(600);
    expect(await page.locator(".a2-hero .a2-plate").getAttribute("data-cycle")).toBeNull();
    await page.evaluate(() => document.querySelector(".a2-hero .a2-plate")!.scrollIntoView({ behavior: "instant", block: "center" }));
    await expect(page.locator(".a2-hero .a2-plate")).toHaveAttribute("data-cycle", "1");
    const read = page.locator(".a2-hero .a2-plate-read");
    const fits = () => read.evaluate((el) => ({ over: el.scrollWidth - el.clientWidth, height: Math.round(el.getBoundingClientRect().height) }));
    const counting = await fits();
    await page.locator(".a2-hero .a2-plate").tap();
    await expect(read).not.toHaveAttribute("data-pointer");
    await expect.poll(async () => (await plateLog(page)).cycles.length, { timeout: 25_000, intervals: [1000] }).toBeGreaterThanOrEqual(2);
    expectCycles(await plateLog(page), 2);
    expect(await fits()).toEqual(counting);
    expect(counting.over).toBeLessThanOrEqual(0);
    expect(await horizontalOverflow(page)).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe("A V2 · pointer", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("a laser point and a precision ring: active over links and cards, a crosshair on the plate, tighter when pressed", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    // The system cursor stays until the mouse moves.
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on");
    await page.mouse.move(400, 420);
    await page.mouse.move(420, 440);
    await expect(page.locator("html")).toHaveAttribute("data-cursor-on", "");
    const cursor = page.locator(".a2-cursor:not(.a2-cursor-spec)");
    await expect(cursor).toHaveAttribute("data-shown", "");
    await expect(cursor).toHaveAttribute("aria-hidden", "true");
    // The point sits exactly on the mouse.
    const dot = (await page.locator(".a2-cursor-dot").boundingBox())!;
    expect(Math.round(dot.x + dot.width / 2)).toBe(420);
    expect(Math.round(dot.y + dot.height / 2)).toBe(440);

    const button = page.locator(".a2-hero .btn-primary");
    await button.hover();
    await expect(cursor).toHaveAttribute("data-state", "active");
    expect(await button.evaluate((el) => getComputedStyle(el).cursor)).toBe("none");
    await page.mouse.down();
    await expect(cursor).toHaveAttribute("data-press", "");
    await page.mouse.up();
    await expect(cursor).not.toHaveAttribute("data-press");

    // Over the plate while it holds the finished cut. The click above followed the button's link down to #contact,
    // where the plate's loop rests: back to the hero, where it carries on.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.locator(".a2-hero .a2-plate-read [dir=ltr]")).toHaveText("07/07", { timeout: 12000 });
    await page.locator(".a2-hero .a2-plate").hover();
    await expect(cursor).toHaveAttribute("data-state", "plate");
    await page.locator("#services article:has(.sig-cut)").hover();
    await expect(cursor).toHaveAttribute("data-state", "active");

    // The lab bar is preview chrome: the system cursor there.
    const labLink = page.locator(".lab-bar a").first();
    await labLink.hover();
    await expect(cursor).not.toHaveAttribute("data-shown");
    expect(await labLink.evaluate((el) => getComputedStyle(el).cursor)).not.toBe("none");
  });

  test("text fields keep the I-beam, and keyboard focus never meets the pointer", async ({ page }) => {
    await page.goto(system("en"), { waitUntil: "networkidle" });
    await page.mouse.move(300, 300);
    await page.mouse.move(320, 320);
    const field = page.locator("input.field[name=name]");
    await field.scrollIntoViewIfNeeded();
    await field.hover();
    await expect(page.locator(".a2-cursor:not(.a2-cursor-spec)")).not.toHaveAttribute("data-shown");
    expect(await field.evaluate((el) => getComputedStyle(el).cursor)).toBe("text");
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest(".a2-cursor"))).toBe(false);
    }
  });
});

test.describe("A V2 · touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, contextOptions: { reducedMotion: "no-preference" } });

  test("no custom pointer on touch screens: the system cursor rules and taps work as usual", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await page.locator(".a2-hero .btn-secondary").tap();
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on");
    await expect(page.locator(".a2-cursor")).toBeHidden();
    expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).cursor)).not.toBe("none");
  });
});

test.describe("A V2 · light and dark", () => {
  test("?theme= chooses and remembers a theme, the switch changes it in place, and the website's own theme is untouched", async ({ page }) => {
    await page.goto(`${home("en")}?theme=dark`, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(19, 24, 32)");
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const light = page.locator(".a2-header [role=group] button").first();
    await light.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(light).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("rawasy-lab-a2-theme"))).toBe("light");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(244, 244, 241)");
    // The lab keeps its own key: the website's theme choice is never written (checked on a page in the previous design,
    // which has no custom pointer).
    await page.goto(`${home("en")}?theme=dark`, { waitUntil: "networkidle" });
    // The services overview (About moved to the Modern Commerce design in Stage TM-2.3).
    await page.goto("/en/services", { waitUntil: "networkidle" });
    expect(await page.evaluate(() => localStorage.getItem("rawasy-theme"))).toBeNull();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".a2-cursor")).toHaveCount(0);
  });

  test("text stays readable (WCAG AA) in both themes and both languages", async ({ page }) => {
    const selectors = [
      "h1",
      ".a2-hero .t-lead",
      ".a2-hero .eyebrow",
      ".a2-trust li",
      ".a2-talk",
      ".a2-spec-cell .text-ink-2",
      ".a2-plate-read",
      ".a2-quick",
      "main h2",
      "main .t-small",
      "main .tag",
      ".a2-ind .text-ink-2",
      ".contact-row .text-ink-2",
      ".a2-footer p",
      ".a2-footer a",
    ];
    for (const theme of ["light", "dark"]) {
      for (const locale of LOCALES) {
        await page.goto(`${home(locale)}?theme=${theme}`, { waitUntil: "networkidle" });
        const low: string[] = [];
        for (const sel of selectors) {
          for (const r of await textContrast(page, sel)) if (r.ratio < r.need) low.push(`${sel} “${r.text}” ${r.ratio}:1`);
        }
        expect(low, `${locale} ${theme}`).toEqual([]);
      }
    }
  });

  test("no sideways scroll from 360 to 1920 px, in both languages and both themes", async ({ page }) => {
    for (const width of [360, 390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const locale of LOCALES) {
        for (const theme of ["light", "dark"]) {
          await page.goto(`${home(locale)}?theme=${theme}`, { waitUntil: "load" });
          expect(await horizontalOverflow(page), `${locale} ${theme} at ${width}px`).toBe(0);
        }
      }
    }
  });

  test("the ambient layers stay behind the content and never catch the pointer", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    const ambient = await page.evaluate(() => {
      const layer = document.querySelector(".a2-hero-ambient")!;
      const h1 = document.querySelector("h1")!.getBoundingClientRect();
      const footer = getComputedStyle(document.querySelector(".a2-footer")!, "::before");
      return {
        hidden: layer.getAttribute("aria-hidden"),
        events: getComputedStyle(layer).pointerEvents,
        z: getComputedStyle(layer).zIndex,
        top: document.elementFromPoint(h1.x + h1.width / 2, h1.y + h1.height / 2)?.closest("h1") !== null,
        footer: [footer.pointerEvents, footer.zIndex],
        grid: [getComputedStyle(document.querySelector(".a2-plate-grid")!).zIndex],
      };
    });
    expect(ambient).toEqual({ hidden: "true", events: "none", z: "-1", top: true, footer: ["none", "-1"], grid: ["-1"] });
  });
});

/**
 * The lowest contrast between a text and any single pixel behind it (not an average): everything the element draws
 * itself is hidden (its text, icons and decorations; its own background stays), the ambient is held at its strongest
 * (the surface at full breath, the light band centred behind the text, on the dot grid), and every pixel of the
 * text's box is compared with the text colour.
 */
async function worstPixelContrast(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await el.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(250);
  const info = await el.evaluate((node, sel) => {
    // Read the text's colour and size first: the computed style is live, and the text is hidden below.
    const cs = getComputedStyle(node);
    const text = { color: cs.color, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight) };
    const r = node.getBoundingClientRect();
    const amb = document.querySelector(sel)!;
    for (const a of amb.getAnimations({ subtree: true })) {
      a.pause();
      // The breathing at full strength (opacity 1); the drift at its end.
      a.currentTime = (a as CSSAnimation).animationName === "a2-amb-breathe" ? 28000 : 32000;
    }
    const band = amb.querySelector<HTMLElement>(".a2-ambient-sweep")!;
    band
      .getAnimations()
      .filter((a) => (a as CSSAnimation).animationName === "a2-amb-sweep")
      .forEach((a) => a.cancel());
    const w = band.getBoundingClientRect().width;
    // Its drift (shared with the surface) stays; the step is chosen so the band's centre lands on the text's centre.
    const drift = parseFloat(getComputedStyle(band).translate) || 0;
    band.style.transform = `translateX(${Math.round((r.x + r.width / 2 - w / 2 - drift) / 24) * 24}px)`;
    node.style.setProperty("color", "transparent", "important");
    node.querySelectorAll<HTMLElement | SVGElement>("*").forEach((c) => c.style.setProperty("visibility", "hidden", "important"));
    if (!document.getElementById("px-probe")) {
      const style = document.createElement("style");
      style.id = "px-probe";
      // A reading zone's ::before is the background under test, not a decoration.
      style.textContent = "[data-px-probe]:not(.a2-read)::before, [data-px-probe]::after { visibility: hidden !important; }";
      document.head.append(style);
    }
    node.setAttribute("data-px-probe", "");
    return { ...text, box: { x: r.x, y: r.y, width: r.width, height: r.height } };
  }, AMBIENT);
  await page.waitForTimeout(150);
  const shot = await page.screenshot({ clip: info.box });
  const result = await page.evaluate(
    async ({ png, color }) => {
      const lum = ([r, g, b]: number[]) => {
        const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r / 255) + 0.7152 * f(g / 255) + 0.0722 * f(b / 255);
      };
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      const probe = document.createElement("canvas").getContext("2d")!;
      probe.fillStyle = color;
      probe.fillRect(0, 0, 1, 1);
      const text = lum([...probe.getImageData(0, 0, 1, 1).data]);
      let worst = Infinity;
      for (let i = 0; i < data.length; i += 4) {
        const bg = lum([data[i], data[i + 1], data[i + 2]]);
        worst = Math.min(worst, (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05));
      }
      return Math.round(worst * 100) / 100;
    },
    { png: shot.toString("base64"), color: info.color },
  );
  const large = info.size >= 24 || (info.size >= 18.66 && info.weight >= 700);
  return { ratio: result, need: large ? 3 : 4.5 };
}

test.describe("A V2 · background motion", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("one fixed ambient sits behind every section, hidden from assistive technology and out of the pointer's way", async ({ page }) => {
    for (const locale of LOCALES) {
      for (const path of [home(locale), system(locale)]) {
        await page.goto(path, { waitUntil: "networkidle" });
        const layer = await page.evaluate((sel) => {
          const live = [...document.querySelectorAll<HTMLElement>(sel)];
          const el = live[0];
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const h1 = document.querySelector("h1")!.getBoundingClientRect();
          const probes = [
            [4, innerHeight - 4],
            [innerWidth / 2, innerHeight / 2],
          ].map(([x, y]) => document.elementFromPoint(x, y)?.closest(".a2-ambient") ?? null);
          return {
            count: live.length,
            hidden: el.getAttribute("aria-hidden"),
            position: cs.position,
            z: cs.zIndex,
            events: cs.pointerEvents,
            fills: [r.x, r.y, r.width, r.height].map(Math.round).join() === [0, 0, document.documentElement.clientWidth, innerHeight].join(),
            // One opaque surface: the page colour, the micro-dots and the three colour fields; the container paints nothing.
            surface: (() => {
              const field = getComputedStyle(el.querySelector(".a2-ambient-field")!);
              return (
                cs.backgroundImage === "none" &&
                (field.backgroundImage.match(/radial-gradient/g) ?? []).length === 4 &&
                field.backgroundColor === getComputedStyle(el.parentElement!).backgroundColor
              );
            })(),
            layers: [...el.children].map((c) => c.className),
            isolated: getComputedStyle(el.parentElement!).isolation,
            h1OnTop: document.elementFromPoint(h1.x + h1.width / 2, h1.y + h1.height / 2)?.closest("h1") !== null,
            hits: probes.filter(Boolean).length,
          };
        }, AMBIENT);
        expect(layer, path).toEqual({
          count: 1,
          hidden: "true",
          position: "fixed",
          z: "-1",
          events: "none",
          fills: true,
          surface: true,
          layers: ["a2-ambient-field", "a2-ambient-sweep"],
          isolated: "isolate",
          h1OnTop: true,
          hits: 0,
        });
      }
    }
  });

  test("two layers move, in whole-pixel steps: the surface drifting and breathing, the light every 26 s one dot column at a time", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(home(locale), { waitUntil: "networkidle" });
      const anims = await ambientAnimations(page);
      const drift = locale === "ar" ? "a2-amb-drift-rtl" : "a2-amb-drift";
      expect(anims.map((a) => a.name).sort()).toEqual(["a2-amb-breathe", drift, drift, "a2-amb-sweep"]);
      // Two moving (composited) layers: the surface (dots and colour) and the light band, which drifts with it.
      expect([...new Set(anims.map((a) => a.target))].sort()).toEqual(["a2-ambient-field", "a2-ambient-sweep"]);
      for (const a of anims) {
        expect(a.state, a.name).toBe("running");
        expect(a.iterations, a.name).toBe(Infinity);
        expect(a.duration, a.name).toBe(a.name === "a2-amb-sweep" ? 26000 : a.name === "a2-amb-breathe" ? 28000 : 32000);
        // The light restarts off screen (reversed in Arabic, so it enters from the reading side); the colour goes back and forth.
        expect(a.direction, a.name).toBe(a.name === "a2-amb-sweep" ? (locale === "ar" ? "reverse" : "normal") : "alternate");
      }
      // Sampled across their cycles: the surface sits on whole pixels (within 48 × 24 px), the light on the 24 px dot grid,
      // and the light drifts exactly with the surface, so its dots stay on the surface's dots.
      const samples = await page.evaluate((sel) => {
        const amb = document.querySelector(sel)!;
        const field = amb.querySelector(".a2-ambient-field")!;
        const band = amb.querySelector(".a2-ambient-sweep")!;
        const shift = (el: Element) => {
          const t = getComputedStyle(el).translate;
          return t === "none" ? [0, 0] : [...t.split(" ").map((v) => parseFloat(v)), 0].slice(0, 2);
        };
        const out: { field: number[]; band: number[]; together: boolean[] } = { field: [], band: [], together: [] };
        for (let ms = 0; ms <= 64000; ms += 370) {
          for (const a of amb.getAnimations({ subtree: true })) {
            a.pause();
            a.currentTime = ms;
          }
          out.field.push(...shift(field));
          out.band.push(new DOMMatrix(getComputedStyle(band).transform).e);
          out.together.push(shift(band).join() === shift(field).join());
        }
        return out;
      }, AMBIENT);
      expect(samples.field.every((v) => Number.isInteger(v) && Math.abs(v) <= 48)).toBe(true);
      expect(new Set(samples.field.map(Math.abs)).size).toBeGreaterThan(10);
      expect(samples.band.every((x) => Number.isInteger(x) && x % 24 === 0)).toBe(true);
      expect(samples.together.every(Boolean)).toBe(true);
      // The light rests off screen, crosses the middle, and has left by the end of its pass. Its dots fade out over the
      // band's outer 16 % on each side, so "off screen" means the lit part.
      const at = (seconds: number) =>
        page.evaluate(
          ([sel, ms]) => {
            const band = document.querySelector(sel)!.querySelector(".a2-ambient-sweep")!;
            for (const a of band.getAnimations()) {
              a.pause();
              a.currentTime = ms;
            }
            const r = band.getBoundingClientRect();
            return { left: r.left + r.width * 0.16, right: r.right - r.width * 0.16, screen: document.documentElement.clientWidth };
          },
          [AMBIENT, seconds * 1000] as const,
        );
      const rest = await at(2);
      expect(locale === "ar" ? rest.left >= rest.screen - 1 : rest.right <= 1).toBe(true);
      const mid = await at(13);
      expect(Math.abs((mid.left + mid.right) / 2 - mid.screen / 2)).toBeLessThan(mid.screen * 0.3);
      const gone = await at(24);
      expect(locale === "ar" ? gone.right <= 1 : gone.left >= gone.screen - 1).toBe(true);
    }
  });

  test("the motion costs the main thread nothing once the page is still", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    // After the hero's intro, jump (no smooth scroll) to a section with no one-time run left to play (the hero plate's
    // loop rests off screen).
    await page.waitForTimeout(6000);
    await page.evaluate(() => document.querySelector("#clients")!.scrollIntoView({ behavior: "instant", block: "start" }));
    await page.waitForTimeout(2500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    const before = await metrics();
    await page.waitForTimeout(2000);
    const after = await metrics();
    // The hero's own loops have paused off screen (the plate's cut loop and its hot points); the ambient's four
    // animations (two per layer) keep running.
    await expect(page.locator(".a2-hero")).not.toHaveAttribute("data-live", "");
    expect((await plateLoop(page, ".a2-hero .a2-plate")).filter((a) => a.state === "running")).toEqual([]);
    expect((await ambientAnimations(page)).filter((a) => a.state === "running")).toHaveLength(4);
    // Motion without restyling or laying out on the main thread (a still page shows the same handful of style checks).
    expect(after.RecalcStyleCount - before.RecalcStyleCount).toBeLessThanOrEqual(20);
    expect(after.LayoutCount - before.LayoutCount).toBeLessThanOrEqual(3);
  });

  test("it rests while the page scrolls and carries on from where it stopped", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    // LabMotion is running once it has marked the hero as on screen.
    await expect(page.locator(".a2-hero")).toHaveAttribute("data-live", "");
    // Scrolled from inside the page every 50 ms for half a second, sampled after each step: whenever the page is
    // marked as scrolling, every layer is paused and its clock holds.
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
    for (let i = 1; i < samples.length; i++) {
      if (samples[i - 1].marked && samples[i].marked) samples[i].times.forEach((t, k) => expect(t).toBe(samples[i - 1].times[k]));
    }
    // Then, once the (smooth) scrolling has settled, they carry on from there.
    await expect.poll(async () => (await ambientAnimations(page)).map((a) => a.state)).toEqual(Array(4).fill("running"));
    await expect(page.locator("html")).not.toHaveAttribute("data-scrolling", "");
  });

  test("marking the page as scrolling restyles only the two moving layers, not the page", async ({ page, browser }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] });
    // Four changes of the attribute, each followed by a style read, between two markers in the trace. A read before the
    // first marker brings every running animation up to date first (the page's clock moves on with each new task, and
    // the hero's entrance and its plate are running then), so the markers hold only what the attribute changes.
    await page.evaluate((sel) => {
      const band = document.querySelector(sel)!.querySelector(".a2-ambient-sweep")!;
      void getComputedStyle(band).animationPlayState;
      console.timeStamp("scrolling-start");
      for (let i = 0; i < 4; i++) {
        document.documentElement.toggleAttribute("data-scrolling");
        void getComputedStyle(band).animationPlayState;
      }
      console.timeStamp("scrolling-end");
    }, AMBIENT);
    type TraceEvent = { name: string; ts: number; args?: { elementCount?: number; data?: { message?: string } } };
    const events = (JSON.parse((await browser.stopTracing()).toString()).traceEvents as TraceEvent[]).sort((a, b) => a.ts - b.ts);
    const mark = (label: string) => events.find((e) => e.name === "TimeStamp" && e.args?.data?.message === label)!.ts;
    const [from, to] = [mark("scrolling-start"), mark("scrolling-end")];
    const restyled = events.filter((e) => e.name === "UpdateLayoutTree" && e.ts > from && e.ts < to && e.args?.elementCount != null).map((e) => e.args!.elementCount!);
    expect(restyled).toHaveLength(4);
    // The rule names the two layers; a universal selector here restyled about 1,700 elements per change.
    expect(Math.max(...restyled)).toBeLessThanOrEqual(4);
  });

  test("section sheets let only a little of it through; cards stay opaque", async ({ page }) => {
    for (const theme of ["light", "dark"]) {
      await page.goto(`${home("en")}?theme=${theme}`, { waitUntil: "networkidle" });
      const alphas = await page.evaluate(() => {
        const alpha = (colour: string) => {
          const m = colour.match(/\/\s*([\d.]+)\s*\)$/) ?? colour.match(/^rgba\([^)]*,\s*([\d.]+)\)$/);
          return m ? Number(m[1]) : 1;
        };
        const raised = getComputedStyle(document.querySelector(".sec-raised")!).backgroundImage.match(/color\(srgb[^)]*\)/g) ?? [];
        return {
          muted: alpha(getComputedStyle(document.querySelector(".sec-muted")!).backgroundColor),
          raised: raised.map(alpha),
          card: alpha(getComputedStyle(document.querySelector("#services .card-link")!).backgroundColor),
        };
      });
      expect(alphas.muted, theme).toBeGreaterThanOrEqual(0.85);
      expect(alphas.muted, theme).toBeLessThanOrEqual(0.94);
      expect(alphas.raised.length, theme).toBe(2);
      for (const a of alphas.raised) {
        expect(a, theme).toBeGreaterThanOrEqual(0.85);
        expect(a, theme).toBeLessThanOrEqual(0.94);
      }
      expect(alphas.card, theme).toBe(1);
    }
  });

  test("reading zones keep the ambient out from under the text on plain sections, and stay on screen", async ({ page }) => {
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 800 });
      for (const locale of LOCALES) {
        for (const [path, expected] of [
          [home(locale), 4],
          [system(locale), 1],
        ] as const) {
          await page.goto(path, { waitUntil: "networkidle" });
          const zones = await page.evaluate(() => {
            // The feathered edge is 1.5 rem wide, or the page gutter where that is narrower (1 rem at the top and bottom).
            const feather = Math.min(24, parseFloat(getComputedStyle(document.querySelector(".shell")!).paddingLeft));
            return [...document.querySelectorAll<HTMLElement>(".lab-a2 :is(.a2-read, main.shell)")].map((el) => {
              const cs = getComputedStyle(el);
              const before = getComputedStyle(el, "::before");
              const box = el.getBoundingClientRect();
              const zone = { left: box.left + parseFloat(before.left), top: box.top + parseFloat(before.top), width: parseFloat(before.width), height: parseFloat(before.height) };
              const content = {
                left: box.left + parseFloat(cs.paddingLeft),
                right: box.right - parseFloat(cs.paddingRight),
                top: box.top + parseFloat(cs.paddingTop),
                bottom: box.bottom - parseFloat(cs.paddingBottom),
              };
              const probe = document.createElement("canvas").getContext("2d")!;
              probe.fillStyle = before.backgroundColor;
              probe.fillRect(0, 0, 1, 1);
              return {
                alpha: probe.getImageData(0, 0, 1, 1).data[3] / 255,
                // The zone's full strength covers the text; its feathered edge lies outside it.
                covers:
                  zone.left + feather <= content.left + 0.5 &&
                  zone.left + zone.width - feather >= content.right - 0.5 &&
                  zone.top + 16 <= content.top + 0.5 &&
                  zone.top + zone.height - 16 >= content.bottom - 0.5,
                onScreen: zone.left >= -0.5 && zone.left + zone.width <= document.documentElement.clientWidth + 0.5,
                under: before.zIndex === "-1" && cs.isolation === "isolate",
                events: before.pointerEvents,
              };
            });
          });
          expect(zones.length, `${path} ${width}`).toBe(expected);
          for (const z of zones) expect(z, `${path} ${width}`).toEqual({ alpha: expect.any(Number), covers: true, onScreen: true, under: true, events: "none" });
          for (const z of zones) expect(z.alpha, `${path} ${width}`).toBeGreaterThanOrEqual(0.85);
        }
      }
    }
  });

  test("no single pixel behind body text drops below AA, even with the light directly behind it", async ({ page }) => {
    test.setTimeout(120_000);
    const texts = [
      ".a2-hero .t-lead",
      ".a2-hero .eyebrow",
      ".a2-trust li",
      "#about .t-body",
      "#about-title",
      "#about h3",
      "#projects .t-lead",
      "#services .t-lead",
      "#clients .t-lead",
      "#industries-title",
    ];
    for (const theme of ["light", "dark"]) {
      for (const locale of LOCALES) {
        await page.goto(`${home(locale)}?theme=${theme}`, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: ".a2-header{position:relative!important}" });
        await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-shown", "")));
        await page.waitForTimeout(1200);
        const low: string[] = [];
        for (const sel of texts) {
          const { ratio, need } = await worstPixelContrast(page, sel);
          if (ratio < need) low.push(`${sel} ${ratio}:1 (needs ${need})`);
        }
        expect(low, `${locale} ${theme}`).toEqual([]);
      }
    }
  });

  test("the design-system sheet shows it as frames: still, 8, 11 and 14 s in both themes, the light on the dot grid and entering from the reading side", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(system(locale), { waitUntil: "networkidle" });
      await page.locator(".a2-amb-frame").first().scrollIntoViewIfNeeded();
      const frames = await page.locator(".a2-amb-frame").evaluateAll((els) =>
        els.map((el) => {
          const amb = el.querySelector(".a2-ambient-frame")!;
          const band = amb.querySelector(".a2-ambient-sweep")!;
          const sweep = band.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return {
            theme: el.classList.contains("a2-theme-dark") ? "dark" : "light",
            hidden: el.getAttribute("aria-hidden"),
            running: amb.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
            grid: new DOMMatrix(getComputedStyle(band).transform).e % 24 === 0,
            centre: Math.round((((sweep.left + sweep.right) / 2 - box.left) / box.width) * 100) / 100,
          };
        }),
      );
      expect(frames.map((f) => f.theme)).toEqual(["light", "light", "light", "light", "dark", "dark", "dark", "dark"]);
      expect(frames.every((f) => f.hidden === "true" && f.running === 0 && f.grid)).toBe(true);
      // Where the band's centre sits across the frame (0 = left edge, 1 = right edge); Arabic mirrors it.
      for (const row of [frames.slice(0, 4), frames.slice(4)]) {
        const along = row.map((f) => (locale === "ar" ? 1 - f.centre : f.centre));
        expect(along[0] < 0 || along[0] > 1, "still: off screen").toBe(true);
        expect(along[1], "8 s: entering").toBeGreaterThan(-0.2);
        expect(along[1], "8 s: entering").toBeLessThan(0.25);
        expect(along[2], "11 s: mid-screen").toBeGreaterThan(0.25);
        expect(along[2], "11 s: mid-screen").toBeLessThan(0.6);
        expect(along[3], "14 s: leaving").toBeGreaterThan(0.6);
        expect(along[3], "14 s: leaving").toBeLessThan(0.95);
      }
    }
  });
});

test.describe("A V2 · background motion on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, contextOptions: { reducedMotion: "no-preference" } });

  test("phones get a lighter version: still dots, colour at 70 % without teal, half the drift, a narrower light", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(home(locale), { waitUntil: "networkidle" });
      const phone = await page.evaluate((sel) => {
        const el = document.querySelector(sel)!;
        const field = getComputedStyle(el.querySelector(".a2-ambient-field")!);
        return {
          names: el
            .getAnimations({ subtree: true })
            .map((a) => (a as CSSAnimation).animationName)
            .sort(),
          dots: (field.backgroundImage.match(/radial-gradient/g) ?? []).length === 4,
          strength: field.getPropertyValue("--amb-k").trim(),
          teal: field.getPropertyValue("--amb-kt").trim(),
          band: el.querySelector(".a2-ambient-sweep")!.getBoundingClientRect().width,
        };
      }, AMBIENT);
      const drift = locale === "ar" ? "a2-amb-drift-sm-rtl" : "a2-amb-drift-sm";
      expect(phone).toEqual({
        names: ["a2-amb-breathe", drift, drift, "a2-amb-sweep"],
        dots: true,
        strength: "70%",
        teal: "0%",
        band: 384,
      });
    }
  });
});

test.describe("A V2 · background motion, reduced", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("with reduced motion the background holds still and stays visible", async ({ page }) => {
    for (const theme of ["light", "dark"]) {
      await page.goto(`${home("en")}?theme=${theme}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const still = await page.evaluate((sel) => {
        const el = document.querySelector(sel)!;
        const field = getComputedStyle(el.querySelector(".a2-ambient-field")!);
        return {
          animations: el.getAnimations({ subtree: true }).length,
          // Three colour fields and the dots, on the page colour.
          surface: field.backgroundImage.split("radial-gradient").length - 1,
          breath: field.opacity,
          drift: field.translate,
          lightOff: el.querySelector(".a2-ambient-sweep")!.getBoundingClientRect().right <= 0,
        };
      }, AMBIENT);
      expect(still, theme).toEqual({ animations: 0, surface: 4, breath: "1", drift: "none", lightOff: true });
    }
  });
});
