"use client";

import { useId, useRef } from "react";
import { logoPaths } from "@/components/brand/Logo";
import { closedPath, polygon, type Pt } from "./geometry";
import { EASE_IN_OUT, EASE_OUT, animate, track, useSignature, type SignatureSetup, type Stop } from "./useSignature";
import "./signature.css";

/*
 * Signature illustration — laser engraving. A brass plate; the laser crosshair
 * rasters across a medallion (double ring, eight-point star, the RAWASY mark),
 * revealing the engraved grooves pass by pass behind a glowing scan line, then
 * a highlight crosses the plate as the light catches the fresh engraving.
 * RAWASY's own mark only: no third-party branding, part or serial numbers.
 */

/** Framed tightly on the plate: the illustration fills small cards. */
const VIEW = { x: 64, y: 22, w: 352, h: 258 };
const PLATE = { x: 92, y: 40, w: 296, h: 220, r: 16 };
const CENTER = { x: 240, y: 150 };
const MEDALLION = 76;
const SCREWS: Pt[] = [
  [PLATE.x + 20, PLATE.y + 20],
  [PLATE.x + PLATE.w - 20, PLATE.y + 20],
  [PLATE.x + PLATE.w - 20, PLATE.y + PLATE.h - 20],
  [PLATE.x + 20, PLATE.y + PLATE.h - 20],
];
const SQUARE_A = closedPath(polygon(CENTER.x, CENTER.y, 63, 4));
const SQUARE_B = closedPath(polygon(CENTER.x, CENTER.y, 63, 4, -Math.PI / 4));
/** The mark (viewBox 70.8 201.37 264.82 × 189.35) scaled to 46 units wide, centred. */
const MARK_SCALE = 46 / 264.82;
const MARK = `translate(${CENTER.x} ${CENTER.y}) scale(${MARK_SCALE.toFixed(4)}) translate(-203.21 -296.05)`;
const PASSES = 8;
const TOP = CENTER.y - MEDALLION - 1;
const HEIGHT = (MEDALLION + 1) * 2;

/** Raster pass ends: the head sweeps across the medallion's chord at each depth, alternating sides. */
const RASTER: Pt[] = Array.from({ length: PASSES + 1 }, (_, i) => {
  const y = TOP + (i * HEIGHT) / PASSES;
  const half = Math.sqrt(Math.max((MEDALLION + 4) ** 2 - (y - CENTER.y) ** 2, 0));
  return [CENTER.x + (i % 2 ? half : -half), y] as const;
});

const at = ([x, y]: Pt) => `translate(${x}px, ${y}px)`;
const HIDDEN = "inset(0 0 100% 0)";
const SHOWN = "inset(0 0 0% 0)";

