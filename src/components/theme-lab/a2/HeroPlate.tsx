"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { logoPaths } from "@/components/brand/Logo";
import { HOLE_R, HOLES, PERF, PLATE, SLOT, STAR, VIEW, circlePath, perforations, slotPath, starPath } from "@/components/home/hero/plate-geometry";
import type { LabImage } from "../data";
import { EASE_IN_OUT, EASE_OUT, animate, at, samplePath, useSignature, type SignatureSetup, type Stop } from "../signature/useSignature";
import { Photo } from "../ui";

/*
 * A V2 hero: the website's approved hero plate (same geometry), redrawn for the
 * Modern Commerce theme. A brushed steel plate with a chamfered corner rises
 * into place and its dimensions draw in; the four bolt holes are pierced, the
 * laser traces the eight-point star and the slot, then opens the perforation
 * field row by row. Every opening shows the workshop glowing behind the plate,
 * and orange nodes mark the measurement anchors. It plays once (about 5 s)
 * on its stage, a raised panel that follows the theme. The mouse tilts the
 * plate, moves its reflection and reads X / Y in plate millimetres. The markup
 * is the finished plate (no JavaScript, reduced motion). Decorative: hidden
 * from assistive technology.
 */

type Pt = readonly [number, number];

const DOTS = perforations();
const STAR_D = starPath(STAR.cx, STAR.cy, STAR.R);
const SLOT_D = slotPath(SLOT.x, SLOT.y, SLOT.w, SLOT.h);
const HOLE_DS = HOLES.map((h) => circlePath(h.cx, h.cy, HOLE_R));
const dot = ({ cx, cy }: { cx: number; cy: number }) => `M${cx - PERF.r} ${cy}a${PERF.r} ${PERF.r} 0 1 0 ${PERF.r * 2} 0a${PERF.r} ${PERF.r} 0 1 0 ${-PERF.r * 2} 0Z`;
const OUTLINE = `M${PLATE.x0} ${PLATE.y0}H${PLATE.x1 - PLATE.chamfer}L${PLATE.x1} ${PLATE.y0 + PLATE.chamfer}V${PLATE.y1}H${PLATE.x0}Z`;
/** The plate with every opening cut through it (even-odd). */
const BODY = [OUTLINE, ...HOLE_DS, STAR_D, SLOT_D, ...DOTS.map(dot)].join("");
const CUT_EDGES = [...HOLE_DS, STAR_D, SLOT_D].join("");
/** One band of plate material over each perforation row, cut away as the laser rasters along it. */
const ROWS = Array.from({ length: PERF.rows }, (_, r) => {
  const y = PERF.y0 + r * PERF.step;
  return { y, d: `M${PERF.x0 - 8} ${y - PERF.step / 2}H${PERF.x1 + 8}V${y + PERF.step / 2}H${PERF.x0 - 8}Z`, ltr: r % 2 === 0 };
});

/** Traced cuts (the star, then the slot), each entered where the laser pierces. */
const TRACED = [
  { id: "star", d: STAR_D, feed: 0.85, entry: [STAR.cx, STAR.cy - STAR.R] as Pt },
  { id: "slot", d: SLOT_D, feed: 1.1, entry: [SLOT.x + SLOT.h / 2, SLOT.y] as Pt },
];
/** Steps on the readout: four holes, the star, the slot, the perforation field. */
const STEPS = HOLES.length + TRACED.length + 1;
const PARK: Pt = [STAR.cx, PLATE.y0 - 34];

/** Measurement anchors: dimension leaders start here, marked by orange nodes. */
const NODES: Pt[] = [
  [STAR.cx + 90.5, STAR.cy - 90.5],
  [PLATE.x1 - 20, PLATE.y0 + 20],
  [SLOT.x + SLOT.w, SLOT.y + SLOT.h / 2],
  [HOLES[3].cx - HOLE_R * 0.7, HOLES[3].cy + HOLE_R * 0.7],
];

