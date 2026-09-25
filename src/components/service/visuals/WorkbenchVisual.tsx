import { MediaFrame } from "@/components/inner/MediaFrame";
import type { MediaId } from "@/content/types";

/**
 * Metal Fabrication hero: two workshop photographs pinned to a riveted,
 * perforated brass plate, joined by a weld seam that runs in once when
 * revealed. The photos stay at or below their native size.
 */
export function WorkbenchVisual({
  main,
  detail,
  figure,
  caption,
}: {
  main: { id: MediaId; alt: string };
  detail: { id: MediaId; alt: string };
  figure: string;
  caption: string;
}) {
  return (
    <div className="relative pb-6">
      <div aria-hidden className="bench-plate absolute inset-y-[10%] -end-2 start-[8%] sm:-end-6" data-reveal="fade">
        <span className="bg-perforated absolute inset-0 opacity-60" />
        <span className="rivets" />
      </div>
      <div className="relative grid grid-cols-12 items-start">
        <MediaFrame
          id={main.id}
          alt={main.alt}
          figure={figure}
          caption={caption}
          captionPosition="top"
          frame="plain"
          raised
          parallax={false}
          preload
          sizes="(min-width: 1024px) 396px, 72vw"
          className="col-span-10 sm:col-span-9"
        />
        <MediaFrame
          id={detail.id}
          alt={detail.alt}
          frame="plain"
          raised
          parallax={false}
          delay={240}
          sizes="(min-width: 1024px) 300px, 56vw"
          className="col-span-7 col-start-6 -mt-[18%] sm:col-span-6 sm:col-start-7"
        />
      </div>
      <svg viewBox="0 0 200 40" className="line-draw pointer-events-none absolute bottom-[4%] start-[2%] w-[42%] text-accent rtl:-scale-x-100" data-reveal="fade" fill="none" aria-hidden focusable={false}>
        <path d="M4 20h192" stroke="var(--craft)" strokeWidth="1" strokeDasharray="2 5" />
        <path
          d="M8 20c4-8 8-8 12 0s8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0"
          stroke="currentColor"
          strokeWidth="2"
          pathLength={1}
        />
      </svg>
    </div>
  );
}
