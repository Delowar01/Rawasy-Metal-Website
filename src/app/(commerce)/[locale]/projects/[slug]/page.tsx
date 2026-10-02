import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/content/repository";
import { projects } from "@/content/projects";
import { routeLabels } from "@/content/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, path, routeStage } from "@/i18n/routes";
import { isPublished } from "@/lib/page-meta";
import { breadcrumbJsonLd, buildMetadata, JsonLd, SITE_URL } from "@/lib/seo";
import { getShellView } from "@/components/commerce/data";
import { PlannedPage } from "@/components/commerce/planned/PlannedPage";
import { PageShell } from "@/components/commerce/shell/PageShell";

// Known slugs are prerendered; unknown ones render and call notFound(): the localized 404 of this design (not-found.tsx
// beside this page), with a real 404 status.
export const dynamicParams = true;

export function generateStaticParams() {
  return locales.flatMap((locale) => projects.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!isLocale(locale) || !project) return {};
  return buildMetadata({
    locale,
    pathname: path("project", { slug }),
    title: project.title[locale],
    description: project.summary[locale],
    noindex: !isPublished("project"),
  });
}

/**
 * A project page: planned for Stage 1F. Until then the in-development page, in the Modern Commerce design (Stage
 * TM-2.6): the project's title and summary, the stage, the ways on. No project photos (some held-back projects still
 * carry authorship, render or watermark questions) and no project facts.
 */
export default async function ProjectPage({ params }: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!isLocale(locale) || !project) notFound();
  const dict = getDictionary(locale);
  const crumbs = [
    { href: href(locale, "home"), label: dict.common.home },
    { href: href(locale, "projects"), label: routeLabels.projects[locale] },
    { href: href(locale, "project", { slug }), label: project.title[locale] },
  ];
  const shell = await getShellView(locale, { route: "project", path: path("project", { slug }) });
  return (
    <PageShell shell={shell}>
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: `${SITE_URL}${c.href}` })))} />
      <PlannedPage
        locale={locale}
        title={project.title[locale]}
        description={project.summary[locale]}
        stage={routeStage.project}
        breadcrumb={crumbs}
      />
    </PageShell>
  );
}
