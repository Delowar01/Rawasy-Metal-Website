import { getMedia } from "@/content/media";
import { getIndustries, getIndustriesPageContent, getServices } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { Icon } from "../Icon";
import { ClosingCta } from "../inner/ClosingCta";
import { PageHero } from "../inner/PageHero";
import { industryIcon, industryTone } from "../tones";
import { Photo, delay } from "../ui";
import type { CommerceImage, Tone } from "../types";
import { SectorIndex, type SectorItem } from "./SectorIndex";

/** Sectors shown in the hero strip (the previous design's choice: photos large enough to show well). */
const STRIP = ["construction", "industrial", "public-realm", "architecture", "street-furniture"];

const pad = (n: number) => String(n).padStart(2, "0");

/** The hero's strip of sector photos, each with its sector's number in the list. Tiles stay narrower than the smallest photo. */
export function IndustryStrip({ items }: { items: { slug: string; index: string; name: string; tone: Tone; image: CommerceImage }[] }) {
  return (
    // Tiles stay narrower than the smallest photo's width (and 4:3), so no photo is enlarged.
    <ul className="in-strip">
      {items.map((item, i) => (
        <li key={item.slug} data-reveal="fade" style={delay(i * 70)}>
          <figure>
            <div className="in-strip-photo">
              <Photo image={item.image} sizes="(min-width: 1024px) 253px, (min-width: 640px) 30vw, 46vw" />
            </div>
            <figcaption className="in-strip-caption" data-tone={item.tone}>
              <span className="ip-index">{item.index}</span>
              {item.name}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

/**
 * The sectors (`#sectors`): the list with each sector's source and related services and the pinned preview (01), then
 * the note on how the sectors are classified (02). Either part may be left out (the page builder's preview).
 */
export function SectorsSection({
  list,
  note,
}: {
  list?: { label: string; basis: { profile: string; inferred: string }; related: string; items: SectorItem[] };
  note?: { label: string; title: string; paragraphs: string[] };
}) {
  return (
    <section id="sectors" aria-labelledby={list ? "sectors-title" : undefined} className="sec sec-sheet sec-muted">
      <div className="shell">
        {list && (
          <div className="card in-card">
            <div className="in-head">
              <h2 id="sectors-title" className="eyebrow" data-tone="teal">
                <span className="ip-index">01</span>
                {list.label}
              </h2>
              <ul className="in-legend">
                <li data-basis="profile">
                  <Icon name="check" size={15} />
                  {list.basis.profile}
                </li>
                <li data-basis="inferred">
                  <Icon name="grid" size={15} />
                  {list.basis.inferred}
                </li>
              </ul>
            </div>
            <SectorIndex labels={{ basis: list.basis, related: list.related }} items={list.items} />
          </div>
        )}

        {/* How the sectors are classified */}
        {note && (
          <div className="card card-edge in-note" data-tone="steel" data-reveal>
            <div>
              <p className="eyebrow" data-tone="steel">
                <span className="ip-index">{list ? "02" : "01"}</span>
                {note.label}
              </p>
              <h2 className="t-h3 mt-4">{note.title}</h2>
            </div>
            <div className="in-note-text">
              {note.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Industries in the Modern Commerce design (Stage TM-2.3): the sectors RAWASY's services support, each marked by its
 * source — named in the company profile, or a website classification drawn from the work gallery — with its related
 * services, a pinned preview on large screens and the note on how the sectors are classified. Copy and data are the
 * previous design's page, unchanged.
 */
export async function IndustriesPage({ locale }: { locale: Locale }) {
  const [page, industries, services] = await Promise.all([getIndustriesPageContent(), getIndustries(), getServices()]);
  const dict = getDictionary(locale);
  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name[locale] ?? slug;
  // Each strip photo keeps its sector's number in the list.
  const strip = STRIP.map((slug) => ({ industry: industries.find((i) => i.slug === slug)!, n: industries.findIndex((i) => i.slug === slug) + 1 }));

  return (
    <>
      {innerPageJsonLd("industries", locale, "CollectionPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <PageHero
        layout="stacked"
        breadcrumb={breadcrumbTrail("industries", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        tone="teal"
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
        facts={page.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
        below={
          <IndustryStrip
            items={strip.map(({ industry, n }) => ({
              slug: industry.slug,
              index: pad(n),
              name: industry.name[locale],
              tone: industryTone[industry.slug] ?? "steel",
              image: { ...getMedia(industry.media), alt: "" },
            }))}
          />
        }
      />

      <SectorsSection
        list={{
          label: page.listLabel[locale],
          basis: { profile: page.basis.profile[locale], inferred: page.basis.inferred[locale] },
          related: page.relatedLabel[locale],
          items: industries.map((industry, i) => {
            const media = getMedia(industry.feature ?? industry.media);
            return {
              slug: industry.slug,
              index: pad(i + 1),
              name: industry.name[locale],
              description: industry.description[locale],
              basis: industry.source.basis === "profile" ? "profile" : "inferred",
              icon: industryIcon[industry.slug] ?? "factory",
              tone: industryTone[industry.slug] ?? "steel",
              services: industry.services.map((slug) => ({ href: href(locale, "service", { slug }), label: serviceName(slug) })),
              image: { src: media.src, width: media.width, height: media.height, blurDataURL: media.blurDataURL },
            };
          }),
        }}
        note={{ label: page.note.label[locale], title: page.note.title[locale], paragraphs: page.note.paragraphs[locale] }}
      />

      <ClosingCta
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        body={page.cta.body?.[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
