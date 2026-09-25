import type { CSSProperties } from "react";
import { MediaFrame } from "@/components/inner/MediaFrame";
import type { MediaId } from "@/content/types";
import type { Tone } from "@/lib/tones";

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/**
 * The service in the company's own words: the profile text (lead paragraph on
 * an orange rule), and what the service includes on a panel in its tone, with
 * an optional photograph.
 */
export function ServiceOverview({
  paragraphs,
  includesLabel,
  includes,
  tone,
  figure,
}: {
  paragraphs: string[];
  includesLabel: string;
  includes: string[];
  tone: Tone;
  figure?: { id: MediaId; alt: string; label: string };
}) {
  return (
    <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
      <div className="lg:col-span-7">
        {paragraphs.map((paragraph, i) =>
          i === 0 ? (
            <p key={i} className="t-lead border-s-2 border-accent ps-5 text-ink sm:ps-7" data-reveal>
              {paragraph}
            </p>
          ) : (
            <p key={i} className="t-body mt-6 text-[1.0625rem] sm:ps-7" data-reveal style={delay(60 * i)}>
              {paragraph}
            </p>
          ),
        )}
        {figure && (
          <MediaFrame
            id={figure.id}
            alt={figure.alt}
            caption={figure.alt}
            figure={figure.label}
            sizes="(min-width: 1024px) 490px, 90vw"
            className="mt-12 w-full sm:ms-7"
          />
        )}
      </div>
      <div className="lg:col-span-4 lg:col-start-9" data-reveal style={delay(120)}>
        <div className="card card-edge p-6 sm:p-7 lg:sticky lg:top-28" data-tone={tone}>
          <p className="t-label tone-ink">{includesLabel}</p>
          <ul className="mt-4 border-t border-line">
            {includes.map((item) => (
              <li key={item} className="flex items-baseline gap-3 border-b border-line py-3.5 text-[0.98rem] text-ink last:border-b-0">
                <span aria-hidden className="size-1.5 shrink-0 translate-y-[-0.15em] rotate-45 bg-[var(--tone)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
