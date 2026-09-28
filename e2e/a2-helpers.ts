import { expect, type Page } from "@playwright/test";

/**
 * Probes for the Modern Commerce (A V2) components — the signature illustrations, the hero plate's 10 s loop and the
 * site-wide ambient — shared by the theme lab's spec (theme-lab-a-v2.spec.ts) and the migrated homepage's spec
 * (commerce-home.spec.ts), which run the same components.
 */

/** Animations currently attached to a signature illustration and its parts. */
export const signatureAnimations = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    // The run's own (Web Animations API) animations: CSS loops and transitions, such as the plate's breathing nodes, are not part of it.
    return (root?.getAnimations({ subtree: true }) ?? []).filter((a) => a.constructor === Animation).map((a) => ({
      state: a.playState,
      end: a.effect?.getComputedTiming().endTime as number,
      iterations: a.effect?.getComputedTiming().iterations as number,
    }));
  }, selector);

export const inView = (page: Page, selector: string) => page.evaluate((sel) => document.querySelector(sel)!.scrollIntoView({ block: "center" }), selector);

/** The finished picture of the signatures, as the service pages draw them. */
export async function expectFinished(page: Page, which: readonly ("cut" | "engrave")[] = ["cut", "engrave"]) {
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
export async function expectPlateFinished(page: Page) {
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

/** The hero plate loop's clock (its first animation: every animation of a cycle shares its timing) and its cycle number. */
export const plateClock = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel)!;
    const clock = root.querySelector(".a2-plate-dim")!.getAnimations().find((a) => a.constructor === Animation)!;
    return { time: Math.round(Number(clock.currentTime)), state: clock.playState, cycle: root.getAttribute("data-cycle") };
  }, selector);

/**
 * The readout's text and the count it should show for the plate's clock: the steps whose time has come (each bolt
 * hole's pierce, the start of the star's and the slot's kerf, the first perforation row), or 00 once the reset begins.
 */
export const plateCount = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel)!;
    const first = (el: Element) => el.getAnimations().find((a) => a.constructor === Animation)!.effect!.getTiming().delay as number;
    const t = Number(root.querySelector(".a2-plate-dim")!.getAnimations()[0].currentTime);
    const marks = [
      ...[...root.querySelectorAll(".a2-plate-pierce")].map(first),
      ...["star", "slot"].map((id) => first(root.querySelector(`[data-kerf="${id}"]`)!) + 1),
      first(root.querySelector('[data-slug="r0"]')!),
    ];
    const n = t >= 9400 ? 0 : marks.filter((m) => t >= m).length;
    return { text: root.closest(".a2-plate-stage")!.querySelector(".a2-plate-read [dir=ltr]")!.textContent, expected: `${String(n).padStart(2, "0")}/07`, t };
  }, selector);

/** The hero plate loop's own animations (the plate's one-time rise onto its stage is not part of the loop). */
export const plateLoop = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel)!;
    return root
      .getAnimations({ subtree: true })
      .filter((a) => a.constructor === Animation && (a.effect as KeyframeEffect).target !== root)
      .map((a) => ({ state: a.playState, end: a.effect!.getComputedTiming().endTime as number, iterations: a.effect!.getComputedTiming().iterations as number }));
  }, selector);

export interface PlateState {
  /** Openings cut, dimensions drawn, nodes and hot points lit, laser points lit. */
  open: number;
  dims: number;
  nodes: number;
  laser: number;
}

export interface PlateLog {
  cycles: ({ n: number; t: number; start: number } & PlateState)[];
  reads: { t: number; text: string }[];
  leds: ({ t: number; on: boolean } & PlateState)[];
  shifts: { t: number; value: number; input: boolean }[];
}

/**
 * Records the hero plate's loop inside the page as it runs, in real time: each cycle start (with its clock's start
 * time and the plate's state), every readout text, the laser light going on and off (with the plate's state), and
 * layout shifts.
 */
export const recordPlate = (page: Page, selector = ".a2-hero .a2-plate") =>
  page.addInitScript((sel) => {
    const log: PlateLog = { cycles: [], reads: [], leds: [], shifts: [] };
    (window as unknown as { __plate: PlateLog }).__plate = log;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
        log.shifts.push({ t: e.startTime, value: e.value, input: e.hadRecentInput });
    }).observe({ type: "layout-shift", buffered: true });
    const watch = () => {
      const root = document.querySelector(sel);
      const line = root?.closest(".a2-plate-stage")?.querySelector(".a2-plate-read");
      const read = line?.querySelector("[dir=ltr]");
      if (!root || !line || !read) return void requestAnimationFrame(watch);
      const count = (q: string, lit: (c: CSSStyleDeclaration) => boolean) => [...root.querySelectorAll(q)].filter((el) => lit(getComputedStyle(el))).length;
      const state = (): PlateState => ({
        open: count("[data-slug]", (c) => parseFloat(c.opacity) < 0.5 || c.clipPath.includes("100%")),
        dims: count(".a2-plate-dim", (c) => parseFloat(c.opacity) > 0.5 && parseFloat(c.strokeDashoffset) < 0.5),
        nodes: count(".a2-plate-node, .a2-plate-pulse", (c) => parseFloat(c.opacity) > 0.01),
        laser: count(".a2-plate-hot, .a2-plate-pierce", (c) => parseFloat(c.opacity) > 0.01),
      });
      new MutationObserver(() => {
        const clock = root.querySelector(".a2-plate-dim")!.getAnimations().find((a) => a.constructor === Animation)!;
        const cycle = { n: Number(root.getAttribute("data-cycle")), t: performance.now(), start: Number(clock.startTime), ...state() };
        log.cycles.push(cycle);
        // The first cycle is logged as it is scheduled: its clock starts on the next frame.
        if (clock.startTime == null) clock.ready.then(() => (cycle.start = Number(clock.startTime)));
      }).observe(root, { attributes: true, attributeFilter: ["data-cycle"] });
      new MutationObserver(() => log.reads.push({ t: performance.now(), text: read.textContent ?? "" })).observe(read, { childList: true, characterData: true, subtree: true });
      new MutationObserver(() => log.leds.push({ t: performance.now(), on: line.hasAttribute("data-running"), ...state() })).observe(line, {
        attributes: true,
        attributeFilter: ["data-running"],
      });
    };
    document.addEventListener("DOMContentLoaded", watch);
  }, selector);

