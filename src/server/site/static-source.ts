/**
 * Today's website, as the public pages read it (T1 = Option B: `src/content/*`, `src/i18n/dictionaries.ts`), in the
 * shapes of the A6 working copies: what the admin's set-up actions copy (never rewritten) and what the preview shows
 * wherever a working copy is not set up. Every value comes from those files; nothing here is new copy or a new fact.
 * The files hold only type imports, so the Node-run tests and tools load this module as well as Next.js.
 */
import { company } from "../../content/company.ts";
import { home } from "../../content/home.ts";
import { footerNav, headerNav, legalNav } from "../../content/navigation.ts";
import { projects } from "../../content/projects.ts";
import { siteName } from "../../content/seo.ts";
import { services } from "../../content/services.ts";
import { getDictionary } from "../../i18n/dictionaries.ts";
import { LOCALES, SERVICES_COLLECTION, UI_STRINGS, type Locale, type MenuSlotKey, type SiteRouteKey } from "./registry.ts";

export const staticCompany = company;

export interface SettingsTexts {
  siteName: string;
  legalName: string;
  brandName: string;
  statement: string;
  addressLines: string[];
  addressFull: string;
  streetAddress: string;
  city: string;
  country: string;
  visionStatement: string;
  visionAims: string[];
  visionClosing: string;
  defaultSeoDescription: string;
}

export interface SettingsValues {
  websiteUrl: string;
  email: string;
  postalCode: string;
  geoLat: string;
  geoLng: string;
  geoIsApproximate: boolean;
  facebookUrl: string;
  mapsPlaceUrl: string;
  mapsQuery: string;
  phones: { display: string; e164: string; hasWhatsapp: boolean; isVisible: boolean }[];
  texts: Record<Locale, SettingsTexts>;
}

/**
 * The company settings as today's website shows them. The structured data's street address is the address's first line
 * (`src/lib/seo.tsx`); the map's search is the English address (`src/lib/maps.ts`); no site-wide SEO description exists
 * today (every page has its own), so that field starts empty, and so does RAWASY's own map link (pending).
 */
export function staticSettings(): SettingsValues {
  const texts = (locale: Locale): SettingsTexts => ({
    siteName: siteName[locale],
    legalName: company.legalName[locale],
    brandName: company.brandName[locale],
    statement: company.statement[locale],
    addressLines: [...company.address[locale].lines],
    addressFull: company.address[locale].full,
    streetAddress: company.address[locale].lines[0] ?? "",
    city: company.city[locale],
    country: company.country[locale],
    visionStatement: company.vision.statement[locale],
    visionAims: [...company.vision.aims[locale]],
    visionClosing: company.vision.closing[locale],
    defaultSeoDescription: "",
  });
  return {
    websiteUrl: company.website,
    email: company.email,
    postalCode: company.postalCode ?? "",
    geoLat: company.geo ? String(company.geo.lat) : "",
    geoLng: company.geo ? String(company.geo.lng) : "",
    geoIsApproximate: company.geo?.approximate ?? true,
    facebookUrl: company.social.facebook ?? "",
    mapsPlaceUrl: "",
    mapsQuery: company.address.en.full,
    phones: company.phones.map((p) => ({ display: p.display, e164: p.e164, hasWhatsapp: p.whatsapp, isVisible: true })),
    texts: { en: texts("en"), ar: texts("ar") },
  };
}

export interface StaticMenuItem {
  linkType: "route" | "collection";
  route: SiteRouteKey | null;
  collection: string | null;
  label: Record<Locale, string> | null;
}

/** The design's menus as today's shell draws them (navigation.ts, and the homepage's "All services" label). */
export function staticMenus(): Record<MenuSlotKey, StaticMenuItem[]> {
  const route = (r: string, label: Record<Locale, string>): StaticMenuItem => ({ linkType: "route", route: r as SiteRouteKey, collection: null, label: { en: label.en, ar: label.ar } });
  return {
    header_main: headerNav.map((item) => route(item.route, item.label)),
    header_services: [
      { linkType: "collection", route: null, collection: SERVICES_COLLECTION, label: null },
      route("services", home.services.all),
    ],
    footer_company: footerNav[0].items.map((item) => route(item.route, item.label)),
    footer_legal: legalNav.map((item) => route(item.route, item.label)),
  };
}

/** Today's interface text: the dictionaries' values, and the footer company column's title (navigation.ts). */
export function staticUiText(key: string, locale: Locale): string | null {
  if (key === "navigation.footerCompanyTitle") return footerNav[0].title[locale];
  const [group, name] = key.split(".");
  const dict = getDictionary(locale) as unknown as Record<string, Record<string, string> | undefined>;
  const value = dict[group]?.[name];
  return typeof value === "string" ? value : null;
}

/** Every registered key's text today, by language. */
export function staticUiTexts(): Record<string, Record<Locale, string>> {
  const out: Record<string, Record<Locale, string>> = {};
  for (const def of UI_STRINGS) {
    const en = staticUiText(def.key, "en");
    const ar = staticUiText(def.key, "ar");
    if (en === null || ar === null) throw new Error(`Interface text ${def.key} has no text in the dictionary.`);
    out[def.key] = { en, ar };
  }
  return out;
}

/** The live services' and projects' addresses today (the static release: the redirect checks' "a page answers it"). */
export const staticServiceSlugs = (): ReadonlySet<string> => new Set(services.map((s) => s.slug));
export const staticProjectSlugs = (): ReadonlySet<string> => new Set(projects.map((p) => p.slug));

export { LOCALES };
