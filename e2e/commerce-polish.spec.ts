import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, LOCALES, trackErrors } from "./helpers";

/**
 * Stage TM-3, shared polish of the Modern Commerce design:
 * - the colour switch tells off, on and focus apart in forced colours on the homepage too (the Clients page's drawing);
 * - an inner page's hero (the kit's PageHero and the service pages' hero) shows with the first paint: its title, text,
 *   photos and cards never wait for the script; only its line drawings and the laser signatures draw in;
 * - in forced colours the brand logo in the header and the footer takes the forced text colour;
 * - the phone menu sheet's pages scroll above its foot: the quote button never covers a row, every stop reached with the
 *   keyboard is in full view, every target keeps its size, and the page behind stays locked.
 */

// ---------------------------------------------------------------------------------------------------------------------
// The colour switch in forced colours
// ---------------------------------------------------------------------------------------------------------------------

/** The switch's track, its border and its dot (position and colour), as drawn. */
const knob = (page: Page) =>
  page.locator("#clients .a2-toggle .knob").evaluate((el) => {
    const k = getComputedStyle(el);
    const d = getComputedStyle(el, "::after");
    return { track: k.backgroundColor, border: `${k.borderTopWidth} ${k.borderTopStyle} ${k.borderTopColor}`, dot: d.backgroundColor, at: d.translate };
  });

test.describe("the homepage's colour switch in forced colours", () => {
  for (const locale of LOCALES)
    for (const scheme of ["light", "dark"] as const)
      test(`${locale}, forced ${scheme}: an outlined track and its dot when off, a filled track when on, a focus ring; the keyboard switches it`, async ({ page }) => {
        const errors = trackErrors(page);
        await page.emulateMedia({ forcedColors: "active", colorScheme: scheme });
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        const toggle = page.locator("#clients .a2-toggle");
        await toggle.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
        const off = await knob(page);
        expect(off.border).toMatch(/^1px solid /);
        expect(off.dot).not.toBe(off.track);
        // Reached with the keyboard: the focus ring shows.
        await toggle.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(toggle).toBeFocused();
        expect(await toggle.evaluate((el) => [getComputedStyle(el).outlineStyle, parseFloat(getComputedStyle(el).outlineWidth)])).toEqual(["solid", 2]);
        await page.keyboard.press("Space");
        await expect(toggle).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("#client-wall")).toHaveAttribute("data-colour", "");
        await expect.poll(async () => (await knob(page)).at).not.toBe(off.at);
        const on = await knob(page);
        expect(on.track).not.toBe(off.track);
        expect(on.dot).not.toBe(on.track);
        await page.keyboard.press("Enter");
        await expect(toggle).toHaveAttribute("aria-pressed", "false");
        await expect.poll(async () => (await knob(page)).track).toBe(off.track);
        expect(errors).toEqual([]);
      });

  test("on a phone: tapped on and off, the state shows", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, forcedColors: "active" });
    const page = await context.newPage();
    await page.goto("/ar", { waitUntil: "networkidle" });
    const toggle = page.locator("#clients .a2-toggle");
    await toggle.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    const off = await knob(page);
    await toggle.tap();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await knob(page)).track).not.toBe(off.track);
    await toggle.tap();
    await expect.poll(async () => (await knob(page)).track).toBe(off.track);
    await context.close();
  });

  test("normal colours: the switch is drawn as before (no border, a white dot)", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const off = await knob(page);
    expect(off.border).toMatch(/^0px /);
    expect(off.dot).toBe("rgb(255, 255, 255)");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The brand logo in forced colours
// ---------------------------------------------------------------------------------------------------------------------

test.describe("the brand logo in forced colours", () => {
  // Every pairing of the forced palette and the site's own theme (stored by the theme switch): the footer's logo used to
  // stay white on a light forced page, and the header's followed the site's theme instead of the forced palette.
  for (const scheme of ["light", "dark"] as const)
    for (const theme of ["light", "dark"] as const)
      test(`forced ${scheme}, site theme ${theme}: the header's and the footer's logos take the forced text colour`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("rawasy-theme", t), theme);
        await page.emulateMedia({ forcedColors: "active", colorScheme: scheme });
        await page.goto(`/${scheme === "light" ? "en" : "ar"}/about`, { waitUntil: "networkidle" });
        const seen = await page.evaluate(() => {
          const probe = document.createElement("span");
          probe.style.color = "CanvasText";
          document.body.append(probe);
          const text = getComputedStyle(probe).color;
          probe.remove();
          return {
            text,
            logos: [...document.querySelectorAll("header svg[role=img], footer svg[role=img]")].map((svg) => ({
              color: getComputedStyle(svg).color,
              behind: getComputedStyle(svg.closest("header, footer")!).backgroundColor,
            })),
          };
        });
        expect(seen.text).toBe(scheme === "light" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
        expect(seen.logos).toHaveLength(2);
        for (const logo of seen.logos) {
          expect(logo.color).toBe(seen.text);
          expect(logo.behind.replace(/rgba?\(|\)/g, "").split(",").slice(0, 3).join()).not.toBe(seen.text.replace(/rgba?\(|\)/g, ""));
        }
      });

  test("normal colours: the footer's logo stays white and the header's follows the theme's ink", async ({ page }) => {
    await page.goto("/en/about", { waitUntil: "networkidle" });
    const colours = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector("header svg[role=img]")!).color,
      footer: getComputedStyle(document.querySelector("footer svg[role=img]")!).color,
      ink: getComputedStyle(document.querySelector(".a2-header .text-ink")!).color,
    }));
    expect(colours.footer).toBe("rgb(255, 255, 255)");
    expect(colours.header).toBe(colours.ink);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The header's marks in forced colours
