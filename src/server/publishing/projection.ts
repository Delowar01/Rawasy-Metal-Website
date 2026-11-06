/**
 * The public projection (A8.2, A1-PUBLISHING-VERSIONS §1): what of a published version the public site may read — the
 * snapshot without admin-only fields (provenance, flags, a certificate's expiry date, a form's notification addresses
 * and retention), language states, hidden sections, hidden menu items or phones. Media stay ids: the public renderer
 * shows an item only while A4's `public_media` holds it, so a later restriction withdraws it at once without a
 * republish. Pure.
 */
import { CONTENT_AGGREGATES, PROJECTION_SCHEMA_VERSION, type AggregateType } from "./registry.ts";
import type { Snapshot } from "./snapshot.ts";

const ADMIN_ONLY_ROOT = new Set(["sourceBasis", "sourcePages", "sourceNote", "expiresOn"]);
const ADMIN_ONLY_FORM_SETTINGS = new Set(["notificationEmails", "retentionDays"]);

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(asRecord) : []);
const omit = (row: Record<string, unknown>, keys: ReadonlySet<string>) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.has(k)));
const isContent = (type: AggregateType) => (CONTENT_AGGREGATES as readonly string[]).includes(type);

const publicTexts = (texts: unknown) =>
  Object.fromEntries(Object.entries(asRecord(texts)).map(([locale, row]) => [locale, row ? omit(asRecord(row), new Set(["translationStatus"])) : null]));

const sectionContent = (texts: unknown) => Object.fromEntries(Object.entries(asRecord(texts)).map(([locale, t]) => [locale, t ? asRecord(t).content ?? null : null]));

export interface Projection {
  schemaVersion: number;
  slug: string | null;
  document: Record<string, unknown>;
}

export function projectSnapshot(type: AggregateType, snapshot: Snapshot): Projection {
  if (isContent(type)) {
    const root = omit(asRecord(snapshot.root), ADMIN_ONLY_ROOT);
    const document: Record<string, unknown> = {
      root,
      texts: publicTexts(snapshot.texts),
      relations: asRecord(snapshot.relations),
      children: list(snapshot.children).map((c) => ({ id: c.id, media: c.media ?? null, texts: c.texts ?? {} })),
      mediaLists: asRecord(snapshot.mediaLists),
    };
    if (Array.isArray(snapshot.layout)) {
      document.layout = list(snapshot.layout)
        .filter((s) => s.visible === true)
        .map((s) => ({ id: s.id, blockType: s.blockType, schemaVersion: s.schemaVersion, devices: s.devices, anchor: s.anchor ?? null, reusableId: s.reusableId ?? null, settings: s.reusableId ? null : s.settings, content: s.reusableId ? null : sectionContent(s.texts) }));
    }
    return { schemaVersion: PROJECTION_SCHEMA_VERSION, slug: typeof root.slug === "string" ? root.slug : null, document };
  }
  switch (type) {
    case "reusable_section":
      return { schemaVersion: PROJECTION_SCHEMA_VERSION, slug: null, document: { blockType: snapshot.blockType, schemaVersion: snapshot.schemaVersion, settings: snapshot.settings, content: sectionContent(snapshot.texts) } };
    case "ordering":
      return { schemaVersion: PROJECTION_SCHEMA_VERSION, slug: null, document: { collection: snapshot.collection, items: Array.isArray(snapshot.items) ? snapshot.items : [] } };
    case "menu":
      return {
        schemaVersion: PROJECTION_SCHEMA_VERSION,
        slug: null,
        document: { items: list(snapshot.items).filter((i) => i.isVisible === true).map((i) => ({ id: i.id, linkType: i.linkType, route: i.route ?? null, collection: i.collection ?? null, label: i.label ?? null })) },
      };
    case "site_settings": {
      const values = asRecord(snapshot.values);
      return {
        schemaVersion: PROJECTION_SCHEMA_VERSION,
        slug: null,
        document: {
          values: { ...values, phones: list(values.phones).filter((p) => p.isVisible === true) },
          primaryWhatsappPhoneId: snapshot.primaryWhatsappPhoneId ?? null,
          interfaceText: asRecord(snapshot.interfaceText),
        },
      };
    }
    case "form":
      return {
        schemaVersion: PROJECTION_SCHEMA_VERSION,
        slug: null,
        document: { key: snapshot.key, settings: omit(asRecord(snapshot.settings), ADMIN_ONLY_FORM_SETTINGS), copy: asRecord(snapshot.copy), fields: list(snapshot.fields) },
      };
  }
  return { schemaVersion: PROJECTION_SCHEMA_VERSION, slug: null, document: {} };
}
