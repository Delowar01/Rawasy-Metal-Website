import type { CSSProperties } from "react";
import type { CommerceImage } from "../types";
import { Photo } from "../ui";

/**
 * A photograph and its caption, never shown wider than the source file. The company profile's photos are small
 * exports (many under 400 px), so a layout gives the figure less room, or a wider stage around it, instead of enlarging
 * the photo. Fades in (no clip reveal: that one settles from a zoom). `read` puts the caption on a reading zone, for a
 * figure on the open page (over the ambient).
 */
export function Figure({
  image,
  caption,
  sizes,
  priority,
  className = "",
  delay,
  read = false,
}: {
  image: CommerceImage;
  caption?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  delay?: number;
  read?: boolean;
}) {
  return (
    <figure
      className={`ip-figure ${className}`}
      style={{ maxWidth: image.width, ...(delay ? { ["--d" as string]: `${delay}ms` } : {}) } as CSSProperties}
      data-reveal="fade"
    >
      <div className="ip-figure-photo" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
        <Photo image={image} sizes={sizes} priority={priority} />
      </div>
      {caption && <figcaption className={read ? "ip-figure-caption a2-read" : "ip-figure-caption"}>{caption}</figcaption>}
    </figure>
  );
}
