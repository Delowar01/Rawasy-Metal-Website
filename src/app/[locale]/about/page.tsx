import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getMedia } from "@/content/media";
import {
  getAboutContent,
  getCertificates,
  getClients,
  getCompany,
  getMachines,
  getMetrics,
  getPillars,
  getProjectsPageContent,
  getServices,
  getShowcasedProjects,
} from "@/content/repository";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { projectCard } from "@/lib/project-cards";
import { JsonLd, organizationJsonLd } from "@/lib/seo";
import { serviceTone, type Tone } from "@/lib/tones";
import { formatPower } from "@/lib/utils";
import { ApproachPanel } from "@/components/about/ApproachPanel";
import { DivisionPanels } from "@/components/about/DivisionPanels";
import { MachineTable } from "@/components/about/MachineTable";
import { PillarCards } from "@/components/about/PillarCards";
import { ProcessCards } from "@/components/about/ProcessCards";
import { StructuralSketch } from "@/components/about/StructuralSketch";
import { WorkshopSheet } from "@/components/about/WorkshopSheet";
import { ServiceCard } from "@/components/cards/ServiceCard";
import { SupportList } from "@/components/cards/SupportList";
import { InnerCTA } from "@/components/inner/InnerCTA";
import { InnerPageHero } from "@/components/inner/InnerPageHero";
import { MediaFrame } from "@/components/inner/MediaFrame";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CertificateCards } from "@/components/teasers/CertificateCards";
import { LogoStrip } from "@/components/teasers/LogoStrip";
import { ButtonLink } from "@/components/ui/ButtonLink";
import type { LineIconName } from "@/components/ui/LineIcons";
import { Phrases } from "@/components/ui/Phrases";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Backdrop, ScanLine } from "@/components/visual/Backdrop";
import { Nameplate } from "@/components/visual/Nameplate";
import { SectionRule } from "@/components/visual/SectionRule";
import { FrameMarks } from "@/components/visual/TechnicalFrame";

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;
const pad = (n: number) => String(n).padStart(2, "0");

/** Line icons for the process steps and the pillars (the content keeps its own slugs). */
const STEP_ICONS: Record<string, LineIconName> = {
  understand: "understand",
  engineer: "engineer",
  fabricate: "fabrication",
  inspect: "inspect",
  deliver: "transport",
  install: "installation",
};
const PILLAR_LOOK: Record<string, { icon: LineIconName; tone: Tone }> = {
  precision: { icon: "precision", tone: "eng" },
  technology: { icon: "machinery", tone: "eng" },
  craftsmanship: { icon: "fabrication", tone: "craft" },
  reliability: { icon: "quality", tone: "proc" },
  "custom-solutions": { icon: "engineer", tone: "craft" },
  "project-execution": { icon: "integrated", tone: "proc" },
};
const STATEMENT_ICONS: LineIconName[] = ["laser-cutting", "fabrication", "integrated", "workshop"];

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("about", locale);
}

