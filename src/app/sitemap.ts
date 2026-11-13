import type { MetadataRoute } from "next";
import { projects } from "@/content/projects";
import { services } from "@/content/services";
import { locales } from "@/i18n/config";
import { path, routes, type RouteKey } from "@/i18n/routes";
import { isPublished } from "@/lib/page-meta";
import { languageAlternates, localizedUrl } from "@/lib/seo";
import { ensureContent, isLivePage } from "@/content/load";

/** Every published page in both languages, with hreflang alternates (database content: the live ones only, A9.4). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await ensureContent();
  const paths: string[] = [];
  for (const key of Object.keys(routes) as RouteKey[]) {
    if (!isPublished(key) || !isLivePage(key === "service" ? "home" : key === "project" ? "project_detail" : key)) continue;
    if (key === "service") paths.push(...services.map((s) => path("service", { slug: s.slug })));
    else if (key === "project") paths.push(...projects.map((p) => path("project", { slug: p.slug })));
    else paths.push(path(key));
  }
  return paths.flatMap((p) =>
    locales.map((locale) => ({
      url: localizedUrl(locale, p),
      changeFrequency: "monthly" as const,
      priority: p === "/" ? 1 : 0.7,
      alternates: { languages: languageAlternates(p) },
    })),
  );
}
