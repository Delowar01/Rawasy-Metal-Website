"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "../Icon";
import { THEME_KEY } from "./theme-boot";

type Theme = "light" | "dark";

const root = () => document.documentElement;
const read = (): Theme => (root().getAttribute("data-theme") === "dark" ? "dark" : "light");
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(root(), { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};

/** Light / dark switch for A V2. Keeps following the system until a theme is chosen here. */
export function ThemeSwitchA2({ label, light, dark, className = "" }: { label: string; light: string; dark: string; className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => null);

  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      let chosen: string | null = null;
      try {
        chosen = localStorage.getItem(THEME_KEY);
      } catch {}
      if (chosen !== "light" && chosen !== "dark") root().setAttribute("data-theme", system.matches ? "dark" : "light");
    };
    system.addEventListener("change", follow);
    return () => system.removeEventListener("change", follow);
  }, []);

  const choose = (next: Theme) => {
    if (next === read()) return;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    const apply = () => root().setAttribute("data-theme", next);
    // A short cross-fade where the browser supports it; instant with reduced motion.
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
    if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
    else apply();
  };

  return (
    <span className={`seg ${className}`} role="group" aria-label={label} data-js-only>
      <button type="button" aria-pressed={theme === "light"} aria-label={light} onClick={() => choose("light")}>
        <Icon name="sun" size={16} />
      </button>
      <button type="button" aria-pressed={theme === "dark"} aria-label={dark} onClick={() => choose("dark")}>
        <Icon name="moon" size={16} />
      </button>
    </span>
  );
}
