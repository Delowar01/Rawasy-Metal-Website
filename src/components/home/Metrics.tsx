"use client";

import { useEffect, useRef } from "react";

export interface MetricView {
  slug: string;
  value?: number;
  display: string;
  unit?: string;
  label: string;
}

/** Count a figure up from zero once it scrolls into view (instant with reduced motion). */
function useCountUp(ref: React.RefObject<HTMLElement | null>, value: number | undefined, display: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el || value === undefined) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pad = display.length;
    const grouped = display.includes(",");
    const format = (n: number) => {
      const s = grouped ? Math.round(n).toLocaleString("en-US") : String(Math.round(n));
      return grouped ? s : s.padStart(pad, "0");
    };
    el.textContent = format(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 1600;
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 4);
          el.textContent = format(value * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
          else el.textContent = display;
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ref, value, display]);
}

function Figure({ metric }: { metric: MetricView }) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(ref, metric.value, metric.display);
  return (
    <div className="relative flex flex-col justify-between gap-8 border-b border-band-line py-8 sm:border-e sm:px-8 sm:py-10 lg:border-b-0 lg:[&:last-child]:border-e-0">
      <p className="flex items-start gap-2 text-band-ink" dir={!metric.unit || metric.unit.length <= 2 ? "ltr" : undefined}>
        <span ref={ref} className="font-display text-[clamp(2.5rem,2.04rem+1.9vw,3.75rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
          {metric.display}
        </span>
        {metric.unit && <span className="mt-1 font-display text-xl font-medium text-accent">{metric.unit}</span>}
      </p>
      <p className="t-label text-band-ink-2">{metric.label}</p>
    </div>
  );
}

/** Capability you can measure — only figures printed in the company profile. */
export function Metrics({
  metrics,
  statements,
  footnote,
}: {
  metrics: MetricView[];
  statements: { title: string; body: string }[];
  footnote: string;
}) {
  return (
    <>
      <div className="grid border-t border-band-line sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
        {metrics.map((m) => (
          <Figure key={m.slug} metric={m} />
        ))}
      </div>
      <ul className="mt-14 grid gap-x-8 gap-y-8 border-t border-band-line pt-10 sm:grid-cols-2 lg:grid-cols-4">
        {statements.map((s) => (
          <li key={s.title} className="flex gap-4">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rotate-45 bg-accent" />
            <div>
              <p className="font-display font-semibold text-band-ink">{s.title}</p>
              <p className="mt-1.5 text-sm text-band-ink-2">{s.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="t-label mt-12 text-band-ink-2 opacity-80">{footnote}</p>
    </>
  );
}
