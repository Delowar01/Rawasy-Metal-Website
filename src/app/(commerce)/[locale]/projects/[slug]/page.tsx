import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectBySlug, getProjectDetailContent } from "@/content/repository";
import { projects } from "@/content/projects";
import { routeLabels } from "@/content/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, path } from "@/i18n/routes";
import { isPublished } from "@/lib/page-meta";
import { breadcrumbJsonLd, buildMetadata, JsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { getShellView } from "@/components/commerce/data";
import { projectDetailView } from "@/components/commerce/project-detail/data";
import { ProjectDetailPage } from "@/components/commerce/project-detail/ProjectDetailPage";
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
 * A project's own page (Stage 1F): the project's record from the company profile — its title, summary, website
 * classifications, related services, gallery reference and the photos that may be shown (`projectDetailMedia`) — in the
 * Modern Commerce design, for every project in the content layer. Structured data: the page (WebPage) and its trail
 * (BreadcrumbList), nothing about the project beyond its name and summary.
 */
export default async function ProjectPage({ params }: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params;
  const content = await getProjectDetailContent(slug);
  if (!isLocale(locale) || !content) notFound();
  const dict = getDictionary(locale);
  const view = projectDetailView(content, locale);
  const crumbs = [
    { href: href(locale, "home"), label: dict.common.home },
    { href: href(locale, "projects"), label: routeLabels.projects[locale] },
    { href: href(locale, "project", { slug }), label: view.title },
  ];
  const shell = await getShellView(locale, { route: "project", path: path("project", { slug }) });
  return (
    <PageShell shell={shell}>
      <JsonLd data={webPageJsonLd({ locale, pathname: path("project", { slug }), name: view.title, description: view.summary })} />
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: `${SITE_URL}${c.href}` })))} />
      <ProjectDetailPage locale={locale} view={view} page={content.page} breadcrumb={crumbs} />
    </PageShell>
  );
}
