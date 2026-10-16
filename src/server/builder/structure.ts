/**
 * The structure policy of the page builder (A5 brief §26–§27, §48, §56–§57): for every kind of owner (the homepage, each
 * system page, the legal pages, the templates, generic pages and services) what its layout must hold, what may be added
 * to it and which structural operations are allowed — with the reason, in words, wherever one is not.
 *
 * - **Contracts.** Each owner has one main-heading block (always first, visible on every device, locked), the parts it
 *   requires (the registry's `FIXED` blocks it owns: never moved, hidden, removed or duplicated), the order a new layout
 *   starts with (`initial`, today's composition), the generic blocks it may receive (`additions`) and, for the closing
 *   call to action, a place at the end (`last`). The legal pages, the 404 and the project page template are locked
 *   whole in A5: their layout is exactly the initial one, in order.
 * - **Layout check** (`layoutIssues`): the final layout of a save, whoever makes it — owner types, maximum instances,
 *   one h1 source first, required parts present and visible, anchors valid and unique (with every id the components
 *   render), protected anchors present, page.hero's composition the owner's own, the legal sections today's.
 * - **Change check** (`changeIssues`): what changed against the stored layout — removals, additions, moves, visibility,
 *   anchors and reusable links are structure (the owner's structure permission, and the block's policy); content and
 *   settings edits are not. Locked sections (`is_locked`) keep their place relative to each other and never move, hide
 *   or go; nobody can change `is_locked` or a section's block type.
 *
 * Pure (no I/O): the Server Actions decide with it inside their transaction, the editor shows its reasons, the tests
 * exercise every rule. Authority comes from permission keys (`structurePermissions`), never from role names.
 */
import { legalDocuments } from "../../content/legal.ts";
import type { BlockDefinition, OwnerKind } from "./block.ts";
import { GENERIC_BLOCKS, SAFE_ADDITIONS } from "./blocks/generic.ts";
import type { HeroVariant } from "./blocks/page.ts";
import { BUILDER_LIMITS } from "./fields.ts";
import { ANCHOR_MAX, ANCHOR_RE } from "./links.ts";
import { REGISTRY } from "./registry.ts";

// --- Owners ---------------------------------------------------------------------------------------------------------------

export interface PageOwnerRecord {
  pageType: "home" | "system" | "legal" | "generic" | "template";
  systemKey: string | null;
}

/** The owner kind of a page record (A3 `pages.page_type` / `system_key`) or of a service. Unknown system keys: null. */
export function ownerKindOf(owner: { service: true } | PageOwnerRecord): OwnerKind | null {
  if ("service" in owner) return "service";
  const kind =
    owner.pageType === "home" ? "home" : owner.pageType === "generic" ? "generic" : `${owner.pageType}:${owner.systemKey ?? ""}`;
  return (OWNER_LABELS as Record<string, string>)[kind] ? (kind as OwnerKind) : null;
}

export const OWNER_LABELS: Record<OwnerKind, string> = {
  home: "Homepage",
  "system:about": "About",
  "system:services": "Services overview",
  "system:capabilities": "Capabilities & Machinery",
  "system:projects": "Projects overview",
  "system:industries": "Industries",
  "system:clients": "Clients",
  "system:certificates": "Certificates",
  "system:contact": "Contact",
  "system:not_found": "Page not found (404)",
  "legal:privacy": "Privacy policy",
  "legal:terms": "Terms of use",
  "template:project_detail": "Project page template",
  "template:service_detail_default": "New service page template",
  generic: "Generic page",
  service: "Service page",
};

/** The composition each inner page's opening takes (`page.hero`'s `variant`): the page's own, nothing else. */
export const HERO_VARIANT_OF: Partial<Record<OwnerKind, HeroVariant>> = {
  "system:about": "about",
  "system:services": "services",
  "system:capabilities": "capabilities",
  "system:projects": "projects",
  "system:industries": "industries",
  "system:clients": "clients",
  "system:certificates": "certificates",
  "system:contact": "contact",
  "legal:privacy": "legal",
  "legal:terms": "legal",
};

/** One section of a legal page's fixed structure: the section's anchor, from today's approved document. */
const legalSections = (key: "privacy" | "terms") => legalDocuments[key].sections.map((section) => section.id);

