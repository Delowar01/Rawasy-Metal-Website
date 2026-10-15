/**
 * The eight content types of the Core CMS as specifications for the engine (A1-DATABASE-SCHEMA §7 for every column;
 * A1-CONTENT-MODEL §8 for the rules). What each type adds to the shared behaviour:
 *
 * - **Pages** — page type and system key fixed at creation; generic pages take a slug outside the reserved routes;
 *   legal pages are labelled for legal review and edited with `legal.edit`; per-record SEO.
 * - **Services** — group and icon from code registries; summary, body (paragraphs) and highlights; ordered machines,
 *   related services and featured projects (only projects whose own record lists the service); per-record SEO.
 * - **Machinery** — power only when stated (empty = not stated); a primary service; technical attributes as ordered
 *   label/value pairs per language (validated, never markup); the slug is the /capabilities anchor.
 * - **Projects** — confirmed details only (empty stays empty); categories and services in order; client record or
 *   name; featured working flag; the slug is the /projects anchor; safety flags (projects.ts); per-record SEO.
 * - **Project categories** — a label per language; never archived while active projects use them.
 * - **Industries** — classification (profile sector or website classification); services and projects in order.
 * - **Clients** — name per language, optional https website, featured working flag; no claim, no logo (A4).
 * - **Certificates** — document metadata only: title, issuer, ordered facts, an admin-only expiry date; every public
 *   text passes the digit guard; files arrive in A4.
 */
import { eq, sql } from "drizzle-orm";
import type { AnyMySqlColumn, AnyMySqlTable } from "drizzle-orm/mysql-core";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import {
  certificateFacts,
  certificateFactTranslations,
  certificates,
  certificateTranslations,
  clients,
  clientTranslations,
  industries,
  industryProjects,
  industryServices,
  industryTranslations,
  machineAttributes,
  machineAttributeTranslations,
  machines,
  machineTranslations,
  pages,
  pageTranslations,
  projectCategories,
  projectCategoryAssignments,
  projectCategoryTranslations,
  projects,
  projectServices,
  projectTranslations,
  serviceFeaturedProjects,
  serviceMachines,
  serviceRelatedServices,
  services,
  serviceTranslations,
} from "../db/schema-cms.ts";
import type { KindSpec, RelationRefusal, TrField } from "./engine.ts";
import { refLabel, refsByIds, type ItemRef } from "./lookups.ts";
import { LIMITS, SERVICE_ICON_KEYS, type EntityType } from "./registry.ts";
import { rowsOf, targetStates, type FieldErrors, type RelationTable } from "./store.ts";
import { httpsUrlProblem, normalizedHttpsUrl } from "./text.ts";

const T = LIMITS.text;
const checkbox = z.string().max(16).optional().transform((v) => v !== undefined);
const empty = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : v);
const ULID = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const optionalId = z.preprocess(empty, ULID.optional());

/** A calendar date (YYYY-MM-DD) that exists. */
const dateField = z.preprocess(
  empty,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date such as 2027-03-31.")
    .refine((value) => {
      const d = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "2200-12-31";
    }, "Use a date that exists.")
    .optional(),
);

const SEO_FIELDS: TrField[] = [
  { key: "seoTitle", label: "SEO title", kind: "line", max: T.seoTitle, optional: true, seo: true, hint: "Falls back to the title. Over 60 characters may be cut by search engines." },
  { key: "seoDescription", label: "SEO description", kind: "line", max: T.seoDescription, optional: true, seo: true, hint: "Falls back to the summary. Over 160 characters may be cut." },
  { key: "ogTitle", label: "Share title", kind: "line", max: T.seoTitle, optional: true, seo: true, hint: "Falls back to the SEO title." },
  { key: "ogDescription", label: "Share description", kind: "line", max: T.seoDescription, optional: true, seo: true, hint: "Falls back to the SEO description." },
];

/** An ordered relation table: (owner, target, position) columns named by the table's own properties. */
const rel = <Tab extends AnyMySqlTable & { position: AnyMySqlColumn }>(table: Tab, owner: keyof Tab & string, target: keyof Tab & string): RelationTable => ({
  table,
  owner: table[owner] as unknown as AnyMySqlColumn,
  target: table[target] as unknown as AnyMySqlColumn,
  position: table.position,
  row: (ownerId: string, targetId: string, position: number) => ({ [owner]: ownerId, [target]: targetId, position }),
});

