/**
 * Database access of the page builder (A5): the owner of a layout (a page or a service, its root row and lock version),
 * its sections and their translations, reusable sections and who links them. Statements use Drizzle's core builder with
 * bound values; table names come from code. Every read that a decision depends on inside a change is a locking read
 * (the owner's root FOR UPDATE first, then its sections FOR UPDATE), so a change is decided on the latest committed
 * layout, never on a snapshot (A3's gotcha: a plain read after a waiting lock can answer from an older view).
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { pageSections, pageSectionTranslations, reusableSectionTranslations } from "../db/schema-builder.ts";
import { pages, services } from "../db/schema-cms.ts";
import type { TranslationStatus } from "../cms/completeness.ts";
import { refLabel, refsByIds } from "../cms/lookups.ts";
import { instantOf, rowsOf } from "../cms/store.ts";
import type { OwnerKind, RecordCollection } from "./block.ts";
import { LOCALES, type Content, type Locale, type Settings } from "./fields.ts";
import { ownerKindOf } from "./structure.ts";

export type OwnerType = "page" | "service";

export interface OwnerRef {
  type: OwnerType;
  id: string;
}

export interface OwnerState {
  ref: OwnerRef;
  kind: OwnerKind;
  lockVersion: number;
  archived: boolean;
  /** The record's name (English title, else Arabic, else slug), for the editor and audit summaries. */
  label: string;
  slug: string | null;
}

/**
 * The owner of a layout, or null when it does not exist, is in the Trash or is a page type this code does not know.
 * `lock`: FOR UPDATE on the root row (every change starts here: A5 brief §33).
 */
export async function readOwner(db: Db, ref: OwnerRef, options: { lock: boolean }): Promise<OwnerState | null> {
  const lock = options.lock ? sql` FOR UPDATE` : sql``;
  let kind: OwnerKind | null;
  let row: { slug: string | null; lock_version: number; publication_status: string } | undefined;
  if (ref.type === "page") {
    const [found] = await rowsOf<{ slug: string | null; lock_version: number; publication_status: string; page_type: string; system_key: string | null }>(
      db,
      sql`SELECT slug, lock_version, publication_status, page_type, system_key FROM pages WHERE id = ${ref.id} AND deleted_at IS NULL${lock}`,
    );
    row = found;
    kind = found ? ownerKindOf({ pageType: found.page_type as never, systemKey: found.system_key }) : null;
  } else {
    const [found] = await rowsOf<{ slug: string | null; lock_version: number; publication_status: string }>(
      db,
      sql`SELECT slug, lock_version, publication_status FROM services WHERE id = ${ref.id} AND deleted_at IS NULL${lock}`,
    );
    row = found;
    kind = found ? "service" : null;
  }
  if (!row || !kind) return null;
  const [named] = await refsByIds(db, ref.type, [ref.id]);
  return {
    ref,
    kind,
    lockVersion: Number(row.lock_version),
    archived: row.publication_status === "archived",
    label: named ? refLabel(named) : row.slug ? `(${row.slug})` : "(untitled)",
    slug: row.slug,
  };
}

/** The owner's new version after a layout change (A5 brief §33: the root's lock_version is the layout's version). */
export async function bumpOwner(tx: Db, ref: OwnerRef, actorId: string, now: Date): Promise<void> {
  const root = ref.type === "page" ? pages : services;
  await tx
    .update(root)
    .set({ lockVersion: sql`${root.lockVersion} + 1`, updatedAt: now, updatedBy: actorId })
    .where(eq(root.id, ref.id));
}

export interface StoredTranslation {
  content: unknown;
  status: TranslationStatus;
  completedAt: Date | null;
  completedBy: string | null;
}

