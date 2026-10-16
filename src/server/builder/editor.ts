/**
 * The builder's editor model (A5 brief §29–§35, §16–§18, §51–§53): everything the visual editor shows for one page or
 * service, read for the acting person — the owner and its layout version, each block's fields and inspector controls
 * (serializable, from the registry), each section's values, language states, warnings and the operations this person
 * may make on it with the reason in words where not, the library, the reusable sections that may be linked, and the
 * choices of the record and link pickers. Read-only; every save is decided again on the server.
 *
 * Private media never appear: media cards are built without private access, so a private id reads "Not available"
 * exactly like an unknown one (a section can't name one anyway).
 */
import { inArray } from "drizzle-orm";
import type { BlockModel, BuilderModel, DesignControls, FieldModel, LinkKindName, OperationModel, ReusableEditorModel, SectionData, SectionModel } from "../admin/actions/builder-model.ts";
import type { CmsLocaleState, OptionModel } from "../admin/actions/cms-model.ts";
import { cardWarnings, type MediaCardModel } from "../admin/actions/media-model.ts";
import type { Db } from "../db/client.ts";
import { projectFlags } from "../db/schema-cms.ts";
import { pickerOptions, refLabel, type ItemRef } from "../cms/lookups.ts";
import { isBlockingFlag, flagLabel } from "../cms/registry.ts";
import { mediaCards } from "../media/cards.ts";
import { BLOCK_CATEGORIES, type BlockDefinition, type OwnerKind } from "./block.ts";
import { appearanceAllowed, DELAYS, DURATIONS, LABELS, motionPresetsFor, narrowerColumns, SURFACES, TONES, type DesignSpec } from "./design.ts";
import {
  defaultsOf,
  ENTITY_SOURCES,
  SOURCE_LABELS,
  LOCALES,
  missingSettings,
  referencesOf,
  type BlockReferences,
  type ContentFields,
  type Locale,
  type SettingsField,
  type ItemSettingsField,
  type ContentField,
  type SettingsFields,
} from "./fields.ts";
import { DEFAULT_LINK_KINDS, LINK_KIND_LABELS, LINK_KINDS, SYSTEM_LINK_KEYS, SYSTEM_LINK_LABELS } from "./links.ts";
import { DEFAULT_RICH_LIMITS } from "./richtext.ts";
import { readProblem, REGISTRY } from "./registry.ts";
import { listReusables, reusableUseViews } from "./reusable.ts";
import { readSectionData } from "./sections.ts";
import { readOwner, readReusable, readSections, type OwnerRef, type StoredSection } from "./store.ts";
import {
  CONTRACTS,
  layoutWarnings,
  libraryFor,
  lockReason,
  mayChangeStructure,
  mayEditContent,
  mayInitialize,
  NO_STRUCTURE_PERMISSION,
  OWNER_LABELS,
  VIEW_ONLY_LAYOUT,
  type LayoutSection,
} from "./structure.ts";
import { sectionLocaleState } from "./texts.ts";

// --- Field models (serializable descriptions of the registry's fields) -----------------------------------------------------

const choices = <T extends string | number>(values: readonly T[], labels?: Record<string, string>) => values.map((value) => ({ value, label: labels?.[String(value)] ?? String(value) }));

