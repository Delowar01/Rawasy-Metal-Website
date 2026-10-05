import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectFinished, expectPlateFinished } from "./a2-helpers";
import { trackErrors } from "./helpers";

/**
 * Stage 1I: motion and interaction polish of the Modern Commerce site — one coherent motion system, no redesign.
 * Reduced motion stops every moving part, also when it is turned on while a page is open; nothing runs unseen (a
 * signature that leaves the screen rests and carries on when it is back; the ambient, the hero's hot points and the
 * machinery console rest while the page is hidden); a sideways rail shows its cards together; keyboard focus shows what
 * hover shows on the controls that lift, fill or move; the Industries line is scaled, not resized; every hover lift
 * takes the same time; and twenty quick cycles of the menu, the dropdown, the filters, the switch and the certificate
 * dialog end consistent (the machinery selector's own twenty-cycle test is in commerce-capabilities.spec.ts).
 */

/** Wait until nothing animates any more on an element and inside it (a state is read once it has settled). */
const settled = (target: Locator) => expect.poll(() => target.evaluate((el) => el.getAnimations({ subtree: true }).length), { timeout: 10_000 }).toBe(0);

/** Bring an element to the middle of the screen at once (the page glides otherwise once it has loaded). */
const centre = (target: Locator) => target.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));

/**
 * Wait until an element stands still: its reveal (on it or on a section around it) has started and ended, and nothing
 * runs on it, around it or inside it (a finished entrance that holds its last frame is still listed, and is still). A
 * pointer action on a moving element makes Playwright retry with its own `scrollIntoView`, which glides (smooth
 * scrolling once the page has loaded) after the mouse has landed, so the element leaves the mouse and loses its hover.
 */
const still = (target: Locator) =>
  expect
    .poll(
      () =>
        target.evaluate((el) => {
          if (el.closest("[data-reveal]:not([data-shown])")) return -1;
          return document.getAnimations().filter((a) => {
            const node = (a.effect as KeyframeEffect | null)?.target;
            return a.playState === "running" && node instanceof Element && (node.contains(el) || el.contains(node));
          }).length;
        }),
      { timeout: 10_000 },
    )
    .toBe(0);

