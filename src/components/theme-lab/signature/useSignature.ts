"use client";

import { useEffect, type RefObject } from "react";

/*
 * Plays a signature illustration (laser cutting, laser engraving) once when it
 * is half in view, and again when its host card is hovered with a mouse or
 * receives keyboard focus. The markup is the finished state; CSS arms the
 * start state only for script-enabled, motion-allowed visitors, so the picture
 * is complete without JavaScript and with reduced motion. Animations run on
 * the SVG elements themselves (Web Animations API) — no canvas, no library.
 */

export interface SignatureRun {
  /** Animations of this run; cancelled when the next run starts. */
  anims: Animation[];
  /** Intro-only animations (e.g. the plate entering) that must outlive replays. */
  keep?: Animation[];
  /** Length of the run in ms, during which replays are ignored. */
  total: number;
}

export type SignatureSetup = (svg: SVGSVGElement) => (intro: boolean) => SignatureRun;

export function useSignature(ref: RefObject<SVGSVGElement | null>, setup: SignatureSetup) {
  useEffect(() => {
    const svg = ref.current;
    if (!svg || typeof svg.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const run = setup(svg);
    let current: Animation[] = [];
    let kept: Animation[] = [];
    let played = false;
    let busyUntil = 0;

    const play = (intro: boolean) => {
      current.forEach((a) => a.cancel());
      if (intro) {
        kept.forEach((a) => a.cancel());
        kept = [];
      }
      const { anims, keep = [], total } = run(intro);
      current = anims;
      kept.push(...keep);
      played = true;
      busyUntil = performance.now() + total;
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        if (!played) play(true);
      },
      { threshold: 0.5 },
    );
    io.observe(svg);

    const host = svg.closest("[data-sig-host]") ?? svg;
    const replay = (event: Event) => {
      if (event.type === "pointerenter" && (event as PointerEvent).pointerType !== "mouse") return;
      if (!played || performance.now() < busyUntil) return;
      play(false);
    };
    // `sig:replay` (design-system sheet, captures) replays on demand; `{ detail: { intro: true } }` includes the entrance.
    const force = (event: Event) => play(!played || (event as CustomEvent<{ intro?: boolean }>).detail?.intro === true);
    host.addEventListener("pointerenter", replay);
    host.addEventListener("focusin", replay);
    svg.addEventListener("sig:replay", force);

    return () => {
      io.disconnect();
      host.removeEventListener("pointerenter", replay);
      host.removeEventListener("focusin", replay);
      svg.removeEventListener("sig:replay", force);
      [...current, ...kept].forEach((a) => a.cancel());
    };
  }, [ref, setup]);
}

export type Stop = readonly [ms: number, frame: Keyframe, easing?: string];

/**
 * Keyframes on a shared clock: every animation of a run lasts `total` ms, so a
 * run can be paused at any moment as one frame. Values hold before the first
 * stop and after the last; `easing` shapes the segment that starts at its stop.
 */
export function track(total: number, stops: readonly Stop[]): Keyframe[] {
  const frames: Keyframe[] = [];
  const at = (ms: number) => Math.min(Math.max(ms / total, 0), 1);
  let last = 0;
  stops.forEach(([ms, frame, easing], i) => {
    const offset = Math.max(at(ms), last);
    if (i === 0 && offset > 0) frames.push({ ...frame, offset: 0 });
    frames.push({ ...frame, offset, ...(easing ? { easing } : {}) });
    last = offset;
  });
  const end = stops[stops.length - 1][1];
  if (last < 1) frames.push({ ...end, offset: 1 });
  return frames;
}

export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

/** Every animation of a run shares the clock and keeps its end state. */
export function animate(el: Element, frames: Keyframe[], total: number) {
  return el.animate(frames, { duration: total, fill: "both" });
}
