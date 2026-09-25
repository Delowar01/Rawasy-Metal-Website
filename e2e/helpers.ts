import type { BrowserContext, Page } from "@playwright/test";

export const LOCALES = ["en", "ar"] as const;
export type TestLocale = (typeof LOCALES)[number];

/** The inner pages built so far: Stage 1C, plus the Projects overview brought forward in the V2 redesign. */
export const INNER_PAGES = ["about", "services", "projects", "industries", "clients", "certificates", "contact", "privacy", "terms"] as const;

export const HTML_LANG: Record<TestLocale, string> = { en: "en", ar: "ar-SA" };

/** Skips the once-per-session intro loader. */
export async function skipIntro(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("rawasy-intro", "1");
    } catch {}
  });
}

/** Collects uncaught errors and console errors. A 404 page's own status line is expected. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/status of 404/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Pixels the page can scroll sideways (0 when nothing overflows). */
export function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Elements well inside the viewport that reveal styles still hide. The bottom
 * band is left out: content there fades in as it scrolls into view (with
 * reduced motion too, as an opacity-only fade).
 */
export function hiddenReveals(page: Page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll("[data-reveal]")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < innerHeight * 0.85 && r.bottom > 0 && getComputedStyle(el).opacity === "0";
      }).length,
  );
}

/** Parsed JSON-LD blocks on the page. */
export function jsonLd(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent || "{}")),
  );
}
