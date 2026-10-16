/**
 * Reusable sections (A5 brief §44–§46): one generic block's settings and texts, kept once and linked by page sections on
 * any page or service whose structure allows that block. A reusable section is its own aggregate root (A1 publication
 * columns; A5 writes only working states) with its own lock_version: an edit is decided on the version its editor opened
 * ("This reusable section changed after you opened it…"). Editing changes only the working previews of the pages that
 * link it; nothing reaches visitors (A8 publishes, A9 switches the public site).
 *
 * - Create: `reusable_sections.edit` (Owner, Admin, Editor); a generic block marked reusable, from its defaults.
 * - Edit: `reusable_sections.edit`; strict validation, references (A4 media, A3 records) and language states as for a
 *   page section, checked as the copy of every page that links it (a locking read of its links under its own row lock:
 *   on the Certificates page it keeps A3's digit guard, A5 security review F1); an archived one is read-only until
 *   restored.
 * - Archive / restore: `reusable_sections.archive` (Owner, Admin). Archive only while no page section links it (decided
 *   on a locking read under the reusable row's lock; a link share-locks that row, with locking reads of every column it
 *   decides on, before it locks the page's sections — so the two never cross, F2). The database's RESTRICT foreign key
 *   backs it: a linked reusable section can never be removed. (An edit that newly links a page or service share-locks
 *   that root after this row, the reverse of a layout save linking this section there: the two can deadlock and are
 *   retried once; nothing is decided on an older state — A5 final review.)
 */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { recordAudit, type AuditOutcome } from "../audit/audit.ts";
import { auditActorOf } from "../auth/types.ts";
import type { Db } from "../db/client.ts";
import { reusableSections } from "../db/schema-builder.ts";
import { refLabel, refsByIds } from "../cms/lookups.ts";
import { contentTransaction, rowsOf } from "../cms/store.ts";
import { ulid } from "../security/ids.ts";
import { defaultsOf, LOCALES, referencesOf, type Locale } from "./fields.ts";
import { reusableNameSchema, sectionDataSchema } from "./input.ts";
import { ULID_RE } from "./links.ts";
import { referenceIssues } from "./references.ts";
import { REGISTRY } from "./registry.ts";
import { readSectionData, type BuilderChange, type SectionIssue } from "./sections.ts";
import { ownerKindsOf, readReusable, reusableUses, writeReusableTranslations, type OwnerRef, type TranslationWrite } from "./store.ts";
import { planTexts } from "./texts.ts";

export const REUSABLE_STALE = "This reusable section changed after you opened it. Reload and review the latest version before saving.";

export type ReusableResult =
  | { kind: "ok"; id: string; lockVersion: number; summary: string }
  | { kind: "stale" }
  | { kind: "not_found" }
  | { kind: "archived" }
  | { kind: "denied"; message: string }
  | { kind: "invalid"; message: string; issues: SectionIssue[] };

const ulidSchema = z.string().regex(ULID_RE);

/** The block types a reusable section may be (generic blocks marked reusable), in the library's order. */
export const reusableBlockTypes = () => REGISTRY.all().filter((def) => def.reusable && def.storable);

async function audit(tx: Db, change: BuilderChange, now: Date, event: { action: string; id: string; label?: string; outcome?: AuditOutcome; summary: string; changes?: Record<string, unknown> }) {
  await recordAudit(tx, {
    at: now,
    requestId: change.meta.requestId,
    actor: auditActorOf(change.actor),
    ip: change.meta.ip,
    action: event.action,
    entity: { type: "reusable_section", id: event.id, label: event.label ? event.label.slice(0, 120) : null },
    outcome: event.outcome ?? "success",
    summary: event.summary,
    changes: event.changes,
  });
}

async function refuse(tx: Db, change: BuilderChange, now: Date, action: string, id: string, message: string): Promise<ReusableResult> {
  await audit(tx, change, now, { action, id, outcome: "denied", summary: `Refused: ${message}`.slice(0, 250) });
  return { kind: "denied", message };
}

