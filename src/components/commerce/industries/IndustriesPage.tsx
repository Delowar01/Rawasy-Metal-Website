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
import { SectorIndex } from "./SectorIndex";

/** Sectors shown in the hero strip (the previous design's choice: photos large enough to show well). */
const STRIP = ["construction", "industrial", "public-realm", "architecture", "street-furniture"];

const pad = (n: number) => String(n).padStart(2, "0");

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
          // Tiles stay narrower than the smallest photo's width (and 4:3), so no photo is enlarged.
          <ul className="in-strip">
            {strip.map(({ industry, n }, i) => (
              <li key={industry.slug} data-reveal="fade" style={delay(i * 70)}>
                <figure>
                  <div className="in-strip-photo">
                    <Photo
                      image={{ ...getMedia(industry.media), alt: "" }}
                      sizes="(min-width: 1024px) 253px, (min-width: 640px) 30vw, 46vw"
                    />
                  </div>
                  <figcaption className="in-strip-caption" data-tone={industryTone[industry.slug] ?? "steel"}>
                    <span className="ip-index">{pad(n)}</span>
                    {industry.name[locale]}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        }
      />

      <section id="sectors" aria-labelledby="sectors-title" className="sec sec-sheet sec-muted">
        <div className="shell">
          <div className="card in-card">
            <div className="in-head">
              <h2 id="sectors-title" className="eyebrow" data-tone="teal">
                <span className="ip-index">01</span>
                {page.listLabel[locale]}
              </h2>
              <ul className="in-legend">
                <li data-basis="profile">
                  <Icon name="check" size={15} />
                  {page.basis.profile[locale]}
                </li>
                <li data-basis="inferred">
                  <Icon name="grid" size={15} />
                  {page.basis.inferred[locale]}
                </li>
              </ul>
            </div>
            <SectorIndex
              labels={{ basis: { profile: page.basis.profile[locale], inferred: page.basis.inferred[locale] }, related: page.relatedLabel[locale] }}
              items={industries.map((industry, i) => {
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
              })}
            />
          </div>

          {/* How the sectors are classified */}
          <div className="card card-edge in-note" data-tone="steel" data-reveal>
            <div>
              <p className="eyebrow" data-tone="steel">
                <span className="ip-index">02</span>
                {page.note.label[locale]}
              </p>
              <h2 className="t-h3 mt-4">{page.note.title[locale]}</h2>
            </div>
            <div className="in-note-text">
              {page.note.paragraphs[locale].map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ClosingCta
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        body={page.cta.body?.[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
