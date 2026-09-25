"use client";

import { useId, useRef } from "react";
import { BORDER_INNER, BORDER_OUTER, CORNER_MARKS, ENGRAVED_LINES, LASER_MARK, LINE_X, linePath, PLATE_VIEW, ROSETTE } from "@/components/service/visuals/engraved-plate";
import { EASE_IN_OUT, EASE_OUT, animate, at, samplePath, useSignature, type SignatureSetup, type Stop } from "./useSignature";
import "./signature.css";

/*
 * Signature illustration — laser engraving: the Laser Engraving page's brass
 * plate (same artwork), engraved by the laser. The plate appears and its
 * reflection settles; the crosshair activates and moves to the start, then
 * engraves the double border and corner marks, the block of lines and the
 * guilloche rosette. Each groove is drawn twice (shadow and highlight) so it
 * reads as cut into the metal. Light crosses the finished grooves and the laser
 * switches off on its rest mark, where the service page shows it. A layout, not
 * real text: no brands, part or serial numbers. The markup is the finished
 * plate (no JavaScript, reduced motion). Decorative: hidden from assistive
 * technology.
 */

type Pt = readonly [number, number];

const CORNERS = CORNER_MARKS.split("M")
  .filter(Boolean)
  .map((d) => `M${d}`);
const R = ROSETTE.ring;
/** The outer ring, drawn from its top — the laser's rest mark — clockwise. */
const RING = `M0 ${-R}a${R} ${R} 0 1 1 0 ${2 * R}a${R} ${R} 0 1 1 0 ${-2 * R}`;
const REST: Pt = [LASER_MARK.x, LASER_MARK.y];
const CENTRE: Pt = [ROSETTE.x, ROSETTE.y];

/** Engraving speed on the line block, in plate units per ms. */
const LINE_FEED = 1;
/** Border (both lines together) and ring, in ms. */
const BORDER = 1000;
const RING_TIME = 720;
/** The rosette's ellipses start one after another as the head works round it. */
const OUTER_STEP = 18;
const OUTER_DRAW = 640;
const INNER_STEP = 18;
const INNER_DRAW = 480;
const BOSS_TIME = 240;
/** Undrawn grooves: the dash ends just short of the path, so nothing shows at its start. */
const HIDE = 1.05;

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** A jump between grooves, beam off. */
const hop = (a: Pt, b: Pt) => 50 + dist(a, b) * 0.3;
const onRosette = (r: number, deg: number): Pt => [CENTRE[0] + r * Math.cos((deg * Math.PI) / 180), CENTRE[1] + r * Math.sin((deg * Math.PI) / 180)];
/** Where along the outer border (clockwise from its top-left corner) the head passes a corner mark. */
const cornerShare = (d: string) => {
  const [x, y] = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  const { width: w, height: h } = BORDER_OUTER;
  const left = x < PLATE_VIEW.w / 2;
  const s = y < PLATE_VIEW.h / 2 ? (left ? 0 : w) : left ? 2 * w + h : w + h;
  return s / (2 * (w + h));
};

