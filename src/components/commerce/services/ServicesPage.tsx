import { getMedia } from "@/content/media";
import { getMachines, getServices, getServicesPageContent } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { formatPower } from "@/lib/utils";
import { Icon } from "../Icon";
import { ClosingCta } from "../inner/ClosingCta";
import { ContentsNav } from "../inner/ContentsNav";
import { PageHero } from "../inner/PageHero";
import { serviceTone } from "../tones";
import { delay, serviceIcon } from "../ui";
import { ServiceRow } from "./ServiceRow";
import "./services.css";

/**
 * The services overview in the Modern Commerce design (Stage TM-2.4): the six services in their order, each with more
 * than the homepage's cards give — its summary, what it includes, the machines behind it and the way to its page. The
 * hero's tiles and the index beside the rows jump to each service (the index marks the one being read). Copy, figures
 * and links are the previous page's (the content layer); the "Figure" labels are retired (decision D8) and Laser
 * Engraving shows its approved drawing instead of the flagged photographs (D6).
 */
export async function ServicesPage({ locale }: { locale: Locale }) {
  const [page, services, machines] = await Promise.all([getServicesPageContent(), getServices(), getMachines()]);
  const dict = getDictionary(locale);

  return (
    <>
      {innerPageJsonLd("services", locale, "CollectionPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <PageHero
        layout="split"
        breadcrumb={breadcrumbTrail("services", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
        facts={page.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
        aside={
          // The six services at a glance, each a jump to its row below.
          <nav aria-label={page.plateLabel[locale]} className="sv-tiles-nav" data-reveal="fade" style={delay(160)}>
            <ol className="sv-tiles">
              {services.map((s) => (
                <li key={s.slug}>
                  <a href={`#${s.slug}`} className="card card-link sv-tile" data-tone={serviceTone[s.slug]}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="icon-chip">
                        <Icon name={serviceIcon[s.slug]} size={22} />
                      </span>
                      <span className="ip-index text-[0.75rem]" dir="ltr">
                        {s.index}
                      </span>
                    </span>
                    <span className="sv-tile-name">{s.name[locale]}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        }
      />

      <section aria-label={page.indexLabel[locale]} className="sv-index">
        <div className="shell grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3">
            <ContentsNav label={page.indexLabel[locale]} items={services.map((s) => ({ id: s.slug, title: s.name[locale] }))} />
          </div>
          <div className="grid gap-5 lg:col-span-9 lg:gap-6">
            {services.map((s, i) => {
              const engraving = s.slug === "laser-engraving";
              return (
                <ServiceRow
                  key={s.slug}
                  reverse={i % 2 === 1}
                  labels={{ includes: page.includesLabel[locale], equipment: page.equipmentLabel[locale], open: page.open[locale] }}
                  service={{
                    slug: s.slug,
                    index: s.index,
                    name: s.name[locale],
                    tagline: s.tagline[locale],
                    summary: s.summary[locale],
                    highlights: s.highlights[locale],
                    equipment: machines
                      .filter((m) => m.service === s.slug)
                      .map((m) => (m.powerWatts ? `${m.shortName[locale]} · ${formatPower(m.powerWatts, locale)}` : m.shortName[locale])),
                    href: href(locale, "service", { slug: s.slug }),
                    tone: serviceTone[s.slug],
                    // Laser Engraving: no photographs (the nameplates photo and the wood render stay off; decision D6).
                    photos: engraving
                      ? undefined
                      : {
                          cover: { ...getMedia(s.cover), alt: s.coverAlt[locale] },
                          supporting: { ...getMedia(s.supporting.media), alt: s.supporting.alt[locale] },
                        },
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>

      <ClosingCta
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        body={page.cta.body?.[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale], description: link.description?.[locale] }))}
      />
    </>
  );
}
