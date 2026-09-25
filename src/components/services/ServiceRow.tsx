import type { CSSProperties } from "react";
import type { MediaId, ServiceSlug } from "@/content/types";
import { MediaFrame } from "@/components/inner/MediaFrame";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LineIcon } from "@/components/ui/LineIcons";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";

export interface ServiceRowView {
  slug: ServiceSlug;
  index: string;
  name: string;
  tagline: string;
  summary: string;
  highlights: string[];
  equipment: string[];
  href: string;
  tone: Tone;
  cover: { id: MediaId; alt: string };
  supporting: { id: MediaId; alt: string };
}

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/** The service's button takes its role colour: steel for machine work, teal for site support, graphite for craft. */
const BUTTON: Record<Tone, "steel" | "teal" | "secondary" | "primary"> = { eng: "steel", proc: "teal", craft: "secondary", brand: "primary" };

/**
 * One service on the overview page, as its own panel: a coloured top edge in
 * the service's tone, its line icon and index, copy and scope beside
 * staggered imagery. The scroll spy marks the panel in view (orange edge).
 */
export function ServiceRow({
  service,
  labels,
  reverse,
  figure,
}: {
  service: ServiceRowView;
  labels: { includes: string; equipment: string; open: string };
  reverse?: boolean;
  figure: string;
}) {
  return (
    <article
      id={service.slug}
      aria-labelledby={`${service.slug}-title`}
      className="service-row card card-edge relative grid gap-x-10 gap-y-10 p-6 sm:p-8 md:grid-cols-9 lg:p-10"
      data-tone={service.tone}
    >
      <span aria-hidden className="service-row-edge" />
      <div className={cn("md:col-span-5", reverse && "md:order-2")}>
        <div className="flex items-center gap-5" data-reveal="fade">
          <span className="icon-chip icon-chip-lg">
            <LineIcon name={service.slug} size={30} />
          </span>
          <span aria-hidden data-n={service.index} className="outline-num t-stat text-[2.6rem] sm:text-[3rem]" dir="ltr" />
        </div>
        <h2 id={`${service.slug}-title`} className="t-title mt-6 text-ink" data-reveal>
          {service.name}
        </h2>
        <p className="mt-3 font-display text-[1.05rem] font-medium text-ink-2" data-reveal style={delay(60)}>
          {service.tagline}
        </p>
        <p className="t-body mt-5 max-w-[34rem]" data-reveal style={delay(120)}>
          {service.summary}
        </p>

        <div className="mt-9" data-reveal style={delay(160)}>
          <p className="t-label tone-ink">{labels.includes}</p>
          <ul className="mt-3 grid border-t border-line sm:grid-cols-2 sm:gap-x-6">
            {service.highlights.map((item) => (
              <li key={item} className="flex items-baseline gap-3 border-b border-line py-3 text-[0.95rem] text-ink">
                <span aria-hidden className="size-1.5 shrink-0 translate-y-[-0.15em] rotate-45 bg-[var(--tone)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {service.equipment.length > 0 && (
          <div className="mt-8" data-reveal style={delay(200)}>
            <p className="t-label tone-ink">{labels.equipment}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {service.equipment.map((item) => (
                <li key={item} className="tone-tag">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10" data-reveal style={delay(240)}>
          <ButtonLink href={service.href} variant={BUTTON[service.tone]} size="sm">
            {`${labels.open} ${service.name}`}
          </ButtonLink>
        </div>
      </div>

      <div className={cn("order-first md:col-span-4", reverse ? "md:order-1" : "md:order-none")}>
        <MediaFrame
          id={service.cover.id}
          alt={service.cover.alt}
          figure={figure}
          caption={service.name}
          captionPosition="top"
          sizes="(min-width: 1024px) 420px, (min-width: 768px) 40vw, 90vw"
          className="w-full"
        />
        {/* A detail view layered over the lower corner of the main photograph. */}
        <MediaFrame
          id={service.supporting.id}
          alt={service.supporting.alt}
          frame="plain"
          parallax={false}
          raised
          sizes="(min-width: 1024px) 240px, 40vw"
          delay={200}
          className={cn(
            "relative z-10 -mt-14 hidden w-[58%] sm:block",
            reverse ? "me-auto -ms-4 lg:-ms-8" : "ms-auto -me-4 lg:-me-8",
          )}
        />
      </div>
    </article>
  );
}
