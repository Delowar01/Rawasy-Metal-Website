/**
 * The checks every admin Route Handler starts with (A4: uploads, previews, private files — Route Handlers, not Server
 * Actions, because they stream). The same rules as `actionContext` for Server Actions (A2): the admin gate first (off →
 * plain 404, before any cookie or database access), a live, fully verified session (else 401), and the request's origin
 * — a change must come from the admin's own pages (exact `Origin`, `Sec-Fetch-Site: same-origin`); a read must not come
 * from another site (`Sec-Fetch-Site` same-origin or none). Refusals of a signed-in user are audited. Permissions are
 * decided by the media services, from the session.
 */
import "server-only";
import { isAdminEnabled } from "@/lib/admin-gate";
import { adminBaseUrl } from "@/server/config/env";
import { defaultReleaseDir } from "@/server/media/presence";
import type { MediaContext, MediaDeps } from "@/server/media/service";
import { mediaStore, StorageConfigError, type MediaStore } from "@/server/media/storage";
import { AdminUnavailableError, authDeps, getAdminState, requestMeta } from "./context";
import { auditDenied, REFUSED } from "./guards";

const BASE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

/** A JSON answer that is never cached (or an empty one for 204). */
export function jsonResponse(status: number, body: Record<string, unknown> | null): Response {
  if (body === null || status === 204) return new Response(null, { status, headers: BASE_HEADERS });
  return Response.json(body, { status, headers: BASE_HEADERS });
}

/** A plain-text answer (downloads and previews refused in a browser tab). */
export function textResponse(status: number, text: string): Response {
  return new Response(text, { status, headers: { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

export const notFoundResponse = () => textResponse(404, "Not found.");

/** This process's media services' dependencies: the admin's pool and clock, the store, the release folder. */
export function mediaDeps(): MediaDeps {
  const deps = authDeps();
  return {
    pool: deps.pool,
    db: deps.db,
    clock: deps.clock,
    store: () => mediaStore().catch(() => null),
    releaseDir: defaultReleaseDir(),
  };
}

/** The store, or the answer to give when RAWASY_DATA_DIR is not configured. */
export async function storeOrAnswer(): Promise<{ ok: true; store: MediaStore } | { ok: false; response: Response }> {
  try {
    return { ok: true, store: await mediaStore() };
  } catch (error) {
    if (error instanceof StorageConfigError) return { ok: false, response: jsonResponse(503, { error: "Media storage is not configured on this server (RAWASY_DATA_DIR)." }) };
    throw error;
  }
}

/** Whether the request comes from the admin's own pages: an exact Origin for changes, never another site for reads. */
export function originAllowed(request: Request, kind: "change" | "read"): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (kind === "change") {
    if (!origin || origin !== adminBaseUrl()) return false;
    return !site || site === "same-origin";
  }
  if (origin && origin !== adminBaseUrl()) return false;
  return !site || site === "same-origin" || site === "none";
}

export type RouteContextResult = { ok: true; context: MediaContext } | { ok: false; response: Response };

/** Gate, session and origin, in that order. */
export async function adminRouteContext(request: Request, action: string, kind: "change" | "read"): Promise<RouteContextResult> {
  if (!isAdminEnabled()) return { ok: false, response: notFoundResponse() };
  let state;
  try {
    state = await getAdminState();
  } catch (error) {
    if (error instanceof AdminUnavailableError) return { ok: false, response: jsonResponse(503, { error: "The admin database is unavailable. Try again shortly." }) };
    throw error;
  }
  if (state.status !== "active") return { ok: false, response: jsonResponse(401, { error: "Your session has ended. Sign in again." }) };
  const meta = await requestMeta();
  if (!originAllowed(request, kind)) {
    await auditDenied(state.actor, action, REFUSED.origin, meta);
    return { ok: false, response: jsonResponse(403, { error: "This request was refused." }) };
  }
  return { ok: true, context: { deps: mediaDeps(), actor: state.actor, meta } };
}

export { contentDisposition } from "@/server/media/headers";
export { readJsonBody } from "@/server/media/json-body";
