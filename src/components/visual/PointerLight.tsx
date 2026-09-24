"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A soft light that follows the pointer across its (positioned) parent, like
 * a reflection moving over sheet metal. Desktop only: never on touch screens
 * or with reduced motion. Moves with transforms only.
 */
export function PointerLight({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const light = ref.current;
    const host = light?.parentElement;
    if (!light || !host) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!mq.matches) return;

    let raf = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      raf = 0;
      light.style.setProperty("--lx", `${x}px`);
      light.style.setProperty("--ly", `${y}px`);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      move(e);
      light.setAttribute("data-on", "");
    };
    const leave = () => light.removeAttribute("data-on");

    host.addEventListener("pointermove", move);
    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <span ref={ref} aria-hidden className={cn("plight", className)} />;
}
