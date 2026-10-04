import { getMedia } from "@/content/media";
import { projectDetailMedia } from "@/content/projects";
import { getService } from "@/content/services";
import type { Localized, Project, ProjectDetailPageContent, ServiceSlug } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/routes";
import { categoryList, type CategoryView } from "../projects/data";
import { serviceTone } from "../tones";
import type { Tone } from "../types";

/** A photo the page shows: its file, its source size (never exceeded on screen) and its text alternative. */
export interface DetailPhoto {
  id: string;
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
  alt: string;
}

export interface DetailService {
  slug: ServiceSlug;
  name: string;
  href: string;
  tone: Tone;
}

/** The optional details a record may hold once RAWASY confirms them: short ones as rows, longer ones as passages. */
export const DETAIL_ROWS = ["client", "location", "year", "materials", "scope"] as const;
export const DETAIL_PASSAGES = ["description", "challenge", "solution"] as const;
export type DetailKey = (typeof DETAIL_ROWS)[number] | (typeof DETAIL_PASSAGES)[number];

export interface DetailField {
  key: DetailKey;
  label: string;
  value: string;
}

/**
 * A project's own page (Stage 1F) in one language, from its record only. `photos` are the ones `projectDetailMedia`
 * allows, in record order: the first leads the page, the others form its gallery (none repeated); a project without
 * any is a text page. `rows` and `passages` hold only the details the record has (none does yet).
 */
export interface ProjectDetailView {
  slug: string;
  title: string;
  summary: string;
  /** The gallery reference exactly as the record holds it ("04", "07–08", "p.3"). */
  ref: string;
  /** "Ref." before an item of the profile's work gallery; nothing before one of its pages ("p.3"). */
  refLabel: string | null;
  /** Where the record comes from: the company profile. */
  source: string;
  tone: Tone;
  categories: CategoryView[];
  services: DetailService[];
  photos: DetailPhoto[];
  rows: DetailField[];
  passages: DetailField[];
}

/** A reference to one of the profile's pages ("p.3") rather than an item of its work gallery ("04", "07–08"). */
const isPageReference = (ref: string) => /^p\.\s*\d/i.test(ref);

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

/** A detail's text in one language, or nothing when the record does not hold it (an empty value counts as none). */
function detailText(project: Project, key: DetailKey, locale: Locale): string | undefined {
  const value: Localized | Localized<string[]> | number | undefined = project[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  const text = value[locale];
  if (Array.isArray(text)) return text.map((t) => t.trim()).filter(Boolean).join(locale === "ar" ? "، " : ", ") || undefined;
  return typeof text === "string" && text.trim() ? text.trim() : undefined;
}

export function projectDetailView(
  { project, page, refLabel }: { project: Project; page: ProjectDetailPageContent; refLabel: Localized },
  locale: Locale,
): ProjectDetailView {
  const title = project.title[locale];
  const ids = projectDetailMedia(project);
  const photos = ids.map((id, i) => {
    const media = getMedia(id);
    return {
      id,
      src: media.src,
      width: media.width,
      height: media.height,
      blurDataURL: media.blurDataURL,
      // One photo: the project's name. Several: the name and the photo's place in the set (nothing invented about it).
      alt: ids.length === 1 ? title : fill(page.photoAlt[locale], { title, n: String(i + 1), total: String(ids.length) }),
    };
  });
  const categories = categoryList(project.categories, locale);
  const services = project.services.flatMap((slug) => {
    const service = getService(slug);
    return service ? [{ slug: service.slug, name: service.name[locale], href: href(locale, "service", { slug: service.slug }), tone: serviceTone[service.slug] }] : [];
  });
  const field = (key: DetailKey) => {
    const value = detailText(project, key, locale);
    return value === undefined ? [] : [{ key, label: page.details[key][locale], value }];
  };
  return {
    slug: project.slug,
    title,
    summary: project.summary[locale],
    ref: project.galleryRef,
    refLabel: isPageReference(project.galleryRef) ? null : refLabel[locale],
    source: page.source[locale],
    tone: categories[0]?.tone ?? "brand",
    categories,
    services,
    photos,
    rows: DETAIL_ROWS.flatMap(field),
    passages: DETAIL_PASSAGES.flatMap(field),
  };
}
