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

  const text: QuoteFormText = {
    requiredNote: form.requiredNote[locale],
    groups: { details: form.groups.details[locale], project: form.groups.project[locale], message: form.groups.message[locale] },
    noscript: form.noscript[locale],
    fields: Object.fromEntries(
      Object.entries(form.fields).map(([name, field]) => [
        name,
        { label: field.label[locale], hint: field.hint?.[locale], placeholder: field.placeholder?.[locale] },
      ]),
    ) as QuoteFormText["fields"],
    services: [
      ...services.map((s) => ({ value: s.slug, label: s.name[locale] })),
      { value: "not-sure", label: form.serviceOther[locale] },
    ],
    projectTypes: form.projectTypes.map((t) => ({ value: t.value, label: t.label[locale] })),
    files: {
      accept: form.files.accept,
      maxFiles: form.files.maxFiles,
      maxSizeMb: form.files.maxSizeMb,
      choose: form.files.choose[locale],
      drop: form.files.drop[locale],
      remove: form.files.remove[locale],
      note: form.files.note[locale],
      units: { kb: form.files.units.kb[locale], mb: form.files.units.mb[locale] },
    },
    submit: form.submit[locale],
    errors: Object.fromEntries(Object.entries(form.errors).map(([k, v]) => [k, v[locale]])) as QuoteFormText["errors"],
    ready: Object.fromEntries(Object.entries(form.ready).map(([k, v]) => [k, v[locale]])) as QuoteFormText["ready"],
    privacy: { text: form.privacy.text[locale], link: form.privacy.link[locale] },
  };

  // Every way to reach RAWASY, in the homepage's contact-row language: phones, WhatsApp, email, then the address.
  const rows: ContactRowData[] = [
    ...company.phones.map(
      (phone): ContactRowData => ({
        icon: "phone",
        tone: "steel",
        label: methods.phone[locale],
        value: phone.display,
        href: `tel:${phone.e164}`,
        action: page.actions.call[locale],
        ltr: true,
      }),
    ),
    {
      icon: "chat",
      tone: "teal",
      label: methods.whatsapp[locale],
      value: primaryWhatsApp.display,
      href: whatsappUrl(),
      action: methods.chat[locale],
      external: true,
      ltr: true,
    },
    {
      icon: "mail",
      tone: "steel",
      label: methods.email[locale],
      value: breakableEmail(company.email),
      href: `mailto:${company.email}`,
      action: methods.send[locale],
      ltr: true,
    },
    {
      icon: "pin",
      tone: "brass",
      label: methods.address[locale],
      value: company.address[locale].full,
      href: `${contact}#location`,
      action: methods.viewMap[locale],
      down: true,
    },
  ];

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
        actions={
          <>
            <a href={`${contact}#quote`} className="btn btn-primary btn-lg">
              {page.actions.quote[locale]}
              <span className="cp-down">
                <Icon name="arrow" size={18} />
              </span>
            </a>
            <a href={`${contact}#location`} className="btn btn-secondary btn-lg">
              <Icon name="pin" size={18} />
              {page.actions.findUs[locale]}
            </a>
          </>
        }
        aside={
          <div
            role="group"
            aria-labelledby="direct-contact"
            className="card cp-direct"
            data-reveal="fade"
            style={{ "--d": "120ms" } as CSSProperties}
          >
            <p id="direct-contact" className="cp-direct-title">
              {methods.label[locale]}
            </p>
            <div className="cp-direct-rows">
              {rows.map((row) => (
                <ContactRow key={row.href} row={row} externalLabel={dict.a11y.externalLink} />
              ))}
            </div>
          </div>
        }
      />

      <section id="quote" aria-labelledby="quote-title" className="sec sec-sheet sec-muted cp-quote">
        <div className="shell grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            {/* No reveal in this section: every quote action lands here, and the form must be there at once. */}
            <div className="cp-quote-intro">
              <p className="eyebrow">{form.label[locale]}</p>
              <h2 id="quote-title" className="t-h2 mt-4">
                {form.title[locale]}
              </h2>
              <p className="t-lead mt-4">{form.intro[locale]}</p>

              <div className="cp-steps">
                <p className="cp-label">{methods.stepsLabel[locale]}</p>
                <ol>
                  {form.steps[locale].map((step, i) => (
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
                <span>{form.status[locale]}</span>
              </p>
            </div>
          </div>

          <div className="card cp-form lg:col-span-8">
            <QuoteForm text={text} email={company.email} whatsapp={whatsappUrl()} privacyHref={href(locale, "privacy")} />
          </div>
        </div>
      </section>

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
