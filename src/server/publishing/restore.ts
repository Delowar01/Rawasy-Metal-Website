/**
 * Restoring a version into the working copy (A8.1, A1 T17): an earlier snapshot is replayed through the very save path an
 * editor uses — the A3 record save (`updateItem`) and, for pages and services, the A5 layout save (`saveLayout`), the A5
 * reusable-section save — inside the caller's transaction. So everything a save checks still holds for a restore: the
 * version the page showed, permissions on the stored record, plain text, slugs, relations and the featured-project
 * invariant, media rules, block schemas, structure, the certificate guard. A restore never rewrites history: it writes
 * a new revision (kind `restore`). What can't be restored any more (a deleted relation target, media now private,
 * a structure change the restorer may not make) is refused with the save's own messages, and nothing is changed.
 *
 * Menus, the site settings with their interface text, forms and collection orders are restored through their own saves
 * (A6, A7, A3 order rules) in the same way.
 *
 * Kept as they are now, never restored: project flags (safety controls of the present), robots / canonical / sitemap
 * fields for someone without `seo.advanced`, a layout that the restored version had not set up yet.
 */
import type { Actor, RequestMeta } from "../auth/types.ts";
import type { CmsDeps, FieldErrors } from "../cms/store.ts";
import { altMode, editorValue, readStored, updateItem, type KindSpec } from "../cms/engine.ts";
import { SPECS } from "../cms/kinds.ts";
import { pageTypeOf } from "../cms/pages.ts";
import { LOCALES, type EntityType } from "../cms/registry.ts";
import type { Db } from "../db/client.ts";
import { readSections } from "../builder/store.ts";
import { sql } from "drizzle-orm";
import { lockOrdering, readOrder, touchOrdering } from "../cms/store.ts";
import { can } from "../cms/permissions.ts";
import { ORDERINGS, ORDERING_KEYS, type OrderingKey } from "../cms/registry.ts";
import { readMenus, saveMenu } from "../site/menus.ts";
import { saveSettings } from "../site/settings.ts";
import { saveUiText } from "../site/ui-text.ts";
import { UI_STRINGS } from "../site/registry.ts";
import { saveForm } from "../forms/forms.ts";
import { saveLayout } from "../builder/sections.ts";
import { updateReusable } from "../builder/reusable.ts";
import { CONTENT_AGGREGATES, type AggregateType } from "./registry.ts";
import type { Snapshot } from "./snapshot.ts";

export interface RestoreChange {
  deps: CmsDeps;
  actor: Actor;
  meta: RequestMeta;
}

export type RestoreOutcome =
  | { kind: "ok"; notes: string[] }
  | { kind: "refused"; message: string; errors?: FieldErrors; issues?: { path?: string; ref?: string; message: string }[] }
  | { kind: "stale" }
  | { kind: "not_found" }
  | { kind: "denied"; message: string }
  | { kind: "archived" }
  | { kind: "unsupported"; message: string };

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const isContent = (type: AggregateType): type is EntityType => (CONTENT_AGGREGATES as readonly string[]).includes(type);

/** A form value as the editor would send it (checkboxes "on" or absent, everything else as text). */
function formValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value ? "on" : undefined;
  return String(value);
}

