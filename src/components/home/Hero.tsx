import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { HeroPlate } from "./hero/HeroPlate";

export interface HeroProps {
  locale: Locale;
  eyebrow: string;
  headline: string[];
  sub: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  location: string;
  coordinates: string;
  scroll: string;
  scrollTarget: string;
  services: { label: string; href: string; index: string }[];
  plate: { photo: string; labels: { part: string; sequence: string } };
}

/** Who is RAWASY? — immersive opener built around the laser-cut plate. */
export function Hero({
  eyebrow,
  headline,
  sub,
  primary,
  secondary,
  location,
  coordinates,
  scroll,
  scrollTarget,
  services,
  plate,
}: HeroProps) {
  const lastIndex = headline.length - 1;
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* Structural grid, fading out toward the text */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_75%_at_72%_45%,black_20%,transparent_75%)]"
      />
      {/* Measurement ruler along the top edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[var(--header-h)] -z-10 h-3 opacity-60 [background:repeating-linear-gradient(90deg,var(--border-strong)_0_1px,transparent_1px_22px)] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      <div className="container-x relative grid min-h-[100svh] grid-cols-12 content-center items-center gap-x-6 gap-y-14 pb-28 pt-[calc(var(--header-h)+3rem)] lg:pb-24 lg:pt-[calc(var(--header-h)+1.25rem)]">
        <div className="relative z-10 col-span-12 flex flex-col justify-center lg:col-span-7">
          <p className="t-label eyebrow text-ink-2" data-reveal="fade">
            {eyebrow}
          </p>

          <h1 id="hero-title" className="t-display mt-7 text-ink" data-reveal="lines" style={{ ["--d" as string]: 80 }}>
            {headline.map((line, i) => (
              <span key={line} className="mask-line" style={{ ["--i" as string]: i }}>
                <span>
                  {i === lastIndex && line.endsWith(".") ? (
                    <>
                      {line.slice(0, -1)}
                      <span className="text-accent">.</span>
                    </>
                  ) : (
                    line
                  )}
                </span>
              </span>
            ))}
          </h1>

          <p className="t-lead mt-9 max-w-[34rem] lg:mt-11" data-reveal style={{ ["--d" as string]: 420 }}>
            {sub}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3 lg:mt-10" data-reveal style={{ ["--d" as string]: 540 }}>
            <ButtonLink href={primary.href}>{primary.label}</ButtonLink>
            <ButtonLink href={secondary.href} variant="outline">
              {secondary.label}
            </ButtonLink>
          </div>
        </div>

        <div className="hero-plate-wrap relative col-span-12 lg:col-span-5">
          <HeroPlate photo={plate.photo} labels={plate.labels} />
        </div>
      </div>

      {/* Bottom rail: location · service index · scroll cue */}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-line">
        <div className="container-x flex h-16 items-center justify-between gap-6">
          <p className="t-label flex items-center gap-3 whitespace-nowrap text-ink-3">
            <span className="size-1.5 bg-accent" aria-hidden />
            <span>{location}</span>
            <span className="t-num hidden md:inline" dir="ltr">
              {coordinates}
            </span>
          </p>
          <ul className="hidden items-center gap-5 whitespace-nowrap 2xl:flex">
            {services.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="t-label text-ink-3 transition-colors hover:text-ink">
                  <span className="t-num me-1.5 text-accent-ink">{s.index}</span>
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
          <a href={scrollTarget} className="t-label group flex items-center gap-3 text-ink-3 hover:text-ink">
            {scroll}
            <span aria-hidden className="relative h-8 w-px overflow-hidden bg-line-strong">
              <span className="scroll-cue absolute inset-x-0 top-0 h-3 bg-accent" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