export function designControls(spec: DesignSpec): DesignControls {
  const controls: DesignControls = { responsive: Boolean(spec.responsive), appearance: [] };
  if (spec.heading?.length) controls.heading = spec.heading.map((level) => ({ value: level, label: `Heading ${level}` }));
  if (spec.roles?.length) controls.roles = choices(spec.roles, LABELS.role);
  if (spec.align) controls.align = choices(["start", "center", "end"] as const, LABELS.align);
  if (spec.measure) controls.measure = choices(["narrow", "normal", "wide"] as const, LABELS.measure);
  if (spec.variants?.length) controls.variants = spec.variants.map((v) => ({ ...v }));
  if (spec.columns?.length) {
    controls.columns = spec.columns.map((n) => ({ value: n, label: `${n} column${n === 1 ? "" : "s"}` }));
    controls.narrowerColumns = narrowerColumns(spec.columns).map((n) => ({ value: n, label: `${n} column${n === 1 ? "" : "s"}` }));
  }
  if (spec.gap) controls.gap = choices(["none", "xs", "sm", "md", "lg", "xl"] as const, LABELS.gap);
  if (spec.padding) controls.padding = choices(["none", "sm", "md", "lg"] as const, LABELS.padding);
  if (spec.width) controls.width = choices(["shell", "wide", "full"] as const, LABELS.width);
  if (spec.mediaPosition?.length) controls.mediaPosition = choices(spec.mediaPosition, LABELS.mediaPosition as Record<string, string> | undefined);
  if (spec.surfaces?.length) controls.surfaces = choices(spec.surfaces, LABELS.surface);
  if (spec.tone) controls.tones = choices(TONES, LABELS.tone);
  if (spec.border) controls.border = choices(["none", "subtle", "strong"] as const, LABELS.border);
  if (spec.radius) controls.radius = choices(["none", "card", "panel"] as const, LABELS.radius);
  if (spec.shadow) controls.shadow = choices(["none", "card", "raised"] as const, LABELS.shadow);
  if (spec.motion) {
    controls.motion = {
      presets: choices(motionPresetsFor(spec.motion.target, spec.motion.list ?? false), LABELS.motion),
      durations: choices(DURATIONS, LABELS.duration),
      delays: DELAYS.map((ms) => ({ value: ms, label: `${ms} ms` })),
    };
  }
  for (const surface of spec.surfaces?.length ? spec.surfaces : SURFACES) for (const tone of TONES) if (appearanceAllowed(surface, tone)) controls.appearance.push(`${surface}/${tone}`);
  return controls;
}

function fieldModel(key: string, field: SettingsField | ItemSettingsField | ContentField): FieldModel {
  const base = { key, label: "label" in field && field.label ? field.label : key, ...("hint" in field && field.hint ? { hint: field.hint } : {}), ...("only" in field && field.only ? { only: [...field.only] } : {}) };
  switch (field.kind) {
    case "text":
    case "textarea":
      return { ...base, kind: field.kind, max: field.max, required: Boolean(field.required) };
    case "lines":
      return { ...base, kind: "lines", maxItems: field.maxItems, maxLength: field.maxLength, required: Boolean(field.required) };
    case "rich": {
      const limits = { ...DEFAULT_RICH_LIMITS, ...field.limits };
      return { ...base, kind: "rich", required: Boolean(field.required), maxChars: limits.maxChars, maxNodes: limits.maxNodes, links: [...limits.links] as LinkKindName[], headings: limits.headings, lists: limits.lists };
    }
    case "enum":
      return { ...base, kind: "enum", options: field.options.map((o) => ({ ...o })), default: field.default, adminOnly: Boolean(field.adminOnly) };
    case "boolean":
      return { ...base, kind: "boolean", default: field.default, adminOnly: Boolean(field.adminOnly) };
    case "int":
      return { ...base, kind: "int", min: field.min, max: field.max, default: field.default, adminOnly: Boolean(field.adminOnly) };
    case "value":
      return { ...base, kind: "value", max: field.max, required: Boolean(field.required), ltr: Boolean(field.ltr), adminOnly: Boolean(field.adminOnly) };
    case "media":
      return { ...base, kind: "media", kinds: [...field.kinds], required: Boolean(field.required) };
    case "selection":
      return { ...base, kind: "selection", entity: field.entity, max: field.max, sources: [...ENTITY_SOURCES[field.entity]] };
    case "link":
      return { ...base, kind: "link", kinds: [...(field.kinds ?? DEFAULT_LINK_KINDS)] as LinkKindName[], required: Boolean(field.required) };
    case "items":
      return {
        ...base,
        kind: "items",
        one: field.one,
        min: field.min,
        max: field.max,
        initial: field.initial ?? field.min,
        settings: Object.entries(field.settings).map(([k, f]) => fieldModel(k, f)),
        content: Object.entries(field.content).map(([k, f]) => fieldModel(k, f)),
      };
    case "design":
      return { ...base, label: field.label ?? "Design", kind: "design", controls: designControls(field.spec) };
  }
}