/** The editor form that saves a snapshot's record (A3's form shape: languages, relations, items, media, SEO, source). */
export function contentForm(spec: KindSpec, snapshot: Snapshot, lockVersion: number, options: { seoAdvanced: boolean; childIds: ReadonlySet<string> }): Record<string, unknown> {
  const root = asRecord(snapshot.root);
  const texts = asRecord(snapshot.texts);
  const form: Record<string, unknown> = { lockVersion: String(lockVersion), otherUnaffected: "on" };
  if (typeof root.slug === "string") form.slug = root.slug;
  for (const locale of LOCALES) {
    const row = texts[locale] ? asRecord(texts[locale]) : null;
    const values: Record<string, unknown> = {};
    for (const field of spec.fields) {
      const stored = row?.[field.key];
      if (field.kind === "alt") {
        values[field.key] = typeof stored === "string" ? stored : "";
        values[`${field.key}Mode`] = altMode(stored ?? null);
      } else values[field.key] = editorValue(field, stored);
    }
    if (row?.translationStatus === "complete") values.complete = "on";
    form[locale] = values;
  }
  const relations = asRecord(snapshot.relations);
  form.rel = Object.fromEntries((spec.relations ?? []).map((r) => [r.key, Array.isArray(relations[r.key]) ? relations[r.key] : []]));
  if (spec.children) {
    const c = spec.children;
    const blank = Object.fromEntries(c.texts.map((t) => [t.key, t.alt ? null : ""]));
    const children = Array.isArray(snapshot.children) ? snapshot.children.map(asRecord) : [];
    form.children = JSON.stringify(
      children.map((child) => {
        const t = asRecord(child.texts);
        const id = typeof child.id === "string" && options.childIds.has(child.id) ? child.id : null;
        return { id, ...(c.mediaKey ? { media: child.media } : {}), en: t.en ? { ...blank, ...asRecord(t.en) } : blank, ar: t.ar ? { ...blank, ...asRecord(t.ar) } : blank };
      }),
    );
  }
  if (spec.mediaSlots?.length) form.media = Object.fromEntries(spec.mediaSlots.map((m) => [m.key, typeof root[m.key] === "string" ? root[m.key] : ""]));
  if (spec.mediaLists?.length) {
    const lists = asRecord(snapshot.mediaLists);
    form.mediaList = Object.fromEntries(
      spec.mediaLists.map((list) => [
        list.key,
        JSON.stringify((Array.isArray(lists[list.key]) ? (lists[list.key] as unknown[]) : []).map((e: unknown) => ({ media: asRecord(e).media, ...(list.localeKey ? { locale: asRecord(e).locale ?? null } : {}) }))),
      ]),
    );
  }
  if (spec.hasSeo && options.seoAdvanced) {
    form.seo = {
      advanced: "1",
      robotsIndex: formValue(Boolean(root.robotsIndex)),
      robotsFollow: formValue(Boolean(root.robotsFollow)),
      inSitemap: formValue(Boolean(root.inSitemap)),
      canonicalOverride: typeof root.canonicalOverride === "string" ? root.canonicalOverride : "",
    };
  }
  if (spec.hasSource) {
    for (const key of ["sourceBasis", "sourcePages", "sourceNote"]) {
      const v = formValue(root[key]);
      if (v !== undefined) form[key] = v;
    }
  }
  for (const key of Object.keys(spec.rootShape)) {
    const v = formValue(root[key]);
    if (v !== undefined) form[key] = v;
  }
  return form;
}

/** The layout save that brings a snapshot's sections back (stored ids where they still exist, new sections otherwise). */
export function layoutPayload(type: "page" | "service", id: string, snapshot: Snapshot, expectedVersion: number, existing: ReadonlySet<string>) {
  const layout = Array.isArray(snapshot.layout) ? snapshot.layout.map(asRecord) : [];
  let n = 0;
  return {
    owner: { type, id },
    expectedVersion,
    sections: layout.map((s) => {
      const keep = typeof s.id === "string" && existing.has(s.id);
      const texts = asRecord(s.texts);
      const content = Object.fromEntries(LOCALES.filter((l) => texts[l]).map((l) => [l, asRecord(texts[l]).content]));
      const complete = Object.fromEntries(LOCALES.map((l) => [l, asRecord(texts[l]).status === "complete"]));
      const linked = typeof s.reusableId === "string";
      return {
        ref: keep ? (s.id as string) : `new:${++n}`,
        ...(keep ? {} : { blockType: s.blockType as string, ...(linked ? { reusableId: s.reusableId as string } : {}) }),
        visible: Boolean(s.visible),
        devices: asRecord(s.devices) as { desktop: boolean; tablet: boolean; mobile: boolean },
        anchor: typeof s.anchor === "string" ? s.anchor : null,
        ...(linked ? {} : { data: { settings: s.settings, content, complete, otherUnaffected: true } }),
      };
    }),
  };
}

const notesOf = (spec: KindSpec, seoAdvanced: boolean, keptLayout: boolean, type: EntityType) =>
  [
    ...(spec.hasSeo && !seoAdvanced ? ["Robots, canonical and sitemap settings were kept as they are (changing them needs seo.advanced)."] : []),
    ...(keptLayout ? ["That version had no layout set up: the current layout was kept."] : []),
    ...(type === "project" ? ["Project flags were kept as they are: a restore never adds or clears a flag."] : []),
  ];

/**
 * Restores a snapshot into the working copy, inside the caller's open content transaction (the services join it). The
 * caller rolls the transaction back unless the outcome is `ok`.
 */
