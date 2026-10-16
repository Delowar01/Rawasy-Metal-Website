import type { CSSProperties } from "react";
import { company, primaryWhatsApp, whatsappUrl } from "@/content/company";
import { getContactContent, getServices } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd, organizationJsonLd } from "@/lib/seo";
import { Icon } from "../Icon";
import { PageHero } from "../inner/PageHero";
import { ContactRow, breakableEmail, type ContactRowData } from "./ContactRows";
import { Location } from "./Location";
import { QuoteForm, type QuoteFormText } from "./QuoteForm";
import { quoteFormText } from "./quote-text";

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

/** Every way to reach RAWASY (company.ts, profile p.16): phones, WhatsApp, email, then the address (a jump to the map). */
export function contactRows(contact: string, labels: ContactRowLabels, locale: Locale): ContactRowData[] {
  return [
    ...company.phones.map(
      (phone): ContactRowData => ({
        icon: "phone",
        tone: "steel",
        label: labels.phone,
        value: phone.display,
        href: `tel:${phone.e164}`,
        action: labels.call,
        ltr: true,
      }),
    ),
    {
      icon: "chat",
      tone: "teal",
      label: labels.whatsapp,
      value: primaryWhatsApp.display,
      href: whatsappUrl(),
      action: labels.chat,
      external: true,
      ltr: true,
    },
    {
      icon: "mail",
      tone: "steel",
      label: labels.email,
      value: breakableEmail(company.email),
      href: `mailto:${company.email}`,
      action: labels.send,
      ltr: true,
    },
    {
      icon: "pin",
      tone: "brass",
      label: labels.address,
      value: company.address[locale].full,
      href: `${contact}#location`,
      action: labels.viewMap,
      down: true,
    },
  ];
}

/** The hero's actions: down to the quotation form, and to the map. */
export function ContactActions({ contact, quote, findUs }: { contact: string; quote: string; findUs: string }) {
  return (
    <>
      <a href={`${contact}#quote`} className="btn btn-primary btn-lg">
        {quote}
        <span className="cp-down">
          <Icon name="arrow" size={18} />
        </span>
      </a>
      <a href={`${contact}#location`} className="btn btn-secondary btn-lg">
        <Icon name="pin" size={18} />
        {findUs}
      </a>
    </>
  );
}

/** The hero's "Direct contact" card: the contact rows as actions. */
export function DirectContact({ title, rows, externalLabel }: { title: string; rows: ContactRowData[]; externalLabel: string }) {
  return (
    <div role="group" aria-labelledby="direct-contact" className="card cp-direct" data-reveal="fade" style={{ "--d": "120ms" } as CSSProperties}>
      <p id="direct-contact" className="cp-direct-title">
        {title}
      </p>
      <div className="cp-direct-rows">
        {rows.map((row) => (
          <ContactRow key={row.href} row={row} externalLabel={externalLabel} />
        ))}
      </div>
    </div>
  );
}

/**
 * The quote section (`#quote`): how a request works, the note that it is prepared for the visitor to send, and the form.
 * No reveal here: every quote action lands on it, and the form must be there at once.
 */
export function QuoteSection({
  head,
  text,
  privacyHref,
}: {
  head: { label: string; title: string; intro: string; stepsLabel: string; steps: string[]; status: string };
  text: QuoteFormText;
  privacyHref: string;
}) {
  return (
    <section id="quote" aria-labelledby="quote-title" className="sec sec-sheet sec-muted cp-quote">
      <div className="shell grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          {/* No reveal in this section: every quote action lands here, and the form must be there at once. */}
          <div className="cp-quote-intro">
            <p className="eyebrow">{head.label}</p>
            <h2 id="quote-title" className="t-h2 mt-4">
              {head.title}
            </h2>
            <p className="t-lead mt-4">{head.intro}</p>

            <div className="cp-steps">
              <p className="cp-label">{head.stepsLabel}</p>
              <ol>
                {head.steps.map((step, i) => (
                  <li key={i}>
                    <span aria-hidden className="step-num">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="cp-status">
              <Icon name="shield" size={18} />
              <span>{head.status}</span>
            </p>
          </div>
        </div>

        <div className="card cp-form lg:col-span-8">
          <QuoteForm text={text} email={company.email} whatsapp={whatsappUrl()} privacyHref={privacyHref} />
        </div>
      </div>
    </section>
  );
}

/**
 * Contact / request a quote in the Modern Commerce design (Stage TM-2.2). The hero sets the verified direct contact
 * details (company.ts, profile p.16) beside the page's title as actionable rows; the quote section follows on a sheet —
 * how it works, the no-backend note and the quotation form — and then the location with the Google map of the address.
 * Copy, contact data, the form's text and the map are those of the previous design's page, unchanged. The form has no
 * delivery backend: it prepares the request for the visitor to send from their own email app or WhatsApp, and says so.
 */
export async function ContactPage({ locale }: { locale: Locale }) {
  const [page, services] = await Promise.all([getContactContent(), getServices()]);
  const dict = getDictionary(locale);
  const { methods, form } = page;
  const contact = href(locale, "contact");

  const text = quoteFormText(locale, page, services);

  // Every way to reach RAWASY, in the homepage's contact-row language: phones, WhatsApp, email, then the address.
  const rows = contactRows(contact, {
    phone: methods.phone[locale],
    call: page.actions.call[locale],
    whatsapp: methods.whatsapp[locale],
    chat: methods.chat[locale],
    email: methods.email[locale],
    send: methods.send[locale],
    address: methods.address[locale],
    viewMap: methods.viewMap[locale],
  }, locale);

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      {innerPageJsonLd("contact", locale, "ContactPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <PageHero
        layout="split"
        breadcrumb={breadcrumbTrail("contact", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
        actions={<ContactActions contact={contact} quote={page.actions.quote[locale]} findUs={page.actions.findUs[locale]} />}
        aside={<DirectContact title={methods.label[locale]} rows={rows} externalLabel={dict.a11y.externalLink} />}
      />

      <QuoteSection
        head={{ label: form.label[locale], title: form.title[locale], intro: form.intro[locale], stepsLabel: methods.stepsLabel[locale], steps: form.steps[locale], status: form.status[locale] }}
        text={text}
        privacyHref={href(locale, "privacy")}
      />

      <Location
        locale={locale}
        text={{
          label: page.location.label[locale],
          title: page.location.title[locale],
          intro: page.location.intro[locale],
          address: methods.address[locale],
          name: methods.name[locale],
          contact: page.location.contact[locale],
          mapTitle: page.location.mapTitle[locale],
          mapCaption: page.location.mapCaption[locale],
          directions: page.location.directions[locale],
          openMap: page.location.openMap[locale],
          call: page.actions.call[locale],
          callLabel: methods.phone[locale],
          send: methods.send[locale],
          emailLabel: methods.email[locale],
          external: dict.a11y.externalLink,
        }}
      />
    </>
  );
}
