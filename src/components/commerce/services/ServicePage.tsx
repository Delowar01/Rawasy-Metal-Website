import { Fragment, type ReactNode } from "react";
import { getMedia } from "@/content/media";
import type { MediaId } from "@/content/media.generated";
import { routeLabels } from "@/content/navigation";
import {
  getCompany,
  getHomeContent,
  getIndustries,
  getIndustriesPageContent,
  getMachines,
  getProjectsPageContent,
  type getServicePageContent,
  getServices,
  getShowcasedProjects,
} from "@/content/repository";
import type { Project } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, path } from "@/i18n/routes";
import { projectCard } from "@/lib/project-cards";
import { breadcrumbJsonLd, JsonLd, localizedUrl, SITE_URL } from "@/lib/seo";
import { Icon } from "../Icon";
import { serviceTone } from "../tones";
import type { CommerceImage } from "../types";
import { serviceIcon } from "../ui";
import { HeroVisual } from "./HeroVisual";
import { serviceLooks, type SectionKey } from "./looks";
import { surfaceAt, SvSection, type SectionAction, type Surface } from "./parts";
import { Applications, Gallery, Machines, Overview, Process, Projects, Related, Scope, Why } from "./ServiceBlocks";
import { ServiceCta } from "./ServiceCta";
import { ServiceHero } from "./ServiceHero";
import "./services.css";

type Content = NonNullable<Awaited<ReturnType<typeof getServicePageContent>>>;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A service page in the Modern Commerce design (Stage TM-2.4). The Stage 1D page's content and structure (decision D3):
 * the same sections in the same order, each only where its content exists — overview, what we provide, how we work,
 * machinery, applications, gallery, why RAWASY, related services, projects — then the closing call to action. Every
 * fact comes from the content layer (the company profile and the records): machines and projects only where their own
 * record ties them to the service, rated power only where the profile states it, the general-workflow note on every
 * process. The project cards open the Projects gallery until the project pages exist (D4); the machine links keep the
 * Capabilities placeholder (D5). Structured data and metadata are unchanged.
 */
