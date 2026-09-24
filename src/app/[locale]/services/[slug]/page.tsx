import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { company } from "@/content/company";
import { getServiceBySlug } from "@/content/repository";
import { seo } from "@/content/seo";
import { services } from "@/content/services";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, path, routeStage } from "@/i18n/routes";
import { published } from "@/lib/page-meta";
import { breadcrumbJsonLd, buildMetadata, JsonLd, localizedUrl, SITE_URL } from "@/lib/seo";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

// Known slugs are prerendered; unknown ones render and call notFound().
export const dynamicParams = true;

export function generateStaticParams() {
  return locales.flatMap((locale) => services.map((s) => ({ locale, slug: s.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!isLocale(locale) || !service) return {};
  return buildMetadata({
    locale,
    pathname: path("service", { slug }),
    title: service.name[locale],
    description: service.summary[locale],
    noindex: !published.service,
  });
}

export default async function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { locale, slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!isLocale(locale) || !service) notFound();
  const dict = getDictionary(locale);
  const crumbs = [
    { href: href(locale, "home"), label: dict.common.home },
    { href: href(locale, "services"), label: seo.services.title[locale] },
    { href: href(locale, "service", { slug }), label: service.name[locale] },
  ];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.name[locale],
          description: service.summary[locale],
          serviceType: service.name.en,
          url: localizedUrl(locale, path("service", { slug })),
          areaServed: { "@type": "Country", name: "Saudi Arabia" },
          provider: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: company.legalName.en },
        }}
      />
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: `${SITE_URL}${c.href}` })))} />
      <PagePlaceholder
        locale={locale}
        title={service.name[locale]}
        description={service.summary[locale]}
        stage={routeStage.service}
        breadcrumb={crumbs}
      >
        <ul className="mt-8 flex max-w-3xl flex-wrap gap-2">
          {service.highlights[locale].map((h) => (
            <li key={h} className="border border-line px-3 py-1.5 text-sm text-ink-2">
              {h}
            </li>
          ))}
        </ul>
      </PagePlaceholder>
    </>
  );
}
