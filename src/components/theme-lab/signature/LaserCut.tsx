"use client";

import { useId, useRef } from "react";
import {
  CUTTING_HEAD,
  DIMENSIONS,
  HOLES,
  LEAD_IN,
  LEAD_IN_FROM,
  NEST_VIEW,
  NESTED_CIRCLES,
  NESTED_PART,
  OUTLINE,
  OUTLINE_FROM,
  PIERCE_POINTS,
  pierceCross,
  SHEET_EDGE,
  SLOT,
} from "@/components/service/visuals/nesting-sheet";
import { EASE_IN_OUT, EASE_OUT, animate, at, samplePath, useSignature, type SignatureSetup, type Stop } from "./useSignature";
import "./signature.css";

/*
 * Signature illustration — laser cutting: the Laser Cutting page's nesting
 * sheet (same geometry), animated. The sheet appears and a scan passes once;
 * the nested steel parts draw in; the cutting head activates and cuts the part
 * at a steady feed — each hole and the slot from its pierce point and a short
 * lead-in, then the outer contour from its lead-in — with a small hot point and
 * a faint heat edge that settles. The head then parks where the service page
 * shows it. The markup is the finished sheet (no JavaScript, reduced motion).
 * Decorative: hidden from assistive technology.
 */

type Pt = readonly [number, number];

interface Contour {
  /** The cut, starting where its lead-in meets it. */
  d: string;
  /** Lead-in from the pierce point to the contour. */
  lead: string;
  pierce: Pt;
  start: Pt;
  /** Feed rate in sheet units per ms: small holes are cut slower. */
  feed: number;
  /** Interior cut: its lead-in drops out with the slug once the contour closes. */
  slug: boolean;
}

const hole = ({ cx, cy, r }: (typeof HOLES)[number]): Contour => ({
  d: `M${cx + r} ${cy}a${r} ${r} 0 1 1 ${-2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0`,
  lead: `M${cx} ${cy}H${cx + r}`,
  pierce: [cx, cy],
  start: [cx + r, cy],
  feed: 0.18,
  slug: true,
});

const slot = ((): Contour => {
  const { x, y, width: w, height: h, rx: r } = SLOT;
  const [cx, cy] = [x + w / 2, y + h / 2];
  return {
    d: `M${cx} ${y}h${w / 2 - r}a${r} ${r} 0 0 1 0 ${h}h${-(w - 2 * r)}a${r} ${r} 0 0 1 0 ${-h}Z`,
    lead: `M${cx} ${cy}V${y}`,
    pierce: [cx, cy],
    start: [cx, y],
    feed: 0.2,
    slug: true,
  };
})();

/** Interior contours first, so the part cannot shift, then the outer contour. */
const CONTOURS: Contour[] = [
  hole(HOLES[0]),
  hole(HOLES[1]),
  slot,
  hole(HOLES[2]),
  { d: OUTLINE, lead: LEAD_IN, pierce: LEAD_IN_FROM, start: OUTLINE_FROM, feed: 0.26, slug: false },
];
/** The contour each pierce cross belongs to. */
const CROSS_OF = PIERCE_POINTS.map(([x, y]) => CONTOURS.findIndex((c) => c.pierce[0] === x && c.pierce[1] === y));

const PARK: Pt = [CUTTING_HEAD.cx, CUTTING_HEAD.cy];
/** Dwell while the beam pierces the sheet. */
const PIERCE = 120;
/** Lead-ins are cut slowly, in sheet units per ms. */
const LEAD_FEED = 0.12;
/** The heat tint left along a fresh cut, and where it settles. */
const HEAT_FRESH = 0.55;
const HEAT_REST = 0.3;
/** The trail behind the head, in sheet units: a white-hot tip inside a glow that fades behind it. */
const TRAIL = { tip: 6, "glow-near": 12, "glow-far": 32 } as const;
/** A freshly cut edge, before it cools to the sheet's orange. */
const HOT = "#ff8a3d";
/** Undrawn lines: the dash ends just short of the path, so no line cap shows at its start. */
const HIDE = 1.05;

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** Rapid traverse between cuts, beam off. */
const travel = (a: Pt, b: Pt) => 120 + dist(a, b) * 1.4;

