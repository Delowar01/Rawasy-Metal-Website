/**
 * The site's working copy as the preview's blocks read it (A6.6): the company facts (`CompanyInfo`), the interface
 * strings (`Dictionary`) and the WhatsApp link, laid over today's values where a working copy is set up
 * (`src/server/site/working.ts`). The approved components keep reading what they read today; where a component reads the
 * company itself (the Contact page's map and quote form), the preview shows today's values, said so in its notes.
 */
import type { ContactRowData } from "@/components/commerce/contact/ContactRows";
import { breakableEmail } from "@/components/commerce/contact/ContactRows";
import { company as staticCompany, whatsappUrl } from "@/content/company";
import type { CompanyInfo } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { workingCompany, workingDictionary, workingWhatsappHref, type WorkingSite } from "@/server/site/working";

export interface SiteView {
  company: CompanyInfo;
  dict: Dictionary;
  whatsappHref: string;
  /** The number the WhatsApp link opens, as shown. */
  whatsappDisplay: string;
}

export function siteViewOf(site: WorkingSite, locale: Locale): SiteView {
  const company = workingCompany(staticCompany, site);
  const whatsapp = company.phones.find((p) => p.whatsapp) ?? company.phones[0];
  return { company, dict: workingDictionary(getDictionary(locale), site, locale), whatsappHref: workingWhatsappHref(site, whatsappUrl()), whatsappDisplay: whatsapp?.display ?? "" };
}

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
