/**
 * Geometry for the hero "laser-cut plate" (SVG user units ≈ millimetres).
 * The plate is an object, not UI, so it is intentionally not mirrored in RTL.
 */
export const VIEW = { w: 640, h: 760 };
export const PLATE = { x0: 60, y0: 60, x1: 580, y1: 700, chamfer: 40 };

export const platePolygon = [
  [PLATE.x0, PLATE.y0],
  [PLATE.x1 - PLATE.chamfer, PLATE.y0],
  [PLATE.x1, PLATE.y0 + PLATE.chamfer],
  [PLATE.x1, PLATE.y1],
  [PLATE.x0, PLATE.y1],
]
  .map(([x, y]) => `${x},${y}`)
  .join(" ");

/** Circle as a path so the laser can follow it with getPointAtLength. */
export function circlePath(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

/** Eight-point star (two overlapping squares — the khatam of Saudi geometric work). */
export function starPath(cx: number, cy: number, R: number) {
  const r = (R * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8);
  const pts: string[] = [];
  for (let k = 0; k < 16; k++) {
    const angle = -Math.PI / 2 + (k * Math.PI) / 8;
    const radius = k % 2 === 0 ? R : r;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Stadium-shaped slot. */
export function slotPath(x: number, y: number, w: number, h: number) {
  const r = h / 2;
  return `M${x + r} ${y}H${x + w - r}a${r} ${r} 0 0 1 0 ${h}H${x + r}a${r} ${r} 0 0 1 0 ${-h}Z`;
}

export const STAR = { cx: 320, cy: 318, R: 128 };
export const HOLES = [
  { cx: 112, cy: 112 },
  { cx: 528, cy: 112 },
  { cx: 528, cy: 648 },
  { cx: 112, cy: 648 },
];
export const HOLE_R = 11;
export const SLOT = { x: 200, y: 488, w: 240, h: 28 };
export const PERF = { x0: 104, x1: 536, y0: 552, rows: 4, step: 16, r: 3.4 };

export interface Cut {
  id: string;
  d: string;
  duration: number;
  kind: "hole" | "star" | "slot";
}

export const CUTS: Cut[] = [
  ...HOLES.map((h, i) => ({ id: `hole-${i}`, d: circlePath(h.cx, h.cy, HOLE_R), duration: 0.34, kind: "hole" as const })),
  { id: "star", d: starPath(STAR.cx, STAR.cy, STAR.R), duration: 2.3, kind: "star" },
  { id: "slot", d: slotPath(SLOT.x, SLOT.y, SLOT.w, SLOT.h), duration: 0.85, kind: "slot" },
];

export function perforations() {
  const dots: { cx: number; cy: number }[] = [];
  for (let row = 0; row < PERF.rows; row++) {
    for (let x = PERF.x0; x <= PERF.x1; x += PERF.step) {
      dots.push({ cx: x + (row % 2 ? PERF.step / 2 : 0), cy: PERF.y0 + row * PERF.step });
    }
  }
  return dots.filter((d) => d.cx <= PERF.x1);
}