const setup: SignatureSetup = (root) => {
  const $ = (selector: string) => root.querySelector(selector)!;
  const $$ = (selector: string) => [...root.querySelectorAll(selector)];
  const sheet = $(".sig-sheet");
  const edge = $(".sig-edge");
  const parts = $$(".sig-part");
  const dims = $(".sig-dims");
  const preview = $(".sig-preview");
  const scan = $(".sig-scan");
  const work = $(".sig-work");
  const head = $(".sig-head");
  const ring = $(".sig-ring");
  const hot = $(".sig-hot");
  const flash = $(".sig-flash");
  const crosses = $$(".sig-pierce");
  const cool = getComputedStyle($(".sig-kerf")).stroke;
  const cuts = CONTOURS.map((_, i) => ({
    kerf: $(`.sig-kerf > [data-c="${i}"]`),
    heat: $(`.sig-heat > [data-c="${i}"]`),
    trail: $(`.sig-trail > [data-c="${i}"]`),
    leads: $$(`[data-c="${i}"] > .sig-lead`),
    paths: $$(`:is(.sig-heat, .sig-kerf) > [data-c="${i}"] > .sig-path`),
    marks: (Object.keys(TRAIL) as (keyof typeof TRAIL)[]).map((key) => [key, $(`.sig-trail > [data-c="${i}"] > .sig-${key}`)] as const),
    cut: $(`.sig-kerf > [data-c="${i}"] > .sig-path`) as SVGGeometryElement,
  }));
  const lengths = cuts.map(({ cut }) => cut.getTotalLength());
  const routes = cuts.map(({ cut }) => samplePath(cut, 3));

  return (intro) => {
    // Intro: sheet, scan and nested parts, then the cut. Replay: the finished cut clears, then the same cut.
    const begin = intro ? 1100 : 560;
    let t = begin;
    let pos: Pt = PARK;
    const plan = CONTOURS.map((c, i) => {
      const t0 = t;
      const tp = t0 + travel(pos, c.pierce);
      const tl = tp + PIERCE;
      const tc = tl + dist(c.pierce, c.start) / LEAD_FEED;
      const te = tc + lengths[i] / c.feed;
      pos = c.start;
      t = te;
      return { t0, tp, tl, tc, te };
    });
    const last = plan[plan.length - 1];
    const parked = last.te + travel(pos, PARK);
    const T = Math.max(parked, last.te + 1000);

    const run = (el: Element, stops: readonly Stop[]) => animate(el, T, stops);
    const o = (opacity: number) => ({ opacity });
    const dash = (offset: number, array = "1 1.1") => ({ strokeDasharray: array, strokeDashoffset: offset });
    const draw = (el: Element, from: number, to: number, easing?: string) =>
      run(el, [...(intro ? [] : [[0, dash(0)], [240, dash(HIDE)]] as Stop[]), [from - 1, dash(HIDE)], [from, dash(1), easing], [to, dash(0)]]);

    const keep = intro
      ? [
          run(sheet, [
            [0, { opacity: 0, transform: "translateY(12px)" }, EASE_OUT],
            [560, { opacity: 1, transform: "none" }],
          ]),
          // One scan pass over the sheet as it appears.
          run(scan, [
            [200, { opacity: 0, transform: "translateY(-30px)" }],
            [280, { opacity: 1, transform: "translateY(-22px)" }, EASE_IN_OUT],
            [1000, { opacity: 1, transform: `translateY(${NEST_VIEW.h}px)` }],
            [1080, { opacity: 0, transform: `translateY(${NEST_VIEW.h + 6}px)` }],
          ]),
          run(edge, [[240, o(0)], [560, o(1)]]),
          ...parts.map((part, k) => draw(part, 340 + k * 100, 880 + k * 100, EASE_OUT)),
          run(dims, [[620, o(0)], [900, o(1)]]),
          run(preview, [[700, o(0)], [1000, o(1)]]),
        ]
      : [];

    // The head: traverse, pierce, lead-in, then the contour at its feed rate; finally back to its park position.
    const path: Stop[] = [[0, { transform: at(PARK) }]];
    let from: Pt = PARK;
    plan.forEach((p, i) => {
      const c = CONTOURS[i];
      path.push([p.t0, { transform: at(from) }, EASE_IN_OUT], [p.tp, { transform: at(c.pierce) }], [p.tl, { transform: at(c.pierce) }], [p.tc, { transform: at(c.start) }]);
      const route = routes[i];
      route.forEach((pt, k) => path.push([p.tc + ((p.te - p.tc) * k) / (route.length - 1), { transform: at(pt) }]));
      from = c.start;
    });
    path.push([last.te, { transform: at(from) }, EASE_IN_OUT], [parked, { transform: at(PARK) }]);

    const beam: Stop[] = [[0, o(0)]];
    const flashes: Stop[] = [[0, { opacity: 0, transform: "scale(0.4)" }]];
    plan.forEach((p) => {
      beam.push([p.tp - 10, o(0)], [p.tp + 40, o(1)], [p.te, o(1)], [p.te + 70, o(0)]);
      flashes.push(
        [p.tp, { opacity: 0, transform: "scale(0.4)" }, EASE_OUT],
        [p.tp + 60, { opacity: 0.9, transform: "scale(1)" }, EASE_OUT],
        [p.tp + 340, { opacity: 0, transform: "scale(1.7)" }],
      );
    });

    const anims = [
      ...(intro ? [] : [run(work, [[0, o(1)], [200, o(0)], [250, o(0)], [270, o(1)]])]),
      run(
        ring,
        intro
          ? [
              [begin - 340, { opacity: 0, transform: "scale(1.9)" }, EASE_OUT],
              [begin - 60, { opacity: 1, transform: "scale(1)" }],
            ]
          : [
              [0, { opacity: 1, transform: "scale(1)" }, EASE_OUT],
              [220, { opacity: 1, transform: "scale(1.3)" }, EASE_IN_OUT],
              [480, { opacity: 1, transform: "scale(1)" }],
            ],
      ),
      run(head, path),
      run(hot, beam),
      run(flash, flashes),
      // Pierce points: marked on the programme, lit as the beam pierces.
      ...crosses.map((cross, k) => {
        const p = plan[CROSS_OF[k]];
        const lead: Stop[] = intro ? [[700, o(0)], [1000, o(0.4)]] : [[0, o(1)], [220, o(0.4)]];
        return run(cross, [...lead, [p.tp + 30, o(0.4)], [p.tp + 110, o(1)]]);
      }),
      ...cuts.flatMap(({ kerf, heat, trail, leads, paths, marks }, i) => {
        const p = plan[i];
        return [
          // A hot orange that cools to the sheet's orange.
          run(kerf, [...(intro ? [] : [[0, { stroke: cool }], [240, { stroke: HOT }]] as Stop[]), [p.tl, { stroke: HOT }], [p.te, { stroke: HOT }], [p.te + 1000, { stroke: cool }]]),
          // The heat tint along the fresh cut settles.
          run(heat, [...(intro ? [] : [[0, o(HEAT_REST)], [240, o(HEAT_FRESH)]] as Stop[]), [p.te, o(HEAT_FRESH)], [p.te + 1000, o(HEAT_REST)]]),
          ...leads.map((el) => draw(el, p.tl, p.tc)),
          ...paths.map((el) => draw(el, p.tc, p.te)),
          // An interior lead-in drops out with its slug.
          ...(CONTOURS[i].slug ? leads.map((el) => run(el, [...(intro ? [] : [[0, o(0)], [240, o(1)]] as Stop[]), [p.te + 80, o(1)], [p.te + 420, o(0)]])) : []),
          // The trail follows the head along the contour: each mark is a dash of its length, just behind the cut front.
          ...marks.map(([key, el]) => {
            const share = TRAIL[key] / lengths[i];
            return run(el, [[p.tc, dash(share, `${share} 2`)], [p.te, dash(share - 1, `${share} 2`)]]);
          }),
          run(trail, [[p.tc - 1, o(0)], [p.tc, o(1)], [p.te, o(1)], [p.te + 220, o(0)]]),
        ];
      }),
    ];

    const outline = plan[plan.length - 1];
    return {
      anims,
      keep,
      total: T,
      moments: { initial: begin - 20, active: outline.tc + (outline.te - outline.tc) * 0.5 },
    };
  };
};