export interface InitialSection {
  blockType: string;
  /** The anchor an `editable`-anchor section starts with (the legal sections' ids). */
  anchor?: string;
}

export interface OwnerContract {
  kind: OwnerKind;
  /** The block that renders the page's only h1: exactly one, first, visible on every device, locked. */
  h1: string;
  /** The layout Initialize creates, in order: today's composition (A1-CONTENT-MODEL §5.3). */
  initial: readonly InitialSection[];
  /** A block that, when present, stays the last section. */
  last?: string;
  /** Generic blocks the owner's structure holders may add (beyond the bespoke blocks the registry gives the owner). */
  additions: readonly string[];
  /** Anchors the site's behaviour relies on (links from other pages, every quote action …): never hidden or gone. */
  protectedAnchors: readonly string[];
  /** Why the whole structure is fixed in A5 (the layout is exactly `initial`); undefined when it may change. */
  lockedReason?: string;
}

const SERVICE_INITIAL: InitialSection[] = [
  "service.hero",
  "service.overview",
  "service.scope",
  "service.process",
  "service.machines",
  "service.applications",
  "service.gallery",
  "service.why",
  "service.related",
  "service.projects",
  "service.cta",
].map((blockType) => ({ blockType }));

const list = (...keys: string[]): InitialSection[] => keys.map((blockType) => ({ blockType }));
const STORABLE_GENERIC = GENERIC_BLOCKS.filter((def) => def.storable).map((def) => def.key);

export const CONTRACTS: Record<OwnerKind, OwnerContract> = {
  home: {
    kind: "home",
    h1: "home.hero",
    initial: list(
      "home.hero",
      "home.capability_strip",
      "home.about",
      "home.services",
      "home.machinery",
      "home.projects",
      "home.industries",
      "home.clients",
      "home.compliance",
      "home.contact",
    ),
    additions: SAFE_ADDITIONS,
    protectedAnchors: [],
  },
  "system:about": {
    kind: "system:about",
    h1: "page.hero",
    initial: list(
      "page.hero",
      "about.overview",
      "about.what",
      "about.metal",
      "about.beyond",
      "about.vision",
      "about.approach",
      "about.process",
      "about.why",
      "about.workshop",
      "about.machinery",
      "about.work",
      "about.clients",
      "about.compliance",
      "page.closing_cta",
    ),
    last: "page.closing_cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: [],
  },
  "system:services": {
    kind: "system:services",
    h1: "page.hero",
    initial: list("page.hero", "services.index", "page.closing_cta"),
    last: "page.closing_cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: [],
  },
  "system:capabilities": {
    kind: "system:capabilities",
    h1: "page.hero",
    initial: list("page.hero", "capabilities.power", "capabilities.console", "capabilities.register", "capabilities.service_lines", "capabilities.source", "page.closing_cta"),
    last: "page.closing_cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: ["console"],
  },
  "system:projects": {
    kind: "system:projects",
    h1: "page.hero",
    initial: list("page.hero", "projects.featured", "projects.highlights", "projects.gallery", "projects.index", "page.closing_cta"),
    last: "page.closing_cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: ["gallery"],
  },
  "system:industries": {
    kind: "system:industries",
    h1: "page.hero",
    initial: list("page.hero", "industries.sectors", "industries.index", "page.closing_cta"),
    last: "page.closing_cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: [],
  },
  "system:clients": {
    kind: "system:clients",
    h1: "page.hero",
    initial: list("page.hero", "clients.wall", "page.closing_cta"),
    last: "page.closing_cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: [],
  },
  "system:certificates": {
    kind: "system:certificates",
    h1: "page.hero",
    initial: list("page.hero", "certificates.register", "certificates.redaction", "page.closing_cta"),
    last: "page.closing_cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: [],
  },
  "system:contact": {
    kind: "system:contact",
    h1: "page.hero",
    initial: list("page.hero", "contact.quote", "contact.location"),
    additions: SAFE_ADDITIONS,
    protectedAnchors: ["quote", "location"],
  },
  "system:not_found": {
    kind: "system:not_found",
    h1: "not_found.view",
    initial: list("not_found.view"),
    additions: [],
    protectedAnchors: [],
    lockedReason: "The 404 page's structure is fixed.",
  },
  "legal:privacy": {
    kind: "legal:privacy",
    h1: "page.hero",
    initial: [...list("page.hero", "legal.contents"), ...legalSections("privacy").map((anchor) => ({ blockType: "legal.section", anchor }))],
    additions: [],
    protectedAnchors: [],
    lockedReason: "Legal-page structure is locked.",
  },
  "legal:terms": {
    kind: "legal:terms",
    h1: "page.hero",
    initial: [...list("page.hero", "legal.contents"), ...legalSections("terms").map((anchor) => ({ blockType: "legal.section", anchor }))],
    additions: [],
    protectedAnchors: [],
    lockedReason: "Legal-page structure is locked.",
  },
  "template:project_detail": {
    kind: "template:project_detail",
    h1: "project.hero",
    initial: list("project.hero", "project.photos", "project.details", "page.closing_cta"),
    additions: [],
    protectedAnchors: [],
    lockedReason: "The project page template's structure is fixed in A5 (every project page follows it).",
  },
  "template:service_detail_default": {
    kind: "template:service_detail_default",
    h1: "service.hero",
    initial: SERVICE_INITIAL,
    last: "service.cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: [],
  },
  generic: {
    kind: "generic",
    h1: "generic.hero",
    initial: list("generic.hero"),
    additions: STORABLE_GENERIC,
    protectedAnchors: [],
  },
  service: {
    kind: "service",
    h1: "service.hero",
    initial: SERVICE_INITIAL,
    last: "service.cta",
    additions: SAFE_ADDITIONS,
    protectedAnchors: [],
  },
};

