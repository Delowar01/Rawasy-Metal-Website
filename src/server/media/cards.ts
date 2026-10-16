/**
 * Media cards (A4): how the pickers, the content editors and the library show a media item — its label, kind, status,
 * flags and an admin thumbnail address — for the acting person only. A private item is "not available" to anyone without
 * private access, exactly like an id that does not exist; an item with a blocking flag has no thumbnail in a card; nothing
 * here ever names a storage path or key. Read-only.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import type { MediaCardModel, UsageStatusName } from "../admin/actions/media-model.ts";
import { rowsOf } from "../cms/store.ts";
import { canSeePrivate } from "./access.ts";
import { mediaRowsByIds, pickerMedia, type LibraryRow, type PickerQuery } from "./list.ts";
import { mediaFlagLabel } from "./registry.ts";

/** The admin thumbnail of a public-class image's current file (`/api/admin/media/{id}/preview/thumb`); never public. */
export const thumbAddress = (id: string, fileId: string) => `/api/admin/media/${id}/preview/thumb?file=${fileId}`;

export function cardOf(row: LibraryRow): MediaCardModel {
  const label = row.title.en || row.title.ar || row.legacyKey || row.filename || "(untitled)";
  return {
    id: row.id,
    label,
    labelAr: row.title.en && row.title.ar ? row.title.ar : null,
    kind: row.kind,
    visibility: row.visibility,
    status: row.status as UsageStatusName,
    trashed: row.deleted,
    ready: row.currentFileId !== null,
    flags: row.flags.map(mediaFlagLabel),
    blocking: row.blocking,
    width: row.width,
    height: row.height,
    // A blocking flag (contested rights, identifiers, personal data …) keeps the picture out of every card; the item's own
    // page shows it only when asked (A4 brief §38, §41).
    thumb: row.kind === "image" && row.visibility === "public" && row.currentFileId && !row.blocking ? thumbAddress(row.id, row.currentFileId) : null,
  };
}

/** The card shown for an id the person can't see (gone, or private without private access): it tells nothing more. */
export const unavailableCard = (id: string): MediaCardModel => ({
  id,
  label: "Not available",
  labelAr: null,
  kind: "image",
  visibility: "public",
  status: "pending_review",
  trashed: false,
  ready: false,
  flags: [],
  blocking: false,
  width: null,
  height: null,
  thumb: null,
  unavailable: true,
});

/** Cards for specific ids (content editors: what a slot, list or gallery names), as this person may see them. */
export async function mediaCards(db: Db, permissions: ReadonlySet<string>, ids: readonly string[]): Promise<Record<string, MediaCardModel>> {
  const rows = await mediaRowsByIds(db, ids);
  const seePrivate = canSeePrivate(permissions);
  const out: Record<string, MediaCardModel> = {};
  for (const id of new Set(ids)) {
    const row = rows.get(id);
    out[id] = row && (row.visibility === "public" || seePrivate) ? cardOf(row) : unavailableCard(id);
  }
  return out;
}

/** One page of a picker's choices (public-class only, for everyone: `pickerMedia`). */
export async function pickerCards(db: Db, query: PickerQuery): Promise<{ items: MediaCardModel[]; total: number; page: number; pages: number }> {
  const { rows, total } = await pickerMedia(db, query);
  return { items: rows.map(cardOf), total, page: query.page, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

/**
 * A certificate's private originals (A4 brief §49), for the certificate editor's Owner-only section: nothing at all for
 * anyone without private access (the section is not drawn for them either).
 */
export async function privateOriginalCards(db: Db, permissions: ReadonlySet<string>, certificateId: string): Promise<MediaCardModel[]> {
  if (!canSeePrivate(permissions)) return [];
  const rows = await rowsOf<{ media_id: string }>(
    db,
    sql`SELECT media_id FROM certificate_documents WHERE certificate_id = ${certificateId} AND role = 'private_original' ORDER BY position`,
  );
  const cards = await mediaCards(db, permissions, rows.map((r) => r.media_id));
  return rows.map((r) => cards[r.media_id]);
}
