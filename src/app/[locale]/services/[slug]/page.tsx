import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { getMedia } from "@/content/media";
import { routeLabels } from "@/content/navigation";
import {
  getCompany,
  getIndustries,
  getIndustriesPageContent,
  getMachines,
  getProjectsPageContent,
  getServicePageContent,
  getServices,
  getShowcasedProjects,
} from "@/content/repository";
import type { Project, ProjectCategory } from "@/content/types";
import { services as allServices } from "@/content/services";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, path } from "@/i18n/routes";
import { isPublished } from "@/lib/page-meta";
import { categoryViews, projectCard } from "@/lib/project-cards";
import { breadcrumbJsonLd, buildMetadata, JsonLd, localizedUrl, SITE_URL } from "@/lib/seo";
import { serviceTone } from "@/lib/tones";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { RelatedServices } from "@/components/service/RelatedServices";
import { ServiceApplications } from "@/components/service/ServiceApplications";
import { ServiceCTA } from "@/components/service/ServiceCTA";
import { ServiceGallery } from "@/components/service/ServiceGallery";
import { ServiceHero } from "@/components/service/ServiceHero";
import { ServiceMachines } from "@/components/service/ServiceMachines";
import { ServiceOverview } from "@/components/service/ServiceOverview";
import { ServiceProcess } from "@/components/service/ServiceProcess";
import { ServiceProjects } from "@/components/service/ServiceProjects";
import { ServiceScope } from "@/components/service/ServiceScope";
import { ServiceSection } from "@/components/service/ServiceSection";
import { ServiceWhy } from "@/components/service/ServiceWhy";
import { serviceLooks, type SectionKey } from "@/components/service/looks";
import { AxisPlateVisual } from "@/components/service/visuals/AxisPlateVisual";
import { CutPathVisual } from "@/components/service/visuals/CutPathVisual";
import { EngravedPlateVisual } from "@/components/service/visuals/EngravedPlateVisual";
import { FoldVisual } from "@/components/service/visuals/FoldVisual";
import { ScaffoldVisual } from "@/components/service/visuals/ScaffoldVisual";
import { WorkbenchVisual } from "@/components/service/visuals/WorkbenchVisual";

// Known slugs are prerendered; unknown ones render and call notFound().
export const dynamicParams = true;

