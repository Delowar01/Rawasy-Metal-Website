import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "../inner/Breadcrumbs";
import type { PageFact } from "../inner/PageHero";
import type { Tone } from "../types";

/**
 * The opening of a service page (Stage TM-2.4): the trail (Home › Services › the service), the service's number and
 * section, its name (the page's only h1), its tagline and summary, its facts, the quote action (and the way to the work,
 * where the page has a gallery or projects) beside the service's picture. The text sits on a reading zone, as in the
 * kit's PageHero, and like it shows with the first paint (only the drawings and signatures draw in once the script runs).
 * A page with a signature makes the hero its host, so the drawing replays when a mouse comes back to the hero or the
 * keyboard moves into it (never while it runs).
 */
export function ServiceHero({
  breadcrumb,
  breadcrumbLabel,
  serviceLabel,
  index,
  section,
  tone,
  title,
  lead,
  intro,
  facts,
  actions,
  visual,
  signature,
}: {
  breadcrumb: Crumb[];
  breadcrumbLabel: string;
  serviceLabel: string;
  index: string;
  section: string;
  tone: Tone;
  title: string;
  lead: string;
  intro: string;
  facts: PageFact[];
  actions: ReactNode;
  visual: ReactNode;
  signature: boolean;
}) {
  return (
    <section aria-labelledby="page-title" className="ip-hero sv-hero" data-sig-host={signature ? "" : undefined}>
      <div className="shell">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            <div className="a2-read" data-reveal="fade">
              <Breadcrumbs items={breadcrumb} label={breadcrumbLabel} />
              <p className="eyebrow mt-6" data-tone={tone}>
                <span className="sr-only">{serviceLabel} </span>
                <span className="ip-index">{index}</span>
                <span aria-hidden className="sv-eyebrow-rule">
                  /
                </span>
                <span>{section}</span>
              </p>
              <h1 id="page-title" className="t-h1 mt-4">
                {title}
              </h1>
              <p className="sv-tagline mt-4">{lead}</p>
              <p className="t-lead mt-3">{intro}</p>
              {facts.length > 0 && (
                <dl className="ip-meta mt-7">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
            </div>
          </div>
          <div className="lg:col-span-6">{visual}</div>
        </div>
      </div>
    </section>
  );
}
