import Image from "next/image";
import type { CSSProperties } from "react";
import { MediaFrame } from "@/components/inner/MediaFrame";
import { ArrowIcon } from "@/components/ui/Icons";
import { LineIcon, type LineIconName } from "@/components/ui/LineIcons";
import type { SupportSlug } from "@/content/types";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";
import type { ServiceLook } from "./looks";
import { EngravedMotif, FoldGlyph, ProfileGlyph } from "./ScopeGlyphs";

export interface ScopeItemView {
  slug: string;
  title: string;
  body?: string;
  image?: { src: string; width: number; height: number; blurDataURL: string; alt: string };
}

export interface ScopeFigureView {
  id: Parameters<typeof MediaFrame>[0]["id"];
  alt: string;
}

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/**
 * "What we provide": the service's scope in the layout that suits it —
 * profile sections (laser cutting), formed profiles (bending), linked phases
 * (steel structures), photo cards (fabrication), material swatches
 * (engraving) or support tiles beside site photos (scaffolding).
 */
export function ServiceScope({
  layout,
  tone,
  items,
  figures = [],
  figureLabel,
  figureStart = 1,
  icons,
}: {
  layout: ServiceLook["scope"];
  tone: Tone;
  items: ScopeItemView[];
  figures?: ScopeFigureView[];
  figureLabel: string;
  figureStart?: number;
  icons: Record<string, LineIconName>;
}) {
  switch (layout) {
    case "profiles": {
      // Plain sections in one row; a featured item (with a description) runs across underneath.
      const plain = items.filter((item) => !item.body);
      return (
        <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4", plain.length === 5 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-4")}>
          {items.map((item, i) => {
            const wide = Boolean(item.body);
            const lastOdd = !wide && plain.length % 2 === 1 && item === plain[plain.length - 1];
            return (
              <li
                key={item.slug}
                className={cn(
                  "card card-edge flex gap-5 p-5 sm:p-6",
                  wide ? "col-span-full items-center" : "flex-col",
                  lastOdd && "max-sm:col-span-2 sm:max-lg:col-span-1",
                )}
                data-tone={wide ? "brand" : tone}
                data-reveal
                style={delay((i % 5) * 60)}
              >
                <ProfileGlyph slug={item.slug} className={cn("shrink-0 text-[var(--tone)]", wide ? "size-20 sm:size-24" : "size-16")} />
                <div className="min-w-0">
                  <h3 className="t-h4 text-ink">{item.title}</h3>
                  {item.body && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{item.body}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      );
    }

    case "folds":
      return (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <li key={item.slug} className="card card-edge flex flex-col p-6" data-tone={tone} data-reveal style={delay((i % 4) * 70)}>
              <div className="flex items-start justify-between gap-4">
                <FoldGlyph slug={item.slug} className="size-16 text-[var(--tone)]" />
                <span className="t-num text-xs text-ink-2" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="t-h4 mt-6 text-ink">{item.title}</h3>
              {item.body && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{item.body}</p>}
            </li>
          ))}
        </ol>
      );

    case "phases":
      return (
        <ol className="grid gap-4 lg:grid-cols-3 lg:gap-0">
          {items.map((item, i) => (
            <li key={item.slug} className="relative flex" data-reveal style={delay(i * 110)}>
              <div className={cn("card card-edge flex w-full flex-col p-6 sm:p-8", i > 0 && "lg:border-s-0")} data-tone={tone}>
                <div className="flex items-center justify-between gap-4">
                  <span className="icon-chip icon-chip-lg">
                    <LineIcon name={icons[item.slug] ?? "engineer"} size={28} />
                  </span>
                  <span aria-hidden data-n={String(i + 1).padStart(2, "0")} className="outline-num t-stat text-[2.6rem]" dir="ltr" />
                </div>
                <h3 className="t-title mt-7 text-ink">{item.title}</h3>
                {item.body && <p className="t-body mt-3">{item.body}</p>}
              </div>
              {i < items.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -bottom-3 start-1/2 z-10 grid size-7 -translate-x-1/2 rotate-90 place-items-center border border-line-strong bg-elevated text-[var(--accent)] shadow-[var(--shadow-card)] rtl:translate-x-1/2 lg:-end-3.5 lg:bottom-auto lg:start-auto lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0 lg:rotate-0 lg:rtl:-scale-x-100"
                >
                  <ArrowIcon size={14} />
                </span>
              )}
            </li>
          ))}
        </ol>
      );

    case "photos":
      return (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <li key={item.slug} className="card card-edge flex flex-col overflow-hidden" data-tone={tone} data-reveal style={delay((i % 4) * 70)}>
              {item.image && (
                <div className="zoom-host border-b border-line bg-strong">
                  <div className="zoom-img relative mx-auto w-full" style={{ maxWidth: item.image.width, aspectRatio: "4 / 3" }}>
                    <Image
                      src={item.image.src}
                      alt={item.image.alt}
                      fill
                      sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw"
                      placeholder="blur"
                      blurDataURL={item.image.blurDataURL}
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <span className="t-num text-xs text-ink-2" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="t-h4 mt-2 text-ink">{item.title}</h3>
                {item.body && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{item.body}</p>}
              </div>
            </li>
          ))}
        </ul>
      );

    case "materials":
      return (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((item, i) => (
            <li key={item.slug} className="card card-edge flex flex-col p-3 sm:p-5" data-tone={tone} data-reveal style={delay((i % 4) * 70)}>
              <div aria-hidden className={cn("swatch engrave grid aspect-[5/3] place-items-center", `swatch-${item.slug}`)}>
                <EngravedMotif slug={item.slug} className="h-[72%] w-auto" />
              </div>
              <h3 className="t-h4 mt-4 text-ink sm:mt-5">{item.title}</h3>
              {item.body && <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-2 sm:text-[0.95rem]">{item.body}</p>}
            </li>
          ))}
        </ul>
      );

    case "support":
      return (
        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12 lg:items-start">
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-1">
            {items.map((item, i) => (
              <li
                key={item.slug}
                className="card card-edge flex items-center gap-4 py-3 pe-4 ps-3 sm:py-4"
                data-tone={tone}
                data-reveal="fade"
                style={delay(60 * i)}
              >
                <span className="icon-chip">
                  <LineIcon name={item.slug as SupportSlug} size={24} />
                </span>
                <h3 className="text-[1.02rem] font-semibold leading-snug text-ink">{item.title}</h3>
                <span aria-hidden className="t-num ms-auto text-xs text-ink-2" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </li>
            ))}
          </ul>
          {figures.length > 0 && (
            <div className="lg:col-span-6">
              {figures.map((figure, i) => (
                <MediaFrame
                  key={figure.id}
                  id={figure.id}
                  alt={figure.alt}
                  caption={figure.alt}
                  figure={`${figureLabel} ${String(figureStart + i).padStart(2, "0")}`}
                  captionPosition={i === 0 ? "top" : "bottom"}
                  frame={i === 0 ? "offset" : "plain"}
                  parallax={false}
                  raised={i > 0}
                  delay={i * 160}
                  sizes="(min-width: 1024px) 455px, 80vw"
                  className={cn(i === 0 ? "w-full lg:ms-auto" : "relative z-10 -mt-[18%] w-[52%] max-sm:-mt-[12%]")}
                />
              ))}
            </div>
          )}
        </div>
      );
  }
}
