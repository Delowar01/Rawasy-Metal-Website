"use client";
/**
 * Archive or restore an item (A3 brief §13–§14): a confirmation dialog that sends the item's version as this page
 * showed it, so a changed item is not archived or restored behind someone's back. Archiving keeps everything
 * (translations, relations) and can be undone; there is no permanent delete in A3.
 */
import { setArchivedAction } from "@/server/admin/actions/cms";
import { ConfirmAction } from "../ConfirmAction";

export function ArchiveControl({ type, id, version, archived, one, label }: { type: string; id: string; version: number; archived: boolean; one: string; label: string }) {
  return archived ? (
    <ConfirmAction
      action={setArchivedAction}
      label={`Restore ${one}`}
      title={`Restore “${label}”?`}
      confirmLabel="Restore as a draft"
      fields={{ type, id, version: String(version), archived: "0" }}
    >
      <p>It comes back as a working draft with its translations and relations, in its old place in the order. Nothing becomes public.</p>
    </ConfirmAction>
  ) : (
    <ConfirmAction
      action={setArchivedAction}
      label={`Archive ${one}`}
      title={`Archive “${label}”?`}
      confirmLabel={`Archive ${one}`}
      fields={{ type, id, version: String(version), archived: "1" }}
      danger
    >
      <p>
        The {one} leaves the active list and becomes read-only. Its translations and relations are kept, items that link to it keep the link (marked
        archived), and it can be restored at any time. Nothing is deleted.
      </p>
    </ConfirmAction>
  );
}