const setup: SignatureSetup = (root) => {
  const $ = (selector: string) => root.querySelector(selector)!;
  const $$ = (selector: string) => [...root.querySelectorAll(selector)];
  const plate = $(".sig-plate");
  const reflect = $(".sig-reflect");
  const sweep = $(".sig-sweep");
  const layers = $$(".sig-engr");
  const dots = $$(".sig-dots");
  const head = $(".sig-head");
  const ring = $(".sig-ring");
  const restBeam = $(".sig-beam-rest");
  const on = $(".sig-on");
  const g = (key: string) => $$(`[data-g="${key}"]`);
  const border = samplePath($('.sig-engr-cut [data-g="bo"]') as SVGGeometryElement, 6);
  const ringPath = samplePath($('.sig-engr-cut [data-g="ring"]') as SVGGeometryElement, 6).map(([x, y]): Pt => [x + CENTRE[0], y + CENTRE[1]]);
  const bossPath = samplePath($('.sig-engr-cut [data-g="boss"]') as SVGGeometryElement, 2).map(([x, y]): Pt => [x + CENTRE[0], y + CENTRE[1]]);
  const dir = root.closest("[dir]")?.getAttribute("dir") === "rtl" ? -1 : 1;
  const { outer, inner } = ROSETTE;

  return (intro) => {
    // Intro: the plate and its reflection, then the laser. Replay: the grooves clear, then the same engraving.
    const leave = intro ? 920 : 420;
    const start = leave + hop(REST, border[0]) + 180;
    const borderEnd = start + BORDER;

    let t = borderEnd;
    let pos: Pt = border[border.length - 1];
    const lines = ENGRAVED_LINES.map((l) => {
      const a: Pt = [LINE_X, l.y];
      const b: Pt = [LINE_X + l.w, l.y];
      const t0 = t;
      const ta = t0 + hop(pos, a);
      const tb = ta + l.w / LINE_FEED;
      pos = b;
      t = tb;
      return { a, b, t0, ta, tb };
    });

    const outerPts = outer.angles.map((a) => onRosette(outer.rx, a));
    const innerPts = inner.angles.map((a) => onRosette(inner.rx, a));
    const rosetteFrom = t;
    const outerAt = outerPts.map((_, i) => rosetteFrom + hop(pos, outerPts[0]) + i * OUTER_STEP);
    const outerEnd = outerAt[outerAt.length - 1] + OUTER_STEP;
    const innerAt = innerPts.map((_, i) => outerEnd + hop(outerPts[outerPts.length - 1], innerPts[0]) + i * INNER_STEP);
    const innerEnd = innerAt[innerAt.length - 1] + INNER_STEP;
    const bossStart = innerEnd + hop(innerPts[innerPts.length - 1], bossPath[0]);
    const bossEnd = bossStart + BOSS_TIME;
    const ringStart = bossEnd + hop(bossPath[0], REST);
    const ringEnd = ringStart + RING_TIME;
    const off = ringEnd + 60;
    const light = off + 140;
    const T = light + 860;

    const run = (el: Element, stops: readonly Stop[]) => animate(el, T, stops);
    const o = (opacity: number) => ({ opacity });
    const dash = (offset: number) => ({ strokeDasharray: "1 1.1", strokeDashoffset: offset });
    const reset: Stop[] = intro ? [] : [[0, dash(0)], [240, dash(HIDE)]];
    const draw = (key: string, from: number, to: number) => g(key).map((el) => run(el, [...reset, [from - 1, dash(HIDE)], [from, dash(1)], [to, dash(0)]]));
    const trace = (pts: readonly Pt[], from: number, to: number): Stop[] => pts.map((p, k) => [from + ((to - from) * k) / (pts.length - 1), { transform: at(p) }]);

    const keep = intro
      ? [
          run(plate, [
            [0, { opacity: 0, transform: "translateY(12px) scale(0.985)" }, EASE_OUT],
            [460, { opacity: 1, transform: "none" }],
          ]),
          // The surface reflection glides across and settles into the plate's sheen.
          run(reflect, [
            [120, { opacity: 0, transform: `translateX(${-45 * dir}%)` }, EASE_OUT],
            [380, { opacity: 0.9, transform: `translateX(${-18 * dir}%)` }, EASE_OUT],
            [1100, { opacity: 0, transform: `translateX(${14 * dir}%)` }],
          ]),
        ]
      : [];

    const path: Stop[] = [
      [0, { transform: at(REST) }],
      [leave, { transform: at(REST) }, EASE_IN_OUT],
      [start, { transform: at(border[0]) }],
      ...trace(border, start, borderEnd),
    ];
    lines.forEach(({ a, b, t0, ta, tb }, i) => {
      path.push([t0, { transform: at(i ? lines[i - 1].b : border[border.length - 1]) }, EASE_IN_OUT], [ta, { transform: at(a) }], [tb, { transform: at(b) }]);
    });
    path.push(
      [rosetteFrom, { transform: at(pos) }, EASE_IN_OUT],
      ...outerPts.map((p, i): Stop => [outerAt[i], { transform: at(p) }]),
      [outerEnd, { transform: at(outerPts[outerPts.length - 1]) }, EASE_IN_OUT],
      ...innerPts.map((p, i): Stop => [innerAt[i], { transform: at(p) }]),
      [innerEnd, { transform: at(innerPts[innerPts.length - 1]) }, EASE_IN_OUT],
      ...trace(bossPath, bossStart, bossEnd),
      [bossEnd, { transform: at(bossPath[bossPath.length - 1]) }, EASE_IN_OUT],
      ...trace(ringPath, ringStart, ringEnd),
    );

    // Beam on while engraving, off for the jumps between grooves.
    const beam: Stop[] = [[0, o(0)], [start - 20, o(0)], [start + 40, o(1)], [borderEnd, o(1)], [borderEnd + 50, o(0)]];
    lines.forEach(({ ta, tb }) => beam.push([ta - 20, o(0)], [ta + 20, o(1)], [tb, o(1)], [tb + 40, o(0)]));
    beam.push(
      [outerAt[0] - 20, o(0)],
      [outerAt[0] + 20, o(1)],
      [innerEnd, o(1)],
      [innerEnd + 40, o(0)],
      [bossStart - 20, o(0)],
      [bossStart + 20, o(1)],
      [bossEnd, o(1)],
      [bossEnd + 40, o(0)],
      [ringStart - 20, o(0)],
      [ringStart + 20, o(1)],
      [ringEnd, o(1)],
      [off, o(0)],
    );

    const anims = [
      ...(intro ? [] : layers.map((layer) => run(layer, [[0, o(1)], [200, o(0)], [250, o(0)], [270, o(1)]]))),
      run(
        ring,
        intro
          ? [
              [650, { opacity: 0, transform: "scale(1.8)" }, EASE_OUT],
              [900, { opacity: 1, transform: "scale(1)" }],
            ]
          : [
              [0, { opacity: 1, transform: "scale(1)" }, EASE_OUT],
              [200, { opacity: 1, transform: "scale(1.3)" }, EASE_IN_OUT],
              [420, { opacity: 1, transform: "scale(1)" }],
            ],
      ),
      // The dashed beam of the resting laser: on while it waits, off while it works.
      run(restBeam, [...(intro ? [[650, o(0)], [900, o(0.8)]] : [[0, o(0.8)]]) as Stop[], [leave, o(0.8)], [leave + 120, o(0)], [off, o(0)], [off + 220, o(0.8)]]),
      run(head, path),
      run(on, beam),
      ...draw("bo", start, borderEnd),
      ...draw("bi", start, borderEnd),
      ...CORNERS.flatMap((d, i) => {
        const at0 = start + cornerShare(d) * BORDER;
        return draw(`c${i}`, at0, at0 + 170);
      }),
      ...lines.flatMap(({ ta, tb }, i) => draw(`l${i}`, ta, tb)),
      ...outerAt.flatMap((t0, i) => draw(`e${i}`, t0, t0 + OUTER_DRAW)),
      ...innerAt.flatMap((t0, i) => draw(`f${i}`, t0, t0 + INNER_DRAW)),
      ...draw("boss", bossStart, bossEnd),
      ...draw("ring", ringStart, ringEnd),
      ...dots.map((el) => run(el, [...(intro ? [] : [[0, o(1)], [220, o(0)]] as Stop[]), [ringStart, o(0)], [ringEnd, o(1)]])),
      // Light crosses the finished grooves.
      run(sweep, [
        [light, { transform: `translateX(${-100 * dir}%)` }, EASE_IN_OUT],
        [light + 820, { transform: `translateX(${100 * dir}%)` }],
      ]),
      run(sweep, [[light, o(0)], [light + 120, o(1)], [light + 700, o(1)], [light + 820, o(0)]]),
    ];

    return { anims, keep, total: T, moments: { initial: 940, active: innerAt[Math.floor(innerAt.length / 2)] } };
  };
};

