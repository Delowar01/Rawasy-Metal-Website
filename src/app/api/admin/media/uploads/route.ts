/**
 * Opens a chunked upload (A4 brief §24): `POST {purpose, filename, size, mediaId?, certificateId?, folderId?}` →
 * `{uploadId, partSize, parts, expiresAt}`. The admin gate, a live session, the exact admin Origin and same-origin fetch
 * metadata first (`adminRouteContext`); the permission and limits in the upload service.
 */
import { adminRouteContext, jsonResponse, readJsonBody, storeOrAnswer } from "@/server/admin/routes";
import { openUpload } from "@/server/media/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const route = await adminRouteContext(request, "media.upload", "change");
  if (!route.ok) return route.response;
  const store = await storeOrAnswer();
  if (!store.ok) return store.response;
  const body = await readJsonBody(request);
  if (body === null) return jsonResponse(400, { error: "The upload request is not valid." });
  const result = await openUpload(route.context, store.store, body);
  return jsonResponse(result.status, result.body);
}