/** Whether a block type may be part of an owner's layout (a bespoke block it owns, or one of its additions). */
export function allowedOn(kind: OwnerKind, def: BlockDefinition): boolean {
  if (!def.storable) return false;
  return def.owners.includes(kind) || CONTRACTS[kind].additions.includes(def.key);
}

const REQUIRED = new Map<OwnerKind, readonly string[]>();

/** The blocks the owner requires: its h1 block and every `FIXED` block the registry gives it. */
export function requiredBlocks(kind: OwnerKind): readonly string[] {
  const cached = REQUIRED.get(kind);
  if (cached) return cached;
  const keys = new Set([CONTRACTS[kind].h1]);
  for (const def of REGISTRY.all()) {
    const fixed = !def.structure.movable && !def.structure.hideable && !def.structure.removable;
    if (fixed && def.owners.includes(kind)) keys.add(def.key);
  }
  const out = [...keys];
  REQUIRED.set(kind, out);
  return out;
}

/** The blocks the library offers an owner (bespoke ones it owns, then its additions), in registry order. */
export function libraryFor(kind: OwnerKind): BlockDefinition[] {
  return REGISTRY.all().filter((def) => def.storable && allowedOn(kind, def));
}

// --- Permissions ------------------------------------------------------------------------------------------------------------

/** The permission keys (all of them) that edit the sections' texts and settings of an owner. */
export function contentPermissions(kind: OwnerKind): string[] {
  if (kind === "service") return ["services.edit"];
  if (kind.startsWith("legal:")) return ["legal.edit"];
  return ["pages.edit"];
}

/**
 * The permission keys (all of them) that change an owner's structure, or null when nobody may (a locked contract).
 * Generic pages: whoever edits pages (A5 brief §26: Owner, Admin, Editor with `pages.edit`). The site's own pages and
 * the service template: whoever may edit and archive pages (A3's authority over fixed pages: Owner and Admin by the
 * matrix). Services: whoever may edit and archive services (Owner and Admin).
 */
export function structurePermissions(kind: OwnerKind): string[] | null {
  if (CONTRACTS[kind].lockedReason) return null;
  if (kind === "generic") return ["pages.edit"];
  if (kind === "service") return ["services.edit", "services.archive"];
  return ["pages.edit", "pages.archive"];
}

/** The permission keys (all of them) that set up an empty layout (Initialize creates the contract's sections). */
export function initializePermissions(kind: OwnerKind): string[] {
  if (kind.startsWith("legal:")) return ["legal.edit"];
  return structurePermissions(kind) ?? ["pages.edit", "pages.archive"];
}