export interface StoredSection {
  id: string;
  blockType: string;
  schemaVersion: number;
  position: number;
  visible: boolean;
  devices: { desktop: boolean; tablet: boolean; mobile: boolean };
  locked: boolean;
  anchor: string | null;
  reusableId: string | null;
  detachedFromId: string | null;
  settings: unknown;
  translations: Partial<Record<Locale, StoredTranslation>>;
  updatedAt: Date;
}

const ownerColumn = (ref: OwnerRef) => (ref.type === "page" ? pageSections.pageId : pageSections.serviceId);

/** An owner's sections in order, with their translations. `lock`: FOR UPDATE on every section row. */
export async function readSections(db: Db, ref: OwnerRef, options: { lock: boolean }): Promise<StoredSection[]> {
  const query = db.select().from(pageSections).where(eq(ownerColumn(ref), ref.id)).orderBy(asc(pageSections.position));
  const rows = options.lock ? await query.for("update") : await query;
  if (!rows.length) return [];
  const translations = await db
    .select()
    .from(pageSectionTranslations)
    .where(
      inArray(
        pageSectionTranslations.sectionId,
        rows.map((r) => r.id),
      ),
    );
  const byId = new Map<string, Partial<Record<Locale, StoredTranslation>>>();
  for (const t of translations) {
    if (!LOCALES.includes(t.locale as Locale)) continue;
    const entry = byId.get(t.sectionId) ?? {};
    entry[t.locale as Locale] = { content: t.content, status: t.translationStatus, completedAt: t.completedAt, completedBy: t.completedBy };
    byId.set(t.sectionId, entry);
  }
  return rows.map((r) => ({
    id: r.id,
    blockType: r.blockType,
    schemaVersion: Number(r.schemaVersion),
    position: Number(r.position),
    visible: Boolean(r.isVisible),
    devices: { desktop: Boolean(r.showDesktop), tablet: Boolean(r.showTablet), mobile: Boolean(r.showMobile) },
    locked: Boolean(r.isLocked),
    anchor: r.anchor ?? null,
    reusableId: r.reusableSectionId ?? null,
    detachedFromId: r.detachedFromId ?? null,
    settings: r.settings,
    translations: byId.get(r.id) ?? {},
    updatedAt: r.updatedAt,
  }));
}

/** One section of an owner, FOR UPDATE; null when it does not exist or belongs to another owner (never told apart). */
export async function lockSection(tx: Db, ref: OwnerRef, sectionId: string): Promise<StoredSection | null> {
  const [row] = await tx
    .select({ id: pageSections.id })
    .from(pageSections)
    .where(and(eq(pageSections.id, sectionId), eq(ownerColumn(ref), ref.id)))
    .for("update");
  if (!row) return null;
  return (await readSections(tx, ref, { lock: true })).find((s) => s.id === sectionId) ?? null;
}

export interface SectionWrite {
  id: string;
  blockType: string;
  schemaVersion: number;
  visible: boolean;
  devices: { desktop: boolean; tablet: boolean; mobile: boolean };
  locked: boolean;
  anchor: string | null;
  reusableId: string | null;
  detachedFromId: string | null;
  settings: Settings;
}

export interface TranslationWrite {
  content: Content;
  status: TranslationStatus;
  completedAt: Date | null;
  completedBy: string | null;
}

/**
 * Writes an owner's layout: `kept` (existing rows, as they are now to be), `added` (new rows), every row at its place
 * (1, 2, 3 …) in `order`; rows of the owner listed in `removed` go. Only rows that change are written (a section whose
 * place, visibility, anchor, link or data is the same keeps its row untouched). Moved rows go through a free position
 * range and re-anchored rows drop their anchor first, so the unique (owner, position) and (owner, anchor) indexes never
 * see two rows at once — a swap of two places or of two anchors included.
 */
