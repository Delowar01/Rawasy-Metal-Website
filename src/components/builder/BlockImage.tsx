import Image from "next/image";
import type { CSSProperties } from "react";
import type { PreviewMedia } from "@/server/builder/preview-data";
import type { RenderContext } from "./context";
import { PreviewNote } from "./frame";

/** The shapes a block may crop a photo to (kit.ts `ASPECTS`), as width ÷ height. */
const RATIOS: Record<string, [number, number]> = { "16x9": [16, 9], "3x2": [3, 2], "4x3": [4, 3], "1x1": [1, 1], "4x5": [4, 5] };

type Delivered = Extract<PreviewMedia, { ok: true }>;

/** A delivered image, or null (a placeholder is drawn instead). */
export function deliveredImage(id: string | null | undefined, ctx: RenderContext): Delivered | null {
  if (!id) return null;
  const item = ctx.media.get(id);
  return item && item.ok && item.kind !== "document" ? item : null;
}

/**
 * A photo from the media library (A5 brief §17, §43, §52): only a delivered item (A4's deliverability rule: a
 * `public_media` row) is drawn; anything else is an admin-only placeholder that says why (a private item only "Not
 * available"). A chosen shape crops without new files: the frame takes the shape and the photo covers it, positioned at
 * the item's focal point (`object-position`). A photo is never drawn larger than its file: a frame is at most as wide
 * as the source allows at that shape. Uploaded items (`/media/u/…`) are drawn as they are (the image optimizer never takes
 * them, A4).
 */
export function BlockImage({
  id,
  ctx,
  alt,
  decorative = false,
  aspect = "original",
  sizes,
  priority = false,
  className = "",
  frame,
  motion,
}: {
  id: string | null | undefined;
  ctx: RenderContext;
  /** The block's own alt text in the chosen language; the item's default alt text is used when it is empty. */
  alt?: string;
  decorative?: boolean;
  aspect?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Border, radius and shadow attributes (design). */
  frame?: Record<string, string>;
  /** Reveal attributes for the photo (never for a caption: words never fade). */
  motion?: Record<string, unknown>;
}) {
  const item = id ? ctx.media.get(id) : undefined;
  if (!id || !item || !item.ok || item.kind === "document") {
    const reason = !id ? "No photo chosen yet" : !item ? "Not available" : item.ok ? "Not an image" : item.reason;
    return (
      <div className={`gb-photo gb-missing ${className}`.trim()} data-aspect={aspect === "original" ? "4x3" : aspect} {...frame}>
        <PreviewNote>
          Photo not shown in the preview: <strong>{reason}</strong>
        </PreviewNote>
      </div>
    );
  }
  const { image, focal } = item;
  const text = decorative ? "" : alt || item.alt[ctx.locale] || "";
  const optimizer = image.unoptimized ? { unoptimized: true } : {};
  // The reveal's own style (its delay) joins the frame's width cap: spread after it, it would replace the cap.
  const { style: revealStyle, ...reveal } = (motion ?? {}) as { style?: CSSProperties; [attribute: string]: unknown };
  const ratio = RATIOS[aspect];
  if (!ratio) {
    return (
      <div className={`gb-photo ${className}`.trim()} data-aspect="original" style={{ ...revealStyle, maxWidth: image.width }} {...frame} {...reveal}>
        <Image src={image.src} alt={text} width={image.width} height={image.height} sizes={sizes} placeholder="blur" blurDataURL={image.blurDataURL} priority={priority} {...optimizer} />
      </div>
    );
  }
  // At this shape the photo covers the frame at most at its own size: the frame's width is capped by the source's width
  // and by its height times the shape.
  const cap = Math.floor(Math.min(image.width, (image.height * ratio[0]) / ratio[1]));
  const position = focal ? `${Math.round(focal.x * 1000) / 10}% ${Math.round(focal.y * 1000) / 10}%` : "50% 50%";
  return (
    <div className={`gb-photo ${className}`.trim()} data-aspect={aspect} style={{ ...revealStyle, maxWidth: cap }} {...frame} {...reveal}>
      <Image
        src={image.src}
        alt={text}
        fill
        sizes={sizes}
        placeholder="blur"
        blurDataURL={image.blurDataURL}
        priority={priority}
        style={{ objectPosition: position } as CSSProperties}
        {...optimizer}
      />
    </div>
  );
}