export async function restoreSnapshot(change: RestoreChange, tx: Db, type: AggregateType, id: string, snapshot: Snapshot, expectedVersion: number): Promise<RestoreOutcome> {
  const ctx = { deps: change.deps, actor: change.actor, meta: change.meta };
  if (isContent(type)) {
    const spec = SPECS[type];
    const stored = await readStored(tx, spec, id);
    if (!stored) return { kind: "not_found" };
    const seoAdvanced = change.actor.permissions.has("seo.advanced");
    const form = contentForm(spec, snapshot, expectedVersion, { seoAdvanced, childIds: new Set(stored.children.map((c) => c.id)) });
    const saved = await updateItem(ctx, spec, id, form, type === "page" ? { pageTypeOf } : {});
    if (saved.kind === "stale") return { kind: "stale" };
    if (saved.kind === "not_found") return { kind: "not_found" };
    if (saved.kind === "archived") return { kind: "archived" };
    if (saved.kind === "denied") return { kind: "denied", message: saved.message };
    if (saved.kind !== "ok") return { kind: "refused", message: "That version can't be restored as it is: the save it replays was refused.", errors: "errors" in saved ? saved.errors : undefined };
    let keptLayout = false;
    if (type === "page" || type === "service") {
      const layout = Array.isArray(snapshot.layout) ? snapshot.layout : [];
      const current = await readSections(tx, { type, id }, { lock: false });
      if (!layout.length && current.length) keptLayout = true;
      else if (layout.length || current.length) {
        const payload = layoutPayload(type, id, snapshot, saved.lockVersion, new Set(current.map((s) => s.id)));
        const result = await saveLayout(ctx, payload);
        if (result.kind === "stale") return { kind: "stale" };
        if (result.kind === "denied") return { kind: "denied", message: result.message };
        if (result.kind === "invalid") return { kind: "refused", message: `The layout of that version can't be restored as it is: ${result.message}`, issues: result.issues };
        if (result.kind !== "ok") return { kind: "refused", message: "The layout of that version can't be restored." };
      }
    }
    return { kind: "ok", notes: notesOf(spec, seoAdvanced, keptLayout, type) };
  }
  if (type === "reusable_section") {
    const texts = asRecord(snapshot.texts);
    const result = await updateReusable(ctx, {
      id,
      expectedVersion,
      name: snapshot.name,
      data: {
        settings: snapshot.settings,
        content: Object.fromEntries(LOCALES.filter((l) => texts[l]).map((l) => [l, asRecord(texts[l]).content])),
        complete: Object.fromEntries(LOCALES.map((l) => [l, asRecord(texts[l]).status === "complete"])) as { en: boolean; ar: boolean },
        otherUnaffected: true,
      },
    });
    if (result.kind === "ok") return { kind: "ok", notes: [] };
    if (result.kind === "stale" || result.kind === "not_found" || result.kind === "archived") return { kind: result.kind };
    if (result.kind === "denied") return { kind: "denied", message: result.message };
    return { kind: "refused", message: "message" in result ? result.message : "That version can't be restored.", issues: "issues" in result ? result.issues : undefined };
  }
  if (type === "menu") {
    const current = (await readMenus(tx)).find((m) => m.key === id);
    if (!current) return { kind: "not_found" };
    if (snapshot.setUp !== true) return { kind: "refused", message: "That version of the menu was not set up yet: there is nothing to restore." };
    const known = new Set(current.items.map((i) => i.id));
    const items = (Array.isArray(snapshot.items) ? snapshot.items : []).map(asRecord).map((i) => ({
      id: typeof i.id === "string" && known.has(i.id) ? i.id : "",
      route: typeof i.route === "string" ? i.route : null,
      label: i.label ? (asRecord(i.label) as { en: string; ar: string }) : null,
      isVisible: Boolean(i.isVisible),
    }));
    return siteOutcome(await saveMenu(ctx, { key: id, expectedVersion, items }));
  }
  if (type === "site_settings") {
    if (snapshot.setUp !== true) return { kind: "refused", message: "That version of the settings was not set up yet: there is nothing to restore." };
    const v = asRecord(snapshot.values);
    const status = asRecord(snapshot.status);
    const texts = asRecord(v.texts);
    const saved = await saveSettings(ctx, {
      expectedVersion,
      websiteUrl: v.websiteUrl,
      email: v.email,
      postalCode: v.postalCode,
      geoLat: v.geoLat,
      geoLng: v.geoLng,
      geoIsApproximate: v.geoIsApproximate,
      facebookUrl: v.facebookUrl,
      mapsPlaceUrl: v.mapsPlaceUrl,
      mapsQuery: v.mapsQuery,
      defaultOgImageMediaId: v.defaultOgImageMediaId,
      phones: Array.isArray(v.phones) ? v.phones : [],
      texts: { en: texts.en, ar: texts.ar },
      complete: { en: status.en === "complete", ar: status.ar === "complete" },
      otherUnaffected: true,
    });
    const settingsOutcome = siteOutcome(saved);
    if (settingsOutcome.kind !== "ok" || saved.kind !== "ok") return settingsOutcome;
    // Every registered key (the interface-text save takes the whole set): a key that version did not hold is today's text.
    const stored = asRecord(snapshot.interfaceText);
    const values = Object.fromEntries(UI_STRINGS.map((def) => [def.key, { en: String(asRecord(stored[def.key]).en ?? ""), ar: String(asRecord(stored[def.key]).ar ?? "") }]));
    return siteOutcome(await saveUiText(ctx, { expectedVersion: saved.lockVersion, values }));
  }
  if (type === "form") {
    if (snapshot.setUp !== true) return { kind: "refused", message: "That version of the form was not set up yet: there is nothing to restore." };
    const status = asRecord(snapshot.status);
    const saved = await saveForm(ctx, id, {
      expectedVersion,
      settings: snapshot.settings,
      copy: snapshot.copy,
      fields: (Array.isArray(snapshot.fields) ? snapshot.fields : []).map(asRecord).map((f) => ({ id: f.id, isRequired: f.isRequired, minLength: f.minLength ?? null, maxLength: f.maxLength ?? null, texts: f.texts })),
      complete: { en: status.en === "complete", ar: status.ar === "complete" },
      otherUnaffected: true,
    });
    return siteOutcome(saved);
  }
  if (type === "ordering") return restoreOrdering(change, tx, id, snapshot, expectedVersion);
  return { kind: "unsupported", message: "Restoring an earlier version of this item is not available." };
}

