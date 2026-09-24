import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { whatsappUrl } from "@/content/company";
import { getMedia } from "@/content/media";
import { projectCategories } from "@/content/projects";
import {
  getCertificates,
  getClients,
  getCompany,
  getFeaturedProjects,
  getHomeContent,
  getIndustries,
  getMachines,
  getMetrics,
  getPillars,
  getProcessSteps,
  getServices,
} from "@/content/repository";
import { seo } from "@/content/seo";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { buildMetadata, JsonLd, organizationJsonLd } from "@/lib/seo";
import { formatPower } from "@/lib/utils";
import { ArrowIcon } from "@/components/ui/Icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Certificates } from "@/components/home/Certificates";
import { ClientMarquee } from "@/components/home/ClientMarquee";
import { FeaturedProjects } from "@/components/home/FeaturedProjects";
import { Hero } from "@/components/home/Hero";
import { IndustryList } from "@/components/home/IndustryList";
import { Intro } from "@/components/home/Intro";
import { MachineExplorer } from "@/components/home/MachineExplorer";
import { Metrics } from "@/components/home/Metrics";
import { PrecisionStatement } from "@/components/home/PrecisionStatement";
import { ProcessLine } from "@/components/home/ProcessLine";
import { ProjectCTA } from "@/components/home/ProjectCTA";
import { ServiceExplorer } from "@/components/home/ServiceExplorer";
import { WhyRawasy } from "@/components/home/WhyRawasy";
import Link from "next/link";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    pathname: "/",
    title: seo.home.title[locale],
    description: seo.home.description[locale],
    absoluteTitle: true,
  });
}

