import type { ReactNode } from "react";
import type { Tone } from "../types";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";

export interface PageFact {
  label: string;
  value: ReactNode;
}

/**
 * The opening of an inner page: the breadcrumb trail, the page label, the title (the page's only h1, `#page-title`),
 * the lead, optional page facts and actions — on a reading zone, so the ambient stays in the space around the text.
 * Everything in it shows with the first paint: commerce.css keeps the reveal off inside `.ip-hero` (Stage TM-3), so the
 * title never waits for the script.
 *
 * - `compact`  text only (legal pages, clients, certificates)
 * - `split`    text beside a visual (`aside`: about, services, contact)
 * - `stacked`  text across, a visual underneath (`below`: industries)
 */
export function PageHero({
  layout = "compact",
  breadcrumb,
  breadcrumbLabel,
  eyebrow,
  tone = "brand",
  title,
  intro,
  facts,
  actions,
  aside,
  below,
}: {
  layout?: "compact" | "split" | "stacked";
  breadcrumb: Crumb[];
  breadcrumbLabel: string;
  eyebrow: string;
  tone?: Tone;
  title: string;
  intro?: string;
  facts?: PageFact[];
  actions?: ReactNode;
  aside?: ReactNode;
  below?: ReactNode;
}) {
  const text = (
    <div className="a2-read max-w-[50rem]" data-reveal="fade">
      <Breadcrumbs items={breadcrumb} label={breadcrumbLabel} />
      <p className="eyebrow mt-6" data-tone={tone}>
        {eyebrow}
      </p>
      <h1 id="page-title" className="t-h1 mt-4 max-w-[18em]">
        {title}
      </h1>
      {intro && <p className="t-lead mt-4 max-w-[40rem]">{intro}</p>}
      {facts && facts.length > 0 && (
        <dl className="ip-meta mt-7">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );

  return (
    <div className="ip-hero">
      <div className="shell">
        {layout === "split" && aside ? (
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-7">{text}</div>
            <div className="lg:col-span-5">{aside}</div>
          </div>
        ) : (
          text
        )}
        {layout === "stacked" && below && <div className="mt-10 lg:mt-12">{below}</div>}
      </div>
    </div>
  );
}
