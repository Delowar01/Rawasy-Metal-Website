/**
 * Which permission a content action needs (A1-SECURITY-RBAC §5; the seeded registry is the source of truth, never role
 * names). Record-level rules (A1 §5.2): a legal page is edited with `legal.edit`, a certificate with `certificates.*`;
 * robots, canonical and sitemap fields need `seo.advanced`; a system page record is registered only by someone who may
 * both edit and archive pages (Owner and Admin by the matrix — A1: editors never create system pages); a legal page
 * record by a holder of `legal.edit`. Moving a certificate in its collection's order is a certificate action too
 * (`orderings.edit` and `certificates.edit`: Owner and Admin), like every other change to a certificate (A3 review).
 *
 * Pure: every Server Action and service calls these with the permissions of the acting session.
 */
import { ENTITIES, type EntityType, type PageType } from "./registry.ts";

export type ContentAction = "view" | "create" | "edit" | "archive" | "reorder" | "seo_advanced";

export interface PageRecord {
  pageType: PageType;
}

/** The permission keys an action needs (all of them). */
export function requiredPermissions(type: EntityType, action: ContentAction, page?: PageRecord): string[] {
  const resource = ENTITIES[type].resource;
  switch (action) {
    case "view":
      return ["content.view"];
    case "reorder":
      return type === "certificate" ? ["orderings.edit", "certificates.edit"] : ["orderings.edit"];
    case "seo_advanced":
      return ["seo.advanced"];
    case "archive":
      return [`${resource}.archive`];
    case "create":
      if (type !== "page") return [`${resource}.edit`];
      if (!page || page.pageType === "generic") return ["pages.create_generic"];
      if (page.pageType === "legal") return ["legal.edit"];
      return ["pages.edit", "pages.archive"];
    case "edit":
      if (type === "page" && page?.pageType === "legal") return ["legal.edit"];
      return [`${resource}.edit`];
  }
}

export const can = (permissions: ReadonlySet<string>, type: EntityType, action: ContentAction, page?: PageRecord) =>
  requiredPermissions(type, action, page).every((key) => permissions.has(key));

/** Whether any page record type can be created by these permissions (shows the "New page" button). */
export const canCreateAnyPage = (permissions: ReadonlySet<string>) =>
  (["generic", "legal", "system"] as const).some((pageType) => can(permissions, "page", "create", { pageType }));

/** Page types that are fixed routes: never archived, never turned into another type (A1 §4.2, §13). */
export const isFixedPage = (pageType: PageType) => pageType !== "generic";