/** A site or form save's outcome as a restore's. */
function siteOutcome(result: { kind: string; message?: string; issues?: { path: string; message: string }[] }): RestoreOutcome {
  switch (result.kind) {
    case "ok":
      return { kind: "ok", notes: [] };
    case "stale":
      return { kind: "stale" };
    case "not_found":
      return { kind: "not_found" };
    case "denied":
      return { kind: "denied", message: result.message ?? "You don't have permission to restore this." };
    default:
      return { kind: "refused", message: `That version can't be restored as it is: ${result.message ?? "the save it replays was refused."}`, issues: result.issues?.map((i) => ({ path: i.path, message: i.message })) };
  }
}

/**
 * A collection's order (`orderings.edit`, and `certificates.edit` for certificates — A3's move rule): the items of that
 * version that still exist, in its order, then any item added since, in today's order. Positions are renumbered through
 * a free range under the order's lock, and its version moves (an order page opened before is then stale).
 */
async function restoreOrdering(change: RestoreChange, tx: Db, key: string, snapshot: Snapshot, expectedVersion: number): Promise<RestoreOutcome> {
  if (!(ORDERING_KEYS as readonly string[]).includes(key)) return { kind: "not_found" };
  const type = ORDERINGS[key as OrderingKey];
  if (!can(change.actor.permissions, type, "reorder")) return { kind: "denied", message: "You don't have permission to change this collection's order." };
  const locked = await lockOrdering(tx, key as OrderingKey);
  if (!locked) return { kind: "not_found" };
  if (locked.lockVersion !== expectedVersion) return { kind: "stale" };
  const current = await readOrder(tx, key as OrderingKey, type);
  const present = new Set(current.map((c) => c.id));
  const wanted = (Array.isArray(snapshot.items) ? snapshot.items : []).filter((id): id is string => typeof id === "string" && present.has(id));
  const order = [...wanted, ...current.map((c) => c.id).filter((id) => !wanted.includes(id))];
  await tx.execute(sql`UPDATE entity_ordering_items SET position = position + 100000 WHERE ordering_key = ${key}`);
  for (const [i, id] of order.entries()) await tx.execute(sql`UPDATE entity_ordering_items SET position = ${i + 1} WHERE ordering_key = ${key} AND entity_id = ${id}`);
  await touchOrdering(tx, key as OrderingKey, change.actor.user.id, new Date());
  return { kind: "ok", notes: wanted.length < (Array.isArray(snapshot.items) ? snapshot.items.length : 0) ? ["Items of that version that no longer exist were left out."] : [] };
}
