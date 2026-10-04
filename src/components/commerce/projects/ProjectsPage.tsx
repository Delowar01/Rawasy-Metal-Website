import Image from "next/image";
import type { CSSProperties } from "react";
import { getHomeContent, getProjectsPageContent, getShowcasedProjects } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { refOrder } from "@/lib/project-cards";
import { JsonLd } from "@/lib/seo";
import { Icon } from "../Icon";
import { ClosingCta } from "../inner/ClosingCta";
import { PageHero } from "../inner/PageHero";
import type { Tone } from "../types";
import { delay } from "../ui";
import { filterOptions, projectView, type ProjectPhoto, type ProjectView } from "./data";
import { Gallery, ProjectFilterProvider, QuickFilter } from "./Gallery";
import "./projects.css";

/** The hero's three prints (as before): the tulip, the clock tower and the suspended lantern. */
const COLLAGE = ["tulip-roundabout-sculpture", "clock-tower-landmark", "suspended-lantern"] as const;

/** A part's number and label (the page numbers its three parts, as before). */
function Head({ id, index, label, title, intro, tone, read = false }: { id: string; index: string; label: string; title: string; intro: string; tone: Tone; read?: boolean }) {
  return (
    <div className={read ? "a2-read max-w-[44rem]" : "max-w-[44rem]"} data-reveal>
      <p className="eyebrow" data-tone={tone}>
        <span className="ip-index">{index}</span>
        {label}
      </p>
      <h2 id={id} className="t-h2 mt-4">
        {title}
      </h2>
      <p className="t-lead mt-4">{intro}</p>
    </div>
  );
}

/**
 * The Projects overview in the Modern Commerce design (Stage TM-2.5), in the previous page's order: the hero (with the
 * quick category toggles and three prints), the featured project, the highlights, the gallery (#gallery: the bar of
 * category toggles and every showcased project, each at #<slug>), the project index and the closing call to action.
 * Copy, references, categories, photos and order are the previous page's (the content layer). The featured project,
 * the highlights and the index go to the project's place in the gallery (decision D4); a gallery card is not a link,
 * and since Stage 1F carries one link, "View project", to the project's own page. Photos are never shown above their
 * source size; the blueprint decoration is retired (D8).
 */