export const plateLog = (page: Page) => page.evaluate(() => (window as unknown as { __plate: PlateLog }).__plate);

/**
 * The first `n` cycles of a recorded loop, each against the next: 10 s apart start to start, each starting from the
 * blank plate, counting 01–07 as it cuts, holding the finished plate with the light off, then resetting to 00; and no
 * layout shift once the loop runs.
 */
export function expectCycles(log: PlateLog, n: number) {
  const cycles = log.cycles.slice(0, n);
  expect(cycles.map((c) => c.n)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  // Each cycle starts from the blank plate: nothing cut, no measurements, no nodes, the laser off.
  for (const c of cycles) expect([c.open, c.dims, c.nodes, c.laser]).toEqual([0, 0, 0, 0]);
  // Start to start, on the clock (the timeline shares performance.now()'s origin): one period exactly, cycle after
  // cycle, so the loop never drifts (a restart that came late would start afresh instead).
  for (let i = 1; i < n; i++) {
    expect(cycles[i].start - cycles[i - 1].start).toBeGreaterThan(9999);
    expect(cycles[i].start - cycles[i - 1].start).toBeLessThan(10300);
  }
  for (let i = 0; i + 1 < n; i++) {
    // Changes logged between this cycle's start and the next one's, timed from the clock's start.
    const [from, to, start] = [cycles[i].t, cycles[i + 1].t, cycles[i].start];
    // The count: up from 01 to 07 as the cuts are made, then back to 00 before the next cycle. (It shows the count at
    // the frame it draws: a frame that comes more than 120 ms late on a loaded machine can skip a hole's step.)
    const reads = log.reads.filter((r) => r.t > from && r.t < to);
    const counts = reads.map((r) => Number(r.text.slice(0, 2)));
    expect(reads.every((r) => /^0[0-7]\/07$/.test(r.text))).toBe(true);
    expect(counts.slice(-2)).toEqual([7, 0]);
    expect(counts.slice(0, -1).every((c, k) => c > (counts[k - 1] ?? 0))).toBe(true);
    expect(counts.length).toBeGreaterThanOrEqual(6);
    // The light: on while the laser cuts, off for the hold.
    const leds = log.leds.filter((l) => l.t >= from && l.t < to);
    expect(leds.map((l) => l.on)).toEqual([true, false]);
    const [done, reset, rest] = [reads[reads.length - 2].t - start, reads[reads.length - 1].t - start, leds[1]];
    // About 5 s of cutting: the perforation field from 3.9 s, the light off at 5.26 s with every opening cut, the
    // measurements drawn and the nodes lit ...
    expect(done).toBeGreaterThan(3890);
    expect(done).toBeLessThan(4600);
    expect(rest.t - start).toBeGreaterThan(5250);
    expect(rest.t - start).toBeLessThan(6000);
    expect([rest.open, rest.dims, rest.nodes, rest.laser]).toEqual([10, 6, 8, 0]);
    // ... then the finished plate holds for about 4 s, until the reset at 9.4 s.
    expect(reset).toBeGreaterThan(9395);
    expect(reset).toBeLessThan(10000);
    expect(reads[reads.length - 1].t - rest.t).toBeGreaterThan(3600);
  }
  // Nothing moves the layout once the loop runs.
  expect(log.shifts.filter((s) => s.t > cycles[0].t + 1000 && !s.input).reduce((sum, s) => sum + s.value, 0)).toBe(0);
}

/** WCAG contrast of an element's text against the solid colours behind it (alpha-blended up to the page). */
export const textContrast = (page: Page, selector: string) =>
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

/** The live site-wide ambient (not the design-system frames). */
export const AMBIENT = ".a2-ambient:not(.a2-ambient-frame)";

/** Every CSS animation of the live ambient: name, element, timing and state. */
export const ambientAnimations = (page: Page) =>
  page.evaluate(
    (sel) =>
      document
        .querySelector(sel)!
        .getAnimations({ subtree: true })
        .map((a) => {
          const t = a.effect!.getTiming();
          return {
            name: (a as CSSAnimation).animationName,
            target: ((a.effect as KeyframeEffect).target as Element).className,
            state: a.playState,
            duration: t.duration,
            direction: t.direction,
            iterations: t.iterations,
          };
        }),
    AMBIENT,
  );
