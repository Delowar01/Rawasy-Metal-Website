import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getAboutContent, getCompany, getPillars, getServices } from "@/content/repository";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { JsonLd, organizationJsonLd } from "@/lib/seo";
import { StructuralSketch } from "@/components/about/StructuralSketch";
import { EditorialSection } from "@/components/inner/EditorialSection";
import { InnerCTA } from "@/components/inner/InnerCTA";
import { InnerPageHero } from "@/components/inner/InnerPageHero";
import { MediaFrame } from "@/components/inner/MediaFrame";
import { ArrowIcon } from "@/components/ui/Icons";
import { Phrases } from "@/components/ui/Phrases";
import { SectionHeader } from "@/components/ui/SectionHeader";

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;
const pad = (n: number) => String(n).padStart(2, "0");

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("about", locale);
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [about, company, services, pillars] = await Promise.all([getAboutContent(), getCompany(), getServices(), getPillars()]);
  const dict = getDictionary(locale);
  const fig = (n: number) => `${dict.common.figure} ${pad(n)}`;

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      {innerPageJsonLd("about", locale, "AboutPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <InnerPageHero
        breadcrumb={breadcrumbTrail("about", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={about.hero.eyebrow[locale]}
        title={about.hero.title[locale]}
        intro={about.hero.intro[locale]}
        actions={
          <div className="inline-flex max-w-full flex-col gap-2.5 border border-line-strong px-5 py-4">
            <span className="t-label text-ink-3">{about.hero.nameplate[locale]}</span>
            <span className="t-label text-ink-2" lang="en" dir="ltr">
              {company.legalName.en}
            </span>
            <span className="font-display text-[1.05rem] font-medium text-ink-2" lang="ar" dir="rtl">
              {company.legalName.ar}
            </span>
          </div>
        }
        aside={
          <div className="relative">
            <StructuralSketch className="pointer-events-none absolute -top-12 end-[-8%] w-[116%] text-line-strong max-lg:hidden" />
            <MediaFrame
              id={about.hero.media}
              alt={about.hero.mediaAlt[locale]}
              caption={about.hero.caption[locale]}
              figure={fig(1)}
              sizes="(min-width: 1024px) 396px, 90vw"
              preload
              className="relative w-full lg:ms-auto lg:mt-28"
            />
          </div>
        }
        meta={about.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
      />

      {/* 01 — Who we are */}
      <EditorialSection id="overview" index="01" label={about.overview.label[locale]} title={about.overview.title[locale]}>
        <div className="grid gap-6">
          {about.overview.paragraphs[locale].map((paragraph, i) => (
            <p key={i} className="t-body text-[1.0625rem]" data-reveal style={delay(60 * i)}>
              {paragraph}
            </p>
          ))}
        </div>
        <div className="mt-14">
          <p className="t-label text-ink-3" data-reveal="fade">
            {about.overview.servicesLabel[locale]}
          </p>
          <ul className="mt-5 grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
            {services.map((service, i) => (
              <li key={service.slug} className="border-b border-line" data-reveal style={delay((i % 2) * 80)}>
                <Link href={href(locale, "service", { slug: service.slug })} className="group flex gap-4 py-5">
                  <span className="t-num pt-1 text-xs text-accent-ink">{service.index}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[1.05rem] font-semibold text-ink transition-colors group-hover:text-accent-ink">
                      {service.name[locale]}
                    </span>
                    <span className="mt-1 block text-sm text-ink-3">{service.tagline[locale]}</span>
                  </span>
                  <ArrowIcon
                    size={16}
                    className="mt-1.5 shrink-0 text-accent-ink opacity-0 transition-[opacity,transform] duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </EditorialSection>

      {/* 02 — Vision */}
      <section id="vision" aria-labelledby="vision-title" className="on-band relative isolate overflow-hidden bg-band text-band-ink">
        <div
          aria-hidden
          className="bg-perforated pointer-events-none absolute inset-y-0 end-0 -z-10 w-1/2 opacity-40 [--perf-dot:rgb(236_234_229/0.1)] [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]"
        />
        <div className="container-x section-y grid gap-x-10 gap-y-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="vision-title" className="t-label eyebrow !text-band-ink-2" data-reveal="fade">
              <span className="t-num">02</span>
              <span aria-hidden>/</span>
              <span>{about.vision.label[locale]}</span>
            </h2>
            <blockquote className="mt-10 border-s-2 border-accent ps-6 sm:ps-8" data-reveal>
              <p className="t-h2-compact max-w-[18em]">
                <Phrases>{company.vision.statement[locale]}</Phrases>
              </p>
            </blockquote>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <p className="t-label !text-band-ink-2" data-reveal="fade">
              {about.vision.aimsLabel[locale]}
            </p>
            <ol className="mt-5 border-t border-band-line">
              {company.vision.aims[locale].map((aim, i) => (
                <li key={i} className="flex gap-4 border-b border-band-line py-4" data-reveal style={delay(80 * i)}>
                  <span className="t-num pt-1 text-xs text-accent">{pad(i + 1)}</span>
                  <span className="text-[0.98rem] text-band-ink">{aim}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="flex items-center gap-4 border-t border-band-line pt-8 font-display text-[1.1rem] font-medium text-band-ink-2 lg:col-span-12" data-reveal>
            <span aria-hidden className="h-px w-10 shrink-0 bg-accent" />
            {company.vision.closing[locale]}
          </p>
        </div>
      </section>

      {/* 03 — Beyond metalwork */}
      <section id="beyond" aria-labelledby="beyond-title" className="section-y relative bg-background-deep [--curtain:var(--background-deep)]">
        <div className="container-x grid gap-x-10 gap-y-14 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <MediaFrame
              id={about.beyond.media}
              alt={about.beyond.mediaAlt[locale]}
              figure={fig(2)}
              caption={about.beyond.label[locale]}
              dimension="RW—SC"
              sizes="(min-width: 1024px) 431px, 90vw"
              className="w-full"
            />
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className="t-label eyebrow" data-reveal="fade">
              <span className="t-num">03</span>
              <span aria-hidden>/</span>
              <span>{about.beyond.label[locale]}</span>
            </p>
            <h2 id="beyond-title" className="t-h2-compact mt-6 text-ink" data-reveal>
              <Phrases>{about.beyond.title[locale]}</Phrases>
            </h2>
            <p className="t-lead mt-6" data-reveal style={delay(100)}>
              {about.beyond.intro[locale]}
            </p>
            <ol className="mt-10 grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
              {about.beyond.items.map((item, i) => (
                <li key={item.en} className="flex items-baseline gap-4 border-b border-line py-4" data-reveal style={delay(60 * i)}>
                  <span className="t-num text-xs text-accent-ink">{pad(i + 1)}</span>
                  <span className="font-display text-[1rem] font-medium text-ink">{item[locale]}</span>
                </li>
              ))}
            </ol>
            <Link href={href(locale, "service", { slug: "scaffolding" })} className="link-arrow mt-10 text-ink" data-reveal>
              <span className="link-line">{about.beyond.link[locale]}</span>
              <ArrowIcon className="arrow rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </section>

      {/* 04 — How we work */}
      <EditorialSection
        id="process"
        index="04"
        label={about.process.label[locale]}
        title={about.process.title[locale]}
        intro={about.process.intro[locale]}
      >
        <ol className="relative">
          <span aria-hidden className="absolute bottom-6 start-[0.6875rem] top-3 w-px bg-line-strong" />
          {about.process.steps.map((step, i) => (
            <li key={step.slug} className="relative grid grid-cols-[1.375rem_1fr] gap-x-6 pb-11 last:pb-0" data-reveal style={delay(70 * i)}>
              <span aria-hidden className="relative mt-2 grid size-[1.375rem] place-items-center bg-background">
                <span className="size-2.5 rotate-45 border border-accent bg-accent-soft" />
              </span>
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="t-num text-xs text-accent-ink">{pad(i + 1)}</span>
                  <h3 className="t-h3 text-ink">{step.title[locale]}</h3>
                </div>
                <p className="t-body mt-2 max-w-[34rem]">{step.body[locale]}</p>
              </div>
            </li>
          ))}
        </ol>
      </EditorialSection>

      {/* 05 — Why RAWASY */}
      <section id="why" aria-labelledby="why-title" className="section-y border-t border-line">
        <div className="container-x">
          <SectionHeader
            id="why-title"
            size="compact"
            index="05"
            label={about.why.label[locale]}
            title={about.why.title[locale]}
            intro={about.why.intro[locale]}
          />
          <ol className="mt-12 grid border-t border-line lg:mt-16 lg:grid-cols-2 lg:gap-x-16">
            {pillars.map((pillar, i) => (
              <li
                key={pillar.slug}
                className="grid grid-cols-[3.25rem_1fr] gap-x-5 border-b border-line py-7 sm:grid-cols-[4.5rem_1fr] sm:py-8"
                data-reveal
                style={delay((i % 2) * 90)}
              >
                <span aria-hidden data-n={pad(i + 1)} className="outline-num font-display text-[2rem] font-semibold leading-none sm:text-[2.6rem]" />
                <div>
                  <h3 className="t-h4 text-ink">{pillar.title[locale]}</h3>
                  <p className="t-body mt-2 max-w-[30rem]">{pillar.body[locale]}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <InnerCTA
        label={about.cta.label[locale]}
        title={about.cta.title[locale]}
        links={about.cta.links.map((link) => ({
          href: href(locale, link.route),
          label: link.label[locale],
          description: link.description?.[locale],
        }))}
      />
    </>
  );
}