const DIMS = [
  {
    d: `M${PLATE.x0} 30H${PLATE.x1}M${PLATE.x0} 22V38M${PLATE.x1} 22V38M${PLATE.x0 + 8} 26L${PLATE.x0} 30L${PLATE.x0 + 8} 34M${PLATE.x1 - 8} 26L${PLATE.x1} 30L${PLATE.x1 - 8} 34`,
    label: "520.00",
    x: 320,
    y: 20,
    anchor: "middle",
  },
  {
    d: `M30 ${PLATE.y0}V${PLATE.y1}M22 ${PLATE.y0}H38M22 ${PLATE.y1}H38M26 ${PLATE.y0 + 8}L30 ${PLATE.y0}L34 ${PLATE.y0 + 8}M26 ${PLATE.y1 - 8}L30 ${PLATE.y1}L34 ${PLATE.y1 - 8}`,
    label: "640.00",
    x: 19,
    y: (PLATE.y0 + PLATE.y1) / 2,
    anchor: "middle",
    turn: true,
  },
  { d: `M${NODES[0][0]} ${NODES[0][1]}L${PLATE.x1 + 26} ${STAR.cy - 150}H${PLATE.x1 + 52}`, label: "R128", x: PLATE.x1 + 28, y: STAR.cy - 156, anchor: "start" },
  { d: `M${NODES[1][0]} ${NODES[1][1]}L${PLATE.x1 + 18} ${PLATE.y0 - 18}H${PLATE.x1 + 50}`, label: "45°×40", x: PLATE.x1 + 20, y: PLATE.y0 - 24, anchor: "start" },
  { d: `M${NODES[2][0]} ${NODES[2][1]}L${PLATE.x1 + 26} ${SLOT.y + 60}H${PLATE.x1 + 52}`, label: "240×28", x: PLATE.x1 + 28, y: SLOT.y + 76, anchor: "start" },
  { d: `M${NODES[3][0]} ${NODES[3][1]}L${PLATE.x0 - 6} ${PLATE.y1 + 30}H${PLATE.x0 - 40}`, label: "4×Ø22", x: PLATE.x0 - 4, y: PLATE.y1 + 46, anchor: "end" },
] as const;

/** In per cent of the view: the photo window (inside the plate, around every opening) and the plate's outline (reflection). */
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
const WINDOW = { x0: 96, y0: 96, x1: 544, y1: 664 };
const PHOTO_BOX = { left: pct(WINDOW.x0, VIEW.w), right: pct(VIEW.w - WINDOW.x1, VIEW.w), top: pct(WINDOW.y0, VIEW.h), bottom: pct(VIEW.h - WINDOW.y1, VIEW.h) };
const PLATE_CLIP = `polygon(${(
  [
    [PLATE.x0, PLATE.y0],
    [PLATE.x1 - PLATE.chamfer, PLATE.y0],
    [PLATE.x1, PLATE.y0 + PLATE.chamfer],
    [PLATE.x1, PLATE.y1],
    [PLATE.x0, PLATE.y1],
  ] as const
)
  .map(([x, y]) => `${pct(x, VIEW.w)} ${pct(y, VIEW.h)}`)
  .join(", ")})`;

const HIDE = 1.05;
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const pad = (n: number) => String(n).padStart(2, "0");

