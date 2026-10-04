import { projectCategories } from "@/content/projects";
import type { Project, ProjectCategory } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { categoryTone, categoryViews, projectCard } from "@/lib/project-cards";
import type { Tone as SiteTone } from "@/lib/tones";
import type { Tone } from "../types";

/** A project photo as the page shows it: no alt of its own (the card's title or the link's text names it). */
export interface ProjectPhoto {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
}

export interface CategoryView {
  slug: ProjectCategory;
  label: string;
  tone: Tone;
}

/**
 * A showcased project in one language. `mode` keeps the previous card's choice of photos for the small source files:
 * `photo` one photo (a source at least 250 px wide), `pair` two smaller photos side by side, `framed` one small photo on
 * a plate. Every photo is shown at most at its source size. The page's own links name the project's place in the
 * gallery, `#<slug>` (decision D4); since Stage 1F each gallery card also links the project's own page (`href`).
 */
export interface ProjectView {
  slug: string;
  /** The project's own page (Stage 1F). */
  href: string;
  ref: string;
  title: string;
  summary: string;
  categories: CategoryView[];
  tone: Tone;
  mode: "photo" | "pair" | "framed";
  /** The photos the gallery card shows (one or two). */
  images: ProjectPhoto[];
  /** Every photo that may be shown, in gallery order. */
  gallery: ProjectPhoto[];
}

/** The previous design's colour roles, in this design's names. */
const TONE: Record<SiteTone, Tone> = { brand: "brand", eng: "steel", proc: "teal", craft: "brass" };

/** A project's classifications in one language, with their colour roles (the project's own page uses them too). */
export function categoryList(slugs: ProjectCategory[], locale: Locale): CategoryView[] {
  return categoryViews(locale, slugs).map((c) => ({ slug: c.slug, label: c.label, tone: TONE[c.tone] }));
}

/** The project as the gallery shows it (the previous card's data and, since Stage 1F, the address of its own page). */
export function projectView(project: Project, locale: Locale): ProjectView {
  const card = projectCard(project, locale);
  return {
    slug: card.slug,
    href: card.href,
    ref: card.ref,
    title: card.title,
    summary: card.summary,
    categories: card.categories.map((c) => ({ slug: c.slug, label: c.label, tone: TONE[c.tone] })),
    tone: TONE[card.tone],
    mode: card.mode,
    images: card.images,
    gallery: card.gallery,
  };
}

/** The category toggles: every classification with at least one showcased project, in content order (as before). */
export function filterOptions(projects: ProjectView[], locale: Locale) {
  return projectCategories
    .filter((c) => c.slug !== "industrial" && projects.some((p) => p.categories.some((pc) => pc.slug === c.slug)))
    .map((c) => ({ slug: c.slug, label: c.label[locale], tone: TONE[categoryTone[c.slug]] }));
}
