/**
 * The page builder's data as the admin's client components receive it (A5): plain, serializable descriptions built on
 * the server from the block registry, the structure policy and the database — each block's fields and inspector
 * controls, each section's values, states, warnings and allowed operations with their reasons in words. No server code
 * here (like `cms-model.ts`, `media-model.ts`), so client components may import it. The server validates every save
 * again; nothing here is authority.
 */
import type { CmsLocaleState, OptionModel } from "./cms-model";
import type { MediaCardModel } from "./media-model";

export type BuilderLocale = "en" | "ar";
export type LinkKindName = "system" | "page" | "service" | "project" | "machine" | "anchor" | "external" | "email" | "phone";
export type EntityName = "service" | "project" | "machine" | "client" | "certificate" | "industry";
export type SelectionSourceName = "all" | "featured" | "category";

interface FieldBase {
  key: string;
  label: string;
  hint?: string;
  /** Shown only when the block's `variant` (or `layout` / `visual`) setting is one of these. */
  only?: string[];
}

export type FieldModel =
  | (FieldBase & { kind: "text" | "textarea"; max: number; required: boolean })
  | (FieldBase & { kind: "lines"; maxItems: number; maxLength: number; required: boolean })
  | (FieldBase & { kind: "rich"; required: boolean; maxChars: number; maxNodes: number; links: LinkKindName[]; headings: boolean; lists: boolean })
  | (FieldBase & { kind: "enum"; options: { value: string; label: string }[]; default: string; adminOnly: boolean })
  | (FieldBase & { kind: "boolean"; default: boolean; adminOnly: boolean })
  | (FieldBase & { kind: "int"; min: number; max: number; default: number; adminOnly: boolean })
  | (FieldBase & { kind: "value"; max: number; required: boolean; ltr: boolean; adminOnly: boolean })
  | (FieldBase & { kind: "media"; kinds: ("image" | "document")[]; required: boolean })
  | (FieldBase & { kind: "selection"; entity: EntityName; max: number; sources: SelectionSourceName[] })
  | (FieldBase & { kind: "link"; kinds: LinkKindName[]; required: boolean })
  | (FieldBase & { kind: "items"; one: string; min: number; max: number; initial: number; settings: FieldModel[]; content: FieldModel[] })
  | (FieldBase & { kind: "design"; controls: DesignControls });

export interface Choice<T extends string | number = string> {
  value: T;
  label: string;
}

/** The inspector's controls for a block's design object (only what its registry entry offers). */
export interface DesignControls {
  heading?: Choice<number>[];
  roles?: Choice[];
  align?: Choice[];
  measure?: Choice[];
  variants?: Choice[];
  columns?: Choice<number>[];
  /** Column counts a tablet or phone may take. */
  narrowerColumns?: Choice<number>[];
  gap?: Choice[];
  padding?: Choice[];
  width?: Choice[];
  mediaPosition?: Choice[];
  surfaces?: Choice[];
  tones?: Choice[];
  border?: Choice[];
  radius?: Choice[];
  shadow?: Choice[];
  responsive: boolean;
  motion?: { presets: Choice[]; durations: Choice[]; delays: Choice<number>[] };
  /** Surface/tone pairs that reach AA ("muted/teal"); others are refused. */
  appearance: string[];
}

export interface StructurePolicyModel {
  movable: boolean;
  hideable: boolean;
  removable: boolean;
  duplicable: boolean;
}

export interface BlockModel {
  key: string;
  label: string;
  description: string;
  category: string;
  categoryLabel: string;
  icon: string;
  max: number;
  locked: boolean;
  h1: boolean;
  anchor: "fixed" | "editable" | "none";
  fixedAnchor: string | null;
  reusable: boolean;
  note: string | null;
  structure: StructurePolicyModel;
  settings: FieldModel[];
  content: FieldModel[];
  /** A new section's settings and texts (repeaters' initial items with fresh ids are made by the editor). */
  defaults: { settings: Record<string, unknown>; content: Record<string, unknown> };
}

export interface SectionData {
  settings: Record<string, unknown>;
  content: Partial<Record<BuilderLocale, Record<string, unknown>>>;
  complete: Record<BuilderLocale, boolean>;
  otherUnaffected: boolean;
}

export interface OperationModel {
  allowed: boolean;
  /** Why not, in words (A5 brief §27). */
  reason?: string;
}

export interface SectionModel {
  id: string;
  blockType: string;
  /** The block's label (or the stored type when this admin doesn't know it). */
  label: string;
  visible: boolean;
  devices: { desktop: boolean; tablet: boolean; mobile: boolean };
  locked: boolean;
  anchor: string | null;
  reusable: { id: string; name: string; archived: boolean; href: string } | null;
  detachedFrom: string | null;
  /** "ok", or why the stored data can't be edited ("unknown_type", "future_version", "no_upcaster", "invalid"). */
  state: string;
  problem: string | null;
  /** The section's own editable data (null: linked, or unreadable). */
  data: SectionData | null;
  /** A linked section's reusable data (read-only here). */
  linkedData: SectionData | null;
  status: Record<BuilderLocale, CmsLocaleState>;
  /** Required settings not set yet (a button's target, a photo …). */
  missing: string[];
  warnings: string[];
  ops: Record<"move" | "hide" | "remove" | "duplicate" | "anchor" | "detach" | "edit", OperationModel>;
}

export interface ReusableOptionModel {
  id: string;
  name: string;
  blockType: string;
  blockLabel: string;
}

export interface LinkTargetsModel {
  system: { key: string; label: string }[];
  pages: OptionModel[];
  services: OptionModel[];
  projects: OptionModel[];
  machines: OptionModel[];
}

export interface BuilderModel {
  owner: {
    type: "page" | "service";
    id: string;
    kind: string;
    kindLabel: string;
    label: string;
    slug: string | null;
    archived: boolean;
    editHref: string;
    previewHref: string;
  };
  lockVersion: number;
  can: { content: boolean; structure: boolean; initialize: boolean; reusableEdit: boolean };
  /** Why the structure can't be changed by this person (or by anyone), in words; null when it can. */
  structureNote: string | null;
  blocks: Record<string, BlockModel>;
  /** Blocks this person may add here, in the library's order. */
  library: string[];
  sections: SectionModel[];
  reusables: ReusableOptionModel[];
  /** Layout-wide warnings (in-page links whose target is hidden, unknown sections …). */
  warnings: { sectionId?: string; message: string }[];
  options: Record<EntityName | "project_category", OptionModel[]>;
  links: LinkTargetsModel;
  media: Record<string, MediaCardModel>;
  canUpload: boolean;
}

export type BuilderSaveState =
  | { status: "ok"; message: string; lockVersion: number; ids: Record<string, string> }
  | { status: "stale"; message: string }
  | { status: "error"; message: string; issues?: { ref?: string; path?: string; message: string }[] };

export const BUILDER_STALE_MESSAGE = "This page layout changed after you opened it. Reload and review the latest version before saving.";

/** A fresh repeated-item id, as the server's `newItemId` makes them ("i" + 8 base-36 characters). */
export function newBuilderItemId(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `i${Array.from(bytes, (b) => alphabet[b % 36]).join("")}`;
}
