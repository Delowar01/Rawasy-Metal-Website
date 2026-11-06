/**
 * Snapshots (A8.1, A1-PUBLISHING-VERSIONS §1): the whole working copy of one aggregate — root, both languages, ordered
 * children, relations, media and, for pages and services, their layout — as plain JSON, read inside the transaction
 * that changed it. Bookkeeping (versions, statuses, who and when) is left out, so two snapshots are equal exactly when
 * the content is; the revision row keeps who and when.
 *
 * A snapshot keeps admin-only fields too (provenance notes, project flags, a certificate's expiry date, a form's
 * notification addresses): revisions are ADMIN-ONLY (A1-CONTENT-MODEL §13). What the public may see is the projection
 * (`projection.ts`). Restoring never brings a flag back or takes one away: flags are safety controls of the present.
 */
import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { entityOrderingItems } from "../db/schema-cms.ts";
import { projectFlags } from "../db/schema-cms.ts";
import { readStored } from "../cms/engine.ts";
import { SPECS } from "../cms/kinds.ts";
import { ORDERINGS, type EntityType, type OrderingKey } from "../cms/registry.ts";
import { readReusable, readSections } from "../builder/store.ts";
import { readMenus } from "../site/menus.ts";
import { readSettings } from "../site/settings.ts";
import { readUiValues } from "../site/ui-text.ts";
import { readForm } from "../forms/forms.ts";
import { CONTENT_AGGREGATES, type AggregateType } from "./registry.ts";

export type Snapshot = Record<string, unknown>;

/** Root columns that are bookkeeping, not content (A1 §5 PUB and TS groups). */
const ROOT_BOOKKEEPING = new Set([
  "id",
  "lockVersion",
  "publicationStatus",
  "draftStatus",
  "publishedRevisionId",
  "currentRevisionId",
  "firstPublishedAt",
  "publishedAt",
  "publishedBy",
  "archivedAt",
  "archivedBy",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "deletedAt",
  "deletedBy",
]);
const TEXT_BOOKKEEPING = new Set(["locale", "completedAt", "completedBy", "updatedAt", "updatedBy"]);

/** JSON-safe, with object keys sorted (the canonical form hashed and compared). */
export function canonical(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonical(v);
    }
    return out;
  }
  return null;
}

export const canonicalJson = (value: unknown) => JSON.stringify(canonical(value));
export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest();

const without = (row: Record<string, unknown> | null, drop: ReadonlySet<string>, parentId?: string): Record<string, unknown> | null => {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).filter(([k, v]) => !drop.has(k) && !(parentId !== undefined && v === parentId && k.endsWith("Id"))));
};

const isContent = (type: AggregateType): type is EntityType => (CONTENT_AGGREGATES as readonly string[]).includes(type);

async function layoutOf(db: Db, type: "page" | "service", id: string) {
  const sections = await readSections(db, { type, id }, { lock: false });
  return sections.map((s) => ({
    id: s.id,
    blockType: s.blockType,
    schemaVersion: s.schemaVersion,
    visible: s.visible,
    devices: s.devices,
    locked: s.locked,
    anchor: s.anchor,
    reusableId: s.reusableId,
    detachedFromId: s.detachedFromId,
    settings: s.settings,
    texts: Object.fromEntries(Object.entries(s.translations).map(([locale, t]) => [locale, t ? { content: t.content, status: t.status } : null])),
  }));
}

async function contentSnapshot(db: Db, type: EntityType, id: string): Promise<Snapshot | null> {
  const spec = SPECS[type];
  const stored = await readStored(db, spec, id);
  if (!stored) return null;
  const snapshot: Snapshot = {
    root: without(stored.root, ROOT_BOOKKEEPING),
    texts: { en: without(stored.tr.en, TEXT_BOOKKEEPING, id), ar: without(stored.tr.ar, TEXT_BOOKKEEPING, id) },
    relations: stored.rel,
    children: stored.children.map((c) => ({ id: c.id, media: c.media, texts: c.tr })),
    mediaLists: stored.mediaLists,
  };
  if (type === "page" || type === "service") snapshot.layout = await layoutOf(db, type, id);
  if (type === "project") {
    const flags = await db.select({ flag: projectFlags.flag, note: projectFlags.note, createdAt: projectFlags.createdAt }).from(projectFlags).where(eq(projectFlags.projectId, id)).orderBy(asc(projectFlags.flag));
    snapshot.flags = flags;
  }
  return snapshot;
}

