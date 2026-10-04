"use client";

import { useEffect, useRef } from "react";
import { FINE_POINTER, FORCED_COLORS, REDUCED_MOTION, useMedia } from "./useMedia";

/*
 * The laser pointer (Modern Commerce): a small laser point with a precision ring that trails it
 * slightly. Over links, buttons and cards the ring opens into an orange halo
 * (the laser "active"); over the hero plate it becomes a crosshair; pressing
 * tightens it. It also moves the soft light of the card under it (--mx / --my).
 * Desktop mouse only: touch, pens, reduced motion and forced colours keep the
 * system cursor, and so do text fields (the I-beam) and anything outside `scope`. The system
 * cursor gives way only once the mouse moves, and comes back at once if reduced motion or
 * forced colours are turned on while the page is open. It only follows the mouse — no
 * information depends on it, and keyboard focus is untouched.
 */

const TEXT = "input:not([type='checkbox'], [type='radio'], [type='button'], [type='submit'], [type='reset'], [type='range'], [type='color']), textarea, [contenteditable='true']";
const ACTIVE = "a, button, summary, label, select, [role='button'], [role='tab'], .card-link, input";
/** Cards whose light follows the mouse. */
const LIT = ".card-link:not(.a2-proj), .a2-quick, .contact-row";
/** Surfaces that set the ring's colour: the innermost one decides, otherwise the page theme. */
const REGION = ".a2-theme-light, .a2-theme-dark, .a2-footer, .a2-cta-dark, .a2-stage-dark";

export function Cursor({ scope = ".mc" }: { scope?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useMedia(FINE_POINTER);
  const calm = useMedia(REDUCED_MOTION, true);
  const forced = useMedia(FORCED_COLORS, true);

  useEffect(() => {
    const cursor = ref.current;
    if (!cursor || !fine || calm || forced) return;

    const root = document.documentElement;
    const dot = cursor.querySelector<HTMLElement>(".a2-cursor-dot")!;
    const ring = cursor.querySelector<HTMLElement>(".a2-cursor-ring")!;
    let x = 0;
    let y = 0;
    let rx = 0;
    let ry = 0;
    let frame = 0;
    let seen = false;
    let lit: HTMLElement | null = null;

    // `translate` (not `transform`) positions them, so the state's `scale` stays centred on the point.
    const place = (el: HTMLElement, px: number, py: number) => (el.style.translate = `${px}px ${py}px`);

    // The ring eases towards the point, then the loop stops until the mouse moves again.
    const follow = () => {
      rx += (x - rx) * 0.24;
      ry += (y - ry) * 0.24;
      if (Math.abs(x - rx) + Math.abs(y - ry) < 0.2) {
        rx = x;
        ry = y;
        frame = 0;
      } else frame = requestAnimationFrame(follow);
      place(ring, rx, ry);
    };

    const show = (on: boolean) => cursor.toggleAttribute("data-shown", on);

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        // A pen or a finger: give the system cursor back until the mouse returns.
        root.removeAttribute("data-cursor-on");
        return show(false);
      }
      root.setAttribute("data-cursor-on", "");
      x = event.clientX;
      y = event.clientY;
      if (!seen) {
        seen = true;
        rx = x;
        ry = y;
        place(ring, x, y);
        // The mouse may have entered its element before this script was listening (while the page was starting, or
        // before reduced motion was turned off again): the first move reads what is under it, so the page never hides
        // the system cursor without showing this one.
        over(event.target);
      }
      place(dot, x, y);
      if (!frame) frame = requestAnimationFrame(follow);
      if (lit) {
        const box = lit.getBoundingClientRect();
        lit.style.setProperty("--mx", `${(x - box.left).toFixed(0)}px`);
        lit.style.setProperty("--my", `${(y - box.top).toFixed(0)}px`);
      }
    };

    // What is under the pointer decides the state (when it enters a new element, and on the first move).
    const over = (under: EventTarget | null) => {
      const target = under instanceof Element ? under : null;
      const inside = target?.closest(scope);
      const typing = target?.closest(TEXT);
      show(Boolean(inside && !typing));
      lit = target?.closest<HTMLElement>(LIT) ?? null;
      if (!target || !inside || typing) return;
      cursor.dataset.state = target.closest("[data-cursor='plate']") ? "plate" : target.closest(ACTIVE) ? "active" : "idle";
      const region = target.closest(REGION);
      cursor.toggleAttribute("data-dark", region ? !region.matches(".a2-theme-light") : root.getAttribute("data-theme") === "dark");
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "mouse") over(event.target);
    };
    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) show(false);
    };
    const onDown = () => cursor.setAttribute("data-press", "");
    const onUp = () => cursor.removeAttribute("data-press");

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeAttribute("data-cursor-on");
      show(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
    };
  }, [scope, fine, calm, forced]);

  return (
    <div ref={ref} className="a2-cursor" data-state="idle" aria-hidden>
      <span className="a2-cursor-ring" />
      <span className="a2-cursor-dot" />
    </div>
  );
}
