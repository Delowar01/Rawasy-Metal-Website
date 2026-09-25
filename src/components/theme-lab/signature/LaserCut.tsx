"use client";

import { useId, useRef } from "react";
import { closedPath, star, type Pt } from "./geometry";
import { EASE_IN_OUT, EASE_OUT, animate, track, useSignature, type SignatureSetup, type Stop } from "./useSignature";
import "./signature.css";

/*
 * Signature illustration — laser cutting. A steel plate; the laser head
 * appears, follows the eight-point star at a constant feed rate with a hot
 * kerf, glow and sparks, then the cut part lifts out of the plate and the edge
 * cools to a heat tint. About 2.5 s on first view, shorter on replay, never
 * looped. Decorative: hidden from assistive technology.
 */

const VIEW = { w: 480, h: 300 };
const PLATE = { x: 72, y: 46, w: 336, h: 208, r: 18 };
const CENTER = { x: 240, y: 150 };
const STAR = star(CENTER.x, CENTER.y, 72);
const STAR_D = closedPath(STAR);
const HOLES: Pt[] = [
  [PLATE.x + 24, PLATE.y + 24],
  [PLATE.x + PLATE.w - 24, PLATE.y + 24],
  [PLATE.x + PLATE.w - 24, PLATE.y + PLATE.h - 24],
  [PLATE.x + 24, PLATE.y + PLATE.h - 24],
];
/** Sparks: angle (deg) and length, thrown from the cutting point. */
const SPARKS: [number, number][] = [
  [196, 15],
  [228, 20],
  [256, 12],
  [292, 17],
  [326, 11],
  [18, 14],
  [142, 18],
  [104, 12],
];
const LIFTED = "translate(-7px, -9px) rotate(-5deg) scale(1.035)";
/** Kerf colours: the line behind the head is white-hot, the cut orange, the finished edge a cooled heat tint. */
const HOT = "#ff7a2e";
const COOL = "#b86d3e";
const TIP = 0.045;

const at = ([x, y]: Pt) => `translate(${x}px, ${y}px)`;