const setup: SignatureSetup = (root) => {
  const $ = (selector: string) => root.querySelector(selector)!;
  const $$ = (selector: string) => [...root.querySelectorAll(selector)];
  const dims = $$(".a2-plate-dim");
  const labels = $$(".a2-plate-label");
  const nodes = $$(".a2-plate-node");
  const pulses = $$(".a2-plate-pulse");
  const pierces = $$(".a2-plate-pierce");
  const holeSlugs = HOLES.map((_, i) => $(`[data-slug="h${i}"]`));
  const head = $(".a2-plate-head");
  const hot = $(".a2-plate-hot");
  const rowSlugs = ROWS.map((_, r) => $(`[data-slug="r${r}"]`));
  const traced = TRACED.map((c) => {
    const kerf = $(`[data-kerf="${c.id}"]`) as SVGGeometryElement;
    return { slug: $(`[data-slug="${c.id}"]`), kerfs: $$(`[data-kerf="${c.id}"]`), route: samplePath(kerf, 3), length: kerf.getTotalLength() };
  });

  return () => {
    // Bolt holes: four pierce points, one after another; each hole opens as its flash fades.
    const holeAt = HOLES.map((_, i) => 1150 + i * 120);
    // Then the laser traces the star and the slot at its feed rate.
    let t = holeAt[holeAt.length - 1] + 240;
    let pos = PARK;
    const plan = TRACED.map((c, i) => {
      const t0 = t;
      const tp = t0 + 90 + dist(pos, c.entry) * 0.45;
      const tc = tp + 70;
      const te = tc + traced[i].length / c.feed;
      pos = c.entry;
      t = te;
      return { t0, tp, tc, te };
    });
    // Finally the perforation field opens in a quick raster, row by row.
    const perfFrom = t + 90 + dist(pos, [PERF.x0, PERF.y0]) * 0.45;
    const perfTo = perfFrom + 480;
    const T = perfTo + 880;

    const run = (el: Element, stops: readonly Stop[]) => animate(el, T, stops);
    const o = (opacity: number) => ({ opacity });
    const dash = (offset: number) => ({ strokeDasharray: "1 1.1", strokeDashoffset: offset });

    const path: Stop[] = [[0, { transform: at(PARK) }]];
    let from = PARK;
    plan.forEach((p, i) => {
      path.push([p.t0, { transform: at(from) }, EASE_IN_OUT], [p.tp, { transform: at(TRACED[i].entry) }], [p.tc, { transform: at(TRACED[i].entry) }]);
      const route = traced[i].route;
      route.forEach((pt, k) => path.push([p.tc + ((p.te - p.tc) * k) / (route.length - 1), { transform: at(pt) }]));
      from = TRACED[i].entry;
    });
    path.push([plan[plan.length - 1].te, { transform: at(from) }, EASE_IN_OUT], [perfFrom, { transform: at([PERF.x0, PERF.y0]) }]);
    for (let r = 0; r < PERF.rows; r++) {
      const y = PERF.y0 + r * PERF.step;
      const [a, b] = r % 2 ? [PERF.x1, PERF.x0] : [PERF.x0, PERF.x1];
      path.push([perfFrom + ((perfTo - perfFrom) * r) / PERF.rows, { transform: at([a, y]) }], [perfFrom + ((perfTo - perfFrom) * (r + 1)) / PERF.rows - 10, { transform: at([b, y]) }]);
    }

    const beam: Stop[] = [[0, o(0)]];
    plan.forEach((p) => beam.push([p.tp - 10, o(0)], [p.tp + 30, o(1)], [p.te, o(1)], [p.te + 60, o(0)]));
    beam.push([perfFrom - 10, o(0)], [perfFrom + 30, o(1)], [perfTo, o(1)], [perfTo + 180, o(0)]);

    const anims = [
      run(root, [
        [0, { opacity: 0, transform: "translateY(28px)" }, EASE_OUT],
        [760, { opacity: 1, transform: "none" }],
      ]),
      ...dims.map((d, i) => run(d, [[200 + i * 70 - 1, dash(HIDE)], [200 + i * 70, dash(1), EASE_OUT], [700 + i * 70, dash(0)]])),
      ...labels.map((l, i) => run(l, [[620 + i * 50, o(0)], [940 + i * 50, o(1)]])),
      ...pierces.flatMap((p, i) => [
        run(p, [
          [holeAt[i], { opacity: 0, transform: "scale(0.4)" }, EASE_OUT],
          [holeAt[i] + 90, { opacity: 1, transform: "scale(1)" }, EASE_OUT],
          [holeAt[i] + 520, { opacity: 0, transform: "scale(1.6)" }],
        ]),
        run(holeSlugs[i], [[holeAt[i] + 160, o(1)], [holeAt[i] + 360, o(0)]]),
      ]),
      run(head, path),
      run(hot, beam),
      ...traced.flatMap(({ slug, kerfs }, i) => {
        const p = plan[i];
        const star = TRACED[i].id === "star";
        return [
          run(slug, [
            [p.te, { opacity: 1, transform: "none" }, EASE_IN_OUT],
            [p.te + (star ? 480 : 220), { opacity: 0, transform: star ? "translateY(6px)" : "none" }],
          ]),
          ...kerfs.map((k) => run(k, [[p.tc - 1, dash(HIDE)], [p.tc, dash(1)], [p.te, dash(0)]])),
          ...kerfs.map((k) => run(k, [[p.te, o(1)], [p.te + 720, o(0)]])),
        ];
      }),
      // Each row opens behind the head, in the direction it travels.
      ...rowSlugs.map((slug, r) => {
        const [from, to] = [perfFrom + ((perfTo - perfFrom) * r) / PERF.rows, perfFrom + ((perfTo - perfFrom) * (r + 1)) / PERF.rows - 10];
        const inset = (cut: number) => ({ opacity: 1, clipPath: ROWS[r].ltr ? `inset(0 0 0 ${cut}%)` : `inset(0 ${cut}% 0 0)` });
        return run(slug, [
          [from, inset(0)],
          [to, inset(100)],
        ]);
      }),
      ...nodes.map((n, i) => run(n, [[perfTo + 140 + i * 90, { opacity: 0, transform: "scale(0.4)" }, EASE_OUT], [perfTo + 540 + i * 90, { opacity: 1, transform: "none" }]])),
      ...pulses.map((p, i) => run(p, [[perfTo + 340 + i * 90, o(0)], [perfTo + 610 + i * 90, o(1)]])),
    ];
    return {
      anims,
      total: T,
      moments: { initial: 1140, active: plan[0].tc + (plan[0].te - plan[0].tc) * 0.62 },
      marks: [...holeAt, ...plan.map((p) => p.tc), perfFrom],
    };
  };
};

