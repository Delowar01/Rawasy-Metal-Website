import { test, expect, type Page } from "@playwright/test";
import { projectCategories } from "../src/content/projects";

/**
 * Text keeps AA contrast through the motion, not only at rest (Stage 1I corrections 1, 2 and 3).
 *
 * The Capabilities machine change and the certificate dialog (correction 1), the homepage machine change, the scroll
 * reveals, the homepage entrance, the Services dropdown, the phone menu sheet and the homepage project cards' label
 * (correction 2), and a Projects filter toggle pressed and released and the certificate preview's open indicator, an
 * aria-hidden plus icon held to 3:1 against its circle (correction 3, at the end of this file), are held part-way
 * through — every animation the change
 * starts is paused at exactly T ms (a CSS transition's delay counts in that time), everything else where it stands —
 * and each held frame is checked as it is drawn: axe-core finds nothing; every text node shown is at full strength
 * (its opacity through every ancestor is 1, so it never passes through a half-faded, lower-contrast frame); each one's
 * colour against every background pixel under its glyphs (text and icons hidden, the held frame otherwise unchanged)
 * reaches AA, unrounded; one machine's words at a time; the selector's focus ring drawn. Nothing waits for the motion
 * to end: the held frames are the point.
 */

const AXE = require.resolve("axe-core/axe.min.js");

type Combo = { locale: "en" | "ar"; theme: "light" | "dark"; phone: boolean };
const COMBOS: Combo[] = [
  { locale: "en", theme: "light", phone: false },
  { locale: "en", theme: "dark", phone: false },
  { locale: "ar", theme: "light", phone: false },
  { locale: "ar", theme: "dark", phone: false },
  { locale: "en", theme: "light", phone: true },
  { locale: "ar", theme: "dark", phone: true },
];
const label = (c: Combo) => `${c.locale} ${c.theme} ${c.phone ? "phone" : "desktop"}`;

const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