const holdsAll = (permissions: ReadonlySet<string>, keys: readonly string[] | null) => keys !== null && keys.every((key) => permissions.has(key));

export const mayEditContent = (permissions: ReadonlySet<string>, kind: OwnerKind) => holdsAll(permissions, contentPermissions(kind));
export const mayChangeStructure = (permissions: ReadonlySet<string>, kind: OwnerKind) => holdsAll(permissions, structurePermissions(kind));
export const mayInitialize = (permissions: ReadonlySet<string>, kind: OwnerKind) => holdsAll(permissions, initializePermissions(kind));

// --- Sections as the policy sees them --------------------------------------------------------------------------------------

export interface Devices {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
}

export interface LayoutSection {
  /** The section's id (stored) or the editor's reference for a new one. */
  id: string;
  blockType: string;
  anchor: string | null;
  visible: boolean;
  devices: Devices;
  locked: boolean;
  reusableId: string | null;
  /** `page.hero`'s composition (its `variant` setting); undefined for other blocks. */
  variant?: string;
}

export interface StructureIssue {
  /** The section concerned (undefined: the layout as a whole). */
  sectionId?: string;
  message: string;
}

const shownEverywhere = (s: LayoutSection) => s.visible && s.devices.desktop && s.devices.tablet && s.devices.mobile;

/** Ids the site's shell and kit render on every page (the skip-link target, the page title, the footer's top …). */
export const SHELL_IDS: readonly string[] = ["top", "main", "page-title", "page-cta-title", "direct-contact"];

/** Every id a section renders: its anchor and the anchor's title id, and the ids its approved component renders. */
export function idsOf(section: LayoutSection, def: BlockDefinition | undefined): string[] {
  const ids: string[] = [];
  if (section.anchor) ids.push(section.anchor, `${section.anchor}-title`);
  for (const id of def?.renderedIds ?? []) ids.push(id);
  return ids;
}

/** Why a typed anchor can't be used (format only; uniqueness is a layout rule). */
export function anchorProblem(anchor: string): string | null {
  if (anchor.length > ANCHOR_MAX) return `Use at most ${ANCHOR_MAX} characters.`;
  if (!ANCHOR_RE.test(anchor)) return "Use lowercase letters, digits and single hyphens, starting with a letter.";
  if (anchor.endsWith("-title")) return "An anchor can't end with “-title” (headings use those ids).";
  return null;
}

export interface LayoutContext {
  /** Slugs of the records whose ids bespoke blocks render (`recordAnchors`), by collection. */
  recordSlugs?: Partial<Record<NonNullable<BlockDefinition["recordAnchors"]>, readonly string[]>>;
}

/**
 * The final layout's issues (A5 brief §26, §48): empty when it is a valid structure for the owner. Sections whose block
 * type this code doesn't know (A5 brief §9) are tolerated where they stand (shown with a warning, never rendered), but
 * never count as a part the page requires.
 */
