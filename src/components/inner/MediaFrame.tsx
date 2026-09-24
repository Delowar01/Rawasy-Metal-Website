import Image from "next/image";
import type { CSSProperties } from "react";
import { getMedia } from "@/content/media";
import type { MediaId } from "@/content/types";
import { cn } from "@/lib/utils";

/**
 * A photograph on a technical sheet: crop marks, an optional offset frame and
 * dimension rule, and a numbered caption. It never renders wider than the
 * source image, so low-resolution originals are not blown up.
 */
export function MediaFrame({
  id,
  alt,
  sizes,
  caption,
  figure,
  dimension,
  ratio,
  frame = "offset",
  preload,
  delay = 0,
  className,
  imageClassName,
}: {
  id: MediaId;
  alt: string;
  sizes: string;
  caption?: string;
  /** Short index shown before the caption, e.g. "Fig. 01". */
  figure?: string;
  /** Label on a dimension rule above the image. */
  dimension?: string;
  /** CSS aspect ratio; defaults to the image's own. */
  ratio?: string;
  frame?: "offset" | "plain";
  preload?: boolean;
  delay?: number;
  className?: string;
  imageClassName?: string;
}) {
  const media = getMedia(id);
  return (
    <figure className={cn("relative", className)} style={{ maxWidth: media.width }}>
      {dimension && (
        <div aria-hidden className="mb-4 flex items-center gap-3 text-ink-3">
          <span className="h-3 w-px bg-current" />
          <span className="h-px flex-1 bg-current opacity-50" />
          <span className="t-num text-[0.66rem] tracking-[0.14em]">{dimension}</span>
          <span className="h-px flex-1 bg-current opacity-50" />
          <span className="h-3 w-px bg-current" />
        </div>
      )}
      <div className="crop-marks relative isolate">
        {frame === "offset" && <span aria-hidden className="media-offset absolute -z-10 border border-line-strong" />}
        <div
          className="photo relative"
          style={{ aspectRatio: ratio ?? `${media.width} / ${media.height}`, ["--d" as string]: delay } as CSSProperties}
          data-reveal="clip"
        >
          <Image
            src={media.src}
            alt={alt}
            fill
            sizes={sizes}
            preload={preload}
            placeholder="blur"
            blurDataURL={media.blurDataURL}
            className={cn("object-cover", imageClassName)}
          />
        </div>
      </div>
      {(caption || figure) && (
        <figcaption className={cn("t-label flex items-baseline gap-3 text-ink-3", frame === "offset" ? "mt-7" : "mt-4")}>
          {figure && <span className="t-num shrink-0 text-accent-ink">{figure}</span>}
          {caption && <span>{caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}
