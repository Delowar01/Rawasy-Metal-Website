import { ScanLine } from "@/components/visual/Backdrop";
import { BORDER_INNER, BORDER_OUTER, CORNER_MARKS, ENGRAVED_LINES, LASER_MARK, linePath, PLATE_VIEW, ROSETTE } from "./engraved-plate";

/**
 * Laser Engraving hero: no authentic engraving photograph is available yet,
 * so the hero is a technical treatment — a brushed brass plate engraved with a
 * guilloche rosette, a border and a block of engraved lines. Each groove is
 * drawn twice (shadow and highlight) so it reads as cut into the metal. The
 * orange crosshair and beam mark where the laser is working.
 */
export function EngravedPlateVisual() {
  const { outer, inner } = ROSETTE;
  const grooves = (
    <>
      <rect {...BORDER_OUTER} />
      <rect {...BORDER_INNER} />
      <path d={CORNER_MARKS} />
      {ENGRAVED_LINES.map((l) => (
        <path key={l.y} d={linePath(l)} strokeWidth={l.h} />
      ))}
      <g transform={`translate(${ROSETTE.x} ${ROSETTE.y})`}>
        <circle r={ROSETTE.ring} />
        <circle r={ROSETTE.dotted} strokeDasharray="1.5 3" />
        {outer.angles.map((a) => (
          <ellipse key={`o${a}`} rx={outer.rx} ry={outer.ry} transform={`rotate(${a})`} pathLength={1} />
        ))}
        {inner.angles.map((a) => (
          <ellipse key={`i${a}`} rx={inner.rx} ry={inner.ry} transform={`rotate(${a})`} pathLength={1} />
        ))}
        <circle r={ROSETTE.boss} />
      </g>
    </>
  );
  return (
    <div className="relative mx-auto max-w-[38rem] pb-10 lg:me-0">
      <div aria-hidden className="absolute inset-x-3 -bottom-0 top-8 translate-x-[calc(var(--dir)*18px)] border border-line-strong" />
      <div className="plate-brass relative isolate overflow-hidden" data-reveal="fade">
        <span aria-hidden className="rivets" />
        <svg viewBox={`0 0 ${PLATE_VIEW.w} ${PLATE_VIEW.h}`} className="line-draw engrave relative block w-full rtl:-scale-x-100" data-reveal="fade" fill="none" aria-hidden focusable={false}>
          <g className="engr-hi" transform="translate(0.7 0.7)">
            {grooves}
          </g>
          <g className="engr-cut">{grooves}</g>
          {/* The laser at work: beam and crosshair (orange) */}
          <g stroke="var(--accent)" strokeWidth="1.2">
            <path d={LASER_MARK.beam} opacity="0.8" strokeDasharray="3 3" />
            <circle cx={LASER_MARK.x} cy={LASER_MARK.y} r={LASER_MARK.r} />
            <path d={LASER_MARK.ticks} />
          </g>
        </svg>
        <ScanLine duration={10} delay={1} />
      </div>
      <div aria-hidden className="ruler mt-6 h-3 text-ink-3" />
    </div>
  );
}
