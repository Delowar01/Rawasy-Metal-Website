import { company } from "@/content/company";
import { getLegalDocument } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { InnerPageHero } from "@/components/inner/InnerPageHero";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/ui/Icons";
import { LegalPageLayout } from "./LegalPageLayout";

function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** Privacy policy or website terms, from the legal content in the repository. */
export async function LegalPage({ slug, locale }: { slug: "privacy" | "terms"; locale: Locale }) {
  const { document, chrome } = await getLegalDocument(slug);
  const dict = getDictionary(locale);

  const contact = (
    <address className="mt-6 grid max-w-[42rem] gap-4 border border-line bg-elevated p-5 not-italic sm:grid-cols-2 sm:p-6">
      <div className="grid content-start gap-1.5">
        <p className="t-label flex items-center gap-2 text-ink-2">
          <MailIcon size={14} className="text-accent-ink" />
          {chrome.contactLabels.email[locale]}
        </p>
        <a href={`mailto:${company.email}`} dir="ltr" className="link-line w-fit font-medium text-ink">
          {company.email}
        </a>
      </div>
      <div className="grid content-start gap-1.5">
        <p className="t-label flex items-center gap-2 text-ink-2">
          <PhoneIcon size={14} className="text-accent-ink" />
          {chrome.contactLabels.phone[locale]}
        </p>
        {company.phones.map((phone) => (
          <a key={phone.e164} href={`tel:${phone.e164}`} dir="ltr" className="link-line w-fit font-medium text-ink">
            {phone.display}
          </a>
        ))}
      </div>
      <div className="grid content-start gap-1.5 sm:col-span-2">
        <p className="t-label flex items-center gap-2 text-ink-2">
          <PinIcon size={14} className="text-accent-ink" />
          {chrome.contactLabels.address[locale]}
        </p>
        <p className="text-ink">{company.address[locale].full}</p>
      </div>
    </address>
  );

  return (
    <>
      {innerPageJsonLd(slug, locale, "WebPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <InnerPageHero
        layout="compact"
        backdrop="none"
        breadcrumb={breadcrumbTrail(slug, locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={document.hero.eyebrow[locale]}
        title={document.hero.title[locale]}
        intro={document.hero.intro[locale]}
        meta={[
          { label: chrome.updated[locale], value: <time dateTime={document.updated}>{formatDate(document.updated, locale)}</time> },
          { label: chrome.appliesTo[locale], value: chrome.appliesToValue[locale] },
        ]}
      />

      <LegalPageLayout
        labels={{ onThisPage: chrome.onThisPage[locale], pending: chrome.pending[locale] }}
        sections={document.sections.map((section) => ({
          id: section.id,
          title: section.title[locale],
          body: section.body[locale],
          pending: section.pending?.[locale],
          extra: section.contact ? contact : undefined,
        }))}
      />
    </>
  );
}