const setup: SignatureSetup = (svg) => {
  const $ = (selector: string) => svg.querySelector(selector)!;
  const plate = $(".sig-plate");
  const hole = $(".sig-hole");
  const heat = $(".sig-heat");
  const rim = $(".sig-rim");
  const piece = $(".sig-piece");
  const edges = [...svg.querySelectorAll(".sig-edge")];
  const guide = $(".sig-guide");
  const glow = $(".sig-glow");
  const core = $(".sig-core");
  const tip = $(".sig-tip");
  const head = $(".sig-head");
  const headIn = $(".sig-head-in");
  const ring = $(".sig-ring");
  const sparks = [...svg.querySelectorAll(".sig-spark")];

  return (intro) => {
    // Intro: the plate enters, the head arms, the cut runs. Replay: the part drops back in, then the same cut, quicker.
    const close = intro ? 0 : 240;
    const on = intro ? 360 : 180;
    const S = intro ? 480 : 340;
    const D = intro ? 1150 : 950;
    const E = S + D;
    const T = E + 860;
    const run = (el: Element, stops: readonly Stop[]) => animate(el, track(T, stops), T);
    const o = (opacity: number) => ({ opacity });
    const dash = (strokeDashoffset: number) => ({ strokeDashoffset });

    const keep = intro
      ? [
          run(plate, [
            [0, { opacity: 0, transform: "translateY(14px) scale(0.985)" }, EASE_OUT],
            [440, { opacity: 1, transform: "none" }],
          ]),
        ]
      : [];

    const reopen = (from: number): Stop[] => (intro ? [[0, o(0)]] : [[0, o(from)], [close - 40, o(from)], [close, o(0)]]);

    const anims = [
      run(piece, [
        ...(intro ? [] : [[0, { transform: LIFTED }, EASE_IN_OUT] as Stop]),
        [close, { transform: "none" }],
        [E + 100, { transform: "none" }, EASE_OUT],
        [E + 680, { transform: LIFTED }],
      ]),
      // The part's own edges only show once it separates, so the plate reads as uncut before the laser passes.
      ...edges.map((edge) => run(edge, [...reopen(1), [E + 80, o(0)], [E + 320, o(1)]])),
      run(hole, [...reopen(1), [E, o(0)], [E + 90, o(1)]]),
      run(heat, [...reopen(0.35), [E, o(0)], [E + 90, o(1)], [E + 860, o(0.35)]]),
      // The edge left in the plate: hot as the part lifts, cooling to a heat tint.
      run(rim, [
        ...(intro ? [] : [[0, { ...o(1), stroke: COOL }], [close - 40, { ...o(1), stroke: COOL }]] as Stop[]),
        [close, { ...o(0), stroke: HOT }],
        [E - 40, { ...o(0), stroke: HOT }],
        [E + 60, { ...o(1), stroke: HOT }],
        [E + 860, { ...o(1), stroke: COOL }],
      ]),
      run(guide, [[0, o(0)], [on, o(0)], [on + 220, o(0.75)], [E - 80, o(0.75)], [E + 120, o(0)]]),
      run(glow, [[0, { ...o(0), ...dash(1) }], [S, { ...o(1), ...dash(1) }], [E, { ...o(1), ...dash(0) }], [E + 260, { ...o(0), ...dash(0) }]]),
      run(core, [
        [0, { ...o(0), ...dash(1), stroke: HOT }],
        [S, { ...o(1), ...dash(1), stroke: HOT }],
        [E, { ...o(1), ...dash(0), stroke: HOT }],
        [E + 300, { ...o(0), ...dash(0), stroke: COOL }],
      ]),
      // A short white-hot segment trails the head.
      run(tip, [[0, { ...o(0), ...dash(TIP) }], [S, { ...o(1), ...dash(TIP) }], [E, { ...o(1), ...dash(TIP - 1) }], [E + 120, { ...o(0), ...dash(TIP - 1) }]]),
      // The head follows the star at a constant feed rate: one keyframe per corner, in step with the kerf.
      run(head, [[0, { transform: at(STAR[0]) }], ...[...STAR, STAR[0]].map((p, k): Stop => [S + (k * D) / 16, { transform: at(p) }]), [E, { transform: at(STAR[0]) }]]),
      run(headIn, [[0, o(0)], [on, o(0)], [on + 140, o(1)], [E, o(1)], [E + 220, o(0)]]),
      run(ring, [
        [0, { opacity: 0, transform: "scale(2.2)" }],
        [on, { opacity: 0, transform: "scale(2.2)" }, EASE_OUT],
        [on + 340, { opacity: 1, transform: "scale(1)" }],
        [E, { opacity: 0.55, transform: "scale(1)" }],
        [E + 220, { opacity: 0, transform: "scale(0.6)" }],
      ]),
      ...sparks.map((spark, i) => {
        // Each spark flies outward on its own short cycle while the cut runs.
        const cycle = 170 + ((i * 47) % 110);
        const stops: Stop[] = [[0, { ...o(0), ...dash(0.4) }]];
        for (let t = S + ((i * 61) % cycle); t + cycle <= E; t += cycle) {
          stops.push([t, { ...o(0), ...dash(0.4) }], [t + cycle * 0.2, { ...o(1), ...dash(0.1) }], [t + cycle, { ...o(0), ...dash(-0.6) }]);
        }
        return run(spark, stops);
      }),
    ];
    return { anims, keep, total: T };
  };
};

