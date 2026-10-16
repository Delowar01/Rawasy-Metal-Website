import type { ReactNode } from "react";
import { getLegalDocument } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import type { ShellView } from "../data";
import { Icon, type IconName } from "../Icon";
import { ContentsNav } from "../inner/ContentsNav";
import { DocSection, PendingNote, Prose } from "../inner/Document";
import { PageHero } from "../inner/PageHero";

/** A legal page's date as the page shows it (day, month in words, year; Gregorian, Latin digits in Arabic too). */
export function legalDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** RAWASY's contact details inside a legal section (email, phones, address), as the company's current details give them. */
export function LegalContact({ contact, labels }: { contact: ShellView["contact"]; labels: { email: string; phone: string; address: string } }) {
  const contactItem = (icon: IconName, label: string, children: ReactNode) => (
    <div>
      <span className="icon-chip size-10 shrink-0" data-tone="steel">
        <Icon name={icon} size={18} />
      </span>
      <div className="grid min-w-0 gap-1">
        <p className="text-[0.8125rem] font-medium text-ink-2">{label}</p>
        {children}
      </div>
    </div>
  );
  return (
    <address className="ip-contact">
      {contactItem(
        "mail",
        labels.email,
        <a href={contact.emailHref} dir="ltr" className="w-fit">
          {contact.email}
        </a>,
      )}
      {contactItem(
        "phone",
        labels.phone,
        contact.phones.map((phone) => (
          <a key={phone.href} href={phone.href} dir="ltr" className="w-fit">
            {phone.display}
          </a>
        )),
      )}
      <div className="sm:col-span-2">
        <span className="icon-chip size-10 shrink-0" data-tone="steel">
          <Icon name="pin" size={18} />
        </span>
        <div className="grid min-w-0 gap-1">
          <p className="text-[0.8125rem] font-medium text-ink-2">{labels.address}</p>
          <p className="text-ink">{contact.address.full}</p>
        </div>
      </div>
    </address>
  );
}

/** The legal text's band: the contents beside the numbered sections on a card. */
export function LegalBand({ contents, sections }: { contents: string; sections: { id: string; title: string; body: ReactNode }[] }) {
  return (
    <div className="ip-band sec-sheet sec-muted">
      <div className="shell grid gap-6 py-[clamp(1.25rem,0.6rem+2.6vw,3.5rem)] lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4 xl:col-span-3">
          <ContentsNav label={contents} items={sections.map((s) => ({ id: s.id, title: s.title }))} />
        </div>
        <div className="ip-doc card lg:col-span-8 xl:col-span-9">
          {sections.map((section, i) => (
            <DocSection key={section.id} id={section.id} index={i} title={section.title}>
              {section.body}
            </DocSection>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The privacy policy or the website terms in the Modern Commerce design: the page hero with the last-updated date,
 * the contents beside the text, and the numbered sections on a card — every section, anchor, pending-confirmation
 * note and contact detail of the legal content, unchanged (src/content/legal.ts).
 */
export async function LegalPage({ slug, locale, shell }: { slug: "privacy" | "terms"; locale: Locale; shell: ShellView }) {
  const { document, chrome } = await getLegalDocument(slug);
  const dict = getDictionary(locale);
  const { contact } = shell;

  const details = (
    <LegalContact contact={contact} labels={{ email: chrome.contactLabels.email[locale], phone: chrome.contactLabels.phone[locale], address: chrome.contactLabels.address[locale] }} />
  );

  return (
    <>
      {innerPageJsonLd(slug, locale, "WebPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <PageHero
        breadcrumb={breadcrumbTrail(slug, locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={document.hero.eyebrow[locale]}
        tone="steel"
        title={document.hero.title[locale]}
        intro={document.hero.intro[locale]}
        facts={[
          { label: chrome.updated[locale], value: <time dateTime={document.updated}>{legalDate(document.updated, locale)}</time> },
          { label: chrome.appliesTo[locale], value: chrome.appliesToValue[locale] },
        ]}
      />

      <LegalBand
        contents={chrome.onThisPage[locale]}
        sections={document.sections.map((section) => {
          const pending = section.pending?.[locale];
          return {
            id: section.id,
            title: section.title[locale],
            body: (
              <>
                <Prose blocks={section.body[locale]} />
                {section.contact && details}
                {pending && <PendingNote label={chrome.pending[locale]}>{pending}</PendingNote>}
              </>
            ),
          };
        })}
      />
    </>
  );
}
