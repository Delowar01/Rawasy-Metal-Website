/**
 * The Core CMS editor's data as the admin's client components receive it (A3): plain, serializable descriptions of a
 * content type's form and of one item's values, built on the server from the code registry and the database. No server
 * code here (like `state.ts`), so client components may import it.
 */

export type CmsLocale = "en" | "ar";
export type CmsLocaleState = "missing" | "incomplete" | "draft" | "complete" | "needs_review";

export const LOCALE_STATE_TEXT: Record<CmsLocaleState, string> = {
  missing: "Missing",
  incomplete: "Incomplete",
  draft: "Draft",
  complete: "Complete",
  needs_review: "Needs review",
};

/** A translated field of the form (one input per language). */
export interface TextFieldModel {
  key: string;
  label: string;
  kind: "line" | "text" | "rich" | "lines";
  max: number;
  maxItems?: number;
  required: boolean;
  hint?: string;
  /** Shown in the SEO section (with a length guide). */
  seo: boolean;
  /** Public certificate text: no registration numbers or expiry wording. */
  digitGuard: boolean;
}

export interface OptionModel {
  id: string;
  label: string;
  slug: string | null;
  archived: boolean;
  /** A dependency shown beside the chosen item before saving (A3 Correction 1: a service featuring this project). */
  note?: string;
}

/** A field of the item itself (not translated). */
export type RootFieldModel =
  | { kind: "checkbox"; key: string; label: string; hint?: string }
  | { kind: "date"; key: string; label: string; hint?: string }
  | { kind: "select"; key: string; label: string; options: { value: string; label: string }[]; required: boolean; hint?: string }
  | { kind: "number"; key: string; label: string; min: number; max: number; unit?: string; hint?: string }
  | { kind: "text"; key: string; label: string; max: number; hint?: string }
  | { kind: "url"; key: string; label: string; hint?: string }
  | { kind: "reference"; key: string; label: string; options: OptionModel[]; emptyLabel: string; hint?: string };

export interface RelationModel {
  key: string;
  label: string;
  max: number;
  hint?: string;
  options: OptionModel[];
  /** Why the list offers nothing yet (e.g. a new service has no projects listing it). */
  emptyNote?: string;
}

export interface ChildrenModel {
  key: "facts" | "attributes";
  label: string;
  one: string;
  max: number;
  labelMax: number;
  valueMax: number;
  digitGuard: boolean;
  hint: string;
}

export interface EditorModel {
  type: string;
  one: string;
  many: string;
  path: string;
  /** Whether the item has a slug, and what it is used for. */
  slug: { used: boolean; hint: string } | null;
  fields: TextFieldModel[];
  root: RootFieldModel[];
  source: boolean;
  seo: { canAdvanced: boolean } | null;
  relations: RelationModel[];
  children: ChildrenModel | null;
  /** The person may change this item (permission, and not archived). */
  editable: boolean;
  readOnlyReason?: string;
  page?: { pageType: string; typeLabel: string; systemKey: string | null; route: string; legal: boolean };
}

export interface ChildValues {
  id: string | null;
  en: { label: string; value: string };
  ar: { label: string; value: string };
}

export interface EditorValues {
  slug: string;
  root: Record<string, string | boolean>;
  source: { sourceBasis: string; sourcePages: string; sourceNote: string };
  seo: { robotsIndex: boolean; robotsFollow: boolean; inSitemap: boolean; canonicalOverride: string };
  en: Record<string, string>;
  ar: Record<string, string>;
  complete: Record<CmsLocale, boolean>;
  rel: Record<string, string[]>;
  children: ChildValues[];
}

/** What a content form shows after a save that did not go through (a success redirects to the saved item). */
export type ContentState =
  | { status: "idle" }
  | { status: "invalid"; message: string; errors: Record<string, string> }
  | { status: "stale"; message: string }
  | { status: "error"; message: string };

export const contentIdle: ContentState = { status: "idle" };

/** The stale-save message (A3 brief §41). */
export const STALE_MESSAGE = "This content changed after you opened it. Reload and review the latest version before saving.";

export interface OrderRowModel {
  id: string;
  label: string;
  slug: string | null;
  archived: boolean;
  state: Record<CmsLocale, CmsLocaleState>;
}

export interface FlagModel {
  flag: string;
  label: string;
  description: string | null;
  blocking: boolean;
  known: boolean;
  note: string | null;
  addedAt: string;
  addedBy: string | null;
  token: string;
}
