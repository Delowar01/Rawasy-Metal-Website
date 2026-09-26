/*
 * A V2's theme: light or dark, applied before first paint. `?theme=light|dark`
 * chooses (and remembers) one; otherwise the stored choice, otherwise the
 * system setting. Without JavaScript the page stays light. The key is the lab's
 * own, so the website's theme choice is not touched.
 */
export const THEME_KEY = "rawasy-lab-a2-theme";

function boot(key: string) {
  try {
    const asked = new URLSearchParams(location.search).get("theme");
    if (asked === "light" || asked === "dark") localStorage.setItem(key, asked);
    let theme = localStorage.getItem(key);
    if (theme !== "light" && theme !== "dark") theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch {}
}

export const themeBoot = `(${boot.toString()})(${JSON.stringify(THEME_KEY)});`;