export function layoutIssues(kind: OwnerKind, sections: readonly LayoutSection[], context: LayoutContext = {}): StructureIssue[] {
  const contract = CONTRACTS[kind];
  const issues: StructureIssue[] = [];
  const defs = sections.map((section) => REGISTRY.get(section.blockType));

  if (sections.length > BUILDER_LIMITS.sectionsPerOwner) issues.push({ message: `A page holds at most ${BUILDER_LIMITS.sectionsPerOwner} sections.` });

  // Owner types and maximum instances.
  const counts = new Map<string, number>();
  sections.forEach((section, i) => {
    const def = defs[i];
    if (!def) return;
    if (!allowedOn(kind, def)) issues.push({ sectionId: section.id, message: `“${def.label}” can't be part of the ${OWNER_LABELS[kind]}.` });
    counts.set(def.key, (counts.get(def.key) ?? 0) + 1);
    if (def.locked !== section.locked) issues.push({ sectionId: section.id, message: "This section's structure lock doesn't match its block type." });
  });
  for (const [key, count] of counts) {
    const def = REGISTRY.get(key)!;
    if (count > def.max) issues.push({ message: `“${def.label}” can appear at most ${def.max === 1 ? "once" : `${def.max} times`} on a page.` });
  }

  // One h1 source, first, shown everywhere.
  const h1s = sections.filter((_, i) => defs[i]?.h1);
  const first = sections[0];
  const h1Def = REGISTRY.get(contract.h1)!;
  if (h1s.length === 0) issues.push({ message: `The page needs its main heading: “${h1Def.label}”.` });
  if (h1s.length > 1) issues.push({ message: "A page has exactly one main heading (h1); remove the other heading sections." });
  if (h1s.length === 1 && h1s[0].blockType !== contract.h1) issues.push({ sectionId: h1s[0].id, message: `This page's main heading comes from “${h1Def.label}”.` });
  if (first && first.blockType !== contract.h1 && h1s.length >= 1) {
    issues.push({ sectionId: h1s[0].id, message: kind === "home" ? "Homepage hero must remain first." : "The section with the page's main heading must remain first." });
  }

  // Required parts: present and shown on every device.
  for (const key of requiredBlocks(kind)) {
    const def = REGISTRY.get(key)!;
    const present = sections.filter((s) => s.blockType === key);
    if (present.length === 0) issues.push({ message: `“${def.label}” is a required part of this page.` });
    for (const section of present) {
      if (!shownEverywhere(section)) issues.push({ sectionId: section.id, message: def.h1 ? "This block provides the page's required main heading; it can't be hidden." : "This section is a required part of this page; it can't be hidden." });
    }
  }

  // The closing section stays last.
  if (contract.last) {
    const at = sections.findIndex((s) => s.blockType === contract.last);
    if (at !== -1 && at !== sections.length - 1) issues.push({ sectionId: sections[at].id, message: `“${REGISTRY.get(contract.last)!.label}” stays at the end of the page.` });
  }

  // page.hero takes the owner's own composition.
  const variant = HERO_VARIANT_OF[kind];
  for (const section of sections) {
    if (section.blockType === "page.hero" && section.variant !== variant) issues.push({ sectionId: section.id, message: "This page's opening keeps its own approved composition." });
  }

  // Anchors: the fixed ones as the components render them, editable ones valid, and every id on the page unique.
  const seen = new Map<string, string>();
  const reserved = new Set(SHELL_IDS);
  for (const [collection, slugs] of Object.entries(context.recordSlugs ?? {})) {
    if (sections.some((s, i) => defs[i]?.recordAnchors === collection)) for (const slug of slugs ?? []) reserved.add(slug);
  }
  sections.forEach((section, i) => {
    const def = defs[i];
    if (!def) return;
    if (def.anchor === "fixed" && section.anchor !== (def.fixedAnchor ?? null)) issues.push({ sectionId: section.id, message: "This section's anchor is set by its block and can't change." });
    if (def.anchor === "none" && section.anchor !== null) issues.push({ sectionId: section.id, message: "This block takes no anchor." });
    if (def.anchor === "editable" && section.anchor !== null) {
      const problem = anchorProblem(section.anchor);
      if (problem) issues.push({ sectionId: section.id, message: problem });
    }
    for (const id of idsOf(section, def)) {
      const owner = seen.get(id);
      if ((owner !== undefined && owner !== section.id) || (reserved.has(id) && def.anchor === "editable")) {
        issues.push({ sectionId: section.id, message: `The anchor “${section.anchor ?? id}” is already used on this page.` });
        break;
      }
      seen.set(id, section.id);
    }
  });

  // Anchors the site relies on, and in-page links of the required parts (the homepage hero's second action).
  for (const anchor of contract.protectedAnchors) {
    const section = sections.find((s) => s.anchor === anchor);
    if (!section || !shownEverywhere(section)) issues.push({ sectionId: section?.id, message: `The anchor “#${anchor}” is required by this page.` });
  }
  sections.forEach((section, i) => {
    const def = defs[i];
    if (!def?.linksTo || !requiredBlocks(kind).includes(def.key)) return;
    for (const anchor of def.linksTo) {
      const target = sections.find((s) => s.anchor === anchor);
      if (target && !shownEverywhere(target)) issues.push({ sectionId: target.id, message: `“${def.label}” links to this section (#${anchor}); it can't be hidden.` });
    }
  });

  // Locked contracts: exactly the initial layout, in order.
  if (contract.lockedReason) {
    const same =
      sections.length === contract.initial.length &&
      contract.initial.every((initial, i) => sections[i]?.blockType === initial.blockType && (initial.anchor === undefined || sections[i]?.anchor === initial.anchor));
    if (!same) issues.push({ message: contract.lockedReason });
  }

  return dedupe(issues);
}

