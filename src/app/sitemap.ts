import type { MetadataRoute } from "next";
import { projects } from "@/content/projects";
import { services } from "@/content/services";
import { locales } from "@/i18n/config";
import { path, routes, type RouteKey } from "@/i18n/routes";
import { published } from "@/lib/page-meta";
import { languageAlternates, localizedUrl } from "@/lib/seo";

/** Every published page in both languages, with hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths: string[] = [];
  for (const key of Object.keys(routes) as RouteKey[]) {
    if (!published[key]) continue;
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
