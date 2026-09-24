"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export interface ServiceView {
  slug: string;
  index: string;
  name: string;
  summary: string;
  highlights: string[];
  href: string;
  image: { src: string; width: number; height: number; blurDataURL: string; alt: string };
}

/**
 * What can RAWASY do? Desktop: service names stacked; hovering or focusing one
 * swaps the figure (a wipe in reading direction), the summary and the tags,
 * while a fine orange line tracks the selection. Mobile: swipeable cards.
 */
export function ServiceExplorer({
  services,
  labels,
}: {
  services: ServiceView[];
  labels: { open: string; figure: string };
}) {
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const activeRef = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

  const select = useCallback((i: number) => {
    if (i === activeRef.current) return;
    setPrevious(activeRef.current);
    activeRef.current = i;
    setActive(i);
  }, []);

  // Move the technical marker to the active row.
  useEffect(() => {
    const list = listRef.current;
    const marker = markerRef.current;
    const row = list?.querySelectorAll<HTMLElement>("[data-row]")[active];
    if (!list || !marker || !row) return;
    marker.style.transform = `translateY(${row.offsetTop}px)`;
    marker.style.height = `${row.offsetHeight}px`;
  }, [active]);

  const current = services[active];

  return (
    <>
      {/* Desktop explorer */}
      <div className="hidden gap-10 lg:grid lg:grid-cols-12">
        <ul ref={listRef} className="relative border-t border-line lg:col-span-5">
          <span
            ref={markerRef}
            aria-hidden
            className="pointer-events-none absolute start-0 top-0 w-px bg-accent transition-[transform,height] duration-700 ease-out-expo"
          />
          {services.map((s, i) => (
            <li key={s.slug} data-row className="border-b border-line">
              <Link
                href={s.href}
                onMouseEnter={() => select(i)}
                onFocus={() => select(i)}
                data-cursor="explore"
                className="group flex items-baseline gap-6 py-5 ps-6"
                aria-describedby={i === active ? "service-figure-caption" : undefined}
              >
                <span className={cn("t-num text-xs transition-colors", i === active ? "text-accent-ink" : "text-ink-3")}>{s.index}</span>
                <span
                  className={cn(
                    "t-h3 flex-1 transition-[color,transform] duration-500 ease-out-expo",
                    i === active ? "translate-x-[calc(var(--dir)*6px)] text-ink" : "text-ink-3 group-hover:text-ink-2",
                  )}
                >
                  {s.name}
                </span>
                <ArrowIcon
                  className={cn(
                    "self-center transition-[opacity,transform] duration-500 rtl:-scale-x-100",
                    i === active ? "opacity-100" : "-translate-x-2 opacity-0 rtl:translate-x-2",
                  )}
                />
              </Link>
            </li>
          ))}
        </ul>

        <div className="lg:col-span-6 lg:col-start-7">
          <figure>
            <div className="crop-marks">
              <div className="relative aspect-[4/3] overflow-hidden bg-strong">
                {services.map((s, i) => (
                  <div
                    key={s.slug}
                    className="service-figure absolute inset-0"
                    data-state={i === active ? "active" : i === previous ? "previous" : "idle"}
                  >
                    <Image
                      src={s.image.src}
                      alt={i === active ? s.image.alt : ""}
                      fill
                      sizes="(min-width: 1024px) 45vw, 100vw"
                      placeholder="blur"
                      blurDataURL={s.image.blurDataURL}
                      className="object-cover"
                    />
                  </div>
                ))}
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.35),transparent_45%)]" />
                <span className="t-label absolute bottom-4 start-4 text-white/85">
                  {labels.figure} {current.index} — {current.name}
                </span>
              </div>
            </div>
            <figcaption id="service-figure-caption" className="mt-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end" aria-live="polite">
              <div key={current.slug} className="service-copy">
                <p className="t-body text-[1.0625rem] text-ink-2">{current.summary}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {current.highlights.map((h) => (
                    <li key={h} className="border border-line px-2.5 py-1 text-xs text-ink-2">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <Link href={current.href} className="link-arrow shrink-0 text-ink">
                <span className="link-line">{labels.open}</span>
                <ArrowIcon className="arrow rtl:-scale-x-100" />
              </Link>
            </figcaption>
          </figure>
        </div>
      </div>

      {/* Mobile / tablet: swipeable cards */}
      <ul className="-mx-[var(--gutter)] flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--gutter)] pb-4 [scrollbar-width:none] lg:hidden">
        {services.map((s) => (
          <li key={s.slug} className="w-[82%] max-w-[26rem] shrink-0 snap-start">
            <Link href={s.href} className="group block">
              <div className="photo relative aspect-[4/3]">
                <Image
                  src={s.image.src}
                  alt={s.image.alt}
                  fill
                  sizes="82vw"
                  placeholder="blur"
                  blurDataURL={s.image.blurDataURL}
                  className="object-cover"
                />
                <span className="t-num absolute start-3 top-3 bg-background/85 px-2 py-1 text-xs text-ink">{s.index}</span>
              </div>
              <h3 className="t-h3 mt-5 text-ink">{s.name}</h3>
              <p className="t-body mt-3 text-[0.95rem]">{s.summary}</p>
              <span className="link-arrow mt-4 text-ink">
                {labels.open}
                <ArrowIcon className="arrow rtl:-scale-x-100" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