const settingsModels = (fields: SettingsFields) => Object.entries(fields).map(([key, field]) => fieldModel(key, field));
const contentModels = (fields: ContentFields) => Object.entries(fields).map(([key, field]) => fieldModel(key, field));

export function blockModel(def: BlockDefinition): BlockModel {
  const defaults = defaultsOf(def.settings, def.content, () => "i0");
  // Repeaters start empty here; the editor adds their initial items with fresh ids when it adds the section.
  for (const [key, field] of Object.entries(def.settings)) {
    if (field.kind !== "items") continue;
    defaults.settings[key] = [];
    defaults.content[key] = {};
  }
  return {
    key: def.key,
    label: def.label,
    description: def.description,
    category: def.category,
    categoryLabel: BLOCK_CATEGORIES[def.category],
    icon: def.icon,
    max: def.max,
    locked: def.locked,
    h1: Boolean(def.h1),
    anchor: def.anchor,
    fixedAnchor: def.fixedAnchor ?? null,
    reusable: def.reusable,
    note: def.note ?? null,
    structure: { ...def.structure },
    settings: settingsModels(def.settings),
    content: contentModels(def.content),
    defaults,
  };
}

// --- The builder model -----------------------------------------------------------------------------------------------------

const asState = (state: string): CmsLocaleState => state as CmsLocaleState;

const editHref = (ref: OwnerRef) => `/admin/${ref.type === "page" ? "pages" : "services"}/${ref.id}`;
export const builderHref = (ref: OwnerRef) => `${editHref(ref)}/builder`;
export const previewHref = (ref: OwnerRef) => `/admin/preview/${ref.type}/${ref.id}`;

function sectionData(read: ReturnType<typeof readSectionData>, translations: StoredSection["translations"]): SectionData | null {
  if (read.state !== "ok") return null;
  return {
    settings: read.settings,
    content: Object.fromEntries(LOCALES.filter((l) => read.content[l]).map((l) => [l, read.content[l]!])) as SectionData["content"],
    complete: { en: translations.en?.status === "complete", ar: translations.ar?.status === "complete" },
    otherUnaffected: false,
  };
}

