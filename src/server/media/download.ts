/**
 * Who may download an original file (A4 brief §48, §69, §75; A1-MEDIA-STORAGE §9), decided from the session — the file
 * route only maps the decision to an answer. Framework-free (the integration tests call it directly).
 *
 * - A private item (a certificate's private original): only a holder of `private_documents.view` (the Owner), with a
 *   step-up within the last 10 minutes. To anyone else it does not exist ("not found"). Every refusal is audited.
 * - A public-class item's original: `media.view_original` (Owner, Admin).
 * - Every download is audited (`media.private_download` / `media.original_download`), never with the file's name.
 */
import { isRecentlyAuthenticated } from "../auth/sessions.ts";
import { canSeePrivate } from "./access.ts";
import { resolveOriginal, type FileTarget } from "./delivery.ts";
import { mediaAudit, type MediaContext } from "./service.ts";

export type DownloadDecision = { kind: "not_found" } | { kind: "step_up" } | { kind: "denied" } | { kind: "ok"; file: FileTarget };

export async function decideDownload(ctx: MediaContext, id: string, version: string | null): Promise<DownloadDecision> {
  const { deps, actor, meta } = ctx;
  const found = await resolveOriginal(deps.db, id, version);
  if (!found) return { kind: "not_found" };
  const now = deps.clock();
  const deny = (summary: string) => mediaAudit(deps.db, actor, meta, now, { action: "media.download", id, outcome: "denied", summary });
  if (found.asset.visibility === "private") {
    if (!canSeePrivate(actor.permissions)) {
      await deny("Refused: the item is private (only a holder of private_documents.view may know it exists).");
      return { kind: "not_found" };
    }
    if (!isRecentlyAuthenticated(actor.session, now)) {
      await deny("Refused: downloading a private document needs a step-up within the last 10 minutes.");
      return { kind: "step_up" };
    }
  } else if (!actor.permissions.has("media.view_original")) {
    await deny("Refused: missing permission media.view_original.");
    return { kind: "denied" };
  }
  if (!found.file) return { kind: "not_found" };
  return { kind: "ok", file: found.file };
}

/** Records a download once the file is open (a missing file is not a download). */
export async function auditDownload(ctx: MediaContext, id: string, file: FileTarget): Promise<void> {
  await mediaAudit(ctx.deps.db, ctx.actor, ctx.meta, ctx.deps.clock(), {
    action: file.visibility === "private" ? "media.private_download" : "media.original_download",
    id,
    summary: `Downloaded the ${file.visibility === "private" ? "private original" : "original file"} of media ${id} (version ${file.version}).`,
    changes: { version: file.version },
  });
}
