/**
 * Enquiry attachments (A7.7): `GET /api/admin/enquiries/{enquiry-id}/files/{file-id}`.
 *
 * - Only a holder of `enquiries.view` (Owner, Admin) may know an attachment exists: to anyone else it is "not found".
 * - The file must belong to the enquiry the address names; the stored key passes the private area's grammar and is
 *   opened under its real root (A4's store). Never a public address, never the image optimizer.
 * - An attachment with an RFC 5987 file name (sanitized; never the storage key), `nosniff`, `no-store`, CSP `sandbox`.
 *   Every download, and every refusal of a signed-in user, is audited (the reference only, never the file's name).
 */
import { Readable } from "node:stream";
import { adminRouteContext, contentDisposition, notFoundResponse } from "@/server/admin/routes";
import { auditFileDownload, decideFileDownload } from "@/server/enquiries/files";

export const dynamic = "force-dynamic";

const ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export async function GET(request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  const route = await adminRouteContext(request, "enquiry.file_download", "read");
  if (!route.ok) return route.response;
  const { id, fileId } = await context.params;
  if (!ID.test(id) || !ID.test(fileId)) return notFoundResponse();
  const ctx = { deps: route.context.deps, actor: route.context.actor, meta: route.context.meta };
  const decision = await decideFileDownload(ctx, id, fileId);
  if (decision.kind !== "ok") return notFoundResponse();
  const headers = {
    "Content-Type": decision.file.mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": contentDisposition("attachment", decision.file.filename),
  };
  const store = await route.context.deps.store();
  const opened = store ? await store.readStream("enquiries", decision.file.storageKey).catch(() => null) : null;
  if (!opened) return notFoundResponse();
  if (opened.size !== decision.file.size) {
    opened.stream.destroy();
    return notFoundResponse();
  }
  try {
    await auditFileDownload(ctx, decision.file);
  } catch (error) {
    opened.stream.destroy();
    throw error;
  }
  return new Response(Readable.toWeb(opened.stream) as unknown as ReadableStream<Uint8Array>, { status: 200, headers: { ...headers, "Content-Length": String(opened.size) } });
}