function Grooves() {
  const { outer, inner } = ROSETTE;
  return (
    <>
      <rect data-g="bo" {...BORDER_OUTER} pathLength={1} />
      <rect data-g="bi" {...BORDER_INNER} pathLength={1} />
      {CORNERS.map((d, i) => (
        <path key={d} data-g={`c${i}`} d={d} pathLength={1} />
      ))}
      {ENGRAVED_LINES.map((l, i) => (
        <path key={l.y} data-g={`l${i}`} d={linePath(l)} strokeWidth={l.h} pathLength={1} />
      ))}
      <g transform={`translate(${ROSETTE.x} ${ROSETTE.y})`}>
        <path data-g="ring" d={RING} pathLength={1} />
        <circle className="sig-dots" r={ROSETTE.dotted} strokeDasharray="1.5 3" />
        {outer.angles.map((a, i) => (
          <ellipse key={`o${a}`} data-g={`e${i}`} rx={outer.rx} ry={outer.ry} transform={`rotate(${a})`} pathLength={1} />
        ))}
        {inner.angles.map((a, i) => (
          <ellipse key={`i${a}`} data-g={`f${i}`} rx={inner.rx} ry={inner.ry} transform={`rotate(${a})`} pathLength={1} />
        ))}
        <circle data-g="boss" r={ROSETTE.boss} pathLength={1} />
      </g>
    </>
  );
}