/** Warnings that never block a save: in-page links of optional parts whose target is hidden or gone. */
export function layoutWarnings(kind: OwnerKind, sections: readonly LayoutSection[]): StructureIssue[] {
  const warnings: StructureIssue[] = [];
  const required = new Set(requiredBlocks(kind));
  for (const section of sections) {
    const def = REGISTRY.get(section.blockType);
    if (!def) {
      warnings.push({ sectionId: section.id, message: "This section's block type is not known to this version of the admin; it is not shown." });
      continue;
    }
    if (!def.linksTo || required.has(def.key) || !shownEverywhere(section)) continue;
    for (const anchor of def.linksTo) {
      const target = sections.find((s) => s.anchor === anchor);
      if (!target || !shownEverywhere(target)) warnings.push({ sectionId: section.id, message: `“${def.label}” links to #${anchor}, which is hidden or not on this page.` });
    }
  }
  return warnings;
}

// --- Changes -------------------------------------------------------------------------------------------------------------------

export interface ChangeContext {
  /** The acting session holds the owner's structure permission (`mayChangeStructure`). */
  structure: boolean;
  /** New sections that are duplicates (their new id → the original's id). */
  duplicates?: ReadonlyMap<string, string>;
}

/** The reason a person without the structure permission sees. */
export const NO_STRUCTURE_PERMISSION = "You can edit this page's sections, but changing its structure (adding, moving, hiding or removing sections, anchors, reusable links) needs a permission you don't hold.";
/** The same note for someone who may only look at the layout (no content permission either). */
export const VIEW_ONLY_LAYOUT = "You can view this layout but not change it.";

/**
 * Issues of a layout change (stored → proposed), section by section. Structure is anything but texts and settings:
 * removals, additions, order, visibility, anchors and reusable links; each needs the structure permission and the
 * block's own policy, and no locked section is ever moved, hidden or removed.
 */
