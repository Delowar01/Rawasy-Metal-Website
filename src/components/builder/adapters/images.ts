import type { CommerceImage } from "@/components/commerce/types";
import type { RenderContext } from "../context";

/*
 * Images for the approved components (A5 brief §17, §41): they take a `CommerceImage` (source, size, blur preview, alt
 * text). A delivered media library item (A4's deliverability rule) becomes one as it is — an upload drawn without the
 * image optimizer, which never takes `/media/u/…` (A4). Anything the preview cannot show becomes an admin-only stand-in:
 * a hatched square that says "Preview only — Photo not shown" and why, drawn in the photo's place, so an approved frame
 * keeps its shape and nothing is shown as if it were safe. The stand-in is an inline image (no request) and never part of
 * the public site.
 */

/** A transparent 1 × 1 blur preview (never a request). */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const XML: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (text: string) => text.replace(/[&<>"']/g, (c) => XML[c]);

/** The stand-in for a photo the preview cannot show (`what`: "Photo", "Logo"…), with the reason on its own lines. */
export function placeholderImage(reason: string, what = "Photo"): CommerceImage {
  const lines = [`${what} not shown`, ...reason.split(", ")].slice(0, 5);
  const step = 64;
  const first = 500 - ((lines.length - 1) * step) / 2 + 26;
  const text = lines
    .map((line, i) => `<text x="500" y="${first + i * step}" font-size="${i === 0 ? 48 : 42}" font-weight="${i === 0 ? 700 : 500}">${escapeXml(line)}</text>`)
    .join("");
  const boxTop = first - 140;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">` +
    `<defs><pattern id="h" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="32" fill="#d3d9e1"/></pattern></defs>` +
    `<rect width="1000" height="1000" fill="#e6e9ee"/><rect width="1000" height="1000" fill="url(#h)"/>` +
    `<rect x="150" y="${boxTop}" width="700" height="${lines.length * step + 150}" rx="24" fill="#fbfbfc" stroke="#8d97a5" stroke-width="3" stroke-dasharray="16 10"/>` +
    `<g fill="#1f2733" font-family="ui-sans-serif, system-ui, sans-serif" text-anchor="middle">` +
    `<text x="500" y="${first - 70}" font-size="30" font-weight="700" fill="#7a5a00" letter-spacing="2">PREVIEW ONLY</text>${text}</g></svg>`;
  return {
    src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    width: 1000,
    height: 1000,
    blurDataURL: BLANK,
    alt: `Preview only: ${what.toLowerCase()} not shown (${reason})`,
    unoptimized: true,
  };
}

/** Why a media item cannot be shown here, or null when it can (a delivered image). */
export function imageProblem(id: string | null | undefined, ctx: RenderContext): string | null {
  if (!id) return "No photo chosen yet";
  const item = ctx.media.get(id);
  if (!item) return "Not available";
  if (!item.ok) return item.reason;
  return item.kind === "document" ? "Not an image" : null;
}

/** A media item as the approved components take it, or the stand-in that says why it is not shown. */
export function commerceImage(id: string | null | undefined, ctx: RenderContext, alt: string, what = "Photo"): CommerceImage {
  const problem = imageProblem(id, ctx);
  const item = id ? ctx.media.get(id) : undefined;
  if (problem || !item || !item.ok) return placeholderImage(problem ?? "Not available", what);
  return {
    src: item.image.src,
    width: item.image.width,
    height: item.image.height,
    blurDataURL: item.image.blurDataURL,
    alt,
    ...(item.image.unoptimized ? { unoptimized: true as const } : {}),
  };
}
