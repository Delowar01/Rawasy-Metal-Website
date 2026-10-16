/**
 * What the page builder's private preview shows (A5 brief §16–§17, §36, §51–§53): the working copies of the A3 records
 * the sections name (services, projects, machines, clients, certificates, industries, project categories, generic pages)
 * and the A4 media items they need — read for one preview request, never cached, never published.
 *
 * Media follow A4's one deliverability rule: an item shows as an image only while it has a `public_media` row (public,
 * approved, no blocking flag, not in the Trash, a ready file); anything else is a placeholder that says why — and a
 * private item says only "Not available" (never its title, file or status). Projects with a blocking flag (A3) never
 * show their photos as if they were safe. Archived records are left out of what a section shows (each such omission is
 * a preview note).
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rowsOf } from "../cms/store.ts";
import { flagLabel, isBlockingFlag } from "../cms/registry.ts";
import { isBlockingMediaFlag, USAGE_STATUS_LABELS, type UsageStatus } from "../media/registry.ts";
import type { Locale } from "./fields.ts";

export type Loc<T> = { en: T | null; ar: T | null };

const emptyLoc = <T>(): Loc<T> => ({ en: null, ar: null });

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/** A paragraph document's text, paragraph by paragraph (A3 bodies are paragraph documents: plain text, line breaks). */
export function paragraphsOf(doc: unknown): string[] {
  const content = (doc as { content?: unknown[] } | null)?.content;
  if (!Array.isArray(content)) return [];
  return content
    .map((block) => {
      const inline = (block as { content?: unknown[] }).content;
      return Array.isArray(inline) ? inline.map((n) => ((n as { type: string }).type === "text" ? String((n as { text?: string }).text ?? "") : "\n")).join("") : "";
    })
    .filter((p) => p.trim() !== "");
}

// --- Records --------------------------------------------------------------------------------------------------------------

interface Base {
  id: string;
  slug: string;
  archived: boolean;
}

export interface PreviewService extends Base {
  group: string;
  icon: string;
  name: Loc<string>;
  tagline: Loc<string>;
  summary: Loc<string>;
  body: Loc<string[]>;
  highlights: Loc<string[]>;
  cover: string | null;
  coverAlt: Loc<string>;
  supporting: string | null;
  supportingAlt: Loc<string>;
  machines: string[];
  related: string[];
  featured: string[];
  gallery: { media: string; caption: Loc<string>; alt: Loc<string> }[];
}

export interface PreviewProject extends Base {
  ref: string | null;
  featured: boolean;
  year: number | null;
  /** The client record named as the project's client (A3), if any. */
  client: string | null;
  title: Loc<string>;
  summary: Loc<string>;
  /** The confirmed details a record may hold (none does today): only those it holds are ever shown. */
  details: { clientName: Loc<string>; location: Loc<string>; materials: Loc<string>; scope: Loc<string>; description: Loc<string[]>; challenge: Loc<string>; solution: Loc<string> };
  categories: string[];
  services: string[];
  media: string[];
  /** Labels of its blocking flags (A3): its photos are never shown while any is set. */
  restrictions: string[];
}

export interface PreviewMachine extends Base {
  powerWatts: number | null;
  /** The company profile's pages the record cites ("7"), as stored. */
  sourcePages: string | null;
  service: string | null;
  media: string | null;
  name: Loc<string>;
  shortName: Loc<string>;
  category: Loc<string>;
  capability: Loc<string>;
}

export interface PreviewClient extends Base {
  featured: boolean;
  logo: string | null;
  name: Loc<string>;
}

export interface PreviewCertificate extends Base {
  thumb: string | null;
  title: Loc<string>;
  issuer: Loc<string>;
  previews: { media: string; locale: Locale | null }[];
  /** The displayed facts (entity type, issued, status …), in order. */
  facts: { label: Loc<string>; value: Loc<string> }[];
}

