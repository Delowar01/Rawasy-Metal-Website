/**
 * Media in content (A4 brief §52–§56; A1-CONTENT-MODEL §8): the one rule every content save applies to the media items it
 * names — a slot of the item itself (a cover photo, a logo, a share image …), an entry of an ordered list (a project's
 * photos, a certificate's redacted previews) or a gallery photo.
 *
 * - **Never a private item** (A4 brief §53): a private item can't be named by public content at all — not newly, not kept.
 *   Its refusal reads exactly like an item that does not exist, so a form can't probe for private items.
 * - **Working media may be prepared before approval** (§53): a public-class item that is pending review, approved or
 *   restricted may be chosen; the editor shows every non-approved one with a warning, and choosing never approves
 *   anything (publication, A8, refuses non-deliverable media; the public route serves only `public_media`).
 * - **Not newly chosen** (like archived records in A3): an item in the Trash, an archived item, or one without a ready
 *   file yet (still processing, or failed). One already in the slot may stay, shown with its warning.
 * - **The slot's kind**: photos and logos take images; a certificate's previews take an image or a PDF document.
 *
 * A newly chosen item is read with a share lock (`LOCK IN SHARE MODE`) inside the save's transaction, so it can't be
 * moved to the Trash or archived in the same moment (those take its row FOR UPDATE and wait for the save); a kept item is
 * read plainly — nothing it may become makes keeping it unsafe, and visibility never changes. Lock order: the content
 * item's root row first (the save), then the media rows; a media change never locks content rows.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { rowsOf } from "./store.ts";

/** The media kinds a content slot can take (no SVG upload exists; A4 brief §55). */
export type ContentMediaKind = "image" | "document";

export interface MediaTargetState {
  id: string;
  kind: string;
  visibility: string;
  usageStatus: string;
  trashed: boolean;
  /** Has a current, ready file (a current file is always ready: only finished files become current). */
  ready: boolean;
}

/** Usage statuses a public-class item may have when it is newly chosen (§53). */
export const CHOOSABLE_STATUSES = ["pending_review", "approved", "restricted"] as const;

const idList = (ids: readonly string[]) =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );

/** The states of media items by id; `lock` share-locks the rows (newly chosen items). Missing ids are absent. */
export async function mediaTargetStates(db: Db, ids: readonly string[], options: { lock: boolean }): Promise<Map<string, MediaTargetState>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = await rowsOf<Record<string, unknown>>(
    db,
    sql`SELECT id, kind, visibility, usage_status, deleted_at IS NOT NULL AS trashed, current_file_id IS NOT NULL AS ready
          FROM media_assets WHERE id IN (${idList(unique)})${options.lock ? sql` LOCK IN SHARE MODE` : sql``}`,
  );
  return new Map(
    rows.map((r) => [
      String(r.id),
      {
        id: String(r.id),
        kind: String(r.kind),
        visibility: String(r.visibility),
        usageStatus: String(r.usage_status),
        trashed: Boolean(Number(r.trashed)),
        ready: Boolean(Number(r.ready)),
      },
    ]),
  );
}

/** One message for an item that does not exist and for a private one (never tells which). */
export const MEDIA_UNAVAILABLE = "The chosen media item can't be used here. Reload the page and choose another.";

const kindMessage = (kinds: readonly ContentMediaKind[]) => (kinds.includes("document") ? "Choose an image or a PDF document here." : "Choose an image here.");

/**
 * The problem with naming `state` in a slot that takes `kinds`, or null. `isNew`: the item was not in this place before
 * this save (then the stricter "newly chosen" rules apply).
 */
export function mediaChoiceProblem(state: MediaTargetState | undefined, kinds: readonly ContentMediaKind[], isNew: boolean): string | null {
  if (!state || state.visibility !== "public") return MEDIA_UNAVAILABLE;
  if (!(kinds as readonly string[]).includes(state.kind)) return kindMessage(kinds);
  if (!isNew) return null;
  if (state.trashed) return "The chosen media item is in the Trash. Restore it in the media library first, or choose another.";
  if (state.usageStatus === "archived") return "The chosen media item is archived. Choose another.";
  if (!(CHOOSABLE_STATUSES as readonly string[]).includes(state.usageStatus)) return MEDIA_UNAVAILABLE;
  if (!state.ready) return "The chosen media item has no ready file yet (still processing, or it failed). Choose another.";
  return null;
}

/**
 * Checks the media a save names: `next` the ids after the save, `before` those stored in the same place. New ones are
 * share-locked first, then every id is judged; returns the first problem, or null.
 */
export async function checkMediaChoices(db: Db, next: readonly string[], before: readonly string[], kinds: readonly ContentMediaKind[]): Promise<string | null> {
  if (!next.length) return null;
  const known = new Set(before);
  const fresh = next.filter((id) => !known.has(id));
  const kept = next.filter((id) => known.has(id));
  const states = new Map([...(await mediaTargetStates(db, fresh, { lock: true })), ...(await mediaTargetStates(db, kept, { lock: false }))]);
  for (const id of next) {
    const problem = mediaChoiceProblem(states.get(id), kinds, !known.has(id));
    if (problem) return problem;
  }
  return null;
}