/**
 * About: a full company profile in fifteen parts — introduction (hero), who
 * RAWASY is, what it does, the metal services, scaffolding and site support,
 * vision, engineering approach, how it works, why RAWASY, the workshop, then
 * teasers for machinery, projects, clients and compliance, and the contact
 * CTA. Every fact comes from the company profile; nothing is estimated.
 */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [about, company, services, pillars, metricData, machines, showcased, clients, certificates, projectsPage] = await Promise.all([
    getAboutContent(),
    getCompany(),
    getServices(),
    getPillars(),
    getMetrics(),
    getMachines(),
    getShowcasedProjects(),
    getClients(),
    getCertificates(),
    getProjectsPageContent(),
  ]);
  const dict = getDictionary(locale);
  const fig = (n: number) => `${dict.common.figure} ${pad(n)}`;
  const metalServices = services.filter((s) => s.slug !== "scaffolding");
  const projects = about.projects.slugs
    .map((slug) => showcased.find((p) => p.slug === slug))
    .filter((p) => p !== undefined)
    .map((p) => projectCard(p, locale));

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      {innerPageJsonLd("about", locale, "AboutPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      {/* Company introduction */}
      <InnerPageHero
        breadcrumb={breadcrumbTrail("about", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={about.hero.eyebrow[locale]}
        title={about.hero.title[locale]}
        intro={about.hero.intro[locale]}
        actions={<Nameplate label={about.hero.nameplate[locale]} en={company.legalName.en} ar={company.legalName.ar} />}
        aside={
          <div className="relative">
            <StructuralSketch className="pointer-events-none absolute -top-12 end-[-8%] w-[116%] text-ink-3/55 max-lg:hidden" />
            <MediaFrame
              id={about.hero.media}
              alt={about.hero.mediaAlt[locale]}
              caption={about.hero.caption[locale]}
              figure={fig(1)}
              sizes="(min-width: 1024px) 396px, 90vw"
              preload
              plate
              className="relative w-full lg:ms-auto lg:mt-28"
            />
          </div>
        }
        meta={about.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
      />

      {/* 01 — Who RAWASY is */}
      <section id="overview" aria-labelledby="overview-title" className="section-y">
        <div className="container-x">
          <SectionRule className="mb-10 lg:mb-14" />
          <div className="grid gap-x-10 gap-y-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="t-label eyebrow" data-reveal="fade">
                <span className="t-num">01</span>
                <span aria-hidden>/</span>
                <span>{about.overview.label[locale]}</span>
              </p>
              <h2 id="overview-title" className="t-h2-compact mt-6 max-w-[13em] text-ink" data-reveal>
                <Phrases>{about.overview.title[locale]}</Phrases>
              </h2>
            </div>
            <div className="lg:col-span-7">
              {about.overview.paragraphs[locale].map((paragraph, i) =>
                i === 0 ? (
                  <p key={i} className="t-lead border-s-2 border-accent ps-5 text-ink sm:ps-7" data-reveal>
                    {paragraph}
                  </p>
                ) : (
                  <p key={i} className="t-body mt-6 text-[1.0625rem] sm:ps-7" data-reveal style={delay(60 * i)}>
                    {paragraph}
                  </p>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 02 — What RAWASY does */}
      <section id="what" aria-labelledby="what-title" className="sec-deep section-y">
        <div className="container-x">
          <SectionHeader id="what-title" size="compact" index="02" label={about.what.label[locale]} title={about.what.title[locale]} intro={about.what.intro[locale]} />
          <div className="mt-12 lg:mt-16">
            <DivisionPanels
              divisions={about.what.divisions.map((d) => ({
                slug: d.slug,
                label: d.label[locale],
                title: d.title[locale],
                body: d.body[locale],
                link: { href: d.slug === "metal" ? "#metal" : "#beyond", label: d.link[locale] },
                tone: d.slug === "metal" ? "eng" : "proc",
                icon: d.slug === "metal" ? "laser-cutting" : "scaffolding",
              }))}
            />
          </div>
        </div>
      </section>

      {/* 03 — Core metal services */}
      <section id="metal" aria-labelledby="metal-title" className="sec-eng section-y relative isolate overflow-hidden">
        <Backdrop kind="fine" className="[--bd-fade:linear-gradient(to_bottom,transparent_30%,var(--eng-surface))]" />
        <div className="container-x">
          <SectionHeader id="metal-title" index="03" label={about.metal.label[locale]} title={about.metal.title[locale]} intro={about.metal.intro[locale]} />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-6">
            {metalServices.map((s, i) => (
              <li key={s.slug} className={i < 2 ? "lg:col-span-3" : "lg:col-span-2"}>
                <ServiceCard
                  action={about.metal.explore[locale]}
                  delay={(i % 3) * 70}
                  service={{
                    slug: s.slug,
                    index: s.index,
                    name: s.name[locale],
                    tagline: s.tagline[locale],
                    href: href(locale, "service", { slug: s.slug }),
                    tone: serviceTone[s.slug],
                    highlights: s.highlights[locale].slice(0, i < 2 ? 5 : 3),
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 04 — Scaffolding and site support */}
      <section id="beyond" aria-labelledby="beyond-title" className="section-y relative isolate overflow-hidden">
        <div className="container-x grid gap-x-10 gap-y-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <MediaFrame
              id={about.beyond.media}
              alt={about.beyond.mediaAlt[locale]}
              figure={fig(2)}
              caption={about.beyond.label[locale]}
              sizes="(min-width: 1024px) 537px, 90vw"
              className="w-full"
            />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="t-label eyebrow" data-reveal="fade">
              <span className="t-num">04</span>
              <span aria-hidden>/</span>
              <span>{about.beyond.label[locale]}</span>
            </p>
            <h2 id="beyond-title" className="t-h2-compact mt-6 text-ink" data-reveal>
              <Phrases>{about.beyond.title[locale]}</Phrases>
            </h2>
            <p className="t-lead mt-6" data-reveal style={delay(100)}>
              {about.beyond.intro[locale]}
            </p>
            <SupportList className="mt-9" items={about.beyond.items.map((item) => ({ slug: item.slug, label: item.label[locale] }))} />
            <div className="mt-9" data-reveal>
              <ButtonLink href={href(locale, "service", { slug: "scaffolding" })} variant="teal">
                {about.beyond.link[locale]}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* 05 — Vision */}
      <section id="vision" aria-labelledby="vision-title" className="on-band relative isolate overflow-hidden bg-band text-band-ink">
        <Backdrop kind="grid" drift className="[--bd-opacity:0.7] [--grid-line:rgb(236_234_229/0.045)]" />
        <Backdrop
          kind="perforated"
          className="start-auto w-1/2 opacity-45 [--perf-dot:rgb(236_234_229/0.1)] [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]"
        />
        <ScanLine duration={13} />
        <div className="container-x section-y relative">
          <SectionRule tone="band" />
          <div className="mt-10 max-w-[62rem]">
            <h2 id="vision-title" className="t-label eyebrow !text-band-ink-2" data-reveal="fade">
              <span className="t-num">05</span>
              <span aria-hidden>/</span>
              <span>{about.vision.label[locale]}</span>
            </h2>
            <blockquote className="relative mt-10 border-s-2 border-accent ps-6 sm:ps-10" data-reveal>
              <span aria-hidden className="absolute -start-[5px] top-0 size-2 rotate-45 bg-accent" />
              <p className="t-h2 max-w-[19em]">
                <Phrases>{company.vision.statement[locale]}</Phrases>
              </p>
            </blockquote>
          </div>

          <p className="t-label mt-16 !text-band-ink-2 lg:mt-20" data-reveal="fade">
            {about.vision.aimsLabel[locale]}
          </p>
          <ol className="mt-5 grid gap-px border border-band-line bg-band-line sm:grid-cols-2 lg:grid-cols-4">
            {company.vision.aims[locale].map((aim, i) => (
              <li key={i} className="tf-host relative bg-band-surface/95 p-6 sm:p-7" data-reveal style={delay(80 * i)}>
                <span className="t-num block text-xs text-accent">{pad(i + 1)}</span>
                <span className="mt-4 block text-[0.98rem] leading-relaxed text-band-ink">{aim}</span>
                <FrameMarks lines={false} corners={false} />
              </li>
            ))}
          </ol>
          <p className="mt-12 flex items-center gap-4 font-display text-[1.1rem] font-medium text-band-ink-2" data-reveal>
            <span aria-hidden className="h-px w-10 shrink-0 bg-accent" />
            {company.vision.closing[locale]}
          </p>
        </div>
      </section>

      {/* 06 — Engineering approach */}
      <section id="approach" aria-labelledby="approach-title" className="section-y">
        <div className="container-x">
          <SectionHeader id="approach-title" index="06" label={about.approach.label[locale]} title={about.approach.title[locale]} intro={about.approach.intro[locale]} />
          <div className="mt-12 lg:mt-16">
            <ApproachPanel
              stats={metricData.metrics.map((m) => ({ slug: m.slug, display: m.display[locale], unit: m.unit?.[locale], label: m.label[locale] }))}
              statements={metricData.statements.map((s, i) => ({ icon: STATEMENT_ICONS[i % STATEMENT_ICONS.length], title: s.title[locale], body: s.body[locale] }))}
            />
          </div>
        </div>
      </section>

      {/* 07 — How RAWASY works */}
      <section id="process" aria-labelledby="process-title" className="sec-proc section-y relative isolate overflow-hidden">
        <Backdrop kind="grid" className="[--bd-opacity:0.8] [--bd-fade:linear-gradient(to_bottom,transparent_20%,var(--proc-surface))]" />
        <div className="container-x">
          <SectionHeader id="process-title" index="07" label={about.process.label[locale]} title={about.process.title[locale]} intro={about.process.intro[locale]} />
          <div className="mt-12 lg:mt-16">
            <ProcessCards
              steps={about.process.steps.map((step) => ({
                slug: step.slug,
                icon: STEP_ICONS[step.slug] ?? "integrated",
                title: step.title[locale],
                body: step.body[locale],
              }))}
            />
          </div>
        </div>
      </section>

      {/* 08 — Why RAWASY */}
      <section id="why" aria-labelledby="why-title" className="section-y">
        <div className="container-x">
          <SectionHeader id="why-title" size="compact" index="08" label={about.why.label[locale]} title={about.why.title[locale]} intro={about.why.intro[locale]} />
          <div className="mt-12 lg:mt-16">
            <PillarCards
              pillars={pillars.map((p) => ({
                slug: p.slug,
                icon: PILLAR_LOOK[p.slug]?.icon ?? "precision",
                tone: PILLAR_LOOK[p.slug]?.tone ?? "eng",
                title: p.title[locale],
                body: p.body[locale],
              }))}
            />
          </div>
        </div>
      </section>

      {/* 09 — In the workshop */}
      <section id="workshop" aria-labelledby="workshop-title" className="sec-slate on-band section-y relative isolate overflow-hidden">
        <Backdrop kind="grid" drift className="[--bd-opacity:0.7]" />
        <div className="container-x relative">
          <SectionHeader id="workshop-title" tone="band" size="compact" index="09" label={about.workshop.label[locale]} title={about.workshop.title[locale]} intro={about.workshop.intro[locale]} />
          <div className="mt-12 lg:mt-16">
            <WorkshopSheet
              figureLabel={dict.common.figure}
              photos={about.workshop.photos.map((photo) => {
                const media = getMedia(photo.media);
                return { src: media.src, width: media.width, height: media.height, blurDataURL: media.blurDataURL, caption: photo.caption[locale] };
              })}
            />
          </div>
        </div>
      </section>

      {/* 10 — Machinery (teaser for Capabilities) */}
      <section id="machinery" aria-labelledby="machinery-title" className="sec-eng section-y relative isolate overflow-hidden">
        <div className="container-x grid gap-x-10 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="t-label eyebrow" data-reveal="fade">
              <span className="t-num">10</span>
              <span aria-hidden>/</span>
              <span>{about.machinery.label[locale]}</span>
            </p>
            <h2 id="machinery-title" className="t-h2-compact mt-6 text-ink" data-reveal>
              <Phrases>{about.machinery.title[locale]}</Phrases>
            </h2>
            <p className="t-lead mt-6" data-reveal style={delay(100)}>
              {about.machinery.intro[locale]}
            </p>
            <div className="mt-9" data-reveal>
              <ButtonLink href={href(locale, "capabilities")} variant="steel">
                {about.machinery.link[locale]}
              </ButtonLink>
            </div>
          </div>
          <div className="lg:col-span-8" data-reveal style={delay(120)}>
            <MachineTable
              caption={about.machinery.label[locale]}
              columns={{ machine: about.machinery.machine[locale], type: about.machinery.type[locale], power: about.machinery.power[locale] }}
              notStated={locale === "ar" ? "غير مذكورة في الملف التعريفي" : "Not stated in the company profile"}
              machines={machines.map((m) => {
                const media = getMedia(m.media);
                return {
                  slug: m.slug,
                  name: m.name[locale],
                  type: m.category[locale],
                  power: m.powerWatts ? formatPower(m.powerWatts, "en") : undefined,
                  image: { src: media.src, width: media.width, height: media.height, blurDataURL: media.blurDataURL },
                };
              })}
            />
          </div>
        </div>
      </section>

      {/* 11 — Projects teaser */}
      <section id="work" aria-labelledby="work-title" className="section-y">
        <div className="container-x">
          <SectionHeader
            id="work-title"
            size="compact"
            index="11"
            label={about.projects.label[locale]}
            title={about.projects.title[locale]}
            intro={about.projects.intro[locale]}
            action={
              <ButtonLink href={href(locale, "projects")} variant="secondary" size="sm">
                {about.projects.link[locale]}
              </ButtonLink>
            }
          />
          <ul className="mt-12 grid items-start gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
            {projects.map((project, i) => (
              <li key={project.slug} data-reveal style={delay((i % 4) * 70)} className={i % 2 === 1 ? "lg:mt-10" : undefined}>
                <ProjectCard project={project} refLabel={projectsPage.refLabel[locale]} viewLabel={projectsPage.view[locale]} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 12 — Clients teaser */}
      <section id="clients" aria-labelledby="clients-title" className="sec-deep section-y">
        <div className="container-x">
          <SectionHeader
            id="clients-title"
            size="compact"
            index="12"
            label={about.clients.label[locale]}
            title={about.clients.title[locale]}
            intro={about.clients.intro[locale]}
            action={
              <ButtonLink href={href(locale, "clients")} variant="outline" size="sm">
                {about.clients.link[locale]}
              </ButtonLink>
            }
          />
          <div className="mt-12 lg:mt-16" data-reveal>
            <LogoStrip
              label={about.clients.label[locale]}
              clients={clients.slice(0, 6).map((c) => {
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
        </div>
      </section>

      {/* 13 — Compliance teaser */}
      <section id="compliance" aria-labelledby="compliance-title" className="sec-craft section-y relative isolate overflow-hidden">
        <Backdrop kind="fine" className="[--bd-fade:linear-gradient(to_bottom,transparent_30%,var(--craft-surface))]" />
        <div className="container-x">
          <SectionHeader
            id="compliance-title"
            size="compact"
            index="13"
            label={about.compliance.label[locale]}
            title={about.compliance.title[locale]}
            intro={about.compliance.intro[locale]}
          />
          <div className="mt-12 lg:mt-16">
            <CertificateCards
              href={href(locale, "certificates")}
              action={about.compliance.link[locale]}
              certificates={certificates.map((c) => {
                const thumb = getMedia(c.thumb);
                return {
                  slug: c.slug,
                  title: c.title[locale],
                  issuer: c.issuer[locale],
                  thumb: { src: thumb.src, width: thumb.width, height: thumb.height, blurDataURL: thumb.blurDataURL },
                };
              })}
            />
            <p className="t-caption mt-6 text-ink-2">{about.compliance.note[locale]}</p>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
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
