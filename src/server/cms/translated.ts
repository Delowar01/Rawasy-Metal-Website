/**
 * The translated fields of the eight content types — one declarative definition (A3 Correction 1). The editor reads it
 * for its forms, validation and completeness (`kinds.ts` → `engine.ts` `requiredFilled`), and the lists and pickers for
 * their SQL language states and titles (`list.ts` `localeStateSql`, `lookups.ts`), so a badge, a filter and the
 * editor's "complete" rule are decided from the same fields. (Until this correction the lists kept their own map of
 * required columns, in step with the editor by hand only.) `tests/unit/cms-completeness.test.ts` holds every type to it.
 *
 * A field is required for its language to be complete when `required` is set; its column is the translation table's
 * property of the same name — NOT NULL, holding "" (or an empty document, or an empty list) while missing. Child items
 * (machine attributes, certificate facts, and since A4 a service's gallery photos) need their required texts — label
 * and value, or a photo's caption — in a language for it to be complete. An alt text (A4) is never required: NULL means
 * not written yet, '' decorative.
 */
import { getTableName } from "drizzle-orm";
import type { AnyMySqlColumn, AnyMySqlTable } from "drizzle-orm/mysql-core";
import {
  certificateFacts,
  certificateFactTranslations,
  certificateTranslations,
  clientTranslations,
  industryTranslations,
  machineAttributes,
  machineAttributeTranslations,
  machineTranslations,
  pageTranslations,
  projectCategoryTranslations,
  projectTranslations,
  serviceGalleryItems,
  serviceGalleryItemTranslations,
  serviceTranslations,
} from "../db/schema-cms.ts";
import { ENTITY_TYPES, LIMITS, type EntityType } from "./registry.ts";

/** `alt` (A4): a photo's alt text — NULL not written yet, '' decorative, else the text; never required. */
export type TextKind = "line" | "text" | "rich" | "lines" | "alt";

/** A translated field: its column (property name), how it is edited and checked, and what completeness needs. */
export interface TrField {
  key: string;
  label: string;
  kind: TextKind;
  /** Characters (rich text: per paragraph; lines: per line). */
  max: number;
  /** Required for the language to be complete (a NOT NULL column holding "" while missing). */
  required?: boolean;
  /** Nullable column: stored NULL when empty (optional facts, A1 §3.5). */
  optional?: boolean;
  /** Lines: at most this many. */
  maxItems?: number;
  /** Public certificate text: the digit guard applies. */
  digitGuard?: boolean;
  /** Included in the admin search body. */
  search?: boolean;
  /** Shown in the SEO section of the editor. */
  seo?: boolean;
  hint?: string;
}

/** A translated text of a child item: a column of the child's translation table, by property name. */
export interface ChildText {
  key: string;
  label: string;
  max: number;
  /** Needed in a language for the item's language to be complete (a NOT NULL column holding "" while missing). */
  required?: boolean;
  /** An alt text (A4): NULL not written yet, '' decorative; never required. */
  alt?: boolean;
}

/** The tables of a type's child items: ordered entries with their texts per language (and, for a gallery, a photo). */
export interface ChildTables {
  table: AnyMySqlTable;
  idColumn: AnyMySqlColumn;
  parentColumn: AnyMySqlColumn;
  positionColumn: AnyMySqlColumn;
  parentKey: string;
  trTable: AnyMySqlTable;
  trParentColumn: AnyMySqlColumn;
  trLocaleColumn: AnyMySqlColumn;
  trParentKey: string;
  texts: readonly ChildText[];
  /** The child table's media column (property name), when each entry holds one media item (A4: the service gallery). */
  mediaKey?: string;
}

/** A type's translations: the table, the field the item is named by, the fields, and the child items if any. */
export interface TranslatedSpec {
  tr: AnyMySqlTable;
  trParentColumn: AnyMySqlColumn;
  trLocaleColumn: AnyMySqlColumn;
  trParentKey: string;
  /** The field used as the item's title (lists, pickers, audit, search). */
  titleKey: string;
  fields: readonly TrField[];
  /** Child items whose label and value a language needs before it is complete. */
  childTables?: ChildTables;
}

const T = LIMITS.text;

const SEO_FIELDS: TrField[] = [
  { key: "seoTitle", label: "SEO title", kind: "line", max: T.seoTitle, optional: true, seo: true, hint: "Falls back to the title. Over 60 characters may be cut by search engines." },
  { key: "seoDescription", label: "SEO description", kind: "line", max: T.seoDescription, optional: true, seo: true, hint: "Falls back to the summary. Over 160 characters may be cut." },
  { key: "ogTitle", label: "Share title", kind: "line", max: T.seoTitle, optional: true, seo: true, hint: "Falls back to the SEO title." },
  { key: "ogDescription", label: "Share description", kind: "line", max: T.seoDescription, optional: true, seo: true, hint: "Falls back to the SEO description." },
];

