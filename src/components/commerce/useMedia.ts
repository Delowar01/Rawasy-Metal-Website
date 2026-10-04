"use client";

import { useSyncExternalStore } from "react";

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
export const FORCED_COLORS = "(forced-colors: active)";
export const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * A media query's answer, kept current while the page is open: a visitor who turns reduced motion (or forced colours)
 * on mid-visit stops every moving part at once, not on the next page load. `server` is the answer before the page has
 * hydrated; motion code passes the calm one, so nothing starts until the real answer is known.
 */
export function useMedia(query: string, server = false) {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => server,
  );
}
