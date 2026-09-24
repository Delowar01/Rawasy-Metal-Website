import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getMedia } from "@/content/media";
import { getCertificates, getCertificatesPageContent } from "@/content/repository";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { CertificateRegister } from "@/components/certificates/CertificateRegister";
import { EditorialSection } from "@/components/inner/EditorialSection";
import { InnerCTA } from "@/components/inner/InnerCTA";
import { InnerPageHero } from "@/components/inner/InnerPageHero";

const pad = (n: number) => String(n).padStart(2, "0");

export async function generateMetadata({ params }: PageProps<"/[locale]/certificates">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("certificates", locale);
}

/**
 * Certificates & compliance: a formal register of the three company documents
 * with redacted previews only. Registration numbers, QR codes, personal names
 * and the licence expiry date never appear on the site.
 */
export default async function CertificatesPage({ params }: PageProps<"/[locale]/certificates">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, certificates] = await Promise.all([getCertificatesPageContent(), getCertificates()]);
  const dict = getDictionary(locale);
  const reference = { label: page.columns.reference[locale], value: page.reference[locale] };

  return (
    <>
      {innerPageJsonLd("certificates", locale, "WebPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <InnerPageHero
        layout="compact"
        backdrop="none"
        breadcrumb={breadcrumbTrail("certificates", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
        below={
          <div className="pb-14 lg:pb-20" data-reveal="fade" style={{ ["--d" as string]: 200 } as CSSProperties}>
            <table className="w-full border-collapse">
              <caption className="t-label pb-4 text-start text-ink-3">{page.registerLabel[locale]}</caption>
              <thead>
                <tr className="border-y border-line-strong">
                  <th scope="col" className="t-label w-12 py-3 pe-4 text-start font-normal text-ink-3 sm:w-16">
                    {page.columns.number[locale]}
                  </th>
                  <th scope="col" className="t-label py-3 pe-4 text-start font-normal text-ink-3">
                    {page.columns.document[locale]}
                  </th>
                  <th scope="col" className="t-label py-3 pe-4 text-start font-normal text-ink-3 max-md:hidden">
                    {page.columns.issuer[locale]}
                  </th>
                  <th scope="col" className="t-label py-3 text-start font-normal text-ink-3 max-lg:hidden">
                    {page.columns.reference[locale]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert, i) => (
                  <tr key={cert.slug} className="border-b border-line align-baseline">
                    <td className="t-num py-5 pe-4 text-xs text-accent-ink">{pad(i + 1)}</td>
                    <th scope="row" className="py-5 pe-4 text-start font-normal">
                      <a href={`#${cert.slug}`} className="link-line font-display text-[1.05rem] font-semibold text-ink sm:text-[1.15rem]">
                        {cert.title[locale]}
                      </a>
                      <span className="mt-1.5 block text-[0.9rem] text-ink-3 md:hidden">{cert.issuer[locale]}</span>
                    </th>
                    <td className="py-5 pe-4 text-[0.95rem] text-ink-2 max-md:hidden">{cert.issuer[locale]}</td>
                    <td className="py-5 text-[0.95rem] text-ink-3 max-lg:hidden">{page.reference[locale]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />

      <div className="container-x pb-[var(--section-y)]">
        <CertificateRegister
          labels={{
            view: page.view[locale],
            close: dict.a11y.close,
            preview: page.previewLabel[locale],
            note: page.dialogNote[locale],
            figure: dict.common.figure,
          }}
          documents={certificates.map((cert) => {
            // Bilingual documents: label each version; Arabic pages show the Arabic version first.
            const previews = cert.previews.map((id, v) => ({
              ...getMedia(id),
              label: cert.previews.length > 1 ? page.versions[locale][v] : undefined,
            }));
            return {
              slug: cert.slug,
              title: cert.title[locale],
              issuer: cert.issuer[locale],
              facts: [...cert.facts.map((f) => ({ label: f.label[locale], value: f.value[locale] })), reference],
              previews: locale === "ar" ? previews.reverse() : previews,
            };
          })}
        />
      </div>

      <EditorialSection
        id="redaction"
        label={page.redaction.label[locale]}
        title={page.redaction.title[locale]}
        className="border-t border-line bg-background-deep"
      >
        <ol className="border-t border-line">
          {page.redaction.points[locale].map((point, i) => (
            <li
              key={i}
              className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-line py-6 sm:grid-cols-[3rem_1fr]"
              data-reveal
              style={{ ["--d" as string]: 80 * i } as CSSProperties}
            >
              <span className="t-num pt-1 text-xs text-accent-ink">{pad(i + 1)}</span>
              <p className="t-body text-[1.0625rem]">{point}</p>
            </li>
          ))}
        </ol>
      </EditorialSection>

      <InnerCTA
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
