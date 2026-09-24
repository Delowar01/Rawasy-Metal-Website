"use client";

import { useEffect, useRef, useState } from "react";

const FIELD_SELECTOR = "input, textarea, select, [contenteditable='true'], iframe, video";

/**
 * Subtle ring that trails the pointer and morphs into a label (VIEW / EXPLORE /
 * DRAG) over `[data-cursor]` elements. The native cursor is always kept, so
 * native controls are never affected. Disabled on touch and reduced motion.
 */
export function CustomCursor({ labels }: { labels: { view: string; explore: string; drag: string } }) {
  const [enabled, setEnabled] = useState(false);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(fine.matches && !reduce.matches);
    update();
    fine.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const ring = ringRef.current;
    const label = labelRef.current;
    if (!ring || !label) return;

    let x = -100;
    let y = -100;
    let tx = -100;
    let ty = -100;
    let raf = 0;
    let visible = false;

    const loop = () => {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) raf = requestAnimationFrame(loop);
      else raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        visible = true;
        x = tx;
        y = ty;
        ring.dataset.visible = "true";
      }
      const target = e.target as Element | null;
      const field = target?.closest(FIELD_SELECTOR);
      const ctx = target?.closest<HTMLElement>("[data-cursor]");
      const interactive = target?.closest("a, button, [role='button'], label, summary");
      const mode = field ? "hidden" : ctx?.dataset.cursor ?? (interactive ? "link" : "default");
      if (ring.dataset.mode !== mode) {
        ring.dataset.mode = mode;
        label.textContent =
          mode === "view" ? labels.view : mode === "explore" ? labels.explore : mode === "drag" ? labels.drag : "";
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onLeave = () => {
      visible = false;
      ring.dataset.visible = "false";
    };
    const onDown = () => ring.setAttribute("data-down", "");
    const onUp = () => ring.removeAttribute("data-down");

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [enabled, labels]);

  if (!enabled) return null;

  return (
    <div ref={ringRef} className="cursor-ring" data-visible="false" data-mode="default" aria-hidden>
      <span className="cursor-shape">
        <span ref={labelRef} className="cursor-label" />
      </span>
    </div>
  );
}
