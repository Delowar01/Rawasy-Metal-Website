/**
 * Public delivery of uploaded media (A4 brief §45; A1-MEDIA-STORAGE §8): `/media/u/{media-ulid}/{variant}-{hash}.webp`
 * and `/media/u/{media-ulid}/document-{hash}.pdf`, served only while the item is deliverable (its `public_media` row)
 * and only the current version's variants or document — never an image original, never the admin thumbnail, never a
 * private item (private files live under another root and have no `public_media` row). The decision and the headers
 * are `answerPublic` (src/server/media/public-delivery.ts).
 *
 * - Outside the proxy (`/media/` is excluded from its matcher); no cookie is read or set.
 * - Admin off (ADMIN_ENABLED): 404 before any database access — the production site keeps its static release (T1).
 * - Today's release files (`/media/{group}/{name}.webp`) are not handled here: Next serves them from `public/` as
 *   before (the same-address move to the persistent store is A9's cutover, A4 brief §46).
 */
import { isAdminEnabled } from "@/lib/admin-gate";
import { dbFor } from "@/server/db/client";
import { getPool } from "@/server/db/pool";
import { defaultReleaseDir } from "@/server/media/presence";
import { answerPublic, notFoundAnswer, type PublicAnswer } from "@/server/media/public-delivery";
import { mediaStore } from "@/server/media/storage";

export const dynamic = "force-dynamic";

const toResponse = (answer: PublicAnswer) =>
  new Response(answer.status === 200 ? answer.body : answer.status === 404 ? "Not found." : answer.status === 503 ? "Temporarily unavailable." : null, {
    status: answer.status,
    headers: answer.headers,
  });

async function serve(request: Request, params: Promise<{ id: string; name: string }>, head: boolean): Promise<Response> {
  if (!isAdminEnabled()) return toResponse(notFoundAnswer());
  const { id, name } = await params;
  return toResponse(
    await answerPublic({
      db: () => dbFor(getPool()),
      store: () => mediaStore(),
      releaseDir: defaultReleaseDir(),
      id,
      name,
      ifNoneMatch: request.headers.get("if-none-match"),
      head,
    }),
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string; name: string }> }) {
  return serve(request, context.params, false);
}

export async function HEAD(request: Request, context: { params: Promise<{ id: string; name: string }> }) {
  return serve(request, context.params, true);
}