export async function ProjectsPage({ locale }: { locale: Locale }) {
  const [page, showcased, home] = await Promise.all([getProjectsPageContent(), getShowcasedProjects(), getHomeContent()]);
  const dict = getDictionary(locale);
  const projects = showcased.map((p) => projectView(p, locale));
  const bySlug = (slug: string) => projects.find((p) => p.slug === slug);
  const featured = bySlug(page.featured.slug) ?? projects[0];
  const highlights = page.editorial.slugs.map(bySlug).filter((p) => p !== undefined);
  const indexed = [...projects].sort((a, b) => refOrder(a.ref) - refOrder(b.ref));
  const options = filterOptions(projects, locale);
  const refLabel = page.refLabel[locale];
  const inGallery = home.projects.inGallery[locale];

  return (
    <>
      {innerPageJsonLd("projects", locale, "CollectionPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <ProjectFilterProvider>
        <PageHero
          layout="split"
          breadcrumb={breadcrumbTrail("projects", locale)}
          breadcrumbLabel={dict.a11y.breadcrumb}
          eyebrow={page.hero.eyebrow[locale]}
          tone="brass"
          title={page.hero.title[locale]}
          intro={page.hero.intro[locale]}
          facts={page.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
          actions={<QuickFilter label={page.hero.quickFilter[locale]} options={options} allLabel={page.gallery.all[locale]} />}
          aside={<Collage items={COLLAGE.map((slug) => bySlug(slug)!)} refLabel={refLabel} />}
        />

        {featured && (
          <section aria-labelledby="featured-title" className="sec pj-featured-sec">
            <div className="shell">
              <div className="pj-feature" data-tone={featured.tone} data-reveal>
                <div className="pj-feature-media">
                  <Prints main={featured.gallery[0]} more={featured.gallery.slice(1, 2)} alt={featured.title} sizes="(min-width: 1024px) 464px, 88vw" />
                </div>
                <div className="pj-feature-body">
                  <p className="eyebrow eyebrow-dark">{page.featured.label[locale]}</p>
                  <p className="pj-feature-ref" dir="ltr">
                    {refLabel} {featured.ref}
                  </p>
                  <h2 id="featured-title" className="t-h2 pj-feature-title">
                    {featured.title}
                  </h2>
                  <p className="pj-feature-text">{featured.summary}</p>
                  <ul className="pj-feature-tags">
                    {featured.categories.map((c) => (
                      <li key={c.slug} className="pj-tag-dark" data-tone={c.tone}>
                        {c.label}
                      </li>
                    ))}
                  </ul>
                  <a href={`#${featured.slug}`} className="btn btn-primary pj-feature-go">
                    {inGallery}
                    <Icon name="arrow" size={17} />
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="highlights-title" className="sec sec-sheet sec-muted">
          <div className="shell">
            <Head
              id="highlights-title"
              index="01"
              label={page.editorial.label[locale]}
              title={page.editorial.title[locale]}
              intro={page.editorial.intro[locale]}
              tone="steel"
            />
            <ul className="pj-highlights">
              {highlights.map((p, i) => (
                <li key={p.slug} data-reveal style={delay(80)}>
                  <a href={`#${p.slug}`} className="card card-link pj-hl" data-tone={p.tone} data-reverse={i % 2 === 1 ? "" : undefined}>
                    <div className="pj-hl-media">
                      <Prints main={p.gallery[0]} more={p.gallery.slice(1, 3)} alt="" sizes={`(min-width: 1024px) ${Math.min(p.gallery[0].width, 420)}px, 88vw`} />
                    </div>
                    <div className="pj-hl-body">
                      <p className="pj-ref">
                        <span aria-hidden className="pj-dot" />
                        <span dir="ltr">
                          {refLabel} {p.ref}
                        </span>
                      </p>
                      <h3 className="t-h3 pj-hl-title">{p.title}</h3>
                      <p className="pj-tags">
                        {p.categories.slice(0, 3).map((c) => (
                          <span key={c.slug} className="tag tag-tone" data-tone={c.tone}>
                            {c.label}
                          </span>
                        ))}
                      </p>
                      <p className="pj-hl-text">{p.summary}</p>
                      <span className="ab-go pj-go">
                        {inGallery}
                        <Icon name="arrow" size={16} className="go" />
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="gallery" aria-labelledby="gallery-title" className="sec pj-gallery">
          <div className="shell">
            <Head
              id="gallery-title"
              index="02"
              label={page.gallery.label[locale]}
              title={page.gallery.title[locale]}
              intro={page.gallery.intro[locale]}
              tone="brass"
              read
            />
          </div>
          <Gallery
            projects={projects}
            options={options}
            labels={{ group: page.gallery.filterLabel[locale], all: page.gallery.all[locale], showing: page.gallery.showing[locale], ref: refLabel, view: page.view[locale] }}
          />
        </section>
      </ProjectFilterProvider>

      <section aria-labelledby="index-title" className="sec sec-sheet sec-raised">
        <div className="shell">
          <Head id="index-title" index="03" label={page.index.label[locale]} title={page.index.title[locale]} intro={page.index.note[locale]} tone="teal" />
          <ol aria-label={page.index.label[locale]} className="pj-index">
            {indexed.map((p) => (
              <li key={p.slug} data-tone={p.tone}>
                <a href={`#${p.slug}`} className="pj-index-link">
                  <span className="pj-index-ref" dir="ltr">
                    {p.ref}
                  </span>
                  <span className="pj-index-name">
                    <span className="pj-index-title">{p.title}</span>
                    <span className="pj-index-cats">{p.categories.slice(0, 2).map((c) => c.label).join(" · ")}</span>
                  </span>
                  <Icon name="arrow" size={16} />
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ClosingCta
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}

/** The hero's three gallery photos, layered like prints on a plate, each at most at its source size (mirrored in Arabic). */
function Collage({ items, refLabel }: { items: ProjectView[]; refLabel: string }) {
  const prints = [
    { className: "pj-print pj-print-main", sizes: "(min-width: 1024px) 370px, 64vw", preload: true },
    { className: "pj-print pj-print-tall", sizes: "(min-width: 1024px) 220px, 38vw", preload: false },
    { className: "pj-print pj-print-square", sizes: "(min-width: 1024px) 210px, 36vw", preload: false },
  ];
  return (
    <div className="pj-collage" data-reveal="fade" style={delay(160)}>
      <span aria-hidden className="pj-collage-plate" />
      {items.map((p, i) => {
        const image = p.gallery[0];
        return (
          <figure key={p.slug} className={prints[i].className} style={{ maxWidth: image.width }}>
            <span className="pj-print-photo" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
              <Image
                src={image.src}
                alt={p.title}
                fill
                sizes={prints[i].sizes}
                placeholder="blur"
                blurDataURL={image.blurDataURL}
                preload={prints[i].preload}
                className="pj-print-img"
              />
            </span>
            {/* The row follows the page's direction (the reference stays clear of the print laid over this one's corner). */}
            <figcaption aria-hidden className="pj-print-ref">
              <span dir="ltr">
                {refLabel} {p.ref}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/**
 * A project's lead photo with up to two more pinned over its lower corner, each at most at its source size (the extra
 * prints at 78 % of it, as before, and never more than 30 % of the lead photo's width).
 */
function Prints({ main, more, alt, sizes }: { main: ProjectPhoto; more: ProjectPhoto[]; alt: string; sizes: string }) {
  return (
    <div className="pj-prints" style={{ maxWidth: main.width }}>
      <div className="pj-prints-main" style={{ aspectRatio: `${main.width} / ${main.height}` }}>
        <Image src={main.src} alt={alt} fill sizes={sizes} placeholder="blur" blurDataURL={main.blurDataURL} className="pj-print-img" />
      </div>
      {more.length > 0 && (
        <div className="pj-prints-more">
          {more.map((image) => (
            <div key={image.src} className="pj-prints-pin" style={{ width: `min(${Math.round(image.width * 0.78)}px, 30%)` } as CSSProperties}>
              <div className="pj-prints-pin-photo" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
                <Image src={image.src} alt="" fill sizes={`${Math.round(image.width * 0.78)}px`} placeholder="blur" blurDataURL={image.blurDataURL} className="pj-print-img" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