async function open(page: Page, c: Pick<Combo, "locale" | "theme">, path: string) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("rawasy-theme", t);
    } catch {}
  }, c.theme);
  await page.goto(`/${c.locale}${path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: AXE });
}

type Change = { pick: string } | { dialog: "open" | "close" } | { machine: number } | { menu: "dropdown" | "sheet" } | { card: number };

/**
 * Makes a change inside one page task — a machine chosen (focused, then clicked; on Capabilities or the homepage), the
 * dialog opened or closed, a menu opened from its focused button, a project card focused — and holds everything it starts
 * at T ms (null: lets it finish). React renders the change after the event, so the hold waits for it to be committed first
 * (a few microtasks at most).
 */
async function hold(page: Page, change: Change, T: number | null) {
  return page.evaluate(
    async ({ change, T }) => {
      const before = new Set(document.getAnimations());
      // Only what was running before the change is resumed afterwards (play() on a finished animation restarts it).
      (window as unknown as { __resume: Animation[] }).__resume = [...before].filter((a) => a.playState === "running");
      const dialog = document.querySelector<HTMLDialogElement>(".ct-dialog");
      let done: () => boolean;
      if ("pick" in change) {
        const pick = document.querySelector<HTMLAnchorElement>(`.cm-pick[href="#${change.pick}"]`)!;
        pick.focus({ preventScroll: true });
        pick.click();
        done = () => document.querySelector(".cm-panel[data-active]")?.id === change.pick;
      } else if ("machine" in change) {
        const pick = document.querySelectorAll<HTMLAnchorElement>(".a2-mx-pick")[change.machine];
        const panel = document.querySelectorAll(".a2-mx-panel")[change.machine];
        pick.focus({ preventScroll: true });
        pick.click();
        done = () => panel.classList.contains("is-active");
      } else if ("menu" in change) {
        const menu = document.querySelector<HTMLDetailsElement>(change.menu === "dropdown" ? "details[data-dropdown]" : "details[data-sheet]")!;
        const button = menu.querySelector<HTMLElement>(":scope > summary")!;
        button.focus({ preventScroll: true });
        button.click();
        done = () => menu.open;
      } else if ("card" in change) {
        const card = document.querySelectorAll<HTMLAnchorElement>(".a2-proj")[change.card];
        card.focus({ preventScroll: true });
        done = () => card.matches(":focus-within");
      } else if (change.dialog === "open") {
        document.querySelector<HTMLAnchorElement>(".ct-plate")!.click();
        done = () => !!dialog?.open && !!dialog.querySelector(".ct-dialog-inner");
      } else {
        document.querySelector<HTMLButtonElement>(".ct-close")!.click();
        done = () => !dialog?.open;
      }
      for (let i = 0; i < 20 && !done(); i++) await (i < 5 ? Promise.resolve() : new Promise((r) => setTimeout(r, 0)));
      document.body.getBoundingClientRect();
      for (const el of document.querySelectorAll(".cm-panel, .cm-panel *, dialog, dialog *, .a2-mx-stage, .a2-mx-stage *, details[data-menu], details[data-menu] *, .a2-proj, .a2-proj *"))
        getComputedStyle(el).getPropertyValue("opacity");
      const fresh = document.getAnimations().filter((a) => !before.has(a));
      (window as unknown as { __held: Animation[] }).__held = fresh;
      if (T === null) {
        for (const a of fresh)
          try {
            a.finish();
          } catch {}
      } else {
        document.getAnimations().forEach((a) => a.pause());
        for (const a of fresh) {
          a.pause();
          a.currentTime = T;
        }
      }
      return { committed: done(), held: fresh.length };
    },
    { change, T },
  );
}

/**
 * On phones the selector scrolls sideways (smoothly) to keep the chosen card in view. A scroll is not an animation a hold
 * can pause, so it comes to rest before glyph boxes and pixels are read; the held motion stays held meanwhile.
 */
async function railAtRest(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const list = document.querySelector(".cm-rail ol");
        let last = list?.scrollLeft ?? 0;
        let same = 0;
        const tick = () => {
          const now = list?.scrollLeft ?? 0;
          same = now === last ? same + 1 : 0;
          last = now;
          if (same >= 4) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

/**
 * Lets go: what the change started is cancelled, so CSS settles at its own end values and no paused or finished copy is
 * left behind (Chromium keeps a CSS animation the API has touched after its rule stops applying, and a later play() would
 * replay it over another frame); what was running before the change carries on.
 */
async function release(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __held: Animation[]; __resume: Animation[] };
    for (const a of w.__held ?? []) a.cancel();
    for (const a of w.__resume ?? []) a.play();
  });
}

/** axe-core on the held frame: WCAG A/AA (2.0–2.2) and best practice. */
async function axe(page: Page) {
  return page.evaluate(async () => {
    const res = await (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return res.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  });
}

type Shown = { text: string; owner: string | null; opacity: number; color: number[]; large: boolean; boxes: number[][] };

/** Every text node drawn under `scope`, with its opacity through every ancestor and its glyph boxes in view. */
function textsShown(page: Page, scope: string) {
  return page.evaluate((scope) => {
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (c: string) => {
      cv.clearRect(0, 0, 1, 1);
      cv.fillStyle = "#000";
      cv.fillStyle = c;
      cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const out: Shown[] = [];
    for (const root of document.querySelectorAll(scope)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.textContent?.trim()) continue;
        const el = n.parentElement!;
        if (el.closest(".sr-only")) continue;
        // Text drawn inside a decorative drawing (SVG in aria-hidden art, such as the hero plate's part mark) is part of
        // the drawing, which the brief leaves out of this check.
        if (el.closest("svg") && el.closest('[aria-hidden="true"]')) continue;
        const st = getComputedStyle(el);
        if (st.visibility !== "visible") continue;
        let opacity = 1;
        for (let e: Element | null = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
        if (opacity === 0) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        // A glyph box counts only where it is drawn: cut to every ancestor that clips its overflow (a scrolling list or
        // sheet), so text scrolled out of a menu is not measured against what is drawn there instead. Nothing above a
        // modal dialog (the top layer) or a fixed element clips it.
        const cut = (b: DOMRect) => {
          let [left, top, right, bottom] = [b.left, b.top, b.right, b.bottom];
          for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
              const c = e.getBoundingClientRect();
              const [x, y] = [c.left + e.clientLeft, c.top + e.clientTop];
              if (cs.overflowX !== "visible") [left, right] = [Math.max(left, x), Math.min(right, x + e.clientWidth)];
              if (cs.overflowY !== "visible") [top, bottom] = [Math.max(top, y), Math.min(bottom, y + e.clientHeight)];
            }
            if (e.matches(":modal") || cs.position === "fixed") break;
          }
          return { left, top, right, bottom, width: right - left, height: bottom - top };
        };
        const boxes = [...r.getClientRects()]
          .map(cut)
          .filter((b) => b.width > 1 && b.height > 1 && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth)
          .map((b) => [b.left, b.top, b.width, b.height]);
        if (!boxes.length) continue;
        const size = parseFloat(st.fontSize);
        out.push({
          text: n.textContent.trim().slice(0, 40),
          owner: el.closest(".cm-panel, .a2-mx-panel")?.id ?? null,
          opacity,
          color: rgba(st.color),
          large: size >= 24 || (size >= 18.66 && Number(st.fontWeight) >= 700),
          boxes,
        });
      }
    }
    return out;
  }, scope);
}

/**
 * The worst contrast of each text shown, measured against the pixels drawn under its glyphs: the frame is captured with
 * the text and icons under `scope` made transparent (colour transitions that starts are finished at once; what is held
 * stays held), and each text's colour, through its opacity, is set against every one of those pixels. Unrounded.
 */
async function contrastOf(page: Page, scope: string, shown: Shown[]) {
  await page.evaluate((scope) => {
    const before = new Set(document.getAnimations());
    const s = document.createElement("style");
    s.id = "hide-text";
    s.textContent = `${scope}, ${scope} *, ${scope} *::before, ${scope} *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important; text-shadow: none !important } ${scope} svg.mc-icon { visibility: hidden !important }`;
    document.head.append(s);
    document.body.getBoundingClientRect();
    for (const el of document.querySelectorAll(`${scope}, ${scope} *`)) getComputedStyle(el).getPropertyValue("color");
    for (const a of document.getAnimations().filter((a) => !before.has(a)))
      try {
        a.finish();
      } catch {}
  }, scope);
  const shot = await page.screenshot();
  await page.evaluate(() => {
    const before = new Set(document.getAnimations());
    document.getElementById("hide-text")?.remove();
    document.body.getBoundingClientRect();
    for (const a of document.getAnimations().filter((a) => !before.has(a)))
      try {
        a.finish();
      } catch {}
  });
  const pixels = await page.evaluate(
    async ({ b64, boxes }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const k = img.width / innerWidth;
      return boxes.map((list) => {
        const px: number[][] = [];
        for (const [x, y, w, h] of list) {
          const d = ctx.getImageData(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))).data;
          for (let i = 0; i < d.length; i += 8) px.push([d[i], d[i + 1], d[i + 2]]);
        }
        return px;
      });
    },
    { b64: shot.toString("base64"), boxes: shown.map((t) => t.boxes) },
  );
  return shown.map((t, i) => {
    const [r, g, b, a] = t.color;
    const alpha = a * t.opacity;
    let worst = Infinity;
    for (const p of pixels[i]) worst = Math.min(worst, ratio([r, g, b].map((v, k) => v * alpha + p[k] * (1 - alpha)), p));
    return { text: t.text, ratio: worst, need: t.large ? 3 : 4.5 };
  });
}

/** Checks one held frame: axe, every text shown at full strength and at AA against what is drawn under it. */
async function checkFrame(page: Page, scope: string, at: string) {
  expect(await axe(page), `axe at ${at}`).toEqual([]);
  const shown = await textsShown(page, scope);
  const faded = shown.filter((t) => t.opacity < 1).map((t) => `"${t.text}" at opacity ${t.opacity.toFixed(3)}`);
  expect(faded, `text half-faded at ${at}`).toEqual([]);
  const low = (await contrastOf(page, scope, shown)).filter((r) => r.ratio < r.need).map((r) => `"${r.text}" ${r.ratio.toFixed(3)} < ${r.need}`);
  expect(low, `text below AA at ${at}`).toEqual([]);
  return shown;
}

for (const c of COMBOS) {
  test.describe(`held part-way, ${label(c)}`, () => {
    test.use({
      viewport: c.phone ? { width: 390, height: 1300 } : { width: 1440, height: 900 },
      colorScheme: c.theme,
      ...(c.phone ? { isMobile: true, hasTouch: true } : {}),
    });

    test("Capabilities: a machine change shows one machine's words, at full strength and AA, in every frame; the focus ring stays drawn", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, c, "/capabilities");
      await expect(page.locator(".cm-console")).toHaveAttribute("data-ready", "");
      await page.locator("#console").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await expect(page.locator(".cm-console")).toHaveAttribute("data-live", "");
      // The first machine's own scan and sketch (one pass each) run out before the first change.
      await expect.poll(() => page.locator(".cm-console").evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length), { timeout: 10_000 }).toBe(0);
      await page.keyboard.press("Shift"); // keyboard modality, so the pick's focus ring is :focus-visible
      const picks = await page.locator(".cm-pick").evaluateAll((as) => as.map((a) => a.getAttribute("href")!.slice(1)));
      // 0 / 80 / 160 / 240 / 320 / 480 / 600 ms and about 25, 50 and 75 % of the 600 ms hand-off (150, 300, 450 ms).
      const times = [0, 80, 150, 160, 240, 300, 320, 450, 480, 600];
      for (const [i, T] of times.entries()) {
        const slug = picks[(i % (picks.length - 1)) + 1];
        const r = await hold(page, { pick: slug }, T);
        expect(r.committed, `${slug} chosen`).toBe(true);
        expect(r.held, `a change at ${T} ms starts motion`).toBeGreaterThan(0);
        await railAtRest(page);
        const shown = await checkFrame(page, ".cm-console", `${T} ms (${slug})`);
        // One machine's words at a time: the one coming in.
        expect([...new Set(shown.map((t) => t.owner).filter(Boolean))], `machines with words shown at ${T} ms`).toEqual([slug]);
        // The pick keeps its focus ring and its current state through the change.
        const focus = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement;
          const s = getComputedStyle(a);
          return { pick: a.getAttribute("href"), current: a.getAttribute("aria-current"), ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2, visible: a.matches(":focus-visible") };
        });
        expect(focus, `focus at ${T} ms`).toEqual({ pick: `#${slug}`, current: "true", ring: true, visible: true });
        await release(page);
        await page.waitForTimeout(250);
      }
      // Settled, the same holds.
      const last = picks[1];
      await hold(page, { pick: last }, null);
      await railAtRest(page);
      await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
      const shown = await checkFrame(page, ".cm-console", "settled");
      expect([...new Set(shown.map((t) => t.owner).filter(Boolean))]).toEqual([last]);
    });

    test("Certificates: the dialog's words are at full strength and AA in every frame of its opening and closing", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, c, "/certificates");
      const plate = page.locator(".ct-plate").first();
      await plate.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
      // Opening: 0 ms and about 25, 50, 75 and 100 % of its 320 ms (80, 160, 240, 320 ms).
      for (const T of [0, 80, 160, 240, 320]) {
        const r = await hold(page, { dialog: "open" }, T);
        expect(r.committed).toBe(true);
        expect(r.held, `the opening at ${T} ms moves`).toBeGreaterThan(0);
        await page.evaluate(() => Promise.all([...document.querySelectorAll<HTMLImageElement>(".ct-dialog img")].map((i) => i.decode().catch(() => {}))));
        const shown = await checkFrame(page, ".ct-dialog", `opening, ${T} ms`);
        // The dialog's words are there from the first frame: issuer, title, the preview labels, the note.
        expect(shown.length, `words shown at ${T} ms`).toBeGreaterThanOrEqual(4);
        await release(page);
        await page.keyboard.press("Escape");
        await expect(page.locator("dialog.ct-dialog[open]")).toHaveCount(0);
        await page.waitForTimeout(450);
      }
      // Closing: about 25, 50 and 75 % of its 320 ms. The dialog's words are gone at once: never half-faded.
      for (const T of [80, 160, 240]) {
        await plate.click();
        await expect(page.locator("dialog.ct-dialog[open]")).toHaveCount(1);
        await page.waitForTimeout(450);
        await hold(page, { dialog: "close" }, T);
        const shown = await checkFrame(page, ".ct-dialog", `closing, ${T} ms`);
        expect(shown, `dialog words shown while closing at ${T} ms`).toEqual([]);
        await release(page);
        await page.waitForTimeout(450);
      }
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Stage 1I correction 2: the rest of the motion that showed text — the homepage machine change, the scroll reveals, the
// homepage entrance, the Services dropdown, the phone menu sheet and the homepage project cards' label — held at 0, 25,
// 50, 75 and 100 % (with a few early frames), and settled, in EN/AR × light/dark at 1440 × 900 and 390 × 844 (the
// reveals also at 320 × 700).
// ---------------------------------------------------------------------------------------------------------------------

