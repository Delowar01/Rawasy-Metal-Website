import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { LineIcon } from "@/components/ui/LineIcons";
import type { ServiceSlug } from "@/content/types";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";

export interface ServiceCardData {
  slug: ServiceSlug;
  index: string;
  name: string;
  tagline: string;
  href: string;
  tone: Tone;
  /** Optional photo across the top of the card (shown at or near its native size). */
  image?: { src: string; width: number; height: number; blurDataURL: string };
  /** Optional scope tags shown under the tagline. */
  highlights?: string[];
}

/**
 * A service line as a card: coloured top edge in the service's tone, a line
 * icon, the name and its one-line tagline. The whole card is the link; it
 * lifts and its arrow moves on hover or focus.
 */
export function ServiceCard({ service, action, delay = 0 }: { service: ServiceCardData; action: string; delay?: number }) {
  // The reveal sits on a wrapper: on the link itself it would override the hover lift.
  return (
    <div className="h-full" data-reveal style={{ ["--d" as string]: delay } as CSSProperties}>
      <Link href={service.href} className="card card-edge card-link group flex h-full flex-col" data-tone={service.tone}>
        {service.image && (
          <div className="zoom-img relative aspect-[16/9] overflow-hidden border-b border-line bg-strong">
            <Image
              src={service.image.src}
              alt=""
              fill
              sizes="(min-width: 1024px) 26rem, (min-width: 640px) 45vw, 92vw"
              placeholder="blur"
              blurDataURL={service.image.blurDataURL}
              className="object-cover"
            />
          </div>
        )}
        <div className={cn("flex flex-1 flex-col p-5 sm:p-6", service.image && "pt-5")}>
          <div className="flex items-start justify-between gap-4">
            <span className="icon-chip">
              <LineIcon name={service.slug} size={26} />
            </span>
            <span className="t-num pt-1 text-xs text-ink-2" dir="ltr">
              {service.index}
            </span>
          </div>
          <h3 className="t-h4 mt-5 text-ink">{service.name}</h3>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{service.tagline}</p>
          {service.highlights && (
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {service.highlights.map((item) => (
                <li key={item} className="tone-tag">
                  {item}
                </li>
              ))}
            </ul>
          )}
          <span className="t-label mt-auto flex items-center gap-2 pt-6 text-ink">
            {action}
            <ArrowIcon size={14} className="card-arrow rtl:-scale-x-100" />
          </span>
        </div>
      </Link>
    </div>
  );
}
