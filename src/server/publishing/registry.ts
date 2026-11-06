/**
 * The A8 registry (A1-PUBLISHING-VERSIONS §1–§4): which aggregates have revisions and a publication, the permission keys
 * each workflow step needs (the seeded registry's keys, never role names: A1-SECURITY-RBAC §5), and the limits.
 *
 * Every aggregate whose root a change locks writes revisions (A8.1). Publication (A8.2) projects a live version into
 * `published_documents`, which no public page reads before the A9 cutover (T1 = Option B). The theme is not here: no
 * design token is approved (D-A6-3), so it has nothing to keep or publish.
 *
 * Framework-free (the services, the CLIs and the tests import it).
 */
import { ENTITIES, type EntityType, type PageType } from "../cms/registry.ts";
import type { AggregateType } from "../cms/changes.ts";

export type { AggregateType } from "../cms/changes.ts";

/** The version of the snapshot shape this code writes (older ones are read through upcasters: none exist yet). */
export const SNAPSHOT_SCHEMA_VERSION = 1;
/** The version of the public projection this code writes. */
export const PROJECTION_SCHEMA_VERSION = 1;
/** The first cache epoch (0011's seed); a database restore replaces it (A1 §8.2, the restore runbook). */
export const INITIAL_CACHE_EPOCH = "01KA0000000000000000000000";

export const PUBLISHING_LIMITS = {
  /** A change note on a revision, a legal reviewer's confirmation. */
  message: 500,
  /** A reviewer's comment (request changes). */
  comment: 2000,
  /** Revisions listed per history page. */
  historyPage: 25,
  /** Audit events per page (10–100). */
  auditPage: { min: 10, default: 25, max: 100 },
} as const;

export const CONTENT_AGGREGATES = ["page", "service", "machine", "project", "project_category", "industry", "client", "certificate"] as const satisfies readonly EntityType[];
export const AGGREGATE_TYPES: readonly AggregateType[] = [...CONTENT_AGGREGATES, "reusable_section", "ordering", "menu", "site_settings", "form"];

export type WorkflowAction = "view" | "edit" | "submit" | "review" | "publish" | "publish_reviewed" | "unpublish" | "restore";

export interface AggregateInfo {
  type: AggregateType;
  one: string;
  /** The permission resource whose keys the workflow uses. */
  resource: string;
  /** Whether the review steps exist for it (submit / request changes / publish after review: their keys are seeded). */
  review: boolean;
  /** Whether a published version can carry a public address (a slug the redirects follow). */
  routable: boolean;
}

const content = (type: EntityType): AggregateInfo => ({
  type,
  one: ENTITIES[type].one,
  resource: ENTITIES[type].resource,
  review: true,
  routable: type === "page" || type === "service" || type === "project",
});

export const AGGREGATES: Readonly<Record<AggregateType, AggregateInfo>> = {
  page: content("page"),
  service: content("service"),
  machine: content("machine"),
  project: content("project"),
  project_category: content("project_category"),
  industry: content("industry"),
  client: content("client"),
  certificate: content("certificate"),
  reusable_section: { type: "reusable_section", one: "reusable section", resource: "reusable_sections", review: true, routable: false },
  ordering: { type: "ordering", one: "collection order", resource: "orderings", review: true, routable: false },
  menu: { type: "menu", one: "menu", resource: "menus", review: false, routable: false },
  site_settings: { type: "site_settings", one: "site settings", resource: "settings", review: false, routable: false },
  form: { type: "form", one: "form", resource: "forms", review: false, routable: false },
};

export const isAggregateType = (value: unknown): value is AggregateType => typeof value === "string" && Object.hasOwn(AGGREGATES, value);

/** Record-level facts a permission depends on (A1 §5.2): a legal page is edited and published with `legal.*`. */
export interface RecordFacts {
  pageType?: PageType;
}

/**
 * The permission keys a workflow step needs (all of them; `publish_reviewed` is the alternative to `publish` for
 * approving someone else's submission — `canApprove` decides that). Menus, settings and forms have no review keys in the
 * seeded registry: they are published directly by holders of `<resource>.publish` (A1-SECURITY-RBAC §5.3).
 */
export function workflowKeys(type: AggregateType, action: WorkflowAction, facts: RecordFacts = {}): string[] {
  const info = AGGREGATES[type];
  const r = info.resource;
  const legal = type === "page" && facts.pageType === "legal";
  const edit = legal ? "legal.edit" : `${r}.edit`;
  switch (action) {
    case "view":
      return ["content.view"];
    case "edit":
      return [edit];
    case "submit":
      return info.review ? [edit, `${r}.submit`] : [edit];
    case "review":
      return info.review ? [`${r}.review`] : [`${r}.publish`];
    case "publish":
    case "unpublish":
      return [legal ? "legal.publish" : `${r}.publish`];
    case "publish_reviewed":
      return info.review && !legal ? [`${r}.publish_reviewed`] : [legal ? "legal.publish" : `${r}.publish`];
    case "restore":
      return info.review ? [edit, `${r}.restore`] : [edit];
  }
}

export const allowed = (permissions: ReadonlySet<string>, type: AggregateType, action: WorkflowAction, facts: RecordFacts = {}) =>
  workflowKeys(type, action, facts).every((key) => permissions.has(key));

/**
 * Whether this person may approve and publish (A1 T6): `publish`, or `publish_reviewed` when the version under review
 * was submitted by someone else. A legal page always needs `legal.publish` (the legal gate, §4.3).
 */
export function canApprove(permissions: ReadonlySet<string>, type: AggregateType, facts: RecordFacts, actorId: string, submitterId: string | null): boolean {
  if (allowed(permissions, type, "publish", facts)) return true;
  return allowed(permissions, type, "publish_reviewed", facts) && submitterId !== null && submitterId !== actorId;
}

/** The displayed state (A1 §2). */
export function displayedState(publication: string, draft: string): string {
  if (publication === "archived") return "Archived";
  if (publication === "published") return draft === "none" ? "Published" : draft === "in_review" ? "Published · changes in review" : "Published · changes in draft";
  return draft === "in_review" ? "In review" : "Draft";
}