type View = "desktop" | "phone" | "small";
type Combo2 = { locale: "en" | "ar"; theme: "light" | "dark"; view: View };
const VIEWPORTS: Record<View, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
  small: { width: 320, height: 700 },
};
const COMBOS2: Combo2[] = (["desktop", "phone", "small"] as const).flatMap((view) =>
  (["en", "ar"] as const).flatMap((locale) => (["light", "dark"] as const).map((theme) => ({ locale, theme, view }))),
);
const label2 = (c: Combo2) => `${c.locale} ${c.theme} ${VIEWPORTS[c.view].width} × ${VIEWPORTS[c.view].height}`;

/**
 * A fresh document, at the top of the page: Chromium does not restart a CSS animation the API has cancelled when its rule
 * applies again, and a reveal happens once per document.
 */
async function reload(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: AXE });
}

/** Waits until nothing under `scope` moves (polled; a few frames at most once the motion is over). */
async function still(page: Page, scope: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          (scope) => [...document.querySelectorAll(scope)].flatMap((el) => el.getAnimations({ subtree: true })).filter((a) => a.playState === "running").length,
          scope,
        ),
      { timeout: 10_000 },
    )
    .toBe(0);
}

/** Whether the focused element shows its focus ring (keyboard modality). */
function focusShown(page: Page) {
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const s = getComputedStyle(a);
    return { ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2, visible: a.matches(":focus-visible") };
  });
}

/**
 * A scroll reveal held part-way: the first element of the kind that holds words and waits below the fold is scrolled into
 * view, the page's own observer shows it (caught by a MutationObserver in the same task), and everything that starts is
 * held at the element's own turn (its stagger delay) + T ms (null: finished).
 */
async function holdReveal(page: Page, kind: "default" | "fade", T: number | null) {
  return page.evaluate(
    ({ kind, T }) =>
      new Promise<{ held: number; own: number; text: string }>((resolve, reject) => {
        const sel = kind === "fade" ? '[data-reveal="fade"]' : '[data-reveal]:not([data-reveal="fade"]):not([data-reveal="clip"])';
        const words = (el: Element) => [el, ...el.querySelectorAll("*")].some((e) => !e.closest("svg") && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()));
        const el = [...document.querySelectorAll(`main ${sel}:not([data-shown])`)].find((e) => !e.closest(".ip-hero") && e.getBoundingClientRect().top > innerHeight && words(e));
        if (!el) return reject(new Error(`no ${kind} reveal with words below the fold`));
        el.setAttribute("data-held-reveal", "");
        const before = new Set(document.getAnimations());
        const w = window as unknown as { __held: Animation[]; __resume: Animation[] };
        w.__resume = [...before].filter((a) => a.playState === "running");
        const mo = new MutationObserver(() => {
          if (!el.hasAttribute("data-shown")) return;
          mo.disconnect();
          document.body.getBoundingClientRect();
          for (const e of document.querySelectorAll("[data-reveal], [data-reveal] *")) getComputedStyle(e).getPropertyValue("opacity");
          const delay = parseFloat(getComputedStyle(el).transitionDelay) * 1000 || 0;
          const fresh = document.getAnimations().filter((a) => !before.has(a));
          w.__held = fresh;
          if (T === null)
            for (const a of fresh)
              try {
                a.finish();
              } catch {}
          else {
            document.getAnimations().forEach((a) => a.pause());
            for (const a of fresh) {
              a.pause();
              a.currentTime = delay + T;
            }
          }
          resolve({ held: fresh.length, own: fresh.filter((a) => el.contains((a.effect as KeyframeEffect).target)).length, text: el.textContent!.trim().slice(0, 40) });
        });
        mo.observe(el, { attributes: true, attributeFilter: ["data-shown"] });
        el.scrollIntoView({ block: "center", behavior: "instant" });
      }),
    { kind, T },
  );
}

/** The homepage entrance held t ms after it began (each item at its own point of its staggered run; null: finished). */
function holdEntrance(page: Page, t: number | null) {
  return page.evaluate((t) => {
    const items = document.getAnimations().filter((a) => (a as CSSAnimation).animationName === "a2-rise");
    document.getAnimations().forEach((a) => a.pause());
    for (const a of items) a.currentTime = t ?? Number(a.effect!.getComputedTiming().endTime);
    return items.length;
  }, t);
}

const pauseAll = (page: Page) => page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));