/** Create a reusable section of a block type, from the block's defaults (no text yet). */
export async function createReusable(change: BuilderChange, input: { name: unknown; blockType: unknown }): Promise<ReusableResult> {
  const name = reusableNameSchema.safeParse(input.name);
  const def = typeof input.blockType === "string" ? REGISTRY.get(input.blockType) : undefined;
  const issues: SectionIssue[] = [];
  if (!name.success) issues.push({ path: "name", message: name.error.issues[0]?.message ?? "Give the reusable section a name." });
  if (!def || !def.reusable || !def.storable) issues.push({ path: "blockType", message: "Choose one of the listed blocks." });
  if (issues.length || !def || !name.success) return { kind: "invalid", message: "Some fields need attention. Nothing was saved.", issues };
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<ReusableResult> => {
    if (!actor.permissions.has("reusable_sections.edit")) return refuse(tx, change, now, "reusable_section.create", "new", "Creating reusable sections needs a permission you don't hold.");
    const defaults = defaultsOf(def.settings, def.content);
    const checked = REGISTRY.validate(def, defaults.settings, {});
    if (!checked.ok) throw new Error(`The defaults of ${def.key} are invalid.`);
    const id = ulid(now.getTime());
    await tx.insert(reusableSections).values({
      id,
      name: name.data,
      blockType: def.key,
      schemaVersion: def.version,
      settings: checked.settings,
      createdAt: now,
      createdBy: actor.user.id,
      updatedAt: now,
      updatedBy: actor.user.id,
    });
    await audit(tx, change, now, { action: "reusable_section.create", id, label: name.data, summary: `Created the reusable section “${name.data.slice(0, 80)}” (${def.label}).`, changes: { block: def.key } });
    return { kind: "ok", id, lockVersion: 0, summary: `Created “${name.data}”.` };
  });
}

const updateSchema = z
  .object({ id: ulidSchema, expectedVersion: z.number().int().min(0).max(2_147_483_647), name: z.unknown(), data: sectionDataSchema })
  .strict();