export const MACHINE_ATTRIBUTE_TABLES: ChildTables = {
  table: machineAttributes,
  idColumn: machineAttributes.id,
  parentColumn: machineAttributes.machineId,
  positionColumn: machineAttributes.position,
  parentKey: "machineId",
  trTable: machineAttributeTranslations,
  trParentColumn: machineAttributeTranslations.attributeId,
  trLocaleColumn: machineAttributeTranslations.locale,
  trParentKey: "attributeId",
  texts: [
    { key: "label", label: "label", max: T.attrLabel, required: true },
    { key: "value", label: "value", max: T.attrValue, required: true },
  ],
};

export const CERTIFICATE_FACT_TABLES: ChildTables = {
  table: certificateFacts,
  idColumn: certificateFacts.id,
  parentColumn: certificateFacts.certificateId,
  positionColumn: certificateFacts.position,
  parentKey: "certificateId",
  trTable: certificateFactTranslations,
  trParentColumn: certificateFactTranslations.factId,
  trLocaleColumn: certificateFactTranslations.locale,
  trParentKey: "factId",
  texts: [
    { key: "label", label: "label", max: T.factLabel, required: true },
    { key: "value", label: "value", max: T.factValue, required: true },
  ],
};

/** A service's captioned gallery (A4; A1 `service_gallery_items`): each entry a photo with its caption and alt per language. */
export const SERVICE_GALLERY_TABLES: ChildTables = {
  table: serviceGalleryItems,
  idColumn: serviceGalleryItems.id,
  parentColumn: serviceGalleryItems.serviceId,
  positionColumn: serviceGalleryItems.position,
  parentKey: "serviceId",
  trTable: serviceGalleryItemTranslations,
  trParentColumn: serviceGalleryItemTranslations.itemId,
  trLocaleColumn: serviceGalleryItemTranslations.locale,
  trParentKey: "itemId",
  texts: [
    { key: "caption", label: "caption", max: T.galleryCaption, required: true },
    { key: "alt", label: "alt text", max: T.altText, alt: true },
  ],
  mediaKey: "mediaId",
};

export const TRANSLATED: Readonly<Record<EntityType, TranslatedSpec>> = {
  page: {
    tr: pageTranslations,
    trParentColumn: pageTranslations.pageId,
    trLocaleColumn: pageTranslations.locale,
    trParentKey: "pageId",
    titleKey: "title",
    fields: [
      { key: "title", label: "Title", kind: "line", max: T.pageTitle, required: true, search: true },
      { key: "navLabel", label: "Navigation label", kind: "line", max: T.navLabel, optional: true, search: true, hint: "A short label for menus and breadcrumbs (optional)." },
      ...SEO_FIELDS,
    ],
  },
  service: {
    tr: serviceTranslations,
    trParentColumn: serviceTranslations.serviceId,
    trLocaleColumn: serviceTranslations.locale,
    trParentKey: "serviceId",
    titleKey: "name",
    fields: [
      { key: "name", label: "Name", kind: "line", max: T.serviceName, required: true, search: true },
      { key: "tagline", label: "Tagline", kind: "line", max: T.tagline, required: true, search: true, hint: "One line for cards and the footer." },
      { key: "summary", label: "Summary", kind: "text", max: T.summary, required: true, search: true, hint: "Two or three sentences." },
      { key: "body", label: "Description", kind: "rich", max: T.paragraph, required: true },
      {
        key: "highlights",
        label: "Highlights (key points)",
        kind: "lines",
        max: T.highlight,
        maxItems: T.highlights,
        hint: "The service's key points or benefits.",
      },
      { key: "coverAlt", label: "Cover photo alt text", kind: "alt", max: T.altText, optional: true, hint: "Describes the cover photo here (A4)." },
      { key: "supportingAlt", label: "Supporting photo alt text", kind: "alt", max: T.altText, optional: true, hint: "Describes the supporting photo here (A4)." },
      ...SEO_FIELDS,
    ],
    childTables: SERVICE_GALLERY_TABLES,
  },
  machine: {
    tr: machineTranslations,
    trParentColumn: machineTranslations.machineId,
    trLocaleColumn: machineTranslations.locale,
    trParentKey: "machineId",
    titleKey: "name",
    fields: [
      { key: "name", label: "Name (as printed)", kind: "line", max: T.machineName, required: true, search: true },
      { key: "shortName", label: "Short name", kind: "line", max: T.shortName, required: true, search: true },
      { key: "category", label: "Type", kind: "line", max: T.category, required: true, search: true },
      { key: "capability", label: "Capability", kind: "text", max: T.capability, required: true, hint: "Only what the source states." },
    ],
    childTables: MACHINE_ATTRIBUTE_TABLES,
  },
  project: {
    tr: projectTranslations,
    trParentColumn: projectTranslations.projectId,
    trLocaleColumn: projectTranslations.locale,
    trParentKey: "projectId",
    titleKey: "title",
    fields: [
      { key: "title", label: "Title", kind: "line", max: T.projectTitle, required: true, search: true },
      { key: "summary", label: "Summary", kind: "text", max: T.summary, required: true, search: true, hint: "Describe only what the photos show." },
      { key: "scope", label: "Scope", kind: "text", max: T.scope, optional: true, hint: "Only once confirmed." },
      { key: "description", label: "Description", kind: "rich", max: T.paragraph, optional: true, hint: "Only once confirmed." },
      { key: "materials", label: "Materials", kind: "line", max: T.materials, optional: true, hint: "Only once confirmed." },
      { key: "location", label: "Location", kind: "line", max: T.location, optional: true, search: true, hint: "Only once confirmed." },
      { key: "clientName", label: "Client name", kind: "line", max: T.clientName, optional: true, hint: "Only when the client has no client record, and only once confirmed." },
      { key: "challenge", label: "Challenge", kind: "text", max: T.challenge, optional: true, hint: "Only once confirmed." },
      { key: "solution", label: "Solution", kind: "text", max: T.solution, optional: true, hint: "Only once confirmed." },
      ...SEO_FIELDS,
    ],
  },
  project_category: {
    tr: projectCategoryTranslations,
    trParentColumn: projectCategoryTranslations.categoryId,
    trLocaleColumn: projectCategoryTranslations.locale,
    trParentKey: "categoryId",
    titleKey: "label",
    fields: [{ key: "label", label: "Label", kind: "line", max: T.categoryLabel, required: true, search: true }],
  },
  industry: {
    tr: industryTranslations,
    trParentColumn: industryTranslations.industryId,
    trLocaleColumn: industryTranslations.locale,
    trParentKey: "industryId",
    titleKey: "name",
    fields: [
      { key: "name", label: "Name", kind: "line", max: T.industryName, required: true, search: true },
      { key: "description", label: "Description", kind: "text", max: T.industryDescription, required: true, search: true },
    ],
  },
  client: {
    tr: clientTranslations,
    trParentColumn: clientTranslations.clientId,
    trLocaleColumn: clientTranslations.locale,
    trParentKey: "clientId",
    titleKey: "name",
    fields: [{ key: "name", label: "Name", kind: "line", max: T.clientName, required: true, search: true }],
  },
  certificate: {
    tr: certificateTranslations,
    trParentColumn: certificateTranslations.certificateId,
    trLocaleColumn: certificateTranslations.locale,
    trParentKey: "certificateId",
    titleKey: "title",
    fields: [
      { key: "title", label: "Title", kind: "line", max: T.certificateTitle, required: true, search: true, digitGuard: true },
      { key: "issuer", label: "Issuer", kind: "line", max: T.issuer, required: true, search: true, digitGuard: true },
    ],
    childTables: CERTIFICATE_FACT_TABLES,
  },
};