// ---------------------------------------------------------------------------------------------------------------------

/** How the header marks the page, the section, the language and the theme: the text decoration of the marked items and
 * of an unmarked one, and the background of the marked language and theme against an unmarked one, with the forced
 * palette's selection colour for comparison. */
const headerMarks = (page: Page, scope: string) =>
  page.evaluate((scope) => {
    const root = document.querySelector(scope)!;
    const probe = document.createElement("span");
    probe.style.color = "Highlight";
    document.body.append(probe);
    const highlight = getComputedStyle(probe).color;
    probe.remove();
    const deco = (sel: string) => [...root.querySelectorAll(sel)].map((el) => getComputedStyle(el).textDecorationLine);
    const bg = (sel: string) => [...root.querySelectorAll(sel)].map((el) => getComputedStyle(el).backgroundColor);
    return {
      highlight,
      marked: deco(":is(.nav-link, .a2-sheet-row, .a2-dd-item)[aria-current]"),
      unmarked: deco(":is(.nav-link, .a2-sheet-row):not([aria-current])"),
      language: bg(".a2-lang a[aria-current]"),
      otherLanguage: bg(".a2-lang a:not([aria-current])"),
      theme: bg('.seg button[aria-pressed="true"]'),
      otherTheme: bg('.seg button[aria-pressed="false"]'),
    };
  }, scope);