/** The whole editor model for one owner, or null when it does not exist (or is not a builder owner). */
export async function loadBuilder(db: Db, permissions: ReadonlySet<string>, ref: OwnerRef): Promise<BuilderModel | null> {
  const owner = await readOwner(db, ref, { lock: false });
  if (!owner) return null;
  const kind: OwnerKind = owner.kind;
  const contract = CONTRACTS[kind];
  const content = mayEditContent(permissions, kind) && !owner.archived;
  const structure = mayChangeStructure(permissions, kind) && !owner.archived;
  const structureNote = owner.archived
    ? "This record is archived: restore it before changing its layout."
    : (contract.lockedReason ?? (structure ? null : content ? NO_STRUCTURE_PERMISSION : VIEW_ONLY_LAYOUT));
  const stored = await readSections(db, ref, { lock: false });

  // Linked reusable sections (their data is shown read-only).
  const reusableIds = [...new Set(stored.map((s) => s.reusableId).filter((v): v is string => Boolean(v)))];
  const reusables = new Map<string, NonNullable<Awaited<ReturnType<typeof readReusable>>>>();
  for (const id of reusableIds) {
    const r = await readReusable(db, id);
    if (r) reusables.set(id, r);
  }

  // Every media item and record the sections name, for cards and warnings.
  const reads = new Map(stored.map((s) => [s.id, readSectionData(s)]));
  const linkedReads = new Map(
    [...reusables.values()].map((r) => [r.id, readSectionData({ blockType: r.blockType, schemaVersion: r.schemaVersion, settings: r.settings, translations: r.translations })]),
  );
  const mediaIds = new Set<string>();
  const projectIds = new Set<string>();
  const refsOf = new Map<string, ReturnType<typeof referencesOf>>();
  for (const s of stored) {
    const def = REGISTRY.get(s.blockType);
    const read = s.reusableId ? linkedReads.get(s.reusableId) : reads.get(s.id);
    if (!def || !read || read.state !== "ok") continue;
    const refs = referencesOf(def.settings, def.content, read.settings, read.content);
    refsOf.set(s.id, refs);
    refs.media.forEach((m) => mediaIds.add(m.id));
    refs.records.filter((r) => r.type === "project").forEach((r) => projectIds.add(r.id));
  }
  const cards = (await mediaCards(db, new Set<string>(), [...mediaIds])) as Record<string, MediaCardModel>;
  const blockingFlags = await blockingFlagsOf(db, [...projectIds]);

  const { options, genericPages, known, toOption } = await pickerSources(db);

  const layout: LayoutSection[] = stored.map((s) => ({ id: s.id, blockType: s.blockType, anchor: s.anchor, visible: s.visible, devices: s.devices, locked: s.locked, reusableId: s.reusableId }));
  const blocks: Record<string, BlockModel> = {};
  const sections: SectionModel[] = stored.map((s) => {
    const def = REGISTRY.get(s.blockType);
    if (def) blocks[def.key] ??= blockModel(def);
    const read = reads.get(s.id)!;
    const reusable = s.reusableId ? reusables.get(s.reusableId) : undefined;
    const linkedRead = s.reusableId ? linkedReads.get(s.reusableId) : undefined;
    const effective = s.reusableId ? linkedRead : read;
    const data = s.reusableId ? null : sectionData(read, s.translations);
    const linkedData = reusable && linkedRead ? sectionData(linkedRead, reusable.translations) : null;
    const settings = effective?.state === "ok" ? effective.settings : {};
    const texts = effective?.state === "ok" ? effective.content : {};
    const statusSource = s.reusableId ? (reusable?.translations ?? {}) : s.translations;
    const status = Object.fromEntries(
      LOCALES.map((l) => [l, def && effective?.state === "ok" ? asState(sectionLocaleState(def, settings, texts[l], statusSource[l]?.status ?? null)) : "missing"]),
    ) as Record<Locale, CmsLocaleState>;

    const refs = refsOf.get(s.id);
    const warnings = refs ? referenceWarnings(refs, cards, known, blockingFlags) : [];
    if (reusable?.archived) warnings.push("The linked reusable section is archived.");
    const missing = def && effective?.state === "ok" ? missingSettings(def.settings, settings) : [];
    const problem = !def ? readProblem({ state: "unknown_type" }) : effective && effective.state !== "ok" ? readProblem(effective) : null;

    const op = (operation: Parameters<typeof lockReason>[3]): OperationModel => {
      if (!structure) return { allowed: false, reason: structureNote ?? NO_STRUCTURE_PERMISSION };
      const reason = lockReason(kind, def, s, operation);
      return reason ? { allowed: false, reason } : { allowed: true };
    };
    const editReason = !content
      ? owner.archived
        ? "This record is archived: restore it before editing its layout."
        : "You can view this layout but not edit it."
      : s.reusableId
        ? "This section shows a reusable section: edit it in Reusable sections, or detach it."
        : !def
          ? readProblem({ state: "unknown_type" })
          : read.state === "future_version"
            ? readProblem(read)
            : null;
    return {
      id: s.id,
      blockType: s.blockType,
      label: def?.label ?? s.blockType,
      visible: s.visible,
      devices: { ...s.devices },
      locked: s.locked,
      anchor: s.anchor,
      reusable: s.reusableId ? { id: s.reusableId, name: reusable?.name ?? "(missing)", archived: Boolean(reusable?.archived), href: `/admin/reusable-sections/${s.reusableId}` } : null,
      detachedFrom: s.detachedFromId,
      state: s.reusableId ? (linkedRead?.state ?? "invalid") : read.state,
      problem,
      data,
      linkedData,
      status,
      missing,
      warnings,
      ops: {
        edit: editReason ? { allowed: false, reason: editReason } : { allowed: true },
        move: op("move"),
        hide: op("hide"),
        remove: op("remove"),
        duplicate: op("duplicate"),
        anchor: op("anchor"),
        detach: s.reusableId ? op("detach") : { allowed: false, reason: "This section isn't linked to a reusable section." },
      },
    };
  });

  const library = structure ? libraryFor(kind).map((def) => def.key) : [];
  for (const key of library) blocks[key] ??= blockModel(REGISTRY.get(key)!);
  const linkable = structure
    ? (await listReusables(db)).filter((r) => !r.archived && library.includes(r.blockType)).map((r) => ({ id: r.id, name: r.name, blockType: r.blockType, blockLabel: r.blockLabel }))
    : [];
  for (const r of linkable) blocks[r.blockType] ??= blockModel(REGISTRY.get(r.blockType)!);

  return {
    owner: {
      type: ref.type,
      id: ref.id,
      kind,
      kindLabel: OWNER_LABELS[kind],
      label: owner.label,
      slug: owner.slug,
      archived: owner.archived,
      editHref: editHref(ref),
      previewHref: previewHref(ref),
    },
    lockVersion: owner.lockVersion,
    can: { content, structure, initialize: mayInitialize(permissions, kind) && !owner.archived, reusableEdit: permissions.has("reusable_sections.edit") },
    structureNote,
    blocks,
    library,
    sections,
    reusables: linkable,
    warnings: layoutWarnings(kind, layout).map((w) => ({ sectionId: w.sectionId, message: w.message })),
    ...pickerModels({ options, genericPages, toOption }),
    media: cards,
    canUpload: permissions.has("media.upload"),
  };
}

