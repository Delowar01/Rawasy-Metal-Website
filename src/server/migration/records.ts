/**
 * A9.2 — the static records as A3 editor inputs (A1-MIGRATION-PLAN §4–§6): what an editor would type into each record's
 * form, so every value passes the same validation as an edit in the admin. Byte-exact where the CMS keeps text as written
 * (A1 rule 2); where A3 stores a structure (a description's paragraphs as a document, highlights as lines, source pages
 * as a list) the encoding is the editor's own, and `src/server/public/decode.ts` reads it back.
 *
 * Media are named by the release library's legacy keys (A4's importer registered every release file under its MediaId):
 * a key resolves only to an item A4 delivers. A held-back photo (one of the 13 restricted items, A1-MIGRATION-PLAN §7)
 * never enters a record; the reconciliation report lists each one left out.
 */
import type { ContentSet } from "../../content/static-set.ts";
import type { MediaId } from "../../content/media.generated.ts";
import type { EntityType } from "../cms/registry.ts";

export type Form = Record<string, unknown>;

/** How the import names what already exists: media by legacy key, records by slug. */
export interface ImportRefs {
  /** The library item of a release file, only while A4 delivers it (approved, not flagged, files present). */
  media(key: MediaId): string | null;
  /** A record created (or found) by this import. */
  id(type: EntityType, slug: string): string;
  /** A media reference left out (restricted, or not in the library): recorded for the reconciliation report. */
  leftOut(owner: string, key: MediaId, why: string): void;
}

type Localized<T = string> = { en: T; ar: T };

const COMPLETE = { complete: "1" } as const;
const both = <T>(value: Localized<T>, f: (v: T) => unknown, key: string): { en: Form; ar: Form } => ({ en: { [key]: f(value.en) }, ar: { [key]: f(value.ar) } });

/** Merges per-language fields into the form's `en` / `ar` groups. */
function locales(...parts: { en: Form; ar: Form }[]): { en: Form; ar: Form } {
  const out = { en: { ...COMPLETE } as Form, ar: { ...COMPLETE } as Form };
  for (const p of parts) {
    Object.assign(out.en, p.en);
    Object.assign(out.ar, p.ar);
  }
  return out;
}

const text = (value: Localized, key: string) => both(value, (v) => v, key);
/** A3's paragraph document is written as plain text, paragraphs separated by a blank line (the editor's own encoding). */
const paragraphs = (value: Localized<string[]>, key: string) => both(value, (v) => v.join("\n\n"), key);
/** A lines field: one item per line. */
const linesOf = (value: Localized<string[]>, key: string) => both(value, (v) => v.join("\n"), key);
/** An alt text written for a slot (mode "text"). */
const alt = (value: Localized, key: string) => ({ en: { [key]: value.en, [`${key}Mode`]: "text" }, ar: { [key]: value.ar, [`${key}Mode`]: "text" } });

/** Source pages as the A3 field takes them ("2, 5"); decoded back to the list. */
export const pagesText = (pages: readonly number[] | undefined) => (pages?.length ? pages.join(", ") : "");

function source(src: { basis: string; pages?: number[]; note?: string } | undefined): Form {
  if (!src) return {};
  return { sourceBasis: src.basis, sourcePages: pagesText(src.pages), sourceNote: src.note ?? "" };
}

function mediaOf(refs: ImportRefs, owner: string, key: MediaId | undefined): string {
  if (!key) return "";
  const id = refs.media(key);
  if (!id) refs.leftOut(owner, key, "not delivered by the media library (restricted or missing)");
  return id ?? "";
}

// --- Project categories ---------------------------------------------------------------------------------------------------

export function categoryForm(c: ContentSet["projectCategories"][number]): Form {
  return { slug: c.slug, ...locales(text(c.label, "label")) };
}

// --- Services (first pass: the record; relations to machines, projects and services follow once those exist) ------------

export function serviceForm(s: ContentSet["services"][number], refs: ImportRefs, relations: boolean, related: readonly string[]): Form {
  const owner = `service ${s.slug}`;
  const cover = mediaOf(refs, owner, s.cover);
  const supporting = mediaOf(refs, owner, s.supporting.media);
  const gallery = s.gallery
    .map((g) => ({ media: mediaOf(refs, owner, g.media), caption: g.caption }))
    .filter((g) => g.media)
    // The caption names the photo (it doubles as the alt text on the page: alt=""): the photo's own alt is decorative.
    .map((g) => ({ id: null, media: g.media, en: { caption: g.caption.en, alt: "" }, ar: { caption: g.caption.ar, alt: "" } }));
  return {
    slug: s.slug,
    serviceGroup: s.slug === "scaffolding" ? "scaffolding" : "metal",
    iconKey: s.slug,
    media: { coverMediaId: cover, supportingMediaId: supporting },
    rel: relations
      ? {
          machines: s.machines.map((m) => refs.id("machine", m)),
          relatedServices: related.map((r) => refs.id("service", r)),
          featuredProjects: s.projects.map((p) => refs.id("project", p)),
        }
      : {},
    children: JSON.stringify(gallery),
    ...locales(text(s.name, "name"), text(s.tagline, "tagline"), text(s.summary, "summary"), paragraphs(s.body, "body"), linesOf(s.highlights, "highlights"), alt(s.coverAlt, "coverAlt"), alt(s.supporting.alt, "supportingAlt")),
    ...source(s.source),
  };
}

