"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import { createSparks } from "./hero/sparks";

/**
 * The RAWASY signature: an orange laser line travels through the statement
 * (scrubbed by scroll), throwing sparks, and the lettering separates along the
 * cut. Used once on the homepage.
 */
export function PrecisionStatement({
  lines,
  caption,
  label,
  rtl,
}: {
  lines: string[];
  caption: string;
  label: string;
  rtl: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;
      const block = el.querySelector<HTMLElement>("[data-block]")!;
      const top = el.querySelector<HTMLElement>('[data-half="top"]')!;
      const bottom = el.querySelector<HTMLElement>('[data-half="bottom"]')!;
      const laser = el.querySelector<HTMLElement>("[data-laser]")!;
      const head = el.querySelector<HTMLElement>("[data-head]")!;
      const canvas = el.querySelector<HTMLCanvasElement>("[data-sparks]")!;
      const sign = rtl ? -1 : 1;
      const from = { x: rtl ? 100 : 0, y: 62 };
      const to = { x: rtl ? 0 : 100, y: 38 };

      const view = { w: 100, h: 100 };
      const sparks = createSparks(canvas, view);
      const proxy = { p: 0 };
      let last = 0;
      const place = () => {
        const fx = (from.x / 100) * view.w;
        const fy = (from.y / 100) * view.h;
        const tx = (to.x / 100) * view.w;
        const ty = (to.y / 100) * view.h;
        const x = fx + (tx - fx) * proxy.p;
        const y = fy + (ty - fy) * proxy.p;
        laser.style.width = `${Math.hypot(tx - fx, ty - fy)}px`;
        laser.style.transform = `translate3d(${fx}px, ${fy - 1}px, 0) rotate(${Math.atan2(ty - fy, tx - fx)}rad) scaleX(${proxy.p})`;
        head.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        if (proxy.p > last + 0.002 && proxy.p < 0.995) sparks.emit(x, y, 4, 1.1);
        last = proxy.p;
      };
      // Keep the cut geometry in sync with the text block's size.
      const measure = () => {
        view.w = block.offsetWidth;
        view.h = block.offsetHeight;
        sparks.resize();
        place();
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(block);

      const tl = gsap.timeline({
        scrollTrigger: { trigger: block, start: "top 78%", end: "bottom 42%", scrub: 0.7 },
      });
      tl.to(head, { opacity: 1, duration: 0.05 }, 0)
        .to(proxy, { p: 1, duration: 1, ease: "none", onUpdate: place }, 0)
        .to(head, { opacity: 0, duration: 0.1 }, 1)
        .to(top, { x: -6 * sign, y: -8, duration: 0.45, ease: "power2.out" }, 0.9)
        .to(bottom, { x: 6 * sign, y: 8, duration: 0.45, ease: "power2.out" }, 0.9)
        .to(laser, { opacity: 0.45, duration: 0.3 }, 1.05);

      return () => {
        ro.disconnect();
        sparks.destroy();
      };
    },
    { scope: root, dependencies: [rtl] },
  );

  const renderLines = () =>
    lines.map((line, i) => (
      <span key={i} className="block">
        {i === lines.length - 1 && line.endsWith(".") ? (
          <>
            {line.slice(0, -1)}
            <span className="text-accent">.</span>
          </>
        ) : (
          line
        )}
      </span>
    ));

  return (
    <section aria-label={label} className="on-band relative overflow-hidden bg-band text-band-ink">
      <div aria-hidden className="bg-perforated pointer-events-none absolute inset-0 opacity-[0.35] [--perf-dot:rgb(236_234_229/0.1)] [mask-image:linear-gradient(to_left,black,transparent_60%)] rtl:[mask-image:linear-gradient(to_right,black,transparent_60%)]" />
      <div ref={root} className="container-x relative py-[clamp(6rem,4rem+8vw,12rem)]">
        <p className="sr-only">{lines.join(" ")}</p>
        <div data-block aria-hidden className="statement relative w-fit max-w-full">
          <div data-half="top" className="statement-half statement-top">
            {renderLines()}
          </div>
          <div data-half="bottom" className="statement-half statement-bottom absolute inset-0">
            {renderLines()}
          </div>
          <span
            data-laser
            className="statement-laser pointer-events-none absolute left-0 top-0 h-[2px] origin-[0_50%] bg-accent shadow-[0_0_12px_2px_rgb(241_95_34/0.75)]"
          />
          <span data-head className="pointer-events-none absolute left-0 top-0 -ml-[5px] -mt-[5px] size-2.5 rounded-full bg-[#fff4e6] opacity-0 shadow-[0_0_14px_5px_rgb(241_95_34/0.85)]" />
          <canvas data-sparks className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
        <p className="t-label mt-12 flex items-center gap-3 text-band-ink-2">
          <span className="h-px w-8 bg-accent" aria-hidden />
          {caption}
        </p>
      </div>
    </section>
  );
}