test.describe("the header's marks in forced colours", () => {
  test("desktop: the page being viewed is underlined in the menu; the language and the theme in force take the selection colours", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
    await page.emulateMedia({ forcedColors: "active", colorScheme: "light" });
    await page.goto("/en/about", { waitUntil: "networkidle" });
    const nav = await headerMarks(page, ".a2-nav");
    expect(nav.marked).toEqual(["underline"]);
    expect(new Set(nav.unmarked)).toEqual(new Set(["none"]));
    const header = await headerMarks(page, ".a2-header");
    expect(header.language[0]).toBe(header.highlight);
    expect(header.otherLanguage[0]).not.toBe(header.highlight);
    expect(header.theme[0]).toBe(header.highlight);
    expect(header.otherTheme[0]).not.toBe(header.highlight);
  });

  test("phone, a service page: the current section and the service are underlined in the menu sheet; the language and the theme in force are filled", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, forcedColors: "active", colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/ar/services/scaffolding", { waitUntil: "networkidle" });
    await page.locator("details[data-sheet] > summary").tap();
    await page.locator(".a2-sheet-sub > summary").tap();
    const sheet = await headerMarks(page, ".a2-sheet");
    // The Services row (the section) and the service in its list; no other row.
    expect(sheet.marked).toEqual(["underline", "underline"]);
    expect(new Set(sheet.unmarked)).toEqual(new Set(["none"]));
    expect(sheet.language).toEqual([sheet.highlight]);
    expect(sheet.otherLanguage[0]).not.toBe(sheet.highlight);
    expect(sheet.theme).toEqual([sheet.highlight]);
    expect(sheet.otherTheme[0]).not.toBe(sheet.highlight);
    await context.close();
  });

  test("normal colours: the marks are drawn as before (no underline, the language on its raised tile)", async ({ page }) => {
    await page.goto("/en/about", { waitUntil: "networkidle" });
    const header = await headerMarks(page, ".a2-header");
    expect(new Set(header.marked)).toEqual(new Set(["none"]));
    // The current language on the theme's surface tile, the other one on the switch's own background.
    const surface = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.background = "var(--surface)";
      document.querySelector(".a2-lang")!.append(probe);
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    });
    expect(header.language[0]).toBe(surface);
    expect(header.otherLanguage[0]).not.toBe(header.language[0]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The inner pages' hero: shown with the first paint
// ---------------------------------------------------------------------------------------------------------------------

const HERO_PAGES = [
  "about",
  "services",
  "projects",
  "industries",
  "clients",
  "certificates",
  "contact",
  "privacy",
  "terms",
  "capabilities",
  "projects/geometric-lanterns",
  "services/laser-cutting",
  "services/cnc-bending",
  "services/steel-structures",
  "services/fabrication",
  "services/laser-engraving",
  "services/scaffolding",
];

test.describe("the inner pages' hero", () => {
  test("without its script (the page's scripts blocked, the boot script run), every hero is already shown; its drawings and the rest of the page still wait", async ({ page }) => {
    test.setTimeout(120_000);
    let blocked = 0;
    await page.route(/\/_next\/static\/chunks\/.+\.js$/, (route) => {
      blocked++;
      return route.abort();
    });
    let outsideChecked = 0;
    for (const locale of LOCALES)
      for (const path of HERO_PAGES) {
        const url = `/${locale}/${path}`;
        await page.goto(url, { waitUntil: "load" });
        const state = await page.evaluate(() => {
          const hero = document.querySelector(".ip-hero")!;
          const drawing = (el: Element) => el.matches(".sv-draw, .sv-axis, .sv-bubble, .sv-cut-sheet, .sv-plate-stage");
          const reveals = [...hero.querySelectorAll("[data-reveal]")];
          let h1 = 1;
          for (let n: Element | null = document.getElementById("page-title"); n; n = n.parentElement) h1 *= parseFloat(getComputedStyle(n).opacity);
          return {
            script: document.documentElement.classList.contains("js"),
            ran: document.querySelectorAll("[data-shown]").length,
            h1,
            title: hero.contains(document.getElementById("page-title")),
            content: reveals.filter((el) => !drawing(el)).map((el) => `${getComputedStyle(el).opacity} ${getComputedStyle(el).transform}`),
            drawings: reveals.filter(drawing).map((el) => getComputedStyle(el).opacity),
            outside: [...document.querySelectorAll("main [data-reveal]")].filter((el) => !hero.contains(el)).map((el) => getComputedStyle(el).opacity),
          };
        });
        // The boot script ran (reveals are armed), the page's own script did not.
        expect(state.script, url).toBe(true);
        expect(state.ran, url).toBe(0);
        expect(state.title, url).toBe(true);
        expect(state.h1, url).toBe(1);
        expect(state.content.every((s) => s === "1 none"), `${url} ${state.content}`).toBe(true);
        expect(state.drawings.every((o) => o === "0"), `${url} ${state.drawings}`).toBe(true);
        if (state.outside.length) {
          expect(state.outside[0], url).toBe("0");
          outsideChecked++;
        }
      }
    // The page's scripts were really held back, and the check above can tell a hero that shows from one that waits.
    expect(blocked).toBeGreaterThan(100);
    expect(outsideChecked).toBeGreaterThan(20);
  });

  for (const path of ["/en/contact", "/ar/about", "/en/projects", "/en/services/laser-cutting", "/ar/capabilities"])
    test(`${path}: with the script, the title is fully shown in every frame from the first paint; nothing in the hero fades`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.addInitScript(() => {
        const seen = { frames: 0, min: 1 };
        (window as unknown as { __title: typeof seen }).__title = seen;
        const tick = (now: number) => {
          const h1 = document.getElementById("page-title");
          if (h1 && h1.getClientRects().length) {
            let o = 1;
            for (let n: Element | null = h1; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
            seen.min = Math.min(seen.min, o);
            seen.frames++;
          }
          if (now < 2500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.goto(path, { waitUntil: "load" });
      await page.waitForTimeout(2600);
      const seen = await page.evaluate(() => (window as unknown as { __title: { frames: number; min: number } }).__title);
      expect(seen.frames).toBeGreaterThan(10);
      expect(seen.min).toBe(1);
      // No transition or animation on the hero's text and photos (the drawings and signatures have their own clocks).
      const moving = await page.evaluate(
        () =>
          document
            .querySelector(".ip-hero")!
            .getAnimations({ subtree: true })
            .filter((a) => {
              const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
              return target && !target.closest(".sv-draw, .sv-axis, .sv-bubble, .sv-cut-sheet, .sv-plate-stage, .sig") && a.playState === "running";
            }).length,
      );
      expect(moving).toBe(0);
      expect(errors).toEqual([]);
    });
});

// ---------------------------------------------------------------------------------------------------------------------
// The phone menu sheet
// ---------------------------------------------------------------------------------------------------------------------

/** The sheet's parts and every interactive target in its scroll area, as laid out now. */
const sheetGeometry = (page: Page) =>
  page.evaluate(() => {
    const sheet = document.querySelector(".a2-sheet")!;
    const nav = sheet.querySelector(":scope > nav")!;
    const n = nav.getBoundingClientRect();
    const foot = sheet.querySelector(".a2-sheet-foot")!.getBoundingClientRect();
    const targets = [...nav.querySelectorAll("a, button, summary")].filter((el) => el.getClientRects().length);
    return {
      navBottom: n.bottom,
      footTop: foot.top,
      footBottom: foot.bottom,
      sheetBottom: sheet.getBoundingClientRect().bottom,
      navScrolls: nav.scrollHeight > nav.clientHeight + 1,
      sheetScrolls: sheet.scrollHeight > sheet.clientHeight + 1,
      // What each target shows (the scroll area clips it) never reaches the foot.
      underFoot: targets
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return Math.min(r.bottom, n.bottom) > Math.max(r.top, foot.top) + 0.5;
        })
        .map((el) => (el.textContent ?? "").trim()),
      locked: getComputedStyle(document.documentElement).overflow,
    };
  });

/** Tab from the burger through the sheet: every stop, whether it is in full view, and its size. */
async function tabThroughSheet(page: Page) {
  await page.locator("details[data-sheet] > summary").focus();
  const stops: { label: string; inView: boolean; size: number }[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const sheet = document.querySelector(".a2-sheet");
      if (!sheet?.contains(el)) return null;
      const nav = sheet.querySelector(":scope > nav")!;
      const r = el.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      const foot = sheet.querySelector(".a2-sheet-foot")!.getBoundingClientRect();
      const inView = nav.contains(el) ? r.top >= n.top - 0.5 && r.bottom <= n.bottom + 0.5 && r.bottom <= foot.top + 0.5 : r.bottom <= innerHeight + 0.5;
      return { label: (el.textContent || el.getAttribute("aria-label") || "").trim(), inView, size: Math.min(r.width, r.height) };
    });
    if (!stop) break;
    stops.push(stop);
  }
  return stops;
}

test.describe("the phone menu sheet", () => {
  const VIEWS = [
    [390, 844, true],
    [360, 780, true],
    [320, 700, true],
    // A 1280 × 720 window at 200 % zoom.
    [640, 360, false],
  ] as const;
  for (const [width, height, mobile] of VIEWS)
    for (const locale of LOCALES)
      test(`${width}×${height} (${locale}): the pages scroll above the foot, Services open or closed; every stop is in full view and keeps its size`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
        const page = await context.newPage();
        const errors = trackErrors(page);
        await page.goto(`/${locale}/projects/geometric-lanterns`, { waitUntil: "networkidle" });
        const menu = page.locator("details[data-sheet]");
        await menu.locator(":scope > summary").focus();
        await page.keyboard.press("Enter");
        await expect(menu).toHaveAttribute("open", "");
        for (const services of [false, true]) {
          if (services) {
            await page.locator(".a2-sheet-sub > summary").focus();
            await page.keyboard.press("Enter");
            await expect(page.locator(".a2-sheet-sub")).toHaveAttribute("open", "");
          }
          const where = `${width} ${locale} services ${services ? "open" : "closed"}`;
          const geometry = await sheetGeometry(page);
          // The scroll area ends where the foot begins; the foot ends at the sheet's end; the sheet itself never scrolls.
          expect(Math.abs(geometry.navBottom - geometry.footTop), where).toBeLessThan(1);
          expect(Math.abs(geometry.footBottom - geometry.sheetBottom), where).toBeLessThan(2);
          expect(geometry.sheetScrolls, where).toBe(false);
          expect(geometry.underFoot, where).toEqual([]);
          expect(geometry.locked, where).toBe("hidden");
          expect(await horizontalOverflow(page), where).toBe(0);
          if (services && width === 390) expect(geometry.navScrolls, where).toBe(true);
          const stops = await tabThroughSheet(page);
          // Fifteen stops (pages, language, theme, call, WhatsApp, the quote), seven more with the Services list open.
          expect(stops.length, where).toBe(services ? 22 : 15);
          expect(stops.filter((s) => !s.inView).map((s) => s.label), where).toEqual([]);
          expect(Math.min(...stops.map((s) => s.size)), where).toBeGreaterThanOrEqual(40);
          // Tabbing past the quote button closed the sheet: open it again for the next round.
          await expect(menu).not.toHaveAttribute("open");
          await menu.locator(":scope > summary").focus();
          await page.keyboard.press("Enter");
          await expect(menu).toHaveAttribute("open", "");
        }
        // Escape closes it and gives the focus back to the burger.
        await page.keyboard.press("Escape");
        await expect(menu).not.toHaveAttribute("open");
        await expect(menu.locator(":scope > summary")).toBeFocused();
        expect(errors).toEqual([]);
        await context.close();
      });

  test("390×844: with Services open, the Projects row is not covered by the quote button and comes into full view when reached", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/en/projects/geometric-lanterns", { waitUntil: "networkidle" });
    await page.locator("details[data-sheet] > summary").tap();
    await page.locator(".a2-sheet-sub > summary").tap();
    const projects = page.locator('.a2-sheet a.a2-sheet-row[href="/en/projects"]');
    const quote = page.locator(".a2-sheet-foot a.btn-primary");
    // Before: below the scroll area's edge, not behind the foot.
    const before = await projects.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const nav = el.closest("nav")!.getBoundingClientRect();
      return { shownBelowNav: Math.max(0, r.bottom - nav.bottom) };
    });
    expect(before.shownBelowNav).toBeGreaterThan(0);
    // Reached, it comes into full view above the foot, and a tap on it reaches the row, never the quote button.
    await projects.focus();
    const box = (await projects.boundingBox())!;
    const foot = (await page.locator(".a2-sheet-foot").boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(foot.y + 1);
    for (const y of [box.y + 2, box.y + box.height / 2, box.y + box.height - 2]) {
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href"), [box.x + box.width / 2, y]);
      expect(hit).toBe("/en/projects");
    }
    await expect(quote).toBeVisible();
    await context.close();
  });
});