const setup: SignatureSetup = (svg) => {
  const $ = (selector: string) => svg.querySelector(selector)!;
  const plate = $(".sig-plate");
  const engraving = $(".sig-engr");
  const scan = $(".sig-scan");
  const sweep = $(".sig-sweep");
  const head = $(".sig-head");
  const headIn = $(".sig-head-in");
  const ring = $(".sig-ring");

  return (intro) => {
    // Replay: the engraving fades away first, then the raster runs again, quicker.
    const clear = intro ? 0 : 200;
    const on = intro ? 340 : 140;
    const S = intro ? 480 : 300;
    const D = intro ? 1200 : 1050;
    const E = S + D;
    const T = E + 820;
    const run = (el: Element, stops: readonly Stop[]) => animate(el, track(T, stops), T);
    const o = (opacity: number) => ({ opacity });
    const sweepAt = (x: number, opacity: number) => ({ opacity, transform: `translateX(${x}px)` });

    const keep = intro
      ? [
          run(plate, [
            [0, { opacity: 0, transform: "translateY(14px) scale(0.985)" }, EASE_OUT],
            [440, { opacity: 1, transform: "none" }],
          ]),
        ]
      : [];

    const anims = [
      run(
        engraving,
        intro
          ? [
              [0, { clipPath: HIDDEN, opacity: 1 }],
              [S, { clipPath: HIDDEN, opacity: 1 }],
              [E, { clipPath: SHOWN, opacity: 1 }],
            ]
          : [
              [0, { clipPath: SHOWN, opacity: 1 }, EASE_IN_OUT],
              [clear - 10, { clipPath: SHOWN, opacity: 0 }],
              [clear, { clipPath: HIDDEN, opacity: 1 }],
              [S, { clipPath: HIDDEN, opacity: 1 }],
              [E, { clipPath: SHOWN, opacity: 1 }],
            ],
      ),
      run(scan, [
        [0, { opacity: 0, transform: `translateY(${TOP}px)` }],
        [S - 60, { opacity: 0, transform: `translateY(${TOP}px)` }],
        [S, { opacity: 1, transform: `translateY(${TOP}px)` }],
        [E, { opacity: 1, transform: `translateY(${TOP + HEIGHT}px)` }],
        [E + 180, { opacity: 0, transform: `translateY(${TOP + HEIGHT}px)` }],
      ]),
      // The crosshair zig-zags pass by pass, level with the scan line.
      run(head, [[0, { transform: at(RASTER[0]) }], ...RASTER.map((p, i): Stop => [S + (i * D) / PASSES, { transform: at(p) }])]),
      run(headIn, [[0, o(0)], [on, o(0)], [on + 140, o(1)], [E, o(1)], [E + 200, o(0)]]),
      run(ring, [
        [0, { opacity: 0, transform: "scale(2)" }],
        [on, { opacity: 0, transform: "scale(2)" }, EASE_OUT],
        [on + 320, { opacity: 1, transform: "scale(1)" }],
      ]),
      run(sweep, [
        [0, sweepAt(0, 0)],
        [E + 20, sweepAt(0, 0)],
        [E + 60, sweepAt(0, 1), EASE_IN_OUT],
        [E + 780, sweepAt(PLATE.w + 150, 1)],
        [E + 800, sweepAt(PLATE.w + 150, 0)],
      ]),
    ];
    return { anims, keep, total: T };
  };
};

/** Fine ticks between the two rings, every 15°. */
const TICKS = Array.from({ length: 24 }, (_, k) => {
  const a = (k * Math.PI) / 12;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const r1 = MEDALLION - 5;
  const r2 = MEDALLION - 1.5;
  return `M${(CENTER.x + r1 * c).toFixed(2)} ${(CENTER.y + r1 * s).toFixed(2)}L${(CENTER.x + r2 * c).toFixed(2)} ${(CENTER.y + r2 * s).toFixed(2)}`;
}).join("");

function Grooves() {
  return (
    <>
      <circle cx={CENTER.x} cy={CENTER.y} r={MEDALLION} />
      <circle cx={CENTER.x} cy={CENTER.y} r={MEDALLION - 6} />
      <path d={TICKS} strokeWidth="1" />
      <path d={SQUARE_A} />
      <path d={SQUARE_B} />
      <circle cx={CENTER.x} cy={CENTER.y} r="33" />
    </>
  );
}

function Mark() {
  return (
    <g transform={MARK}>
      <path d={logoPaths.markTop} />
      <path d={logoPaths.markBottom} />
    </g>
  );
}

