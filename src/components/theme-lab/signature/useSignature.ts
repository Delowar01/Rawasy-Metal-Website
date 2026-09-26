"use client";

import { useEffect, type RefObject } from "react";

/*
 * Plays a signature illustration (laser cutting, laser engraving) once when it
 * is half in view, and again when its host card is hovered with a mouse or
 * receives keyboard focus. The markup is the finished state; CSS arms the
 * start state only for script-enabled, motion-allowed visitors, so the picture
 * is complete without JavaScript and with reduced motion. Animations run on
 * the elements themselves (Web Animations API) — no canvas, no library.
 */

export interface SignatureRun {
  /** Animations of this run; cancelled when the next run starts. */
  anims: Animation[];
  /** Intro-only animations (e.g. the sheet entering) that must outlive replays. */
  keep?: Animation[];
  /** Length of the run in ms, during which replays are ignored. */
  total: number;
  /** Named moments of the intro (ms), for still frames: e.g. `initial`, `active`. `finished` is the end. */
  moments?: Record<string, number>;
  /** Times (ms) of the run's steps, for a readout that counts them. */
  marks?: number[];
}

export type SignatureSetup = (root: HTMLElement) => (intro: boolean) => SignatureRun;

export interface SignatureOptions {
  /** Design-system sheet: run the intro once and hold it at a named moment — a still frame, shown with reduced motion too. */
  freeze?: string;
  /** Replay on hover or focus of the host (default). The hero plate plays once only. */
  replay?: boolean;
}

export function useSignature(ref: RefObject<HTMLElement | null>, setup: SignatureSetup, { freeze, replay: replays = true }: SignatureOptions = {}) {
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof root.animate !== "function") return;

    if (freeze !== undefined) {
      const { anims, keep = [], total, moments = {} } = setup(root)(true);
      const all = [...anims, ...keep];
      const time = freeze === "finished" ? total : (moments[freeze] ?? total);
      all.forEach((a) => {
        a.pause();
        a.currentTime = time;
      });
      root.setAttribute("data-frozen", "");
      return () => all.forEach((a) => a.cancel());
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const run = setup(root);
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
    io.observe(root);

    const host = root.closest("[data-sig-host]") ?? root;
    const replay = (event: Event) => {
      if (!replays || (event.type === "pointerenter" && (event as PointerEvent).pointerType !== "mouse")) return;
      if (!played || performance.now() < busyUntil) return;
      play(false);
    };
    // `sig:replay` (design-system sheet, captures) replays on demand; `{ detail: { intro: true } }` includes the entrance.
    const force = (event: Event) => play(!played || (event as CustomEvent<{ intro?: boolean }>).detail?.intro === true);
    host.addEventListener("pointerenter", replay);
    host.addEventListener("focusin", replay);
    root.addEventListener("sig:replay", force);

    return () => {
      io.disconnect();
      host.removeEventListener("pointerenter", replay);
      host.removeEventListener("focusin", replay);
      root.removeEventListener("sig:replay", force);
      [...current, ...kept].forEach((a) => a.cancel());
    };
  }, [ref, setup, freeze, replays]);
}

export type Stop = readonly [ms: number, frame: Keyframe, easing?: string];

export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

/**
 * Keyframes on a shared clock: every animation of a run ends at `total` ms, so a
 * run can be paused at any moment as one frame. Each animation is active only
 * from its first stop to its last (a delay before, an end delay after, values
 * held by the fill), so nothing is sampled while it waits; `easing` shapes the
 * segment that starts at its stop.
 */
export function animate(el: Element, total: number, stops: readonly Stop[]) {
  const from = Math.min(Math.max(stops[0][0], 0), total);
  const to = Math.min(Math.max(stops[stops.length - 1][0], from), total);
  const span = Math.max(to - from, 1);
  let last = 0;
  const frames: Keyframe[] = stops.map(([ms, frame, easing]) => {
    last = Math.max(Math.min(Math.max((ms - from) / span, 0), 1), last);
    return { ...frame, offset: last, ...(easing ? { easing } : {}) };
  });
  frames[0] = { ...frames[0], offset: 0 };
  if (frames.length === 1) frames.push({ ...stops[0][1], offset: 1 });
  frames[frames.length - 1] = { ...frames[frames.length - 1], offset: 1 };
  return el.animate(frames, { delay: from, duration: span, endDelay: total - from - span, fill: "both" });
}

/** Points along a path at even spacing (a constant feed rate), in its user units. */
export function samplePath(el: SVGGeometryElement, step = 4): [number, number][] {
  const length = el.getTotalLength();
  const n = Math.max(2, Math.ceil(length / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = el.getPointAtLength((i / n) * length);
    return [p.x, p.y] as [number, number];
  });
}

export const at = ([x, y]: readonly [number, number]) => `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