/**
 * A single reference (a primary service, a client record): must exist; archived only if it was already set. A newly
 * chosen reference is read with a share lock (see `targetStates`), so it can't be archived in the same moment.
 */
async function checkReference(db: Db, type: EntityType, id: string | undefined, before: string | null): Promise<string | null> {
  if (!id) return null;
  const state = (await targetStates(db, type, [id], { lock: id !== before })).get(id);
  if (!state) return "The chosen item no longer exists. Reload the page.";
  if (state.archived && id !== before) return "Archived items can't be chosen. Restore the item first.";
  return null;
}

// --- Pages -------------------------------------------------------------------------------------------------------------

export const pageSpec: KindSpec = {
  type: "page",
  slugNamespace: "page",
  hasSource: false,
  hasSeo: true,
  root: pages,
  rootId: pages.id,
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
  rootShape: { navHidden: checkbox, effectiveDate: dateField },
  rootColumns: (input, { pageType }) => ({ navHidden: input.navHidden === true, effectiveDate: pageType === "legal" ? ((input.effectiveDate as string) ?? null) : null }),
  rootValues: (row) => ({ navHidden: Boolean(row.navHidden), effectiveDate: row.effectiveDate ?? null }),
  rootLabels: { navHidden: "navigation", effectiveDate: "effective date", robotsIndex: "robots", robotsFollow: "robots", inSitemap: "sitemap", canonicalOverride: "canonical" },
};

// --- Services ----------------------------------------------------------------------------------------------------------

const idList = (ids: readonly string[]) =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );

/** Names for messages and audit summaries: “Title” (slug), the first three, then a count. */
function nameList(refs: readonly ItemRef[], withSlug: boolean): string {
  const names = refs.map((ref) => {
    const label = refLabel(ref);
    const clipped = [...label].length > 60 ? `${[...label].slice(0, 59).join("")}…` : label;
    return `“${clipped}”${withSlug && ref.slug && label !== `(${ref.slug})` ? ` (${ref.slug})` : ""}${ref.archived ? " (archived)" : ""}`;
  });
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : (shown[0] ?? "");
}

/**
 * Featured projects must list the service in their own record (A1 §8.1; A3 Correction 1: every
 * service_featured_projects row has its project_services row at every commit), checked on every save. The pairs are read
 * with a locking read — the latest committed rows, share-locked until this save commits: a project dropping this service
 * at the same moment either commits first and is seen here, or waits for this save and is then refused itself
 * (`keepsFeaturingServices`). A plain read would answer from this transaction's snapshot, which can predate that
 * project's save (race B of the correction's tests).
 */
async function featuredListService(db: Db, serviceId: string | null, ids: readonly string[]): Promise<string | RelationRefusal | null> {
  if (!ids.length) return null;
  if (!serviceId) return "A new service has no projects yet: save it, add it to a project's services, then feature the project here.";
  const rows = await rowsOf<{ project_id: string }>(
    db,
    sql`SELECT project_id FROM project_services WHERE service_id = ${serviceId} AND project_id IN (${idList(ids)}) LOCK IN SHARE MODE`,
  );
  const listed = new Set(rows.map((r) => r.project_id));
  const missing = ids.filter((id) => !listed.has(id));
  if (!missing.length) return null;
  return {
    message: `${missing.length} featured project(s) no longer list this service in their own record: remove them, or add the service to those projects first.`,
    summary: `Refused: featured project${missing.length === 1 ? "" : "s"} ${nameList(await refsByIds(db, "project", missing), true)} ${missing.length === 1 ? "does" : "do"} not list this service in ${missing.length === 1 ? "its" : "their"} own record.`,
    changes: { relation: "featuredProjects", notListing: [...missing] },
  };
}

/**
 * A project keeps a service that features it (A3 Correction 1). A service features only projects that list it, so
 * removing the service from the project would leave the service's Featured projects pointing at a project that no
 * longer lists it; the save is refused instead — a service's curated list is never changed silently. The project is
 * taken out of that service's Featured projects first, then the service can be removed here.
 *
 * Runs with the project's root row locked (FOR UPDATE) and before any write (lock order: `contentTransaction`). That row
 * is the pair's mutex: a service featuring the project anew share-locks it first (`targetStates`), and InnoDB's
 * foreign-key check share-locks it for every row inserted into service_featured_projects, so no new (service, this
 * project) row can commit while this save holds it. The rows that exist are read with a locking read — the latest
 * committed state, waiting for a service save that is removing one at this moment — never from the snapshot.
 * Only removed services are checked: a reorder or an unchanged list never triggers it.
 */
