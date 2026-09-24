import { INTRO_STORAGE_KEY, THEME_STORAGE_KEY } from "./utils";

/**
 * Runs in <head> before first paint:
 *  - flags that JS is available (enables reveal animations),
 *  - applies the stored or OS theme (no flash of the wrong theme),
 *  - shows the intro loader only once per session and never with reduced motion.
 *
 * Kept dependency-free: it is serialised into an inline script.
 */
export function boot(themeKey: string, introKey: string) {
  const d = document.documentElement;
  d.classList.add("js");
  try {
    let t = localStorage.getItem(themeKey);
    if (t !== "light" && t !== "dark") {
      t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    d.setAttribute("data-theme", t);
  } catch {}
  try {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || sessionStorage.getItem(introKey)) d.classList.add("no-loader");
    else sessionStorage.setItem(introKey, "1");
  } catch {
    d.classList.add("no-loader");
  }
}

export const bootScript = `(${boot.toString()})(${JSON.stringify(THEME_STORAGE_KEY)},${JSON.stringify(INTRO_STORAGE_KEY)});`;

/** True when the inline boot script already ran (i.e. the page was server-rendered normally). */
export function hasBooted() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("js");
}
