import { getMedia } from "@/content/media";
import type { MediaId } from "@/content/media.generated";
import { projectCategories, projectImages } from "@/content/projects";
import {
  getAboutContent,
  getCertificates,
  getClients,
  getClientsPageContent,
  getCompany,
  getFeaturedProjects,
  getHomeContent,
  getIndustries,
  getIndustriesPageContent,
  getMachines,
  getMetrics,
  getPillars,
  getServices,
} from "@/content/repository";
import type { ServiceSlug } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/routes";
import type { CommerceImage, MachineItem } from "../types";

/*
 * Everything the Modern Commerce homepage shows, drawn from the content layer — the same copy, figures and photos
 * the approved A V2 preview showed, with the website's real routes. Flagged photos stay off: the laser-engraving
 * cover (third-party branding, part and serial numbers) and its render are replaced by the engraving signature.
 */

const image = (id: MediaId, alt: string): CommerceImage => ({ ...getMedia(id), alt });

export async function getHomeView(locale: Locale) {
  const [home, company, services, machines, featured, industries, metricData, pillars, clients, certificates, about, clientsPage, industriesPage] =
    await Promise.all([
      getHomeContent(),
      getCompany(),
      getServices(),
      getMachines(),
      getFeaturedProjects(),
      getIndustries(),
      getMetrics(),
      getPillars(),
      getClients(),
      getCertificates(),
      getAboutContent(),
      getClientsPageContent(),
      getIndustriesPageContent(),
    ]);
  const category = (slug: string) => projectCategories.find((c) => c.slug === slug)?.label[locale] ?? slug;
  const serviceName = (slug: ServiceSlug) => services.find((s) => s.slug === slug)!.name[locale];

  return {
    locale,
    links: {
      quote: href(locale, "contact", { hash: "quote" }),
      about: href(locale, "about"),
      services: href(locale, "services"),
      projects: href(locale, "projects"),
      capabilities: href(locale, "capabilities"),
      clients: href(locale, "clients"),
      industries: href(locale, "industries"),
      certificates: href(locale, "certificates"),
    },

    hero: {
      eyebrow: home.hero.eyebrow[locale],
      headline: home.hero.headline[locale],
      sub: home.hero.sub[locale],
      primary: home.hero.secondaryCta[locale],
      secondary: home.hero.primaryCta[locale],
      location: home.hero.location[locale],
      image: image("site/laser-sparks", services[0].coverAlt[locale]),
      plate: { part: home.hero.plate.part[locale], sequence: home.hero.plate.sequence[locale] },
    },

    // Plain figures ("4", not an editorial "04").
    metrics: metricData.metrics.map((m) => ({
      slug: m.slug,
      value: m.value !== undefined ? m.value.toLocaleString("en-US") : m.display[locale],
      unit: m.unit?.[locale],
      label: m.label[locale],
    })),
    statements: metricData.statements.map((s) => ({ title: s.title[locale], body: s.body[locale] })),
    pillars: pillars.map((p) => ({ slug: p.slug, title: p.title[locale], body: p.body[locale] })),

    about: {
      label: home.intro.label[locale],
      statement: home.intro.statement[locale],
      paragraphs: home.intro.paragraphs[locale],
      link: home.intro.link[locale],
      workshop: image("services/fabrication-workshop", home.intro.workshopCaption[locale]),
      visionLabel: home.intro.visionLabel[locale],
      vision: company.vision.statement[locale],
      servicesLink: home.intro.servicesLink[locale],
      beyond: {
        label: about.beyond.label[locale],
        title: about.beyond.title[locale],
        items: about.beyond.items.map((item) => ({ slug: item.slug, label: item.label[locale] })),
        link: about.beyond.link[locale],
        href: href(locale, "service", { slug: "scaffolding" }),
      },
      whyLabel: home.why.label[locale],
    },

    services: {
      label: home.services.label[locale],
      title: home.services.title[locale],
      intro: home.services.intro[locale],
      open: home.services.open[locale],
      all: home.services.all[locale],
      items: services.map((s) => ({
        slug: s.slug,
        name: s.name[locale],
        tagline: s.tagline[locale],
        highlights: s.highlights[locale],
        href: href(locale, "service", { slug: s.slug }),
        // The engraving cover shows third-party branding and serial numbers, and its supporting image is a render:
        // both stay off featured spots.
        image: s.slug === "laser-engraving" ? undefined : image(s.cover, s.coverAlt[locale]),
        support: s.slug === "laser-engraving" ? undefined : image(s.supporting.media, s.supporting.alt[locale]),
      })),
    },

    machinery: {
      label: home.machinery.label[locale],
      title: home.machinery.title[locale],
      intro: home.machinery.intro[locale],
      power: home.machinery.power[locale],
      service: home.machinery.service[locale],
      all: home.machinery.all[locale],
      items: machines.map(
        (m): MachineItem => ({
          slug: m.slug,
          name: m.name[locale],
          shortName: m.shortName[locale],
          category: m.category[locale],
          capability: m.capability[locale],
          power: m.powerWatts ? { value: m.powerWatts.toLocaleString("en-US"), unit: locale === "ar" ? "واط" : "W" } : undefined,
          service: { name: serviceName(m.service), href: href(locale, "service", { slug: m.service }) },
          href: href(locale, "capabilities", { hash: m.slug }),
          image: image(m.media, m.name[locale]),
        }),
      ),
    },

    projects: {
      label: home.projects.label[locale],
      title: home.projects.title[locale],
      intro: home.projects.intro[locale],
      all: home.projects.all[locale],
      // Until the project pages (Stage 1F) exist, a card opens the Projects overview at its gallery, where every
      // showcased project is shown; the label says so.
      cta: home.projects.inGallery[locale],
      items: featured.map((p) => ({
        slug: p.slug,
        title: p.title[locale],
        categories: p.categories.slice(0, 2).map(category),
        href: href(locale, "projects", { hash: "gallery" }),
        image: image(projectImages(p)[0], p.title[locale]),
      })),
    },

    industries: {
      label: home.industries.label[locale],
      title: home.industries.title[locale],
      all: home.industries.all[locale],
      note: home.industries.note[locale],
      // `basis` keeps the company profile's own sectors apart from website classifications drawn from the work gallery.
      items: industries.map((i) => ({ slug: i.slug, name: i.name[locale], description: i.description[locale], basis: i.source.basis })),
      basis: { profile: industriesPage.basis.profile[locale], inferred: industriesPage.basis.inferred[locale] },
    },

    clients: {
      label: home.clients.label[locale],
      title: home.clients.title[locale],
      intro: home.clients.intro[locale],
      all: home.clients.all[locale],
      colours: clientsPage.colours[locale],
      note: clientsPage.note[locale],
      listLabel: clientsPage.listLabel[locale],
      items: clients.map((c) => ({ slug: c.slug, name: c.name[locale], logo: image(c.logo, c.name[locale]) })),
    },

    compliance: {
      label: home.certificates.label[locale],
      title: home.certificates.title[locale],
      note: home.certificates.note[locale],
      all: home.certificates.all[locale],
      items: certificates.map((c) => ({ slug: c.slug, title: c.title[locale], issuer: c.issuer[locale] })),
    },

    cta: {
      label: home.cta.label[locale],
      title: home.cta.title[locale],
      steps: home.cta.steps[locale],
      whatsapp: home.cta.whatsapp[locale],
      image: image("site/riyadh-night", ""),
    },
  };
}

export type HomeView = Awaited<ReturnType<typeof getHomeView>>;
