import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { getShellView } from "@/components/commerce/data";
import { ProjectsPage as Projects } from "@/components/commerce/projects/ProjectsPage";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("projects", locale);
}

/**
 * The Projects overview in the Modern Commerce design (Stage TM-2.5): the work gallery, filterable, each project at
 * #<slug>. The project pages (/projects/[slug]) stay in the previous design until Stage 1F.
 */
export default async function ProjectsPage({ params }: PageProps<"/[locale]/projects">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "projects", path: "/projects" });
  return (
    <PageShell shell={shell}>
      <Projects locale={locale} />
    </PageShell>
  );
}
