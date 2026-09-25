import { ScanLine } from "@/components/visual/Backdrop";

/** Lengths of the engraved "text" grooves on the plate (a layout, not real text). */
const LINES = [
  { y: 62, w: 126, h: 5 },
  { y: 86, w: 96, h: 2.5 },
  { y: 102, w: 118, h: 2.5 },
  { y: 118, w: 74, h: 2.5 },
  { y: 150, w: 108, h: 3.5 },
  { y: 170, w: 84, h: 2.5 },
  { y: 204, w: 130, h: 2.5 },
  { y: 220, w: 58, h: 2.5 },
];

/**
 * Laser Engraving hero: no authentic engraving photograph is available yet,
 * so the hero is a technical treatment — a brushed brass plate engraved with a
 * guilloche rosette, a border and a block of engraved lines. Each groove is
 * drawn twice (shadow and highlight) so it reads as cut into the metal. The
 * orange crosshair and beam mark where the laser is working.
 */
export function EngravedPlateVisual() {
  const outer = Array.from({ length: 24 }, (_, i) => i * 7.5);
  const inner = Array.from({ length: 18 }, (_, i) => i * 10);
  const grooves = (
    <>
      <rect x="14" y="14" width="372" height="252" />
      <rect x="21" y="21" width="358" height="238" />
      <path d="M30 40V30h10M370 40V30h-10M30 240v10h10M370 240v10h-10" />
      {LINES.map((l) => (
        <path key={l.y} d={`M44 ${l.y}h${l.w}`} strokeWidth={l.h} />
      ))}
      <g transform="translate(282 140)">
        <circle r="92" />
        <circle r="87" strokeDasharray="1.5 3" />
        {outer.map((a) => (
          <ellipse key={`o${a}`} rx="76" ry="25" transform={`rotate(${a})`} pathLength={1} />
        ))}
        {inner.map((a) => (
          <ellipse key={`i${a}`} rx="44" ry="15" transform={`rotate(${a + 5})`} pathLength={1} />
        ))}
        <circle r="10" />
      </g>
    </>
  );
  return (
    <div className="relative mx-auto max-w-[38rem] pb-10 lg:me-0">
      <div aria-hidden className="absolute inset-x-3 -bottom-0 top-8 translate-x-[calc(var(--dir)*18px)] border border-line-strong" />
      <div className="plate-brass relative isolate overflow-hidden" data-reveal="fade">
        <span aria-hidden className="rivets" />
        <svg viewBox="0 0 400 280" className="line-draw engrave relative block w-full rtl:-scale-x-100" data-reveal="fade" fill="none" aria-hidden focusable={false}>
          <g className="engr-hi" transform="translate(0.7 0.7)">
            {grooves}
          </g>
          <g className="engr-cut">{grooves}</g>
          {/* The laser at work: beam and crosshair (orange) */}
          <g stroke="var(--accent)" strokeWidth="1.2">
            <path d="M282 0v38" opacity="0.8" strokeDasharray="3 3" />
            <circle cx="282" cy="48" r="6" />
            <path d="M282 36v6M282 54v6M270 48h6M288 48h6" />
          </g>
        </svg>
        <ScanLine duration={10} delay={1} />
      </div>
      <div aria-hidden className="ruler mt-6 h-3 text-ink-3" />
    </div>
  );
}
