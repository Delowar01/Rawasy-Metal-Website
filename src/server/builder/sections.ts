/**
 * The page builder's changes (A5 brief §31–§35, §44–§48, §56–§57, §63–§67): one layout save, the layout's set-up, and
 * the two reusable-section operations on one section (detach; create a reusable section from a section, as a copy or
 * linked). Every change is one transaction (`contentTransaction`: the acting user still active and the session still
 * live) that
 *
 * 1. locks the owner's root row (a page or a service) FOR UPDATE and refuses a version other than the one the builder
 *    opened ("This page layout changed after you opened it…"): the root's lock_version is the layout's version;
 * 2. decides the permission from the session's keys (`structure.ts`: content and structure separately);
 * 3. share-locks the reusable sections the change will show anew (links, duplicated links, a detach's source), then
 *    locks the owner's sections FOR UPDATE and resolves every input reference against them (a section of another owner
 *    is "no longer on this page", never touched). A reusable section's own changes lock its row and then the sections
 *    linking it, so this order never meets theirs in a cycle;
 * 4. validates each changed section completely with the block registry (strict schemas, language parity, sizes), its
 *    references (A4 media, A3 records: new ones share-locked) and its languages' states;
 * 5. checks the change (structure permission, locks, the blocks' policies) and the final layout (the owner's contract);
 * 6. writes the layout (positions renumbered through a free range), the changed texts, bumps the root's version and
 *    audits each operation compactly (block names, ids, states — never texts or JSON).
 *
 * Nothing here publishes: the public site never reads these tables before A9 (T1 Option B).
 */
import { and, eq, sql } from "drizzle-orm";
import { recordAudit, type AuditOutcome } from "../audit/audit.ts";
import { auditActorOf, type Actor, type RequestMeta } from "../auth/types.ts";
import type { Db } from "../db/client.ts";
import { pageSectionTranslations, reusableSections } from "../db/schema-builder.ts";
import { contentTransaction, type CmsDeps } from "../cms/store.ts";
import { ulid } from "../security/ids.ts";
import type { BlockDefinition, OwnerKind } from "./block.ts";
import { cloneWithNewIds, defaultsOf, LOCALES, referencesOf, type BlockReferences, type Content, type FieldIssue, type Locale, type Settings } from "./fields.ts";
import { layoutInputSchema, NEW_REF, reusableNameSchema, sectionActionSchema, type SectionInput } from "./input.ts";
import { certificateAnchorProblem, certificateIssues, isCertificateCopy, referenceIssues } from "./references.ts";
import { REGISTRY, type ReadResult } from "./registry.ts";
import {
  bumpOwner,
  lockLinkedReusables,
  lockSection,
  readOwner,
  readReusable,
  readSections,
  recordSlugs,
  writeLayout,
  writeReusableTranslations,
  writeSectionTranslations,
  type OwnerRef,
  type OwnerState,
  type SectionWrite,
  type StoredReusable,
  type StoredSection,
  type TranslationWrite,
} from "./store.ts";
import {
  changeIssues,
  CONTRACTS,
  HERO_VARIANT_OF,
  layoutIssues,
  lockReason,
  mayChangeStructure,
  mayEditContent,
  mayInitialize,
  NO_STRUCTURE_PERMISSION,
  OWNER_LABELS,
  type LayoutSection,
} from "./structure.ts";
import { planTexts } from "./texts.ts";

export const LAYOUT_STALE = "This page layout changed after you opened it. Reload and review the latest version before saving.";
export const SECTION_GONE = "A section of this layout is no longer on this page. Reload the builder.";

export interface SectionIssue {
  /** The section as the editor names it (its id, or its new reference). */
  ref?: string;
  /** The field: "settings.items.0.icon", "content.ar.title" … */
  path?: string;
  message: string;
}

export type LayoutResult =
  | { kind: "ok"; lockVersion: number; ids: Record<string, string>; summary: string }
  | { kind: "stale" }
  | { kind: "not_found" }
  | { kind: "archived" }
  | { kind: "denied"; message: string }
  | { kind: "invalid"; message: string; issues: SectionIssue[] };

export interface BuilderChange {
  deps: CmsDeps;
  actor: Actor;
  meta: RequestMeta;
}

/** A stored section's data through the registry (upcast and validated), or why it can't be read. */
export function readSectionData(section: Pick<StoredSection, "blockType" | "schemaVersion" | "settings" | "translations">): ReadResult {
  const content: Partial<Record<Locale, unknown>> = {};
  for (const locale of LOCALES) if (section.translations[locale]) content[locale] = section.translations[locale]!.content;
  return REGISTRY.read(section.blockType, section.schemaVersion, section.settings, content);
}

const pageHeroVariant = (blockType: string, settings: unknown) =>
  blockType === "page.hero" && settings && typeof settings === "object" ? String((settings as Settings).variant ?? "") : undefined;

