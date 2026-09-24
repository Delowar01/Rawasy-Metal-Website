import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { seo } from "@/content/seo";
import { isLocale, type Locale } from "@/i18n/config";
import { path, routeStage, type RouteKey } from "@/i18n/routes";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { published } from "./page-meta";
import { buildMetadata } from "./seo";

type StaticRoute = Exclude<RouteKey, "home" | "service" | "project">;
type Params = { params: Promise<{ locale: string }> };

/**
 * Builds the metadata + page pair for a static route that is routed and
 * localized now but designed after homepage approval.
 */
export function createPlaceholderRoute(key: StaticRoute, extra?: (locale: Locale) => ReactNode) {
  async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    return buildMetadata({
      locale,
      pathname: path(key),
      title: seo[key].title[locale],
      description: seo[key].description[locale],
      noindex: !published[key],
    });
  }

  async function Page({ params }: Params) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return (
      <PagePlaceholder
        locale={locale}
        title={seo[key].title[locale]}
        description={seo[key].description[locale]}
        stage={routeStage[key]}
      >
        {extra?.(locale)}
      </PagePlaceholder>
    );
  }

  return { generateMetadata, Page };
}