export async function writeLayout(
  tx: Db,
  ref: OwnerRef,
  input: { order: readonly string[]; kept: readonly SectionWrite[]; added: readonly SectionWrite[]; removed: readonly string[] },
  stored: readonly StoredSection[],
  actorId: string,
  now: Date,
): Promise<void> {
  const owner = ownerColumn(ref);
  const before = new Map(stored.map((s) => [s.id, s]));
  const place = new Map(input.order.map((id, i) => [id, i + 1]));
  if (input.removed.length) await tx.delete(pageSections).where(and(eq(owner, ref.id), inArray(pageSections.id, [...input.removed])));
  const moved = input.kept.filter((s) => before.get(s.id)?.position !== place.get(s.id)).map((s) => s.id);
  const reanchored = input.kept.filter((s) => (before.get(s.id)?.anchor ?? null) !== s.anchor).map((s) => s.id);
  if (moved.length) await tx.update(pageSections).set({ position: sql`${pageSections.position} + 1000000` }).where(and(eq(owner, ref.id), inArray(pageSections.id, moved)));
  if (reanchored.length) await tx.update(pageSections).set({ anchor: null }).where(and(eq(owner, ref.id), inArray(pageSections.id, reanchored)));
  for (const section of input.kept) {
    const old = before.get(section.id);
    const same =
      old &&
      old.position === place.get(section.id) &&
      old.blockType === section.blockType &&
      old.schemaVersion === section.schemaVersion &&
      old.visible === section.visible &&
      old.devices.desktop === section.devices.desktop &&
      old.devices.tablet === section.devices.tablet &&
      old.devices.mobile === section.devices.mobile &&
      old.anchor === section.anchor &&
      old.reusableId === section.reusableId &&
      old.detachedFromId === section.detachedFromId &&
      JSON.stringify(old.settings) === JSON.stringify(section.settings);
    if (same) continue;
    await tx
      .update(pageSections)
      .set({
        blockType: section.blockType,
        schemaVersion: section.schemaVersion,
        position: place.get(section.id)!,
        isVisible: section.visible,
        showDesktop: section.devices.desktop,
        showTablet: section.devices.tablet,
        showMobile: section.devices.mobile,
        anchor: section.anchor,
        reusableSectionId: section.reusableId,
        detachedFromId: section.detachedFromId,
        settings: section.settings,
        updatedAt: now,
        updatedBy: actorId,
      })
      .where(and(eq(pageSections.id, section.id), eq(owner, ref.id)));
  }
  if (input.added.length) {
    await tx.insert(pageSections).values(
      input.added.map((section) => ({
        id: section.id,
        pageId: ref.type === "page" ? ref.id : null,
        serviceId: ref.type === "service" ? ref.id : null,
        blockType: section.blockType,
        schemaVersion: section.schemaVersion,
        position: place.get(section.id)!,
        isVisible: section.visible,
        showDesktop: section.devices.desktop,
        showTablet: section.devices.tablet,
        showMobile: section.devices.mobile,
        isLocked: section.locked,
        anchor: section.anchor,
        reusableSectionId: section.reusableId,
        detachedFromId: section.detachedFromId,
        settings: section.settings,
        createdAt: now,
        createdBy: actorId,
        updatedAt: now,
        updatedBy: actorId,
      })),
    );
  }
}

/** Replaces a section's translations: a row per language given, none for a language left out (null). */
export async function writeSectionTranslations(tx: Db, sectionId: string, rows: Partial<Record<Locale, TranslationWrite | null>>, actorId: string, now: Date): Promise<void> {
  for (const locale of LOCALES) {
    if (!(locale in rows)) continue;
    const row = rows[locale];
    if (!row) {
      await tx.delete(pageSectionTranslations).where(and(eq(pageSectionTranslations.sectionId, sectionId), eq(pageSectionTranslations.locale, locale)));
      continue;
    }
    const values = { content: row.content, translationStatus: row.status, completedAt: row.completedAt, completedBy: row.completedBy, updatedAt: now, updatedBy: actorId };
    await tx
      .insert(pageSectionTranslations)
      .values({ sectionId, locale, ...values })
      .onDuplicateKeyUpdate({ set: values });
  }
}

