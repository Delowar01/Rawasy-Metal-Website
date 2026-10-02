import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServicePageContent } from "@/content/repository";
import { services } from "@/content/services";
import { isLocale, locales } from "@/i18n/config";
import { path } from "@/i18n/routes";
import { isPublished } from "@/lib/page-meta";
import { buildMetadata } from "@/lib/seo";
import { getShellView } from "@/components/commerce/data";
import { ServicePage as Service } from "@/components/commerce/services/ServicePage";
import { PageShell } from "@/components/commerce/shell/PageShell";

// Known slugs are prerendered; unknown ones render and call notFound(): the localized 404 of this design (not-found.tsx
// beside this page), with a real 404 status.
export const dynamicParams = true;

export function generateStaticParams() {
  return locales.flatMap((locale) => services.map((s) => ({ locale, slug: s.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const content = await getServicePageContent(slug);
  if (!isLocale(locale) || !content) return {};
  return buildMetadata({
    locale,
    pathname: path("service", { slug }),
    title: content.service.name[locale],
    description: content.service.summary[locale],
    noindex: !isPublished("service"),
  });
}

/** A service page in the Modern Commerce design (Stage TM-2.4): the Stage 1D content and structure (decision D3). */
export default async function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { locale, slug } = await params;
  const content = await getServicePageContent(slug);
  if (!isLocale(locale) || !content) notFound();
  const shell = await getShellView(locale, { route: "service", path: path("service", { slug }) });
  return (
    <PageShell shell={shell}>
      <Service locale={locale} content={content} />
    </PageShell>
  );
}