async function reusableSnapshot(db: Db, id: string): Promise<Snapshot | null> {
  const stored = await readReusable(db, id);
  if (!stored) return null;
  return {
    name: stored.name,
    blockType: stored.blockType,
    schemaVersion: stored.schemaVersion,
    settings: stored.settings,
    texts: Object.fromEntries(Object.entries(stored.translations).map(([locale, t]) => [locale, t ? { content: t.content, status: t.status } : null])),
  };
}

async function orderingSnapshot(db: Db, key: string): Promise<Snapshot | null> {
  if (!Object.hasOwn(ORDERINGS, key)) return null;
  const items = await db.select({ id: entityOrderingItems.entityId }).from(entityOrderingItems).where(eq(entityOrderingItems.orderingKey, key)).orderBy(asc(entityOrderingItems.position));
  return { collection: ORDERINGS[key as OrderingKey], items: items.map((i) => i.id) };
}

async function menuSnapshot(db: Db, key: string): Promise<Snapshot | null> {
  const menu = (await readMenus(db)).find((m) => m.key === key);
  if (!menu) return null;
  return { setUp: menu.setUp, items: menu.items };
}

async function settingsSnapshot(db: Db): Promise<Snapshot> {
  const settings = await readSettings(db);
  const ui = await readUiValues(db);
  return {
    setUp: settings.setUp,
    values: settings.values,
    status: settings.status,
    primaryWhatsappPhoneId: settings.primaryWhatsappPhoneId,
    interfaceText: Object.fromEntries([...ui.entries()].sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

async function formSnapshot(db: Db, id: string): Promise<Snapshot | null> {
  const form = await readForm(db, { id });
  if (!form) return null;
  return {
    key: form.key,
    setUp: form.setUp,
    settings: form.settings,
    copy: form.copy,
    status: form.status,
    fields: form.fields.map((f) => ({ id: f.id, key: f.key, position: f.position, isRequired: f.isRequired, minLength: f.minLength, maxLength: f.maxLength, texts: f.texts })),
  };
}

/** The working copy of an aggregate as a snapshot; null when it does not exist (or is in the Trash). */
export async function readSnapshot(db: Db, type: AggregateType, id: string): Promise<Snapshot | null> {
  if (isContent(type)) return contentSnapshot(db, type, id);
  switch (type) {
    case "reusable_section":
      return reusableSnapshot(db, id);
    case "ordering":
      return orderingSnapshot(db, id);
    case "menu":
      return menuSnapshot(db, id);
    case "site_settings":
      return id === "site" ? settingsSnapshot(db) : null;
    case "form":
      return formSnapshot(db, id);
  }
  return null;
}

/** A short title for lists and audit labels, from a snapshot (English first, then Arabic). */
export function snapshotTitle(type: AggregateType, snapshot: Snapshot | null): string {
  if (!snapshot) return "";
  if (isContent(type)) {
    const texts = snapshot.texts as Record<string, Record<string, unknown> | null> | undefined;
    for (const locale of ["en", "ar"]) {
      const t = texts?.[locale];
      const title = t && t[SPECS[type].titleKey];
      if (typeof title === "string" && title) return title;
    }
    const root = snapshot.root as Record<string, unknown> | undefined;
    return String(root?.slug ?? root?.systemKey ?? "");
  }
  if (type === "reusable_section") return String(snapshot.name ?? "");
  if (type === "ordering") return `Order of ${String(snapshot.collection ?? "")}`;
  return "";
}
