/**
 * The messages between the page builder and its preview frame (A5): both are pages of the admin's own origin, and each
 * side accepts a message only from the other (`event.source`) and only from this origin. Plain data, no functions; the
 * builder never sends the frame anything to render — the frame always draws the saved working copy from the server.
 */

/** A section as the frame found it, for the builder's notes and its selection. */
export interface PreviewMapEntry {
  id: string;
  label: string;
  blockType: string;
  anchor: string | null;
  /** Ids the section renders besides its anchor (its title, `#page-title` …), to find it on the page. */
  ids: string[];
  /** What the preview says about it (missing language, placeholders, left-out records). */
  notes: string[];
  /** "ok", or why it is shown as a placeholder. */
  state: string;
  linked: boolean;
}

export type BuilderToPreview =
  | { source: "rawasy-builder"; type: "select"; id: string | null; scroll: boolean }
  | { source: "rawasy-builder"; type: "hover"; id: string | null };

export type PreviewToBuilder =
  | { source: "rawasy-preview"; type: "ready"; found: string[]; missing: string[] }
  | { source: "rawasy-preview"; type: "pick"; id: string }
  | { source: "rawasy-preview"; type: "locale"; locale: "en" | "ar" }
  | { source: "rawasy-preview"; type: "theme"; theme: "light" | "dark" }
  | { source: "rawasy-preview"; type: "link"; href: string };

export const isBuilderMessage = (data: unknown): data is BuilderToPreview =>
  typeof data === "object" && data !== null && (data as { source?: unknown }).source === "rawasy-builder";

export const isPreviewMessage = (data: unknown): data is PreviewToBuilder =>
  typeof data === "object" && data !== null && (data as { source?: unknown }).source === "rawasy-preview";