async function keepsFeaturingServices(db: Db, projectId: string | null, ids: readonly string[], before: readonly string[]): Promise<RelationRefusal | null> {
  if (!projectId) return null;
  const kept = new Set(ids);
  const removed = before.filter((id) => !kept.has(id));
  if (!removed.length) return null;
  const rows = await rowsOf<{ service_id: string }>(
    db,
    sql`SELECT service_id FROM service_featured_projects WHERE project_id = ${projectId} AND service_id IN (${idList(removed)}) LOCK IN SHARE MODE`,
  );
  const featuring = new Set(rows.map((r) => r.service_id));
  const services = removed.filter((id) => featuring.has(id));
  if (!services.length) return null;
  const one = services.length === 1;
  const refs = await refsByIds(db, "service", services);
  const archived = refs.some((ref) => ref.archived);
  const first = archived
    ? `Restore ${one ? "that service" : "the archived ones"} and remove the project from ${one ? "its" : "those services'"} Featured projects first`
    : `Remove it from ${one ? "that service's" : "those services'"} Featured projects first`;
  return {
    message: `This project is currently featured by ${nameList(refs, false)}. ${first}, then remove the ${one ? "service" : "services"} here.`,
    summary: `Refused: removing ${one ? "service" : `${services.length} services`} ${nameList(refs, true)} from this project — ${one ? "it still features" : "they still feature"} the project in ${one ? "its" : "their"} Featured projects.`,
    changes: { relation: "services", featuredBy: services },
  };
}

export const serviceSpec: KindSpec = {
  type: "service",
  slugNamespace: null,
  hasSource: true,
  hasSeo: true,
  root: services,
  rootId: services.id,
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
    ...SEO_FIELDS,
  ],
  rootShape: {
    serviceGroup: z.enum(["metal", "scaffolding"], { message: "Choose the section." }),
    iconKey: z.enum(SERVICE_ICON_KEYS, { message: "Choose an icon." }),
  },
  rootColumns: (input) => ({ serviceGroup: input.serviceGroup, iconKey: input.iconKey }),
  rootValues: (row) => ({ serviceGroup: row.serviceGroup, iconKey: row.iconKey }),
  rootLabels: { serviceGroup: "section", iconKey: "icon", sourceBasis: "source", sourcePages: "source", sourceNote: "source note", robotsIndex: "robots", robotsFollow: "robots", inSitemap: "sitemap", canonicalOverride: "canonical" },
  relations: [
    { key: "machines", label: "Machines", target: "machine", table: rel(serviceMachines, "serviceId", "machineId"), max: LIMITS.relations.machines },
    {
      key: "relatedServices",
      label: "Related services",
      target: "service",
      table: rel(serviceRelatedServices, "serviceId", "relatedServiceId"),
      max: LIMITS.relations.relatedServices,
      self: true,
    },
    {
      key: "featuredProjects",
      label: "Featured projects",
      target: "project",
      table: rel(serviceFeaturedProjects, "serviceId", "projectId"),
      max: LIMITS.relations.featuredProjects,
      check: (db, ownerId, ids) => featuredListService(db, ownerId, ids),
      hint: "Only projects whose own record lists this service.",
    },
  ],
};

// --- Machinery ---------------------------------------------------------------------------------------------------------