// --- Machines --------------------------------------------------------------------------------------------------------------

export function machineForm(m: ContentSet["machines"][number], refs: ImportRefs): Form {
  return {
    slug: m.slug,
    powerWatts: m.powerWatts === undefined ? "" : String(m.powerWatts),
    primaryServiceId: refs.id("service", m.service),
    media: { mediaId: mediaOf(refs, `machine ${m.slug}`, m.media) },
    ...locales(text(m.name, "name"), text(m.shortName, "shortName"), text(m.category, "category"), text(m.capability, "capability")),
    ...source(m.source),
    children: "[]",
  };
}

// --- Projects --------------------------------------------------------------------------------------------------------------

/**
 * A project's photos: the ones A4 delivers, in record order. The ten photos held back by the static site's project and
 * file policy (three AI-watermarked files, seven of the five projects awaiting authorship or product-render confirmation)
 * are restricted library items: they are left out of the record (A8 publishes only deliverable media) and listed.
 */
export function projectForm(p: ContentSet["projects"][number], refs: ImportRefs): Form {
  const owner = `project ${p.slug}`;
  const photos = p.media.map((key) => mediaOf(refs, owner, key)).filter(Boolean);
  const flags = p.flags ?? [];
  const notes = [p.note, ...flags.filter((f) => f !== "ai-watermark").map((f) => FLAG_NOTE[f])].filter(Boolean);
  return {
    slug: p.slug,
    galleryRef: p.galleryRef,
    year: p.year === undefined ? "" : String(p.year),
    ...(p.featured ? { isFeatured: "1" } : {}),
    rel: { categories: p.categories.map((c) => refs.id("project_category", c)), services: p.services.map((s) => refs.id("service", s)) },
    mediaList: { photos: JSON.stringify(photos.map((media) => ({ media }))) },
    ...locales(text(p.title, "title"), text(p.summary, "summary")),
    sourceNote: notes.join("\n"),
  };
}

/**
 * The static site's two blocking project flags are recorded on the project's note and on each of its photos (restricted
 * in the library with the same flag, A4), not as A3 project flags: an A3 blocking flag takes the project's page offline
 * (A8), while the approved website shows these projects' pages without photos and outside the portfolio. The photos'
 * restriction alone reproduces that (no deliverable photo: not showcased, no photo on the page). Reported for the Owner.
 */
export const FLAG_NOTE: Record<string, string> = {
  "confirm-authorship": "Authorship unconfirmed (static flag confirm-authorship): every photo is held back as a restricted library item until RAWASY confirms authorship.",
  render: "Catalogue or 3D render (static flag render): every photo is held back as a restricted library item until RAWASY confirms the product.",
};

// --- Industries ------------------------------------------------------------------------------------------------------------

export const CLASSIFICATION = { profile: "profile_sector", inferred: "website_classification", licence: "profile_sector" } as const;

export function industryForm(i: ContentSet["industries"][number], refs: ImportRefs): Form {
  const owner = `industry ${i.slug}`;
  return {
    slug: i.slug,
    classification: CLASSIFICATION[i.source.basis],
    media: { mediaId: mediaOf(refs, owner, i.media), featureMediaId: mediaOf(refs, owner, i.feature) },
    rel: { services: i.services.map((s) => refs.id("service", s)), projects: [] },
    ...locales(text(i.name, "name"), text(i.description, "description")),
    ...source(i.source),
  };
}

// --- Clients ---------------------------------------------------------------------------------------------------------------

export function clientForm(c: ContentSet["clients"][number], refs: ImportRefs): Form {
  const owner = `client ${c.slug}`;
  return {
    slug: c.slug,
    media: { logoMediaId: mediaOf(refs, owner, c.logo), logoMonoMediaId: mediaOf(refs, owner, c.logoMono) },
    ...locales(text(c.name, "name")),
  };
}

// --- Certificates ----------------------------------------------------------------------------------------------------------

export function certificateForm(c: ContentSet["certificates"][number], refs: ImportRefs): Form {
  const owner = `certificate ${c.slug}`;
  const facts = c.facts.map((f) => ({ id: null, en: { label: f.label.en, value: f.value.en }, ar: { label: f.label.ar, value: f.value.ar } }));
  const previews = c.previews.map((key) => mediaOf(refs, owner, key)).filter(Boolean);
  return {
    slug: c.slug,
    media: { thumbMediaId: mediaOf(refs, owner, c.thumb) },
    mediaList: { previews: JSON.stringify(previews.map((media) => ({ media, locale: null }))) },
    children: JSON.stringify(facts),
    expiresOn: "",
    ...locales(text(c.title, "title"), text(c.issuer, "issuer")),
    ...source(c.source),
  };
}
