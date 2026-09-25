/* Geometry shared by the signature illustrations (SVG user units). */

export type Pt = readonly [number, number];

const round = (n: number) => Math.round(n * 100) / 100;

/** Eight-point star (two overlapping squares — the khatam of Saudi geometric work), from the top point, clockwise. */
export function star(cx: number, cy: number, R: number): Pt[] {
  const r = (R * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8);
  return Array.from({ length: 16 }, (_, k) => {
    const angle = -Math.PI / 2 + (k * Math.PI) / 8;
    const radius = k % 2 === 0 ? R : r;
    return [round(cx + radius * Math.cos(angle)), round(cy + radius * Math.sin(angle))] as const;
  });
}

/** Regular polygon (a square when n = 4), from `start` radians, clockwise. */
export function polygon(cx: number, cy: number, R: number, n: number, start = -Math.PI / 2): Pt[] {
  return Array.from({ length: n }, (_, k) => {
    const angle = start + (k * 2 * Math.PI) / n;
    return [round(cx + R * Math.cos(angle)), round(cy + R * Math.sin(angle))] as const;
  });
}

/** Closed path through the points. */
export function closedPath(points: readonly Pt[]) {
  return `M${points.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
}
