import { INTRO_STORAGE_KEY, THEME_STORAGE_KEY } from "./utils";

/**
 * Runs in <head> before the first paint of a Modern Commerce page:
 *  - flags that script is available (reveals, the hero loop and the menus arm themselves only then),
 *  - applies the visitor's theme — the website's own stored choice, otherwise the system setting — so there is no
 *    flash of the wrong theme and every page, migrated or not, shows the same one,
 *  - marks the session's intro as seen: the pages not yet migrated open with a one-time loader, which should not
 *    appear on the way from a Modern Commerce page.
 * Without script the page stays light. Kept dependency-free: it is serialised into an inline script.
 */
export function commerceBoot(themeKey: string, introKey: string) {
  const d = document.documentElement;
  d.classList.add("js");
  try {
    let theme = localStorage.getItem(themeKey);
    if (theme !== "light" && theme !== "dark") theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    d.setAttribute("data-theme", theme);
  } catch {}
  try {
    sessionStorage.setItem(introKey, "1");
  } catch {}
}

export const commerceBootScript = `(${commerceBoot.toString()})(${JSON.stringify(THEME_STORAGE_KEY)},${JSON.stringify(INTRO_STORAGE_KEY)});`;
