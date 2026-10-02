import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routeLabels } from "@/content/navigation";
import { seo } from "@/content/seo";
import { isLocale } from "@/i18n/config";
import { href, path, routeStage } from "@/i18n/routes";
import { isPublished } from "@/lib/page-meta";
import { buildMetadata } from "@/lib/seo";
import { getShellView } from "@/components/commerce/data";
import { PlannedPage } from "@/components/commerce/planned/PlannedPage";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/capabilities">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    pathname: path("capabilities"),
    title: seo.capabilities.title[locale],
    description: seo.capabilities.description[locale],
    noindex: !isPublished("capabilities"),
  });
}

/**
 * Capabilities & Machinery: planned for Stage 1E. Until then the in-development page, in the Modern Commerce design
 * (Stage TM-2.6) — its title and description, the stage, the ways on; no machinery details.
 */
export default async function CapabilitiesPage({ params }: PageProps<"/[locale]/capabilities">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "capabilities", path: path("capabilities") });
  return (
    <PageShell shell={shell}>
      <PlannedPage
        locale={locale}
        title={seo.capabilities.title[locale]}
        description={seo.capabilities.description[locale]}
        stage={routeStage.capabilities}
        breadcrumb={[
          { href: href(locale, "home"), label: routeLabels.home[locale] },
          { href: href(locale, "capabilities"), label: routeLabels.capabilities[locale] },
        ]}
      />
    </PageShell>
  );
}