const layoutSection = (s: { id: string; blockType: string; anchor: string | null; visible: boolean; devices: StoredSection["devices"]; locked: boolean; reusableId: string | null }, settings: unknown): LayoutSection => ({
  id: s.id,
  blockType: s.blockType,
  anchor: s.anchor,
  visible: s.visible,
  devices: { ...s.devices },
  locked: s.locked,
  reusableId: s.reusableId,
  variant: pageHeroVariant(s.blockType, settings),
});

interface Planned {
  ref: string;
  id: string;
  isNew: boolean;
  def: BlockDefinition | undefined;
  write: SectionWrite;
  /** Texts to write (sections whose data changed or new ones), else undefined. */
  texts?: Record<Locale, TranslationWrite | null>;
  stored?: StoredSection;
  duplicateOf?: string;
  linked?: string;
  /** `upcast`: the stored data was an older block version, so its texts are rewritten at the new one (F3). */
  changed?: { settings: boolean; en: boolean; ar: boolean; statuses: Record<string, unknown>; upcast: boolean };
}

const ownerTag = (ref: OwnerRef) => `${ref.type}:${ref.id}`;

async function audit(tx: Db, change: BuilderChange, now: Date, event: { action: string; type: string; id: string; label?: string | null; outcome?: AuditOutcome; summary: string; changes?: Record<string, unknown> }) {
  await recordAudit(tx, {
    at: now,
    requestId: change.meta.requestId,
    actor: auditActorOf(change.actor),
    ip: change.meta.ip,
    action: event.action,
    entity: { type: event.type, id: event.id, label: event.label ? event.label.slice(0, 120) : null },
    outcome: event.outcome ?? "success",
    summary: event.summary,
    changes: event.changes,
  });
}

/** A refused change, audited in the change's transaction (it commits with nothing else written): who, which owner, why. */
async function refuse(tx: Db, change: BuilderChange, now: Date, owner: OwnerRef, action: string, message: string): Promise<LayoutResult> {
  await audit(tx, change, now, { action, type: owner.type, id: owner.id, outcome: "denied", summary: `Refused: ${message}`.slice(0, 250), changes: { owner: ownerTag(owner) } });
  return { kind: "denied", message };
}

/**
 * A layout change the owner's structure policy refuses (a part removed, moved or hidden that may not be, a block the page
 * can't hold …), audited as a failed change in the change's transaction (A5 security review, F5): the first reason and
 * how many there are — fixed messages and block names, never texts.
 */
async function refused(tx: Db, change: BuilderChange, now: Date, owner: OwnerState, action: string, message: string, issues: SectionIssue[]): Promise<LayoutResult> {
  const first = issues[0]?.message ?? message;
  await audit(tx, change, now, {
    action,
    type: owner.ref.type,
    id: owner.ref.id,
    label: owner.label,
    outcome: "failed",
    summary: `Refused: ${first}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}`.slice(0, 250),
    changes: { owner: ownerTag(owner.ref), count: issues.length },
  });
  return { kind: "invalid", message, issues };
}

/**
 * Why a new section can't show a reusable section here, or no issues: it must exist and not be archived (read with the
 * share lock taken before the owner's sections), and on certificate copy its settings and texts pass A3's digit guard
 * (A5 security review, F1/F2) — whether the section links it or duplicates a link to it.
 */
function linkIssues(kind: OwnerState["kind"], reusable: StoredReusable | null | undefined): FieldIssue[] {
  if (!reusable) return [{ path: "reusableId", message: "This reusable section no longer exists." }];
  if (reusable.archived) return [{ path: "reusableId", message: "This reusable section is archived: restore it before linking it." }];
  const def = REGISTRY.get(reusable.blockType);
  if (!def || !isCertificateCopy(kind, def)) return [];
  const read = readSectionData({ blockType: reusable.blockType, schemaVersion: reusable.schemaVersion, settings: reusable.settings, translations: reusable.translations });
  if (read.state !== "ok") return [{ path: "reusableId", message: "This reusable section's texts can't be read, so they can't be checked for this page." }];
  return certificateIssues(def, read);
}

/** A stale editor, audited as a failed change (A3's pattern): the version it opened and the one stored. */
async function stale(tx: Db, change: BuilderChange, now: Date, owner: OwnerState, action: string, expected: number): Promise<LayoutResult> {
  await audit(tx, change, now, { action, type: owner.ref.type, id: owner.ref.id, label: owner.label, outcome: "failed", summary: `Refused: the layout changed after the builder was opened (version ${expected}, now ${owner.lockVersion}).` });
  return { kind: "stale" };
}

/**
 * Validates one section's data (settings, texts, language marks) for a block: registry, references, languages. Returns
 * the values to store or the issues (with the section's reference).
 */
