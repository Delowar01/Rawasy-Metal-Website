/**
 * Completes an upload (A4 brief §24, §28–§35): `POST {keepDuplicate?}` → the parts assembled and verified (signature,
 * pixel limit, PDF structure), duplicates offered first (409), then stored and processed → `{mediaId, version, status}`
 * (the item is pending review: nothing is public until an Owner or Admin approves it).
 */
import { adminRouteContext, jsonResponse, readJsonBody, storeOrAnswer } from "@/server/admin/routes";
import { completeUpload } from "@/server/media/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ uploadId: string }> }) {
  const route = await adminRouteContext(request, "media.upload_complete", "change");
  if (!route.ok) return route.response;
  const store = await storeOrAnswer();
  if (!store.ok) return store.response;
  const { uploadId } = await context.params;
  const body = await readJsonBody(request, 256);
  if (body === null) return jsonResponse(400, { error: "The request is not valid." });
  const result = await completeUpload(route.context, store.store, uploadId, body);
  return jsonResponse(result.status, result.body);
}