for (const c of COMBOS2) {
  test.describe(`held part-way, ${label2(c)}`, () => {
    test.use({ viewport: VIEWPORTS[c.view], colorScheme: c.theme, ...(c.view !== "desktop" ? { isMobile: true, hasTouch: true } : {}) });

    test("scroll reveals: a reveal's words are at full strength and AA in every frame, from its first (an inner page and a service page)", async ({ page }) => {
      test.setTimeout(180_000);
      for (const [path, kind] of [
        ["/about", "default"],
        ["/services/laser-cutting", "fade"],
      ] as const) {
        await open(page, c, path);
        // 0, 25, 50, 75 and 100 % of the 700 ms reveal from the element's own turn, then settled; a fresh document for each.
        for (const T of [0, 175, 350, 525, 700, null]) {
          if (T !== 0) await reload(page);
          const r = await holdReveal(page, kind, T);
          if (kind === "default") expect(r.own, `${path}: the reveal at ${T} ms moves`).toBeGreaterThan(0);
          if (T === null) await pauseAll(page);
          const shown = await checkFrame(page, "[data-held-reveal]", `${path}, ${kind} reveal, ${T ?? "settled"} ms ("${r.text}")`);
          // Its words show from its first frame: never half-faded, never waiting unseen once its turn has come.
          expect(shown.length, `${path}: words shown at ${T ?? "settled"} ms`).toBeGreaterThan(0);
          await release(page);
        }
      }
    });

    if (c.view === "small") return;

    test("homepage: a machine change shows one machine's words, at full strength and AA, in every frame; the focus ring stays drawn", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, c, "");
      const stage = page.locator(".a2-mx-stage");
      await expect(stage).toHaveAttribute("data-js", "");
      await stage.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await expect.poll(() => stage.evaluate((el) => el.closest("[data-reveal]")!.hasAttribute("data-shown"))).toBe(true);
      await still(page, "#machinery");
      await page.keyboard.press("Shift"); // keyboard modality, so the pick's focus ring is :focus-visible
      // 0, 25, 50, 75 and 100 % of the 600 ms hand-off, 80 and 160 ms (the old cross-fade's worst) and 900 ms (the photo
      // settled).
      for (const [i, T] of [0, 80, 150, 160, 300, 450, 600, 900].entries()) {
        const machine = (i % 5) + 1;
        const r = await hold(page, { machine }, T);
        expect(r.committed, `machine ${machine} chosen`).toBe(true);
        expect(r.held, `a change at ${T} ms starts motion`).toBeGreaterThan(0);
        const id = await page.locator(".a2-mx-panel").nth(machine).getAttribute("id");
        const shown = await checkFrame(page, ".a2-mx-stage", `${T} ms (${id})`);
        // One machine's words at a time: the one coming in.
        expect([...new Set(shown.map((t) => t.owner).filter(Boolean))], `machines with words shown at ${T} ms`).toEqual([id]);
        const focus = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement;
          const s = getComputedStyle(a);
          return { pick: a.getAttribute("href"), current: a.getAttribute("aria-current"), ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2, visible: a.matches(":focus-visible") };
        });
        expect(focus, `focus at ${T} ms`).toEqual({ pick: `#${id}`, current: "true", ring: true, visible: true });
        await release(page);
        await still(page, ".a2-mx-stage");
      }
      // Settled, the same holds.
      await hold(page, { machine: 0 }, null);
      await pauseAll(page);
      const shown = await checkFrame(page, ".a2-mx-stage", "settled");
      expect([...new Set(shown.map((t) => t.owner).filter(Boolean))]).toEqual([await page.locator(".a2-mx-panel").first().getAttribute("id")]);
    });

    test("homepage entrance: the hero's words are at full strength and AA in every frame", async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, c, "");
      // Each item runs 900 ms, staggered over 420 ms: held at 0, 25, 50, 75 and 100 % of the 1,320 ms (and at 70 and 140 ms,
      // the first items' early frames), then finished.
      for (const t of [0, 70, 140, 330, 660, 990, 1320, null]) {
        expect(await holdEntrance(page, t), "the entrance's items").toBe(8);
        const items = await page.locator("[data-enter]").evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
        expect(items, `the items' opacity at ${t ?? "the end"} ms`).toEqual(Array(8).fill("1"));
        const shown = await checkFrame(page, "[data-enter]", `entrance, ${t ?? "finished"} ms`);
        expect(shown.length, `words shown at ${t ?? "the end"} ms`).toBeGreaterThan(5);
      }
    });

    if (c.view === "desktop") {
      test("Services dropdown: its words are at full strength and AA in every frame of its opening; its button keeps its focus ring", async ({ page }) => {
        test.setTimeout(120_000);
        await open(page, c, "");
        // 0, 25, 50, 75 and 100 % of its 320 ms, then open and settled; a fresh document for each.
        for (const T of [0, 80, 160, 240, 320, null]) {
          if (T !== 0) await reload(page);
          await page.keyboard.press("Shift");
          const r = await hold(page, { menu: "dropdown" }, T);
          expect(r.committed).toBe(true);
          if (T === null) await pauseAll(page);
          else expect(r.held, `the opening at ${T} ms moves`).toBeGreaterThan(0);
          const shown = await checkFrame(page, ".a2-dd-panel", `opening, ${T ?? "settled"} ms`);
          // All of it from the first frame: the six services with their lines, all services and the quote.
          expect(shown.length, `words shown at ${T ?? "settled"} ms`).toBeGreaterThanOrEqual(8);
          expect(await focusShown(page), `focus at ${T ?? "settled"} ms`).toEqual({ ring: true, visible: true });
        }
      });

      test("homepage project card: its label is at full strength and AA in every frame of its appearance on keyboard focus", async ({ page }) => {
        test.setTimeout(120_000);
        await open(page, c, "");
        const first = page.locator(".a2-proj").first();
        await first.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
        await expect.poll(() => first.evaluate((el) => el.closest("[data-reveal]")!.hasAttribute("data-shown"))).toBe(true);
        await still(page, "#projects");
        await page.keyboard.press("Shift");
        // 0, 25, 50, 75 and 100 % of its 320 ms, then settled; two cards in turn.
        for (const [i, T] of [0, 80, 160, 240, 320, null].entries()) {
          const card = i % 2;
          const r = await hold(page, { card }, T);
          expect(r.committed).toBe(true);
          if (T === null) await pauseAll(page);
          else expect(r.held, `the label at ${T} ms moves`).toBeGreaterThan(0);
          await page.locator(".a2-proj").nth(card).evaluate((el) => el.setAttribute("data-held-card", ""));
          const shown = await checkFrame(page, "[data-held-card]", `card ${card}, ${T ?? "settled"} ms`);
          // The title and "View in the gallery", from the first frame.
          expect(shown.some((t) => /gallery|معرض/.test(t.text)), `the label shown at ${T ?? "settled"} ms`).toBe(true);
          expect(await focusShown(page), `focus at ${T ?? "settled"} ms`).toEqual({ ring: true, visible: true });
          await page.locator("[data-held-card]").evaluate((el) => el.removeAttribute("data-held-card"));
          await release(page);
          await page.evaluate(() => (document.activeElement as HTMLElement).blur());
          await still(page, ".a2-proj");
        }
      });
    }

    if (c.view === "phone")
      test("phone menu: its words are at full strength and AA in every frame of its opening; its button keeps its focus ring", async ({ page }) => {
        test.setTimeout(120_000);
        await open(page, c, "");
        // 0, 25, 50, 75 and 100 % of its 320 ms, then open and settled; a fresh document for each.
        for (const T of [0, 80, 160, 240, 320, null]) {
          if (T !== 0) await reload(page);
          await page.keyboard.press("Shift");
          const r = await hold(page, { menu: "sheet" }, T);
          expect(r.committed).toBe(true);
          if (T === null) await pauseAll(page);
          else expect(r.held, `the opening at ${T} ms moves`).toBeGreaterThan(0);
          const shown = await checkFrame(page, ".a2-sheet", `opening, ${T ?? "settled"} ms`);
          // All of it from the first frame: the pages, the services' row, the language, the theme and the quote.
          expect(shown.length, `words shown at ${T ?? "settled"} ms`).toBeGreaterThanOrEqual(8);
          expect(await focusShown(page), `focus at ${T ?? "settled"} ms`).toEqual({ ring: true, visible: true });
        }
      });
  });
}