export function LaserEngrave({ className = "", freeze }: { className?: string; freeze?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = `le${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  useSignature(ref, setup, freeze);

  return (
    <div ref={ref} className={`sig sig-engrave ${className}`} aria-hidden>
      <div className="sig-plate">
        <span className="sig-rivets" />
        <svg className="sig-art" viewBox={`0 0 ${PLATE_VIEW.w} ${PLATE_VIEW.h}`} fill="none" focusable="false">
          <defs>
            <radialGradient id={`${id}-halo`}>
              <stop offset="0" stopColor="#ffb25a" stopOpacity="0.95" />
              <stop offset="0.4" stopColor="#ff7424" stopOpacity="0.45" />
              <stop offset="1" stopColor="#ff7424" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-beam`} gradientUnits="userSpaceOnUse" x1="0" y1="-60" x2="0" y2="-3">
              <stop offset="0" stopColor="#f15f22" stopOpacity="0" />
              <stop offset="1" stopColor="#f15f22" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {/* Each groove twice: a highlight on its lower edge and the cut itself */}
          <g className="sig-engr sig-engr-hi" transform="translate(0.7 0.7)">
            <Grooves />
          </g>
          <g className="sig-engr sig-engr-cut">
            <Grooves />
          </g>
          {/* The laser: dashed beam and crosshair at rest; a solid beam and hot point while engraving */}
          <g className="sig-head" style={{ transform: at(REST) }}>
            <path className="sig-beam-rest" d={LASER_MARK.beam} transform={`translate(${-REST[0]} ${-REST[1]})`} strokeDasharray="3 3" />
            <g className="sig-on">
              <path d="M0 -60V-3" stroke={`url(#${id}-beam)`} strokeWidth="1.6" />
              <g className="sig-hot">
                <circle r="7" fill={`url(#${id}-halo)`} />
                <circle className="sig-core" r="1.7" />
              </g>
            </g>
            <g className="sig-ring">
              <circle r={LASER_MARK.r} />
              <path d={LASER_MARK.ticks} transform={`translate(${-REST[0]} ${-REST[1]})`} />
            </g>
          </g>
        </svg>
        <span className="sig-reflect" />
        <span className="sig-sweep" />
      </div>
    </div>
  );
}