export interface PreviewIndustry extends Base {
  classification: "profile_sector" | "website_classification";
  media: string | null;
  feature: string | null;
  name: Loc<string>;
  description: Loc<string>;
  services: string[];
}

export interface PreviewCategory extends Base {
  label: Loc<string>;
}

export interface PreviewRecords {
  services: PreviewService[];
  projects: PreviewProject[];
  machines: PreviewMachine[];
  clients: PreviewClient[];
  certificates: PreviewCertificate[];
  industries: PreviewIndustry[];
  categories: PreviewCategory[];
  pages: (Base & { title: Loc<string> })[];
}

type Row = Record<string, unknown>;

const ordered = (table: string, key: string, columns: string) =>
  sql.raw(
    `SELECT r.id, r.slug, (r.publication_status = 'archived') AS archived, ${columns} FROM ${table} r
       LEFT JOIN entity_ordering_items oi ON oi.ordering_key = '${key}' AND oi.entity_id = r.id
      WHERE r.deleted_at IS NULL ORDER BY oi.position IS NULL, oi.position, r.id`,
  );

/** Texts per language of rows keyed by `parent`. */
async function texts(db: Db, table: string, parent: string, columns: string[]): Promise<Map<string, Record<Locale, Row>>> {
  const rows = await rowsOf<Row>(db, sql.raw(`SELECT ${parent} AS parent, locale, ${columns.join(", ")} FROM ${table}`));
  const out = new Map<string, Record<Locale, Row>>();
  for (const row of rows) {
    const locale = row.locale as Locale;
    if (locale !== "en" && locale !== "ar") continue;
    const entry = out.get(String(row.parent)) ?? ({} as Record<Locale, Row>);
    entry[locale] = row;
    out.set(String(row.parent), entry);
  }
  return out;
}

const loc = <T>(entry: Record<Locale, Row> | undefined, column: string, map: (v: unknown) => T = (v) => v as T): Loc<T> => ({
  en: entry?.en && entry.en[column] !== null && entry.en[column] !== undefined ? map(entry.en[column]) : null,
  ar: entry?.ar && entry.ar[column] !== null && entry.ar[column] !== undefined ? map(entry.ar[column]) : null,
});

/** An ordered relation (owner → targets by position). */
async function relation(db: Db, table: string, owner: string, target: string): Promise<Map<string, string[]>> {
  const rows = await rowsOf<Row>(db, sql.raw(`SELECT ${owner} AS owner, ${target} AS target FROM ${table} ORDER BY ${owner}, position`));
  const out = new Map<string, string[]>();
  for (const row of rows) out.set(String(row.owner), [...(out.get(String(row.owner)) ?? []), String(row.target)]);
  return out;
}

const strings = (value: unknown) => {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
};

