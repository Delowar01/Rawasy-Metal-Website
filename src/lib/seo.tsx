import type { Metadata } from "next";
import { company } from "@/content/company";
import { services } from "@/content/services";
import { siteName } from "@/content/seo";
import { defaultLocale, localeConfig, locales, otherLocale, type Locale } from "@/i18n/config";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? company.website).replace(/\/$/, "");

const HREFLANG: Record<Locale, string> = { en: "en", ar: "ar" };

export function localizedUrl(locale: Locale, pathname: string) {
  return `${SITE_URL}/${locale}${pathname === "/" ? "" : pathname}`;
}

export function languageAlternates(pathname: string) {
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[HREFLANG[locale]] = localizedUrl(locale, pathname);
  languages["x-default"] = localizedUrl(defaultLocale, pathname);
  return languages;
}

/** Localized title, description, canonical, hreflang, Open Graph and Twitter tags. */
export function buildMetadata({
  locale,
  pathname,
  title,
  description,
  absoluteTitle = false,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
  noindex?: boolean;
}): Metadata {
  const url = localizedUrl(locale, pathname);
  const image = {
    url: `/og/og-${locale}.png`,
    width: 1200,
    height: 630,
    alt: `${siteName[locale]} — ${company.legalName[locale]}`,
  };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(pathname) },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: siteName[locale],
      locale: localeConfig[locale].ogLocale,
      alternateLocale: [localeConfig[otherLocale(locale)].ogLocale],
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

/** Organization / LocalBusiness + WebSite structured data (facts from the profile only). */
export function organizationJsonLd(locale: Locale) {
  const orgId = `${SITE_URL}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "LocalBusiness"],
        "@id": orgId,
        name: company.legalName.en,
        alternateName: [company.legalName.ar, company.brandName.en, company.brandName.ar],
        url: localizedUrl(locale, "/"),
        logo: `${SITE_URL}/brand/rawasy-logo.svg`,
        image: `${SITE_URL}/og/og-${locale}.png`,
        description: company.statement[locale],
        email: company.email,
        telephone: company.phones.map((p) => p.e164),
        address: {
          "@type": "PostalAddress",
          streetAddress: locale === "ar" ? "حي المشاعل، السلي" : "Al Mashael, Sulay",
          addressLocality: company.city[locale],
          postalCode: company.postalCode,
          addressCountry: "SA",
        },
        areaServed: { "@type": "Country", name: "Saudi Arabia" },
        sameAs: [company.social.facebook],
        knowsAbout: services.map((s) => s.name[locale]),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: siteName[locale],
        inLanguage: localeConfig[locale].htmlLang,
        publisher: { "@id": orgId },
      },
    ],
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
