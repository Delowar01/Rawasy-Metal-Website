import { whatsappUrl } from "@/content/company";
import { getMedia, type MediaAsset } from "@/content/media";
import type { MediaId } from "@/content/media.generated";
import { footerNav, headerNav, legalNav } from "@/content/navigation";
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
import { localeConfig, otherLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { labCopy, labOptions, type LabOption } from "./options";

/*
 * Everything the Modern Commerce previews (A, A V2, B, C) show, drawn from the
 * existing content layer — no new copy, figures or claims. Links point to the
 * current website's pages. Flagged photos stay out: the laser-engraving cover
 * (third-party branding and serial numbers) is replaced by an illustration.
 */

export type LabImage = MediaAsset & { alt: string };

const image = (id: MediaId, alt: string): LabImage => ({ ...getMedia(id), alt });

/** Section anchors of the homepage previews, in page order. */
export const sectionIds = {
  about: "about",
  services: "services",
  machinery: "machinery",
  projects: "projects",
  clients: "clients",
  contact: "contact",
} as const;

export async function getLabData(locale: Locale, option: LabOption) {
  const [home, company, services, machines, featured, industries, metricData, pillars, clients, certificates, about, clientsPage, industriesPage] = await Promise.all([
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
  const dict = getDictionary(locale);
  const category = (slug: string) => projectCategories.find((c) => c.slug === slug)?.label[locale] ?? slug;
  const serviceName = (slug: ServiceSlug) => services.find((s) => s.slug === slug)!.name[locale];
  const other = otherLocale(locale);
  const [phone, phone2] = company.phones;
  const navRoute = (route: string) => headerNav.find((item) => item.route === route)!.label[locale];
  const copy = labCopy[locale];
  const slug = (key: LabOption) => labOptions.find((o) => o.key === key)!.slug;

  return {
    locale,
    dir: localeConfig[locale].dir,
    option,
    lab: {
      ...copy,
      options: labOptions.map(({ key, short }) => ({
        key,
        short,
        name: copy.optionNames[key],
        href: `/theme-lab/${locale}/${slug(key)}`,
      })),
      homeHref: `/theme-lab/${locale}/${slug(option)}`,
      systemHref: `/theme-lab/${locale}/${slug(option)}/system`,
      switchHref: (path: string) => path.replace(`/theme-lab/${locale}/`, `/theme-lab/${other}/`),
      otherLocale: other,
      otherLabel: other === "ar" ? "العربية" : "English",
    },

    nav: [
      { id: sectionIds.about, label: navRoute("about") },
      { id: sectionIds.services, label: navRoute("services") },
      { id: sectionIds.machinery, label: navRoute("capabilities") },
      { id: sectionIds.projects, label: navRoute("projects") },
      { id: sectionIds.clients, label: navRoute("clients") },
      { id: sectionIds.contact, label: navRoute("contact") },
    ],
    /** A V2: every main page of the site, as sections of the homepage preview. */
    navFull: [
      { id: "home", label: navRoute("home") },
      { id: sectionIds.about, label: navRoute("about") },
      { id: sectionIds.services, label: navRoute("services") },
      { id: sectionIds.machinery, label: navRoute("capabilities") },
      { id: sectionIds.projects, label: navRoute("projects") },
      { id: "industries", label: navRoute("industries") },
      { id: sectionIds.clients, label: navRoute("clients") },
      { id: sectionIds.contact, label: navRoute("contact") },
    ],
    ui: {
      skip: dict.a11y.skipToContent,
      getQuote: dict.controls.getQuote,
      requestQuote: dict.controls.requestQuote,
      menu: dict.controls.menu,
      close: dict.controls.close,
      theme: dict.controls.theme,
      light: dict.controls.light,
      dark: dict.controls.dark,
      language: dict.controls.language,
      mainNav: dict.a11y.mainNav,
      mobileNav: dict.a11y.mobileNav,
      openMenu: dict.a11y.openMenu,
      homeLink: dict.a11y.homeLink,
      languageSwitch: dict.a11y.languageSwitch,
      call: dict.common.call,
      email: dict.common.email,
      whatsapp: dict.common.whatsapp,
      address: dict.common.address,
      phone: dict.common.phone,
      backToTop: dict.common.backToTop,
      closeMenu: dict.a11y.closeMenu,
    },
    links: {
      quote: href(locale, "contact"),
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
    },

    // Plain figures ("4", not the editorial "04").
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
      capabilitiesLabel: home.intro.capabilitiesLabel[locale],
      statement: home.intro.statement[locale],
      paragraphs: home.intro.paragraphs[locale],
      link: home.intro.link[locale],
      workshop: image("services/fabrication-workshop", home.intro.workshopCaption[locale]),
      detail: image("services/fabrication-cut-sheets", home.intro.workshopDetailAlt[locale]),
      beams: (() => {
        const beams = services[0].gallery.find((g) => g.media === "projects/perforated-beams-1")!;
        return image(beams.media, beams.caption[locale]);
      })(),
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
        index: s.index,
        name: s.name[locale],
        tagline: s.tagline[locale],
        summary: s.summary[locale],
        highlights: s.highlights[locale],
        href: href(locale, "service", { slug: s.slug }),
        // The engraving cover shows third-party branding and serial numbers, and its supporting image is a
        // render: both stay off featured spots.
        image: s.slug === "laser-engraving" ? undefined : image(s.cover, s.coverAlt[locale]),
        support: s.slug === "laser-engraving" ? undefined : image(s.supporting.media, s.supporting.alt[locale]),
        gallery: s.gallery.map((g) => image(g.media, g.caption[locale])),
      })),
    },

    machinery: {
      label: home.machinery.label[locale],
      title: home.machinery.title[locale],
      intro: home.machinery.intro[locale],
      power: home.machinery.power[locale],
      usedFor: home.machinery.usedFor[locale],
      service: home.machinery.service[locale],
      all: home.machinery.all[locale],
      notStated: home.machinery.notStated[locale],
      items: machines.map((m) => ({
        slug: m.slug,
        name: m.name[locale],
        shortName: m.shortName[locale],
        category: m.category[locale],
        capability: m.capability[locale],
        power: m.powerWatts ? { value: m.powerWatts.toLocaleString("en-US"), unit: locale === "ar" ? "واط" : "W" } : undefined,
        service: { name: serviceName(m.service), href: href(locale, "service", { slug: m.service }) },
        href: href(locale, "capabilities", { hash: m.slug }),
        image: image(m.media, m.name[locale]),
      })),
    },

    projects: {
      label: home.projects.label[locale],
      title: home.projects.title[locale],
      intro: home.projects.intro[locale],
      all: home.projects.all[locale],
      view: home.projects.view[locale],
      items: featured.map((p) => ({
        slug: p.slug,
        title: p.title[locale],
        summary: p.summary[locale],
        categories: p.categories.slice(0, 2).map(category),
        href: href(locale, "project", { slug: p.slug }),
        image: image(projectImages(p)[0], p.title[locale]),
      })),
    },

    industries: {
      label: home.industries.label[locale],
      title: home.industries.title[locale],
      all: home.industries.all[locale],
      note: home.industries.note[locale],
      // `basis` keeps the profile's own sectors apart from website classifications drawn from the work gallery.
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
      items: clients.map((c) => ({
        slug: c.slug,
        name: c.name[locale],
        logo: image(c.logo, c.name[locale]),
        mono: image(c.logoMono, c.name[locale]),
      })),
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
      primary: home.cta.primary[locale],
      whatsapp: home.cta.whatsapp[locale],
      image: image("site/riyadh-night", ""),
    },

    contact: {
      phones: [phone, phone2].map((p) => ({ display: p.display, href: `tel:${p.e164}` })),
      email: company.email,
      emailHref: `mailto:${company.email}`,
      whatsappHref: whatsappUrl(),
      address: company.address[locale],
      city: company.city[locale],
    },

    footer: {
      statement: dict.footer.statement,
      companyStatement: company.statement[locale],
      legalName: company.legalName[locale],
      brand: company.brandName[locale],
      servicesTitle: dict.footer.services,
      contactTitle: dict.footer.contact,
      legalTitle: dict.footer.legal,
      rights: dict.footer.rights,
      company: {
        title: footerNav[0].title[locale],
        links: footerNav[0].items.map((item) => ({ label: item.label[locale], href: href(locale, item.route) })),
      },
      legal: legalNav.map((item) => ({ label: item.label[locale], href: href(locale, item.route) })),
    },
  };
}

export type LabData = Awaited<ReturnType<typeof getLabData>>;
