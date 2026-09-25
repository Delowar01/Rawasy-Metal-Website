import { MediaFrame } from "@/components/inner/MediaFrame";
import { Backdrop, ScanLine } from "@/components/visual/Backdrop";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import type { MediaId } from "@/content/types";

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
    <svg viewBox="0 0 260 160" className="line-draw relative block w-full" data-reveal="fade" fill="none" aria-hidden focusable={false}>
      {/* Sheet edge and nested parts (steel) */}
      <g stroke="var(--eng)" strokeWidth="1" opacity="0.75">
        <rect x="6.5" y="6.5" width="247" height="147" strokeDasharray="3 4" />
        <path d="M194 30h42v40l-22 22h-20Z" />
        <circle cx="213" cy="52" r="6" />
        <circle cx="215" cy="126" r="18" />
        <circle cx="215" cy="126" r="8" />
      </g>
      {/* Dimension rule over the part (no values) */}
      <g stroke="var(--text-tertiary)" strokeWidth="0.75">
        <path d="M28 17h148M28 13v8M176 13v8" />
        <path d="M188 34v88M184 34h8M184 122h8" />
      </g>
      {/* The part being cut: outline, holes and slot, each with a lead-in */}
      <g stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="square">
        <path d="M18 34h10" pathLength={1} />
        <path d="M28 34h122l26 26v62h-68a14 14 0 0 1-28 0H28Z" pathLength={1} />
        <circle cx="52" cy="60" r="9" pathLength={1} />
        <circle cx="52" cy="98" r="9" pathLength={1} />
        <circle cx="148" cy="98" r="11" pathLength={1} />
        <rect x="88" y="52" width="40" height="14" rx="7" pathLength={1} />
      </g>
      {/* Pierce points */}
      <g stroke="var(--accent)" strokeWidth="1">
        <path d="M49 60h6M52 57v6M49 98h6M52 95v6M145 98h6M148 95v6M105 59h6M108 56v6" />
      </g>
      {/* Cutting head position */}
      <g stroke="var(--accent)" strokeWidth="1.2">
        <circle cx="176" cy="92" r="5" />
        <path d="M176 80v6M176 98v6M164 92h6M182 92h6" />
      </g>
    </svg>
  );
}