// --- The lists' SQL rule, derived from the definition -------------------------------------------------------------

/** A column's name in SQL (Drizzle columns carry their own). */
export const sqlName = (column: AnyMySqlColumn) => (column as unknown as { name: string }).name;

/** The translation table's column of a field, by the table's own property name. */
export function columnOf(type: EntityType, key: string): AnyMySqlColumn {
  const column = (TRANSLATED[type].tr as unknown as Record<string, AnyMySqlColumn | undefined>)[key];
  if (!column) throw new Error(`The ${type} translations have no column for the field ${key}.`);
  return column;
}

/** The child translation table's column of a child text, by the table's own property name. */
export function childTextColumn(child: ChildTables, key: string): AnyMySqlColumn {
  const column = (child.trTable as unknown as Record<string, AnyMySqlColumn | undefined>)[key];
  if (!column) throw new Error(`The child translations of ${getTableName(child.table)} have no column for the text ${key}.`);
  return column;
}

/** What the SQL language state of a type tests, as column and table names (from the definition, never from input). */
export interface CompletenessRule {
  /** The title column. */
  title: string;
  /** Required text columns ("" while missing). */
  text: string[];
  /** Required paragraph documents (no paragraph while missing). */
  rich: string[];
  /** Required line lists (an empty list while missing). */
  lines: string[];
  /** Child items: their table, parent column, translation table, its parent column and the texts each child needs. */
  children?: { table: string; parent: string; tr: string; trParent: string; required: string[] };
}

export function completenessRule(type: EntityType): CompletenessRule {
  const spec = TRANSLATED[type];
  const required = (kinds: readonly TextKind[]) => spec.fields.filter((f) => f.required && kinds.includes(f.kind)).map((f) => sqlName(columnOf(type, f.key)));
  const child = spec.childTables;
  return {
    title: sqlName(columnOf(type, spec.titleKey)),
    text: required(["line", "text"]),
    rich: required(["rich"]),
    lines: required(["lines"]),
    ...(child
      ? {
          children: {
            table: getTableName(child.table),
            parent: sqlName(child.parentColumn),
            tr: getTableName(child.trTable),
            trParent: sqlName(child.trParentColumn),
            required: child.texts.filter((t) => t.required).map((t) => sqlName(childTextColumn(child, t.key))),
          },
        }
      : {}),
  };
}

/** Every type's rule, derived once. */
export const COMPLETENESS: Readonly<Record<EntityType, CompletenessRule>> = Object.fromEntries(ENTITY_TYPES.map((type) => [type, completenessRule(type)])) as Record<
  EntityType,
  CompletenessRule
>;