export const machineSpec: KindSpec = {
  type: "machine",
  slugNamespace: "machine",
  hasSource: true,
  hasSeo: false,
  root: machines,
  rootId: machines.id,
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
  rootShape: {
    powerWatts: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.coerce
        .number({ message: "Enter the power in watts as a number." })
        .int("Enter whole watts.")
        .min(LIMITS.powerWatts.min, "Enter a power above zero, or leave it empty (not stated).")
        .max(LIMITS.powerWatts.max, `Enter at most ${LIMITS.powerWatts.max} W.`)
        .optional(),
    ),
    primaryServiceId: optionalId,
  },
  rootColumns: (input) => ({ powerWatts: (input.powerWatts as number | undefined) ?? null, primaryServiceId: (input.primaryServiceId as string | undefined) ?? null }),
  rootValues: (row) => ({ powerWatts: row.powerWatts ?? null, primaryServiceId: row.primaryServiceId ?? null }),
  rootLabels: { powerWatts: "power", primaryServiceId: "primary service", sourceBasis: "source", sourcePages: "source", sourceNote: "source note" },
  checkRoot: async (db, input, itemId) => {
    const [stored] = itemId ? await db.select({ primaryServiceId: machines.primaryServiceId }).from(machines).where(eq(machines.id, itemId)) : [];
    const problem = await checkReference(db, "service", input.primaryServiceId as string | undefined, stored?.primaryServiceId ?? null);
    const errors: FieldErrors = {};
    if (problem) errors.primaryServiceId = problem;
    return errors;
  },
  children: {
    key: "attributes",
    label: "Technical attributes",
    table: machineAttributes,
    idColumn: machineAttributes.id,
    parentColumn: machineAttributes.machineId,
    positionColumn: machineAttributes.position,
    parentKey: "machineId",
    trTable: machineAttributeTranslations,
    trParentColumn: machineAttributeTranslations.attributeId,
    trLocaleColumn: machineAttributeTranslations.locale,
    trParentKey: "attributeId",
    max: LIMITS.attributes,
    labelMax: T.attrLabel,
    valueMax: T.attrValue,
  },
};

// --- Projects ----------------------------------------------------------------------------------------------------------

export const projectSpec: KindSpec = {
  type: "project",
  slugNamespace: "project",
  hasSource: true,
  hasSeo: true,
  root: projects,
  rootId: projects.id,
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
  rootShape: {
    galleryRef: z.preprocess(empty, z.string().max(T.galleryRef).regex(/^[A-Za-z0-9. -]+$/, "Letters, digits, dots and spaces, e.g. 04 or p.3.").optional()),
    year: z.preprocess(
      empty,
      z.coerce
        .number({ message: "Enter a year." })
        .int("Enter a year.")
        .min(LIMITS.year.min, `Enter a year from ${LIMITS.year.min}.`)
        .max(LIMITS.year.max, `Enter a year up to ${LIMITS.year.max}.`)
        .optional(),
    ),
    clientId: optionalId,
    isFeatured: checkbox,
  },
  rootColumns: (input) => ({
    galleryRef: (input.galleryRef as string | undefined) ?? null,
    year: (input.year as number | undefined) ?? null,
    clientId: (input.clientId as string | undefined) ?? null,
    isFeatured: input.isFeatured === true,
  }),
  rootValues: (row) => ({ galleryRef: row.galleryRef ?? null, year: row.year ?? null, clientId: row.clientId ?? null, isFeatured: Boolean(row.isFeatured) }),
  rootLabels: {
    galleryRef: "gallery reference",
    year: "year",
    clientId: "client",
    isFeatured: "featured",
    sourceBasis: "source",
    sourcePages: "source",
    sourceNote: "source note",
    robotsIndex: "robots",
    robotsFollow: "robots",
    inSitemap: "sitemap",
    canonicalOverride: "canonical",
  },
  checkRoot: async (db, input, itemId) => {
    const [stored] = itemId ? await db.select({ clientId: projects.clientId }).from(projects).where(eq(projects.id, itemId)) : [];
    const problem = await checkReference(db, "client", input.clientId as string | undefined, stored?.clientId ?? null);
    const errors: FieldErrors = {};
    if (problem) errors.clientId = problem;
    return errors;
  },
  relations: [
    {
      key: "categories",
      label: "Categories",
      target: "project_category",
      table: rel(projectCategoryAssignments, "projectId", "categoryId"),
      max: LIMITS.relations.categories,
      hint: "Website classifications; cards show the first two.",
    },
    {
      key: "services",
      label: "Services",
      target: "service",
      table: rel(projectServices, "projectId", "serviceId"),
      max: LIMITS.relations.projectServices,
      check: (db, ownerId, ids, before) => keepsFeaturingServices(db, ownerId, ids, before),
      hint: "The services the project's own record lists.",
    },
  ],
};

// --- Project categories ------------------------------------------------------------------------------------------------

