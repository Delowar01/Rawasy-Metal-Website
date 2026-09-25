import Image from "next/image";
import type { CSSProperties } from "react";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import { cn } from "@/lib/utils";
import type { ServiceLook } from "./looks";

export interface GalleryPhoto {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
  caption: string;
}

/** Print height in the mosaic; a photo shorter than this keeps its native size. */
const ROW = 236;
/** Largest enlargement of a print on the contact sheet. */
const SHEET_SCALE = 1.15;
const num = (n: number) => String(n).padStart(2, "0");

/**
 * The service's photographs, framed and captioned, in a layout that respects
 * the small originals (never shown wider than the source):
 * - `mosaic` centred rows of framed prints of equal height and mixed widths
 * - `sheet`  a contact sheet of small prints on paper mats, numbered, with the
 *            captions set as a legend underneath (dark band)
 * - `pair`   two prints side by side on a plate
 * Figure numbers continue from the figures earlier on the page (`start`).
 */
export function ServiceGallery({
  layout,
  photos,
  figureLabel,
  start = 1,
  band = false,
}: {
  layout: ServiceLook["gallery"];
  photos: GalleryPhoto[];
  figureLabel: string;
  start?: number;
  band?: boolean;
}) {
  if (layout === "sheet") {
    return (
      <figure>
        <ul className="flex flex-wrap items-end justify-center gap-x-6 gap-y-8 sm:gap-x-9">
          {photos.map((photo, i) => (
            <li
              key={photo.src}
              className="max-w-full"
              style={{ width: Math.round(photo.width * SHEET_SCALE), ["--d" as string]: (i % 5) * 70 } as CSSProperties}
              data-reveal
            >
              <div className="bg-[#f1efe9] p-1.5 shadow-[0_2px_4px_rgb(0_0_0/0.4),0_24px_40px_-18px_rgb(0_0_0/0.8)]">
                <div className="relative overflow-hidden bg-[#2a3237]" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
                  <Image
                    src={photo.src}
                    alt={photo.caption}
                    fill
                    sizes={`${Math.round(photo.width * SHEET_SCALE)}px`}
                    placeholder="blur"
                    blurDataURL={photo.blurDataURL}
                    className="object-cover"
                  />
                </div>
              </div>
              <p aria-hidden className="t-num mt-3 text-center text-[0.72rem] text-[var(--accent-on-dark)]" dir="ltr">
                {num(start + i)}
              </p>
            </li>
          ))}
        </ul>
        <figcaption className="mt-12 border-t border-band-line pt-6">
          <ol className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, i) => (
              <li key={photo.src} className="flex gap-3 text-[0.9rem] leading-snug text-band-ink-2">
                <span className="t-num shrink-0 text-[var(--accent-on-dark)]" dir="ltr">
                  {figureLabel} {num(start + i)}
                </span>
                <span>{photo.caption}</span>
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>
    );
  }

  if (layout === "pair") {
    return (
      <ul className="panel-recessed mx-auto flex w-fit max-w-full flex-wrap items-start justify-center gap-x-8 gap-y-10 px-5 py-8 sm:px-10 sm:py-12">
        {photos.map((photo, i) => (
          <li key={photo.src} className="max-w-full" style={{ width: photo.width }} data-reveal>
            <Print photo={photo} index={start + i} figureLabel={figureLabel} band={band} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-wrap items-start justify-center gap-x-6 gap-y-10 lg:gap-x-8">
      {photos.map((photo, i) => {
        const width = Math.min(photo.width, Math.round((photo.width / photo.height) * ROW));
        return (
          <li key={photo.src} className="max-w-full" style={{ width, ["--d" as string]: (i % 3) * 80 } as CSSProperties} data-reveal>
            <Print photo={photo} index={start + i} figureLabel={figureLabel} band={band} />
          </li>
        );
      })}
    </ul>
  );
}

function Print({ photo, index, figureLabel, band }: { photo: GalleryPhoto; index: number; figureLabel: string; band: boolean }) {
  return (
    <figure>
      <div className="tf-host zoom-host" data-tf="corners">
        <div className="zoom-img relative overflow-hidden bg-strong shadow-[var(--shadow-image)]" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
          <Image
            src={photo.src}
            alt={photo.caption}
            fill
            sizes={`(min-width: 640px) ${photo.width}px, 92vw`}
            placeholder="blur"
            blurDataURL={photo.blurDataURL}
            className="object-cover"
          />
        </div>
        <FrameMarks lines={false} />
      </div>
      <figcaption className={cn("mt-3 flex gap-2.5 text-[0.84rem] leading-snug", band ? "text-band-ink-2" : "text-ink-2")}>
        <span className={cn("t-num flex shrink-0 items-center gap-1.5", band ? "text-[var(--accent-on-dark)]" : "text-ink-2")} dir="ltr">
          {!band && <span aria-hidden className="size-1.5 bg-accent" />}
          {figureLabel} {num(index)}
        </span>
        <span aria-hidden className={band ? "text-band-line" : "text-line-strong"}>
          /
        </span>
        <span>{photo.caption}</span>
      </figcaption>
    </figure>
  );
}
