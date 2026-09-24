import Image from "next/image";
import type { CSSProperties } from "react";
import { getMedia } from "@/content/media";
import type { MediaId } from "@/content/types";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import { cn } from "@/lib/utils";

/** Extra size of the parallax layer; the figure is capped so it never exceeds the source. */
const PARALLAX = 1.08;

/**
 * A photograph on a technical sheet (the site's image frame): framing rules
 * that draw in, corner and registration marks, an optional offset outline,
 * dimension rule and plate, a numbered caption, a slow hover zoom and a very
 * subtle scroll parallax. It never renders wider than the source image, so
 * low-resolution originals are not blown up.
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
  plate = false,
  parallax = true,
  captionPosition = "bottom",
  raised = false,
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
  /** A perforated steel plate layered behind the photograph. */
  plate?: boolean;
  parallax?: boolean;
  captionPosition?: "top" | "bottom";
  /** Lift the photograph off the sheet (for images layered over others). */
  raised?: boolean;
  preload?: boolean;
  delay?: number;
  className?: string;
  imageClassName?: string;
}) {
  const media = getMedia(id);
  const maxWidth = Math.round(parallax ? media.width / PARALLAX : media.width);
  const captionNode = (caption || figure) && (
    <figcaption
      className={cn(
        "t-label flex items-baseline gap-3 text-ink-3",
        // A caption shown above the photograph keeps its place after it in the reading order.
        captionPosition === "top" ? "order-first mb-5" : frame === "offset" ? "mt-7" : "mt-4",
      )}
    >
      {figure && <span className="t-num shrink-0 text-accent-ink">{figure}</span>}
      {caption && <span>{caption}</span>}
      <span aria-hidden className="h-px min-w-6 flex-1 translate-y-[-0.3em] self-end bg-line-strong max-sm:hidden" />
    </figcaption>
  );
  const image = (
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
  );
  return (
    <figure className={cn("relative", captionPosition === "top" && "flex flex-col", className)} style={{ maxWidth }}>
      {dimension && (
        <div aria-hidden className="mb-4 flex items-center gap-3 text-ink-3">
          <span className="h-3 w-px bg-current" />
          <span className="h-px flex-1 bg-current opacity-50" />
          <span className="t-num text-[0.66rem] tracking-[0.14em]">{dimension}</span>
          <span className="h-px flex-1 bg-current opacity-50" />
          <span className="h-3 w-px bg-current" />
        </div>
      )}
      <div className="relative isolate">
        {plate && (
          <span
            aria-hidden
            className="plate-sheet panel-metal absolute -z-20 hidden sm:block [inset-block:-1.75rem_2.5rem] [inset-inline:2.5rem_-1.75rem]"
          >
            <span className="bg-perforated absolute inset-0 opacity-70" />
          </span>
        )}
        {frame === "offset" && <span aria-hidden className="media-offset absolute -z-10 border border-line-strong" />}
        <div className="tf-host zoom-host" data-reveal="frame" style={{ ["--d" as string]: delay } as CSSProperties}>
          <div
            className={cn("photo zoom-img relative", raised ? "shadow-[var(--shadow-metal)]" : "shadow-[var(--shadow-medium)]")}
            style={{ aspectRatio: ratio ?? `${media.width} / ${media.height}`, ["--d" as string]: delay } as CSSProperties}
            data-reveal="clip"
          >
            {parallax ? <div className="parallax">{image}</div> : image}
            <span aria-hidden className="reg-marks" />
          </div>
          <FrameMarks />
        </div>
      </div>
      {captionNode}
    </figure>
  );
}
