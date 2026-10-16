import { getMedia } from "@/content/media";
import { getCertificates, getCertificatesPageContent } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { ClosingCta } from "../inner/ClosingCta";
import { PageHero } from "../inner/PageHero";
import { DocumentRegister, type CertificateDocument } from "./DocumentRegister";

const pad = (n: number) => String(n).padStart(2, "0");

/** The register under the title: each document's number, title (a jump to its card), issuer and reference. */
export function CertificateTable({
  caption,
  columns,
  reference,
  rows,
}: {
  caption: string;
  columns: { number: string; document: string; issuer: string; reference: string };
  reference: string;
  rows: { slug: string; title: string; issuer: string }[];
}) {
  return (
    <div className="card ct-register" data-tone="brass" data-reveal="fade">
      <table className="ip-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="ip-table-n">
              {columns.number}
            </th>
            <th scope="col">{columns.document}</th>
            <th scope="col" className="max-md:hidden">
              {columns.issuer}
            </th>
            <th scope="col" className="max-lg:hidden">
              {columns.reference}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((cert, i) => (
            <tr key={cert.slug}>
              <td className="ip-table-n">{pad(i + 1)}</td>
              <th scope="row">
                <a href={`#${cert.slug}`} className="ct-row-link">
                  {cert.title}
                </a>
                <span className="ct-row-issuer md:hidden">{cert.issuer}</span>
              </th>
              <td className="max-md:hidden">{cert.issuer}</td>
              <td className="max-lg:hidden">{reference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The documents' cards with their redacted previews (the dialog shows a larger preview). */
export function CertificateDocuments({ label, labels, documents }: { label: string; labels: { view: string; close: string; preview: string; note: string }; documents: CertificateDocument[] }) {
  return (
    <section aria-label={label} className="sec sec-sheet sec-muted">
      <div className="shell">
        <DocumentRegister labels={labels} documents={documents} />
      </div>
    </section>
  );
}

/** What the previews cover and what they are (`#redaction`). */
export function RedactionNote({ label, title, points }: { label: string; title: string; points: string[] }) {
  return (
    <section id="redaction" aria-labelledby="redaction-title" className="sec pb-0">
      <div className="shell grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="a2-read lg:col-span-4" data-reveal>
          <p className="eyebrow" data-tone="brass">
            {label}
          </p>
          <h2 id="redaction-title" className="t-h2 mt-4">
            {title}
          </h2>
          <span aria-hidden className="ct-swatch ct-swatch-lg mt-8" />
        </div>
        <ol className="card ct-points lg:col-span-8" data-tone="brass" data-reveal>
          {points.map((point, i) => (
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
  );
}

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
          <CertificateTable
            caption={page.registerLabel[locale]}
            columns={{ number: page.columns.number[locale], document: page.columns.document[locale], issuer: page.columns.issuer[locale], reference: page.columns.reference[locale] }}
            reference={page.reference[locale]}
            rows={certificates.map((cert) => ({ slug: cert.slug, title: cert.title[locale], issuer: cert.issuer[locale] }))}
          />
        }
      />

      <CertificateDocuments
        label={page.registerLabel[locale]}
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

      <RedactionNote label={page.redaction.label[locale]} title={page.redaction.title[locale]} points={page.redaction.points[locale]} />

      <ClosingCta
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