// --- The pickers' choices (records, link targets) -------------------------------------------------------------------------------

async function pickerSources(db: Db) {
  const options = {
    service: await pickerOptions(db, "service"),
    project: await pickerOptions(db, "project"),
    machine: await pickerOptions(db, "machine"),
    client: await pickerOptions(db, "client"),
    certificate: await pickerOptions(db, "certificate"),
    industry: await pickerOptions(db, "industry"),
    project_category: await pickerOptions(db, "project_category"),
  };
  const genericPages = (await pickerOptions(db, "page")).filter((p) => p.slug !== null);
  const known = new Map<string, ItemRef>();
  for (const [type, list] of Object.entries({ ...options, page: genericPages })) for (const item of list) known.set(`${type}:${item.id}`, item);
  const toOption = (item: ItemRef): OptionModel => ({ id: item.id, label: refLabel(item), slug: item.slug, archived: item.archived });
  return { options, genericPages, known, toOption };
}

function pickerModels({ options, genericPages, toOption }: Pick<Awaited<ReturnType<typeof pickerSources>>, "options" | "genericPages" | "toOption">): Pick<BuilderModel, "options" | "links"> {
  return {
    options: Object.fromEntries(Object.entries(options).map(([k, list]) => [k, list.map(toOption)])) as BuilderModel["options"],
    links: {
      kinds: LINK_KINDS.map((value) => ({ value, label: LINK_KIND_LABELS[value] })),
      sources: { ...SOURCE_LABELS },
      system: SYSTEM_LINK_KEYS.map((key) => ({ key, label: SYSTEM_LINK_LABELS[key] })),
      pages: genericPages.map(toOption),
      services: options.service.map(toOption),
      projects: options.project.map(toOption),
      machines: options.machine.map(toOption),
    },
  };
}

/** The blocking flags of projects (labels by project id): their photos are never shown. */
async function blockingFlagsOf(db: Db, projectIds: string[]): Promise<Map<string, string[]>> {
  const rows = projectIds.length ? await db.select({ projectId: projectFlags.projectId, flag: projectFlags.flag }).from(projectFlags).where(inArray(projectFlags.projectId, projectIds)) : [];
  const out = new Map<string, string[]>();
  for (const row of rows) if (isBlockingFlag(row.flag)) out.set(row.projectId, [...(out.get(row.projectId) ?? []), flagLabel(row.flag)]);
  return out;
}

