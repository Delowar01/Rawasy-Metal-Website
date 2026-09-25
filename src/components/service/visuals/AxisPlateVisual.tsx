import { MediaFrame } from "@/components/inner/MediaFrame";
import { ScanLine } from "@/components/visual/Backdrop";
import type { MediaId } from "@/content/types";

/** Grid positions (percent of the plate) of the structural axes. */
const COLUMNS = [
  { x: 9, label: "A" },
  { x: 36, label: "B" },
  { x: 64, label: "C" },
  { x: 91, label: "D" },
];
const ROWS = [
  { y: 13, label: "1" },
  { y: 87, label: "2" },
];

/**
 * Steel Structures hero: the photograph set on a deep slate drawing sheet,
 * with the structural grid running out past it — lettered column axes along
 * the top, numbered rows at the side, as on a steel frame drawing. The axes
 * are a drawing convention (not dimensions) and are never mirrored in Arabic.
 */
export function AxisPlateVisual({ image, figure, caption }: { image: { id: MediaId; alt: string }; figure: string; caption: string }) {
  return (
    <figure className="relative">
      <div aria-hidden className="absolute -inset-3 bottom-8 translate-x-[calc(var(--dir)*14px)] translate-y-3.5 border border-line-strong sm:-inset-4 sm:bottom-6" />
      <div className="axis-plate relative isolate overflow-hidden px-[9%] pb-[8%] pt-[11%] shadow-[var(--shadow-floating)]" data-reveal="fade">
        <div aria-hidden className="absolute inset-0 -z-10" dir="ltr">
          {COLUMNS.map((c, i) => (
            <span key={c.label}>
              <span className="axis-line axis-line-v" style={{ left: `${c.x}%`, ["--d" as string]: 120 * i }} data-reveal="line" />
              <span className="axis-bubble" style={{ left: `${c.x}%`, top: "5.5%", ["--d" as string]: 120 * i + 500 }} data-reveal="fade">
                {c.label}
              </span>
            </span>
          ))}
          {ROWS.map((r, i) => (
            <span key={r.label}>
              <span className="axis-line axis-line-h" style={{ top: `${r.y}%`, ["--d" as string]: 300 + 120 * i }} data-reveal="line" />
              <span className="axis-bubble" style={{ left: "3.5%", top: `${r.y}%`, ["--d" as string]: 120 * i + 800 }} data-reveal="fade">
                {r.label}
              </span>
            </span>
          ))}
          <svg viewBox="0 0 64 40" className="absolute bottom-[2.5%] right-[3%] w-12 text-[var(--slate-text-2)] sm:w-14" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M14 6h36M14 34h36M32 6v28" />
            <path d="M14 6v4M50 6v4M14 34v-4M50 34v-4" />
          </svg>
        </div>
        <ScanLine duration={12} delay={2} />
        <MediaFrame
          id={image.id}
          alt={image.alt}
          frame="plain"
          raised
          parallax={false}
          preload
          sizes="(min-width: 1280px) 600px, (min-width: 1024px) 44vw, 80vw"
          className="relative w-full"
        />
      </div>
      <figcaption className="t-label mt-7 flex items-baseline gap-3 text-ink-3">
        <span className="t-num shrink-0 text-accent-ink">{figure}</span>
        <span>{caption}</span>
        <span aria-hidden className="h-px min-w-6 flex-1 translate-y-[-0.3em] self-end bg-line-strong max-sm:hidden" />
      </figcaption>
    </figure>
  );
}
