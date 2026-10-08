import { expect, test, type Page } from "@playwright/test";
import { LOCALES, trackErrors } from "./helpers";

/**
 * Stage 1J: the browser's animated page updates (view transitions). Held frame by frame on the Stage 1I build, each one
 * took words below AA: the theme switch's cross-fade passed every word through its own background (about 1:1 at 75 to
 * 100 ms of 250), the cross-document fade drew both pages' words half-strength over each other (English and Arabic on a
 * language switch, and on every other page change), and the cards a gallery choice brought in faded in (opacity 0.44 at
 * 50 ms, 0.72 at 100 ms). Now the theme and the page change at once, and a gallery choice still moves the cards that stay
 * while those it brings in or leaves out appear or go whole.
 */

/** Counts the page's calls of document.startViewTransition from now on. */
async function countTransitions(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __vtCalls: number };
    w.__vtCalls = 0;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: () => void) => (w.__vtCalls++, start(update))) as typeof document.startViewTransition;
  });
  return () => page.evaluate(() => (window as unknown as { __vtCalls: number }).__vtCalls);
}

test.describe("the theme switch changes the page at once", () => {
  for (const locale of LOCALES)
    for (const from of ["light", "dark"] as const)
      test(`${locale}, ${from} to ${from === "light" ? "dark" : "light"}: no animated update, the new theme and the browser colour in the click's own task`, async ({ page }) => {
        const errors = trackErrors(page);
        const to = from === "light" ? "dark" : "light";
        await page.addInitScript((theme) => localStorage.setItem("rawasy-theme", theme), from);
        await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", from);
        const calls = await countTransitions(page);
        // Read the page inside the click's own task: the theme has changed before anything else runs.
        const seen = await page.evaluate((to) => {
          const button = [...document.querySelectorAll<HTMLButtonElement>("header .seg button")].find((b) => b.checkVisibility() && b.getAttribute("aria-pressed") === "false")!;
          button.click();
          return {
            theme: document.documentElement.getAttribute("data-theme"),
            color: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
            stored: localStorage.getItem("rawasy-theme"),
            animations: document.getAnimations().filter((a) => String((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition")).length,
            to,
          };
        }, to);
        expect(seen.theme).toBe(to);
        expect(seen.color).toBe(to === "dark" ? "#131820" : "#f4f4f1");
        expect(seen.stored).toBe(to);
        expect(seen.animations).toBe(0);
        expect(await calls()).toBe(0);
        expect(await page.evaluate(() => document.getAnimations().filter((a) => String((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition")).length)).toBe(0);
        expect(errors).toEqual([]);
      });

  test("on a phone, from the menu sheet: at once too, and the sheet stays open", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/ar", { waitUntil: "networkidle" });
    await page.locator("summary.a2-burger").click();
    const sheet = page.locator("details[data-menu]");
    await expect(sheet).toHaveAttribute("open", "");
    const before = await page.locator("html").getAttribute("data-theme");
    const calls = await countTransitions(page);
    await page.locator('details[data-menu] .seg button[aria-pressed="false"]').click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "");
    expect(await calls()).toBe(0);
    await expect(sheet).toHaveAttribute("open", "");
    await context.close();
  });
});

test.describe("a new page simply replaces the last one", () => {
  test("no stylesheet asks for a cross-document transition", async ({ page }) => {
    for (const path of ["/en", "/ar/about", "/en/projects", "/ar/services/laser-cutting"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const rules = await page.evaluate(() => {
        const found: string[] = [];
        const walk = (list: CSSRuleList) => {
          for (const rule of list) {
            if (rule.constructor.name === "CSSViewTransitionRule" || /^@view-transition/.test(rule.cssText)) found.push(rule.cssText);
            if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
          }
        };
        for (const sheet of document.styleSheets) walk(sheet.cssRules);
        return found;
      });
      expect(rules, path).toEqual([]);
    }
  });

  for (const [from, link, to] of [
    ["/en/about", 'header a[hreflang="ar-SA"]:visible', "/ar/about"],
    ["/ar/contact", 'header a[hreflang="en"]:visible', "/en/contact"],
    ["/en", 'header nav a[href="/en/about"]:visible', "/en/about"],
  ] as const)
    test(`${from} → ${to}: neither page runs a view transition`, async ({ page }) => {
      // Each document records whether the browser revealed it through a view transition.
      await page.addInitScript(() =>
        addEventListener("pagereveal", (e) => sessionStorage.setItem("reveal", String(!!(e as Event & { viewTransition?: unknown }).viewTransition))),
      );
      await page.goto(from, { waitUntil: "networkidle" });
      await page.evaluate(() => sessionStorage.removeItem("reveal"));
      await Promise.all([page.waitForURL(`**${to}`), page.locator(link).click()]);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => sessionStorage.getItem("reveal"))).toBe("false");
      expect(await page.evaluate(() => document.getAnimations().filter((a) => String((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition")).length)).toBe(0);
    });
});

/** Chooses a category, then "All" again with the update held at T: the cards that come back, the cards that stay. */
async function holdAll(page: Page, T: number) {
  return page.evaluate(async (T) => {
    const chips = document.querySelectorAll<HTMLButtonElement>(".pj-bar .pj-chip");
    const hidden = [...document.querySelectorAll<HTMLElement>("[data-project][hidden]")];
    const stay = [...document.querySelectorAll<HTMLElement>("[data-project]:not([hidden])")];
    let running: ViewTransition | undefined;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: () => void) => (running = start(update))) as typeof document.startViewTransition;
    chips[0].click();
    delete (document as { startViewTransition?: unknown }).startViewTransition;
    if (!running) return null;
    await running.ready;
    const vt = document.getAnimations().filter((a) => String((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition"));
    for (const a of vt) {
      a.pause();
      a.currentTime = T;
    }
    const name = (el: HTMLElement) => getComputedStyle(el).viewTransitionName;
    const opacity = (pseudo: string) => Number(getComputedStyle(document.documentElement, pseudo).opacity);
    const result = {
      entering: hidden.map((el) => opacity(`::view-transition-new(${name(el)})`)),
      moving: stay.filter((el) => vt.some((a) => (a.effect as KeyframeEffect).pseudoElement === `::view-transition-group(${name(el)})` && (a as CSSAnimation).animationName !== "none")).length,
      stay: stay.length,
      // the cards whose pictures the browser animates (their cross-fade and blend): only the cards that stay, both pictures
      pictures: [
        ...new Set(
          vt.flatMap((a) => /^::view-transition-(old|new)\((.+)\)$/.exec((a.effect as KeyframeEffect).pseudoElement ?? "")?.slice(1, 3).join(" ") ?? []),
        ),
      ],
      stayNames: stay.map(name),
    };
    for (const a of vt) a.finish();
    await running.finished;
    await new Promise((r) => setTimeout(r, 0));
    return result;
  }, T);
}

test.describe("a gallery choice moves the cards that stay; the cards it brings in or leaves out appear or go whole", () => {
  for (const locale of LOCALES)
    test(`${locale}: held at 0, 50, 100, 225 and 450 ms, every card coming back is at full strength`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      await page.locator("#gallery").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.evaluate(() => window.scrollBy({ top: -240, behavior: "instant" }));
      for (const T of [0, 50, 100, 225, 450]) {
        await page.locator(".pj-bar .pj-chip").nth(1).click();
        await expect.poll(() => page.locator("html").getAttribute("data-vt")).toBeNull();
        await expect(page.locator("[data-project][hidden]").first()).toBeAttached();
        const r = await holdAll(page, T);
        expect(r, `${T} ms: the update ran`).not.toBeNull();
        expect(r!.entering.length, `${T} ms`).toBeGreaterThan(0);
        expect(r!.entering.every((o) => o === 1), `${T} ms: coming back at ${r!.entering.join(", ")}`).toBe(true);
        expect(r!.moving, `${T} ms: the cards that stay still move`).toBe(r!.stay);
        expect(r!.pictures.sort(), `${T} ms: only the pictures of the cards that stay are animated`).toEqual(
          r!.stayNames.flatMap((n) => [`new ${n}`, `old ${n}`]).sort(),
        );
        await expect.poll(() => page.locator("html").getAttribute("data-vt")).toBeNull();
        await expect(page.locator("[data-project][hidden]")).toHaveCount(0);
      }
      // Leaving: the cards a choice leaves out are not drawn while the others move.
      const leaving = await page.evaluate(async () => {
        const items = [...document.querySelectorAll<HTMLElement>("[data-project]")];
        let running: ViewTransition | undefined;
        const start = document.startViewTransition.bind(document);
        document.startViewTransition = ((update: () => void) => (running = start(update))) as typeof document.startViewTransition;
        document.querySelectorAll<HTMLButtonElement>(".pj-bar .pj-chip")[1].click();
        delete (document as { startViewTransition?: unknown }).startViewTransition;
        await running!.ready;
        const vt = document.getAnimations().filter((a) => String((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition"));
        for (const a of vt) {
          a.pause();
          a.currentTime = 50;
        }
        const gone = items.filter((el) => el.hidden).map((el) => Number(getComputedStyle(document.documentElement, `::view-transition-old(${getComputedStyle(el).viewTransitionName})`).opacity));
        for (const a of vt) a.finish();
        await running!.finished;
        return gone;
      });
      expect(leaving.length).toBeGreaterThan(0);
      expect(leaving.every((o) => o === 0), `leaving at ${leaving.join(", ")}`).toBe(true);
      expect(errors).toEqual([]);
    });
});

test.describe("with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the theme switch and a gallery choice run no animated update", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const calls = await countTransitions(page);
    await page.locator('header .seg button[aria-pressed="false"]:visible').click();
    await page.locator("#gallery").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.evaluate(() => window.scrollBy({ top: -240, behavior: "instant" }));
    await page.locator(".pj-bar .pj-chip").nth(1).click();
    await expect(page.locator("[data-project][hidden]").first()).toBeAttached();
    expect(await calls()).toBe(0);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => String((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition")).length)).toBe(0);
  });
});
