import { isPageReference, type DetailField, type DetailKey, type DetailPhoto, type ProjectDetailView } from "@/components/commerce/project-detail/data";
import { ProjectDetails, ProjectOpening, ProjectPhotos } from "@/components/commerce/project-detail/ProjectDetailPage";
import { TONE, type CategoryView, type ProjectPhoto, type ProjectView } from "@/components/commerce/projects/data";
import type { FilterOption } from "@/components/commerce/projects/Gallery";
import { FeaturedProject, GallerySection, ProjectHighlights, ProjectIndex } from "@/components/commerce/projects/ProjectsPage";
import { serviceTone } from "@/components/commerce/tones";
import { routeLabels } from "@/content/navigation";
import type { ProjectCategory, ServiceSlug } from "@/content/types";
import { getDictionary } from "@/i18n/dictionaries";
import { categoryTone, cardImages, refOrder } from "@/lib/project-cards";
import type { Tone as SiteTone } from "@/lib/tones";
import type { Content, SelectionValue } from "@/server/builder/fields";
import type { Loc, PreviewProject } from "@/server/builder/preview-data";
import { automatic } from "@/server/builder/blocks/kit";
import { resolveSelection, textOf } from "@/server/builder/view";
import type { BlockProps, BlockSection, RenderContext } from "../context";
import { commerceImage, imageProblem, placeholderImage } from "./images";

/*
 * The Projects overview's blocks and the project page template's (A5 brief §11, §41): the featured project, the
 * highlights, the gallery with its category bar, the index, and a project's opening, photographs and details — the
 * approved components of `src/components/commerce/{projects,project-detail}/*`, drawn from the sections' texts and the
 * working project records. As today, the gallery and the index show only the projects with a photo that may be shown,
 * a restricted project (A3 flags) shows no photo anywhere, and a project page shows only the details its record holds.
 * The template is drawn with a sample project (the first in the collection with photos).
 */

const pad = (n: number) => String(n).padStart(2, "0");
const label = (value: Loc<string>, slug: string) => value.en ?? value.ar ?? slug;
const LANGUAGE = { en: "English", ar: "Arabic" } as const;

/** A project classification as the page shows it (its colour role follows today's classifications; any other is steel). */
function categoryOf(id: string, ctx: RenderContext): CategoryView | null {
  const record = ctx.records.categories.find((c) => c.id === id && !c.archived);
  if (!record) return null;
  const site = (categoryTone as Record<string, SiteTone | undefined>)[record.slug];
  return { slug: record.slug as ProjectCategory, label: record.label[ctx.locale] ?? "", tone: site ? TONE[site] : "steel" };
}

const photoOf = (image: ReturnType<typeof commerceImage>): ProjectPhoto => ({
  src: image.src,
  width: image.width,
  height: image.height,
  blurDataURL: image.blurDataURL,
  ...(image.unoptimized ? { unoptimized: true as const } : {}),
});

/** The photos of a project the preview may show, in record order; a stand-in when there is none (never a restricted project's). */
function projectPhotos(record: PreviewProject, ctx: RenderContext): ProjectPhoto[] {
  if (record.restrictions.length) return [photoOf(placeholderImage(["Restricted", ...record.restrictions].join(", ")))];
  const shown = record.media.filter((id) => !imageProblem(id, ctx)).map((id) => photoOf(commerceImage(id, ctx, "")));
  if (shown.length) return shown;
  return [photoOf(placeholderImage(record.media.length ? (imageProblem(record.media[0], ctx) ?? "Not available") : "No photo yet"))];
}

/** A project as the overview's components show it (today's card rule picks the card's photos). */
export function projectView(record: PreviewProject, ctx: RenderContext): ProjectView {
  const gallery = projectPhotos(record, ctx);
  const card = cardImages(gallery);
  const categories = record.categories.map((id) => categoryOf(id, ctx)).filter((c): c is CategoryView => c !== null);
  return {
    slug: record.slug,
    href: ctx.hrefOf(ctx.locale, "project", { slug: record.slug }),
    ref: record.ref ?? "",
    title: record.title[ctx.locale] ?? "",
    summary: record.summary[ctx.locale] ?? "",
    categories,
    tone: categories[0]?.tone ?? "brand",
    mode: card.mode,
    images: card.images,
    gallery,
  };
}

