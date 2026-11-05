/**
 * The site's working copy as the preview's blocks read it (A6.6): the company facts (`CompanyInfo`), the interface
 * strings (`Dictionary`), the WhatsApp link and the map's search, laid over today's values where a working copy is set
 * up (`src/server/site/working.ts`). The approved components draw them unchanged: where a component reads the company
 * itself on the website (the Contact page's location card, map and quote form), the preview hands it the working copy
 * through the component's optional input (`place`, `reach`), which the website never passes.
 */
import type { ContactRowData } from "@/components/commerce/contact/ContactRows";
import { breakableEmail } from "@/components/commerce/contact/ContactRows";
import type { LocationPlace } from "@/components/commerce/contact/Location";
import { company as staticCompany, whatsappUrl } from "@/content/company";
import type { CompanyInfo } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { mapLinksFor } from "@/lib/maps";
import { workingCompany, workingDictionary, workingMap, workingWhatsappHref, workingWhatsappPhone, type WorkingSite } from "@/server/site/working";

export interface SiteView {
  company: CompanyInfo;
  dict: Dictionary;
  whatsappHref: string;
  /** The number the WhatsApp link opens, as shown. */
  whatsappDisplay: string;
  /**
   * The map: the address text it searches (today's: the English address) and RAWASY's own Google Maps place link (empty
   * until RAWASY confirms one; when set, "Open in Google Maps" opens it).
   */
  map: { query: string; placeUrl: string };
}

export function siteViewOf(site: WorkingSite, locale: Locale): SiteView {
  const company = workingCompany(staticCompany, site);
  // The link and the number shown beside it come from one choice (today's primary number when nothing is set up).
  const whatsapp = workingWhatsappPhone(site) ?? staticCompany.phones.find((p) => p.whatsapp) ?? staticCompany.phones[0];
  return {
    company,
    dict: workingDictionary(getDictionary(locale), site, locale),
    whatsappHref: workingWhatsappHref(site, whatsappUrl()),
    whatsappDisplay: whatsapp?.display ?? "",
    map: workingMap(site, staticCompany),
  };
}

/**
 * The Contact page's location card and map (`Location`) from the working copy: the address in the language, both
 * registered names, the first shown phone, the email, and the map's links built as today's (`mapLinksFor`) from the
 * working search; "Open in Google Maps" opens the place link when one is set. Nothing set up: today's facts exactly.
 */
export function workingPlace(site: SiteView, locale: Locale): LocationPlace {
  const { company } = site;
  const links = mapLinksFor(site.map.query);
  return {
    lines: company.address[locale].lines,
    full: company.address[locale].full,
    legalName: company.legalName,
    phone: company.phones[0] ?? staticCompany.phones[0],
    email: company.email,
    map: { embed: links.embed(locale), directions: links.directions, search: site.map.placeUrl || links.search },
  };
}

/** Where the quote form's prepared request goes in the preview: the working email address and WhatsApp link. */
export const workingReach = (site: SiteView) => ({ email: site.company.email, whatsapp: site.whatsappHref });

export interface ContactRowLabels {
  phone: string;
  call: string;
  whatsapp: string;
  chat: string;
  email: string;
  send: string;
  address: string;
  viewMap: string;
}

/** The Contact page's direct-contact rows (as `contactRows` in ContactPage.tsx builds them) from the working company. */
export function workingContactRows(site: SiteView, contact: string, labels: ContactRowLabels, locale: Locale): ContactRowData[] {
  const { company } = site;
  return [
    ...company.phones.map((phone): ContactRowData => ({ icon: "phone", tone: "steel", label: labels.phone, value: phone.display, href: `tel:${phone.e164}`, action: labels.call, ltr: true })),
    { icon: "chat", tone: "teal", label: labels.whatsapp, value: site.whatsappDisplay, href: site.whatsappHref, action: labels.chat, external: true, ltr: true },
    { icon: "mail", tone: "steel", label: labels.email, value: breakableEmail(company.email), href: `mailto:${company.email}`, action: labels.send, ltr: true },
    { icon: "pin", tone: "brass", label: labels.address, value: company.address[locale].full, href: `${contact}#location`, action: labels.viewMap, down: true },
  ];
}