async function checkData(
  tx: Db,
  owner: OwnerState,
  def: BlockDefinition,
  ref: string,
  data: NonNullable<SectionInput["data"]>,
  stored: { section: StoredSection; read: ReadResult } | null,
  actorId: string,
  now: Date,
): Promise<{ ok: true; settings: Settings; texts: Record<Locale, TranslationWrite | null>; changed: Planned["changed"] } | { ok: false; issues: SectionIssue[] }> {
  const content: Partial<Record<Locale, unknown>> = {};
  for (const locale of LOCALES) if (data.content[locale] !== undefined && data.content[locale] !== null) content[locale] = data.content[locale];
  const checked = REGISTRY.validate(def, data.settings, content);
  if (!checked.ok) return { ok: false, issues: checked.issues.map((i) => ({ ref, path: i.path, message: i.message })) };
  const storedOk = stored?.read.state === "ok" ? stored.read : null;
  const before: BlockReferences | null = storedOk ? referencesOf(def.settings, def.content, storedOk.settings, storedOk.content) : null;
  const refIssues = await referenceIssues(tx, owner.kind, def, { settings: checked.settings, content: checked.content }, before);
  const plan = planTexts({
    def,
    settings: checked.settings,
    content: checked.content,
    stored: stored?.section.translations ?? {},
    storedContent: storedOk?.content ?? null,
    marked: data.complete,
    otherUnaffected: data.otherUnaffected,
    actorId,
    now,
  });
  const issues = [...refIssues, ...plan.issues].map((i: FieldIssue) => ({ ref, path: i.path, message: i.message }));
  if (issues.length) return { ok: false, issues };
  const settingsChanged = !storedOk || JSON.stringify(storedOk.settings) !== JSON.stringify(checked.settings);
  return {
    ok: true,
    settings: checked.settings,
    texts: plan.rows,
    changed: { settings: settingsChanged, en: plan.changed.en, ar: plan.changed.ar, statuses: plan.statusChanges, upcast: Boolean(storedOk?.upcast) },
  };
}