test.describe("with reduced motion, correction 2's changes are immediate", () => {
  test.use({ viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: "reduce" } });

  test("the entrance, a machine change, the dropdown and a reveal start no motion, and every word is at full strength", async ({ page }) => {
    test.setTimeout(120_000);
    for (const locale of ["en", "ar"] as const) {
      await open(page, { locale, theme: "light" }, "");
      expect(await page.evaluate(() => document.getAnimations().filter((a) => (a as CSSAnimation).animationName === "a2-rise").length), "entrance").toBe(0);
      expect(await page.locator("[data-enter]").evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))).toEqual(Array(8).fill("1"));
      await page.locator(".a2-mx-stage").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.keyboard.press("Shift");
      await hold(page, { machine: 3 }, 0);
      expect(await page.locator(".a2-mx-stage").evaluate((el) => el.getAnimations({ subtree: true }).length), "machine change").toBe(0);
      const id = await page.locator(".a2-mx-panel").nth(3).getAttribute("id");
      const shown = await checkFrame(page, ".a2-mx-stage", `${locale} machine change, reduced motion`);
      expect([...new Set(shown.map((t) => t.owner).filter(Boolean))]).toEqual([id]);
      await release(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await hold(page, { menu: "dropdown" }, 0);
      expect(await page.locator(".a2-dd-panel").evaluate((el) => el.getAnimations({ subtree: true }).length), "dropdown").toBe(0);
      await checkFrame(page, ".a2-dd-panel", `${locale} dropdown, reduced motion`);
      await release(page);
      await page.keyboard.press("Escape");
      const r = await holdReveal(page, "default", 0);
      expect(r.own, "reveal").toBe(0);
      expect((await checkFrame(page, "[data-held-reveal]", `${locale} reveal, reduced motion`)).length).toBeGreaterThan(0);
      await release(page);
    }
  });
});

