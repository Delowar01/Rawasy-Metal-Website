"use client";

import { useEffect, type RefObject } from "react";

/*
 * Plays a signature illustration (laser cutting, laser engraving) once when it
 * is half in view, and again when its host card is hovered with a mouse or
 * receives keyboard focus. A run that loops (the hero plate) repeats instead,
 * cycle after cycle, while it is on screen and the page is visible, and rests
 * where it is otherwise. The markup is the finished state; CSS arms the start
 * state only for script-enabled, motion-allowed visitors, so the picture is
 * complete without JavaScript and with reduced motion. Animations run on the
 * elements themselves (Web Animations API) — no canvas, no library.
 */

export interface SignatureRun {
  /** Animations of this run; cancelled when the next run starts. In a loop, every one of them ends at `loop`. */
  anims: Animation[];
  /** Intro-only animations (e.g. the sheet entering) that must outlive replays and cycles. */
  keep?: Animation[];
  /** Length of the run's active part in ms: replays are ignored meanwhile, and the `finished` still frame shows its end. */
  total: number;
  /** Named moments of the intro (ms), for still frames: e.g. `initial`, `active`. `finished` is `total`. */
  moments?: Record<string, number>;
  /** Times (ms) of the run's steps, for a readout that counts them. */
  marks?: number[];
  /** Repeat the run every `loop` ms, start to start: all of `anims` restart together from their first frame. */
  loop?: number;
  /** Called when the run starts, when a loop starts a new cycle, and when a loop rests or carries on. */
  onChange?: () => void;
}

export type SignatureSetup = (root: HTMLElement) => (intro: boolean) => SignatureRun;

export interface SignatureOptions {
  /** Design-system sheet: run the intro once and hold it at a named moment — a still frame, shown with reduced motion too. */
  freeze?: string;
  /** Replay on hover or focus of the host (default). The hero plate loops instead, so hovering it only reads X / Y. */
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
    let current: SignatureRun | undefined;
    let kept: Animation[] = [];
    let busyUntil = 0;
    let onScreen = false;
    // A loop moves only while it is on screen and the page is visible; otherwise it rests where it is.
    const live = () => onScreen && document.visibilityState === "visible";

    const play = (intro: boolean) => {
      current?.anims.forEach((a) => a.cancel());
      if (intro) {
        kept.forEach((a) => a.cancel());
        kept = [];
      }
      const next = run(intro);
      current = next;
      kept.push(...(next.keep ?? []));
      busyUntil = performance.now() + next.total;
      const loop = next.loop;
      if (loop) {
        let cycle = 1;
        root.setAttribute("data-cycle", String(cycle));
        // A finished animation that a later one fully overrides would be discarded by the browser (replaced
        // animations are removed); a loop plays the same animations again, so it keeps them all.
        next.anims.forEach((a) => a.persist());
        // The end of a cycle is the start of the next: every animation of the run goes back to its first frame and
        // plays on, all from one start time (so they cannot drift apart), exactly one loop after the last start (so
        // the loop keeps its period); after a stall the cycle simply starts now. A resting loop waits at the start.
        const clock = next.anims[0];
        clock.addEventListener("finish", () => {
          if (current !== next) return;
          const due = Number(clock.startTime) + loop;
          const now = Number(document.timeline.currentTime);
          const start = now - due < 250 ? due : now;
          next.anims.forEach((a) => {
            if (live()) a.startTime = start;
            else {
              a.currentTime = 0;
              a.pause();
            }
          });
          root.setAttribute("data-cycle", String(++cycle));
          next.onChange?.();
        });
        if (!live()) next.anims.forEach((a) => a.pause());
      }
      next.onChange?.();
    };

    const rest = () => {
      const run = current;
      if (!run?.loop) return;
      const moving = live();
      run.anims.forEach((a) => {
        if (moving && a.playState === "paused") a.play();
        if (!moving && a.playState === "running") a.pause();
      });
      // A pause or a restart takes effect on the next frame: only then does the clock show where the loop stands.
      run.anims[0].ready.then(
        () => current === run && run.onChange?.(),
        () => {},
      );
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        onScreen = entry.isIntersecting;
        // The first run starts once the illustration is half in view; only a loop needs watching after that.
        if (current) return current.loop ? rest() : io.disconnect();
        if (entry.intersectionRatio < 0.5) return;
        play(true);
        if (!current!.loop) io.disconnect();
      },
      { threshold: [0, 0.5] },
    );
    io.observe(root);
    document.addEventListener("visibilitychange", rest);

    const host = root.closest("[data-sig-host]") ?? root;
    const replay = (event: Event) => {
      if (!replays || (event.type === "pointerenter" && (event as PointerEvent).pointerType !== "mouse")) return;
      if (!current || performance.now() < busyUntil) return;
      play(false);
    };
    // `sig:replay` (design-system sheet, captures) replays on demand; `{ detail: { intro: true } }` includes the entrance.
    const force = (event: Event) => play(!current || (event as CustomEvent<{ intro?: boolean }>).detail?.intro === true);
    host.addEventListener("pointerenter", replay);
    host.addEventListener("focusin", replay);
    root.addEventListener("sig:replay", force);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", rest);
      host.removeEventListener("pointerenter", replay);
      host.removeEventListener("focusin", replay);
      root.removeEventListener("sig:replay", force);
      root.removeAttribute("data-cycle");
      [...(current?.anims ?? []), ...kept].forEach((a) => a.cancel());
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
 * segment that starts at its stop. `fill: "forwards"` leaves the element alone
 * until the first stop (a later animation that overrides it only from then on).
 */
export function animate(el: Element, total: number, stops: readonly Stop[], fill: FillMode = "both") {
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
  return el.animate(frames, { delay: from, duration: span, endDelay: total - from - span, fill });
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
