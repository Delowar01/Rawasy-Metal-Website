import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getMedia } from "@/content/media";
import { getIndustries, getIndustriesPageContent, getServices } from "@/content/repository";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { IndustryIndex } from "@/components/industries/IndustryIndex";
import { InnerCTA } from "@/components/inner/InnerCTA";
import { InnerPageHero } from "@/components/inner/InnerPageHero";
import { Phrases } from "@/components/ui/Phrases";

/** Sectors shown in the hero strip (photos large enough to show well). */
const STRIP = ["construction", "industrial", "public-realm", "architecture", "street-furniture"];

const pad = (n: number) => String(n).padStart(2, "0");

export async function generateMetadata({ params }: PageProps<"/[locale]/industries">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("industries", locale);
}

export default async function IndustriesPage({ params }: PageProps<"/[locale]/industries">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, industries, services] = await Promise.all([getIndustriesPageContent(), getIndustries(), getServices()]);
  const dict = getDictionary(locale);
  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name[locale] ?? slug;
  const strip = STRIP.map((slug) => ({ industry: industries.find((i) => i.slug === slug)!, n: industries.findIndex((i) => i.slug === slug) + 1 }));

  return (
    <>
      {innerPageJsonLd("industries", locale, "CollectionPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <InnerPageHero
        layout="stacked"
        backdrop="fine"
        breadcrumb={breadcrumbTrail("industries", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
        below={
          <ul className="grid grid-cols-2 gap-3 pb-14 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:pb-20">
            {strip.map(({ industry, n }, i) => {
              const media = getMedia(industry.media);
              return (
                <li key={industry.slug} className={cn(i === 4 && "max-lg:hidden", i === 3 && "sm:max-lg:hidden", i % 2 === 1 && "lg:mt-12")}>
                  <figure>
                    <div className="photo relative aspect-[4/5]" data-reveal="clip" style={{ ["--d" as string]: i * 90 } as CSSProperties}>
                      <Image
                        src={media.src}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 46vw"
                        placeholder="blur"
                        blurDataURL={media.blurDataURL}
                        className="object-cover"
                      />
                    </div>
                    <figcaption className="t-label mt-3 flex items-baseline gap-2 text-ink-2">
                      <span className="t-num text-accent-ink">{pad(n)}</span>
                      <span>{industry.name[locale]}</span>
                    </figcaption>
                  </figure>
                </li>
              );
            })}
          </ul>
        }
        meta={page.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
      />

      <section id="sectors" aria-labelledby="sectors-title" className="section-y">
        <div className="container-x">
          <div className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="sectors-title" className="t-label eyebrow" data-reveal="fade">
              <span className="t-num">01</span>
              <span aria-hidden>/</span>
              <span>{page.listLabel[locale]}</span>
            </h2>
            <ul className="t-label flex flex-wrap gap-x-6 gap-y-2 text-ink-3" data-reveal="fade">
              <li className="flex items-center gap-2.5">
                <span aria-hidden className="size-2 bg-accent" />
                {page.basis.profile[locale]}
              </li>
              <li className="flex items-center gap-2.5">
                <span aria-hidden className="size-2 border border-accent-ink" />
                {page.basis.inferred[locale]}
              </li>
            </ul>
          </div>
          <div className="mt-2">
            <IndustryIndex
              labels={{ basis: { profile: page.basis.profile[locale], inferred: page.basis.inferred[locale] }, related: page.relatedLabel[locale], figure: dict.common.figure }}
              items={industries.map((industry, i) => {
                const media = getMedia(industry.feature ?? industry.media);
                return {
                  slug: industry.slug,
                  index: pad(i + 1),
                  name: industry.name[locale],
                  description: industry.description[locale],
                  basis: industry.source.basis === "profile" ? "profile" : "inferred",
                  services: industry.services.map((slug) => ({ href: href(locale, "service", { slug }), label: serviceName(slug) })),
                  image: { src: media.src, width: media.width, height: media.height, blurDataURL: media.blurDataURL },
                };
              })}
            />
          </div>

          {/* How the sectors are classified */}
          <div className="mt-20 grid gap-x-10 gap-y-8 border-t border-line pt-12 lg:mt-28 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="t-label eyebrow" data-reveal="fade">
                <span className="t-num">02</span>
                <span aria-hidden>/</span>
                <span>{page.note.label[locale]}</span>
              </p>
              <h2 className="t-h3 mt-5 text-ink" data-reveal>
                <Phrases>{page.note.title[locale]}</Phrases>
              </h2>
            </div>
            <div className="grid gap-5 lg:col-span-7 lg:col-start-6">
              {page.note.paragraphs[locale].map((paragraph, i) => (
                <p key={i} className="t-body text-[1.0625rem]" data-reveal style={{ ["--d" as string]: 80 * i } as CSSProperties}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <InnerCTA
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        body={page.cta.body?.[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
