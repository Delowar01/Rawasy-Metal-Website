import { breakableEmail, ContactRow, type ContactRowData } from "@/components/commerce/contact/ContactRows";
import { QuoteForm } from "@/components/commerce/contact/QuoteForm";
import { quoteFormText } from "@/components/commerce/contact/quote-text";
import { company, primaryWhatsApp, whatsappUrl } from "@/content/company";
import { getContactContent, getServices } from "@/content/repository";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { itemsOf, itemText, textOf } from "@/server/builder/view";
import type { BlockProps } from "../context";
import { GenericSection, Head, motionProps, readClass } from "../frame";
import { specOf } from "../parts";

/**
 * Contact details (A5 brief §21, the A6 boundary): the company's current details exactly as the website shows them today
 * (read-only: Site settings, A6, will manage them), or details written for this block — phone numbers (optionally also
 * on WhatsApp), an email address, an address and opening hours. Every number and address comes from a validated value.
 */
export async function GenericContactDetails({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  const page = await getContactContent();
  const { methods } = page;
  const locale = ctx.locale;
  const external = getDictionary(locale).a11y.externalLink;
  const rows: ContactRowData[] = [];
  let address: string | null = null;
  let hours: string | null = null;
  if (settings.source !== "custom") {
    for (const phone of company.phones)
      rows.push({ icon: "phone", tone: "steel", label: methods.phone[locale], value: phone.display, href: `tel:${phone.e164}`, action: page.actions.call[locale], ltr: true });
    rows.push({ icon: "chat", tone: "teal", label: methods.whatsapp[locale], value: primaryWhatsApp.display, href: whatsappUrl(), action: methods.chat[locale], external: true, ltr: true });
    rows.push({ icon: "mail", tone: "steel", label: methods.email[locale], value: breakableEmail(company.email), href: `mailto:${company.email}`, action: methods.send[locale], ltr: true });
    rows.push({ icon: "pin", tone: "brass", label: methods.address[locale], value: company.address[locale].full, href: href(locale, "contact", { hash: "location" }), action: methods.viewMap[locale] });
  } else {
    for (const phone of itemsOf<{ number?: string; whatsapp?: boolean }>(settings, "phones")) {
      if (!phone.number) continue;
      const digits = phone.number.replace(/[ -]/g, "");
      const label = itemText(content, "phones", phone.id, "label") || methods.phone[locale];
      rows.push({ icon: "phone", tone: "steel", label, value: phone.number, href: `tel:${digits}`, action: page.actions.call[locale], ltr: true });
      if (phone.whatsapp)
        rows.push({ icon: "chat", tone: "teal", label: methods.whatsapp[locale], value: phone.number, href: `https://wa.me/${digits.replace(/^\+/, "")}`, action: methods.chat[locale], external: true, ltr: true });
    }
    const email = typeof settings.email === "string" ? settings.email : "";
    if (email) rows.push({ icon: "mail", tone: "steel", label: methods.email[locale], value: breakableEmail(email), href: `mailto:${email}`, action: methods.send[locale], ltr: true });
    address = textOf(content, "address") || null;
    hours = textOf(content, "hours") || null;
  }
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="contact_details" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <div className="gb-grid gb-contact">
            {rows.map((row, i) => (
              <div key={`${row.href}-${i}`} {...motionProps(view, i)}>
                <ContactRow row={row} externalLabel={external} />
              </div>
            ))}
          </div>
          {(address || hours) && (
            <div className={`gb-contact-text ${readClass(view)}`.trim()}>
              {address && (
                <div>
                  <p className="cp-label">{methods.address[locale]}</p>
                  <p className="gb-pre">{address}</p>
                </div>
              )}
              {hours && <p className="gb-pre">{hours}</p>}
            </div>
          )}
        </>
      )}
    </GenericSection>
  );
}

/**
 * The quotation form exactly as it works today (A5 brief §22, the A7 boundary): the website's own form and words; it
 * prepares the request for the visitor to send from their own email or WhatsApp — nothing is sent or stored by the site.
 * Only the heading above it is the block's.
 */
export async function GenericQuoteForm({ section, ctx }: BlockProps) {
  const { content } = section;
  const [page, services] = await Promise.all([getContactContent(), getServices()]);
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="quote_form" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <div className="card cp-form gb-form">
            <QuoteForm text={quoteFormText(ctx.locale, page, services)} email={company.email} whatsapp={whatsappUrl()} privacyHref={href(ctx.locale, "privacy")} />
          </div>
        </>
      )}
    </GenericSection>
  );
}
