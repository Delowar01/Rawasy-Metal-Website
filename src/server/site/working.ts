/**
 * The site's working copy as the admin preview shows it (A6.6): the settings, menus, interface text and theme read in
 * one go, and pure functions that lay them over today's values in the very shapes the approved components take — the
 * shell (`ShellView`, built by today's `getShellView`), the company facts (`CompanyInfo`) and the interface strings
 * (`Dictionary`). Wherever a part is not set up, today's value stays: the preview shows the working copy where one
 * exists and today's website elsewhere. The public website never reads this (T1 = Option B): `getShellView`, the
 * content files and the dictionaries are unchanged, and only the preview calls these functions.
 */
import type { ShellView } from "@/components/commerce/data";
import type { CompanyInfo } from "../../content/types.ts";
import type { Dictionary } from "../../i18n/dictionaries.ts";
import type { Db } from "../db/client.ts";
import { readMenus, type MenuModel } from "./menus.ts";
import { routePath, type Locale, type MenuSlotKey } from "./registry.ts";
import { readSettings, type SettingsModel } from "./settings.ts";
import { readTheme, type ThemeModel } from "./theme.ts";
import { readUiValues } from "./ui-text.ts";

export interface WorkingSite {
  settings: SettingsModel;
  menus: MenuModel[];
  ui: Map<string, Partial<Record<Locale, string>>>;
  theme: ThemeModel;
}

export async function readWorkingSite(db: Db): Promise<WorkingSite> {
  const [settings, menus, ui, theme] = await Promise.all([readSettings(db), readMenus(db), readUiValues(db), readTheme(db)]);
  return { settings, menus, ui, theme };
}

/** The working value of an interface text in a language, or today's. */
export const uiValue = (site: WorkingSite, key: string, locale: Locale, today: string) => site.ui.get(key)?.[locale] ?? today;

/** The WhatsApp link of the working copy (today's form: `https://wa.me/<number>`), or today's. */
export function workingWhatsappHref(site: WorkingSite, today: string): string {
  if (!site.settings.setUp) return today;
  const phone = site.settings.values.phones.find((p) => p.id === site.settings.primaryWhatsappPhoneId) ?? site.settings.values.phones.find((p) => p.isVisible && p.hasWhatsapp);
  return phone ? `https://wa.me/${phone.e164.replace("+", "")}` : today;
}

/** Today's company facts with the working settings laid over them (when set up). */
export function workingCompany(base: CompanyInfo, site: WorkingSite): CompanyInfo {
  const s = site.settings;
  if (!s.setUp) return base;
  const v = s.values;
  const both = <T>(pick: (locale: Locale) => T) => ({ en: pick("en"), ar: pick("ar") });
  const lat = Number(v.geoLat);
  const lng = Number(v.geoLng);
  return {
    legalName: both((l) => v.texts[l].legalName),
    brandName: both((l) => v.texts[l].brandName),
    statement: both((l) => v.texts[l].statement),
    address: both((l) => ({ lines: [...v.texts[l].addressLines], full: v.texts[l].addressFull })),
    city: both((l) => v.texts[l].city),
    country: both((l) => v.texts[l].country),
    postalCode: v.postalCode,
    geo: v.geoLat && v.geoLng && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, approximate: true } : base.geo,
    phones: v.phones.filter((p) => p.isVisible).map((p) => ({ display: p.display, e164: p.e164, whatsapp: p.hasWhatsapp })),
    email: v.email,
    website: v.websiteUrl,
    social: { facebook: v.facebookUrl },
    vision: {
      statement: both((l) => v.texts[l].visionStatement),
      aims: both((l) => [...v.texts[l].visionAims]),
      closing: both((l) => v.texts[l].visionClosing),
    },
  };
}

/** Today's interface strings with the working values laid over them (key by key). */
export function workingDictionary(base: Dictionary, site: WorkingSite, locale: Locale): Dictionary {
  const out = structuredClone(base) as unknown as Record<string, Record<string, string>>;
  for (const [key, values] of site.ui) {
    const [group, name] = key.split(".");
    const value = values[locale];
    if (value !== undefined && out[group] && typeof out[group][name] === "string") out[group][name] = value;
  }
  return out as unknown as Dictionary;
}

