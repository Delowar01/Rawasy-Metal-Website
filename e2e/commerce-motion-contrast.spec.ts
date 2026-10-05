import { test, expect, type Page } from "@playwright/test";

/**
 * Text keeps AA contrast through the motion, not only at rest (Stage 1I correction 1).
 *
 * The Capabilities machine change and the certificate dialog are held part-way through — every animation the change
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

async function open(page: Page, c: Combo, path: string) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("rawasy-theme", t);
    } catch {}
  }, c.theme);
  await page.goto(`/${c.locale}${path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: AXE });
}

type Change = { pick: string } | { dialog: "open" | "close" };

/**
 * Makes a change inside one page task — a machine chosen (focused, then clicked) or the dialog opened or closed — and
 * holds everything it starts at T ms (null: lets it finish). React renders the change after the event, so the hold waits
 * for it to be committed first (a few microtasks at most).
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
      } else if (change.dialog === "open") {
        document.querySelector<HTMLAnchorElement>(".ct-plate")!.click();
        done = () => !!dialog?.open && !!dialog.querySelector(".ct-dialog-inner");
      } else {
        document.querySelector<HTMLButtonElement>(".ct-close")!.click();
        done = () => !dialog?.open;
      }
      for (let i = 0; i < 20 && !done(); i++) await (i < 5 ? Promise.resolve() : new Promise((r) => setTimeout(r, 0)));
      document.body.getBoundingClientRect();
      for (const el of document.querySelectorAll(".cm-panel, .cm-panel *, dialog, dialog *")) getComputedStyle(el).getPropertyValue("opacity");
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
        const st = getComputedStyle(el);
        if (st.visibility !== "visible") continue;
        let opacity = 1;
        for (let e: Element | null = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
        if (opacity === 0) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const boxes = [...r.getClientRects()]
          .filter((b) => b.width > 1 && b.height > 1 && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth)
          .map((b) => [b.left, b.top, b.width, b.height]);
        if (!boxes.length) continue;
        const size = parseFloat(st.fontSize);
        out.push({
          text: n.textContent.trim().slice(0, 40),
          owner: el.closest(".cm-panel")?.id ?? null,
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
    s.textContent = `${scope} *, ${scope} *::before, ${scope} *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important; text-shadow: none !important } ${scope} svg.mc-icon { visibility: hidden !important }`;
    document.head.append(s);
    document.body.getBoundingClientRect();
    for (const el of document.querySelectorAll(`${scope} *`)) getComputedStyle(el).getPropertyValue("color");
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