/** Save a reusable section's name, settings, texts and language states, decided on the version its editor opened. */
export async function updateReusable(change: BuilderChange, raw: unknown): Promise<ReusableResult> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: "The reusable section couldn't be read. Reload it and try again.", issues: [] };
  const name = reusableNameSchema.safeParse(parsed.data.name);
  if (!name.success) return { kind: "invalid", message: "Some fields need attention. Nothing was saved.", issues: [{ path: "name", message: name.error.issues[0]?.message ?? "Give it a name." }] };
  const { deps, actor } = change;
  const { id, expectedVersion, data } = parsed.data;
  return contentTransaction(deps, actor, async (tx, now): Promise<ReusableResult> => {
    const stored = await readReusable(tx, id, { lock: "update" });
    if (!stored) return { kind: "not_found" };
    if (!actor.permissions.has("reusable_sections.edit")) return refuse(tx, change, now, "reusable_section.update", id, "Editing reusable sections needs a permission you don't hold.");
    if (stored.archived) return { kind: "archived" };
    if (stored.lockVersion !== expectedVersion) {
      await audit(tx, change, now, { action: "reusable_section.update", id, label: stored.name, outcome: "failed", summary: `Refused: the reusable section changed after it was opened (version ${expectedVersion}, now ${stored.lockVersion}).` });
      return { kind: "stale" };
    }
    const def = REGISTRY.get(stored.blockType);
    if (!def || !def.storable) return { kind: "invalid", message: "This reusable section's block type is not known to this version of the admin.", issues: [] };
    const read = readSectionData({ blockType: stored.blockType, schemaVersion: stored.schemaVersion, settings: stored.settings, translations: stored.translations });
    if (read.state === "future_version") return { kind: "invalid", message: "This reusable section was saved with a newer block version; it can't be edited here.", issues: [] };
    const content: Partial<Record<Locale, unknown>> = {};
    for (const locale of LOCALES) if (data.content[locale] !== undefined && data.content[locale] !== null) content[locale] = data.content[locale];
    const checked = REGISTRY.validate(def, data.settings, content);
    if (!checked.ok) return { kind: "invalid", message: "Some fields need attention. Nothing was saved.", issues: checked.issues.map((i) => ({ path: i.path, message: i.message })) };
    const storedOk = read.state === "ok" ? read : null;
    const before = storedOk ? referencesOf(def.settings, def.content, storedOk.settings, storedOk.content) : null;
    // Where its texts show: every page linking it, read with a lock (a new link waits for this edit, or this edit sees it).
    const uses = await reusableUses(tx, id, { lock: true });
    const refIssues = await referenceIssues(tx, await ownerKindsOf(tx, uses), def, { settings: checked.settings, content: checked.content }, before);
    const plan = planTexts({
      def,
      settings: checked.settings,
      content: checked.content,
      stored: stored.translations,
      storedContent: storedOk?.content ?? null,
      marked: data.complete,
      otherUnaffected: data.otherUnaffected,
      actorId: actor.user.id,
      now,
    });
    const issues = [...refIssues, ...plan.issues];
    if (issues.length) return { kind: "invalid", message: "Some fields need attention. Nothing was saved.", issues: issues.map((i) => ({ path: i.path, message: i.message })) };
    const settingsChanged = !storedOk || JSON.stringify(storedOk.settings) !== JSON.stringify(checked.settings);
    const renamed = stored.name !== name.data;
    if (!settingsChanged && !renamed && !plan.changed.en && !plan.changed.ar && !Object.keys(plan.statusChanges).length) {
      return { kind: "ok", id, lockVersion: stored.lockVersion, summary: "Nothing to save." };
    }
    await tx
      .update(reusableSections)
      .set({ name: name.data, settings: checked.settings, schemaVersion: def.version, lockVersion: sql`${reusableSections.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id })
      .where(eq(reusableSections.id, id));
    await writeReusableTranslations(tx, id, plan.rows as Record<Locale, TranslationWrite | null>, actor.user.id, now);
    const parts = [renamed && "name", settingsChanged && "settings", plan.changed.en && "English", plan.changed.ar && "Arabic"].filter(Boolean);
    await audit(tx, change, now, {
      action: "reusable_section.update",
      id,
      label: name.data,
      summary: `Edited the reusable section “${name.data.slice(0, 80)}”${parts.length ? ` (${parts.join(", ")})` : " (language states)"}; used by ${uses.length} section${uses.length === 1 ? "" : "s"}.`,
      changes: { block: def.key, settings: settingsChanged, en: plan.changed.en, ar: plan.changed.ar, status: plan.statusChanges, count: uses.length },
    });
    return { kind: "ok", id, lockVersion: stored.lockVersion + 1, summary: "Saved. Every page that links it shows the change in its preview." };
  });
}

/** Archive (only while unused) or restore a reusable section, decided on the version the page showed. */
export async function setReusableArchived(change: BuilderChange, raw: { id: unknown; expectedVersion: unknown; archived: boolean }): Promise<ReusableResult> {
  const parsed = z.object({ id: ulidSchema, expectedVersion: z.number().int().min(0).max(2_147_483_647) }).safeParse({ id: raw.id, expectedVersion: raw.expectedVersion });
  if (!parsed.success) return { kind: "not_found" };
  const { deps, actor } = change;
  const { id, expectedVersion } = parsed.data;
  const action = raw.archived ? "reusable_section.archive" : "reusable_section.restore";
  return contentTransaction(deps, actor, async (tx, now): Promise<ReusableResult> => {
    const stored = await readReusable(tx, id, { lock: "update" });
    if (!stored) return { kind: "not_found" };
    if (!actor.permissions.has("reusable_sections.archive")) return refuse(tx, change, now, action, id, "Archiving and restoring reusable sections needs a permission you don't hold.");
    if (stored.lockVersion !== expectedVersion) {
      await audit(tx, change, now, { action, id, label: stored.name, outcome: "failed", summary: `Refused: the reusable section changed after it was opened (version ${expectedVersion}, now ${stored.lockVersion}).` });
      return { kind: "stale" };
    }
    if (stored.archived === raw.archived) return { kind: "ok", id, lockVersion: stored.lockVersion, summary: raw.archived ? "It was already archived." : "It was already restored." };
    if (raw.archived) {
      const uses = await reusableUses(tx, id, { lock: true });
      if (uses.length) {
        await audit(tx, change, now, { action, id, label: stored.name, outcome: "failed", summary: `Refused: still linked by ${uses.length} section${uses.length === 1 ? "" : "s"}.`, changes: { count: uses.length } });
        return { kind: "denied", message: `This reusable section is still used by ${uses.length} section${uses.length === 1 ? "" : "s"}. Detach or remove them first.` };
      }
    }
    await tx
      .update(reusableSections)
      .set(
        raw.archived
          ? { publicationStatus: "archived", draftStatus: "none", archivedAt: now, archivedBy: actor.user.id, lockVersion: sql`${reusableSections.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id }
          : { publicationStatus: "unpublished", draftStatus: "draft", archivedAt: null, archivedBy: null, lockVersion: sql`${reusableSections.lockVersion} + 1`, updatedAt: now, updatedBy: actor.user.id },
      )
      .where(eq(reusableSections.id, id));
    await audit(tx, change, now, { action, id, label: stored.name, summary: `${raw.archived ? "Archived" : "Restored"} the reusable section “${stored.name.slice(0, 80)}”.` });
    return { kind: "ok", id, lockVersion: stored.lockVersion + 1, summary: raw.archived ? "Archived." : "Restored: it can be linked again." };
  });
}