export const categorySpec: KindSpec = {
  type: "project_category",
  slugNamespace: null,
  hasSource: false,
  hasSeo: false,
  root: projectCategories,
  rootId: projectCategories.id,
  tr: projectCategoryTranslations,
  trParentColumn: projectCategoryTranslations.categoryId,
  trLocaleColumn: projectCategoryTranslations.locale,
  trParentKey: "categoryId",
  titleKey: "label",
  fields: [{ key: "label", label: "Label", kind: "line", max: T.categoryLabel, required: true, search: true }],
  rootShape: {},
  rootColumns: () => ({}),
  rootValues: () => ({}),
  rootLabels: {},
};

/**
 * A category stays active while an active project uses it (A3 brief §23: no invalid project state). A plain read is
 * enough here: the archive holds the category's row lock before its first plain read (its snapshot starts after any
 * change that was linking the category committed), and every change that links a category reads it with a share lock
 * first (`targetStates`), so it waits for this archive and then sees the category archived.
 */
export async function categoryInUse(db: Db, id: string): Promise<string | null> {
  const [row] = await rowsOf<{ n: number }>(
    db,
    sql`SELECT COUNT(*) AS n FROM project_category_assignments a JOIN projects p ON p.id = a.project_id
         WHERE a.category_id = ${id} AND p.deleted_at IS NULL AND p.publication_status <> 'archived'`,
  );
  const n = Number(row?.n ?? 0);
  return n ? `${n} active project(s) use this category. Remove it from them first, so no project points to an archived category.` : null;
}

/**
 * A project is not restored while one of its categories is archived (A3 brief §23: no active project in an archived
 * category; the project itself is read-only while archived, so the category is restored first). The categories are
 * read with a share lock, so one can't be archived in the same moment either (A3 security review, finding 3).
 */
export async function projectInArchivedCategory(db: Db, projectId: string): Promise<string | null> {
  const rows = await rowsOf<{ slug: string; label: string | null }>(
    db,
    sql`SELECT c.slug, COALESCE(NULLIF(en.label, ''), ar.label) AS label
          FROM project_category_assignments a
          JOIN project_categories c ON c.id = a.category_id
          LEFT JOIN project_category_translations en ON en.category_id = c.id AND en.locale = 'en'
          LEFT JOIN project_category_translations ar ON ar.category_id = c.id AND ar.locale = 'ar'
         WHERE a.project_id = ${projectId} AND c.deleted_at IS NULL AND c.publication_status = 'archived'
         ORDER BY a.position
         LOCK IN SHARE MODE`,
  );
  if (!rows.length) return null;
  const names = rows.map((r) => `“${r.label || r.slug}”`).join(", ");
  return `This project is in ${rows.length === 1 ? "an archived category" : "archived categories"} (${names}). Restore ${rows.length === 1 ? "it" : "them"} first, then the project.`;
}

/** Rules that can keep an item from being archived or restored, by type (used by the Server Action and the tests). */
export const LIFECYCLE_RULES: Partial<Record<EntityType, { blockArchive?: (db: Db, id: string) => Promise<string | null>; blockRestore?: (db: Db, id: string) => Promise<string | null> }>> = {
  project_category: { blockArchive: categoryInUse },
  project: { blockRestore: projectInArchivedCategory },
};

// --- Industries --------------------------------------------------------------------------------------------------------

export const industrySpec: KindSpec = {
  type: "industry",
  slugNamespace: null,
  hasSource: true,
  hasSeo: false,
  root: industries,
  rootId: industries.id,
  tr: industryTranslations,
  trParentColumn: industryTranslations.industryId,
  trLocaleColumn: industryTranslations.locale,
  trParentKey: "industryId",
  titleKey: "name",
  fields: [
    { key: "name", label: "Name", kind: "line", max: T.industryName, required: true, search: true },
    { key: "description", label: "Description", kind: "text", max: T.industryDescription, required: true, search: true },
  ],
  rootShape: { classification: z.enum(["profile_sector", "website_classification"], { message: "Choose where the sector comes from." }) },
  rootColumns: (input) => ({ classification: input.classification }),
  rootValues: (row) => ({ classification: row.classification }),
  rootLabels: { classification: "classification", sourceBasis: "source", sourcePages: "source", sourceNote: "source note" },
  relations: [
    { key: "services", label: "Services", target: "service", table: rel(industryServices, "industryId", "serviceId"), max: LIMITS.relations.industryServices },
    { key: "projects", label: "Projects", target: "project", table: rel(industryProjects, "industryId", "projectId"), max: LIMITS.relations.industryProjects },
  ],
};