export function LaserCut({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const id = `lc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  useSignature(ref, setup);

  const { x, y, w, h, r } = PLATE;
  return (
    <svg ref={ref} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className={`sig sig-cut ${className ?? ""}`} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-metal`} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={x + w} y2={y + h}>
          <stop offset="0" stopColor="#e6eaf0" />
          <stop offset="0.4" stopColor="#b5bfcb" />
          <stop offset="0.63" stopColor="#d2d8e0" />
          <stop offset="1" stopColor="#9aa5b3" />
        </linearGradient>
        {/* In plate coordinates, so the cut part carries exactly the sheen of the metal around it. */}
        <linearGradient id={`${id}-sheen`} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={x + w} y2={y + h}>
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.47" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}-brush`} width="480" height="3" patternUnits="userSpaceOnUse">
          <rect width="480" height="1" fill="#ffffff" opacity="0.1" />
        </pattern>
        <radialGradient id={`${id}-heat`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#f15f22" stopOpacity="0" />
          <stop offset="0.82" stopColor="#f15f22" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ff9a5c" stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ff7a36" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ff7a36" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.32" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="sig-plate">
        <ellipse cx={CENTER.x} cy={y + h + 10} rx={w * 0.52} ry="16" fill={`url(#${id}-shadow)`} />
        <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-metal)`} />
        <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-brush)`} />
        <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-sheen)`} />
        <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={r} fill="none" stroke="#7d8898" />
        <path d={`M${x + 1.5} ${y + h - r}V${y + r}a${r - 1.5} ${r - 1.5} 0 0 1 ${r - 1.5} ${-(r - 1.5)}H${x + w - r}`} fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.2" />
        {HOLES.map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="5.5" fill="#152031" />
            <path d={`M${cx - 4.6} ${cy + 3}a5.5 5.5 0 0 0 9.2 0`} fill="none" stroke="#ffffff" strokeOpacity="0.55" />
          </g>
        ))}

        {/* The through-cut and the heat tint of its edge */}
        <path className="sig-hole" d={STAR_D} fill="#0b1220" />
        <path className="sig-heat" d={STAR_D} fill={`url(#${id}-heat)`} />
        <path className="sig-rim" d={STAR_D} fill="none" stroke={COOL} strokeWidth="2" strokeLinejoin="round" />

        {/* The cut part */}
        <g className="sig-piece">
          <path d={STAR_D} fill={`url(#${id}-metal)`} />
          <path d={STAR_D} fill={`url(#${id}-brush)`} />
          <path d={STAR_D} fill={`url(#${id}-sheen)`} />
          <path className="sig-edge" d={STAR_D} fill="none" stroke="#6f7b8b" strokeLinejoin="round" />
          <path className="sig-edge" d={STAR_D} fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.1" strokeLinejoin="round" transform="translate(0.6 0.6)" />
        </g>

        {/* Kerf: planned path, glow and hot line */}
        <path className="sig-guide" d={STAR_D} fill="none" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 5" />
        <path className="sig-glow sig-draw" d={STAR_D} pathLength={1} fill="none" stroke="#ff5a1f" strokeOpacity="0.3" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        <path className="sig-core sig-draw" d={STAR_D} pathLength={1} fill="none" stroke={HOT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path className="sig-tip" d={STAR_D} pathLength={1} fill="none" stroke="#fff4e8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

        {/* Laser head */}
        <g className="sig-head" style={{ transform: at(STAR[0]) }}>
          <g className="sig-head-in">
            <circle r="22" fill={`url(#${id}-halo)`} />
            <circle className="sig-ring" r="10.5" fill="none" stroke="#ff7a36" strokeWidth="1.2" />
            {SPARKS.map(([deg, len]) => {
              const a = (deg * Math.PI) / 180;
              const [c, s] = [Math.cos(a), Math.sin(a)];
              return (
                <path
                  key={deg}
                  className="sig-spark"
                  d={`M${(5 * c).toFixed(2)} ${(5 * s).toFixed(2)}L${((5 + len) * c).toFixed(2)} ${((5 + len) * s).toFixed(2)}`}
                  pathLength={1}
                  stroke="#ff9442"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              );
            })}
            <circle r="5" fill="#ff8c4a" />
            <circle r="2.4" fill="#fff7ea" />
          </g>
        </g>
      </g>
    </svg>
  );
}
