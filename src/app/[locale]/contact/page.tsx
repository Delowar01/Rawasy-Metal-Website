import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { company, primaryWhatsApp, whatsappUrl } from "@/content/company";
import { getContactContent, getServices } from "@/content/repository";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { JsonLd, organizationJsonLd } from "@/lib/seo";
import { ContactMethod, ContactSheet } from "@/components/contact/ContactMethods";
import { QuoteForm, type QuoteFormText } from "@/components/contact/QuoteForm";
import { EditorialSection } from "@/components/inner/EditorialSection";
import { InnerPageHero } from "@/components/inner/InnerPageHero";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TechnicalFrame } from "@/components/visual/TechnicalFrame";
import { ArrowIcon, BuildingIcon, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/ui/Icons";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("contact", locale);
}

/**
 * Contact / request a quote. Direct contact details are verified (profile
 * p.16). The quote form has no delivery backend in this phase: it prepares the
 * request for the visitor to send by email or WhatsApp, and says so.
 */
export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, services] = await Promise.all([getContactContent(), getServices()]);
  const dict = getDictionary(locale);
  const { methods, form } = page;
  const other: Locale = locale === "ar" ? "en" : "ar";

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

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      {innerPageJsonLd("contact", locale, "ContactPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <InnerPageHero
        layout="split"
        backdrop="grid"
        breadcrumb={breadcrumbTrail("contact", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
        actions={
          <ButtonLink href={`${href(locale, "contact")}#quote`} icon={<ArrowIcon size={18} className="rotate-90" />}>
            {page.actions.quote[locale]}
          </ButtonLink>
        }
        aside={
          <div data-reveal style={{ ["--d" as string]: 160 } as CSSProperties}>
            <ContactSheet label={methods.label[locale]}>
              <ContactMethod
                index="01"
                label={methods.phone[locale]}
                icon={<PhoneIcon size={15} />}
                links={company.phones.map((phone) => ({
                  href: `tel:${phone.e164}`,
                  value: phone.display,
                  action: page.actions.call[locale],
                  ltr: true,
                }))}
              />
              <ContactMethod
                index="02"
                label={methods.whatsapp[locale]}
                icon={<WhatsAppIcon size={15} />}
                links={[{ href: whatsappUrl(), value: primaryWhatsApp.display, action: methods.chat[locale], external: true, ltr: true }]}
              />
              <ContactMethod
                index="03"
                label={methods.email[locale]}
                icon={<MailIcon size={15} />}
                links={[{ href: `mailto:${company.email}`, value: company.email, action: methods.send[locale], ltr: true }]}
              />
              <ContactMethod index="04" label={methods.address[locale]} icon={<PinIcon size={15} />}>
                <p className="text-[1.02rem] leading-relaxed text-ink">
                  {company.address[locale].lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </ContactMethod>
              <ContactMethod index="05" label={methods.name[locale]} icon={<BuildingIcon size={15} />}>
                <p className="font-display text-[1.02rem] font-semibold text-ink">{company.legalName[locale]}</p>
                <p
                  lang={other}
                  dir={other === "ar" ? "rtl" : "ltr"}
                  className={`mt-1 text-[0.92rem] text-ink-2 ${locale === "ar" ? "text-right" : "text-left"}`}
                >
                  {company.legalName[other]}
                </p>
              </ContactMethod>
            </ContactSheet>
          </div>
        }
      />

      <EditorialSection
        id="quote"
        label={form.label[locale]}
        title={form.title[locale]}
        intro={form.intro[locale]}
        className="border-t border-line"
        note={
          <div className="mt-10 border-t border-line pt-8" data-reveal style={{ ["--d" as string]: 160 } as CSSProperties}>
            <p className="t-label text-ink-3">{methods.stepsLabel[locale]}</p>
            <ol className="mt-5 grid gap-4">
              {form.steps[locale].map((step, i) => (
                <li key={i} className="grid grid-cols-[2rem_1fr] gap-x-3">
                  <span className="t-num pt-0.5 text-xs text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[0.98rem] leading-relaxed text-ink-2">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-7 border-s-2 border-accent ps-4 text-[0.92rem] leading-relaxed text-ink-3">{form.status[locale]}</p>
          </div>
        }
      >
        <TechnicalFrame reveal lines="corners" className="panel-raised p-5 sm:p-8 lg:p-10">
          <QuoteForm text={text} email={company.email} whatsapp={whatsappUrl()} privacyHref={href(locale, "privacy")} />
        </TechnicalFrame>
      </EditorialSection>
    </>
  );
}
