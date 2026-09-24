"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export interface MachineView {
  slug: string;
  name: string;
  shortName: string;
  category: string;
  power?: string;
  powerWatts?: number;
  capability: string;
  service: { name: string; href: string };
  image: { src: string; width: number; height: number; blurDataURL: string; alt: string };
}

/**
 * What capabilities does RAWASY have? — machine selector + large stage on a
 * coordinate grid. Tab semantics with arrow-key support; the stage transitions
 * in the reading direction and a scan line sweeps on every change.
 */
export function MachineExplorer({
  machines,
  labels,
}: {
  machines: MachineView[];
  labels: { power: string; usedFor: string; service: string; previous: string; next: string; notStated: string; list: string };
}) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [sweep, setSweep] = useState(0);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const uid = useId();
  const count = machines.length;

  const go = useCallback(
    (next: number, focus = false) => {
      const i = (next + count) % count;
      setDirection(i > active || (active === count - 1 && i === 0) ? 1 : -1);
      setActive(i);
      setSweep((n) => n + 1);
      if (focus) tabsRef.current[i]?.focus();
    },
    [active, count],
  );

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const map: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (e.key in map) {
      e.preventDefault();
      const rtlFlip = document.documentElement.dir === "rtl" && (e.key === "ArrowLeft" || e.key === "ArrowRight") ? -1 : 1;
      go(active + map[e.key] * rtlFlip, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      go(count - 1, true);
    }
  };

  const m = machines[active];

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      {/* Selector */}
      <div
        role="tablist"
        aria-label={labels.list}
        aria-orientation="vertical"
        className="-mx-[var(--gutter)] flex gap-2 self-start overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:none] lg:sticky lg:top-28 lg:col-span-4 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-line lg:px-0 lg:pb-0"
      >
        {machines.map((machine, i) => {
          const selected = i === active;
          return (
            <button
              key={machine.slug}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${uid}-tab-${i}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => go(i)}
              onKeyDown={onKey}
              className={cn(
                "group relative flex shrink-0 items-center gap-4 border px-4 py-3 text-start transition-colors lg:border-x-0 lg:border-t-0 lg:px-0 lg:py-5",
                selected ? "border-accent bg-accent-soft lg:border-line lg:bg-transparent" : "border-line hover:border-line-strong",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-px start-0 hidden h-[2px] bg-accent transition-[width] duration-700 ease-out-expo lg:block",
                  selected ? "w-full" : "w-0",
                )}
              />
              <span className={cn("t-num text-xs", selected ? "text-accent-ink" : "text-ink-3")}>{String(i + 1).padStart(2, "0")}</span>
              <span className={cn("flex-1 whitespace-nowrap font-display text-[0.95rem] font-semibold lg:text-[1.0625rem]", selected ? "text-ink" : "text-ink-2 group-hover:text-ink")}>
                {machine.shortName}
              </span>
              <span className="t-num hidden text-sm text-ink-3 lg:inline" dir="ltr">
                {machine.power ?? labels.notStated}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stage */}
      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${active}`}
        className="lg:col-span-8"
      >
        <div className="machine-stage relative overflow-hidden border border-line bg-surface">
          <div aria-hidden className="bg-grid-fine absolute inset-0 opacity-80" />
          <div aria-hidden className="bg-grid absolute inset-0" />
          {/* Axis ticks */}
          <div aria-hidden className="t-num absolute inset-x-5 top-3 flex justify-between text-[0.62rem] text-ink-3" dir="ltr">
            {["0", "200", "400", "600", "800", "1000"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div aria-hidden className="t-num absolute bottom-10 start-3 top-10 flex flex-col justify-between text-[0.62rem] text-ink-3" dir="ltr">
            {["600", "400", "200", "0"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          {/* Oversized power figure behind the machine */}
          <span
            aria-hidden
            key={`p-${m.slug}`}
            className="machine-power pointer-events-none absolute end-6 top-8 select-none font-display text-[clamp(3.25rem,2.23rem+4.19vw,6rem)] font-semibold leading-none text-transparent [-webkit-text-stroke:1px_var(--border-strong)]"
            dir="ltr"
          >
            {m.power ?? ""}
          </span>

          <div className="relative flex aspect-[16/11] items-center justify-center px-8 pb-12 pt-14 sm:aspect-[16/10]">
            <div
              key={m.slug}
              className="machine-figure relative mx-auto h-full"
              // Never enlarge the source cut-outs much beyond their native size.
              style={{ ["--from" as string]: `${direction * 48}px`, width: `min(100%, ${Math.round(m.image.width * 1.4)}px)` }}
            >
              <span
                aria-hidden
                className="absolute inset-x-[6%] bottom-[2%] h-[9%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.22),transparent)] blur-md"
              />
              <Image
                src={m.image.src}
                alt={m.image.alt}
                fill
                sizes={`${Math.round(m.image.width * 1.4)}px`}
                placeholder="blur"
                blurDataURL={m.image.blurDataURL}
                className="object-contain object-bottom"
              />
            </div>
            {/* Floor line */}
            <span aria-hidden className="absolute inset-x-10 bottom-10 h-px bg-line-strong" />
          </div>

          <span key={`s-${sweep}`} aria-hidden className="machine-sweep pointer-events-none absolute inset-y-0 start-0 w-px bg-accent" />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-12 sm:items-end">
          <div key={`t-${m.slug}`} className="machine-copy sm:col-span-8">
            <p className="t-label text-accent-ink">{m.category}</p>
            <h3 className="t-title mt-3 text-ink">{m.name}</h3>
            <p className="t-body mt-4 max-w-xl">{m.capability}</p>
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
              <div>
                <dt className="t-label text-ink-3">{labels.power}</dt>
                <dd className="t-num mt-1.5 text-ink" dir="ltr">
                  {m.powerWatts ? `${m.powerWatts.toLocaleString("en-US")} W` : labels.notStated}
                </dd>
              </div>
              <div>
                <dt className="t-label text-ink-3">{labels.service}</dt>
                <dd className="mt-1.5">
                  <Link href={m.service.href} className="link-line font-medium text-ink">
                    {m.service.name}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex items-center gap-2 sm:col-span-4 sm:justify-end">
            <span className="t-num me-3 text-sm text-ink-3" dir="ltr">
              {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label={labels.previous}
              className="grid size-11 place-items-center border border-line-strong text-ink transition-colors hover:border-accent hover:text-accent-ink"
            >
              <ArrowIcon className="-scale-x-100 rtl:scale-x-100" />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label={labels.next}
              className="grid size-11 place-items-center border border-line-strong text-ink transition-colors hover:border-accent hover:text-accent-ink"
            >
              <ArrowIcon className="rtl:-scale-x-100" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