/** One layout save (A5 brief §31–§35). `raw` is the parsed JSON the action received; it is validated here. */
export async function saveLayout(change: BuilderChange, raw: unknown): Promise<LayoutResult> {
  const parsed = layoutInputSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", message: "The layout couldn't be read. Reload the builder and try again.", issues: [] };
  const input = parsed.data;
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<LayoutResult> => {
    const owner = await readOwner(tx, input.owner, { lock: true });
    if (!owner) return { kind: "not_found" };
    if (!mayEditContent(actor.permissions, owner.kind)) return refuse(tx, change, now, owner.ref, "layout.save", "You can view this layout but not change it.");
    if (owner.archived) return { kind: "archived" };
    if (owner.lockVersion !== input.expectedVersion) return stale(tx, change, now, owner, "layout.save", input.expectedVersion);
    const structure = mayChangeStructure(actor.permissions, owner.kind);
    const linked = await lockLinkedReusables(tx, owner.ref, input.sections.filter((entry) => NEW_REF.test(entry.ref)));
    const stored = await readSections(tx, owner.ref, { lock: true });
    const byId = new Map(stored.map((s) => [s.id, s]));
    const reads = new Map(stored.map((s) => [s.id, readSectionData(s)]));
    const issues: SectionIssue[] = [];
    const planned: Planned[] = [];
    const duplicates = new Map<string, string>();

    for (const entry of input.sections) {
      const isNew = NEW_REF.test(entry.ref);
      if (!isNew) {
        const section = byId.get(entry.ref);
        if (!section) {
          issues.push({ ref: entry.ref, message: SECTION_GONE });
          continue;
        }
        if (entry.duplicateOf || (entry.blockType !== undefined && entry.blockType !== section.blockType) || (entry.reusableId !== undefined && entry.reusableId !== section.reusableId)) {
          issues.push({ ref: entry.ref, message: "A section's block type and reusable link can't be changed here." });
          continue;
        }
        const def = REGISTRY.get(section.blockType);
        const read = reads.get(section.id)!;
        let settings = section.settings as Settings;
        let schemaVersion = section.schemaVersion;
        let texts: Planned["texts"];
        let changed: Planned["changed"];
        if (entry.data) {
          if (section.reusableId) {
            issues.push({ ref: entry.ref, message: "This section shows a reusable section: edit it in Reusable sections, or detach it first." });
            continue;
          }
          if (!def || !def.storable) {
            issues.push({ ref: entry.ref, message: "This section's block type is not known to this version of the admin; it can't be edited." });
            continue;
          }
          if (read.state === "future_version") {
            issues.push({ ref: entry.ref, message: "This section was saved with a newer block version; it can't be edited here." });
            continue;
          }
          const result = await checkData(tx, owner, def, entry.ref, entry.data, { section, read }, actor.user.id, now);
          if (!result.ok) {
            issues.push(...result.issues);
            continue;
          }
          settings = result.settings;
          schemaVersion = def.version;
          texts = result.texts;
          changed = result.changed;
        }
        planned.push({
          ref: entry.ref,
          id: section.id,
          isNew: false,
          def,
          stored: section,
          texts,
          changed,
          write: {
            id: section.id,
            blockType: section.blockType,
            schemaVersion,
            visible: entry.visible,
            devices: entry.devices,
            locked: section.locked,
            anchor: entry.anchor,
            reusableId: section.reusableId,
            detachedFromId: section.detachedFromId,
            settings,
          },
        });
        continue;
      }

      // A new section: a duplicate, a link to a reusable section, or a new block.
      const id = ulid(now.getTime());
      let blockType = entry.blockType;
      let reusableId: string | null = null;
      let linkedVersion = 0;
      let data = entry.data;
      if (entry.duplicateOf) {
        const original = byId.get(entry.duplicateOf);
        if (!original) {
          issues.push({ ref: entry.ref, message: SECTION_GONE });
          continue;
        }
        duplicates.set(id, original.id);
        blockType = original.blockType;
        if (original.reusableId) {
          // A linked section duplicates as another link to the same reusable section (A5 brief §47).
          if (data) {
            issues.push({ ref: entry.ref, message: "A linked section shows the reusable section's own settings and texts." });
            continue;
          }
          const reusable = linked.get(original.reusableId);
          if (!reusable || reusable.archived) {
            issues.push({ ref: entry.ref, message: reusable ? "This reusable section is archived: restore it before linking it." : "This reusable section no longer exists." });
            continue;
          }
          reusableId = original.reusableId;
          linkedVersion = reusable.schemaVersion;
        } else if (!data) {
          const read = reads.get(original.id)!;
          if (read.state !== "ok") {
            issues.push({ ref: entry.ref, message: "This section's data can't be read, so it can't be duplicated." });
            continue;
          }
          const copy = cloneWithNewIds(REGISTRY.get(original.blockType)!.settings, read.settings, read.content);
          const marks = { en: original.translations.en?.status === "complete", ar: original.translations.ar?.status === "complete" };
          data = { settings: copy.settings, content: copy.content, complete: marks, otherUnaffected: true };
        }
      } else if (entry.reusableId) {
        const reusable = linked.get(entry.reusableId);
        if (!reusable || reusable.archived) {
          issues.push({ ref: entry.ref, message: reusable ? "This reusable section is archived: restore it before linking it." : "This reusable section no longer exists." });
          continue;
        }
        if (entry.blockType && entry.blockType !== reusable.blockType) {
          issues.push({ ref: entry.ref, message: "The reusable section's block type doesn't match." });
          continue;
        }
        blockType = reusable.blockType;
        reusableId = reusable.id;
        linkedVersion = reusable.schemaVersion;
        if (data) {
          issues.push({ ref: entry.ref, message: "A linked section shows the reusable section's own settings and texts." });
          continue;
        }
      }
      const def = blockType ? REGISTRY.get(blockType) : undefined;
      if (!def || !def.storable) {
        issues.push({ ref: entry.ref, message: "Unknown block type." });
        continue;
      }
      if (reusableId) {
        const problems = linkIssues(owner.kind, linked.get(reusableId));
        if (problems.length) {
          issues.push(...problems.map((i) => ({ ref: entry.ref, path: i.path, message: i.message })));
          continue;
        }
      }
      let settings: Settings = {};
      let texts: Planned["texts"];
      let changed: Planned["changed"];
      if (!reusableId) {
        if (!data) {
          const defaults = defaultsOf(def.settings, def.content);
          if (def.key === "page.hero") defaults.settings.variant = HERO_VARIANT_OF[owner.kind] ?? defaults.settings.variant;
          data = { settings: defaults.settings, content: {}, complete: { en: false, ar: false }, otherUnaffected: false };
        }
        const result = await checkData(tx, owner, def, entry.ref, data, null, actor.user.id, now);
        if (!result.ok) {
          issues.push(...result.issues);
          continue;
        }
        settings = result.settings;
        texts = result.texts;
        changed = result.changed;
      }
      planned.push({
        ref: entry.ref,
        id,
        isNew: true,
        def,
        texts,
        changed,
        duplicateOf: duplicates.get(id),
        linked: reusableId ?? undefined,
        write: {
          id,
          blockType: def.key,
          schemaVersion: reusableId ? linkedVersion : def.version,
          visible: entry.visible,
          devices: entry.devices,
          locked: def.locked,
          anchor: def.anchor === "fixed" ? (def.fixedAnchor ?? null) : def.anchor === "none" ? null : entry.anchor,
          reusableId,
          detachedFromId: null,
          settings,
        },
      });
    }
    // Certificate copy: an anchor is part of the page's address, so it holds no registration-like number either (F1).
    for (const p of planned) {
      const problem = p.def && isCertificateCopy(owner.kind, p.def) ? certificateAnchorProblem(p.write.anchor) : null;
      if (problem) issues.push({ ref: p.ref, path: "anchor", message: problem });
    }
    if (issues.length) return { kind: "invalid", message: "Some sections need attention. Nothing was saved.", issues };

    // The change against the stored layout, then the final layout against the owner's contract.
    const before = stored.map((s) => layoutSection(s, s.settings));
    const after = planned.map((p) => layoutSection(p.write, p.write.settings));
    const refOf = (sectionId?: string) => planned.find((p) => p.id === sectionId)?.ref ?? sectionId;
    const changeProblems = changeIssues(owner.kind, before, after, { structure, duplicates });
    if (changeProblems.length) {
      if (!structure) return refuse(tx, change, now, owner.ref, "layout.save", CONTRACTS[owner.kind].lockedReason ?? NO_STRUCTURE_PERMISSION);
      return refused(tx, change, now, owner, "layout.save", "This layout change isn't allowed. Nothing was saved.", changeProblems.map((p) => ({ ref: refOf(p.sectionId), message: p.message })));
    }
    const layoutProblems = layoutIssues(owner.kind, after, { recordSlugs: await recordSlugs(tx) });
    if (layoutProblems.length) {
      return refused(tx, change, now, owner, "layout.save", "The page's structure would not be valid. Nothing was saved.", layoutProblems.map((p) => ({ ref: refOf(p.sectionId), message: p.message })));
    }

    // What this save changes, operation by operation (A5 brief §64): names, ids and states only — never texts or JSON.
    const keptIds = new Set(planned.filter((p) => !p.isNew).map((p) => p.id));
    const removed = stored.filter((s) => !keptIds.has(s.id));
    const base = { owner: ownerTag(owner.ref) };
    const events: Parameters<typeof audit>[3][] = [];
    const nameOf = (blockType: string) => REGISTRY.get(blockType)?.label ?? blockType;
    for (const s of removed) {
      events.push({ action: "section.remove", type: "page_section", id: s.id, label: nameOf(s.blockType), summary: `Removed “${nameOf(s.blockType)}” from ${owner.label}.`, changes: { ...base, block: s.blockType } });
    }
    const visibility = (s: { visible: boolean; devices: StoredSection["devices"] }) => ({ visible: s.visible, ...s.devices });
    for (const [i, p] of planned.entries()) {
      const name = nameOf(p.write.blockType);
      if (p.isNew) {
        const action = p.duplicateOf ? "section.duplicate" : p.linked ? "section.link_reusable" : "section.create";
        events.push({
          action,
          type: "page_section",
          id: p.id,
          label: name,
          summary: `${p.duplicateOf ? "Duplicated" : p.linked ? "Linked a reusable section as" : "Added"} “${name}” on ${owner.label}.`,
          changes: { ...base, block: p.write.blockType, position: i + 1, ...(p.duplicateOf ? { from: p.duplicateOf } : {}), ...(p.linked ? { reusable: p.linked } : {}) },
        });
        continue;
      }
      const old = p.stored!;
      if (p.changed && (p.changed.settings || p.changed.en || p.changed.ar || Object.keys(p.changed.statuses).length)) {
        const parts = [p.changed.settings && "settings", p.changed.en && "English", p.changed.ar && "Arabic"].filter(Boolean);
        events.push({
          action: "section.update",
          type: "page_section",
          id: p.id,
          label: name,
          summary: `Edited “${name}” on ${owner.label}${parts.length ? ` (${parts.join(", ")})` : " (language states)"}.`,
          changes: { ...base, block: old.blockType, settings: p.changed.settings, en: p.changed.en, ar: p.changed.ar, status: p.changed.statuses },
        });
      }
      if (JSON.stringify(visibility(old)) !== JSON.stringify(visibility(p.write))) {
        events.push({ action: "section.visibility", type: "page_section", id: p.id, label: name, summary: `Changed where “${name}” shows on ${owner.label}.`, changes: { ...base, before: visibility(old), after: visibility(p.write) } });
      }
      if (old.anchor !== p.write.anchor) {
        events.push({ action: "section.anchor", type: "page_section", id: p.id, label: name, summary: `Changed the anchor of “${name}” on ${owner.label}.`, changes: { ...base, before: old.anchor, after: p.write.anchor } });
      }
    }
    const keptBefore = stored.filter((s) => keptIds.has(s.id)).map((s) => s.id);
    const keptAfter = planned.filter((p) => !p.isNew).map((p) => p.id);
    if (keptBefore.join() !== keptAfter.join()) {
      events.push({ action: "layout.reorder", type: owner.ref.type, id: owner.ref.id, label: owner.label, summary: `Reordered the sections of ${owner.label}.`, changes: { ...base, count: keptAfter.length } });
    }
    if (!events.length) return { kind: "ok", lockVersion: owner.lockVersion, ids: {}, summary: "Nothing to save: the layout is as stored." };

    // Write, bump the layout's version, audit.
    await writeLayout(
      tx,
      owner.ref,
      { order: planned.map((p) => p.id), kept: planned.filter((p) => !p.isNew).map((p) => p.write), added: planned.filter((p) => p.isNew).map((p) => p.write), removed: removed.map((s) => s.id) },
      stored,
      actor.user.id,
      now,
    );
    for (const p of planned) {
      // Texts stored at an older block version are rewritten whenever the section is saved at the new one (F3).
      const textsChanged = p.changed && (p.isNew || p.changed.en || p.changed.ar || Object.keys(p.changed.statuses).length > 0 || p.changed.upcast);
      if (p.texts && textsChanged) await writeSectionTranslations(tx, p.id, p.texts, actor.user.id, now);
    }
    await bumpOwner(tx, owner.ref, actor.user.id, now);
    for (const event of events) await audit(tx, change, now, event);
    const ids = Object.fromEntries(planned.filter((p) => p.isNew).map((p) => [p.ref, p.id]));
    return { kind: "ok", lockVersion: owner.lockVersion + 1, ids, summary: `Saved the layout of ${owner.label}.` };
  });
}