export async function ServicePage({ locale, content }: { locale: Locale; content: Content }) {
  const { service, detail, labels } = content;
  const [services, machines, industries, industriesPage, showcased, projectsPage, company, home] = await Promise.all([
    getServices(),
    getMachines(),
    getIndustries(),
    getIndustriesPageContent(),
    getShowcasedProjects(),
    getProjectsPageContent(),
    getCompany(),
    getHomeContent(),
  ]);
  const dict = getDictionary(locale);
  const look = serviceLooks[service.slug];
  const tone = serviceTone[service.slug];
  const image = (id: MediaId, alt: string): CommerceImage => ({ ...getMedia(id), alt });

  const crumbs = [
    { href: href(locale, "home"), label: dict.common.home },
    { href: href(locale, "services"), label: routeLabels.services[locale] },
    { href: href(locale, "service", { slug: service.slug }), label: service.name[locale] },
  ];

  // Related records: only what the sources support.
  const serviceMachines = machines.filter((m) => m.service === service.slug);
  const sectors = industries.filter((i) => i.services.includes(service.slug));
  const projects = service.projects
    .map((s) => showcased.find((p) => p.slug === s))
    .filter((p): p is Project => p !== undefined && p.services.includes(service.slug))
    .map((p) => projectCard(p, locale));
  const categories = [...new Map(projects.flatMap((p) => p.categories).map((c) => [c.slug, c])).values()].slice(0, 5);
  const gallery = service.gallery.map((item) => ({ ...image(item.media, ""), caption: item.caption[locale] }));
  const uses = detail.applications.uses?.map((u) => u[locale]) ?? [];

  const quoteHref = href(locale, "contact", { hash: "quote" });
  const workAnchor = gallery.length > 0 ? "#gallery" : projects.length > 0 ? "#projects" : undefined;
  // Laser Engraving shows no photograph: its cover (third-party nameplates) is never used.
  const cover = look.hero === "plate" ? undefined : image(service.cover, service.coverAlt[locale]);
  const heroDetail = detail.heroDetail && image(detail.heroDetail.media, detail.heroDetail.caption[locale]);

  // The page's sections, in order; each is numbered and given its surface when rendered.
  const sections: { key: SectionKey; render: (index: string, surface: Surface) => ReactNode }[] = [];
  const add = (key: SectionKey, render: (index: string, surface: Surface) => ReactNode) => sections.push({ key, render });
  const section = (id: string, key: SectionKey, title: string, intro: string | undefined, action: SectionAction | undefined, body: (read: boolean) => ReactNode) =>
    add(key, (index, surface) => (
      <SvSection id={id} surface={surface} index={index} label={labels.labels[key][locale]} title={title} intro={intro} tone={tone} action={action}>
        {body(surface === "plain")}
      </SvSection>
    ));

  section("overview", "overview", detail.overview.title[locale], undefined, undefined, (read) => (
    <Overview
      paragraphs={service.body[locale]}
      includesLabel={labels.includes[locale]}
      includes={service.highlights[locale]}
      tone={tone}
      figure={detail.overview.media && { ...image(detail.overview.media.media, ""), caption: detail.overview.media.caption[locale] }}
      read={read}
    />
  ));

  section("scope", "scope", detail.scope.title[locale], detail.scope.intro[locale], undefined, (read) => (
    <Scope
      layout={look.scope}
      tone={tone}
      icons={look.icons}
      read={read}
      items={detail.scope.items.map((item) => ({
        slug: item.slug,
        title: item.title[locale],
        body: item.body?.[locale],
        image: item.media && image(item.media.media, item.media.caption[locale]),
      }))}
      figures={detail.scope.media?.map((m) => ({ ...image(m.media, ""), caption: m.caption[locale] }))}
    />
  ));

  section("process", "process", detail.process.title[locale], detail.process.intro[locale], undefined, (read) => (
    <Process
      layout={look.process}
      rail={look.rail}
      tone={tone}
      icons={look.icons}
      note={labels.processNote[locale]}
      read={read}
      steps={detail.process.steps.map((step) => ({ slug: step.slug, title: step.title[locale], body: step.body?.[locale] }))}
    />
  ));

  if (detail.machines && serviceMachines.length > 0) {
    section(
      "machinery",
      "machines",
      detail.machines.title[locale],
      detail.machines.intro[locale],
      { href: href(locale, "capabilities"), label: labels.machine.link[locale], variant: "steel" },
      () => (
        <Machines
          powerLabel={labels.machine.power[locale]}
          linkLabel={labels.machine.capabilities[locale]}
          machines={serviceMachines.map((m) => ({
            slug: m.slug,
            name: m.name[locale],
            category: m.category[locale],
            capability: m.capability[locale],
            power: m.powerWatts ? { value: m.powerWatts.toLocaleString("en-US"), unit: locale === "ar" ? "واط" : "W" } : undefined,
            image: image(m.media, ""),
            href: href(locale, "capabilities", { hash: m.slug }),
          }))}
        />
      ),
    );
  }

  if (sectors.length > 0 || uses.length > 0) {
    section("applications", "applications", detail.applications.title[locale], detail.applications.intro[locale], undefined, (read) => (
      <Applications
        tone={tone}
        read={read}
        labels={{ sectors: labels.applications.sectors[locale], uses: labels.applications.uses[locale], work: labels.applications.work[locale] }}
        sectors={sectors.map((s) => ({
          slug: s.slug,
          name: s.name[locale],
          basis: s.source.basis === "profile" ? "profile" : "inferred",
          basisLabel: (s.source.basis === "profile" ? industriesPage.basis.profile : industriesPage.basis.inferred)[locale],
        }))}
        uses={uses}
        categories={categories.map((c) => ({ slug: c.slug, label: c.label }))}
        link={sectors.length > 0 ? { href: href(locale, "industries"), label: labels.applications.link[locale] } : undefined}
      />
    ));
  }

  if (detail.gallery && gallery.length > 0) {
    section("gallery", "gallery", detail.gallery.title[locale], detail.gallery.intro[locale], undefined, (read) => (
      <Gallery layout={look.gallery} photos={gallery} read={read} />
    ));
  }

  section("why", "why", detail.why.title[locale], undefined, undefined, () => (
    <Why tone={tone} points={detail.why.points.map((p) => ({ slug: p.slug, icon: look.icons[p.slug] ?? "precision", title: p.title[locale], body: p.body?.[locale] }))} />
  ));

  section("related", "related", labels.relatedTitle[locale], undefined, { href: href(locale, "services"), label: labels.allServices[locale] }, () => (
    <Related
      action={labels.explore[locale]}
      services={detail.related
        .map((s) => services.find((x) => x.slug === s))
        .filter((s) => s !== undefined)
        .map((s) => ({
          slug: s.slug,
          index: s.index,
          name: s.name[locale],
          tagline: s.tagline[locale],
          href: href(locale, "service", { slug: s.slug }),
          tone: serviceTone[s.slug],
          icon: serviceIcon[s.slug],
          highlights: s.highlights[locale].slice(0, 3),
        }))}
    />
  ));

  if (detail.projects && projects.length > 0) {
    section("projects", "projects", detail.projects.title[locale], detail.projects.intro[locale], { href: href(locale, "projects"), label: labels.allProjects[locale] }, (read) => (
      <Projects
        read={read}
        // Until the project pages exist (Stage 1F), every card opens the Projects gallery (decision D4).
        href={href(locale, "projects", { hash: "gallery" })}
        refLabel={projectsPage.refLabel[locale]}
        viewLabel={home.projects.inGallery[locale]}
        projects={projects.map((p) => ({
          slug: p.slug,
          ref: p.ref,
          title: p.title,
          summary: p.summary,
          categories: p.categories.map((c) => c.label),
          images: p.images.map((img) => ({ ...img, alt: "" })),
        }))}
      />
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
          url: localizedUrl(locale, path("service", { slug: service.slug })),
          areaServed: { "@type": "Country", name: "Saudi Arabia" },
          provider: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: company.legalName.en },
        }}
      />
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: `${SITE_URL}${c.href}` })))} />

      <ServiceHero
        breadcrumb={crumbs}
        breadcrumbLabel={dict.a11y.breadcrumb}
        serviceLabel={labels.service[locale]}
        index={service.index}
        section={labels.sections[detail.section][locale]}
        tone={tone}
        title={service.name[locale]}
        lead={service.tagline[locale]}
        intro={service.summary[locale]}
        facts={detail.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
        signature={look.hero === "cut" || look.hero === "plate"}
        actions={
          <>
            <a href={quoteHref} className="btn btn-primary">
              {labels.quote[locale]}
              <Icon name="arrow" size={17} />
            </a>
            {workAnchor && (
              <a href={workAnchor} className="btn btn-secondary">
                {labels.seeWork[locale]}
                <span className="ip-down">
                  <Icon name="arrow" size={17} />
                </span>
              </a>
            )}
          </>
        }
        visual={<HeroVisual kind={look.hero} cover={cover} detail={heroDetail} />}
      />

      {sections.map((s, i) => (
        <Fragment key={s.key}>{s.render(pad(i + 1), surfaceAt(i))}</Fragment>
      ))}

      <ServiceCta
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