export function generateStaticParams() {
  return locales.flatMap((locale) => allServices.map((s) => ({ locale, slug: s.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const content = await getServicePageContent(slug);
  if (!isLocale(locale) || !content) return {};
  return buildMetadata({
    locale,
    pathname: path("service", { slug }),
    title: content.service.name[locale],
    description: content.service.summary[locale],
    noindex: !isPublished("service"),
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Service detail page (stage 1D). One composition shared by the six services;
 * each page's character comes from its look (hero drawing, scope, process and
 * gallery layouts, section surfaces and colour role — see looks.ts). Sections
 * without sourced content are left out rather than filled in.
 */
export default async function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { locale, slug } = await params;
  const content = await getServicePageContent(slug);
  if (!isLocale(locale) || !content) notFound();
  const { service, detail, labels } = content;
  const [services, machines, industries, industriesPage, showcased, projectsPage, company] = await Promise.all([
    getServices(),
    getMachines(),
    getIndustries(),
    getIndustriesPageContent(),
    getShowcasedProjects(),
    getProjectsPageContent(),
    getCompany(),
  ]);
  const dict = getDictionary(locale);
  const look = serviceLooks[service.slug];
  const tone = serviceTone[service.slug];
  const fig = (n: number) => `${dict.common.figure} ${pad(n)}`;

  const crumbs = [
    { href: href(locale, "home"), label: dict.common.home },
    { href: href(locale, "services"), label: routeLabels.services[locale] },
    { href: href(locale, "service", { slug }), label: service.name[locale] },
  ];

  // Related records: only what the sources support.
  const serviceMachines = machines.filter((m) => m.service === service.slug);
  const sectors = industries.filter((i) => i.services.includes(service.slug));
  const projects = service.projects
    .map((s) => showcased.find((p) => p.slug === s))
    .filter((p): p is Project => p !== undefined && p.services.includes(service.slug))
    .map((p) => projectCard(p, locale));
  const projectCategoryList = [...new Set(projects.flatMap((p) => p.categories.map((c) => c.slug)))] as ProjectCategory[];
  const gallery = service.gallery.map((item) => {
    const media = getMedia(item.media);
    return { src: media.src, width: media.width, height: media.height, blurDataURL: media.blurDataURL, caption: item.caption[locale] };
  });
  const related = detail.related
    .map((s) => services.find((x) => x.slug === s))
    .filter((s) => s !== undefined)
    .map((s) => ({
      slug: s.slug,
      index: s.index,
      name: s.name[locale],
      tagline: s.tagline[locale],
      href: href(locale, "service", { slug: s.slug }),
      tone: serviceTone[s.slug],
      highlights: s.highlights[locale].slice(0, 3),
    }));

  // Figures are numbered through the page: the hero, the overview photo, the scope photos, then the gallery.
  const heroFigures = look.hero.visual === "plate" ? 0 : 1;
  const galleryStart = heroFigures + (detail.overview.media ? 1 : 0) + (detail.scope.media?.length ?? 0) + 1;

  const quoteHref = href(locale, "contact", { hash: "quote" });
  const workAnchor = gallery.length > 0 ? "#gallery" : projects.length > 0 ? "#projects" : undefined;
  const cover = { id: service.cover, alt: service.coverAlt[locale] };
  const heroCaption = service.name[locale];

  const visual: Record<typeof look.hero.visual, () => ReactNode> = {
    cut: () => <CutPathVisual image={cover} figure={fig(1)} caption={heroCaption} />,
    fold: () => <FoldVisual image={cover} figure={fig(1)} caption={heroCaption} />,
    frame: () => <AxisPlateVisual image={cover} figure={fig(1)} caption={heroCaption} />,
    workbench: () => (
      <WorkbenchVisual
        main={cover}
        detail={{ id: detail.heroDetail!.media, alt: detail.heroDetail!.caption[locale] }}
        figure={fig(1)}
        caption={heroCaption}
      />
    ),
    plate: () => <EngravedPlateVisual />,
    bays: () => <ScaffoldVisual image={cover} figure={fig(1)} caption={heroCaption} />,
  };

  // The page's sections, in order; each is numbered when rendered.
  const sections: { key: SectionKey; id: string; render: (index: string) => ReactNode }[] = [];
  const add = (key: SectionKey, id: string, render: (index: string) => ReactNode) => sections.push({ key, id, render });

  add("overview", "overview", (index) => (
    <ServiceSection id="overview" surface={look.surfaces.overview} index={index} label={labels.labels.overview[locale]} title={detail.overview.title[locale]}>
      <ServiceOverview
        paragraphs={service.body[locale]}
        includesLabel={labels.includes[locale]}
        includes={service.highlights[locale]}
        tone={tone}
        figure={detail.overview.media && { id: detail.overview.media.media, alt: detail.overview.media.caption[locale], label: fig(heroFigures + 1) }}
      />
    </ServiceSection>
  ));

  add("scope", "scope", (index) => (
    <ServiceSection
      id="scope"
      surface={look.surfaces.scope}
      size="default"
      index={index}
      label={labels.labels.scope[locale]}
      title={detail.scope.title[locale]}
      intro={detail.scope.intro[locale]}
    >
      <ServiceScope
        layout={look.scope}
        tone={tone}
        icons={look.icons}
        figureLabel={dict.common.figure}
        figureStart={heroFigures + (detail.overview.media ? 1 : 0) + 1}
        items={detail.scope.items.map((item) => {
          const media = item.media && getMedia(item.media.media);
          return {
            slug: item.slug,
            title: item.title[locale],
            body: item.body?.[locale],
            image: media && { src: media.src, width: media.width, height: media.height, blurDataURL: media.blurDataURL, alt: item.media!.caption[locale] },
          };
        })}
        figures={detail.scope.media?.map((m) => ({ id: m.media, alt: m.caption[locale] }))}
      />
    </ServiceSection>
  ));

  add("process", "process", (index) => (
    <ServiceSection
      id="process"
      surface={look.surfaces.process}
      index={index}
      label={labels.labels.process[locale]}
      title={detail.process.title[locale]}
      intro={detail.process.intro[locale]}
    >
      <ServiceProcess
        layout={look.process.layout}
        line={look.process.line}
        tone={tone}
        icons={look.icons}
        icon={service.slug}
        note={labels.processNote[locale]}
        band={look.surfaces.process === "slate"}
        steps={detail.process.steps.map((step) => ({ slug: step.slug, title: step.title[locale], body: step.body?.[locale] }))}
      />
    </ServiceSection>
  ));

  if (detail.machines && serviceMachines.length > 0) {
    const machineText = detail.machines;
    add("machines", "machinery", (index) => (
      <ServiceSection
        id="machinery"
        surface={look.surfaces.machines}
        index={index}
        label={labels.labels.machines[locale]}
        title={machineText.title[locale]}
        intro={machineText.intro[locale]}
        action={
          <ButtonLink href={href(locale, "capabilities")} variant={look.surfaces.machines === "slate" ? "outline" : "steel"} size="sm">
            {labels.machine.link[locale]}
          </ButtonLink>
        }
      >
        <ServiceMachines
          powerLabel={labels.machine.power[locale]}
          linkLabel={labels.machine.capabilities[locale]}
          machines={serviceMachines.map((m) => {
            const media = getMedia(m.media);
            return {
              slug: m.slug,
              name: m.name[locale],
              category: m.category[locale],
              capability: m.capability[locale],
              power: m.powerWatts ? { value: m.powerWatts.toLocaleString("en-US"), unit: locale === "ar" ? "واط" : "W" } : undefined,
              image: { src: media.src, width: media.width, height: media.height, blurDataURL: media.blurDataURL },
              href: href(locale, "capabilities", { hash: m.slug }),
            };
          })}
        />
      </ServiceSection>
    ));
  }

  const uses = detail.applications.uses?.map((u) => u[locale]) ?? [];
  if (sectors.length > 0 || uses.length > 0) {
    add("applications", "applications", (index) => (
      <ServiceSection
        id="applications"
        surface={look.surfaces.applications}
        index={index}
        label={labels.labels.applications[locale]}
        title={detail.applications.title[locale]}
        intro={detail.applications.intro[locale]}
      >
        <ServiceApplications
          tone={tone}
          labels={{ sectors: labels.applications.sectors[locale], uses: labels.applications.uses[locale], work: labels.applications.work[locale] }}
          sectors={sectors.map((s) => ({ slug: s.slug, name: s.name[locale], basis: s.source.basis === "profile" ? "profile" : "inferred", basisLabel: (s.source.basis === "profile" ? industriesPage.basis.profile : industriesPage.basis.inferred)[locale] }))}
          uses={uses}
          categories={categoryViews(locale, projectCategoryList).slice(0, 5)}
          link={sectors.length > 0 ? { href: href(locale, "industries"), label: labels.applications.link[locale] } : undefined}
        />
      </ServiceSection>
    ));
  }

  if (detail.gallery && gallery.length > 0) {
    const galleryText = detail.gallery;
    add("gallery", "gallery", (index) => (
      <ServiceSection
        id="gallery"
        surface={look.surfaces.gallery}
        index={index}
        label={labels.labels.gallery[locale]}
        title={galleryText.title[locale]}
        intro={galleryText.intro[locale]}
      >
        <ServiceGallery
          layout={look.gallery}
          photos={gallery}
          figureLabel={dict.common.figure}
          start={galleryStart}
          band={look.surfaces.gallery === "slate"}
        />
      </ServiceSection>
    ));
  }

  add("why", "why", (index) => (
    <ServiceSection id="why" surface={look.surfaces.why} index={index} label={labels.labels.why[locale]} title={detail.why.title[locale]}>
      <ServiceWhy
        tone={tone}
        points={detail.why.points.map((p) => ({ slug: p.slug, icon: look.icons[p.slug] ?? "precision", title: p.title[locale], body: p.body?.[locale] }))}
      />
    </ServiceSection>
  ));

  add("related", "related", (index) => (
    <ServiceSection
      id="related"
      surface={look.surfaces.related}
      index={index}
      label={labels.labels.related[locale]}
      title={labels.relatedTitle[locale]}
      action={
        <ButtonLink href={href(locale, "services")} variant="outline" size="sm">
          {labels.allServices[locale]}
        </ButtonLink>
      }
    >
      <RelatedServices services={related} action={labels.explore[locale]} />
    </ServiceSection>
  ));

  if (detail.projects && projects.length > 0) {
    const projectText = detail.projects;
    add("projects", "projects", (index) => (
      <ServiceSection
        id="projects"
        surface={look.surfaces.projects}
        index={index}
        label={labels.labels.projects[locale]}
        title={projectText.title[locale]}
        intro={projectText.intro[locale]}
        action={
          <ButtonLink href={href(locale, "projects")} variant="secondary" size="sm">
            {labels.allProjects[locale]}
          </ButtonLink>
        }
      >
        <ServiceProjects projects={projects} refLabel={projectsPage.refLabel[locale]} viewLabel={projectsPage.view[locale]} />
      </ServiceSection>
    ));
  }

  const phone = company.phones[0];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.name[locale],
          description: service.summary[locale],
          serviceType: service.name.en,
          url: localizedUrl(locale, path("service", { slug })),
          areaServed: { "@type": "Country", name: "Saudi Arabia" },
          provider: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: company.legalName.en },
        }}
      />
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: `${SITE_URL}${c.href}` })))} />

      <ServiceHero
        surface={look.hero.surface}
        backdrop={look.hero.backdrop}
        breadcrumb={crumbs}
        breadcrumbLabel={dict.a11y.breadcrumb}
        index={service.index}
        serviceLabel={labels.service[locale]}
        section={labels.sections[detail.section][locale]}
        title={service.name[locale]}
        lead={service.tagline[locale]}
        intro={service.summary[locale]}
        actions={
          <>
            <ButtonLink href={quoteHref}>{labels.quote[locale]}</ButtonLink>
            {workAnchor && (
              <ButtonLink href={workAnchor} variant="outline" icon="none">
                {labels.seeWork[locale]}
              </ButtonLink>
            )}
          </>
        }
        visual={visual[look.hero.visual]()}
        meta={detail.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
      />

      {sections.map((section, i) => (
        <Fragment key={section.id}>{section.render(pad(i + 1))}</Fragment>
      ))}

      <ServiceCTA
        slug={service.slug}
        tone={tone}
        label={detail.cta.label[locale]}
        title={detail.cta.title[locale]}
        body={detail.cta.body[locale]}
        quote={{ href: quoteHref, label: labels.quote[locale] }}
        call={{ href: `tel:${phone.e164}`, label: labels.cta.call[locale], number: phone.display }}
        explore={{
          label: labels.cta.or[locale],
          links: [
            { href: href(locale, "services"), label: labels.cta.services[locale] },
            { href: href(locale, "projects"), label: labels.cta.projects[locale] },
          ],
        }}
      />
    </>
  );
}
