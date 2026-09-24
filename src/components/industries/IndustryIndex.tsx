"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import { cn } from "@/lib/utils";

export interface IndustryIndexItem {
  slug: string;
  index: string;
  name: string;
  description: string;
  basis: "profile" | "inferred";
  services: { href: string; label: string }[];
  image: { src: string; width: number; height: number; blurDataURL: string };
}

/**
 * Sectors as an architectural list. On wide screens a pinned specimen frame
 * shows the sector being pointed at or focused; small screens get a static
 * thumbnail per row. Photos are never enlarged beyond their source size.
 */
export function IndustryIndex({
  items,
  labels,
}: {
  items: IndustryIndexItem[];
  labels: { basis: { profile: string; inferred: string }; related: string; figure: string };
}) {
  const [active, setActive] = useState(0);
  const current = items[active];

  return (
    <div className="grid gap-x-12 lg:grid-cols-12">
      <ol className="border-t border-line lg:col-span-7">
        {items.map((item, i) => (
          <li
            key={item.slug}
            className="act-row group relative border-b border-line"
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            data-active={active === i || undefined}
            data-reveal
            style={{ ["--d" as string]: (i % 4) * 60 } as CSSProperties}
          >
            <span
              aria-hidden
              className={cn(
                "absolute -bottom-px start-0 h-px bg-accent transition-[width] duration-700 ease-out-expo",
                active === i ? "w-full" : "w-0",
              )}
            />
            <div className="grid grid-cols-[2.25rem_1fr_auto] gap-x-4 py-7 ps-4 sm:grid-cols-[3rem_1fr_auto] sm:py-8 sm:ps-5">
              <span className={cn("t-num pt-1.5 text-xs transition-colors", active === i ? "text-accent-ink" : "text-ink-3")}>{item.index}</span>
              <div className="min-w-0">
                <h3 className="t-h3 text-ink">{item.name}</h3>
                <p className="t-body mt-2 max-w-[34rem]">{item.description}</p>
                <p className="t-label mt-4 flex items-center gap-2.5 text-ink-3">
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0", item.basis === "profile" ? "bg-accent" : "border border-accent-ink")}
                  />
                  {labels.basis[item.basis]}
                </p>
                {item.services.length > 0 && (
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9rem]">
                    <span className="sr-only">{labels.related}:</span>
                    {item.services.map((service) => (
                      <Link key={service.href} href={service.href} className="link-line text-ink-2 transition-colors hover:text-ink">
                        {service.label}
                      </Link>
                    ))}
                  </p>
                )}
              </div>
              <div className="photo relative size-16 shrink-0 self-start sm:size-20 lg:hidden">
                <Image src={item.image.src} alt="" fill sizes="80px" placeholder="blur" blurDataURL={item.image.blurDataURL} className="object-cover" />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="hidden lg:col-span-5 lg:block">
        <figure className="sticky top-28" aria-hidden>
          <div className="tf-host relative" data-active>
            <div className="panel-raised bg-grid-fine relative aspect-[4/3] overflow-hidden [container-type:inline-size]">
              {/* Large index numeral of the sector on show */}
              <span
                key={`n-${current.slug}`}
                data-n={current.index}
                className="outline-num industry-num pointer-events-none absolute end-5 top-3 z-10 font-display text-[4.5rem] font-semibold leading-none"
              />
              {items.map((item, i) => {
                const small = item.image.width < 440;
                return (
                  <div
                    key={item.slug}
                    className="absolute inset-0 grid place-items-center transition-opacity duration-500"
                    style={{ opacity: active === i ? 1 : 0 }}
                  >
                    {small ? (
                      <Image
                        src={item.image.src}
                        alt=""
                        width={item.image.width}
                        height={item.image.height}
                        sizes={`${item.image.width}px`}
                        placeholder="blur"
                        blurDataURL={item.image.blurDataURL}
                        className="max-h-[86%] w-auto max-w-[86%] object-contain shadow-[var(--shadow-soft)]"
                      />
                    ) : (
                      <Image
                        src={item.image.src}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 34vw, 1px"
                        placeholder="blur"
                        blurDataURL={item.image.blurDataURL}
                        className="object-cover"
                      />
                    )}
                  </div>
                );
              })}
              <span aria-hidden className="reg-marks" />
              {/* A scan sweeps across on every change */}
              <span key={`s-${current.slug}`} className="machine-sweep pointer-events-none absolute inset-y-0 start-0 z-10 w-px bg-accent" />
            </div>
            <FrameMarks lines={false} />
          </div>
          <figcaption className="t-label mt-5 flex items-baseline gap-3 text-ink-3">
            <span className="t-num text-accent-ink">{`${labels.figure} ${current.index}`}</span>
            <span>{current.name}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
