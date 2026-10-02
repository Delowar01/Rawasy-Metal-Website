import type { Browser, Page } from "@playwright/test";

/**
 * Cold-load landing probes for the first jump to an address's #anchor (Stage TM-2.5's shared fix, see
 * commerce-anchors.spec.ts): a fresh browser context per load, so nothing is cached, and font files held back by the
 * network.
 */

export const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: "phone", viewport: { width: 390, height: 844 }, isMobile: true },
] as const;

/** Font files held back this long (ms): one arrives about when the browser jumps, one well after. */
export const FONT_DELAYS = [300, 1200] as const;

export interface Placement {
  /** scrollY minus the position that puts the target's top at its place (whole pixels). */
  off: number;
  /** Whether the sticky header covers the target's top edge. */
  covered: boolean;
}

/**
 * Where the target sits against its place: its top at the scroll padding (the header and a little air) plus its own
 * scroll margin, or the end of the page when the page cannot scroll that far; and whether the header covers it.
 */
export function placement(page: Page, id: string): Promise<Placement> {
  return page.evaluate((id) => {
    const el = document.getElementById(id)!;
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const top = el.getBoundingClientRect().top;
    const max = document.documentElement.scrollHeight - innerHeight;
    const want = Math.max(0, Math.min(top + scrollY - pad - margin, max));
    const header = document.querySelector(".a2-header")!.getBoundingClientRect().bottom;
    return { off: Math.round(scrollY - want), covered: top < header - 0.5 };
  }, id);
}

/** On its place (within a pixel of rounding) and not under the header. */
export const placed = ({ off, covered }: Placement) => Math.abs(off) <= 1 && !covered;

/** Loads `path` in a fresh context with its fonts delayed by `delay` ms; the target's placement at four moments. */
export async function coldLanding(browser: Browser, path: string, view: (typeof VIEWPORTS)[number], delay: number) {
  const context = await browser.newContext({ viewport: view.viewport, isMobile: view.isMobile, hasTouch: view.isMobile });
  // What the stylesheet says while the page is still loading: no gliding yet.
  await context.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      (window as unknown as { glideAtStart: string }).glideAtStart = getComputedStyle(document.documentElement).scrollBehavior;
    });
  });
  let fonts = 0;
  await context.route(/\.woff2$/, async (route) => {
    fonts++;
    await new Promise((resolve) => setTimeout(resolve, delay));
    await route.continue();
  });
  const page = await context.newPage();
  const id = decodeURIComponent(path.split("#")[1]);
  await page.goto(path, { waitUntil: "load" });
  const atLoad = await placement(page, id);
  await page.evaluate(() => document.fonts.ready);
  const fontsIn = await placement(page, id);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const nextFrames = await placement(page, id);
  await page.waitForTimeout(600);
  const idle = await placement(page, id);
  const glide = await page.evaluate(() => ({
    atStart: (window as unknown as { glideAtStart: string }).glideAtStart,
    settled: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  await context.close();
  return { samples: { atLoad, fontsIn, nextFrames, idle }, glide, fonts };
}