/** What a section's data names that the editor warns about: media that can't be delivered, records gone, archived or incomplete, restricted projects. */
function referenceWarnings(refs: BlockReferences, cards: Record<string, MediaCardModel>, known: Map<string, ItemRef>, blocking: Map<string, string[]>): string[] {
  const warnings: string[] = [];
  for (const media of refs.media) {
    const card = cards[media.id];
    const problems = card ? cardWarnings(card) : ["Not available"];
    if (problems.length) warnings.push(`Media “${card?.label ?? media.id}”: ${problems.join(", ")}. It shows as a placeholder in the preview until it is approved and deliverable.`);
  }
  for (const record of refs.records) {
    const item = known.get(`${record.type}:${record.id}`);
    if (!item) warnings.push(`A chosen ${record.type.replace("_", " ")} no longer exists.`);
    else {
      if (item.archived) warnings.push(`${refLabel(item)} is archived.`);
      const incomplete = LOCALES.filter((l) => item.state[l] !== "complete");
      if (incomplete.length) warnings.push(`${refLabel(item)}: ${incomplete.map((l) => (l === "en" ? "English" : "Arabic")).join(" and ")} not complete.`);
      if (record.type === "project" && blocking.has(record.id)) warnings.push(`${refLabel(item)} has a restriction (${blocking.get(record.id)!.join(", ")}): its photos are not shown.`);
    }
  }
  return warnings;
}

// --- The reusable section editor -------------------------------------------------------------------------------------------------

/** One reusable section as its editor shows it, or null when it does not exist (A5 brief §44–§45). */
export async function loadReusableEditor(db: Db, permissions: ReadonlySet<string>, id: string): Promise<ReusableEditorModel | null> {
  const stored = await readReusable(db, id);
  if (!stored) return null;
  const def = REGISTRY.get(stored.blockType);
  const read = readSectionData({ blockType: stored.blockType, schemaVersion: stored.schemaVersion, settings: stored.settings, translations: stored.translations });
  const sources = await pickerSources(db);
  const refs: BlockReferences = def && read.state === "ok" ? referencesOf(def.settings, def.content, read.settings, read.content) : { media: [], records: [], links: [] };
  const cards = (await mediaCards(db, new Set<string>(), refs.media.map((m) => m.id))) as Record<string, MediaCardModel>;
  const blocking = await blockingFlagsOf(db, refs.records.filter((r) => r.type === "project").map((r) => r.id));
  const warnings = referenceWarnings(refs, cards, sources.known, blocking);
  const settings = read.state === "ok" ? read.settings : {};
  const texts = read.state === "ok" ? read.content : {};
  return {
    id: stored.id,
    name: stored.name,
    blockType: stored.blockType,
    block: def ? blockModel(def) : null,
    archived: stored.archived,
    lockVersion: stored.lockVersion,
    state: def ? read.state : "unknown_type",
    problem: !def ? readProblem({ state: "unknown_type" }) : read.state !== "ok" ? readProblem(read) : null,
    data: def ? sectionData(read, stored.translations) : null,
    status: Object.fromEntries(
      LOCALES.map((l) => [l, def && read.state === "ok" ? asState(sectionLocaleState(def, settings, texts[l], stored.translations[l]?.status ?? null)) : "missing"]),
    ) as ReusableEditorModel["status"],
    missing: def && read.state === "ok" ? missingSettings(def.settings, settings) : [],
    warnings,
    uses: (await reusableUseViews(db, id)).map((u) => ({ label: u.label, builderHref: u.builderHref })),
    can: { edit: permissions.has("reusable_sections.edit") && !stored.archived, archive: permissions.has("reusable_sections.archive") },
    ...pickerModels(sources),
    media: cards,
    canUpload: permissions.has("media.upload"),
    previewHref: `/admin/preview/reusable/${id}`,
  };
}