export function HeroPlateA2({
  photo,
  labels,
  freeze,
  className = "",
  children,
}: {
  photo: LabImage;
  labels: { part: string; sequence: string };
  freeze?: string;
  className?: string;
  /** Key figures shown in the stage's bar, beside the readout. */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const done = `${pad(STEPS)}/${pad(STEPS)}`;
  // Unique ids for the SVG paint servers: the design-system sheet shows several plates.
  const uid = useId().replace(/[^\w-]/g, "");
  const id = (name: string) => `a2p-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  // The readout counts the cuts while the sequence runs (and shows the count of a still frame).
  const counted = useCallback<SignatureSetup>(
    (root) => {
      const run = setup(root);
      return (intro) => {
        const result = run(intro);
        const clock = result.anims[0];
        const marks = result.marks ?? [];
        let frame = 0;
        const tick = () => {
          const now = Number(clock.currentTime ?? 0);
          const running = clock.playState === "running";
          const read = readRef.current;
          const line = read?.closest("p");
          if (line && line.hasAttribute("data-running") !== running) line.toggleAttribute("data-running", running);
          const text = `${pad(marks.filter((m) => now >= m).length)}/${pad(STEPS)}`;
          // Only on change: a text write every frame would lay the page out every frame.
          if (read && !line?.hasAttribute("data-pointer") && read.textContent !== text) read.textContent = text;
          if (running) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        clock.addEventListener("finish", () => {
          cancelAnimationFrame(frame);
          tick();
        });
        clock.addEventListener("cancel", () => cancelAnimationFrame(frame));
        return result;
      };
    },
    [],
    );
  useSignature(ref, counted, { freeze, replay: false });

  // Armed (script and motion): the count starts from zero until the plate is cut.
  useEffect(() => {
    const read = readRef.current;
    if (read && freeze === undefined && !matchMedia("(prefers-reduced-motion: reduce)").matches) read.textContent = `${pad(0)}/${pad(STEPS)}`;
    }, [freeze]);

  // Desktop mouse: X / Y in plate millimetres, and the plate leans towards the pointer while its reflection
  // follows it — inline transforms on two elements, eased on the compositor (no restyle of the plate).
  useEffect(() => {
    const root = ref.current;
    const read = readRef.current;
    const stage = root?.closest<HTMLElement>(".a2-plate-stage");
    if (!root || !read || !stage || freeze !== undefined || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const svg = root.querySelector("svg")!;
    const tilt = root.querySelector<HTMLElement>(".a2-plate-tilt")!;
    const shine = root.querySelector<HTMLElement>(".a2-plate-shine > span")!;
    const line = read.closest("p")!;
    let frame = 0;
    const lean = (nx: number, ny: number) => {
      if (calm) return;
      tilt.style.transform = `perspective(1600px) rotateX(${(-ny * 4).toFixed(2)}deg) rotateY(${(nx * 5).toFixed(2)}deg)`;
      shine.style.translate = `${(nx * 22).toFixed(1)}% ${(ny * 18).toFixed(1)}%`;
    };
    const count = () => {
      line.removeAttribute("data-pointer");
      read.textContent = done;
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      count();
      lean(0, 0);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || frame) return;
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const area = stage.getBoundingClientRect();
        lean(((clientX - area.left) / area.width) * 2 - 1, ((clientY - area.top) / area.height) * 2 - 1);
        const box = svg.getBoundingClientRect();
        const x = ((clientX - box.left) / box.width) * VIEW.w;
        const y = ((clientY - box.top) / box.height) * VIEW.h;
        if (x < PLATE.x0 || x > PLATE.x1 || y < PLATE.y0 || y > PLATE.y1) {
          if (line.hasAttribute("data-pointer")) count();
          return;
        }
        line.setAttribute("data-pointer", "");
        read.textContent = `X ${(x - PLATE.x0).toFixed(1).padStart(5, "0")} · Y ${(PLATE.y1 - y).toFixed(1).padStart(5, "0")}`;
      });
    };
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, [freeze, done]);

  const material = (d: string) => (
    <>
      <path d={d} fill={url("metal")} />
      <path d={d} fill={url("brush")} />
      <path d={d} fill={url("sheen")} />
    </>
  );

  return (
    <div className={`a2-plate-stage ${className}`}>
      <div className="a2-plate-area" aria-hidden>
        <span className="a2-plate-grid" />
        <div ref={ref} className="a2-plate" data-cursor="plate">
          <div className="a2-plate-tilt">
            {/* Soft cast shadow: its own cached layer, so the plate's repaints never re-run the blur */}
            <span className="a2-plate-shadow">
              <span style={{ clipPath: PLATE_CLIP }} />
            </span>
            {/* The workshop, glowing behind the openings */}
            <div className="a2-plate-photo" style={PHOTO_BOX}>
              <Photo image={photo} alt="" priority sizes="(min-width: 1024px) 420px, 64vw" />
              <span className="a2-plate-heat" />
            </div>
            <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="a2-plate-svg" focusable="false">
              <defs>
                <linearGradient id={id("metal")} gradientUnits="userSpaceOnUse" x1={PLATE.x0} y1={PLATE.y0} x2={PLATE.x1} y2={PLATE.y1}>
                  <stop offset="0" style={{ stopColor: "var(--plate-a)" }} />
                  <stop offset="0.42" style={{ stopColor: "var(--plate-b)" }} />
                  <stop offset="0.68" style={{ stopColor: "var(--plate-a)" }} />
                  <stop offset="1" style={{ stopColor: "var(--plate-c)" }} />
                </linearGradient>
                <linearGradient id={id("sheen")} gradientUnits="userSpaceOnUse" x1={PLATE.x0} y1={PLATE.y0} x2={PLATE.x1} y2={PLATE.y1}>
                  <stop offset="0.2" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="0.38" style={{ stopColor: "#ffffff", stopOpacity: "var(--plate-sheen)" }} />
                  <stop offset="0.54" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <pattern id={id("brush")} width={VIEW.w} height="3" patternUnits="userSpaceOnUse">
                  <rect width={VIEW.w} height="1" className="a2-plate-grain-hi" />
                  <rect y="2" width={VIEW.w} height="1" className="a2-plate-grain-lo" />
                </pattern>
                <radialGradient id={id("halo")}>
                  <stop offset="0" stopColor="#ffb25a" stopOpacity="0.95" />
                  <stop offset="0.4" stopColor="#ff7424" stopOpacity="0.45" />
                  <stop offset="1" stopColor="#ff7424" stopOpacity="0" />
                </radialGradient>

              </defs>


              {/* The plate, every opening cut through it */}
              <g fillRule="evenodd">{material(BODY)}</g>
              {/* Cut walls: a dark edge with a lit lip, so each opening reads as cut through metal */}
              <g fill="none" strokeLinejoin="round">
                <path d={CUT_EDGES} stroke="var(--plate-wall)" strokeWidth="2" />
                <path d={CUT_EDGES} stroke="var(--plate-lip)" strokeWidth="1" transform="translate(0.9 0.9)" />
                <path d={DOTS.map(dot).join("")} stroke="var(--plate-wall)" strokeWidth="1" />
              </g>
              {/* Laser-engraved maker's mark and part code */}
              <g className="a2-plate-engraving">
                <g transform="translate(262 626) scale(0.12) translate(-70.8 -201.37)" fill="none" strokeWidth="9">
                  <path d={logoPaths.markTop} />
                  <path d={logoPaths.markBottom} />
                </g>
                <text x="302" y="647">
                  RW—01
                </text>
              </g>
              {/* Bevel highlight and edge */}
              <polyline
                points={`${PLATE.x0 + 1},${PLATE.y1 - 1} ${PLATE.x0 + 1},${PLATE.y0 + 1} ${PLATE.x1 - PLATE.chamfer},${PLATE.y0 + 1}`}
                fill="none"
                stroke="var(--plate-lip)"
                strokeWidth="1.4"
              />
              <path d={OUTLINE} fill="none" stroke="var(--plate-edge)" strokeWidth="1" />

              {/* Slugs: plate material over each opening until it is cut */}
              {[...HOLE_DS.map((d, i) => ({ id: `h${i}`, d })), ...TRACED].map((c) => (
                <g key={c.id} className="a2-plate-slug" data-slug={c.id}>
                  <path d={c.d} fill="none" stroke={url("metal")} strokeWidth="3.5" />
                  {material(c.d)}
                </g>
              ))}
              {ROWS.map((row, r) => (
                <g key={row.y} className="a2-plate-slug" data-slug={`r${r}`}>
                  {material(row.d)}
                </g>
              ))}

              {/* Kerfs: a glow and a hot line behind the laser, then they cool away */}
              <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                {TRACED.map((c) => (
                  <g key={c.id}>
                    <path data-kerf={c.id} className="a2-plate-glow" d={c.d} pathLength={1} />
                    <path data-kerf={c.id} className="a2-plate-cut" d={c.d} pathLength={1} />
                  </g>
                ))}
              </g>

              {/* Pierce points of the bolt holes */}
              {HOLES.map((h) => (
                <g key={`${h.cx}-${h.cy}`} transform={`translate(${h.cx} ${h.cy})`}>
                  <g className="a2-plate-pierce">
                    <circle r="16" fill={url("halo")} />
                    <circle r="3.4" className="a2-plate-core" />
                  </g>
                </g>
              ))}

              {/* Dimensions (the plate's own measurements) */}
              <g className="a2-plate-dims" fill="none">
                <path d={`M${PLATE.x0 - 10} ${STAR.cy}H${PLATE.x1 + 14}M${STAR.cx} ${PLATE.y0 - 8}V${PLATE.y1 + 14}`} className="a2-plate-axis" />
                {DIMS.map((dm) => (
                  <path key={dm.label} d={dm.d} className="a2-plate-dim" pathLength={1} />
                ))}
                {DIMS.map((dm) => (
                  <text
                    key={dm.label}
                    className="a2-plate-label"
                    x={dm.x}
                    y={dm.y}
                    textAnchor={dm.anchor}
                    transform={"turn" in dm ? `rotate(-90 ${dm.x} ${dm.y})` : undefined}
                  >
                    {dm.label}
                  </text>
                ))}
              </g>

              {/* Orange nodes at the measurement anchors */}
              {NODES.map(([x, y]) => (
                <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                  <g className="a2-plate-node">
                    <circle r="9" className="a2-plate-node-halo" />
                    <circle r="3.4" className="a2-plate-node-dot" />
                  </g>
                </g>
              ))}

              {/* The laser head */}
              <g className="a2-plate-head" style={{ transform: at(PARK) }}>
                <g className="a2-plate-hot">
                  <circle r="15" fill={url("halo")} />
                  <circle r="3.2" className="a2-plate-core" />
                </g>
              </g>
            </svg>
            {/* The hot points breathe on the compositor, outside the SVG (an SVG animation would repaint the plate every frame) */}
            {NODES.map(([x, y], i) => (
              <span key={`${x}-${y}`} className="a2-plate-pulse" style={{ left: pct(x, VIEW.w), top: pct(y, VIEW.h), ["--i" as string]: i }}>
                <span />
              </span>
            ))}
            {/* A reflection over the plate that follows the pointer */}
            <span className="a2-plate-shine">
              <span />
            </span>
          </div>
        </div>
      </div>
      <div className="a2-plate-bar">
        {children}
        <p className="a2-plate-read" aria-hidden>
          <span className="a2-plate-part">
            <span className="a2-plate-led" />
            {labels.part}
          </span>
          <span className="a2-plate-sep" />
          <span className="a2-plate-count">
            <span className="a2-plate-seq">{labels.sequence}</span>
            <span ref={readRef} dir="ltr">
              {done}
            </span>
          </span>
        </p>
      </div>
    </div>
  );
}