export async function loadPreviewRecords(db: Db): Promise<PreviewRecords> {
  const serviceTexts = await texts(db, "service_translations", "service_id", ["name", "tagline", "summary", "body", "highlights", "cover_alt", "supporting_alt"]);
  const machinesOf = await relation(db, "service_machines", "service_id", "machine_id");
  const relatedOf = await relation(db, "service_related_services", "service_id", "related_service_id");
  const featuredOf = await relation(db, "service_featured_projects", "service_id", "project_id");
  const galleryRows = await rowsOf<Row>(db, sql`SELECT g.id, g.service_id, g.media_id FROM service_gallery_items g ORDER BY g.service_id, g.position`);
  const galleryTexts = await texts(db, "service_gallery_item_translations", "item_id", ["caption", "alt"]);
  const services = (await rowsOf<Row>(db, ordered("services", "services", "r.service_group, r.icon_key, r.cover_media_id, r.supporting_media_id"))).map((r): PreviewService => {
    const t = serviceTexts.get(String(r.id));
    return {
      id: String(r.id),
      slug: String(r.slug),
      archived: Boolean(Number(r.archived)),
      group: String(r.service_group),
      icon: String(r.icon_key),
      name: loc(t, "name", String),
      tagline: loc(t, "tagline", String),
      summary: loc(t, "summary", String),
      body: loc(t, "body", (v) => paragraphsOf(parseJson(v))),
      highlights: loc(t, "highlights", strings),
      cover: (r.cover_media_id as string | null) ?? null,
      coverAlt: loc(t, "cover_alt", String),
      supporting: (r.supporting_media_id as string | null) ?? null,
      supportingAlt: loc(t, "supporting_alt", String),
      machines: machinesOf.get(String(r.id)) ?? [],
      related: relatedOf.get(String(r.id)) ?? [],
      featured: featuredOf.get(String(r.id)) ?? [],
      gallery: galleryRows
        .filter((g) => g.service_id === r.id)
        .map((g) => ({ media: String(g.media_id), caption: loc(galleryTexts.get(String(g.id)), "caption", String), alt: loc(galleryTexts.get(String(g.id)), "alt", String) })),
    };
  });

  const projectTexts = await texts(db, "project_translations", "project_id", ["title", "summary", "scope", "description", "materials", "location", "client_name", "challenge", "solution"]);
  const categoriesOf = await relation(db, "project_category_assignments", "project_id", "category_id");
  const servicesOf = await relation(db, "project_services", "project_id", "service_id");
  const mediaOf = await relation(db, "project_media", "project_id", "media_id");
  const flags = await rowsOf<Row>(db, sql`SELECT project_id, flag FROM project_flags`);
  const projects = (await rowsOf<Row>(db, ordered("projects", "projects", "r.gallery_ref, r.is_featured, r.year, r.client_id"))).map((r): PreviewProject => {
    const t = projectTexts.get(String(r.id));
    return {
      id: String(r.id),
      slug: String(r.slug),
      archived: Boolean(Number(r.archived)),
      ref: (r.gallery_ref as string | null) ?? null,
      featured: Boolean(Number(r.is_featured)),
      year: r.year === null || r.year === undefined ? null : Number(r.year),
      client: (r.client_id as string | null) ?? null,
      title: loc(t, "title", String),
      summary: loc(t, "summary", String),
      details: {
        clientName: loc(t, "client_name", String),
        location: loc(t, "location", String),
        materials: loc(t, "materials", String),
        scope: loc(t, "scope", String),
        description: loc(t, "description", (v) => paragraphsOf(parseJson(v))),
        challenge: loc(t, "challenge", String),
        solution: loc(t, "solution", String),
      },
      categories: categoriesOf.get(String(r.id)) ?? [],
      services: servicesOf.get(String(r.id)) ?? [],
      media: mediaOf.get(String(r.id)) ?? [],
      restrictions: flags.filter((f) => f.project_id === r.id && isBlockingFlag(String(f.flag))).map((f) => flagLabel(String(f.flag))),
    };
  });

  const machineTexts = await texts(db, "machine_translations", "machine_id", ["name", "short_name", "category", "capability"]);
  const machines = (await rowsOf<Row>(db, ordered("machines", "machines", "r.power_watts, r.primary_service_id, r.media_id, r.source_pages"))).map((r): PreviewMachine => {
    const t = machineTexts.get(String(r.id));
    return {
      id: String(r.id),
      slug: String(r.slug),
      archived: Boolean(Number(r.archived)),
      powerWatts: r.power_watts === null || r.power_watts === undefined ? null : Number(r.power_watts),
      sourcePages: (r.source_pages as string | null) ?? null,
      service: (r.primary_service_id as string | null) ?? null,
      media: (r.media_id as string | null) ?? null,
      name: loc(t, "name", String),
      shortName: loc(t, "short_name", String),
      category: loc(t, "category", String),
      capability: loc(t, "capability", String),
    };
  });

  const clientTexts = await texts(db, "client_translations", "client_id", ["name"]);
  const clients = (await rowsOf<Row>(db, ordered("clients", "clients", "r.is_featured, r.logo_media_id"))).map(
    (r): PreviewClient => ({
      id: String(r.id),
      slug: String(r.slug),
      archived: Boolean(Number(r.archived)),
      featured: Boolean(Number(r.is_featured)),
      logo: (r.logo_media_id as string | null) ?? null,
      name: loc(clientTexts.get(String(r.id)), "name", String),
    }),
  );

  const certificateTexts = await texts(db, "certificate_translations", "certificate_id", ["title", "issuer"]);
  // Only the redacted public previews: a private original never reaches a preview (A4).
  const previews = await rowsOf<Row>(db, sql`SELECT certificate_id, media_id, locale FROM certificate_documents WHERE role = 'public_preview' ORDER BY certificate_id, position`);
  const factRows = await rowsOf<Row>(db, sql`SELECT id, certificate_id FROM certificate_facts ORDER BY certificate_id, position`);
  const factTexts = await texts(db, "certificate_fact_translations", "fact_id", ["label", "value"]);
  const certificates = (await rowsOf<Row>(db, ordered("certificates", "certificates", "r.thumb_media_id"))).map((r): PreviewCertificate => {
    const t = certificateTexts.get(String(r.id));
    return {
      id: String(r.id),
      slug: String(r.slug),
      archived: Boolean(Number(r.archived)),
      thumb: (r.thumb_media_id as string | null) ?? null,
      title: loc(t, "title", String),
      issuer: loc(t, "issuer", String),
      previews: previews.filter((p) => p.certificate_id === r.id).map((p) => ({ media: String(p.media_id), locale: (p.locale as Locale | null) ?? null })),
      facts: factRows
        .filter((f) => f.certificate_id === r.id)
        .map((f) => ({ label: loc(factTexts.get(String(f.id)), "label", String), value: loc(factTexts.get(String(f.id)), "value", String) })),
    };
  });

  const industryTexts = await texts(db, "industry_translations", "industry_id", ["name", "description"]);
  const industryServices = await relation(db, "industry_services", "industry_id", "service_id");
  const industries = (await rowsOf<Row>(db, ordered("industries", "industries", "r.classification, r.media_id, r.feature_media_id"))).map((r): PreviewIndustry => {
    const t = industryTexts.get(String(r.id));
    return {
      id: String(r.id),
      slug: String(r.slug),
      archived: Boolean(Number(r.archived)),
      classification: r.classification === "profile_sector" ? "profile_sector" : "website_classification",
      media: (r.media_id as string | null) ?? null,
      feature: (r.feature_media_id as string | null) ?? null,
      name: loc(t, "name", String),
      description: loc(t, "description", String),
      services: industryServices.get(String(r.id)) ?? [],
    };
  });

  const categoryTexts = await texts(db, "project_category_translations", "category_id", ["label"]);
  const categories = (await rowsOf<Row>(db, ordered("project_categories", "project_categories", "1 AS one"))).map(
    (r): PreviewCategory => ({ id: String(r.id), slug: String(r.slug), archived: Boolean(Number(r.archived)), label: loc(categoryTexts.get(String(r.id)), "label", String) }),
  );

  const pageTexts = await texts(db, "page_translations", "page_id", ["title"]);
  const pages = (await rowsOf<Row>(db, sql`SELECT id, slug, (publication_status = 'archived') AS archived FROM pages WHERE page_type = 'generic' AND deleted_at IS NULL ORDER BY slug`)).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    archived: Boolean(Number(r.archived)),
    title: loc(pageTexts.get(String(r.id)), "title", String),
  }));

  return { services, projects, machines, clients, certificates, industries, categories, pages };
}

