/**
 * The private preview's model (A5 brief §36–§40, §57–§58): one page's, service's or reusable section's working layout as
 * it would render after the A9 cutover — its visible sections for the chosen screen size, each section's data read
 * through the block registry (upcast and validated; anything unreadable becomes an admin-only placeholder with its
 * reason, never a crash and never a stack trace), the records and media the sections name, and a note list per section
 * (archived records left out, missing language, non-deliverable media, restricted projects, unset required settings).
 *
 * Read-only and per request. Who may see it is decided by the route (session, `content.view`, `preview.use`).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { systemPage } from "../cms/registry.ts";
import { rowsOf } from "../cms/store.ts";
import type { OwnerKind } from "./block.ts";
import { LOCALES, missingSettings, referencesOf, type Content, type Locale, type Settings } from "./fields.ts";
import { loadPreviewMedia, loadPreviewRecords, recordMediaIds, type PreviewMedia, type PreviewRecords, type PreviewService } from "./preview-data.ts";
import { readProblem, REGISTRY, type ReadResult } from "./registry.ts";
import { readSectionData } from "./sections.ts";
import { readOwner, readReusable, readSections, type OwnerRef } from "./store.ts";

export type PreviewKind = "page" | "service" | "reusable";
export type PreviewDevice = "desktop" | "tablet" | "mobile";

export interface PreviewSection {
  id: string;
  blockType: string;
  label: string;
  anchor: string | null;
  linked: boolean;
  /** "ok", or why the section can't be rendered (it renders as an admin-only placeholder). */
  state: string;
  problem: string | null;
  settings: Settings;
  /** The chosen language's texts (null: none yet). */
  content: Content | null;
  notes: string[];
}

export interface PreviewModel {
  kind: PreviewKind;
  ownerKind: OwnerKind | null;
  label: string;
  /** The owner's slug (null for the site's own pages without one and for a reusable section). */
  slug: string | null;
  archived: boolean;
  /**
   * The address the page will have after the A9 cutover, without the language (`/about`, `/services/<slug>`, `/<slug>`,
   * "/" for the homepage); a template's is its sample record's page; null where there is none (the 404, a reusable).
   */
  path: string | null;
  /** The record a template is shown with (the first project or service in order), named in the preview's notes. */
  sample: { type: "project" | "service"; id: string } | null;
  locale: Locale;
  device: PreviewDevice;
  sections: PreviewSection[];
  /** Sections the chosen screen size does not show (hidden, or off on this device), for the builder's notes. */
  skipped: { id: string; label: string; reason: string }[];
  records: PreviewRecords;
  media: Map<string, PreviewMedia>;
  /** A service's own record (its page's blocks show it). */
  service: PreviewService | null;
  /** The page record's facts a block shows (a legal page's effective date). */
  page: { systemKey: string | null; effectiveDate: string | null } | null;
}

const NAMES: Record<Locale, string> = { en: "English", ar: "Arabic" };