function SectionLink({ href: to, label }: { href: string; label: string }) {
  return (
    <Link href={to} className="link-arrow text-ink">
      <span className="link-line">{label}</span>
      <ArrowIcon className="arrow rtl:-scale-x-100" />
    </Link>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [home, company, services, machines, featured, industries, pillars, metricData, clients, certificates, steps] =
    await Promise.all([
      getHomeContent(),
      getCompany(),
      getServices(),
      getMachines(),
      getFeaturedProjects(),
      getIndustries(),
      getPillars(),
      getMetrics(),
      getClients(),
      getCertificates(),
      getProcessSteps(),
    ]);
  const dict = getDictionary(locale);
  const [phone] = company.phones;
  const categoryLabel = (slug: string) => projectCategories.find((c) => c.slug === slug)?.label[locale] ?? slug;

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />

      {/* 01 — Hero */}
      <Hero
        locale={locale}
        eyebrow={home.hero.eyebrow[locale]}
        headline={home.hero.headline[locale]}
        sub={home.hero.sub[locale]}
        primary={{ href: href(locale, "home", { hash: "capabilities" }), label: home.hero.primaryCta[locale] }}
        secondary={{ href: href(locale, "contact"), label: home.hero.secondaryCta[locale] }}
        location={home.hero.location[locale]}
        coordinates={`${company.geo.lat.toFixed(1)}°N ${company.geo.lng.toFixed(1)}°E`}
        scroll={home.hero.scroll[locale]}
        scrollTarget="#intro"
        services={services.map((s) => ({ label: s.name[locale], href: href(locale, "service", { slug: s.slug }), index: s.index }))}
        plate={{
          photo: getMedia("site/laser-sparks").src,
          labels: { part: home.hero.plate.part[locale], sequence: home.hero.plate.sequence[locale] },
        }}
      />

      {/* 02 — Introduction */}
      <Intro
        index="01"
        label={home.intro.label[locale]}
        statement={home.intro.statement[locale]}
        paragraphs={home.intro.paragraphs[locale]}
        beyondLabel={home.intro.beyondLabel[locale]}
        beyond={home.intro.beyond[locale]}
        visionLabel={home.intro.visionLabel[locale]}
        vision={company.vision.statement[locale]}
        link={{ href: href(locale, "about"), label: home.intro.link[locale] }}
        legalNames={company.legalName}
      />

      {/* 03 — Key capabilities */}
      <section id="capabilities" aria-labelledby="capabilities-title" className="section-y relative overflow-hidden bg-background-deep">
        <div aria-hidden className="bg-perforated pointer-events-none absolute inset-y-0 end-0 w-1/2 opacity-70 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]" />
        <div className="container-x relative">
          <SectionHeader
            id="capabilities-title"
            index="02"
            label={home.process.label[locale]}
            title={home.process.title[locale]}
            intro={home.process.intro[locale]}
          />
          <div className="mt-14 lg:mt-20">
            <ProcessLine
              steps={steps.map((s) => ({
                slug: s.slug,
                index: s.index,
                verb: s.verb[locale],
                title: s.title[locale],
                body: s.body[locale],
                href: s.service ? href(locale, "service", { slug: s.service }) : undefined,
              }))}
            />
          </div>
        </div>
      </section>

      {/* 04 — Featured services */}
      <section id="services" aria-labelledby="services-title" className="section-y">
        <div className="container-x">
          <SectionHeader
            id="services-title"
            index="03"
            label={home.services.label[locale]}
            title={home.services.title[locale]}
            intro={home.services.intro[locale]}
            action={<SectionLink href={href(locale, "services")} label={home.services.all[locale]} />}
          />
          <div className="mt-12 lg:mt-16">
            <ServiceExplorer
              labels={{ open: home.services.open[locale], figure: home.services.figure[locale] }}
              services={services.map((s) => {
                const media = getMedia(s.cover);
                return {
                  slug: s.slug,
                  index: s.index,
                  name: s.name[locale],
                  summary: s.summary[locale],
                  highlights: s.highlights[locale],
                  href: href(locale, "service", { slug: s.slug }),
                  image: { ...media, alt: s.coverAlt[locale] },
                };
              })}
            />
          </div>
        </div>
      </section>

      {/* 05 — Precision statement (signature metal cut) */}
      <PrecisionStatement
        rtl={locale === "ar"}
        label={home.statement.lines[locale].join(" ")}
        lines={home.statement.lines[locale]}
        caption={home.statement.caption[locale]}
      />

      {/* 06 — Machinery */}
      <section id="machinery" aria-labelledby="machinery-title" className="section-y">
        <div className="container-x">
          <SectionHeader
            id="machinery-title"
            index="04"
            label={home.machinery.label[locale]}
            title={home.machinery.title[locale]}
            intro={home.machinery.intro[locale]}
            action={<SectionLink href={href(locale, "capabilities")} label={home.machinery.all[locale]} />}
          />
          <div className="mt-12 lg:mt-16">
            <MachineExplorer
              labels={{
                power: home.machinery.power[locale],
                usedFor: home.machinery.usedFor[locale],
                service: home.machinery.service[locale],
                previous: dict.a11y.previous,
                next: dict.a11y.next,
                notStated: home.machinery.notStated[locale],
                list: home.machinery.label[locale],
              }}
              machines={machines.map((m) => {
                const media = getMedia(m.media);
                const service = services.find((s) => s.slug === m.service)!;
                return {
                  slug: m.slug,
                  name: m.name[locale],
                  shortName: m.shortName[locale],
                  category: m.category[locale],
                  power: m.powerWatts ? formatPower(m.powerWatts, "en") : undefined,
                  powerWatts: m.powerWatts,
                  capability: m.capability[locale],
                  service: { name: service.name[locale], href: href(locale, "service", { slug: service.slug }) },
                  image: { ...media, alt: m.name[locale] },
                };
              })}
            />
          </div>
        </div>
      </section>

      {/* 07 — Featured projects */}
      <section id="projects" aria-labelledby="projects-title" className="section-y border-t border-line">
        <div className="container-x">
          <SectionHeader
            id="projects-title"
            index="05"
            label={home.projects.label[locale]}
            title={home.projects.title[locale]}
            intro={home.projects.intro[locale]}
            action={<SectionLink href={href(locale, "projects")} label={home.projects.all[locale]} />}
          />
          <div className="mt-12 lg:mt-16">
            <FeaturedProjects
              viewLabel={home.projects.view[locale]}
              projects={featured.map((p) => ({
                slug: p.slug,
                href: href(locale, "project", { slug: p.slug }),
                title: p.title[locale],
                categories: p.categories.slice(0, 2).map(categoryLabel),
                galleryRef: p.galleryRef,
                media: p.media[0],
                alt: p.title[locale],
              }))}
            />
          </div>
        </div>
      </section>

      {/* 08 — Industries */}
      <section id="industries" aria-labelledby="industries-title" className="section-y bg-background-deep">
        <div className="container-x">
          <SectionHeader
            id="industries-title"
            index="06"
            label={home.industries.label[locale]}
            title={home.industries.title[locale]}
            action={<SectionLink href={href(locale, "industries")} label={home.industries.all[locale]} />}
          />
          <div className="mt-12 lg:mt-16">
            <IndustryList
              industries={industries.map((ind) => {
                const media = getMedia(ind.media);
                return {
                  slug: ind.slug,
                  name: ind.name[locale],
                  description: ind.description[locale],
                  image: { src: media.src, blurDataURL: media.blurDataURL, alt: "" },
                };
              })}
            />
            <p className="t-label mt-8 text-ink-3">{home.industries.note[locale]}</p>
          </div>
        </div>
      </section>

      {/* 09 — Why RAWASY */}
      <section id="why" aria-labelledby="why-title" className="section-y">
        <div className="container-x">
          <SectionHeader
            id="why-title"
            size="compact"
            index="07"
            label={home.why.label[locale]}
            title={home.why.title[locale]}
            intro={home.why.intro[locale]}
          />
          <div className="mt-12 lg:mt-16">
            <WhyRawasy
              pillars={pillars.map((p) => ({ slug: p.slug, icon: p.icon, title: p.title[locale], body: p.body[locale] }))}
            />
          </div>
        </div>
      </section>

      {/* 10 — Metrics */}
      <section id="metrics" aria-labelledby="metrics-title" className="on-band section-y relative overflow-hidden bg-band text-band-ink">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-40 [--grid-line:rgb(236_234_229/0.05)]" />
        <div className="container-x relative">
          <SectionHeader
            id="metrics-title"
            tone="band"
            size="compact"
            index="08"
            label={home.metrics.label[locale]}
            title={home.metrics.title[locale]}
          />
          <div className="mt-12 lg:mt-16">
            <Metrics
              footnote={home.metrics.footnote[locale]}
              metrics={metricData.metrics.map((m) => ({
                slug: m.slug,
                value: m.value,
                display: m.display[locale],
                unit: m.unit?.[locale],
                label: m.label[locale],
              }))}
              statements={metricData.statements.map((s) => ({ title: s.title[locale], body: s.body[locale] }))}
            />
          </div>
        </div>
      </section>

      {/* 11 — Clients */}
      <section id="clients" aria-labelledby="clients-title" className="section-y overflow-hidden">
        <div className="container-x">
          <SectionHeader
            id="clients-title"
            size="compact"
            index="09"
            label={home.clients.label[locale]}
            title={home.clients.title[locale]}
            intro={home.clients.intro[locale]}
            action={<SectionLink href={href(locale, "clients")} label={home.clients.all[locale]} />}
          />
        </div>
        <div className="mt-12 lg:mt-16">
          <ClientMarquee
            clients={clients.map((c) => {
              const logo = getMedia(c.logo);
              const mono = getMedia(c.logoMono);
              return {
                slug: c.slug,
                name: c.name[locale],
                logo: { src: logo.src, width: logo.width, height: logo.height },
                mono: { src: mono.src, width: mono.width, height: mono.height },
              };
            })}
          />
        </div>
      </section>

      {/* 12 — Certificates */}
      <section id="certificates" aria-labelledby="certificates-title" className="section-y bg-background-deep">
        <div className="container-x">
          <SectionHeader
            id="certificates-title"
            size="compact"
            index="10"
            label={home.certificates.label[locale]}
            title={home.certificates.title[locale]}
            intro={home.certificates.intro[locale]}
            action={<SectionLink href={href(locale, "certificates")} label={home.certificates.all[locale]} />}
          />
          <div className="mt-12 lg:mt-16">
            <Certificates
              labels={{ view: home.certificates.view[locale], close: dict.a11y.close, redacted: home.certificates.redacted[locale] }}
              certificates={certificates.map((c) => ({
                slug: c.slug,
                title: c.title[locale],
                issuer: c.issuer[locale],
                facts: c.facts.map((f) => ({ label: f.label[locale], value: f.value[locale] })),
                thumb: getMedia(c.thumb),
                previews: (locale === "ar" ? [...c.previews].reverse() : c.previews).map((id) => getMedia(id)),
              }))}
            />
            <p className="t-label mt-8 text-ink-3">{home.certificates.note[locale]}</p>
          </div>
        </div>
      </section>

      {/* 13 — Project CTA */}
      <ProjectCTA
        index="11"
        label={home.cta.label[locale]}
        title={home.cta.title[locale]}
        steps={home.cta.steps[locale]}
        primary={{ href: href(locale, "contact"), label: home.cta.primary[locale] }}
        whatsapp={{ href: whatsappUrl(), label: home.cta.whatsapp[locale] }}
        phone={{ display: phone.display, href: `tel:${phone.e164}` }}
        email={company.email}
        imageAlt={locale === "ar" ? "أفق مدينة الرياض ليلًا" : "Riyadh skyline at night"}
      />
    </>
  );
}
