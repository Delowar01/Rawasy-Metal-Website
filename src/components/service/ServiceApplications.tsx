import type { CSSProperties } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";

export interface SectorView {
  slug: string;
  name: string;
  /** "profile": named in the company profile; "inferred": website classification. */
  basis: "profile" | "inferred";
  basisLabel: string;
}

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/**
 * Where the service applies. Sectors come from the industries records and
 * say whether the company profile names them or they are a website
 * classification (steel edge vs. dashed edge). Uses named in the profile and
 * the categories of the related gallery work are shown as tags.
 */
export function ServiceApplications({
  sectors,
  uses,
  categories,
  labels,
  link,
  tone,
}: {
  sectors: SectorView[];
  uses: string[];
  categories: { slug: string; label: string; tone: Tone }[];
  labels: { sectors: string; uses: string; work: string };
  link?: { href: string; label: string };
  tone: Tone;
}) {
  // No sectors (engraving): the uses become the main cards.
  if (sectors.length === 0) {
    return (
      <ul className="grid gap-4 sm:grid-cols-3">
        {uses.map((use, i) => (
          <li key={use} className="card card-edge flex items-center gap-5 p-6 sm:flex-col sm:items-start sm:p-7" data-tone={tone} data-reveal style={delay(80 * i)}>
            <span aria-hidden data-n={String(i + 1).padStart(2, "0")} className="outline-num t-stat text-[2.4rem] leading-none" dir="ltr" />
            <h3 className="t-h4 text-ink">{use}</h3>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="t-label text-ink-2">{labels.sectors}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {sectors.map((sector, i) => (
            <li
              key={sector.slug}
              className={cn("card relative p-5 sm:p-6", sector.basis === "profile" ? "card-edge" : "border-t-2 border-t-[var(--border-strong)] [border-top-style:dashed]")}
              data-tone={sector.basis === "profile" ? "eng" : undefined}
              data-reveal
              style={delay((i % 2) * 70)}
            >
              <h3 className="t-h4 text-ink">{sector.name}</h3>
              <p className="t-caption mt-2 flex items-center gap-2 text-ink-2">
                <span aria-hidden className={cn("size-1.5 shrink-0", sector.basis === "profile" ? "bg-[var(--eng)]" : "border border-ink-3")} />
                {sector.basisLabel}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-10 lg:col-span-4 lg:col-start-9">
        {uses.length > 0 && (
          <div data-reveal>
            <p className="t-label text-ink-2">{labels.uses}</p>
            <ul className="mt-4 flex flex-wrap gap-2" data-tone={tone}>
              {uses.map((use) => (
                <li key={use} className="tone-tag">
                  {use}
                </li>
              ))}
            </ul>
          </div>
        )}
        {categories.length > 0 && (
          <div data-reveal style={delay(80)}>
            <p className="t-label text-ink-2">{labels.work}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category.slug} className="tone-tag" data-tone={category.tone}>
                  {category.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {link && (
          <div data-reveal style={delay(140)}>
            <ButtonLink href={link.href} variant="outline" size="sm">
              {link.label}
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
