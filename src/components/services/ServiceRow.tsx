import Link from "next/link";
import type { CSSProperties } from "react";
import type { MediaId } from "@/content/types";
import { MediaFrame } from "@/components/inner/MediaFrame";
import { ArrowIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export interface ServiceRowView {
  slug: string;
  index: string;
  name: string;
  tagline: string;
  summary: string;
  highlights: string[];
  equipment: string[];
  href: string;
  cover: { id: MediaId; alt: string };
  supporting: { id: MediaId; alt: string };
}

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/** One service on the overview page: copy and specs beside staggered imagery. */
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
    <article id={service.slug} aria-labelledby={`${service.slug}-title`} className="grid gap-x-10 gap-y-10 border-t border-line py-14 md:grid-cols-9 lg:py-20">
      <div className={cn("md:col-span-5", reverse && "md:order-2")}>
        <span
          aria-hidden
          data-n={service.index}
          className="outline-num block font-display text-[2.6rem] font-semibold leading-none sm:text-[3.2rem]"
          data-reveal="fade"
        />
        <h2 id={`${service.slug}-title`} className="t-title mt-5 text-ink" data-reveal>
          {service.name}
        </h2>
        <p className="mt-3 font-display text-[1.05rem] font-medium text-ink-2" data-reveal style={delay(60)}>
          {service.tagline}
        </p>
        <p className="t-body mt-5 max-w-[34rem]" data-reveal style={delay(120)}>
          {service.summary}
        </p>

        <div className="mt-9" data-reveal style={delay(160)}>
          <p className="t-label text-ink-3">{labels.includes}</p>
          <ul className="mt-3 grid border-t border-line sm:grid-cols-2 sm:gap-x-6">
            {service.highlights.map((item) => (
              <li key={item} className="flex items-baseline gap-3 border-b border-line py-3 text-[0.95rem] text-ink">
                <span aria-hidden className="size-1.5 shrink-0 translate-y-[-0.15em] rotate-45 bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {service.equipment.length > 0 && (
          <div className="mt-8" data-reveal style={delay(200)}>
            <p className="t-label text-ink-3">{labels.equipment}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {service.equipment.map((item) => (
                <li key={item} className="border border-line bg-elevated px-3 py-1.5 text-[0.82rem] text-ink-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link href={service.href} className="link-arrow mt-10 text-ink" data-reveal style={delay(240)}>
          <span className="link-line">{`${labels.open} ${service.name}`}</span>
          <ArrowIcon className="arrow rtl:-scale-x-100" />
        </Link>
      </div>

      <div className={cn("order-first md:col-span-4", reverse ? "md:order-1" : "md:order-none")}>
        <MediaFrame
          id={service.cover.id}
          alt={service.cover.alt}
          figure={figure}
          caption={service.name}
          sizes="(min-width: 1024px) 420px, (min-width: 768px) 40vw, 90vw"
          className="w-full"
        />
        <MediaFrame
          id={service.supporting.id}
          alt={service.supporting.alt}
          frame="plain"
          sizes="(min-width: 1024px) 240px, 40vw"
          delay={200}
          className={cn("mt-10 hidden w-[62%] sm:block", reverse ? "me-auto" : "ms-auto")}
        />
      </div>
    </article>
  );
}