/** Keyboard focus as a keyboard user reaches it: after a key press, so the element matches :focus-visible. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press("Shift");
  await target.focus();
  expect(await target.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
}

/** The page's own event listeners (window and every node), by type and script place — Playwright's own are left out. */
async function listenerCounter(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const sources = new Map<string, string>();
  cdp.on("Debugger.scriptParsed", (e) => void sources.set(e.scriptId, e.url.replace(/^.*\/_next\/static\//, "")));
  await cdp.send("Debugger.enable");
  return async () => {
    const out: string[] = [];
    for (const expression of ["window", "document"]) {
      const { result } = await cdp.send("Runtime.evaluate", { expression });
      const { listeners: found } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId!, depth: -1 });
      for (const l of found) {
        const source = sources.get(l.scriptId);
        if (source) out.push(`${expression}: ${l.type} @ ${source}:${l.lineNumber}:${l.columnNumber}`);
      }
    }
    return out.sort();
  };
}

/** Every animation and transition the page runs from now on, recorded inside the page (kind, property or name, target). */
const recordMotion = (page: Page) =>
  page.evaluate(() => {
    const seen = new WeakSet<Animation>();
    const log: { kind: string; what: string; target: string; duration: number }[] = [];
    (window as unknown as { __motion: typeof log }).__motion = log;
    const tick = () => {
      for (const a of document.getAnimations()) {
        if (seen.has(a)) continue;
        seen.add(a);
        const effect = a.effect as KeyframeEffect;
        const el = effect?.target as Element | null;
        const kind = a.constructor.name;
        const what = kind === "CSSTransition" ? (a as CSSTransition).transitionProperty : kind === "CSSAnimation" ? (a as CSSAnimation).animationName : "script";
        log.push({ kind, what, target: `${el?.tagName.toLowerCase()}.${String(el?.className ?? "").split(" ")[0]}${effect?.pseudoElement ?? ""}`, duration: Number(effect?.getTiming().duration) || 0 });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const recorded = (page: Page) => page.evaluate(() => (window as unknown as { __motion: { kind: string; what: string; target: string; duration: number }[] }).__motion);

/** What may still change gradually with reduced motion: colours and shadows, never position, size, opacity or a sequence. */
const CALM = /^(color|background-color|border-(top|right|bottom|left)-color|box-shadow|text-decoration-color|-webkit-text-decoration-color|outline-color|--spot)$/;

async function scrollDown(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(60);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------------------------------------------------

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("nothing moves on the way down any page or through its controls: only colours and shadows may change gradually", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    const visits: [string, (page: Page) => Promise<void>][] = [
      [
        "/en",
        async (p) => {
          await p.locator("details[data-dropdown] > summary").first().click();
          await p.keyboard.press("Escape");
          await centre(p.locator("#clients button[data-toggle]"));
          await p.locator("#clients button[data-toggle]").click();
          await centre(p.locator(".a2-mx-pick").nth(2));
          await p.locator(".a2-mx-pick").nth(2).click();
        },
      ],
      ["/en/about", async () => {}],
      ["/en/services/laser-cutting", async () => {}],
      ["/en/services/steel-structures", async () => {}],
      [
        "/en/capabilities",
        async (p) => {
          await centre(p.locator(".cm-pick").nth(3));
          await p.locator(".cm-pick").nth(3).click();
        },
      ],
      [
        "/en/projects",
        async (p) => {
          await p.locator("#gallery").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
          await p.locator(".pj-bar .pj-chip").nth(2).click();
        },
      ],
      [
        "/en/industries",
        async (p) => {
          await centre(p.locator(".in-row").nth(2));
          await p.locator(".in-row").nth(2).hover();
          await p.locator(".in-row").nth(4).hover();
        },
      ],
      [
        "/en/clients",
        async (p) => {
          await centre(p.locator("button[data-toggle]"));
          await p.locator("button[data-toggle]").click();
          await p.locator(".logo-tile").first().hover();
        },
      ],
      [
        "/en/certificates",
        async (p) => {
          const plate = p.locator(".ct-plate").first();
          await centre(plate);
          await plate.hover();
          await plate.click();
          await p.keyboard.press("Escape");
        },
      ],
      ["/en/contact", async (p) => void (await p.locator("#quote form button[type=submit]").first().click())],
      ["/en/projects/clock-tower-landmark", async () => {}],
    ];
    for (const [path, act] of visits) {
      await page.goto(path, { waitUntil: "networkidle" });
      await recordMotion(page);
      await scrollDown(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await act(page);
      await page.waitForTimeout(400);
      const moving = (await recorded(page)).filter((m) => m.kind !== "CSSTransition" || !CALM.test(m.what));
      expect(moving, path).toEqual([]);
    }
    expect(errors).toEqual([]);
  });

  test("the Industries line, the client logos and the About photo change at once (they still animated before Stage 1I)", async ({ page }) => {
    await page.goto("/en/industries", { waitUntil: "networkidle" });
    const row = page.locator(".in-row").nth(3);
    await centre(row);
    await row.hover();
    const line = await row.evaluate((el) => {
      const s = getComputedStyle(el, "::before");
      return { duration: s.transitionDuration, scale: s.scale };
    });
    expect(line).toEqual({ duration: "0s", scale: "1" });

    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const logos = page.locator(".logo-tile img");
    expect(await logos.first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
    await centre(page.locator("button[data-toggle]"));
    await page.locator("button[data-toggle]").click();
    expect(await logos.evaluateAll((imgs) => imgs.filter((img) => getComputedStyle(img).filter !== "none").length)).toBe(0);

    await page.goto("/en", { waitUntil: "networkidle" });
    expect(await page.locator('[data-reveal="clip"] img').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  });

  test("arrows and lifted links keep still on hover and keyboard focus; the colour and the focus ring show the state", async ({ page }) => {
    const still = async (target: Locator, part?: string) => {
      const el = part ? target.locator(part).first() : target;
      await centre(target);
      await target.hover();
      expect(await el.evaluate((e) => getComputedStyle(e).translate)).toBe("none");
      await page.mouse.move(1, 1);
      await keyboardFocus(page, target);
      expect(await el.evaluate((e) => getComputedStyle(e).translate)).toBe("none");
      expect(await target.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
    };
    await page.goto("/en/about", { waitUntil: "networkidle" });
    await still(page.locator(".ip-cta-link").first());
    await still(page.locator(".ip-cta-link").first(), ".mc-icon");
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    await still(page.locator(".cp-row").first(), ".cp-row-action > .mc-icon");
    await page.goto("/en", { waitUntil: "networkidle" });
    await still(page.locator(".a2-hero .btn-primary").first(), ".mc-icon:last-child");
    await still(page.locator(".link-arrow:visible").first(), ".mc-icon");
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    await still(page.locator(".ct-plate").first(), ".ct-plate-img");
  });
});

test.describe("reduced motion turned on while the page is open", () => {
  test("the hero loop stops on the finished plate, the pointer gives the system cursor back; turned off, both carry on", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en", { waitUntil: "networkidle" });
    const plate = page.locator(".a2-hero .a2-plate");
    const loop = () => plate.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.constructor === Animation && a.playState === "running").length);
    // The loop runs once the page has hydrated; only then is the pointer listening (a move before that is not seen).
    await expect.poll(loop).toBeGreaterThan(50);
    await page.mouse.move(700, 420);
    await page.mouse.move(720, 440, { steps: 3 });
    await expect(page.locator("html")).toHaveAttribute("data-cursor-on", "");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(loop).toBe(0);
    await expect(plate).not.toHaveAttribute("data-cycle", /.*/);
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
    await expect(page.locator(".a2-hero [data-running]")).toHaveCount(0);
    await expectPlateFinished(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toBe("none");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(loop).toBeGreaterThan(50);
    await expect(plate).toHaveAttribute("data-cycle", "1");
    await page.mouse.move(760, 460, { steps: 3 });
    await expect(page.locator("html")).toHaveAttribute("data-cursor-on", "");
    expect(errors).toEqual([]);
  });

  test("a signature mid-run shows its finished picture at once; forced colours turned on give the system cursor back too", async ({ page }) => {
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    const sig = page.locator(".sig-cut");
    const running = () => sig.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.constructor === Animation && a.playState === "running").length);
    await expect.poll(running).toBeGreaterThan(20);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(running).toBe(0);
    await expectFinished(page, ["cut"]);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.mouse.move(400, 400);
    await page.mouse.move(420, 420, { steps: 3 });
    await expect(page.locator("html")).toHaveAttribute("data-cursor-on", "");
    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
    await page.mouse.move(440, 440, { steps: 3 });
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Nothing runs unseen
// ---------------------------------------------------------------------------------------------------------------------

test.describe("off screen and hidden", () => {
  test("a signature that leaves the screen rests where it is and carries on when it is back, so it never plays unseen", async ({ page }) => {
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    const sig = page.locator(".sig-cut");
    const clock = () =>
      sig.evaluate((el) => {
        const anims = el.getAnimations({ subtree: true }).filter((a) => a.constructor === Animation);
        return { states: [...new Set(anims.map((a) => a.playState))].sort(), time: Math.round(Number(anims[0]?.currentTime ?? 0)) };
      });
    await expect.poll(async () => (await clock()).states).toEqual(["running"]);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect.poll(async () => (await clock()).states).toEqual(["paused"]);
    const away = (await clock()).time;
    await page.waitForTimeout(1200);
    expect((await clock()).time).toBe(away);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(async () => (await clock()).states).toEqual(["running"]);
    await expect.poll(async () => (await clock()).time).toBeGreaterThan(away);
    // It ends as it always did; then a replay still starts on hover.
    await expect.poll(async () => (await clock()).states, { timeout: 15_000 }).toEqual(["finished"]);
    await expectFinished(page, ["cut"]);
    await page.mouse.move(5, 5);
    await centre(page.locator("[data-sig-host]").first());
    await page.locator("[data-sig-host]").first().hover();
    await expect.poll(async () => (await clock()).states).toContain("running");
  });

  test("scrolled straight through, no page leaves a long or repeating animation running off screen", async ({ page }) => {
    test.setTimeout(120_000);
    for (const path of ["/en", "/en/services", "/en/services/laser-engraving", "/en/capabilities"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await scrollDown(page);
      await page.waitForTimeout(500);
      // The signatures (6–8 s), the hero loop, the scans (2.7 s) and anything that repeats; a reveal's short fade ending
      // just above the screen is not the kind of motion this is about.
      const offScreen = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running")
          .filter((a) => {
            const t = a.effect!.getComputedTiming();
            return t.iterations === Infinity || Number(t.endTime) > 1500;
          })
          .map((a) => (a.effect as KeyframeEffect).target as Element)
          .filter((el) => el && !el.closest(".a2-ambient"))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.bottom < 0 || r.top > innerHeight;
          })
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`),
      );
      expect(offScreen, path).toEqual([]);
    }
  });

  test("while the page is hidden the ambient, the hero's hot points and the machinery console rest; shown again, they carry on", async ({ page }) => {
    const hide = (hidden: boolean) =>
      page.evaluate((h) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);
    const ambient = () => page.locator(".a2-ambient:not(.a2-ambient-frame) > .a2-ambient-field").evaluate((el) => getComputedStyle(el).animationPlayState);
    await page.goto("/en", { waitUntil: "networkidle" });
    const hero = page.locator("section.a2-hero[data-ambient]");
    await expect(hero).toHaveAttribute("data-live", "");
    expect(await ambient()).toMatch(/running/);
    await hide(true);
    await expect(page.locator("html")).toHaveAttribute("data-page-hidden", "");
    await expect(hero).not.toHaveAttribute("data-live", "");
    expect(await ambient()).toMatch(/paused/);
    expect(await page.locator(".a2-plate-pulse > span").first().evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("paused");
    await hide(false);
    await expect(page.locator("html")).not.toHaveAttribute("data-page-hidden", "");
    await expect(hero).toHaveAttribute("data-live", "");
    expect(await ambient()).toMatch(/running/);

    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    const console = page.locator(".cm-console");
    await console.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await expect(console).toHaveAttribute("data-live", "");
    await hide(true);
    await expect(console).not.toHaveAttribute("data-live", "");
    expect(await console.evaluate((el) => getComputedStyle(el).getPropertyValue("--cm-play").trim())).toBe("paused");
    await hide(false);
    await expect(console).toHaveAttribute("data-live", "");
  });

  test("the Capabilities fleet plate's scan waits, unseen, while the plate is off screen, and passes once it is shown", async ({ page }) => {
    const scan = () =>
      page.locator(".cm-fleet > .cm-scan").evaluate((el) =>
        el.getAnimations({ subtree: true }).map((a) => ({ name: (a as CSSAnimation).animationName, state: a.playState, time: Math.round(Number(a.currentTime)), opacity: getComputedStyle(el, (a.effect as KeyframeEffect).pseudoElement).opacity })),
      );
    // An address deep in the page: the hero (and its plate) is above the screen from the start.
    await page.goto("/en/capabilities#fiber-laser-6kw", { waitUntil: "networkidle" });
    await expect(page.locator(".cm-console")).toHaveAttribute("data-ready", "");
    await page.waitForTimeout(3000);
    const away = await scan();
    expect(away.map((a) => a.name).sort()).toEqual(["cm-scan-line", "cm-scan-trail"]);
    for (const a of away) {
      expect(a.state).toBe("paused");
      expect(a.time).toBe(0);
      expect(a.opacity).toBe("0");
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.locator(".cm-fleet")).toHaveAttribute("data-live", "");
    await expect.poll(async () => (await scan()).map((a) => a.state)).toEqual(["running", "running"]);
    // It passes once, then rests.
    await expect.poll(async () => (await scan()).map((a) => a.state), { timeout: 6000 }).toEqual(["finished", "finished"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Reveals
// ---------------------------------------------------------------------------------------------------------------------

test.describe("reveals", () => {
  test("on a phone a sideways rail shows all its cards with the first ones, so a swipe never lands on a blank card", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/en", { waitUntil: "networkidle" });
    for (const rail of await page.locator(".rail:has([data-reveal])").all()) {
      expect(await rail.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      await rail.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
      await expect.poll(() => rail.evaluate((el) => [...el.querySelectorAll("[data-reveal]")].every((card) => card.hasAttribute("data-shown")))).toBe(true);
      await settled(rail);
      // Swiped to its end: the last card is already whole.
      await rail.evaluate((el) => el.scrollTo({ left: el.scrollWidth * (getComputedStyle(el).direction === "rtl" ? -1 : 1), behavior: "instant" }));
      expect(await rail.locator("[data-reveal]").last().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
    await context.close();
  });

  test("where a rail does not scroll sideways (wide screens) its cards still reveal one by one as they come into view", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    const rail = page.locator("#projects .rail");
    expect(await rail.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    // The grid's first row just in view, its second row below the fold.
    await rail.evaluate((el) => window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - innerHeight + 300, behavior: "instant" }));
    const cards = () =>
      rail.locator("[data-reveal]").evaluateAll((els) => els.map((el) => ({ below: el.getBoundingClientRect().top > innerHeight, shown: el.hasAttribute("data-shown") })));
    await expect.poll(async () => (await cards()).some((c) => !c.below && c.shown)).toBe(true);
    const now = await cards();
    expect(now.some((c) => c.below)).toBe(true);
    expect(now.filter((c) => c.below).every((c) => !c.shown)).toBe(true);
  });

  test("a reveal runs once: scrolled back up and down again, nothing reveals twice", async ({ page }) => {
    await page.goto("/en/about", { waitUntil: "networkidle" });
    await scrollDown(page);
    await page.waitForTimeout(900);
    await recordMotion(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await scrollDown(page);
    const again = (await recorded(page)).filter((m) => m.kind === "CSSTransition" && /opacity|transform/.test(m.what));
    expect(again).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Hover and keyboard focus
// ---------------------------------------------------------------------------------------------------------------------

test.describe("keyboard focus shows what hover shows", () => {
  /** The listed properties of each part, read once settled: with the mouse over the control, then with keyboard focus. */
  async function compare(page: Page, target: Locator, parts: Record<string, string[]>) {
    const read = () =>
      target.evaluate(
        (el, parts) =>
          Object.fromEntries(
            Object.entries(parts).map(([sel, props]) => {
              const node = sel === ":self" ? el : el.querySelector(sel)!;
              const s = getComputedStyle(node);
              return [sel, Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]))];
            }),
          ),
        parts,
      );
    await centre(target);
    await still(target);
    const rest = await read();
    await target.hover();
    await settled(target);
    const hovered = await read();
    await page.mouse.move(1, 1);
    await settled(target);
    await keyboardFocus(page, target);
    await settled(target);
    const focused = await read();
    expect(focused).toEqual(hovered);
    expect(focused, "hover changes something").not.toEqual(rest);
    expect(await target.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await target.blur();
  }

  test("buttons, arrow links, the machine picks and the colour switch on the homepage", async ({ page }) => {
    await page.goto("/en", { waitUntil: "networkidle" });
    await compare(page, page.locator(".a2-hero .btn-primary").first(), { ":self": ["background-color", "translate", "box-shadow"] });
    await compare(page, page.locator(".a2-hero .btn-secondary").first(), { ":self": ["background-color", "border-top-color", "translate", "box-shadow"] });
    await compare(page, page.locator(".link-arrow:visible").first(), { ":self": ["text-decoration-color"], ".mc-icon": ["translate"] });
    await compare(page, page.locator('.a2-mx-pick:not([aria-current="true"])').first(), { ":self": ["translate", "border-top-color", "box-shadow"] });
    await compare(page, page.locator("#clients button[data-toggle]"), { ":self": ["border-top-color", "box-shadow"] });
  });

  test("the certificate cards, the closing panel's links, the machinery picks, the filter chips and the service links", async ({ page }) => {
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    await compare(page, page.locator(".ct-plate").first(), { ".ct-plate-img": ["translate"], ".ct-plate-open": ["background-color", "color"] });
    await compare(page, page.locator(".ip-cta-link").first(), { ":self": ["background-color", "border-top-color", "translate"], ".mc-icon": ["translate"] });
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    await compare(page, page.locator('.cm-pick:not([aria-current="true"])').nth(1), { ":self": ["border-top-color", "box-shadow"] });
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    await compare(page, page.locator('.pj-bar .pj-chip[aria-pressed="false"]').nth(1), { ":self": ["border-top-color"] });
    await page.goto("/en/industries", { waitUntil: "networkidle" });
    await compare(page, page.locator(".in-service").first(), { ":self": ["background-color", "border-top-color", "color"] });
    await page.goto("/en/services/fabrication", { waitUntil: "networkidle" });
    await compare(page, page.locator(".sv-call").first(), { ".sv-call-number": ["text-decoration-color"] });
    await page.goto("/ar/projects/clock-tower-landmark", { waitUntil: "networkidle" });
    await compare(page, page.locator(".pd-link").first(), { ":self": ["color", "text-decoration-color"] });
  });

  test("every hover lift takes the same time (320 ms), the certificate preview's included", async ({ page }) => {
    const lift = (target: Locator) => target.evaluate((el) => {
      const s = getComputedStyle(el);
      const i = s.transitionProperty.split(", ").indexOf("translate");
      return s.transitionDuration.split(", ")[i];
    });
    await page.goto("/en", { waitUntil: "networkidle" });
    for (const sel of [".card-link", ".a2-mx-pick", ".logo-tile", ".a2-ind"]) expect(await lift(page.locator(sel).first()), sel).toBe("0.32s");
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    expect(await lift(page.locator(".ct-plate-img").first())).toBe("0.32s");
    expect(await lift(page.locator(".ip-cta-link").first())).toBe("0.32s");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The Industries line
// ---------------------------------------------------------------------------------------------------------------------

test("the active sector's line is scaled out from the start of the row (the right in Arabic), never resized", async ({ page }) => {
  for (const locale of ["en", "ar"] as const) {
    await page.goto(`/${locale}/industries`, { waitUntil: "networkidle" });
    const rows = page.locator(".in-row");
    await centre(rows.nth(2));
    await rows.nth(2).hover();
    await settled(rows.nth(2));
    const line = (i: number) =>
      rows.nth(i).evaluate((el) => {
        const s = getComputedStyle(el, "::before");
        return { scale: s.scale, width: parseFloat(s.width), row: el.getBoundingClientRect().width, originX: parseFloat(s.transformOrigin), property: s.transitionProperty };
      });
    const active = await line(2);
    expect(active.scale).toBe("1");
    expect(Math.abs(active.width - active.row)).toBeLessThan(1);
    expect(active.property).toBe("scale");
    // The line grows from the row's start: the left edge in English, the right edge in Arabic.
    expect(Math.abs(active.originX - (locale === "ar" ? active.width : 0))).toBeLessThan(1);
    expect((await line(0)).scale).toBe("0 1");
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Twenty quick cycles
// ---------------------------------------------------------------------------------------------------------------------

test.describe("twenty quick cycles end consistent", () => {
  test("the phone menu sheet: closed, the page free to scroll, nothing moving, no listener added; the keyboard still works", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = trackErrors(page);
    await page.goto("/en", { waitUntil: "networkidle" });
    const menu = page.locator("details[data-menu][data-sheet]").first();
    const summary = menu.locator("> summary");
    await summary.click();
    await summary.click();
    const listeners = await listenerCounter(page);
    const before = await listeners();
    for (let i = 0; i < 20; i++) {
      await summary.click({ delay: 0 });
      await summary.click({ delay: 0 });
    }
    await expect(menu).not.toHaveAttribute("open", /.*/);
    await settled(menu);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
    expect(await listeners()).toEqual(before);
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open", /.*/);
    await expect(summary).toBeFocused();
    expect(errors).toEqual([]);
    await context.close();
  });

  test("the Services dropdown: closed, focus back on its summary after Escape, no listener added", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/about", { waitUntil: "networkidle" });
    const dropdown = page.locator("details[data-dropdown]").first();
    const summary = dropdown.locator("> summary");
    await summary.click();
    await summary.click();
    const listeners = await listenerCounter(page);
    const before = await listeners();
    for (let i = 0; i < 20; i++) {
      await summary.click({ delay: 0 });
      await (i % 2 ? page.keyboard.press("Escape") : summary.click({ delay: 0 }));
    }
    await expect(dropdown).not.toHaveAttribute("open", /.*/);
    await settled(dropdown);
    expect(await listeners()).toEqual(before);
    await summary.click();
    await expect(dropdown).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(summary).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("the project filters: the last choice pressed and shown, no transition name or mark left, hidden cards out of reach", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = trackErrors(page);
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    await page.locator("#gallery").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.evaluate(() => window.scrollBy({ top: -240, behavior: "instant" }));
    const chips = page.locator(".pj-bar .pj-chip");
    const n = await chips.count();
    await chips.nth(1).click();
    await chips.nth(0).click();
    const listeners = await listenerCounter(page);
    const before = await listeners();
    for (let cycle = 0; cycle < 20; cycle++) await chips.nth((cycle % (n - 1)) + 1).click({ delay: 0 });
    const last = (19 % (n - 1)) + 1;
    await expect(chips.nth(last)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.pj-bar .pj-chip[aria-pressed="true"]')).toHaveCount(1);
    await expect.poll(() => page.locator("html").getAttribute("data-vt"), { timeout: 5_000 }).toBeNull();
    const state = await page.evaluate(() => {
      const items = [...document.querySelectorAll<HTMLElement>("[data-project]")];
      return {
        named: items.filter((el) => getComputedStyle(el).viewTransitionName !== "none").length,
        shown: items.filter((el) => !el.hidden).length,
        reachable: items.filter((el) => el.hidden).flatMap((el) => [...el.querySelectorAll("a")]).filter((a) => a.checkVisibility()).length,
        live: document.querySelector(".pj-list")!.closest(".shell")!.querySelector("[aria-live]")!.textContent,
      };
    });
    const choice = (await chips.nth(last).textContent())!.trim();
    expect(state.named).toBe(0);
    expect(state.reachable).toBe(0);
    expect(state.shown).toBeGreaterThan(0);
    expect(state.live).toContain(choice);
    expect(await listeners()).toEqual(before);
    expect(errors).toEqual([]);
  });

  test("a filter choice moves only the gallery's items: the page itself is not captured (no full-screen cross-fade)", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    await page.locator("#gallery").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.evaluate(() => window.scrollBy({ top: -240, behavior: "instant" }));
    // Read the names inside the transition's own update, when the browser has taken the old picture, and again once the
    // transition has ended: on its own `finished` (not a fixed time; under the full suite's load the 450 ms transition
    // was still running 900 ms after the click), plus one task, so the page's own `finally` has cleared its mark.
    const seen = await page.evaluate(async () => {
      const read = () => ({
        root: getComputedStyle(document.documentElement).viewTransitionName,
        items: [...document.querySelectorAll(".pj-item")].filter((el) => getComputedStyle(el).viewTransitionName !== "none").length,
        mark: document.documentElement.getAttribute("data-vt"),
      });
      const start = document.startViewTransition.bind(document);
      let during: ReturnType<typeof read> | undefined;
      let running: ViewTransition | undefined;
      document.startViewTransition = ((update: () => void) =>
        (running = start(() => (update(), (during = read()))))) as typeof document.startViewTransition;
      document.querySelectorAll<HTMLButtonElement>(".pj-bar .pj-chip")[2].click();
      await running?.finished;
      await new Promise((r) => setTimeout(r, 0));
      return { during, after: read() };
    });
    expect(seen.during?.mark).toBe("gallery-filter");
    expect(seen.during?.root).toBe("none");
    expect(seen.during?.items).toBeGreaterThan(0);
    expect(seen.after).toEqual({ root: "root", items: 0, mark: null });
  });

  test("the clients' colour switch: its state and the wall agree, nothing moving, no listener added", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const toggle = page.locator("button[data-toggle]");
    await centre(toggle);
    await toggle.click();
    await toggle.click();
    const listeners = await listenerCounter(page);
    const before = await listeners();
    for (let i = 0; i < 21; i++) await toggle.click({ delay: 0 });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const wall = page.locator(`#${await toggle.getAttribute("aria-controls")}`);
    await expect(wall).toHaveAttribute("data-colour", "");
    await settled(wall);
    await settled(toggle);
    expect(await wall.locator("img").evaluateAll((imgs) => imgs.filter((img) => getComputedStyle(img).filter !== "none").length)).toBe(0);
    expect(await listeners()).toEqual(before);
    await page.keyboard.press("Shift");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(errors).toEqual([]);
  });

  test("the certificate dialog: closed, focus back on its card, the pointer's mark gone, no listener added", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = trackErrors(page);
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    const plate = page.locator(".ct-plate").first();
    await centre(plate);
    const open = page.locator("dialog.ct-dialog[open]");
    await plate.click();
    await page.keyboard.press("Escape");
    await expect(open).toHaveCount(0);
    const listeners = await listenerCounter(page);
    const before = await listeners();
    for (let i = 0; i < 20; i++) {
      await plate.click({ delay: 0 });
      await expect(open).toHaveCount(1);
      if (i % 3 === 0) await page.keyboard.press("Escape");
      else if (i % 3 === 1) await open.locator(".ct-close").click({ delay: 0 });
      else await page.mouse.click(4, 4);
    }
    await expect(open).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-modal", /.*/);
    await expect(plate).toBeFocused();
    expect(await listeners()).toEqual(before);
    expect(errors).toEqual([]);
  });
});
