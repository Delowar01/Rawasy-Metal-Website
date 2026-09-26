import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, LOCALES, trackErrors } from "./helpers";

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

/** Animations currently attached to a signature illustration and its parts. */
const signatureAnimations = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    // The run's own (Web Animations API) animations: CSS loops and transitions, such as the plate's breathing nodes, are not part of it.
    return (root?.getAnimations({ subtree: true }) ?? []).filter((a) => a.constructor === Animation).map((a) => ({
      state: a.playState,
      end: a.effect?.getComputedTiming().endTime as number,
      iterations: a.effect?.getComputedTiming().iterations as number,
    }));
  }, selector);

const inView = (page: Page, selector: string) => page.evaluate((sel) => document.querySelector(sel)!.scrollIntoView({ block: "center" }), selector);

/** The finished picture of the signatures, as the service pages draw them. */
async function expectFinished(page: Page, which: readonly ("cut" | "engrave")[] = ["cut", "engrave"]) {
  const state = await page.evaluate(() => {
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    const all = (sel: string) => [...document.querySelectorAll(sel)].map((el) => getComputedStyle(el));
    const head = (sel: string) => {
      const m = new DOMMatrix(css(sel).transform);
      return [Math.round(m.e * 10) / 10, Math.round(m.f * 10) / 10];
    };
    const drawn = (list: CSSStyleDeclaration[]) => list.every((s) => s.strokeDasharray === "none" || parseFloat(s.strokeDashoffset) < 0.001);
    return {
      sheet: css(".sig-cut .sig-sheet").opacity,
      cut: drawn(all(".sig-cut .sig-kerf [pathLength]:not(.sig-slug)")),
      slugs: all(".sig-cut .sig-kerf .sig-slug").map((s) => s.opacity),
      pierces: all(".sig-cut .sig-pierce").map((s) => s.opacity),
      trail: all(".sig-cut :is(.sig-trail > g, .sig-hot, .sig-scan)").map((s) => s.opacity),
      cutHead: head(".sig-cut .sig-head"),
      ring: css(".sig-cut .sig-ring").opacity,
      plate: css(".sig-engrave .sig-plate").opacity,
      grooves: drawn(all(".sig-engrave .sig-engr [pathLength]")),
      dots: all(".sig-engrave .sig-dots").map((s) => s.opacity),
      laser: css(".sig-engrave .sig-on").opacity,
      beam: css(".sig-engrave .sig-beam-rest").opacity,
      engraveHead: head(".sig-engrave .sig-head"),
    };
  });
  if (which.includes("cut")) {
    expect(state.sheet).toBe("1");
    expect(state.cut).toBe(true);
    expect(state.slugs.every((o) => o === "0")).toBe(true);
    expect(state.pierces).toEqual(["1", "1", "1", "1"]);
    expect(state.trail.every((o) => o === "0")).toBe(true);
    // The head parks where the service page shows it.
    expect(state.cutHead).toEqual([176, 92]);
    expect(state.ring).toBe("1");
  }
  if (which.includes("engrave")) {
    expect(state.plate).toBe("1");
    expect(state.grooves).toBe(true);
    expect(state.dots.every((o) => o === "1")).toBe(true);
    // The laser rests on the ring's top mark, beam dashed, as on the service page.
    expect(state.laser).toBe("0");
    expect(state.beam).toBe("0.8");
    expect(state.engraveHead).toEqual([282, 48]);
  }
}

/** The hero plate's finished picture: every opening cut, dimensions drawn, the laser off, the count complete. */
async function expectPlateFinished(page: Page) {
  const plate = await page.evaluate(() => {
    const root = document.querySelector(".a2-hero .a2-plate")!;
    const css = (el: Element) => getComputedStyle(el);
    return {
      opacity: css(root).opacity,
      slugs: [...root.querySelectorAll("[data-slug]")].map((g) => parseFloat(css(g).opacity) < 0.01 || css(g).clipPath.includes("100%")),
      dims: [...root.querySelectorAll(".a2-plate-dim")].every((d) => css(d).strokeDasharray === "none" || parseFloat(css(d).strokeDashoffset) < 0.001),
      nodes: [...root.querySelectorAll(".a2-plate-node")].map((n) => css(n).opacity),
      laser: [...root.querySelectorAll(".a2-plate-hot, .a2-plate-pierce, .a2-plate-cut, .a2-plate-glow")].every((el) => css(el).opacity === "0"),
      count: document.querySelector(".a2-hero .a2-plate-read [dir=ltr]")!.textContent,
    };
  });
  expect(plate.opacity).toBe("1");
  expect(plate.slugs).toHaveLength(10);
  expect(plate.slugs.every(Boolean)).toBe(true);
  expect(plate.dims).toBe(true);
  expect(plate.nodes).toEqual(["1", "1", "1", "1"]);
  expect(plate.laser).toBe(true);
  expect(plate.count).toBe("07/07");
}

