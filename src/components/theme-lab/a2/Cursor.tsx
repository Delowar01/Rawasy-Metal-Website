"use client";

import { useEffect, useRef } from "react";

/*
 * A V2's pointer: a small laser point with a precision ring that trails it
 * slightly. Over links, buttons and cards the ring opens into an orange halo
 * (the laser "active"); over the hero plate it becomes a crosshair; pressing
 * tightens it. It also moves the soft light of the card under it (--mx / --my).
 * Desktop mouse only: touch, pens, reduced motion and forced colours keep the
 * system cursor, and so do text fields (the I-beam) and the lab bar. The system
 * cursor gives way only once the mouse moves. It only follows the mouse — no
 * information depends on it, and keyboard focus is untouched.
 */

const TEXT = "input:not([type='checkbox'], [type='radio'], [type='button'], [type='submit'], [type='reset'], [type='range'], [type='color']), textarea, [contenteditable='true']";
const ACTIVE = "a, button, summary, label, select, [role='button'], [role='tab'], .card-link, input";
/** Cards whose light follows the mouse. */
const LIT = ".card-link:not(.a2-proj), .a2-quick, .contact-row";
/** Surfaces that set the ring's colour: the innermost one decides, otherwise the page theme. */
const REGION = ".a2-theme-light, .a2-theme-dark, .a2-footer, .a2-cta-dark, .a2-stage-dark";

export function CursorA2() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = ref.current;
    if (!cursor) return;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const forced = matchMedia("(forced-colors: active)").matches;
    if (!fine || calm || forced) return;

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
      }
      place(dot, x, y);
      if (!frame) frame = requestAnimationFrame(follow);
      if (lit) {
        const box = lit.getBoundingClientRect();
        lit.style.setProperty("--mx", `${(x - box.left).toFixed(0)}px`);
        lit.style.setProperty("--my", `${(y - box.top).toFixed(0)}px`);
      }
    };

    // What is under the pointer decides the state (only when it enters a new element).
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target instanceof Element ? event.target : null;
      const inside = target?.closest(".lab-a2");
      const typing = target?.closest(TEXT);
      show(Boolean(inside && !typing));
      lit = target?.closest<HTMLElement>(LIT) ?? null;
      if (!target || !inside || typing) return;
      cursor.dataset.state = target.closest("[data-cursor='plate']") ? "plate" : target.closest(ACTIVE) ? "active" : "idle";
      const region = target.closest(REGION);
      cursor.toggleAttribute("data-dark", region ? !region.matches(".a2-theme-light") : root.getAttribute("data-theme") === "dark");
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
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div ref={ref} className="a2-cursor" data-state="idle" aria-hidden>
      <span className="a2-cursor-ring" />
      <span className="a2-cursor-dot" />
    </div>
  );
}
