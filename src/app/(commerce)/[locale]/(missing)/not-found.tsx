import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { siteName } from "@/content/seo";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getShellView } from "@/components/commerce/data";
import { BootFallback } from "@/components/commerce/inner/BootFallback";
import { NotFoundView } from "@/components/commerce/inner/NotFound";
import { PageShell } from "@/components/commerce/shell/PageShell";
import { SamePageLink } from "@/components/commerce/shell/SamePageLink";

/*
 * The localized 404 of the Modern Commerce design: unknown paths under a locale (the catch-all beside it). The
 * language comes from the address (the root parameter). The previous design keeps its own 404
 * (src/app/[locale]/not-found.tsx) for the routes still in that design (an unknown service or project slug).
 *
 * It sits in its own route group, (missing), on purpose: Next.js renders a segment's not-found boundary into the page
 * data of every page under that segment, so beside the layout it added the whole 404 page (header, footer and all,
 * about 8 KB gzipped) to the homepage and every other page in this design. Here only the catch-all carries it. A
 * migrated route that calls notFound() needs this boundary above it (e.g. moved into this group) or its own.
 */

export async function generateMetadata(): Promise<Metadata> {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : defaultLocale;
  return { title: getDictionary(locale).notFound.metaTitle, robots: { index: false } };
}

export default async function NotFound() {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : defaultLocale;
  // No route of its own: no page is marked current, and the language switch keeps the address being viewed (through
  // SamePageLink, passed in here so that only the 404 loads it).
  const shell = await getShellView(locale, { route: null, path: null });
  return (
    <PageShell shell={shell} sameAddressLink={SamePageLink}>
      <NotFoundView locale={locale} />
      {/* The layout's title template, as the server sends it: "Page not found | RAWASY". */}
      <BootFallback title={`${getDictionary(locale).notFound.metaTitle} | ${siteName[locale]}`} />
    </PageShell>
  );
}
