/**
 * What a block type is (A1-CONTENT-MODEL §5.2; A5 brief §9): one code-defined entry per type, the single source for its
 * validation, editor, structure policy, references, projection and schema history. The entries live in `blocks/*`;
 * `registry.ts` assembles and checks them. Framework-free: the preview's renderers are keyed by the same `key` in
 * `src/components/builder/render.tsx`, whose map is typed over every registered key (a missing renderer fails typecheck).
 */
import type { Content, ContentFields, FieldIssue, Locale, Settings, SettingsFields } from "./fields.ts";

/** Who may own sections (A1: a page or a service), as the structure policy tells them apart. */
export const OWNER_KINDS = [
  "home",
  "system:about",
  "system:services",
  "system:capabilities",
  "system:projects",
  "system:industries",
  "system:clients",
  "system:certificates",
  "system:contact",
  "system:not_found",
  "legal:privacy",
  "legal:terms",
  "template:project_detail",
  "template:service_detail_default",
  "generic",
  "service",
] as const;
export type OwnerKind = (typeof OWNER_KINDS)[number];

export const BLOCK_CATEGORIES = {
  home: "Homepage",
  page: "Page parts",
  about: "About",
  services: "Services overview",
  service: "Service page",
  capabilities: "Capabilities & Machinery",
  projects: "Projects overview",
  project: "Project page",
  industries: "Industries",
  clients: "Clients",
  certificates: "Certificates",
  contact: "Contact",
  legal: "Legal pages",
  not_found: "Page not found",
  layout: "Layout",
  text: "Text",
  media: "Media",
  records: "Records",
  contact_blocks: "Contact & forms",
  reusable: "Reusable",
} as const;
export type BlockCategory = keyof typeof BLOCK_CATEGORIES;

/** The editor's symbol for a block (`src/components/admin/builder/BlockIcon.tsx`). */
export type BlockIcon =
  | "hero"
  | "heading"
  | "text"
  | "image"
  | "text-image"
  | "gallery"
  | "video"
  | "grid"
  | "logos"
  | "certificate"
  | "figures"
  | "cards"
  | "timeline"
  | "steps"
  | "faq"
  | "cta"
  | "contact"
  | "form"
  | "map"
  | "divider"
  | "spacer"
  | "buttons"
  | "download"
  | "reusable"
  | "machine"
  | "list"
  | "legal"
  | "notice";

/** One step of a block's schema history: the stored data of version n, made version n + 1. */
export type Upcaster = (old: { settings: unknown; content: Partial<Record<Locale, unknown>> }) => { settings: unknown; content: Partial<Record<Locale, unknown>> };

export interface StructurePolicy {
  /** Up / Down (and moves caused by adding or removing others) for whoever holds the owner's structure permission. */
  movable: boolean;
  hideable: boolean;
  removable: boolean;
  duplicable: boolean;
}

export interface BlockDefinition {
  key: string;
  /** The latest schema version; what an edited section is saved as. */
  version: number;
  label: string;
  description: string;
  category: BlockCategory;
  icon: BlockIcon;
  /** Owners whose layout may hold it (beyond each owner's own additions list). */
  owners: readonly OwnerKind[];
  /** Instances per owner. */
  max: number;
  /** Created structure-locked (`is_locked`): not moved, hidden or removed by anyone; content stays editable. */
  locked: boolean;
  /** Renders the page's only h1. */
  h1?: boolean;
  /** Bespoke: the id the approved component gives the section, stored as its anchor and never edited. */
  fixedAnchor?: string;
  /** Whether people may set the section's anchor. */
  anchor: "fixed" | "editable" | "none";
  /** Ids the approved component renders besides its anchor (a generic anchor may not repeat them). */
  renderedIds?: readonly string[];
  /** Renders an id per record of this collection, its slug (`#<machine>`, `#<project>`, `#<document>`): a set anchor may not take one. */
  recordAnchors?: "machine" | "project" | "certificate";
  /** Anchors of the same page the approved component links to (warned about when they are hidden or missing). */
  linksTo?: readonly string[];
  /** May be kept as a reusable section. */
  reusable: boolean;
  /** False only for the library's "Insert a reusable section" entry (a linked section stores the reusable's own type). */
  storable: boolean;
  settings: SettingsFields;
  content: ContentFields;
  /** Rules across fields (a video id against its provider …). */
  check?: (settings: Settings, content: Partial<Record<Locale, Content>>) => FieldIssue[];
  /** Version n → n + 1, for every n below `version` (a gap fails closed). */
  upcasters: Record<number, Upcaster>;
  structure: StructurePolicy;
  /** Shown in the editor under the block's name (what the block is for, what it may not do). */
  note?: string;
}

/** A structure policy for blocks that are part of an approved composition (moved or hidden only by structure holders). */
export const BESPOKE_OPTIONAL: StructurePolicy = { movable: true, hideable: true, removable: false, duplicable: false };
/** A required part of a page: never moved, hidden, removed or duplicated. */
export const FIXED: StructurePolicy = { movable: false, hideable: false, removable: false, duplicable: false };
/** A generic block on a page. */
export const FREE: StructurePolicy = { movable: true, hideable: true, removable: true, duplicable: true };
/** The closing call to action of an inner page: stays at the end of the page; may be hidden. */
export const CLOSING: StructurePolicy = { movable: false, hideable: true, removable: false, duplicable: false };