test.describe("without JavaScript, the homepage machinery is a list of anchors", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });

  test("one machine shows at a time, the first or the one the address names, with its words at full strength", async ({ page }) => {
    for (const locale of ["en", "ar"] as const) {
      await page.goto(`/${locale}`);
      const shown = () =>
        page.locator(".a2-mx-panel").evaluateAll((els) =>
          els
            .filter((el) => getComputedStyle(el).visibility === "visible")
            .map((el) => {
              let o = 1;
              for (let e: Element | null = el.querySelector("h3"); e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
              return `${el.id} ${o}`;
            }),
        );
      const ids = await page.locator(".a2-mx-panel").evaluateAll((els) => els.map((el) => el.id));
      expect(await shown()).toEqual([`${ids[0]} 1`]);
      await page.locator(".a2-mx-pick").nth(4).click();
      await expect(page).toHaveURL(new RegExp(`#${ids[4]}$`));
      expect(await shown()).toEqual([`${ids[4]} 1`]);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Stage 1I correction 3: the two colour transitions that swapped a label or an icon with its own fill — a Projects filter
// toggle pressed and released (its label against its fill: AA), and the certificate preview's open indicator on hover and
// keyboard focus, there and back (an aria-hidden plus icon, not text: its plus against its own circle, 3:1 as for any
// graphical object) — held at 0, 25, 50, 75 and 100 % of their 180 ms, at the worst frames the correction 2 build showed
// (the toggle at 53 ms; the indicator at 70 ms on its way to the hover state and at 39 ms on its way back) and settled, in
// EN/AR × light/dark at 1440 × 900 and 390 × 844 (hover on the desktop only). Every frame is checked; the issues of all of
// them are reported together, and each frame's worst ratio is kept as an annotation.
// ---------------------------------------------------------------------------------------------------------------------

const COMBOS3 = COMBOS2.filter((c) => c.view !== "small");
const CHIP_TIMES = [0, 45, 53, 90, 135, 180, null];
const PLUS_TIMES = [0, 39, 45, 70, 90, 135, 180, null];
const when = (T: number | null) => (T === null ? "settled" : `${T} ms`);
const note = (description: string) => test.info().annotations.push({ type: "frame", description });

/** One held frame's issues — axe, a text half-faded, a text below AA against what is drawn under it — and its worst ratio. */
async function frameIssues(page: Page, scope: string, at: string) {
  const issues = (await axe(page)).map((v) => `${at}: axe ${v}`);
  const shown = await textsShown(page, scope);
  issues.push(...shown.filter((t) => t.opacity < 1).map((t) => `${at}: "${t.text}" at opacity ${t.opacity.toFixed(3)}`));
  const ratios = await contrastOf(page, scope, shown);
  issues.push(...ratios.filter((r) => r.ratio < r.need).map((r) => `${at}: "${r.text}" ${r.ratio.toFixed(3)} < ${r.need}`));
  return { shown, issues, worst: Math.min(...ratios.map((r) => r.ratio)) };
}

/**
 * A filter toggle pressed from the keyboard (focused, then clicked, as Enter does) and held at T ms (null: finished). The
 * choice re-flows the gallery through the browser's animated update, which commits the new state a frame later: the hold
 * waits for the update and for its animations (`ready`), so the toggles' transitions and the re-flow are held at one T.
 */
async function holdChip(page: Page, index: number, T: number | null) {
  return page.evaluate(
    async ({ index, T }) => {
      const before = new Set(document.getAnimations());
      const w = window as unknown as { __held: Animation[]; __resume: Animation[] };
      w.__resume = [...before].filter((a) => a.playState === "running");
      const chip = document.querySelectorAll<HTMLButtonElement>(".pj-bar .pj-chip")[index];
      // The page's own animated update, kept to wait for (the browser's method is restored at once).
      const start = document.startViewTransition.bind(document);
      let update: ViewTransition | undefined;
      document.startViewTransition = ((cb: () => void) => (update = start(cb))) as typeof document.startViewTransition;
      chip.focus({ preventScroll: true });
      chip.click();
      delete (document as { startViewTransition?: unknown }).startViewTransition;
      await update?.ready.catch(() => {});
      for (let i = 0; i < 60 && chip.getAttribute("aria-pressed") !== "true"; i++) await new Promise((r) => requestAnimationFrame(r));
      document.body.getBoundingClientRect();
      for (const el of document.querySelectorAll(".pj-chip, .pj-chip *")) getComputedStyle(el).getPropertyValue("color");
      const fresh = document.getAnimations().filter((a) => !before.has(a));
      w.__held = fresh;
      if (T === null) {
        for (const a of fresh)
          try {
            a.finish();
          } catch {}
      } else {
        document.getAnimations().forEach((a) => a.pause());
        for (const a of fresh) {
          a.pause();
          a.currentTime = T;
        }
      }
      return {
        committed: chip.getAttribute("aria-pressed") === "true",
        held: fresh.length,
        own: fresh.filter((a) => (a.effect as KeyframeEffect).target === chip).length,
        reflow: fresh.filter((a) => /view-transition/.test((a as CSSAnimation).animationName ?? "")).length,
      };
    },
    { index, T },
  );
}

/**
 * The filter in a held frame: the toggles pressed in the bar and in the hero, the focused one, the projects shown and hidden,
 * the line read out, the bar's toggles' boxes (relative to the bar) and every toggle's label colour against its fill, as
 * computed (the hero's toggles, out of view here, included). Read before the frame's pixels: the capture replaces a running
 * colour transition with its end value.
 */
function chipState(page: Page) {
  return page.evaluate(() => {
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (c: string) => {
      cv.clearRect(0, 0, 1, 1);
      cv.fillStyle = "#000";
      cv.fillStyle = c;
      cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const pressed = (sel: string) => [...document.querySelectorAll(sel)].filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => c.textContent!.trim());
    const a = document.activeElement as HTMLElement;
    const bar = document.querySelector(".pj-bar")!.getBoundingClientRect();
    return {
      bar: pressed(".pj-bar .pj-chip"),
      quick: pressed(".pj-quick .pj-chip"),
      focused: a.matches(".pj-bar .pj-chip") ? a.textContent!.trim() : null,
      items: [...document.querySelectorAll<HTMLElement>("[data-project]")].map((el) => ({ id: el.id, hidden: el.hidden, cats: (el.dataset.categories ?? "").split(" ") })),
      live: document.querySelector(".pj-list")!.closest(".shell")!.querySelector("[aria-live]")!.textContent,
      boxes: [document.querySelector(".pj-bar")!, ...document.querySelectorAll(".pj-bar .pj-chip, .pj-bar .pj-chip-mark")].map((el) => {
        const b = el.getBoundingClientRect();
        return [b.x - bar.x, b.y - bar.y, b.width, b.height].map((v) => Math.round(v * 100) / 100);
      }),
      pairs: [...document.querySelectorAll<HTMLElement>(".pj-chip")].map((c) => ({ text: c.textContent!.trim(), fg: rgba(getComputedStyle(c).color), bg: rgba(getComputedStyle(c).backgroundColor) })),
    };
  });
}

/**
 * The first certificate preview, marked `data-held-plate`, changed and held at T ms (null: finished): by keyboard focus
 * ("focus" / "blur", inside one page task) or by the mouse ("enter" / "leave": the hold is armed first and taken in the
 * task of the pointer event that changes the hover state, long before a 180 ms transition could end).
 */
async function holdPlate(page: Page, how: "focus" | "blur" | "enter" | "leave", T: number | null, to?: { x: number; y: number }) {
  await page.evaluate(
    ({ how, T }) => {
      type Held = { engaged: boolean; held: number; lift: number };
      const w = window as unknown as { __held: Animation[]; __resume: Animation[]; __plateHeld: Promise<Held> };
      const plate = document.querySelector<HTMLAnchorElement>("[data-held-plate]")!;
      const mouse = how === "enter" || how === "leave";
      const engaged = () => plate.matches(mouse ? ":hover" : ":focus-visible");
      const before = new Set(document.getAnimations());
      w.__resume = [...before].filter((a) => a.playState === "running");
      const take = (): Held => {
        document.body.getBoundingClientRect();
        for (const el of [plate, ...plate.querySelectorAll("*")]) getComputedStyle(el).getPropertyValue("color");
        const fresh = document.getAnimations().filter((a) => !before.has(a));
        w.__held = fresh;
        if (T === null) {
          for (const a of fresh)
            try {
              a.finish();
            } catch {}
        } else {
          document.getAnimations().forEach((a) => a.pause());
          for (const a of fresh) {
            a.pause();
            a.currentTime = T;
          }
        }
        const img = plate.querySelector(".ct-plate-img");
        return { engaged: engaged(), held: fresh.length, lift: fresh.filter((a) => (a.effect as KeyframeEffect).target === img && (a as CSSTransition).transitionProperty === "translate").length };
      };
      if (!mouse) {
        if (how === "focus") plate.focus({ preventScroll: true });
        else plate.blur();
        w.__plateHeld = Promise.resolve(take());
        return;
      }
      const want = how === "enter";
      w.__plateHeld = new Promise<Held>((resolve) => {
        const type = want ? "pointerover" : "pointerout";
        const check = (tries: number) => {
          if (engaged() === want) resolve(take());
          else if (tries > 0) setTimeout(() => check(tries - 1), 0);
          else resolve({ engaged: engaged(), held: -1, lift: 0 });
        };
        const on = () => {
          document.removeEventListener(type, on, true);
          check(20);
        };
        document.addEventListener(type, on, true);
      });
    },
    { how, T },
  );
  if (to) await page.mouse.move(to.x, to.y);
  return page.evaluate(() => (window as unknown as { __plateHeld: Promise<{ engaged: boolean; held: number; lift: number }> }).__plateHeld);
}

/**
 * The held preview's open indicator: an aria-hidden plus icon with no text, drawn in full inside its preview, and its plus
 * at 3:1 against its own circle — by the computed colours, and per pixel: the plus hidden, the held frame captured, the
 * plus's colour (through its opacity) set against every pixel under it. Unrounded.
 */
async function plusIssues(page: Page, at: string) {
  const s = await page.evaluate(() => {
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (c: string) => {
      cv.clearRect(0, 0, 1, 1);
      cv.fillStyle = "#000";
      cv.fillStyle = c;
      cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const plate = document.querySelector("[data-held-plate]")!;
    const open = plate.querySelector<HTMLElement>(".ct-plate-open")!;
    const path = open.querySelector("svg path")!;
    let opacity = 1;
    for (let e: Element | null = path; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
    const [o, p, i] = [open, plate, open.querySelector("svg")!].map((e) => e.getBoundingClientRect());
    const st = getComputedStyle(open);
    return {
      hidden: open.getAttribute("aria-hidden"),
      text: open.textContent!.trim(),
      drawn:
        st.display !== "none" && st.visibility === "visible" && getComputedStyle(path).visibility === "visible" && o.width >= 32 && o.height >= 32 &&
        o.left >= p.left && o.right <= p.right && o.top >= p.top && o.bottom <= p.bottom && o.top >= 0 && o.bottom <= innerHeight,
      opacity,
      plus: rgba(getComputedStyle(path).stroke),
      circle: rgba(st.backgroundColor),
      box: [i.left, i.top, i.width, i.height],
    };
  });
  const issues: string[] = [];
  if (s.hidden !== "true") issues.push(`${at}: the indicator is not aria-hidden (${s.hidden})`);
  if (s.text) issues.push(`${at}: the indicator holds text ("${s.text}")`);
  if (!s.drawn) issues.push(`${at}: the indicator is not drawn in full inside its preview`);
  if (s.opacity < 1) issues.push(`${at}: the plus at opacity ${s.opacity.toFixed(3)}`);
  const computed = ratio(s.plus, s.circle);
  if (computed < 3) issues.push(`${at}: the plus ${computed.toFixed(3)} < 3 against its circle (computed)`);
  await page.evaluate(() => {
    const st = document.createElement("style");
    st.id = "hide-plus";
    st.textContent = "[data-held-plate] .ct-plate-open svg { visibility: hidden !important }";
    document.head.append(st);
    document.body.getBoundingClientRect();
  });
  const shot = await page.screenshot();
  await page.evaluate(() => document.getElementById("hide-plus")?.remove());
  const under = await page.evaluate(
    async ({ b64, box }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const k = img.width / innerWidth;
      const [x, y, w, h] = box;
      const d = ctx.getImageData(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))).data;
      const px: number[][] = [];
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
      return px;
    },
    { b64: shot.toString("base64"), box: s.box },
  );
  const alpha = s.plus[3] * s.opacity;
  let pixels = Infinity;
  for (const p of under) pixels = Math.min(pixels, ratio(s.plus.slice(0, 3).map((v, k) => v * alpha + p[k] * (1 - alpha)), p));
  if (!(pixels >= 3)) issues.push(`${at}: the plus ${pixels.toFixed(3)} < 3 against the pixels under it`);
  return { issues, computed, pixels, plus: s.plus, circle: s.circle };
}

for (const c of COMBOS3) {
  test.describe(`correction 3, held part-way, ${label2(c)}`, () => {
    test.use({ viewport: VIEWPORTS[c.view], colorScheme: c.theme, ...(c.view !== "desktop" ? { isMobile: true, hasTouch: true } : {}) });

    test("Projects filter: a toggle's label is at full strength and AA against its fill in every frame, pressed and released; the choice, the projects shown and the focus ring hold", async ({ page }) => {
      test.setTimeout(240_000);
      await open(page, c, "/projects");
      await page.locator("#gallery").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await still(page, ".pj-bar");
      await page.keyboard.press("Shift"); // keyboard modality, so the toggle's focus ring is :focus-visible
      const labels = (await page.locator(".pj-bar .pj-chip").allTextContents()).map((t) => t.trim());
      const slug = projectCategories.find((p) => p.label[c.locale] === labels[1])!.slug;
      const before = (await chipState(page)).boxes;
      const issues: string[] = [];
      // Each time a category is pressed (All released), then All again (the category released): both ways in every frame.
      for (const T of CHIP_TIMES)
        for (const [index, other] of [
          [1, 0],
          [0, 1],
        ]) {
          const [want, gone] = [labels[index], labels[other]];
          const at = `"${want}" pressed, "${gone}" released, ${when(T)}`;
          const r = await holdChip(page, index, T);
          expect(r.committed, `${at}: pressed`).toBe(true);
          if (T !== null) {
            expect(r.own, `${at}: the toggle's change is held`).toBeGreaterThan(0);
            expect(r.reflow, `${at}: the gallery's re-flow is held`).toBeGreaterThan(0);
          }
          const s = await chipState(page);
          expect(s.bar, `${at}: pressed in the bar`).toEqual([want]);
          expect(s.quick, `${at}: pressed in the hero`).toEqual([want]);
          expect(s.focused, `${at}: focused`).toBe(want);
          expect(await focusShown(page), `${at}: focus ring`).toEqual({ ring: true, visible: true });
          const wrong = s.items.filter((i) => i.hidden === (index === 0 || i.cats.includes(slug))).map((i) => i.id);
          expect(wrong, `${at}: projects shown or hidden wrongly`).toEqual([]);
          expect(s.items.filter((i) => !i.hidden).length, `${at}: projects shown`).toBeGreaterThan(0);
          expect(s.live, `${at}: the line read out`).toContain(want);
          expect(s.boxes, `${at}: the bar's toggles keep their boxes`).toEqual(before);
          let computed = Infinity;
          for (const p of s.pairs) {
            const v = ratio(p.fg, p.bg);
            computed = Math.min(computed, v);
            if (v < 4.5) issues.push(`${at}: toggle "${p.text}" ${v.toFixed(3)} < 4.5 (computed)`);
          }
          const f = await frameIssues(page, ".pj-bar", at);
          issues.push(...f.issues);
          // Both toggles that changed are among the labels measured against their pixels.
          expect(f.shown.map((t) => t.text), `${at}: both toggles measured`).toEqual(expect.arrayContaining([want, gone]));
          note(`${at}: worst ${f.worst.toFixed(3)} per pixel, ${computed.toFixed(3)} computed`);
          await release(page);
          await expect.poll(() => page.locator("html").getAttribute("data-vt")).toBeNull();
          await still(page, ".pj-bar");
        }
      expect(issues, "frames with an issue").toEqual([]);
    });

    test("Certificates: the preview's open indicator (an aria-hidden plus icon, not text) keeps its plus at 3:1 against its circle in every frame, to its hover and focus state and back; the preview stays one link that opens the dialog", async ({ page }) => {
      test.setTimeout(240_000);
      await open(page, c, "/certificates");
      const plate = page.locator(".ct-plate").first();
      await plate.evaluate((el) => {
        el.setAttribute("data-held-plate", "");
        el.scrollIntoView({ block: "center", behavior: "instant" });
      });
      await expect(plate).toBeVisible();
      await still(page, "[data-held-plate]");
      // One link: the preview itself, with nothing focusable inside it.
      const link = await plate.evaluate((a) => ({
        tag: a.tagName,
        href: a.getAttribute("href"),
        popup: a.getAttribute("aria-haspopup"),
        name: a.getAttribute("aria-label"),
        inner: a.querySelectorAll("a, button, input, select, textarea, [tabindex]").length,
        links: a.closest("figure")!.querySelectorAll("a").length,
      }));
      expect(link).toMatchObject({ tag: "A", popup: "dialog", inner: 0, links: 1 });
      expect(link.href).toMatch(/^\/media\/certificates\/.+\.webp$/);
      expect(link.name).toBeTruthy();
      const box = (await plate.boundingBox())!;
      const dot = (await page.locator("[data-held-plate] .ct-plate-open").boundingBox())!;
      // The mouse: on the preview at the corner farthest from the indicator (the site's pointer is drawn there), or away
      // in the page's margin beside it.
      const on = { x: dot.x > box.x + box.width / 2 ? box.x + 24 : box.x + box.width - 24, y: box.y + 24 };
      const away = { x: 4, y: box.y + box.height / 2 };
      const desktop = c.view === "desktop";
      if (desktop) await page.mouse.move(away.x, away.y);
      const issues: string[] = [];
      const ways: ["focus" | "enter", "blur" | "leave"][] = desktop ? [["focus", "blur"], ["enter", "leave"]] : [["focus", "blur"]];
      for (const [there, back] of ways)
        for (const T of PLUS_TIMES)
          for (const how of [there, back]) {
            const at = `${how}, ${when(T)}`;
            if (how === "focus") await page.keyboard.press("Shift");
            const r = await holdPlate(page, how, T, how === "enter" ? on : how === "leave" ? away : undefined);
            expect(r.held, `${at}: the change was caught`).toBeGreaterThanOrEqual(0);
            expect(r.engaged, `${at}: the preview's state`).toBe(how === there);
            if (T !== null) expect(r.lift, `${at}: the preview's lift is held`).toBe(1);
            const f = await plusIssues(page, at);
            issues.push(...f.issues);
            issues.push(...(await axe(page)).map((v) => `${at}: axe ${v}`));
            const focus = await page.evaluate(() => {
              const p = document.querySelector("[data-held-plate]")!;
              const s = getComputedStyle(p);
              return { focused: document.activeElement === p, visible: p.matches(":focus-visible"), ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 };
            });
            expect(focus, `${at}: focus`).toEqual(how === "focus" ? { focused: true, visible: true, ring: true } : { focused: false, visible: false, ring: false });
            note(`${at}: the plus ${f.pixels.toFixed(3)} per pixel, ${f.computed.toFixed(3)} computed`);
            await release(page);
            await still(page, "[data-held-plate]");
          }
      expect(issues, "frames with an issue").toEqual([]);

      // At rest a dark circle with a light plus; on hover and keyboard focus the brand circle with a dark plus, the same for
      // both (and the preview lifted alike).
      const ends = () =>
        page.evaluate(() => {
          const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
          const rgba = (c: string) => {
            cv.clearRect(0, 0, 1, 1);
            cv.fillStyle = "#000";
            cv.fillStyle = c;
            cv.fillRect(0, 0, 1, 1);
            const d = cv.getImageData(0, 0, 1, 1).data;
            return [d[0], d[1], d[2], d[3] / 255];
          };
          const plate = document.querySelector("[data-held-plate]")!;
          const open = plate.querySelector(".ct-plate-open")!;
          const tok = (n: string) => rgba(getComputedStyle(open).getPropertyValue(n));
          return {
            circle: rgba(getComputedStyle(open).backgroundColor),
            plus: rgba(getComputedStyle(open.querySelector("svg path")!).stroke),
            lift: getComputedStyle(plate.querySelector(".ct-plate-img")!).translate,
            ink: tok("--ink"),
            surface: tok("--surface"),
            brand: tok("--brand"),
            onBrand: tok("--on-brand"),
          };
        });
      const rest = await ends();
      expect([rest.circle, rest.plus], "at rest").toEqual([rest.ink, rest.surface]);
      await page.keyboard.press("Shift");
      await plate.focus();
      await still(page, "[data-held-plate]");
      const focused = await ends();
      expect([focused.circle, focused.plus], "with keyboard focus").toEqual([focused.brand, focused.onBrand]);
      if (desktop) {
        await plate.blur();
        await page.mouse.move(on.x, on.y);
        await still(page, "[data-held-plate]");
        expect(await ends(), "hover shows what keyboard focus shows").toEqual(focused);
        await page.mouse.move(away.x, away.y);
        await still(page, "[data-held-plate]");
      }

      // The preview still opens its dialog from the keyboard, and focus comes back to it.
      await page.keyboard.press("Shift");
      await plate.focus();
      await page.keyboard.press("Enter");
      const dialog = page.locator("dialog.ct-dialog[open]");
      await expect(dialog).toHaveCount(1);
      expect(await dialog.evaluate((d) => d.matches(":modal"))).toBe(true);
      await expect(dialog.locator(".ct-close")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(plate).toBeFocused();
    });
  });
}

test.describe("correction 3, with reduced motion: a filter toggle and the certificate preview change at once", () => {
  test.use({ viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: "reduce" } });

  test("pressed and released, focused and hovered: nothing moves, and the labels and the plus are at full contrast from the first frame", async ({ page }) => {
    test.setTimeout(120_000);
    for (const [locale, theme] of [
      ["en", "light"],
      ["ar", "dark"],
    ] as const) {
      await open(page, { locale, theme }, "/projects");
      await page.locator("#gallery").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.keyboard.press("Shift");
      const labels = (await page.locator(".pj-bar .pj-chip").allTextContents()).map((t) => t.trim());
      const slug = projectCategories.find((p) => p.label[locale] === labels[1])!.slug;
      for (const [index, other] of [
        [1, 0],
        [0, 1],
      ]) {
        const at = `${locale} "${labels[index]}" pressed, "${labels[other]}" released, reduced motion`;
        const r = await holdChip(page, index, 0);
        expect(r.committed, `${at}: pressed`).toBe(true);
        expect(r.held, `${at}: nothing moves`).toBe(0);
        const s = await chipState(page);
        expect([s.bar, s.quick, s.focused], `${at}: the choice`).toEqual([[labels[index]], [labels[index]], labels[index]]);
        expect(s.items.filter((i) => i.hidden === (index === 0 || i.cats.includes(slug))).map((i) => i.id), `${at}: projects`).toEqual([]);
        expect(s.pairs.filter((p) => ratio(p.fg, p.bg) < 4.5).map((p) => p.text), `${at}: toggles below AA (computed)`).toEqual([]);
        expect((await frameIssues(page, ".pj-bar", at)).issues).toEqual([]);
        await release(page);
      }
      await open(page, { locale, theme }, "/certificates");
      const plate = page.locator(".ct-plate").first();
      await plate.evaluate((el) => {
        el.setAttribute("data-held-plate", "");
        el.scrollIntoView({ block: "center", behavior: "instant" });
      });
      const box = (await plate.boundingBox())!;
      await page.mouse.move(4, box.y + box.height / 2);
      for (const how of ["focus", "blur", "enter", "leave"] as const) {
        const at = `${locale} ${how}, reduced motion`;
        if (how === "focus") await page.keyboard.press("Shift");
        const to = how === "enter" ? { x: box.x + box.width / 2, y: box.y + 24 } : how === "leave" ? { x: 4, y: box.y + box.height / 2 } : undefined;
        const r = await holdPlate(page, how, 0, to);
        expect(r.held, `${at}: nothing moves`).toBe(0);
        expect(r.engaged, `${at}: the preview's state`).toBe(how === "focus" || how === "enter");
        expect((await plusIssues(page, at)).issues).toEqual([]);
        await release(page);
      }
    }
  });
});

test.describe("correction 3, in forced colours", () => {
  for (const scheme of ["light", "dark"] as const)
    test.describe(`${scheme} palette`, () => {
      test.use({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, contextOptions: { forcedColors: "active" } });

      test("a toggle's state shows with a check and system colours in every frame, its focus ring drawn; the certificate preview stays reachable, named and opens its dialog", async ({ page }) => {
        test.setTimeout(120_000);
        await open(page, { locale: "en", theme: scheme }, "/projects");
        await page.locator("#gallery").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
        await page.keyboard.press("Shift");
        const sys = await page.evaluate(() => {
          const probe = document.createElement("div");
          probe.style.cssText = "forced-color-adjust: none; position: fixed; inset: 0 auto auto 0; width: 1px; height: 1px";
          document.body.append(probe);
          const read = (bg: string, fg: string) => {
            probe.style.backgroundColor = bg;
            probe.style.color = fg;
            const s = getComputedStyle(probe);
            return [s.backgroundColor, s.color];
          };
          const out = { pressed: read("Highlight", "HighlightText"), plain: read("ButtonFace", "ButtonText") };
          probe.remove();
          return out;
        });
        // At 0 and 53 ms (the correction 2 build's worst frame) and settled, pressed and released alike.
        for (const T of [0, 53, null])
          for (const [index, other] of [
            [1, 0],
            [0, 1],
          ]) {
            const at = `${scheme} palette, chip ${index} pressed, ${when(T)}`;
            const r = await holdChip(page, index, T);
            expect(r.committed, at).toBe(true);
            const chips = await page.evaluate(() =>
              [...document.querySelectorAll<HTMLElement>(".pj-bar .pj-chip")].slice(0, 2).map((c) => {
                const s = getComputedStyle(c);
                const mark = c.querySelector(".pj-chip-mark")!;
                return {
                  colours: [s.backgroundColor, s.color],
                  check: getComputedStyle(mark.querySelector("svg")!).display !== "none",
                  square: getComputedStyle(mark, "::before").display !== "none",
                  ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2,
                };
              }),
            );
            expect(chips[index], `${at}: the pressed toggle`).toEqual({ colours: sys.pressed, check: true, square: false, ring: true });
            expect(chips[other], `${at}: the released toggle`).toEqual({ colours: sys.plain, check: false, square: true, ring: false });
            await release(page);
            await expect.poll(() => page.locator("html").getAttribute("data-vt")).toBeNull();
          }

        await open(page, { locale: "en", theme: scheme }, "/certificates");
        const plate = page.locator(".ct-plate").first();
        await plate.evaluate((el) => {
          el.setAttribute("data-held-plate", "");
          el.scrollIntoView({ block: "center", behavior: "instant" });
          // Tab reaches the preview from the control before it.
          const all = [...document.querySelectorAll<HTMLElement>("a[href], button, [tabindex]:not([tabindex='-1'])")];
          all[all.indexOf(el as HTMLElement) - 1].focus({ preventScroll: true });
        });
        await page.keyboard.press("Tab");
        await expect(plate).toBeFocused();
        const state = await plate.evaluate((p) => ({
          name: p.getAttribute("aria-label"),
          visible: p.matches(":focus-visible"),
          ring: getComputedStyle(p).outlineStyle !== "none" && parseFloat(getComputedStyle(p).outlineWidth) >= 2,
          hidden: p.querySelector(".ct-plate-open")!.getAttribute("aria-hidden"),
        }));
        expect(state).toMatchObject({ visible: true, ring: true, hidden: "true" });
        expect(state.name).toBeTruthy();
        // The plus stays drawn against its circle in the forced colours too (a decoration: the preview's name says what it does).
        expect((await plusIssues(page, `${scheme} palette, focused`)).issues).toEqual([]);
        await page.keyboard.press("Enter");
        const dialog = page.locator("dialog.ct-dialog[open]");
        await expect(dialog).toHaveCount(1);
        expect(await dialog.evaluate((d) => d.matches(":modal"))).toBe(true);
        await expect(dialog.locator(".ct-close")).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(plate).toBeFocused();
      });
    });
});
