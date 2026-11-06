/**
 * Enquiry attachments (A7.7): who may download one, decided from the session — the file route only maps the decision
 * to an answer. Framework-free (the integration tests call it directly).
 *
 * - Only a holder of `enquiries.view` (Owner, Admin) may know an attachment exists: to anyone else it is "not found".
 * - The file belongs to the enquiry named in the address (a file id under another enquiry is "not found"), the enquiry
 *   is not deleted or anonymized, and the stored key passes the private area's grammar (A4's store: resolved under its
 *   real root, opened O_NOFOLLOW). It is served only as an attachment by the route (`nosniff`, `no-store`, sandbox CSP),
 *   never through a public address or the image optimizer.
 * - Every download is audited (`enquiry.file_download`, the enquiry's reference as label — never the file's name), and
 *   every refusal of a signed-in user too.
 */
import { sql } from "drizzle-orm";
import type { Actor, RequestMeta } from "../auth/types.ts";
import type { CmsDeps } from "../cms/store.ts";
import { rowsOf } from "../cms/store.ts";
import { formsAudit } from "../forms/common.ts";

export interface EnquiryFileTarget {
  enquiryId: string;
  reference: string;
  fileId: string;
  storageKey: string;
  filename: string;
  mime: string;
  size: number;
}

export type FileDecision = { kind: "not_found" } | { kind: "ok"; file: EnquiryFileTarget };

export async function decideFileDownload(ctx: { deps: CmsDeps; actor: Actor; meta: RequestMeta }, enquiryId: string, fileId: string): Promise<FileDecision> {
  const { deps, actor } = ctx;
  const now = deps.clock();
  const [row] = await rowsOf<Record<string, unknown>>(
    deps.db,
    sql`SELECT e.reference, e.anonymized_at, f.storage_key, f.original_filename, f.mime_type, f.byte_size
        FROM enquiry_files f JOIN enquiries e ON e.id = f.enquiry_id
        WHERE f.id = ${fileId} AND f.enquiry_id = ${enquiryId} AND e.deleted_at IS NULL`,
  );
  if (!actor.permissions.has("enquiries.view")) {
    await formsAudit(deps.db, { deps, actor, meta: ctx.meta }, now, { action: "enquiry.file_download", type: "enquiry", id: enquiryId, outcome: "denied", summary: "Refused: missing permission enquiries.view." });
    return { kind: "not_found" };
  }
  if (!row || row.anonymized_at) return { kind: "not_found" };
  return {
    kind: "ok",
    file: {
      enquiryId,
      reference: String(row.reference),
      fileId,
      storageKey: String(row.storage_key),
      filename: String(row.original_filename),
      mime: String(row.mime_type),
      size: Number(row.byte_size),
    },
  };
}

/** Records a download once the file is open (a missing file is not a download). */
export async function auditFileDownload(ctx: { deps: CmsDeps; actor: Actor; meta: RequestMeta }, file: EnquiryFileTarget): Promise<void> {
  await formsAudit(ctx.deps.db, ctx, ctx.deps.clock(), {
    action: "enquiry.file_download",
    type: "enquiry",
    id: file.enquiryId,
    label: file.reference,
    summary: `Downloaded an attachment of ${file.reference}.`,
    changes: { file: file.fileId },
  });
}