// --- Reusable sections ---------------------------------------------------------------------------------------------------

export interface StoredReusable {
  id: string;
  name: string;
  blockType: string;
  schemaVersion: number;
  settings: unknown;
  lockVersion: number;
  archived: boolean;
  translations: Partial<Record<Locale, StoredTranslation>>;
  updatedAt: Date;
}

/**
 * A reusable section (not in the Trash), or null. `lock`: "update" (its own changes), "share" (a page section linking,
 * duplicating or detaching it: it can't be archived or changed meanwhile, A3's share-lock pattern) or none (display).
 * A locked read takes every column it returns in the locking statements themselves — the row, then its translations —
 * so a decision never rests on the transaction's older snapshot (A5 security review, F2: a link that read "archived" with
 * a plain select after its snapshot began could link a reusable section archived in between, and a detach could copy
 * texts older than an edit committed before it).
 */
export async function readReusable(db: Db, id: string, options: { lock?: "update" | "share" } = {}): Promise<StoredReusable | null> {
  const lock = options.lock === "update" ? sql` FOR UPDATE` : options.lock === "share" ? sql` LOCK IN SHARE MODE` : sql``;
  const [r] = await rowsOf<{ id: string; name: string; block_type: string; schema_version: number; settings: unknown; lock_version: number; publication_status: string; updated_at: unknown }>(
    db,
    sql`SELECT id, name, block_type, schema_version, settings, lock_version, publication_status, updated_at
          FROM reusable_sections WHERE id = ${id} AND deleted_at IS NULL${lock}`,
  );
  if (!r) return null;
  const rows = await rowsOf<{ locale: string; content: unknown; translation_status: TranslationStatus; completed_at: unknown; completed_by: string | null }>(
    db,
    sql`SELECT locale, content, translation_status, completed_at, completed_by
          FROM reusable_section_translations WHERE reusable_section_id = ${id} ORDER BY locale${lock}`,
  );
  const translations: Partial<Record<Locale, StoredTranslation>> = {};
  for (const t of rows) {
    if (LOCALES.includes(t.locale as Locale)) translations[t.locale as Locale] = { content: jsonOf(t.content), status: t.translation_status, completedAt: instantOf(t.completed_at), completedBy: t.completed_by };
  }
  return {
    id: r.id,
    name: r.name,
    blockType: r.block_type,
    schemaVersion: Number(r.schema_version),
    settings: jsonOf(r.settings),
    lockVersion: Number(r.lock_version),
    archived: r.publication_status === "archived",
    translations,
    updatedAt: instantOf(r.updated_at) ?? new Date(0),
  };
}

/** A JSON column of a raw query (MariaDB returns its JSON as text). */
const jsonOf = (value: unknown): unknown => (typeof value === "string" ? JSON.parse(value) : value);

/**
 * The reusable sections that new sections of a save will show (A5 security review, F1/F2): direct links, and duplicates
 * of linked sections (their link is read here; the owner's root lock, held already, keeps it as stored). Read with share
 * locks in id order, before the owner's sections are locked — the order a reusable section's own changes take (the
 * reusable row, then the sections linking it), so the two never wait for each other in a cycle.
 */