// --- Clients -----------------------------------------------------------------------------------------------------------

export const clientSpec: KindSpec = {
  type: "client",
  slugNamespace: null,
  hasSource: true,
  hasSeo: false,
  root: clients,
  rootId: clients.id,
  tr: clientTranslations,
  trParentColumn: clientTranslations.clientId,
  trLocaleColumn: clientTranslations.locale,
  trParentKey: "clientId",
  titleKey: "name",
  fields: [{ key: "name", label: "Name", kind: "line", max: T.clientName, required: true, search: true }],
  rootShape: {
    websiteUrl: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() || undefined : v),
      z
        .string()
        .max(T.url * 4)
        .optional()
        .superRefine((value, ctx) => {
          if (value) {
            const problem = httpsUrlProblem(value);
            if (problem) ctx.addIssue({ code: "custom", message: problem });
          }
        })
        .transform((value) => (value && !httpsUrlProblem(value) ? normalizedHttpsUrl(value) : value)),
    ),
    isFeatured: checkbox,
  },
  rootColumns: (input) => ({ websiteUrl: (input.websiteUrl as string | undefined) ?? null, isFeatured: input.isFeatured === true }),
  rootValues: (row) => ({ websiteUrl: row.websiteUrl ?? null, isFeatured: Boolean(row.isFeatured) }),
  rootLabels: { websiteUrl: "website", isFeatured: "featured", sourceBasis: "source", sourcePages: "source", sourceNote: "source note" },
};

// --- Certificates ------------------------------------------------------------------------------------------------------

export const certificateSpec: KindSpec = {
  type: "certificate",
  slugNamespace: "certificate",
  hasSource: true,
  hasSeo: false,
  root: certificates,
  rootId: certificates.id,
  tr: certificateTranslations,
  trParentColumn: certificateTranslations.certificateId,
  trLocaleColumn: certificateTranslations.locale,
  trParentKey: "certificateId",
  titleKey: "title",
  fields: [
    { key: "title", label: "Title", kind: "line", max: T.certificateTitle, required: true, search: true, digitGuard: true },
    { key: "issuer", label: "Issuer", kind: "line", max: T.issuer, required: true, search: true, digitGuard: true },
  ],
  rootShape: { expiresOn: dateField },
  rootColumns: (input) => ({ expiresOn: (input.expiresOn as string | undefined) ?? null }),
  rootValues: (row) => ({ expiresOn: row.expiresOn ?? null }),
  rootLabels: { expiresOn: "expiry date", sourceBasis: "source", sourcePages: "source", sourceNote: "notes" },
  children: {
    key: "facts",
    label: "Displayed facts",
    table: certificateFacts,
    idColumn: certificateFacts.id,
    parentColumn: certificateFacts.certificateId,
    positionColumn: certificateFacts.position,
    parentKey: "certificateId",
    trTable: certificateFactTranslations,
    trParentColumn: certificateFactTranslations.factId,
    trLocaleColumn: certificateFactTranslations.locale,
    trParentKey: "factId",
    max: LIMITS.facts,
    labelMax: T.factLabel,
    valueMax: T.factValue,
    digitGuard: true,
  },
};

export const SPECS: Readonly<Record<EntityType, KindSpec>> = {
  page: pageSpec,
  service: serviceSpec,
  machine: machineSpec,
  project: projectSpec,
  project_category: categorySpec,
  industry: industrySpec,
  client: clientSpec,
  certificate: certificateSpec,
};

/** Projects that list a service in their own record (the featured-projects picker offers only these). */
export async function projectsListingService(db: Db, serviceId: string): Promise<string[]> {
  const rows = await db.select({ projectId: projectServices.projectId }).from(projectServices).where(eq(projectServices.serviceId, serviceId));
  return rows.map((r) => r.projectId);
}

/** Services that feature a project (the project's services picker marks them: they stay until un-featured there). */
export async function servicesFeaturingProject(db: Db, projectId: string): Promise<string[]> {
  const rows = await db.select({ serviceId: serviceFeaturedProjects.serviceId }).from(serviceFeaturedProjects).where(eq(serviceFeaturedProjects.projectId, projectId));
  return rows.map((r) => r.serviceId);
}

