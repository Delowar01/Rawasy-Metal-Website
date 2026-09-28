import { whatsappUrl } from "@/content/company";
import { footerNav, headerNav, legalNav } from "@/content/navigation";
import { getCompany, getHomeContent, getServices } from "@/content/repository";
import { localeConfig, otherLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, switchLocalePath, type RouteKey } from "@/i18n/routes";

/*
 * What the Modern Commerce shell (header, phone menu, footer) shows on every migrated page: the website's real,
 * localized routes, the company's contact details and the interface strings — all from the content layer and the
 * dictionaries (no new copy, figures or claims).
 */

/** Page colour of each theme, for the browser interface (viewport theme-color and the theme switch). */
export const PAGE_COLORS = { light: "#f4f4f1", dark: "#131820" } as const;

export async function getShellView(locale: Locale, page: { route: RouteKey; path: string }) {
  const [company, services, home] = await Promise.all([getCompany(), getServices(), getHomeContent()]);
  const dict = getDictionary(locale);
  const other = otherLocale(locale);
  const phones = company.phones.map((p) => ({ display: p.display, href: `tel:${p.e164}` }));
  const self = `/${locale}${page.path === "/" ? "" : page.path}`;

  return {
    locale,
    current: page.route,
    /** This page, and the same page in the other language (every route exists in both). */
    self,
    alternate: { locale: other, href: switchLocalePath(self, other), htmlLang: localeConfig[other].htmlLang },
    nav: headerNav.map((item) => ({ key: item.route, label: item.label[locale], href: href(locale, item.route) })),
    services: {
      all: home.services.all[locale],
      items: services.map((s) => ({ slug: s.slug, name: s.name[locale], tagline: s.tagline[locale], href: href(locale, "service", { slug: s.slug }) })),
    },
    links: {
      home: href(locale, "home"),
      // Every quote action opens the quotation form on the contact page.
      quote: href(locale, "contact", { hash: "quote" }),
      services: href(locale, "services"),
    },
    ui: {
      skip: dict.a11y.skipToContent,
      getQuote: dict.controls.getQuote,
      requestQuote: dict.controls.requestQuote,
      theme: dict.controls.theme,
      light: dict.controls.light,
      dark: dict.controls.dark,
      language: dict.controls.language,
      mainNav: dict.a11y.mainNav,
      mobileNav: dict.a11y.mobileNav,
      footerNav: dict.a11y.footerNav,
      openMenu: dict.a11y.openMenu,
      homeLink: dict.a11y.homeLink,
      languageSwitch: dict.a11y.languageSwitch,
      call: dict.common.call,
      email: dict.common.email,
      whatsapp: dict.common.whatsapp,
      address: dict.common.address,
      phone: dict.common.phone,
      backToTop: dict.common.backToTop,
    },
    contact: {
      phones,
      email: company.email,
      emailHref: `mailto:${company.email}`,
      whatsappHref: whatsappUrl(),
      address: company.address[locale],
    },
    footer: {
      companyStatement: company.statement[locale],
      legalName: company.legalName[locale],
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

export type ShellView = Awaited<ReturnType<typeof getShellView>>;