/**
 * Sets up an empty layout (A5: "not set up" → the contract's sections, empty texts). A service starts from the "New
 * service page template" when that template has a layout (its sections copied, links kept), else from the contract.
 */
export async function initializeLayout(change: BuilderChange, rawOwner: unknown, rawVersion: unknown): Promise<LayoutResult> {
  const parsed = sectionActionSchema.omit({ sectionId: true }).safeParse({ owner: rawOwner, expectedVersion: rawVersion });
  if (!parsed.success) return { kind: "not_found" };
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<LayoutResult> => {
    const owner = await readOwner(tx, parsed.data.owner, { lock: true });
    if (!owner) return { kind: "not_found" };
    if (!mayInitialize(actor.permissions, owner.kind)) return refuse(tx, change, now, owner.ref, "layout.initialize", "Setting up this layout needs a permission you don't hold.");
    if (owner.archived) return { kind: "archived" };
    if (owner.lockVersion !== parsed.data.expectedVersion) return stale(tx, change, now, owner, "layout.initialize", parsed.data.expectedVersion);
    if ((await readSections(tx, owner.ref, { lock: true })).length) return { kind: "invalid", message: "This layout is already set up.", issues: [] };

    const writes: SectionWrite[] = [];
    const texts = new Map<string, Record<Locale, TranslationWrite | null>>();
    const template = owner.kind === "service" ? await templateSections(tx) : [];
    // The template's links are copied: each reusable section is share-locked and must still exist, unarchived (F2).
    for (const id of [...new Set(template.flatMap((source) => (source.reusableId ? [source.reusableId] : [])))].sort()) {
      const reusable = await readReusable(tx, id, { lock: "share" });
      if (!reusable || reusable.archived) return { kind: "invalid", message: "The service page template links a reusable section that is archived or no longer exists. Fix the template first.", issues: [] };
    }
    if (template.length) {
      for (const source of template) {
        const id = ulid(now.getTime());
        const def = REGISTRY.get(source.blockType);
        const read = readSectionData(source);
        if (!def || (!source.reusableId && read.state !== "ok")) continue;
        let settings: Settings = {};
        if (!source.reusableId && read.state === "ok") {
          const copy = cloneWithNewIds(def.settings, read.settings, read.content);
          settings = copy.settings;
          texts.set(
            id,
            Object.fromEntries(
              LOCALES.map((locale) => {
                const t = source.translations[locale];
                return [locale, t && copy.content[locale] ? { content: copy.content[locale] as Content, status: t.status === "complete" ? "complete" : "draft", completedAt: t.status === "complete" ? now : null, completedBy: t.status === "complete" ? actor.user.id : null } : null];
              }),
            ) as Record<Locale, TranslationWrite | null>,
          );
        }
        writes.push({ id, blockType: def.key, schemaVersion: source.reusableId ? source.schemaVersion : def.version, visible: source.visible, devices: source.devices, locked: def.locked, anchor: source.anchor, reusableId: source.reusableId, detachedFromId: null, settings });
      }
    }
    if (!writes.length) {
      for (const initial of CONTRACTS[owner.kind].initial) {
        const def = REGISTRY.get(initial.blockType)!;
        const defaults = defaultsOf(def.settings, def.content);
        if (def.key === "page.hero") defaults.settings.variant = HERO_VARIANT_OF[owner.kind];
        const checked = REGISTRY.validate(def, defaults.settings, {});
        if (!checked.ok) throw new Error(`The defaults of ${def.key} are invalid.`);
        writes.push({
          id: ulid(now.getTime()),
          blockType: def.key,
          schemaVersion: def.version,
          visible: true,
          devices: { desktop: true, tablet: true, mobile: true },
          locked: def.locked,
          anchor: initial.anchor ?? (def.anchor === "fixed" ? (def.fixedAnchor ?? null) : null),
          reusableId: null,
          detachedFromId: null,
          settings: checked.settings,
        });
      }
    }
    const problems = layoutIssues(owner.kind, writes.map((w) => layoutSection(w, w.settings)), { recordSlugs: await recordSlugs(tx) });
    if (problems.length) return { kind: "invalid", message: "The template's layout isn't valid for this page. Nothing was set up.", issues: problems.map((p) => ({ message: p.message })) };
    await writeLayout(tx, owner.ref, { order: writes.map((w) => w.id), kept: [], added: writes, removed: [] }, [], actor.user.id, now);
    for (const [id, rows] of texts) await writeSectionTranslations(tx, id, rows, actor.user.id, now);
    await bumpOwner(tx, owner.ref, actor.user.id, now);
    await audit(tx, change, now, {
      action: "layout.initialize",
      type: owner.ref.type,
      id: owner.ref.id,
      label: owner.label,
      summary: `Set up the layout of ${owner.label} (${writes.length} section${writes.length === 1 ? "" : "s"}${template.length ? ", from the service template" : ""}).`,
      changes: { owner: ownerTag(owner.ref), count: writes.length, kind: owner.kind },
    });
    return { kind: "ok", lockVersion: owner.lockVersion + 1, ids: {}, summary: `Set up the layout of ${owner.label} (${OWNER_LABELS[owner.kind]}).` };
  });
}

