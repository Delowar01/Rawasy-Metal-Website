/**
 * Redirects when a live address changes (A8.4, A1-PUBLISHING-VERSIONS §5 step 5, A1-CONTENT-MODEL §5.5): publishing a
 * page, service or project under a new slug adds a permanent (308) redirect from each language's old address to the
 * record — stored by id, so it always leads to the record's current address in one step. The plan is decided under
 * locks before anything is written, and the publish is refused when the redirect would conflict:
 *
 * - the old address already redirects somewhere else (someone chose that: they decide), or another redirect leads to the
 *   old address (it would become a chain);
 * - an old address that another record of the type now uses gets no redirect (it is that record's address);
 * - a redirect from the new address to this same record (a slug changed back) is turned off: pages win; one from the new
 *   address to somewhere else stops applying, and the publisher is told.
 *
 * Redirects stay inactive publicly until the A9 cutover (T1 = Option B): nothing resolves them before then.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { redirects } from "../db/schema-site.ts";
import { rowsOf } from "../cms/store.ts";
import { ENTITIES, LOCALES, type Locale } from "../cms/registry.ts";
import { ulid } from "../security/ids.ts";
import type { PublishIssue } from "./validate.ts";

export type RoutableType = "page" | "service" | "project";

export const addressOf = (type: RoutableType, locale: Locale, slug: string) =>
  type === "page" ? `/${locale}/${slug}` : type === "service" ? `/${locale}/services/${slug}` : `/${locale}/projects/${slug}`;

export interface RedirectPlan {
  create: string[];
  reactivate: string[];
  deactivate: { id: string; source: string }[];
  issues: PublishIssue[];
  notes: string[];
}

interface RedirectHit {
  id: string;
  target_type: string;
  target_page_id: string | null;
  target_service_id: string | null;
  target_project_id: string | null;
  is_active: number;
}

const targetsRecord = (row: RedirectHit, type: RoutableType, id: string) =>
  row.target_type === type && (type === "page" ? row.target_page_id : type === "service" ? row.target_service_id : row.target_project_id) === id;

/** The redirects a slug change from `oldSlug` to `newSlug` needs (decided under locks; nothing written). */
export async function planSlugRedirects(tx: Db, type: RoutableType, id: string, oldSlug: string | null, newSlug: string | null): Promise<RedirectPlan> {
  const plan: RedirectPlan = { create: [], reactivate: [], deactivate: [], issues: [], notes: [] };
  // A first publication (no old address) still checks its new address (A8 review L4): a redirect from it, left by an
  // earlier record's slug change, would otherwise stay on over this live address without anyone being told.
  if (!newSlug || oldSlug === newSlug) return plan;
  const table = sql.identifier(ENTITIES[type].table);
  const [other] = oldSlug ? await rowsOf<{ id: string }>(tx, sql`SELECT id FROM ${table} WHERE slug = ${oldSlug} AND id <> ${id} LOCK IN SHARE MODE`) : [];
  for (const locale of LOCALES) {
    const source = oldSlug ? addressOf(type, locale, oldSlug) : null;
    const target = addressOf(type, locale, newSlug);
    if (!source) {
      // First publication: only the new address's check below.
    } else if (other) {
      if (locale === "en") plan.notes.push(`The old address “${oldSlug}” now belongs to another ${ENTITIES[type].one}: no redirect from it.`);
    } else {
      const [existing] = await rowsOf<RedirectHit>(
        tx,
        sql`SELECT id, target_type, target_page_id, target_service_id, target_project_id, is_active FROM redirects WHERE source_path = ${source} FOR UPDATE`,
      );
      if (existing && !targetsRecord(existing, type, id)) {
        plan.issues.push({ code: "redirect.source", message: `The old address ${source} already has a redirect to somewhere else. Edit or remove that redirect first.`, blocking: true });
      } else if (existing) {
        if (!existing.is_active) plan.reactivate.push(existing.id);
      } else plan.create.push(source);
      const [inward] = await rowsOf<{ id: string }>(tx, sql`SELECT id FROM redirects WHERE target_type = 'path' AND target_path = ${source} AND is_active = 1 LOCK IN SHARE MODE`);
      if (inward) plan.issues.push({ code: "redirect.chain", message: `A redirect leads to the old address ${source}: it would become a chain. Point that redirect at the new address first.`, blocking: true });
    }
    const [atTarget] = await rowsOf<RedirectHit>(
      tx,
      sql`SELECT id, target_type, target_page_id, target_service_id, target_project_id, is_active FROM redirects WHERE source_path = ${target} AND is_active = 1 FOR UPDATE`,
    );
    if (atTarget && targetsRecord(atTarget, type, id)) plan.deactivate.push({ id: atTarget.id, source: target });
    else if (atTarget) plan.issues.push({ code: "redirect.shadowed", message: `The redirect from ${target} stops applying: this ${ENTITIES[type].one} now answers that address.`, blocking: false });
  }
  return plan;
}

/** Writes a plan (in the publish transaction). Returns how many redirects it added, turned on and turned off. */
export async function applySlugRedirects(tx: Db, plan: RedirectPlan, type: RoutableType, id: string, actorId: string, now: Date): Promise<{ created: number; reactivated: number; deactivated: number }> {
  for (const source of plan.create) {
    await tx.insert(redirects).values({
      id: ulid(now.getTime()),
      sourcePath: source,
      targetType: type,
      targetPath: null,
      targetPageId: type === "page" ? id : null,
      targetServiceId: type === "service" ? id : null,
      targetProjectId: type === "project" ? id : null,
      statusCode: 308,
      isActive: true,
      reason: "slug_change",
      note: "Added when the record was published under a new address.",
      createdAt: now,
      createdBy: actorId,
      updatedAt: now,
      updatedBy: actorId,
    });
  }
  for (const rid of plan.reactivate) await tx.execute(sql`UPDATE redirects SET is_active = 1, lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actorId} WHERE id = ${rid}`);
  for (const d of plan.deactivate) await tx.execute(sql`UPDATE redirects SET is_active = 0, lock_version = lock_version + 1, updated_at = ${now}, updated_by = ${actorId} WHERE id = ${d.id}`);
  return { created: plan.create.length, reactivated: plan.reactivate.length, deactivated: plan.deactivate.length };
}
