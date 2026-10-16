/** Cancels an upload (A4 brief §24): `DELETE` → 204; another user's or session's upload is "not found". */
import { adminRouteContext, jsonResponse, storeOrAnswer } from "@/server/admin/routes";
import { cancelUpload } from "@/server/media/uploads";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ uploadId: string }> }) {
  const route = await adminRouteContext(request, "media.upload_cancel", "change");
  if (!route.ok) return route.response;
  const store = await storeOrAnswer();
  if (!store.ok) return store.response;
  const { uploadId } = await context.params;
  const result = await cancelUpload(route.context, store.store, uploadId);
  return jsonResponse(result.status, result.body);
}