/** The "New service page template" page's sections (read in the same transaction, not locked: it is only copied). */
async function templateSections(tx: Db): Promise<StoredSection[]> {
  const [row] = (await tx.execute(sql`SELECT id FROM pages WHERE page_type = 'template' AND system_key = 'service_detail_default' AND deleted_at IS NULL`)) as unknown as [{ id: string }[]];
  const id = row?.[0]?.id;
  return id ? readSections(tx, { type: "page", id }, { lock: false }) : [];
}

/**
 * Detach (A5 brief §44): the section becomes a local copy of the reusable section's current working settings and texts
 * (new item ids), keeps where it came from (`detached_from_id`) and no longer follows it. A structure change. The
 * reusable section is share-locked before the section (the order of `saveLayout`), so the copy holds its texts as they
 * are when the detach commits; the copy is checked as the page's own section would be: its references (it now names
 * them itself) and, on certificate copy, A3's digit guard (A5 security review, F1/F2).
 */
export async function detachSection(change: BuilderChange, raw: unknown): Promise<LayoutResult> {
  const parsed = sectionActionSchema.safeParse(raw);
  if (!parsed.success) return { kind: "not_found" };
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<LayoutResult> => {
    const owner = await readOwner(tx, parsed.data.owner, { lock: true });
    if (!owner) return { kind: "not_found" };
    if (!mayEditContent(actor.permissions, owner.kind)) return refuse(tx, change, now, owner.ref, "section.detach_reusable", "You can view this layout but not change it.");
    if (!mayChangeStructure(actor.permissions, owner.kind)) return refuse(tx, change, now, owner.ref, "section.detach_reusable", CONTRACTS[owner.kind].lockedReason ?? NO_STRUCTURE_PERMISSION);
    if (owner.archived) return { kind: "archived" };
    if (owner.lockVersion !== parsed.data.expectedVersion) return stale(tx, change, now, owner, "section.detach_reusable", parsed.data.expectedVersion);
    // The reusable section first (share lock), then the section: the link read here is the stored one (the owner's root
    // lock, held, is what every change of the owner's sections takes first).
    const linked = await lockLinkedReusables(tx, owner.ref, [{ duplicateOf: parsed.data.sectionId }]);
    const section = await lockSection(tx, owner.ref, parsed.data.sectionId);
    if (!section) return { kind: "invalid", message: SECTION_GONE, issues: [] };
    if (!section.reusableId) return { kind: "invalid", message: "This section isn't linked to a reusable section.", issues: [] };
    const reason = lockReason(owner.kind, REGISTRY.get(section.blockType), section, "detach");
    if (reason) return refuse(tx, change, now, owner.ref, "section.detach_reusable", reason);
    const reusable = linked.get(section.reusableId) ?? null;
    const def = reusable ? REGISTRY.get(reusable.blockType) : undefined;
    const read = reusable ? readSectionData({ blockType: reusable.blockType, schemaVersion: reusable.schemaVersion, settings: reusable.settings, translations: reusable.translations }) : null;
    if (!reusable || !def || !read || read.state !== "ok") return { kind: "invalid", message: "The reusable section's settings and texts can't be read, so it can't be detached.", issues: [] };
    const copy = cloneWithNewIds(def.settings, read.settings, read.content);
    // The copy names what the reusable section named (kept references), now as this page's own section.
    const kept = referencesOf(def.settings, def.content, read.settings, read.content);
    const problems = await referenceIssues(tx, owner.kind, def, { settings: copy.settings, content: copy.content }, kept);
    if (problems.length) return { kind: "invalid", message: "This reusable section can't become a local copy here. Nothing was changed.", issues: problems.map((i) => ({ ref: section.id, path: i.path, message: i.message })) };
    const rows = Object.fromEntries(
      LOCALES.map((locale) => {
        const t = reusable.translations[locale];
        const content = copy.content[locale];
        return [locale, t && content ? { content: content as Content, status: t.status, completedAt: t.completedAt, completedBy: t.completedBy } : null];
      }),
    ) as Record<Locale, TranslationWrite | null>;
    const stored = await readSections(tx, owner.ref, { lock: true });
    await writeLayout(
      tx,
      owner.ref,
      {
        order: stored.map((s) => s.id),
        kept: stored.map((s) => ({
          id: s.id,
          blockType: s.blockType,
          schemaVersion: s.id === section.id ? def.version : s.schemaVersion,
          visible: s.visible,
          devices: s.devices,
          locked: s.locked,
          anchor: s.anchor,
          reusableId: s.id === section.id ? null : s.reusableId,
          detachedFromId: s.id === section.id ? reusable.id : s.detachedFromId,
          settings: s.id === section.id ? copy.settings : (s.settings as Settings),
        })),
        added: [],
        removed: [],
      },
      stored,
      actor.user.id,
      now,
    );
    await writeSectionTranslations(tx, section.id, rows, actor.user.id, now);
    await bumpOwner(tx, owner.ref, actor.user.id, now);
    await audit(tx, change, now, {
      action: "section.detach_reusable",
      type: "page_section",
      id: section.id,
      label: def.label,
      summary: `Detached “${def.label}” on ${owner.label} from the reusable section “${reusable.name.slice(0, 80)}”.`,
      changes: { owner: ownerTag(owner.ref), block: def.key, reusable: reusable.id },
    });
    return { kind: "ok", lockVersion: owner.lockVersion + 1, ids: {}, summary: "Detached: this section is now a local copy." };
  });
}

