import type { ProjectCardData, ProjectCategoryView } from "@/components/projects/types";
import type { Tone } from "@/lib/tones";
import { getMedia } from "@/content/media";
import { projectCategories, projectImages } from "@/content/projects";
import type { Project, ProjectCategory } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/routes";

/** Category → colour role: structures in steel, fabrication in brass, places in teal, cut and decorative work in orange. */
export const categoryTone: Record<ProjectCategory, Tone> = {
  structures: "eng",
  shade: "eng",
  industrial: "eng",
  fabrication: "craft",
  custom: "craft",
  architectural: "proc",
  "public-realm": "proc",
  decorative: "brand",
  "laser-cutting": "brand",
};

/** Narrowest source photo shown at full card width (about 1.25× at most on a 314 px card). */
const PHOTO_MIN_WIDTH = 250;

export function categoryViews(locale: Locale, slugs: ProjectCategory[]): ProjectCategoryView[] {
  return slugs.map((slug) => ({
    slug,
    label: projectCategories.find((c) => c.slug === slug)?.label[locale] ?? slug,
    tone: categoryTone[slug],
  }));
}

/** Prepares a project for the portfolio in one language. */
export function projectCard(project: Project, locale: Locale): ProjectCardData {
  const images = projectImages(project).map((id) => {
    const media = getMedia(id);
    return { src: media.src, width: media.width, height: media.height, blurDataURL: media.blurDataURL };
  });
  const [first] = images;
  const widest = images.reduce((a, b) => (b.width > a.width ? b : a), first);
  const mode: ProjectCardData["mode"] =
    first.width >= PHOTO_MIN_WIDTH || widest.width >= PHOTO_MIN_WIDTH ? "photo" : images.length > 1 ? "pair" : "framed";
  const categories = categoryViews(locale, project.categories);
  return {
    slug: project.slug,
    href: href(locale, "project", { slug: project.slug }),
    ref: project.galleryRef,
    title: project.title[locale],
    summary: project.summary[locale],
    categories,
    tone: categories[0]?.tone ?? "brand",
    mode,
    images: mode === "photo" ? [first.width >= PHOTO_MIN_WIDTH ? first : widest] : mode === "pair" ? images.slice(0, 2) : [first],
    gallery: images,
  };
}

/** Numeric order of gallery references ("04", "07–08", then profile-page items such as "p.3"). */
export function refOrder(ref: string) {
  const n = parseInt(ref, 10);
  return Number.isNaN(n) ? 1000 : n;
}
