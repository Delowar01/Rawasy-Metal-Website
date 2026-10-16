/**
 * The answer of the public media address `/media/u/{media-ulid}/{name}` (A4 brief §45, §74), framework-free: the Route
 * Handler only turns it into a Response, and the tests call it directly (with a database that fails, too).
 *
 * 404 for a bad address or a non-deliverable item (not cached), 503 when the database cannot answer (never a possibly
 * withdrawn file), 304 for a matching ETag, else 200 with the exact type, length, the content hash as ETag, a year of
 * immutable caching (names carry the hash), `nosniff`, a sandbox CSP, `inline` for images and `attachment` for PDFs.
 */
import type { Db } from "../db/client.ts";
import { publicAddressValid, resolvePublic, type DeliveryTarget } from "./delivery.ts";
import type { MediaStore } from "./storage.ts";
import { openTarget } from "./stream.ts";

export interface PublicAnswer {
  status: 200 | 304 | 404 | 503;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array> | null;
}

const PLAIN = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export const notFoundAnswer = (): PublicAnswer => ({ status: 404, headers: PLAIN, body: null });
const unavailable = (): PublicAnswer => ({ status: 503, headers: { ...PLAIN, "Retry-After": "30" }, body: null });

export function deliveryHeaders(target: DeliveryTarget, size: number): Record<string, string> {
  return {
    "Content-Type": target.mime,
    "Content-Length": String(size),
    ETag: `"${target.sha256Hex}"`,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": target.downloadName ? `attachment; filename="${target.downloadName}"` : "inline",
  };
}

export async function answerPublic(input: {
  db: () => Db;
  store: () => Promise<MediaStore | null>;
  releaseDir: string;
  id: string;
  name: string;
  ifNoneMatch: string | null;
  head: boolean;
}): Promise<PublicAnswer> {
  if (!publicAddressValid(input.id, input.name)) return notFoundAnswer();
  let target: DeliveryTarget | null;
  try {
    target = await resolvePublic(input.db(), input.id, input.name);
  } catch {
    return unavailable();
  }
  if (!target) return notFoundAnswer();
  const store = await input.store().catch(() => null);
  if (!store && target.area !== "release") return unavailable();
  const opened = await openTarget(store, input.releaseDir, target);
  if (!opened) return notFoundAnswer();
  const headers = deliveryHeaders(target, opened.size);
  const tags = input.ifNoneMatch;
  if (tags && tags.split(",").some((tag) => tag.trim() === headers.ETag || tag.trim() === `W/${headers.ETag}`)) {
    opened.close();
    const rest = Object.fromEntries(Object.entries(headers).filter(([key]) => key !== "Content-Length"));
    return { status: 304, headers: rest, body: null };
  }
  if (input.head) {
    opened.close();
    return { status: 200, headers, body: null };
  }
  return { status: 200, headers, body: opened.body };
}