// --- Reads ---------------------------------------------------------------------------------------------------------------

export interface ReusableRow {
  id: string;
  name: string;
  blockType: string;
  blockLabel: string;
  archived: boolean;
  uses: number;
  lockVersion: number;
  updatedAt: Date | null;
}

/** Every reusable section (archived ones last), with how many sections link it. */
export async function listReusables(db: Db): Promise<ReusableRow[]> {
  const rows = await rowsOf<{ id: string; name: string; block_type: string; publication_status: string; lock_version: number; updated_at: unknown; uses: number }>(
    db,
    sql`SELECT r.id, r.name, r.block_type, r.publication_status, r.lock_version, r.updated_at,
               (SELECT COUNT(*) FROM page_sections s WHERE s.reusable_section_id = r.id) AS uses
          FROM reusable_sections r WHERE r.deleted_at IS NULL
         ORDER BY (r.publication_status = 'archived'), r.name, r.id LIMIT 500`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    blockType: r.block_type,
    blockLabel: REGISTRY.get(r.block_type)?.label ?? r.block_type,
    archived: r.publication_status === "archived",
    uses: Number(r.uses),
    lockVersion: Number(r.lock_version),
    updatedAt: r.updated_at instanceof Date ? r.updated_at : typeof r.updated_at === "string" ? new Date(`${r.updated_at.replace(" ", "T")}Z`) : null,
  }));
}

export interface ReusableUseView {
  sectionId: string;
  owner: OwnerRef;
  label: string;
  builderHref: string;
}

/** "Used by" (A5 brief §45): the pages and services whose sections link it, with links to their builders. */
export async function reusableUseViews(db: Db, id: string): Promise<ReusableUseView[]> {
  const uses = await reusableUses(db, id);
  const pageRefs = await refsByIds(db, "page", [...new Set(uses.filter((u) => u.owner.type === "page").map((u) => u.owner.id))]);
  const serviceRefs = await refsByIds(db, "service", [...new Set(uses.filter((u) => u.owner.type === "service").map((u) => u.owner.id))]);
  const names = new Map([...pageRefs, ...serviceRefs].map((r) => [`${r.type}:${r.id}`, refLabel(r)]));
  return uses.map((u) => ({
    sectionId: u.sectionId,
    owner: u.owner,
    label: names.get(`${u.owner.type}:${u.owner.id}`) ?? "(removed)",
    builderHref: `/admin/${u.owner.type === "page" ? "pages" : "services"}/${u.owner.id}/builder`,
  }));
}