export function LaserEngrave({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const id = `le${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  useSignature(ref, setup);

  const { x, y, w, h, r } = PLATE;
  return (
    <svg ref={ref} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className={`sig sig-engrave ${className ?? ""}`} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-brass`} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={x + w} y2={y + h}>
          <stop offset="0" stopColor="#f3e5c0" />
          <stop offset="0.4" stopColor="#d4b476" />
          <stop offset="0.63" stopColor="#ead7a6" />
          <stop offset="1" stopColor="#b99352" />
        </linearGradient>
        {/* In plate coordinates, so the cut part carries exactly the sheen of the metal around it. */}
        <linearGradient id={`${id}-sheen`} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={x + w} y2={y + h}>
          <stop offset="0.28" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.46" stopColor="#ffffff" stopOpacity="0.36" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}-brush`} width="480" height="3" patternUnits="userSpaceOnUse">
          <rect width="480" height="1" fill="#ffffff" opacity="0.12" />
        </pattern>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fffaf0" stopOpacity="0.62" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-scan`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f15f22" stopOpacity="0" />
          <stop offset="0.5" stopColor="#f15f22" stopOpacity="0.32" />
          <stop offset="1" stopColor="#f15f22" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ff7a36" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff7a36" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="#3b2a0c" stopOpacity="0.24" />
          <stop offset="1" stopColor="#3b2a0c" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-plate`}>
          <rect x={x} y={y} width={w} height={h} rx={r} />
        </clipPath>
        <clipPath id={`${id}-medallion`}>
          <circle cx={CENTER.x} cy={CENTER.y} r={MEDALLION + 6} />
        </clipPath>
      </defs>

      <g className="sig-plate">
        <ellipse cx={CENTER.x} cy={y + h + 10} rx={w * 0.5} ry="14" fill={`url(#${id}-shadow)`} />
        <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-brass)`} />
        <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-brush)`} />
        <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-sheen)`} />
        <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={r} fill="none" stroke="#9b7a3d" />
        <path d={`M${x + 1.5} ${y + h - r}V${y + r}a${r - 1.5} ${r - 1.5} 0 0 1 ${r - 1.5} ${-(r - 1.5)}H${x + w - r}`} fill="none" stroke="#fffaf0" strokeOpacity="0.8" strokeWidth="1.2" />
        {SCREWS.map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="5.5" fill="#caa865" stroke="#8a6a31" />
            <path d={`M${cx - 3} ${cy + 3}l6 -6`} stroke="#6f5424" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ))}

        {/* Engraving: a light edge below each groove reads as a cut into the metal */}
        <g className="sig-engr">
          <g fill="none" stroke="#fff6dc" strokeOpacity="0.85" strokeWidth="1.2" transform="translate(0.7 0.7)">
            <Grooves />
          </g>
          <g fill="none" stroke="#5c4417" strokeWidth="1.5" strokeLinejoin="round">
            <Grooves />
          </g>
          <g fill="#fff6dc" fillOpacity="0.85" transform="translate(0.7 0.7)">
            <Mark />
          </g>
          <g fill="#5c4417">
            <Mark />
          </g>
        </g>

        {/* Raster line, clipped to the medallion */}
        <g clipPath={`url(#${id}-medallion)`}>
          <g className="sig-scan" style={{ transform: `translateY(${TOP}px)` }}>
            <rect x={CENTER.x - MEDALLION - 8} y="-6" width={(MEDALLION + 8) * 2} height="12" fill={`url(#${id}-scan)`} />
            <rect x={CENTER.x - MEDALLION - 8} y="-0.7" width={(MEDALLION + 8) * 2} height="1.4" fill="#ff8a4c" />
          </g>
        </g>

        {/* Light crossing the fresh engraving */}
        <g clipPath={`url(#${id}-plate)`}>
          <path className="sig-sweep" d={`M${x - 120} ${y}h64l-58 ${h}h-64z`} fill={`url(#${id}-band)`} />
        </g>

        {/* Laser crosshair */}
        <g className="sig-head" style={{ transform: at(RASTER[0]) }}>
          <g className="sig-head-in">
            <circle r="16" fill={`url(#${id}-halo)`} />
            <g className="sig-ring" fill="none" stroke="#f15f22" strokeWidth="1.2" strokeLinecap="round">
              <circle r="7.5" />
              <path d="M0 -10.5V-14M0 10.5V14M-10.5 0H-14M10.5 0H14" />
            </g>
            <circle r="3.4" fill="#ff7a36" />
            <circle r="1.8" fill="#fff7ea" />
          </g>
        </g>
      </g>
    </svg>
  );
}