/** WCAG contrast of an element's text against the solid colours behind it (alpha-blended up to the page). */
const textContrast = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) => {
    // Any computed colour (rgb, color(srgb …), oklab …) to sRGB through a 1 × 1 canvas.
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    return els
      .filter((el) => (el as HTMLElement).offsetParent !== null && el.textContent!.trim())
      .map((el) => {
        const layers: number[][] = [];
        for (let p: Element | null = el; p; p = p.parentElement) {
          const bg = rgba(getComputedStyle(p).backgroundColor);
          if ((bg[3] ?? 1) > 0) layers.push(bg);
          if ((bg[3] ?? 1) >= 1) break;
        }
        let base = [255, 255, 255];
        for (const [r, g, b, a = 1] of layers.reverse()) base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
        const style = getComputedStyle(el);
        const [lf, lb] = [lum(rgba(style.color)), lum(base)];
        const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700);
        return { text: el.textContent!.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, need: large ? 3 : 4.5 };
      });
  });

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
    const glow = await page.locator(".a2-glow").evaluate((el) => el.getAnimations().map((a) => a.playState));
    expect(glow).toEqual(["paused"]);
  });

  test("the design-system sheet shows each signature first, with a replay and still frames of its initial, active and finished states", async ({ page }) => {
    await page.goto(system("en"), { waitUntil: "networkidle" });
    // The three signature blocks lead the sheet: the hero plate, then the two laser illustrations.
    const firstBlocks = await page.locator("main > section").evaluateAll((els) => els.slice(0, 3).map((el) => el.querySelector("[id^=demo-]")?.id));
    expect(firstBlocks).toEqual(["demo-plate", "demo-cut", "demo-engrave"]);
    // The plate: a live run with a replay, and still frames with no, some and every opening cut.
    await inView(page, "#demo-plate");
    await expect.poll(async () => (await signatureAnimations(page, "#demo-plate .a2-plate")).length).toBeGreaterThan(30);
    await expect.poll(async () => (await signatureAnimations(page, "#demo-plate .a2-plate")).every((a) => a.state === "finished"), { timeout: 15000 }).toBe(true);
    await page.locator("section", { has: page.locator("#demo-plate") }).locator("button.sig-replay").click();
    await expect.poll(async () => (await signatureAnimations(page, "#demo-plate .a2-plate")).some((a) => a.state === "running")).toBe(true);
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

  test("the plate cuts once — bolt holes, then the star, the slot and the perforation rows — and the readout counts to 07/07", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect.poll(async () => (await signatureAnimations(page, plate)).length).toBeGreaterThan(30);
    await expect.poll(async () => (await signatureAnimations(page, plate)).every((a) => a.state === "finished"), { timeout: 15000 }).toBe(true);
    await expectPlateFinished(page);
    // Hovering the finished plate does not play it again.
    await page.locator(plate).hover();
    await page.waitForTimeout(500);
    expect((await signatureAnimations(page, plate)).every((a) => a.state === "finished")).toBe(true);

    // One clock for the whole run: step through it and read which openings are cut.
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
    expect(await opened(1100)).toEqual([]);
    expect(await opened(2600)).toEqual(["h0", "h1", "h2", "h3"]);
    expect(await opened(3700)).toEqual(["h0", "h1", "h2", "h3", "star"]);
    expect(await opened(4200)).toEqual(["h0", "h1", "h2", "h3", "star", "slot", "r0", "r1"]);
    const end = (await signatureAnimations(page, plate))[0].end;
    expect(end).toBeGreaterThan(4500);
    expect(end).toBeLessThan(6000);
    expect(await opened(end)).toHaveLength(10);
    expect(errors).toEqual([]);
  });

  test("the mouse tilts the plate and reads X / Y in plate millimetres; the count returns when it leaves", async ({ page }) => {
    await page.goto(home("en"), { waitUntil: "networkidle" });
    await expect.poll(async () => (await signatureAnimations(page, plate)).every((a) => a.state === "finished"), { timeout: 15000 }).toBe(true);
    const box = (await page.locator(`${plate} svg`).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    const read = page.locator(".a2-hero .a2-plate-read");
    await expect(read).toHaveAttribute("data-pointer", "");
    await expect(read.locator("[dir=ltr]")).toHaveText(/^X \d{3}\.\d · Y \d{3}\.\d$/);
    await page.mouse.move(20, 400, { steps: 4 });
    await expect(read).not.toHaveAttribute("data-pointer");
    await expect(read.locator("[dir=ltr]")).toHaveText("07/07");
  });

  test("the plate is an object: never mirrored in Arabic, where its readout words keep the Arabic face and no letter-spacing", async ({ page }) => {
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
    // The lab keeps its own key: the website's theme choice is never written.
    await page.goto(`${home("en")}?theme=dark`, { waitUntil: "networkidle" });
    await page.goto("/en", { waitUntil: "networkidle" });
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
