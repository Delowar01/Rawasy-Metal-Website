/**
 * The Core CMS on the Next.js side (A3): turns the code registry's content types and the stored items into the plain
 * models the admin's editor components render, deciding on the server — with the acting session's permissions — what
 * the person may change. Every change is checked again by the services (the engine) when it is sent.
 */
import "server-only";
import { inArray } from "drizzle-orm";
import type { Actor } from "@/server/auth/types";
import type { Db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import type { EditorItem, KindSpec } from "@/server/cms/engine";
import { projectsListingService, servicesFeaturingProject, SPECS } from "@/server/cms/kinds";
import { pickerOptions, refLabel, type ItemRef } from "@/server/cms/lookups";
import { routeIntent, pageTypeOf } from "@/server/cms/pages";
import { can, isFixedPage } from "@/server/cms/permissions";
import {
  ENTITIES,
  INDUSTRY_CLASSIFICATION_LABELS,
  LIMITS,
  PAGE_TYPE_LABELS,
  SERVICE_GROUP_LABELS,
  SERVICE_ICON_KEYS,
  type EntityType,
  type PageType,
} from "@/server/cms/registry";
import type { ChildrenModel, EditorModel, EditorValues, OptionModel, RelationModel, RootFieldModel, TextFieldModel } from "./actions/cms-model";

/** The admin addresses of a type's screens. */
export const cmsPath = (type: EntityType, id?: string) => (id ? `${ENTITIES[type].path}/${id}` : ENTITIES[type].path);

const option = (ref: ItemRef): OptionModel => ({ id: ref.id, label: refLabel(ref), slug: ref.slug, archived: ref.archived });

const ICON_LABELS: Record<string, string> = {
  "laser-cutting": "Laser cutting",
  "cnc-bending": "CNC bending",
  "steel-structures": "Steel structures",
  fabrication: "Fabrication",
  "laser-engraving": "Laser engraving",
  scaffolding: "Scaffolding",
  precision: "Precision",
  machine: "Machine",
  factory: "Factory",
  construction: "Construction",
  infrastructure: "Infrastructure",
  installation: "Installation",
  layers: "Layers",
  shield: "Shield",
};

/** The type's own fields (not translated), with the choices they offer. */
async function rootFields(db: Db, type: EntityType, pageType: PageType | null): Promise<RootFieldModel[]> {
  switch (type) {
    case "page":
      return [
        { kind: "checkbox", key: "navHidden", label: "Hide from menus", hint: "A working setting for the menus of later phases (A6)." },
        ...(pageType === "legal"
          ? [{ kind: "date", key: "effectiveDate", label: "Effective date", hint: "The date the legal text takes effect, once approved." } as const]
          : []),
      ];
    case "service":
      return [
        { kind: "select", key: "serviceGroup", label: "Section", required: true, options: Object.entries(SERVICE_GROUP_LABELS).map(([value, label]) => ({ value, label })) },
        {
          kind: "select",
          key: "iconKey",
          label: "Icon / drawing",
          required: true,
          options: SERVICE_ICON_KEYS.map((value) => ({ value, label: ICON_LABELS[value] ?? value })),
          hint: "From the site's own icon set. Images arrive with the media library (A4).",
        },
      ];
    case "machine":
      return [
        {
          kind: "number",
          key: "powerWatts",
          label: "Power",
          unit: "W",
          min: LIMITS.powerWatts.min,
          max: LIMITS.powerWatts.max,
          hint: "Only when the source states it. Leave empty for “not stated” — never 0.",
        },
        {
          kind: "reference",
          key: "primaryServiceId",
          label: "Primary service",
          emptyLabel: "No primary service",
          options: (await pickerOptions(db, "service")).map(option),
        },
      ];
    case "project":
      return [
        { kind: "text", key: "galleryRef", label: "Gallery reference", max: LIMITS.text.galleryRef, hint: "The profile's reference, e.g. 04 or p.3. Empty when there is none." },
        { kind: "number", key: "year", label: "Year", min: LIMITS.year.min, max: LIMITS.year.max, hint: "Only once confirmed." },
        {
          kind: "reference",
          key: "clientId",
          label: "Client record",
          emptyLabel: "No client record",
          options: (await pickerOptions(db, "client")).map(option),
          hint: "Only once confirmed. A draft record is never a claim of work for a client.",
        },
        { kind: "checkbox", key: "isFeatured", label: "Featured (working flag)", hint: "Marks the project for featured selections later; nothing is public in A3." },
      ];
    case "industry":
      return [
        {
          kind: "select",
          key: "classification",
          label: "Classification",
          required: true,
          options: Object.entries(INDUSTRY_CLASSIFICATION_LABELS).map(([value, label]) => ({ value, label })),
          hint: "Whether the company profile names this sector, or it is a classification drawn from the work gallery.",
        },
      ];
    case "client":
      return [
        { kind: "url", key: "websiteUrl", label: "Website", hint: "https:// addresses only. Not shown publicly (showing links needs the Owner's decision)." },
        { kind: "checkbox", key: "isFeatured", label: "Featured (working flag)" },
      ];
    case "certificate":
      return [{ kind: "date", key: "expiresOn", label: "Expiry date (admin only)", hint: "For renewal reminders. Never shown publicly." }];
    default:
      return [];
  }
}

const textField = (spec: KindSpec, key: string): TextFieldModel => {
  const f = spec.fields.find((field) => field.key === key)!;
  return {
    key: f.key,
    label: f.label,
    kind: f.kind,
    max: f.max,
    maxItems: f.maxItems,
    required: Boolean(f.required),
    hint: f.hint,
    seo: Boolean(f.seo),
    digitGuard: Boolean(f.digitGuard),
  };
};

const SLUG_HINTS: Record<EntityType, string> = {
  page: "The page's address: /en/<slug> and /ar/<slug> once publishing exists. Lowercase English letters, digits and hyphens.",
  service: "The service's address part, shared by both languages. Lowercase English letters, digits and hyphens.",
  machine: "Also the machine's anchor on the Capabilities page (/capabilities#<slug>).",
  project: "The project's address part and its anchor in the gallery (/projects#<slug>).",
  project_category: "A stable key for the category. Lowercase English letters, digits and hyphens.",
  industry: "A stable key for the sector. Lowercase English letters, digits and hyphens.",
  client: "A stable key for the client. Lowercase English letters, digits and hyphens.",
  certificate: "Also the certificate's anchor on the Certificates page (/certificates#<slug>).",
};

export interface ModelInput {
  db: Db;
  actor: Actor;
  type: EntityType;
  item: EditorItem | null;
  /** New page records: the chosen type. */
  newPageType?: PageType;
  newSystemKey?: string | null;
}

export async function editorModel({ db, actor, type, item, newPageType, newSystemKey }: ModelInput): Promise<EditorModel> {
  const spec = SPECS[type];
  const info = ENTITIES[type];
  const pageType = type === "page" ? (item ? pageTypeOf(item.root) : (newPageType ?? "generic")) : null;
  const pageFacts = pageType ? { pageType } : undefined;
  const permitted = item ? can(actor.permissions, type, "edit", pageFacts) : can(actor.permissions, type, "create", pageFacts);
  const editable = permitted && !item?.archived;
  const readOnlyReason = !permitted
    ? `Your roles let you view this ${info.one}, not change it.`
    : item?.archived
      ? `This ${info.one} is archived, so it is read-only. Restore it to make changes.`
      : undefined;
  const relations: RelationModel[] = [];
  for (const relation of spec.relations ?? []) {
    let options = (await pickerOptions(db, relation.target)).filter((o) => !(relation.self && item && o.id === item.id));
    let emptyNote: string | undefined;
    let hint = relation.hint;
    const notes = new Map<string, string>();
    if (type === "service" && relation.key === "featuredProjects") {
      const listing = item ? new Set(await projectsListingService(db, item.id)) : new Set<string>();
      const linked = new Set(item?.rel.featuredProjects ?? []);
      options = options.filter((o) => listing.has(o.id) || linked.has(o.id));
      if (!options.length) emptyNote = item ? "No project lists this service yet. Add the service to a project's services first." : "Save the service first; then projects that list it can be featured.";
    }
    if (type === "project" && relation.key === "services" && item) {
      // A3 Correction 1: a service that features this project can't be removed here until it stops featuring it.
      const featuring = await servicesFeaturingProject(db, item.id);
      for (const serviceId of featuring) notes.set(serviceId, "Features this project");
      if (featuring.length) hint = `${hint ?? ""} A service marked “Features this project” stays until the project is removed from that service's Featured projects.`.trim();
    }
    relations.push({ key: relation.key, label: relation.label, max: relation.max, hint, options: options.map((o) => ({ ...option(o), ...(notes.has(o.id) ? { note: notes.get(o.id) } : {}) })), emptyNote });
  }
  const children: ChildrenModel | null = spec.children
    ? {
        key: spec.children.key,
        label: spec.children.label,
        one: spec.children.key === "facts" ? "fact" : "attribute",
        max: spec.children.max,
        labelMax: spec.children.labelMax,
        valueMax: spec.children.valueMax,
        digitGuard: Boolean(spec.children.digitGuard),
        hint:
          spec.children.key === "facts"
            ? "Displayed facts such as type, issued or status, as label and value per language. Never a registration or certificate number."
            : "Only what the source states, as label and value per language. Plain text only.",
      }
    : null;
  const fixed = pageType ? isFixedPage(pageType) : false;
  const systemKey = item ? ((item.root.systemKey as string | null) ?? null) : (newSystemKey ?? null);
  return {
    type,
    one: info.one,
    many: info.many,
    path: info.path,
    slug: fixed ? null : { used: true, hint: SLUG_HINTS[type] },
    fields: spec.fields.map((f) => textField(spec, f.key)),
    root: await rootFields(db, type, pageType),
    source: spec.hasSource,
    seo: spec.hasSeo ? { canAdvanced: can(actor.permissions, type, "seo_advanced") } : null,
    relations,
    children,
    editable,
    readOnlyReason,
    ...(pageType
      ? {
          page: {
            pageType,
            typeLabel: PAGE_TYPE_LABELS[pageType],
            systemKey,
            route: routeIntent(pageType, systemKey, item?.slug ?? null),
            legal: pageType === "legal",
          },
        }
      : {}),
  };
}

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const CHECKBOXES = new Set(["navHidden", "isFeatured"]);

/** The form's starting values: an item's stored values, or an empty form. */
export function editorValues(type: EntityType, item: EditorItem | null): EditorValues {
  const spec = SPECS[type];
  const root = item?.root ?? {};
  const rootValues: Record<string, string | boolean> = {};
  for (const key of Object.keys(spec.rootShape)) rootValues[key] = CHECKBOXES.has(key) ? Boolean(root[key]) : str(root[key]);
  const empty = Object.fromEntries(spec.fields.map((f) => [f.key, ""]));
  return {
    slug: item?.slug ?? "",
    root: rootValues,
    source: { sourceBasis: str(root.sourceBasis), sourcePages: str(root.sourcePages), sourceNote: str(root.sourceNote) },
    seo: {
      robotsIndex: item ? Boolean(root.robotsIndex) : true,
      robotsFollow: item ? Boolean(root.robotsFollow) : true,
      inSitemap: item ? Boolean(root.inSitemap) : true,
      canonicalOverride: str(root.canonicalOverride),
    },
    en: item ? item.values.en : { ...empty },
    ar: item ? item.values.ar : { ...empty },
    complete: item ? item.complete : { en: false, ar: false },
    rel: item ? item.rel : Object.fromEntries((spec.relations ?? []).map((r) => [r.key, []])),
    children: item ? item.children.map((c) => ({ id: c.id, en: c.en, ar: c.ar })) : [],
  };
}

/** Display names of the users who created, changed or archived items (actors are never taken from a form). */
export async function userNames(db: Db, ids: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0))];
  if (!wanted.length) return new Map();
  const rows = await db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, wanted));
  return new Map(rows.map((r) => [r.id, r.name]));
}