/** Whether the gallery shows a project: live, not restricted, with a photo that may be shown (today's rule). */
const showcased = (record: PreviewProject, ctx: RenderContext) => !record.archived && !record.restrictions.length && record.media.some((id) => !imageProblem(id, ctx));

/** Every project the gallery would show without a choice of its own: the collection, in its order. */
export function showcasedProjects(ctx: RenderContext): PreviewProject[] {
  return resolveSelection("project", automatic("all", 200), ctx.records).items.filter((p) => showcased(p, ctx));
}

/** The category toggles: every classification with a shown project, in the collection's order ("industrial" is never one, as today). */
export function filterOptionsOf(projects: ProjectView[], ctx: RenderContext): FilterOption[] {
  return ctx.records.categories
    .filter((c) => !c.archived && c.slug !== "industrial" && projects.some((p) => p.categories.some((pc) => pc.slug === c.slug)))
    .flatMap((c) => {
      const view = categoryOf(c.id, ctx);
      return view ? [{ slug: view.slug, label: view.label, tone: view.tone }] : [];
    });
}

/** What the preview cannot show of chosen projects: a missing title, no photo it may show. */
export function projectNotes(records: PreviewProject[], ctx: RenderContext): string[] {
  return records.flatMap((p) => {
    const notes: string[] = [];
    const name = label(p.title, p.slug);
    if (!p.title[ctx.locale]) notes.push(`The project “${name}” has no ${LANGUAGE[ctx.locale]} title yet.`);
    if (!p.restrictions.length && !p.media.some((id) => !imageProblem(id, ctx)))
      notes.push(`The project “${name}”: no photo the preview can show (${p.media.length ? (imageProblem(p.media[0], ctx) ?? "Not available") : "No photo yet"}).`);
    return notes;
  });
}

const chosen = (section: BlockSection, key: string, ctx: RenderContext) => resolveSelection("project", section.settings[key] as SelectionValue | undefined, ctx.records).items;

// --- The overview ---------------------------------------------------------------------------------------------------------

function FeaturedBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const [record] = chosen(section, "project", ctx);
  return <FeaturedProject project={projectView(record, ctx)} label={textOf(c, "label")} refLabel={textOf(c, "refLabel")} action={textOf(c, "action")} />;
}

const partHead = (section: BlockSection, intro = "intro") => ({
  index: pad(Math.max(section.ordinal, 0) + 1),
  label: textOf(section.content, "label"),
  title: textOf(section.content, "title"),
  intro: textOf(section.content, intro),
});

function HighlightsBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  return <ProjectHighlights head={partHead(section)} projects={chosen(section, "projects", ctx).map((p) => projectView(p, ctx))} refLabel={textOf(c, "refLabel")} action={textOf(c, "action")} />;
}

/** The gallery's projects: its selection, the projects the site may show only. */
const galleryProjects = (section: BlockSection, ctx: RenderContext) => chosen(section, "projects", ctx).filter((p) => showcased(p, ctx));

function GalleryBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const projects = galleryProjects(section, ctx).map((p) => projectView(p, ctx));
  return (
    <GallerySection
      head={partHead(section)}
      projects={projects}
      options={filterOptionsOf(projects, ctx)}
      labels={{ group: textOf(c, "filterLabel"), all: textOf(c, "all"), showing: textOf(c, "showing"), ref: textOf(c, "refLabel"), view: textOf(c, "view") }}
    />
  );
}

/** The index: every project the gallery may show, by reference (as today). */
const indexed = (ctx: RenderContext) =>
  showcasedProjects(ctx)
    .map((p) => projectView(p, ctx))
    .sort((a, b) => refOrder(a.ref) - refOrder(b.ref));

function IndexBlock({ section, ctx }: BlockProps) {
  return <ProjectIndex head={partHead(section, "note")} projects={indexed(ctx)} />;
}

// --- The project page template ---------------------------------------------------------------------------------------------

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

