import type { ProjectCategory } from "@/content/types";
import type { Tone } from "@/lib/tones";

export interface ProjectImage {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
}

export interface ProjectCategoryView {
  slug: ProjectCategory;
  label: string;
  tone: Tone;
}

/**
 * A project prepared for the portfolio. `mode` picks a layout that respects the
 * low-resolution source photos:
 * - `photo`  one photo at card width (sources at least 250 px wide)
 * - `pair`   two smaller photos side by side at close to native size
 * - `framed` one small photo at native size on a tinted plate
 */
export interface ProjectCardData {
  slug: string;
  href: string;
  ref: string;
  title: string;
  summary: string;
  categories: ProjectCategoryView[];
  tone: Tone;
  mode: "photo" | "pair" | "framed";
  /** The photos the card shows (one or two, depending on `mode`). */
  images: ProjectImage[];
  /** Every photo that may be shown for the project, in gallery order. */
  gallery: ProjectImage[];
}
