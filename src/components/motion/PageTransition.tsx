"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

declare global {
  interface Window {
    __rawasyHydrated?: boolean;
  }
}

/**
 * Lightweight page transition (~600 ms). On client-side navigations the new
 * page mounts under a graphite panel with an orange cut edge that sweeps away
 * in the reading direction. Skipped on first load and with reduced motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Only true for client-side navigations (never during SSR/hydration).
  const [run] = useState(() => typeof window !== "undefined" && !!window.__rawasyHydrated);

  useEffect(() => {
    window.__rawasyHydrated = true;
    const el = ref.current;
    if (!run || !el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.state = "run";
    const done = () => {
      el.dataset.state = "idle";
    };
    el.addEventListener("animationend", done, { once: true });
    return () => el.removeEventListener("animationend", done);
  }, [run]);

  return (
    <>
      {children}
      <div ref={ref} className="page-wipe" data-state="idle" aria-hidden />
    </>
  );
}
