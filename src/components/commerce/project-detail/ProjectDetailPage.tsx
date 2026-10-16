import Image from "next/image";
import type { Localized, ProjectDetailPageContent } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { Icon } from "../Icon";
import type { Crumb } from "../inner/Breadcrumbs";
import { ClosingCta } from "../inner/ClosingCta";
import { PageHero } from "../inner/PageHero";
import type { DetailField, DetailPhoto, ProjectDetailView } from "./data";
import "./project-detail.css";

/*
 * A project's own page (Stage 1F): a project record from the company profile, never a case study. One page for every
 * record, its parts chosen by what the record holds:
 *
 * - photos: the first leads the hero beside the text, the others follow in "More photographs" (each once, each at most
 *   at its source size); a project with no photo that may be shown has a text hero with the source plate instead;
 * - the classifications and related services sit in the hero's facts, the gallery reference under the lead photo or
 *   on the source plate;
 * - confirmed details (client, location, year, materials, scope, description, challenge, solution) appear only for the
 *   fields the record holds; no record holds any yet, so no page shows the part;
 * - the closing panel: the quotation form, back to Projects, the services.
 *
 * Nothing is added to the record: no captions, phases, facts or other projects' photos. The hero shows with the first
 * paint (the inner-page kit's PageHero); nothing on the page waits for its script.
 */
export function ProjectDetailPage({
  locale,
  view,
  page,
  breadcrumb,
}: {
  locale: Locale;
  view: ProjectDetailView;
  page: ProjectDetailPageContent;
  breadcrumb: Crumb[];
}) {
  const dict = getDictionary(locale);
  const t = (text: Localized) => text[locale];
  const more = view.photos.slice(1);

  return (
    <>
      <ProjectOpening
        view={view}
        breadcrumb={breadcrumb}
        breadcrumbLabel={dict.a11y.breadcrumb}
        labels={{ eyebrow: t(page.eyebrow), classification: t(page.facts.classification), services: t(page.facts.services), quote: t(page.quote), back: t(page.back) }}
        quoteHref={href(locale, "contact", { hash: "quote" })}
        backHref={href(locale, "projects")}
      />

      {more.length > 0 && <ProjectPhotos title={t(page.photos.title)} intro={t(page.photos.intro)} photos={more} />}

      {(view.rows.length > 0 || view.passages.length > 0) && <ProjectDetails title={t(page.details.title)} rows={view.rows} passages={view.passages} />}

      <ClosingCta
        label={t(page.cta.label)}
        title={t(page.cta.title)}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route, { hash: link.hash }), label: t(link.label) }))}
      />
    </>
  );
}

/** The project's opening: the title, the record's summary, its classifications and services, the ways on, the lead photo or the source plate. */
export function ProjectOpening({
  view,
  breadcrumb,
  breadcrumbLabel,
  labels,
  quoteHref,
  backHref,
}: {
  view: ProjectDetailView;
  breadcrumb: Crumb[];
  breadcrumbLabel: string;
  labels: { eyebrow: string; classification: string; services: string; quote: string; back: string };
  quoteHref: string;
  backHref: string;
}) {
  const [lead] = view.photos;
  return (
    <PageHero
      layout="split"
      breadcrumb={breadcrumb}
      breadcrumbLabel={breadcrumbLabel}
      eyebrow={labels.eyebrow}
      tone={view.tone}
      title={view.title}
      intro={view.summary}
      facts={[
        {
          label: labels.classification,
          value: (
            <ul className="pd-inline">
              {view.categories.map((c) => (
                <li key={c.slug} data-category={c.slug}>
                  {c.label}
                </li>
              ))}
            </ul>
          ),
        },
        {
          label: labels.services,
          value: (
            <ul className="pd-inline">
              {view.services.map((s) => (
                <li key={s.slug}>
                  <a href={s.href} className="pd-link" data-service={s.slug}>
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
      actions={
        <>
          <a href={quoteHref} className="btn btn-primary">
            {labels.quote}
            <Icon name="arrow" size={17} />
          </a>
          <a href={backHref} className="btn btn-secondary">
            {/* Back: the arrow points against the reading direction. */}
            <span className="inline-flex -scale-x-100">
              <Icon name="arrow" size={17} />
            </span>
            {labels.back}
          </a>
        </>
      }
      aside={lead ? <LeadPhoto photo={lead} view={view} /> : <SourcePlate view={view} />}
    />
  );
}

/** "More photographs": the project's other photos, each at most at its own size. */
export function ProjectPhotos({ title, intro, photos }: { title: string; intro: string; photos: DetailPhoto[] }) {
  return (
    <section aria-labelledby="photos-title" className="sec pd-photos">
      <div className="shell">
        <div className="a2-read max-w-[44rem]">
          <h2 id="photos-title" className="t-h2">
            {title}
          </h2>
          <p className="t-lead mt-4">{intro}</p>
        </div>
        <ul className="pd-gallery">
          {photos.map((photo) => (
            <li key={photo.id} className="pd-shot">
              <Shot photo={photo} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The confirmed details the record holds: short ones as rows, longer ones as passages. */
export function ProjectDetails({ title, rows, passages }: { title: string; rows: DetailField[]; passages: DetailField[] }) {
  return (
    <section aria-labelledby="details-title" className="sec pd-details-sec">
      <div className="shell">
        <div className="a2-read max-w-[44rem]">
          <h2 id="details-title" className="t-h2">
            {title}
          </h2>
        </div>
        {rows.length > 0 && (
          <dl className="pd-details">
            {rows.map((f) => (
              <div key={f.key} data-field={f.key}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {passages.map((f) => (
          <div key={f.key} className="pd-passage a2-read" data-field={f.key}>
            <h3 className="t-h4">{f.label}</h3>
            <p>{f.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The gallery reference as a source: "Company profile · Ref. 04", or "Company profile · p.3" for a page of it. */
function SourceLine({ view }: { view: ProjectDetailView }) {
  return (
    <>
      {view.source} · {view.refLabel && `${view.refLabel} `}
      <span dir="ltr">{view.ref}</span>
    </>
  );
}

/** A photo in its print frame: never wider or taller than its source file. */
function Shot({ photo, lead = false }: { photo: DetailPhoto; lead?: boolean }) {
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      sizes={`${photo.width}px`}
      placeholder="blur"
      blurDataURL={photo.blurDataURL}
      className="pd-img"
      {...(lead ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
      {...(photo.unoptimized ? { unoptimized: true } : {})}
    />
  );
}

/** The lead photo on its stage, with the gallery reference under it. */
function LeadPhoto({ photo, view }: { photo: DetailPhoto; view: ProjectDetailView }) {
  return (
    <figure className="pd-lead" data-tone={view.tone}>
      <div className="pd-stage">
        <div className="pd-print">
          <Shot photo={photo} lead />
        </div>
      </div>
      <figcaption className="pd-source">
        <span>
          <SourceLine view={view} />
        </span>
      </figcaption>
    </figure>
  );
}

/** A project with no photo that may be shown: its record's source, set as type on a plate (no picture, no stand-in). */
function SourcePlate({ view }: { view: ProjectDetailView }) {
  return (
    <div className="pd-plate" data-tone={view.tone}>
      <p className="pd-plate-source">{view.source}</p>
      <p className="pd-plate-ref">
        {view.refLabel && <span className="pd-plate-label">{view.refLabel}</span>}{" "}
        <span dir="ltr" className="pd-plate-num">
          {view.ref}
        </span>
      </p>
    </div>
  );
}
