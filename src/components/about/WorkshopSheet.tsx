import Image from "next/image";
import type { CSSProperties } from "react";

export interface WorkshopPhoto {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
  caption: string;
}

/** Largest enlargement of a source photo: the profile's photos are small. */
const MAX_SCALE = 1.15;

/**
 * Workshop photos laid out like a photographer's contact sheet: each print at
 * close to its native size on a mat, with a figure number and caption, on a
 * dark slate band. Nothing is stretched to fill a grid cell.
 */
export function WorkshopSheet({ photos, figureLabel }: { photos: WorkshopPhoto[]; figureLabel: string }) {
  return (
    <ul className="flex flex-wrap items-end justify-center gap-x-6 gap-y-10 sm:gap-x-10">
      {photos.map((photo, i) => (
        <li
          key={photo.src}
          className="max-w-full"
          style={{ width: Math.round(photo.width * MAX_SCALE), ["--d" as string]: (i % 4) * 70 } as CSSProperties}
          data-reveal
        >
          <figure>
            <div className="bg-[#f1efe9] p-1.5 shadow-[0_2px_4px_rgb(0_0_0/0.4),0_24px_40px_-18px_rgb(0_0_0/0.8)]">
              <div className="relative overflow-hidden bg-[#2a3237]" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
                <Image
                  src={photo.src}
                  alt={photo.caption}
                  fill
                  sizes={`${Math.round(photo.width * MAX_SCALE)}px`}
                  placeholder="blur"
                  blurDataURL={photo.blurDataURL}
                  className="object-cover"
                />
              </div>
            </div>
            <figcaption className="mt-3 flex gap-2.5 text-[0.8rem] leading-snug text-band-ink-2">
              <span className="t-num shrink-0 text-[var(--accent-on-dark)]" dir="ltr">
                {figureLabel} {String(i + 1).padStart(2, "0")}
              </span>
              <span aria-hidden className="text-band-line">
                /
              </span>
              <span>{photo.caption}</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
