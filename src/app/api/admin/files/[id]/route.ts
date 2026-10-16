/**
 * Original files (A4 brief §48; A1-MEDIA-STORAGE §9): `GET /api/admin/files/{media-id}[?version=<file-id>]`.
 *
 * - A private item (a certificate's private original): only the Owner — `private_documents.view` — with a step-up
 *   within the last 10 minutes. To anyone who may not know private items exist it does not exist (404).
 * - A public-class item's original: `media.view_original` (Owner, Admin).
 * - Every download, and every refusal of a signed-in user, is audited. `private, no-store`, `nosniff`, an attachment
 *   with an RFC 5987 file name (sanitized; never the storage key), CSP `sandbox`.
 */
import { adminRouteContext, contentDisposition, notFoundResponse, textResponse } from "@/server/admin/routes";
import { auditDownload, decideDownload } from "@/server/media/download";
import { openTarget } from "@/server/media/stream";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const route = await adminRouteContext(request, "media.download", "read");
  if (!route.ok) return route.response;
  const { deps } = route.context;
  const { id } = await context.params;
  const decision = await decideDownload(route.context, id, new URL(request.url).searchParams.get("version"));
  if (decision.kind === "not_found") return notFoundResponse();
  if (decision.kind === "step_up") return textResponse(403, "Confirm your identity in the admin first (it is valid for 10 minutes), then download again.");
  if (decision.kind === "denied") return textResponse(403, "You don't have permission to download original files.");
  // Everything the answer needs is prepared before the file is opened and the download recorded.
  const headers = {
    "Content-Type": decision.file.mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": contentDisposition("attachment", decision.file.originalFilename),
  };
  const opened = await openTarget(await deps.store(), deps.releaseDir, decision.file);
  if (!opened) return notFoundResponse();
  try {
    await auditDownload(route.context, id, decision.file);
  } catch (error) {
    opened.close();
    throw error;
  }
  return new Response(opened.body, { status: 200, headers: { ...headers, "Content-Length": String(opened.size) } });
}
