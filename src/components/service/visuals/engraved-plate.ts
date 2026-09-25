/*
 * The Laser Engraving plate (viewBox 0 0 400 280): one source for the service
 * hero (EngravedPlateVisual) and the theme lab's animated signature. A brushed
 * brass plate engraved with a double border, corner marks, a block of engraved
 * lines (a layout, not real text) and a guilloche rosette.
 */

export const PLATE_VIEW = { w: 400, h: 280 };

/** Double border and corner marks. */
export const BORDER_OUTER = { x: 14, y: 14, width: 372, height: 252 };
export const BORDER_INNER = { x: 21, y: 21, width: 358, height: 238 };
export const CORNER_MARKS = "M30 40V30h10M370 40V30h-10M30 240v10h10M370 240v10h-10";

/** Lengths of the engraved "text" grooves on the plate (a layout, not real text). */
export const ENGRAVED_LINES = [
  { y: 62, w: 126, h: 5 },
  { y: 86, w: 96, h: 2.5 },
  { y: 102, w: 118, h: 2.5 },
  { y: 118, w: 74, h: 2.5 },
  { y: 150, w: 108, h: 3.5 },
  { y: 170, w: 84, h: 2.5 },
  { y: 204, w: 130, h: 2.5 },
  { y: 220, w: 58, h: 2.5 },
];
export const LINE_X = 44;
export const linePath = (l: { y: number; w: number }) => `M${LINE_X} ${l.y}h${l.w}`;

/** Guilloche rosette: a ring, a dotted ring, two families of rotated ellipses and a centre boss. */
export const ROSETTE = {
  x: 282,
  y: 140,
  ring: 92,
  dotted: 87,
  boss: 10,
  outer: { rx: 76, ry: 25, angles: Array.from({ length: 24 }, (_, i) => i * 7.5) },
  inner: { rx: 44, ry: 15, angles: Array.from({ length: 18 }, (_, i) => i * 10 + 5) },
};

/** The laser at rest over the rosette: beam and crosshair. */
export const LASER_MARK = { x: 282, y: 48, r: 6, beam: "M282 0v38", ticks: "M282 36v6M282 54v6M270 48h6M288 48h6" };
