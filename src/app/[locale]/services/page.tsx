import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMachines, getServices, getServicesPageContent } from "@/content/repository";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { formatPower } from "@/lib/utils";
import { InnerCTA } from "@/components/inner/InnerCTA";
import { InnerPageHero } from "@/components/inner/InnerPageHero";
import { ServicePlate } from "@/components/services/ServicePlate";
import { ServiceRow } from "@/components/services/ServiceRow";
import { ServiceScrollSpy } from "@/components/services/ServiceScrollSpy";

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("services", locale);
}

/**
 * Services overview (stage 1C). Each service links to its detail route, which
 * stays in its current state until stage 1D.
 */
export default async function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, services, machines] = await Promise.all([getServicesPageContent(), getServices(), getMachines()]);
  const dict = getDictionary(locale);

  return (
    <>
      {innerPageJsonLd("services", locale, "CollectionPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <InnerPageHero
        backdrop="perforated"
        breadcrumb={breadcrumbTrail("services", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
        aside={
          <ServicePlate
            label={page.plateLabel[locale]}
            items={services.map((s) => ({ slug: s.slug, index: s.index, name: s.name[locale] }))}
          />
        }
        meta={page.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
      />

      <section aria-label={page.indexLabel[locale]} className="pb-[var(--section-y)]">
        <div className="container-x grid gap-x-10 lg:grid-cols-12">
          <div className="hidden lg:col-span-3 lg:block">
            <div className="h-full pt-14 lg:pt-20">
              <ServiceScrollSpy
                label={page.indexLabel[locale]}
                items={services.map((s) => ({ id: s.slug, index: s.index, name: s.name[locale] }))}
              />
            </div>
          </div>
          <div className="lg:col-span-9">
            {services.map((service, i) => (
              <ServiceRow
                key={service.slug}
                reverse={i % 2 === 1}
                figure={`${dict.common.figure} ${service.index}`}
                labels={{
                  includes: page.includesLabel[locale],
                  equipment: page.equipmentLabel[locale],
                  open: page.open[locale],
                }}
                service={{
                  slug: service.slug,
                  index: service.index,
                  name: service.name[locale],
                  tagline: service.tagline[locale],
                  summary: service.summary[locale],
                  highlights: service.highlights[locale],
                  equipment: machines
                    .filter((m) => m.service === service.slug)
                    .map((m) => (m.powerWatts ? `${m.shortName[locale]} · ${formatPower(m.powerWatts, locale)}` : m.shortName[locale])),
                  href: href(locale, "service", { slug: service.slug }),
                  cover: { id: service.cover, alt: service.coverAlt[locale] },
                  supporting: { id: service.supporting.media, alt: service.supporting.alt[locale] },
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <InnerCTA
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        body={page.cta.body?.[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale], description: link.description?.[locale] }))}
      />
    </>
  );
}
