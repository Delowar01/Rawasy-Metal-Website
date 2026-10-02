import { THEME_STORAGE_KEY } from "./utils";

/**
 * Runs in <head> before the first paint of a Modern Commerce page:
 *  - flags that script is available (reveals, the hero loop and the menus arm themselves only then),
 *  - applies the visitor's theme — the website's stored choice, otherwise the system setting — so there is no flash of
 *    the wrong theme,
 *  - turns on gliding same-page jumps (`data-smooth-scroll`) only once the page has loaded and its fonts are in. The
 *    browser's first jump to the address's #anchor is therefore instant, and the browser keeps that jump on its
 *    target while the page loads; a gliding one kept the position it set out for, so a web font arriving on the way
 *    left the target short of its place or under the header.
 * Without script the page stays light and every jump is instant. Kept dependency-free: it is serialised into an
 * inline script.
 */
export function commerceBoot(themeKey: string) {
  const d = document.documentElement;
  d.classList.add("js");
  try {
    let theme = localStorage.getItem(themeKey);
    if (theme !== "light" && theme !== "dark") theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    d.setAttribute("data-theme", theme);
  } catch {}
  // After the load event and the fonts, two frames: the browser's last correction of the first jump is laid out first.
  // (BootFallback runs this on a page that has already loaded.)
  const glide = () => document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => d.setAttribute("data-smooth-scroll", ""))));
  if (document.readyState === "complete") glide();
  else addEventListener("load", glide);
}

export const commerceBootScript = `(${commerceBoot.toString()})(${JSON.stringify(THEME_STORAGE_KEY)});`;
