/**
 * The media library's data as the admin's client components receive it (A4): plain, serializable descriptions built on
 * the server for the acting session. No server code here (like `cms-model.ts`), so client components may import it.
 * Never a storage path, a storage key or a private item's details for someone who may not know it exists.
 */

export type MediaKindName = "image" | "svg" | "document";
export type UsageStatusName = "pending_review" | "approved" | "restricted" | "internal" | "archived";

export const STATUS_TEXT: Record<UsageStatusName, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  restricted: "Restricted",
  internal: "Internal (private)",
  archived: "Archived",
};

/** A badge class per status: status is always also written out (never colour alone). */
export const STATUS_BADGE: Record<UsageStatusName, string> = {
  pending_review: "is-warning",
  approved: "is-success",
  restricted: "is-danger",
  internal: "is-info",
  archived: "",
};

/** A media item as a card shows it (pickers, chosen slots, lists, the library). */
export interface MediaCardModel {
  id: string;
  /** English title, else Arabic, else the release key or file name. */
  label: string;
  /** The Arabic title when there is also an English one. */
  labelAr: string | null;
  kind: MediaKindName;
  visibility: "public" | "private";
  status: UsageStatusName;
  trashed: boolean;
  /** Has a current, ready file. */
  ready: boolean;
  /** Labels of its flags; `blocking` when any of them blocks delivery (unknown flags block). */
  flags: string[];
  blocking: boolean;
  width: number | null;
  height: number | null;
  /** The admin thumbnail address (images with a ready file only; previews are admin-only and never public). */
  thumb: string | null;
  /** Shown instead of everything above when the item can't be shown here (gone, or not for this person). */
  unavailable?: boolean;
}

/** What warns about a card's item in a public content slot (A4 brief §53): never colour alone. */
export function cardWarnings(card: MediaCardModel): string[] {
  if (card.unavailable) return ["Not available"];
  const out: string[] = [];
  if (card.trashed) out.push("In the Trash");
  if (card.status !== "approved") out.push(STATUS_TEXT[card.status]);
  if (card.blocking) out.push("Blocking flag");
  if (!card.ready) out.push("No ready file");
  return out;
}

export interface MediaSlotModel {
  key: string;
  label: string;
  kinds: ("image" | "document")[];
  hint?: string;
}

export interface MediaListModel {
  key: "photos" | "previews";
  label: string;
  one: string;
  kinds: ("image" | "document")[];
  max: number;
  hint?: string;
  /** Each entry may name its language (certificate previews). */
  locales: boolean;
}

export interface MediaEntryValue {
  media: string;
  locale: "en" | "ar" | null;
}

/** A page of picker results. */
export type PickerState = { status: "ok"; items: MediaCardModel[]; total: number; page: number; pages: number } | { status: "error"; message: string };

/** An upload's outcome as the uploader reports it. */
export interface UploadedItem {
  mediaId: string;
  status: string;
  statusLabel: string;
}

/** A duplicate the library already holds (only items the person may know of). */
export interface DuplicateModel {
  id: string;
  label: string;
  status: string;
  kind: string;
}
