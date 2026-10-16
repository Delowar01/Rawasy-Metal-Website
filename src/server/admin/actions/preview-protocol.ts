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
  /** Where a section without an anchor or id of its own is drawn (a selector of the approved component's markup). */
  selector: string | null;
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
  | { source: "rawasy-preview"; type: "ready"; found: string[]; missing: string[]; notes: Record<string, string[]> }
  | { source: "rawasy-preview"; type: "pick"; id: string }
  | { source: "rawasy-preview"; type: "locale"; locale: "en" | "ar" }
  | { source: "rawasy-preview"; type: "theme"; theme: "light" | "dark" }
  | { source: "rawasy-preview"; type: "link"; href: string };

// Each side checks a message's whole shape before it uses it (the sender is already checked: this window's frame or
// parent, this origin).
const record = (data: unknown): Record<string, unknown> | null => (typeof data === "object" && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : null);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 1000 && value.every((v) => typeof v === "string");
const idOrNull = (value: unknown) => value === null || typeof value === "string";

export const isBuilderMessage = (data: unknown): data is BuilderToPreview => {
  const m = record(data);
  if (!m || m.source !== "rawasy-builder") return false;
  if (m.type === "select") return idOrNull(m.id) && typeof m.scroll === "boolean";
  if (m.type === "hover") return idOrNull(m.id);
  return false;
};

export const isPreviewMessage = (data: unknown): data is PreviewToBuilder => {
  const m = record(data);
  if (!m || m.source !== "rawasy-preview") return false;
  switch (m.type) {
    case "ready": {
      const notes = record(m.notes);
      return strings(m.found) && strings(m.missing) && notes !== null && Object.values(notes).every(strings);
    }
    case "pick":
      return typeof m.id === "string";
    case "locale":
      return m.locale === "en" || m.locale === "ar";
    case "theme":
      return m.theme === "light" || m.theme === "dark";
    case "link":
      return typeof m.href === "string";
    default:
      return false;
  }
};
