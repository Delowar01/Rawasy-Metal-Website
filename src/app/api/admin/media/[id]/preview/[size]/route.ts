/**
 * The admin's previews (A4 brief §47): `GET /api/admin/media/{id}/preview/thumb|large[?file=<version>]` — a signed-in
 * session with `media.view`, never from another site, `private, no-store`. Only public-class images have previews
 * (private items have no derivatives at all; documents show an icon). Previews are not audited (views of the library).
 */
import { adminRouteContext, notFoundResponse, textResponse } from "@/server/admin/routes";
import { resolvePreview } from "@/server/media/delivery";
import { openTarget } from "@/server/media/stream";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string; size: string }> }) {
  const route = await adminRouteContext(request, "media.preview", "read");
  if (!route.ok) return route.response;
  const { deps, actor } = route.context;
  if (!actor.permissions.has("media.view")) return textResponse(403, "You don't have permission to view media.");
  const { id, size } = await context.params;
  if (size !== "thumb" && size !== "large") return notFoundResponse();
  const file = new URL(request.url).searchParams.get("file");
  const target = await resolvePreview(deps.db, id, size, file);
  if (!target) return notFoundResponse();
  const opened = await openTarget(await deps.store(), deps.releaseDir, target);
  if (!opened) return notFoundResponse();
  return new Response(opened.body, {
    status: 200,
    headers: {
      "Content-Type": target.mime,
      "Content-Length": String(opened.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