/** Every media id the records name (to resolve in one query). */
export function recordMediaIds(records: PreviewRecords): string[] {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => id && ids.add(id);
  for (const s of records.services) {
    add(s.cover);
    add(s.supporting);
    s.gallery.forEach((g) => add(g.media));
  }
  for (const p of records.projects) p.media.forEach(add);
  for (const m of records.machines) add(m.media);
  for (const c of records.clients) add(c.logo);
  for (const c of records.certificates) {
    add(c.thumb);
    c.previews.forEach((p) => add(p.media));
  }
  for (const i of records.industries) {
    add(i.media);
    add(i.feature);
  }
  return [...ids];
}

// --- Media ------------------------------------------------------------------------------------------------------------------

export interface PreviewImage {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
  /** Uploaded items are served by `/media/u/…`, which the image optimizer never takes (A4): shown as they are. */
  unoptimized?: true;
}

export type PreviewMedia =
  | { id: string; ok: true; kind: "image" | "document" | "svg"; image: PreviewImage; focal: { x: number; y: number } | null; alt: Loc<string> }
  | { id: string; ok: false; reason: string };

/** A 1 × 1 transparent placeholder for images without a blur preview (never a request). */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** The preview's view of media items: deliverable ones as images, the rest as reasons (private: "Not available"). */
export async function loadPreviewMedia(db: Db, ids: readonly string[]): Promise<Map<string, PreviewMedia>> {
  const unique = [...new Set(ids)].filter((id) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id));
  const out = new Map<string, PreviewMedia>();
  if (!unique.length) return out;
  const list = sql.join(
    unique.map((id) => sql`${id}`),
    sql`, `,
  );
  const assets = await rowsOf<Row>(db, sql`SELECT id, kind, visibility, usage_status, deleted_at IS NOT NULL AS trashed, current_file_id, focal_x, focal_y FROM media_assets WHERE id IN (${list})`);
  const rows = await rowsOf<Row>(db, sql`SELECT media_id, kind, src, width, height, blur_data_url, default_alt FROM public_media WHERE media_id IN (${list})`);
  const flags = await rowsOf<Row>(db, sql`SELECT media_id, flag FROM media_flags WHERE media_id IN (${list})`);
  const delivered = new Map(rows.map((r) => [String(r.media_id), r]));
  for (const id of unique) {
    const asset = assets.find((a) => a.id === id);
    if (!asset || asset.visibility !== "public") {
      out.set(id, { id, ok: false, reason: "Not available" });
      continue;
    }
    const row = delivered.get(id);
    if (!row) {
      const reasons: string[] = [];
      if (Number(asset.trashed)) reasons.push("In the Trash");
      if (asset.usage_status !== "approved") reasons.push(USAGE_STATUS_LABELS[asset.usage_status as UsageStatus] ?? String(asset.usage_status));
      if (flags.some((f) => f.media_id === id && isBlockingMediaFlag(String(f.flag)))) reasons.push("Blocking flag");
      if (!asset.current_file_id) reasons.push("No ready file");
      out.set(id, { id, ok: false, reason: reasons.length ? reasons.join(", ") : "Not deliverable yet" });
      continue;
    }
    const src = String(row.src);
    const alt = parseJson(row.default_alt) as Partial<Record<Locale, string>> | null;
    out.set(id, {
      id,
      ok: true,
      kind: row.kind as "image" | "document" | "svg",
      image: {
        src,
        width: Number(row.width ?? 0) || 1200,
        height: Number(row.height ?? 0) || 800,
        blurDataURL: (row.blur_data_url as string | null) || BLANK,
        ...(src.startsWith("/media/u/") ? { unoptimized: true as const } : {}),
      },
      focal: asset.focal_x !== null && asset.focal_y !== null ? { x: Number(asset.focal_x), y: Number(asset.focal_y) } : null,
      alt: { en: alt?.en ?? null, ar: alt?.ar ?? null },
    });
  }
  return out;
}

export const emptyRecords = (): PreviewRecords => ({ services: [], projects: [], machines: [], clients: [], certificates: [], industries: [], categories: [], pages: [] });
export { emptyLoc };