/** The details a record holds, in today's order, with the labels of the details block (none when no labels are given). */
function detailFields(record: PreviewProject, ctx: RenderContext, labels: Content | null): { rows: DetailField[]; passages: DetailField[] } {
  const { locale } = ctx;
  const client = record.details.clientName[locale] ?? (record.client ? ctx.records.clients.find((c) => c.id === record.client && !c.archived)?.name[locale] : undefined) ?? undefined;
  const values: Record<DetailKey, string | undefined> = {
    client,
    location: record.details.location[locale] ?? undefined,
    year: record.year ? String(record.year) : undefined,
    materials: record.details.materials[locale] ?? undefined,
    scope: record.details.scope[locale] ?? undefined,
    description: record.details.description[locale]?.join(" ") || undefined,
    challenge: record.details.challenge[locale] ?? undefined,
    solution: record.details.solution[locale] ?? undefined,
  };
  const field = (key: DetailKey): DetailField[] => {
    const value = values[key]?.trim();
    return value ? [{ key, label: textOf(labels, key), value }] : [];
  };
  return {
    rows: (["client", "location", "year", "materials", "scope"] as const).flatMap(field),
    passages: (["description", "challenge", "solution"] as const).flatMap(field),
  };
}

/** The photos a project page may show (none for a restricted project), with today's alt text rule. */
function detailPhotos(record: PreviewProject, ctx: RenderContext, title: string, photoAlt: string): DetailPhoto[] {
  if (record.restrictions.length) return [];
  const ids = record.media.filter((id) => !imageProblem(id, ctx));
  return ids.map((id, i) => {
    const image = commerceImage(id, ctx, "");
    return {
      id,
      src: image.src,
      width: image.width,
      height: image.height,
      blurDataURL: image.blurDataURL,
      alt: ids.length === 1 ? title : fill(photoAlt, { title, n: String(i + 1), total: String(ids.length) }),
      ...(image.unoptimized ? { unoptimized: true as const } : {}),
    };
  });
}

/** The sample project as its page shows it (the opening's texts give the source, the reference label and the alt text rule). */
function detailView(record: PreviewProject, ctx: RenderContext, opening: Content | null, labels: Content | null): ProjectDetailView {
  const { locale } = ctx;
  const title = record.title[locale] ?? "";
  const categories = record.categories.map((id) => categoryOf(id, ctx)).filter((c): c is CategoryView => c !== null);
  const services = record.services
    .map((id) => ctx.records.services.find((s) => s.id === id && !s.archived))
    .filter((s) => s !== undefined)
    .map((s) => ({ slug: s.slug as ServiceSlug, name: s.name[locale] ?? "", href: ctx.hrefOf(locale, "service", { slug: s.slug }), tone: serviceTone[s.slug as ServiceSlug] ?? "steel" }));
  const ref = record.ref ?? "";
  return {
    slug: record.slug,
    title,
    summary: record.summary[locale] ?? "",
    ref,
    refLabel: isPageReference(ref) ? null : textOf(opening, "refLabel"),
    source: textOf(opening, "source"),
    tone: categories[0]?.tone ?? "brand",
    categories,
    services,
    photos: detailPhotos(record, ctx, title, textOf(opening, "photoAlt")),
    ...detailFields(record, ctx, labels),
  };
}

/** The sample project the template is shown with. */
const sampleOf = (ctx: RenderContext) => ctx.project;

function ProjectOpeningBlock({ section, ctx }: BlockProps) {
  const record = sampleOf(ctx)!;
  const { locale } = ctx;
  const c = section.content;
  const view = detailView(record, ctx, c, null);
  const dict = getDictionary(locale);
  const breadcrumb = [
    { href: ctx.hrefOf(locale, "home"), label: dict.common.home },
    { href: ctx.hrefOf(locale, "projects"), label: routeLabels.projects[locale] },
    { href: ctx.hrefOf(locale, "project", { slug: record.slug }), label: view.title },
  ];
  return (
    <ProjectOpening
      view={view}
      breadcrumb={breadcrumb}
      breadcrumbLabel={dict.a11y.breadcrumb}
      labels={{ eyebrow: textOf(c, "eyebrow"), classification: textOf(c, "classification"), services: textOf(c, "services"), quote: textOf(c, "quote"), back: textOf(c, "back") }}
      quoteHref={ctx.hrefOf(locale, "contact", { hash: "quote" })}
      backHref={ctx.hrefOf(locale, "projects")}
    />
  );
}

