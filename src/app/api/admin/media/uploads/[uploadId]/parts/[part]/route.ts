/**
 * One part of an upload (A4 brief §24, §72): `PUT` with the raw bytes (`Content-Length` required: exactly 4 MiB, the last
 * part shorter), streamed to the upload's private folder with a byte cap — never buffered whole.
 */
import { adminRouteContext, jsonResponse, storeOrAnswer } from "@/server/admin/routes";
import { writePart } from "@/server/media/uploads";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ uploadId: string; part: string }> }) {
  const route = await adminRouteContext(request, "media.upload_part", "change");
  if (!route.ok) return route.response;
  const store = await storeOrAnswer();
  if (!store.ok) return store.response;
  const { uploadId, part } = await context.params;
  const body = request.body as unknown as AsyncIterable<Uint8Array> | null;
  const result = await writePart(route.context, store.store, uploadId, part, request.headers.get("content-length"), body);
  return jsonResponse(result.status, result.body);
}
