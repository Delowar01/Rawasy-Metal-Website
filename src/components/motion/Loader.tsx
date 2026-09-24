"use client";

import { useEffect, useRef } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { hasBooted } from "@/lib/boot-script";

export const INTRO_DONE_EVENT = "rawasy:intro-done";

declare global {
  interface Window {
    __rawasyIntroDone?: boolean;
  }
}

/** Resolve once the intro loader has finished (immediately if it never ran). */
export function whenIntroDone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  if (window.__rawasyIntroDone || document.documentElement.classList.contains("no-loader")) {
    callback();
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener(INTRO_DONE_EVENT, handler, { once: true });
  return () => window.removeEventListener(INTRO_DONE_EVENT, handler);
}

/**
 * ~1.3 s first-visit intro: the two logo elements lock together, a laser line
 * runs, then the panel lifts. Pure CSS animation (see globals.css) so it can
 * never block content; this component only lets visitors skip it and tells
 * the page when it has finished.
 */
export function Loader({ words, skipLabel }: { words: string[]; skipLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el || root.classList.contains("no-loader")) {
      window.__rawasyIntroDone = true;
      return;
    }
    let finished = false;
    const finish = (skip: boolean) => {
      if (finished) return;
      finished = true;
      window.__rawasyIntroDone = true;
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
      if (skip) {
        el.setAttribute("data-skip", "");
        window.setTimeout(() => el.setAttribute("data-done", ""), 460);
      }
    };
    const exitTimer = window.setTimeout(() => finish(false), 1250);
    const removeTimer = window.setTimeout(() => el.setAttribute("data-done", ""), 2000);
    const skip = () => finish(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
    };
    el.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
      el.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Client-rendered pages (no server HTML, boot script never ran) skip the intro.
  if (typeof document !== "undefined" && !hasBooted()) return null;

  return (
    <div ref={ref} className="loader" aria-hidden title={skipLabel}>
      <div className="flex flex-col items-center gap-7">
        <LogoMark className="loader-mark h-14 w-auto text-ink" />
        <div className="relative h-px w-40 overflow-hidden bg-line">
          <span className="loader-bar absolute inset-0 bg-accent" />
        </div>
        <p className="t-label flex items-center gap-2.5 text-ink-3">
          {words.map((word, i) => (
            <span key={word} className="flex items-center gap-2.5">
              {i > 0 && (
                <span className="loader-word text-accent" style={{ animationDelay: `${0.3 + i * 0.22 - 0.1}s` }}>
                  /
                </span>
              )}
              <span className="loader-word" style={{ animationDelay: `${0.3 + i * 0.22}s` }}>
                {word}
              </span>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