function ProjectPhotosBlock({ section, ctx }: BlockProps) {
  const record = sampleOf(ctx)!;
  const view = detailView(record, ctx, ctx.layout.opening, null);
  return <ProjectPhotos title={textOf(section.content, "title")} intro={textOf(section.content, "intro")} photos={view.photos.slice(1)} />;
}

function ProjectDetailsBlock({ section, ctx }: BlockProps) {
  const record = sampleOf(ctx)!;
  const { rows, passages } = detailFields(record, ctx, section.content);
  return <ProjectDetails title={textOf(section.content, "title")} rows={rows} passages={passages} />;
}

const NO_SAMPLE = "there is no project to show this template with (it is shown with the first project in the collection that has photos).";

export const PROJECTS_RENDERERS = {
  "projects.featured": FeaturedBlock,
  "projects.highlights": HighlightsBlock,
  "projects.gallery": GalleryBlock,
  "projects.index": IndexBlock,
  "project.hero": ProjectOpeningBlock,
  "project.photos": ProjectPhotosBlock,
  "project.details": ProjectDetailsBlock,
} as const;

export const PROJECTS_ABSENT = {
  "projects.featured": ({ section, ctx }: BlockProps) => (chosen(section, "project", ctx).length ? null : "no project is chosen (or the chosen one is archived)."),
  "projects.highlights": ({ section, ctx }: BlockProps) => (chosen(section, "projects", ctx).length ? null : "no projects are chosen (or every chosen one is archived)."),
  "projects.index": ({ ctx }: BlockProps) => (showcasedProjects(ctx).length ? null : "no project has a photo that may be shown, so there is nothing to list."),
  "project.hero": ({ ctx }: BlockProps) => (sampleOf(ctx) ? null : NO_SAMPLE),
  "project.photos": ({ ctx }: BlockProps) => {
    const record = sampleOf(ctx);
    if (!record) return NO_SAMPLE;
    return detailPhotos(record, ctx, "", "").length > 1 ? null : "the sample project has no more photographs (its first photo, if any, leads the opening).";
  },
  "project.details": ({ ctx }: BlockProps) => {
    const record = sampleOf(ctx);
    if (!record) return NO_SAMPLE;
    const { rows, passages } = detailFields(record, ctx, null);
    return rows.length || passages.length ? null : "the sample project holds none of these details yet (only the details a record holds are ever shown).";
  },
} as const;

export const PROJECTS_NOTES = {
  "projects.featured": ({ section, ctx }: BlockProps) => projectNotes(chosen(section, "project", ctx), ctx),
  "projects.highlights": ({ section, ctx }: BlockProps) => projectNotes(chosen(section, "projects", ctx), ctx),
  "projects.gallery": ({ section, ctx }: BlockProps) =>
    chosen(section, "projects", ctx)
      .filter((p) => !showcased(p, ctx))
      .map((p) => `The project “${label(p.title, p.slug)}” is not in the gallery: only projects with a photo that may be shown are (as today).`),
  "projects.index": ({ ctx }: BlockProps) => {
    const left = resolveSelection("project", automatic("all", 200), ctx.records).items.filter((p) => !showcased(p, ctx));
    return left.length ? [`Not listed (no photo that may be shown, as today): ${left.map((p) => `“${label(p.title, p.slug)}”`).join(", ")}.`] : [];
  },
  "project.hero": ({ ctx }: BlockProps) => {
    const record = sampleOf(ctx);
    if (!record) return [];
    const name = label(record.title, record.slug);
    const notes = [`Shown with the project “${name}” (the first project in the collection that has photos).`];
    if (record.restrictions.length) notes.push(`The project is restricted (${record.restrictions.join(", ")}): its page shows no photos.`);
    else {
      const left = record.media.filter((id) => imageProblem(id, ctx));
      if (left.length) notes.push(`${left.length} of its photos ${left.length === 1 ? "is" : "are"} left out (${[...new Set(left.map((id) => imageProblem(id, ctx)))].join("; ")}).`);
    }
    if (!record.title[ctx.locale]) notes.push(`The project has no ${LANGUAGE[ctx.locale]} title yet.`);
    return notes;
  },
} as const;
