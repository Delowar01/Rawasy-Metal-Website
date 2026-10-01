import { getMedia } from "@/content/media";
import { getCertificates, getCertificatesPageContent } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { ClosingCta } from "../inner/ClosingCta";
import { PageHero } from "../inner/PageHero";
import { DocumentRegister } from "./DocumentRegister";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Certificates & compliance in the Modern Commerce design (Stage TM-2.3): the register of the three company documents
 * under the title, one card per document with its redacted preview, how the previews were redacted (`#redaction`) and
 * the closing ways on. Copy and data are the previous design's page, unchanged. Only the redacted files are shown, as
 * they are; registration numbers, QR codes, personal names and the licence expiry never appear on the site.
 */
export async function CertificatesPage({ locale }: { locale: Locale }) {
  const [page, certificates] = await Promise.all([getCertificatesPageContent(), getCertificates()]);
  const dict = getDictionary(locale);
  const reference = { label: page.columns.reference[locale], value: page.reference[locale] };

  return (
    <>
      {innerPageJsonLd("certificates", locale, "WebPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <PageHero
        layout="stacked"
        breadcrumb={breadcrumbTrail("certificates", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        tone="brass"
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
        below={
          <div className="card ct-register" data-tone="brass" data-reveal="fade">
            <table className="ip-table">
              <caption>{page.registerLabel[locale]}</caption>
              <thead>
                <tr>
                  <th scope="col" className="ip-table-n">
                    {page.columns.number[locale]}
                  </th>
                  <th scope="col">{page.columns.document[locale]}</th>
                  <th scope="col" className="max-md:hidden">
                    {page.columns.issuer[locale]}
                  </th>
                  <th scope="col" className="max-lg:hidden">
                    {page.columns.reference[locale]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert, i) => (
                  <tr key={cert.slug}>
                    <td className="ip-table-n">{pad(i + 1)}</td>
                    <th scope="row">
                      <a href={`#${cert.slug}`} className="ct-row-link">
                        {cert.title[locale]}
                      </a>
                      <span className="ct-row-issuer md:hidden">{cert.issuer[locale]}</span>
                    </th>
                    <td className="max-md:hidden">{cert.issuer[locale]}</td>
                    <td className="max-lg:hidden">{page.reference[locale]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />

      <section aria-label={page.registerLabel[locale]} className="sec sec-sheet sec-muted">
        <div className="shell">
          <DocumentRegister
            labels={{ view: page.view[locale], close: dict.a11y.close, preview: page.previewLabel[locale], note: page.dialogNote[locale] }}
            documents={certificates.map((cert) => {
              // Bilingual documents: each version is labelled, and Arabic pages show the Arabic version first.
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
      </section>

      <section id="redaction" aria-labelledby="redaction-title" className="sec pb-0">
        <div className="shell grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="a2-read lg:col-span-4" data-reveal>
            <p className="eyebrow" data-tone="brass">
              {page.redaction.label[locale]}
            </p>
            <h2 id="redaction-title" className="t-h2 mt-4">
              {page.redaction.title[locale]}
            </h2>
            <span aria-hidden className="ct-swatch ct-swatch-lg mt-8" />
          </div>
          <ol className="card ct-points lg:col-span-8" data-tone="brass" data-reveal>
            {page.redaction.points[locale].map((point, i) => (
              <li key={i}>
                <span aria-hidden className="step-num">
                  {pad(i + 1)}
                </span>
                <p>{point}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ClosingCta
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