export async function loadPreview(db: Db, kind: PreviewKind, id: string, options: { locale: Locale; device: PreviewDevice }): Promise<PreviewModel | null> {
  const { locale, device } = options;
  let ownerKind: OwnerKind | null = null;
  let label: string;
  let slug: string | null = null;
  let archived = false;
  let stored: Awaited<ReturnType<typeof readSections>> = [];
  let page: PreviewModel["page"] = null;
  if (kind === "reusable") {
    const reusable = await readReusable(db, id);
    if (!reusable) return null;
    label = reusable.name;
    stored = [
      {
        id: reusable.id,
        blockType: reusable.blockType,
        schemaVersion: reusable.schemaVersion,
        position: 1,
        visible: true,
        devices: { desktop: true, tablet: true, mobile: true },
        locked: false,
        anchor: null,
        reusableId: null,
        detachedFromId: null,
        settings: reusable.settings,
        translations: reusable.translations,
        updatedAt: reusable.updatedAt,
      },
    ];
  } else {
    const ref: OwnerRef = { type: kind, id };
    const owner = await readOwner(db, ref, { lock: false });
    if (!owner) return null;
    ownerKind = owner.kind;
    label = owner.label;
    slug = owner.slug;
    archived = owner.archived;
    stored = await readSections(db, ref, { lock: false });
    if (kind === "page") {
      const [row] = await rowsOf<{ system_key: string | null; effective_date: unknown }>(db, sql`SELECT system_key, effective_date FROM pages WHERE id = ${id}`);
      page = { systemKey: row?.system_key ?? null, effectiveDate: row?.effective_date ? String(row.effective_date).slice(0, 10) : null };
    }
  }

  // Linked sections show their reusable section's data.
  const reusables = new Map<string, NonNullable<Awaited<ReturnType<typeof readReusable>>>>();
  for (const reusableId of new Set(stored.map((s) => s.reusableId).filter((v): v is string => Boolean(v)))) {
    const r = await readReusable(db, reusableId);
    if (r) reusables.set(reusableId, r);
  }

  const records = await loadPreviewRecords(db);
  const sections: PreviewSection[] = [];
  const skipped: PreviewModel["skipped"] = [];
  const mediaIds = new Set(recordMediaIds(records));
  for (const s of stored) {
    const def = REGISTRY.get(s.blockType);
    const name = def?.label ?? s.blockType;
    if (!s.visible) {
      skipped.push({ id: s.id, label: name, reason: "Hidden" });
      continue;
    }
    if (!s.devices[device]) {
      skipped.push({ id: s.id, label: name, reason: `Not shown on ${device === "mobile" ? "phones" : device === "tablet" ? "tablets" : "desktops"}` });
      continue;
    }
    const source = s.reusableId ? reusables.get(s.reusableId) : undefined;
    const read = s.reusableId
      ? source
        ? readSectionData({ blockType: source.blockType, schemaVersion: source.schemaVersion, settings: source.settings, translations: source.translations })
        : ({ state: "invalid", issues: [] } as ReadResult)
      : readSectionData(s);
    const notes: string[] = [];
    if (!def) {
      sections.push({ id: s.id, blockType: s.blockType, label: name, anchor: s.anchor, linked: Boolean(s.reusableId), state: "unknown_type", problem: readProblem({ state: "unknown_type" }), settings: {}, content: null, notes });
      continue;
    }
    if (read.state !== "ok") {
      const problem = s.reusableId && !source ? "The linked reusable section no longer exists." : readProblem(read);
      sections.push({ id: s.id, blockType: s.blockType, label: name, anchor: s.anchor, linked: Boolean(s.reusableId), state: read.state, problem, settings: {}, content: null, notes });
      continue;
    }
    const content = read.content[locale] ?? null;
    const hasText = Object.keys(def.content).length === 0 && !Object.values(def.settings).some((f) => f.kind === "items");
    if (!content && !hasText) notes.push(`No ${NAMES[locale]} text yet${LOCALES.some((l) => l !== locale && read.content[l]) ? ` (${NAMES[locale === "en" ? "ar" : "en"]} has text)` : ""}.`);
    const missing = missingSettings(def.settings, read.settings);
    if (missing.length) notes.push(`Not set yet: ${missing.join(", ")}.`);
    const refs = referencesOf(def.settings, def.content, read.settings, read.content);
    refs.media.forEach((m) => mediaIds.add(m.id));
    if (source?.archived) notes.push("The linked reusable section is archived.");
    sections.push({ id: s.id, blockType: s.blockType, label: name, anchor: s.anchor, linked: Boolean(s.reusableId), state: "ok", problem: null, settings: read.settings, content, notes });
  }
  // A template is shown with the first record of its kind in the collection's order (a project with photos first).
  let sample: PreviewModel["sample"] = null;
  if (ownerKind === "template:project_detail") {
    const live = records.projects.filter((p) => !p.archived);
    const project = live.find((p) => p.media.length > 0 && !p.restrictions.length) ?? live[0];
    if (project) sample = { type: "project", id: project.id };
  } else if (ownerKind === "template:service_detail_default") {
    const service = records.services.find((s) => !s.archived);
    if (service) sample = { type: "service", id: service.id };
  }
  const media = await loadPreviewMedia(db, [...mediaIds]);
  const service = kind === "service" ? (records.services.find((s) => s.id === id) ?? null) : sample?.type === "service" ? (records.services.find((s) => s.id === sample.id) ?? null) : null;
  return { kind, ownerKind, label, slug, archived, path: pathOf(ownerKind, slug, sample, records), sample, locale, device, sections, skipped, records, media, service, page };
}

/** The page's address after the cutover, without the language (see `PreviewModel.path`). */
function pathOf(kind: OwnerKind | null, slug: string | null, sample: PreviewModel["sample"], records: PreviewRecords): string | null {
  if (!kind) return null;
  if (kind === "home") return "/";
  if (kind === "service") return slug ? `/services/${slug}` : null;
  if (kind === "generic") return slug ? `/${slug}` : null;
  if (kind === "template:project_detail") {
    const project = sample ? records.projects.find((p) => p.id === sample.id) : undefined;
    return project ? `/projects/${project.slug}` : null;
  }
  if (kind === "template:service_detail_default") {
    const service = sample ? records.services.find((s) => s.id === sample.id) : undefined;
    return service ? `/services/${service.slug}` : null;
  }
  return systemPage(kind.slice(kind.indexOf(":") + 1))?.route ?? null;
}
