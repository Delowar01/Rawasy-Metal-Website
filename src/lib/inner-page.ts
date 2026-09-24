import type { Metadata } from "next";
import { routeLabels } from "@/content/navigation";
import { seo } from "@/content/seo";
import type { Locale } from "@/i18n/config";
import { href, path } from "@/i18n/routes";
import { isPublished } from "./page-meta";
import { breadcrumbJsonLd, buildMetadata, SITE_URL, webPageJsonLd } from "./seo";

/** Stage 1C inner pages. */
export type InnerRoute = "about" | "services" | "industries" | "clients" | "certificates" | "contact" | "privacy" | "terms";

/** Localized metadata; noindex until the route is published (see page-meta.ts). */
export function innerPageMetadata(key: InnerRoute, locale: Locale): Metadata {
  return buildMetadata({
    locale,
    pathname: path(key),
    title: seo[key].title[locale],
    description: seo[key].description[locale],
    noindex: !isPublished(key),
  });
}

/** Home → page trail, shared by the visible breadcrumb and its structured data. */
export function breadcrumbTrail(key: InnerRoute, locale: Locale) {
  return [
    { href: href(locale, "home"), label: routeLabels.home[locale] },
    { href: href(locale, key), label: routeLabels[key][locale] },
  ];
}

/** WebPage + BreadcrumbList structured data for an inner page. */
export function innerPageJsonLd(
  key: InnerRoute,
  locale: Locale,
  type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage",
) {
  return [
    webPageJsonLd({ locale, pathname: path(key), name: seo[key].title[locale], description: seo[key].description[locale], type }),
    breadcrumbJsonLd(breadcrumbTrail(key, locale).map((c) => ({ name: c.label, url: `${SITE_URL}${c.href}` }))),
  ];
}
