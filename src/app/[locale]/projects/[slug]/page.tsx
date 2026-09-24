import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMedia } from "@/content/media";
import { getProjectBySlug } from "@/content/repository";
import { projects } from "@/content/projects";
import { seo } from "@/content/seo";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, path, routeStage } from "@/i18n/routes";
import { published } from "@/lib/page-meta";
import { breadcrumbJsonLd, buildMetadata, JsonLd, SITE_URL } from "@/lib/seo";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { MediaImage } from "@/components/ui/MediaImage";

// Known slugs are prerendered; unknown ones render and call notFound().
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
    noindex: !published.project,
  });
}

export default async function ProjectPage({ params }: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!isLocale(locale) || !project) notFound();
  const dict = getDictionary(locale);
  const crumbs = [
    { href: href(locale, "home"), label: dict.common.home },
    { href: href(locale, "projects"), label: seo.projects.title[locale] },
    { href: href(locale, "project", { slug }), label: project.title[locale] },
  ];
  const cover = getMedia(project.media[0]);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: `${SITE_URL}${c.href}` })))} />
      <PagePlaceholder
        locale={locale}
        title={project.title[locale]}
        description={project.summary[locale]}
        stage={routeStage.project}
        breadcrumb={crumbs}
      >
        <div className="photo relative mt-10 w-full max-w-md" style={{ aspectRatio: `${cover.width} / ${cover.height}` }}>
          <MediaImage id={project.media[0]} alt={project.title[locale]} fill sizes="448px" className="object-cover" />
        </div>
      </PagePlaceholder>
    </>
  );
}
