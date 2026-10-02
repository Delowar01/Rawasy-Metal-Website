import { projectCategories } from "@/content/projects";
import type { Project, ProjectCategory } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { categoryTone, projectCard } from "@/lib/project-cards";
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
 * a plate. Every photo is shown at most at its source size. There is no project page to link to yet (Stage 1F): the
 * page's links name the project's place in the gallery, `#<slug>`.
 */
export interface ProjectView {
  slug: string;
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

/** The project as the gallery shows it (the previous card's data, without its link to the planned project page). */
export function projectView(project: Project, locale: Locale): ProjectView {
  const card = projectCard(project, locale);
  return {
    slug: card.slug,
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