/** The shell's interface fields and the keys they read (the same fields `getShellView` fills from the dictionary). */
const SHELL_UI: Record<keyof ShellView["ui"], string> = {
  skip: "a11y.skipToContent",
  getQuote: "controls.getQuote",
  requestQuote: "controls.requestQuote",
  theme: "controls.theme",
  light: "controls.light",
  dark: "controls.dark",
  language: "controls.language",
  mainNav: "a11y.mainNav",
  mobileNav: "a11y.mobileNav",
  footerNav: "a11y.footerNav",
  openMenu: "a11y.openMenu",
  homeLink: "a11y.homeLink",
  languageSwitch: "a11y.languageSwitch",
  call: "common.call",
  email: "common.email",
  whatsapp: "common.whatsapp",
  address: "common.address",
  phone: "common.phone",
  backToTop: "common.backToTop",
};

const menuOf = (site: WorkingSite, key: MenuSlotKey) => {
  const menu = site.menus.find((m) => m.key === key);
  return menu && menu.setUp ? menu : null;
};

/** The shown route items of a set-up slot as the shell's links, or null (not set up: today's links stay). */
function linksOf(site: WorkingSite, key: MenuSlotKey, locale: Locale) {
  const menu = menuOf(site, key);
  if (!menu) return null;
  return menu.items
    .filter((item) => item.isVisible && item.linkType === "route" && item.route)
    .map((item) => ({ key: item.route!, label: item.label?.[locale] ?? "", href: routePath(locale, item.route!) }));
}

/**
 * Today's shell (from `getShellView`) with the working copy laid over it: the header and footer menus, the "every
 * service" label, the interface strings, the contact details, the company statement and legal name. The Services list
 * stays today's live services (until A8 publishes and A9 switches the source, A6 report item 2).
 */
export function overlayShell(base: ShellView, site: WorkingSite, locale: Locale): ShellView {
  const ui = { ...base.ui };
  for (const field of Object.keys(SHELL_UI) as (keyof ShellView["ui"])[]) ui[field] = uiValue(site, SHELL_UI[field], locale, base.ui[field]);
  const nav = linksOf(site, "header_main", locale);
  const servicesMenu = menuOf(site, "header_services");
  const all = servicesMenu?.items.find((i) => i.linkType === "route")?.label?.[locale];
  const company = linksOf(site, "footer_company", locale);
  const legal = linksOf(site, "footer_legal", locale);
  const s = site.settings;
  const contact = s.setUp
    ? {
        phones: s.values.phones.filter((p) => p.isVisible).map((p) => ({ display: p.display, href: `tel:${p.e164}` })),
        email: s.values.email,
        emailHref: `mailto:${s.values.email}`,
        whatsappHref: workingWhatsappHref(site, base.contact.whatsappHref),
        address: { lines: [...s.values.texts[locale].addressLines], full: s.values.texts[locale].addressFull },
      }
    : base.contact;
  return {
    ...base,
    nav: nav ?? base.nav,
    services: { ...base.services, all: all ?? base.services.all },
    ui,
    contact,
    footer: {
      ...base.footer,
      companyStatement: s.setUp ? s.values.texts[locale].statement : base.footer.companyStatement,
      legalName: s.setUp ? s.values.texts[locale].legalName : base.footer.legalName,
      servicesTitle: uiValue(site, "footer.services", locale, base.footer.servicesTitle),
      contactTitle: uiValue(site, "footer.contact", locale, base.footer.contactTitle),
      legalTitle: uiValue(site, "footer.legal", locale, base.footer.legalTitle),
      rights: uiValue(site, "footer.rights", locale, base.footer.rights),
      company: { title: uiValue(site, "navigation.footerCompanyTitle", locale, base.footer.company.title), links: company ?? base.footer.company.links },
      legal: legal ?? base.footer.legal,
    },
  };
}