export async function lockLinkedReusables(tx: Db, ref: OwnerRef, entries: readonly { reusableId?: string | null; duplicateOf?: string }[]): Promise<Map<string, StoredReusable | null>> {
  const ids = new Set(entries.flatMap((e) => (e.reusableId ? [e.reusableId] : [])));
  const duplicated = [...new Set(entries.flatMap((e) => (e.duplicateOf ? [e.duplicateOf] : [])))];
  if (duplicated.length) {
    const rows = await rowsOf<{ reusable_section_id: string | null }>(
      tx,
      sql`SELECT reusable_section_id FROM page_sections WHERE ${ref.type === "page" ? sql`page_id` : sql`service_id`} = ${ref.id} AND id IN (${sql.join(
        duplicated.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    for (const row of rows) if (row.reusable_section_id) ids.add(row.reusable_section_id);
  }
  const out = new Map<string, StoredReusable | null>();
  for (const id of [...ids].sort()) out.set(id, await readReusable(tx, id, { lock: "share" }));
  return out;
}

/** Replaces a reusable section's translations (as `writeSectionTranslations`). */
export async function writeReusableTranslations(tx: Db, reusableId: string, rows: Partial<Record<Locale, TranslationWrite | null>>, actorId: string, now: Date): Promise<void> {
  for (const locale of LOCALES) {
    if (!(locale in rows)) continue;
    const row = rows[locale];
    if (!row) {
      await tx.delete(reusableSectionTranslations).where(and(eq(reusableSectionTranslations.reusableSectionId, reusableId), eq(reusableSectionTranslations.locale, locale)));
      continue;
    }
    const values = { content: row.content, translationStatus: row.status, completedAt: row.completedAt, completedBy: row.completedBy, updatedAt: now, updatedBy: actorId };
    await tx
      .insert(reusableSectionTranslations)
      .values({ reusableSectionId: reusableId, locale, ...values })
      .onDuplicateKeyUpdate({ set: values });
  }
}

export interface ReusableUse {
  sectionId: string;
  owner: OwnerRef;
}

/**
 * The page sections linking a reusable section ("Used by", A5 brief §45). `lock`: a locking read of the latest committed
 * links (an archive decides on it), else a plain read for display.
 */
export async function reusableUses(db: Db, reusableId: string, options: { lock: boolean } = { lock: false }): Promise<ReusableUse[]> {
  const rows = await rowsOf<{ id: string; page_id: string | null; service_id: string | null }>(
    db,
    sql`SELECT id, page_id, service_id FROM page_sections WHERE reusable_section_id = ${reusableId} ORDER BY id${options.lock ? sql` LOCK IN SHARE MODE` : sql``}`,
  );
  return rows.map((r) => ({ sectionId: r.id, owner: r.page_id ? { type: "page", id: r.page_id } : { type: "service", id: r.service_id! } }));
}

/** The slugs of the records whose ids bespoke blocks render on a page (`recordIds`), for anchor collisions. */
export async function recordSlugs(db: Db): Promise<Record<RecordCollection, string[]>> {
  const slugs = async (table: "machines" | "projects" | "certificates" | "services") =>
    (await rowsOf<{ slug: string | null }>(db, sql`SELECT slug FROM ${sql.identifier(table)} WHERE slug IS NOT NULL`)).map((r) => r.slug!).filter(Boolean);
  return { machine: await slugs("machines"), project: await slugs("projects"), certificate: await slugs("certificates"), service: await slugs("services") };
}

/**
 * The kinds of the owners whose sections link a reusable section (A5 security review, F1): where its texts are shown,
 * so an edit is checked as the copy of every one of those pages (the Certificates page keeps A3's digit guard). `uses`
 * comes from a locking read under the reusable row's lock; a page's kind never changes.
 */
export async function ownerKindsOf(db: Db, uses: readonly ReusableUse[]): Promise<OwnerKind[]> {
  const kinds = new Set<OwnerKind>();
  if (uses.some((u) => u.owner.type === "service")) kinds.add("service");
  const pageIds = [...new Set(uses.filter((u) => u.owner.type === "page").map((u) => u.owner.id))];
  if (pageIds.length) {
    const rows = await rowsOf<{ page_type: string; system_key: string | null }>(
      db,
      sql`SELECT page_type, system_key FROM pages WHERE id IN (${sql.join(
        pageIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    for (const row of rows) {
      const kind = ownerKindOf({ pageType: row.page_type as never, systemKey: row.system_key });
      if (kind) kinds.add(kind);
    }
  }
  return [...kinds];
}