export function changeIssues(kind: OwnerKind, before: readonly LayoutSection[], after: readonly LayoutSection[], context: ChangeContext): StructureIssue[] {
  const contract = CONTRACTS[kind];
  const issues: StructureIssue[] = [];
  const stored = new Map(before.map((s) => [s.id, s]));
  const next = new Map(after.map((s) => [s.id, s]));
  const structure = (sectionId: string | undefined, reason: string | null) => {
    if (!context.structure) issues.push({ sectionId, message: contract.lockedReason ?? NO_STRUCTURE_PERMISSION });
    else if (reason) issues.push({ sectionId, message: reason });
  };

  if (after.length !== next.size) issues.push({ message: "A section appears twice in the layout." });

  for (const old of before) {
    if (next.has(old.id)) continue;
    const def = REGISTRY.get(old.blockType);
    structure(old.id, lockReason(kind, def, old, "remove"));
  }

  for (const section of after) {
    const old = stored.get(section.id);
    const def = REGISTRY.get(section.blockType);
    if (!old) {
      if (!def || !def.storable) {
        issues.push({ sectionId: section.id, message: "Unknown block type." });
        continue;
      }
      const original = context.duplicates?.get(section.id);
      const reason = contract.lockedReason ?? (!allowedOn(kind, def) ? `“${def.label}” can't be added to the ${OWNER_LABELS[kind]}.` : original && !def.structure.duplicable ? `“${def.label}” can't be duplicated.` : null);
      structure(section.id, reason);
      continue;
    }
    if (old.blockType !== section.blockType) issues.push({ sectionId: section.id, message: "A section's block type can't change." });
    if (old.locked !== section.locked) issues.push({ sectionId: section.id, message: "A section's structure lock can't change." });
    if (old.visible !== section.visible || old.devices.desktop !== section.devices.desktop || old.devices.tablet !== section.devices.tablet || old.devices.mobile !== section.devices.mobile) {
      // Showing more needs only the structure permission; hiding anything also needs the block's policy.
      const hides =
        (old.visible && !section.visible) ||
        (old.devices.desktop && !section.devices.desktop) ||
        (old.devices.tablet && !section.devices.tablet) ||
        (old.devices.mobile && !section.devices.mobile);
      structure(section.id, hides ? lockReason(kind, def, old, "hide") : null);
    }
    if (old.anchor !== section.anchor) structure(section.id, lockReason(kind, def, old, "anchor"));
    if (old.reusableId !== section.reusableId) structure(section.id, section.reusableId === null ? lockReason(kind, def, old, "detach") : "A section can't be linked to another reusable section; insert the reusable section instead.");
  }

  // Order: any change is structure; locked and unmovable sections keep their order among themselves.
  const keptBefore = before.filter((s) => next.has(s.id)).map((s) => s.id);
  const keptAfter = after.filter((s) => stored.has(s.id)).map((s) => s.id);
  if (keptBefore.join() !== keptAfter.join()) {
    const pinned = (id: string) => {
      const s = stored.get(id)!;
      const def = REGISTRY.get(s.blockType);
      return s.locked || !def || !def.structure.movable;
    };
    const pinnedBefore = keptBefore.filter(pinned);
    const pinnedAfter = keptAfter.filter(pinned);
    // The main heading stays first and the closing section last, whatever moves around them.
    const ends = [after[0]?.blockType === contract.h1 ? null : before.find((s) => s.blockType === contract.h1 && next.has(s.id))?.id, contract.last && after.at(-1)?.blockType !== contract.last ? before.find((s) => s.blockType === contract.last && next.has(s.id))?.id : null];
    const moved = ends.find((id): id is string => Boolean(id)) ?? pinnedBefore.find((id, i) => pinnedAfter[i] !== id);
    if (moved) structure(moved, lockReason(kind, REGISTRY.get(stored.get(moved)!.blockType), stored.get(moved)!, "move"));
    else structure(undefined, contract.lockedReason ?? null);
  }

  return dedupe(issues);
}

export type StructureOperation = "move" | "hide" | "remove" | "duplicate" | "anchor" | "detach";

/**
 * Why a structural operation is not allowed on a section, in words (A5 brief §27), or null when the block's policy and
 * the owner's contract allow it (the structure permission is checked separately).
 */
export function lockReason(kind: OwnerKind, def: BlockDefinition | undefined, section: Pick<LayoutSection, "locked" | "anchor" | "blockType">, operation: StructureOperation): string | null {
  const contract = CONTRACTS[kind];
  if (contract.lockedReason) return contract.lockedReason;
  if (!def) return operation === "remove" ? null : "This section's block type is not known to this version of the admin.";
  if (operation === "anchor" && def.anchor !== "editable") return def.anchor === "fixed" ? "This section's anchor is set by its block (other pages link to it)." : "This block takes no anchor.";
  if (def.key === contract.h1) return kind === "home" && operation === "move" ? "Homepage hero must remain first." : "This block provides the page's required main heading.";
  if (section.anchor && contract.protectedAnchors.includes(section.anchor) && operation !== "duplicate") return "This anchor is required by this page.";
  if (section.locked) return requiredBlocks(kind).includes(def.key) ? "This section is a required part of this page." : "This section's structure is locked.";
  switch (operation) {
    case "move":
      return def.structure.movable ? null : contract.last === def.key ? `“${def.label}” stays at the end of the page.` : "This section keeps its place in the page's approved composition.";
    case "hide":
      return def.structure.hideable ? null : "This section is a required part of this page.";
    case "remove":
      return def.structure.removable ? null : def.structure.hideable ? "This part of the approved page can't be removed; hide it instead." : "This section is a required part of this page.";
    case "duplicate":
      return def.structure.duplicable ? null : "Only generic blocks can be duplicated.";
    case "anchor":
      return def.anchor === "editable" ? null : def.anchor === "fixed" ? "This section's anchor is set by its block (other pages link to it)." : "This block takes no anchor.";
    case "detach":
      return null;
  }
}

function dedupe(issues: StructureIssue[]): StructureIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.sectionId ?? ""}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