export function LaserCut({ className = "", freeze }: { className?: string; freeze?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = `lc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  useSignature(ref, setup, { freeze });

  const cutLayer = (layer: string) => (
    <g className={layer}>
      {CONTOURS.map((c, i) => (
        <g key={c.d} data-c={i}>
          <path className={c.slug ? "sig-lead sig-slug" : "sig-lead"} d={c.lead} pathLength={1} />
          <path className="sig-path" d={c.d} pathLength={1} />
        </g>
      ))}
    </g>
  );

  return (
    <div ref={ref} className={`sig sig-cut ${className}`} aria-hidden>
      <div className="sig-sheet">
        <svg viewBox={`0 0 ${NEST_VIEW.w} ${NEST_VIEW.h}`} fill="none" focusable="false">
          <defs>
            <radialGradient id={`${id}-halo`}>
              <stop offset="0" stopColor="#ffb25a" stopOpacity="0.95" />
              <stop offset="0.4" stopColor="#ff7424" stopOpacity="0.5" />
              <stop offset="1" stopColor="#ff7424" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-flash`}>
              <stop offset="0" stopColor="#fff0d2" stopOpacity="0.95" />
              <stop offset="0.45" stopColor="#ff8a3d" stopOpacity="0.6" />
              <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-trail`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f15f22" stopOpacity="0" />
              <stop offset="1" stopColor="#f15f22" stopOpacity="0.14" />
            </linearGradient>
            <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f15f22" stopOpacity="0" />
              <stop offset="0.12" stopColor="#f15f22" stopOpacity="0.6" />
              <stop offset="0.88" stopColor="#f15f22" stopOpacity="0.6" />
              <stop offset="1" stopColor="#f15f22" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Sheet edge and nested parts (steel) */}
          <g className="sig-nest">
            <rect className="sig-edge" {...SHEET_EDGE} strokeDasharray="3 4" />
            <path className="sig-part" d={NESTED_PART} pathLength={1} />
            {NESTED_CIRCLES.map((c) => (
              <circle key={`${c.cx}-${c.r}`} className="sig-part" {...c} pathLength={1} />
            ))}
          </g>
          {/* Dimension rules over the part (no values) */}
          <g className="sig-dims">
            {DIMENSIONS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          {/* The programmed cut, faint until the beam passes */}
          <g className="sig-preview">
            {CONTOURS.map((c) => (
              <path key={c.d} d={c.slug ? c.d : `${c.lead}${c.d}`} />
            ))}
          </g>
          {/* Heat tint, the cut, and the glowing trail behind the head */}
          <g className="sig-work">
            {cutLayer("sig-heat")}
            {cutLayer("sig-kerf")}
            <g className="sig-trail">
              {CONTOURS.map((c, i) => (
                <g key={c.d} data-c={i}>
                  {(Object.keys(TRAIL) as (keyof typeof TRAIL)[]).reverse().map((key) => (
                    <path key={key} className={`sig-${key}`} d={c.d} pathLength={1} />
                  ))}
                </g>
              ))}
            </g>
          </g>
          {/* Pierce points */}
          <g className="sig-pierces">
            {PIERCE_POINTS.map((p) => (
              <path key={p.join()} className="sig-pierce" d={pierceCross(p)} />
            ))}
          </g>
          {/* One scan pass as the sheet appears */}
          <g className="sig-scan">
            <rect x="0" y="-22" width={NEST_VIEW.w} height="22" fill={`url(#${id}-trail)`} />
            <rect x="0" y="-0.35" width={NEST_VIEW.w} height="0.7" fill={`url(#${id}-line)`} />
          </g>
          {/* Cutting head: crosshair, hot point and pierce flash */}
          <g className="sig-head" style={{ transform: at(PARK) }}>
            <circle className="sig-flash" r="7" fill={`url(#${id}-flash)`} />
            <g className="sig-hot">
              <circle r="8" fill={`url(#${id}-halo)`} />
              <circle className="sig-core" r="1.9" />
            </g>
            <g className="sig-ring">
              <circle r={CUTTING_HEAD.r} />
              <path d={CUTTING_HEAD.ticks} transform={`translate(${-PARK[0]} ${-PARK[1]})`} />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
