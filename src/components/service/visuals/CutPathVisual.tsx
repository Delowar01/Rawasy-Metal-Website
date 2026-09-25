import { MediaFrame } from "@/components/inner/MediaFrame";
import { Backdrop, ScanLine } from "@/components/visual/Backdrop";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import type { MediaId } from "@/content/types";
import { CUTTING_HEAD, DIMENSIONS, HOLES, LEAD_IN, NEST_VIEW, NESTED_CIRCLES, NESTED_PART, OUTLINE, PIERCES, SHEET_EDGE, SLOT } from "./nesting-sheet";

/**
 * Laser Cutting hero: the cutting photograph, with a nesting sheet laid over
 * its lower corner — a part's cut path in orange (lead-ins, pierce points,
 * holes and a slot) among steel-blue nested parts. The path draws itself once
 * when revealed; a scan line passes over the sheet while it is on screen.
 */
export function CutPathVisual({ image, figure, caption }: { image: { id: MediaId; alt: string }; figure: string; caption: string }) {
  return (
    <div className="relative pb-24 sm:pb-28 lg:pb-20">
      <MediaFrame
        id={image.id}
        alt={image.alt}
        figure={figure}
        caption={caption}
        captionPosition="top"
        parallax={false}
        preload
        sizes="(min-width: 1280px) 640px, (min-width: 1024px) 50vw, 92vw"
        className="w-full lg:ms-auto"
      />
      <div className="absolute bottom-0 start-0 w-[74%] max-w-[23rem] sm:-start-4 lg:-start-10" data-reveal style={{ ["--d" as string]: 380 }}>
        <div className="tf-host panel-raised relative isolate overflow-hidden" data-tone="eng">
          <Backdrop kind="fine" className="[--grid-line:color-mix(in_srgb,var(--eng)_14%,transparent)]" />
          <NestingSheet />
          <ScanLine duration={8} delay={1.5} />
          <FrameMarks lines={false} />
        </div>
      </div>
    </div>
  );
}

function NestingSheet() {
  return (
    <svg viewBox={`0 0 ${NEST_VIEW.w} ${NEST_VIEW.h}`} className="line-draw relative block w-full" data-reveal="fade" fill="none" aria-hidden focusable={false}>
      {/* Sheet edge and nested parts (steel) */}
      <g stroke="var(--eng)" strokeWidth="1" opacity="0.75">
        <rect {...SHEET_EDGE} strokeDasharray="3 4" />
        <path d={NESTED_PART} />
        {NESTED_CIRCLES.map((c) => (
          <circle key={`${c.cx}-${c.r}`} {...c} />
        ))}
      </g>
      {/* Dimension rule over the part (no values) */}
      <g stroke="var(--text-tertiary)" strokeWidth="0.75">
        {DIMENSIONS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {/* The part being cut: outline, holes and slot, each with a lead-in */}
      <g stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="square">
        <path d={LEAD_IN} pathLength={1} />
        <path d={OUTLINE} pathLength={1} />
        {HOLES.map((h) => (
          <circle key={`${h.cx}-${h.cy}`} {...h} pathLength={1} />
        ))}
        <rect {...SLOT} pathLength={1} />
      </g>
      {/* Pierce points */}
      <g stroke="var(--accent)" strokeWidth="1">
        <path d={PIERCES} />
      </g>
      {/* Cutting head position */}
      <g stroke="var(--accent)" strokeWidth="1.2">
        <circle cx={CUTTING_HEAD.cx} cy={CUTTING_HEAD.cy} r={CUTTING_HEAD.r} />
        <path d={CUTTING_HEAD.ticks} />
      </g>
    </svg>
  );
}
