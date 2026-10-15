/**
 * Page records (A3 brief §19–§20; A1-CONTENT-MODEL §4, §13). A3 manages the identity and basic metadata of a page —
 * never its sections (A5) and never its public route, which stays static until the A9 cutover.
 *
 * - A record's **type is fixed at creation** (A1: `page_type` never changes): a generic page has a slug outside the
 *   reserved routes; a fixed page of the site (homepage, the system pages, the 404, the two legal pages, the templates)
 *   is registered under its system key — at most one record each — and has no slug, so no form can turn a fixed route
 *   into a generic page or the other way round.
 * - **Legal pages** are drafts with no public effect, labelled for legal review (`requires_legal_review`, enforced by a
 *   CHECK) and edited with `legal.edit`; nothing pre-fills their wording.
 * - Fixed pages are never archived (they are routes of the site); generic pages are archived and restored as usual.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { createItem, setItemArchived, updateItem, type ChangeContext, type LifecycleResult } from "./engine.ts";
import type { FormObject } from "./form.ts";
import { pageSpec } from "./kinds.ts";
import { can } from "./permissions.ts";
import { SYSTEM_PAGES, systemPage, type PageType } from "./registry.ts";
import { rowsOf, type SaveResult } from "./store.ts";

/** The record's own type (stored, immutable): the record-level permission and the archive rule are decided on it. */
export const pageTypeOf = (root: Record<string, unknown>) => root.pageType as PageType;

/** What a new page record is: a generic page, or the record of one of the site's fixed pages. */
export type NewPage = { kind: "generic" } | { kind: "system"; key: string };

export async function createPage(ctx: ChangeContext, choice: NewPage, form: FormObject): Promise<SaveResult> {
  if (choice.kind === "generic") {
    return createItem(ctx, pageSpec, form, { page: { pageType: "generic", systemKey: null, requiresLegalReview: false } });
  }
  const system = systemPage(choice.key);
  if (!system) return { kind: "invalid", errors: { systemKey: "Choose one of the site's fixed pages." } };
  return createItem(ctx, pageSpec, form, { page: { pageType: system.type, systemKey: system.key, requiresLegalReview: system.type === "legal" } });
}

export const updatePage = (ctx: ChangeContext, id: string, form: FormObject): Promise<SaveResult> => updateItem(ctx, pageSpec, id, form, { pageTypeOf });

export const setPageArchived = (ctx: ChangeContext, id: string, archived: boolean, expectedVersion: number): Promise<LifecycleResult> =>
  setItemArchived(ctx, pageSpec, id, archived, expectedVersion, { pageTypeOf });

/** The fixed pages that already have a record (one each: `uq_pages_system_key`). */
export async function registeredSystemKeys(db: Db): Promise<Set<string>> {
  const rows = await rowsOf<{ k: string }>(db, sql`SELECT system_key AS k FROM pages WHERE system_key IS NOT NULL`);
  return new Set(rows.map((r) => r.k));
}

export interface NewPageChoice {
  key: string;
  label: string;
  type: PageType;
  route: string | null;
  /** Already registered: shown, not offered. */
  taken: boolean;
}

/** The choices of the "New page" form for these permissions (a fixed page is offered once, while it has no record). */
export function newPageChoices(permissions: ReadonlySet<string>, registered: ReadonlySet<string>): { generic: boolean; fixed: NewPageChoice[] } {
  return {
    generic: can(permissions, "page", "create", { pageType: "generic" }),
    fixed: SYSTEM_PAGES.filter((p) => can(permissions, "page", "create", { pageType: p.type })).map((p) => ({
      key: p.key,
      label: p.label,
      type: p.type,
      route: p.route,
      taken: registered.has(p.key),
    })),
  };
}

/** Where a page record's route will be once publishing exists (A8/A9): never a public address in A3. */
export function routeIntent(pageType: PageType, systemKey: string | null, slug: string | null): string {
  if (pageType === "generic") return slug ? `/{en|ar}/${slug}` : "—";
  const system = systemKey ? systemPage(systemKey) : undefined;
  if (!system) return "—";
  if (system.route === null) return system.type === "template" ? "Template (no address of its own)" : "Shown for unknown addresses";
  return system.route === "/" ? "/{en|ar}" : `/{en|ar}${system.route}`;
}
