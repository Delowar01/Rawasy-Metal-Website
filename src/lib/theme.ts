"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./utils";

export type Theme = "light" | "dark";

const BG: Record<Theme, string> = { light: "#f3f1ed", dark: "#17191a" };

function read(): Theme | undefined {
  const value = document.documentElement.getAttribute("data-theme");
  return value === "dark" || value === "light" ? value : undefined;
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Current theme; `undefined` during SSR/hydration. */
export function useTheme() {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

function commit(next: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {}
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", BG[next]));
}

/**
 * Switch theme. Where supported, the new theme is revealed with a circular
 * wipe from the control that triggered it; otherwise colours cross-fade.
 */
export function setTheme(next: Theme, origin?: { x: number; y: number }) {
  if (read() === next) return;
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

  if (!reduce && origin && typeof doc.startViewTransition === "function") {
    const transition = doc.startViewTransition(() => commit(next));
    transition.ready
      .then(() => {
        const radius = Math.hypot(
          Math.max(origin.x, window.innerWidth - origin.x),
          Math.max(origin.y, window.innerHeight - origin.y),
        );
        root.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
          { duration: 700, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
    return;
  }

  if (!reduce) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 420);
  }
  commit(next);
}

/** Keep following the OS theme until the visitor picks one explicitly. */
export function followSystemTheme() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
    if (stored !== "light" && stored !== "dark") {
      document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
    }
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