/**
 * Create a reusable section from a section (A5 brief §46): `copy` keeps the section as it is and creates a reusable copy;
 * `link` also turns the section into a link to the new reusable section (a structure change). Explicit actions only.
 */
export async function createReusableFromSection(change: BuilderChange, raw: unknown, rawName: unknown, mode: "copy" | "link"): Promise<LayoutResult & { reusableId?: string }> {
  const parsed = sectionActionSchema.safeParse(raw);
  if (!parsed.success) return { kind: "not_found" };
  const name = reusableNameSchema.safeParse(rawName);
  if (!name.success) return { kind: "invalid", message: name.error.issues[0]?.message ?? "Give the reusable section a name.", issues: [] };
  const { deps, actor } = change;
  return contentTransaction(deps, actor, async (tx, now): Promise<LayoutResult & { reusableId?: string }> => {
    const owner = await readOwner(tx, parsed.data.owner, { lock: true });
    if (!owner) return { kind: "not_found" };
    if (!actor.permissions.has("reusable_sections.edit")) return refuse(tx, change, now, owner.ref, "reusable_section.create", "Creating reusable sections needs a permission you don't hold.");
    if (mode === "link" && !mayChangeStructure(actor.permissions, owner.kind)) return refuse(tx, change, now, owner.ref, "reusable_section.create", CONTRACTS[owner.kind].lockedReason ?? NO_STRUCTURE_PERMISSION);
    if (owner.lockVersion !== parsed.data.expectedVersion) return stale(tx, change, now, owner, "reusable_section.create", parsed.data.expectedVersion);
    if (mode === "link" && owner.archived) return { kind: "archived" };
    const section = await lockSection(tx, owner.ref, parsed.data.sectionId);
    if (!section) return { kind: "invalid", message: SECTION_GONE, issues: [] };
    const def = REGISTRY.get(section.blockType);
    if (section.reusableId) return { kind: "invalid", message: "This section already shows a reusable section.", issues: [] };
    if (!def?.reusable) return { kind: "invalid", message: "Only generic blocks can become reusable sections.", issues: [] };
    const read = readSectionData(section);
    if (read.state !== "ok") return { kind: "invalid", message: "This section's data can't be read, so it can't be copied.", issues: [] };
    const reusableId = ulid(now.getTime());
    await tx.insert(reusableSections).values({
      id: reusableId,
      name: name.data,
      blockType: def.key,
      schemaVersion: def.version,
      settings: read.settings,
      createdAt: now,
      createdBy: actor.user.id,
      updatedAt: now,
      updatedBy: actor.user.id,
    });
    await writeReusableTranslations(
      tx,
      reusableId,
      Object.fromEntries(
        LOCALES.map((locale) => {
          const t = section.translations[locale];
          const content = read.content[locale];
          return [locale, t && content ? { content, status: t.status, completedAt: t.completedAt, completedBy: t.completedBy } : null];
        }),
      ) as Record<Locale, TranslationWrite | null>,
      actor.user.id,
      now,
    );
    await audit(tx, change, now, {
      action: "reusable_section.create",
      type: "reusable_section",
      id: reusableId,
      label: name.data,
      summary: `Created the reusable section “${name.data.slice(0, 80)}” from “${def.label}” on ${owner.label}.`,
      changes: { block: def.key, from: section.id, owner: ownerTag(owner.ref), linked: mode === "link" },
    });
    if (mode === "copy") return { kind: "ok", lockVersion: owner.lockVersion, ids: {}, summary: "Created a reusable copy. This section stays as it is.", reusableId };
    // Link: the section now shows the reusable section; its own settings and texts go.
    await tx.execute(sql`UPDATE page_sections SET reusable_section_id = ${reusableId}, detached_from_id = NULL, settings = '{}', schema_version = ${def.version}, updated_at = ${now}, updated_by = ${actor.user.id} WHERE id = ${section.id}`);
    await tx.delete(pageSectionTranslations).where(and(eq(pageSectionTranslations.sectionId, section.id)));
    await bumpOwner(tx, owner.ref, actor.user.id, now);
    await audit(tx, change, now, {
      action: "section.link_reusable",
      type: "page_section",
      id: section.id,
      label: def.label,
      summary: `“${def.label}” on ${owner.label} now shows the reusable section “${name.data.slice(0, 80)}”.`,
      changes: { owner: ownerTag(owner.ref), block: def.key, reusable: reusableId },
    });
    return { kind: "ok", lockVersion: owner.lockVersion + 1, ids: {}, summary: "Created the reusable section and linked this section to it.", reusableId };
  });
}

export type { OwnerKind };
