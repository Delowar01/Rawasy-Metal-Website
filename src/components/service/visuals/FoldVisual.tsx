import { MediaFrame } from "@/components/inner/MediaFrame";
import { Backdrop } from "@/components/visual/Backdrop";
import { PointerLight } from "@/components/visual/PointerLight";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import type { MediaId } from "@/content/types";

/**
 * CNC Bending hero: a side elevation of a press brake at the moment of the
 * bend — ram and punch, V-die, the flat blank (dashed) and the formed part in
 * orange, with the bend arc, centre line and back gauge. No angles or sizes
 * are given. The source photograph is small, so it sits as a raised inset at
 * its own size.
 */
export function FoldVisual({ image, figure, caption }: { image: { id: MediaId; alt: string }; figure: string; caption: string }) {
  return (
    <div className="relative pb-28 sm:pb-32 lg:pb-24">
      <div className="tf-host panel-raised relative isolate overflow-hidden" data-tone="eng" data-reveal="frame">
        <Backdrop kind="fine" className="[--grid-line:color-mix(in_srgb,var(--eng)_15%,transparent)]" />
        <PointerLight />
        <PressBrake />
        <FrameMarks />
      </div>
      <div className="absolute bottom-0 end-0 w-[62%] max-w-[295px] sm:-end-4 lg:-end-8">
        <MediaFrame
          id={image.id}
          alt={image.alt}
          figure={figure}
          caption={caption}
          frame="plain"
          raised
          parallax={false}
          preload
          delay={260}
          sizes="295px"
          className="w-full"
        />
      </div>
    </div>
  );
}

function PressBrake() {
  return (
    <svg viewBox="0 0 520 360" className="line-draw relative block w-full" data-reveal="fade" fill="none" aria-hidden focusable={false}>
      <defs>
        <pattern id="fold-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0v7" stroke="var(--eng)" strokeWidth="0.8" opacity="0.45" />
        </pattern>
      </defs>
      {/* Centre line */}
      <path d="M260 16v330" stroke="var(--text-tertiary)" strokeWidth="0.8" strokeDasharray="12 4 2 4" />
      {/* Ram and punch */}
      <g stroke="var(--eng)" strokeWidth="1.4">
        <rect x="178" y="34" width="164" height="40" fill="var(--tone-surface)" pathLength={1} />
        <path d="M236 74h48l-14 182-10 14-10-14Z" fill="var(--surface-elevated)" pathLength={1} />
      </g>
      {/* Ram travel */}
      <g stroke="var(--accent)" strokeWidth="1.4">
        <path d="M260 6v20" />
        <path d="m253 19 7 8 7-8" />
      </g>
      {/* V-die, sectioned */}
      <path d="M130 250h92l38 42 38-42h92v54H130Z" fill="url(#fold-hatch)" stroke="var(--eng)" strokeWidth="1.4" pathLength={1} />
      <path d="M148 304h224v18H148Z" stroke="var(--eng)" strokeWidth="1.2" pathLength={1} />
      {/* Flat blank, before the bend */}
      <path d="M92 247h336" stroke="var(--text-tertiary)" strokeWidth="1.2" strokeDasharray="6 5" />
      {/* Formed part */}
      <path d="M108 172l148 102q4 3 8 0l148-102" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" pathLength={1} />
      {/* Bend arc */}
      <g stroke="var(--accent)" strokeWidth="1">
        <path d="M227 253.4a40 40 0 0 1 66 0" pathLength={1} />
        <path d="m223 249 8 8M297 249l-8 8" />
      </g>
      {/* Back gauge */}
      <g stroke="var(--eng)" strokeWidth="1.2">
        <path d="M444 150h28v34h-28Z" fill="var(--tone-surface)" />
        <path d="M412 172h32" strokeDasharray="3 3" />
        <path d="m420 166-8 6 8 6" />
      </g>
      {/* Overall width, without values */}
      <g stroke="var(--text-tertiary)" strokeWidth="0.8">
        <path d="M108 180v158M412 180v158" strokeDasharray="2 4" />
        <path d="M108 338h304M108 332v12M412 332v12" />
      </g>
    </svg>
  );
}
