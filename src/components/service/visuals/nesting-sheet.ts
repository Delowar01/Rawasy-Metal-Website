/*
 * The Laser Cutting nesting sheet (viewBox 0 0 260 160): one source for the
 * service hero (CutPathVisual) and the theme lab's animated signature. A part
 * is cut from the sheet among nested steel parts: its outline, two holes, a
 * slot and a larger hole, each entered from a pierce point.
 */

export const NEST_VIEW = { w: 260, h: 160 };

/** The sheet's usable edge (dashed). */
export const SHEET_EDGE = { x: 6.5, y: 6.5, width: 247, height: 147 };

/** Parts already nested on the sheet (steel). */
export const NESTED_PART = "M194 30h42v40l-22 22h-20Z";
export const NESTED_CIRCLES = [
  { cx: 213, cy: 52, r: 6 },
  { cx: 215, cy: 126, r: 18 },
  { cx: 215, cy: 126, r: 8 },
];

/** Dimension rules over the part (no values). */
export const DIMENSIONS = ["M28 17h148M28 13v8M176 13v8", "M188 34v88M184 34h8M184 122h8"];

/** The part being cut: outline with its lead-in (from a pierce point off the part), holes and slot. */
export const LEAD_IN_FROM: [number, number] = [18, 34];
export const OUTLINE_FROM: [number, number] = [28, 34];
export const LEAD_IN = `M${LEAD_IN_FROM[0]} ${LEAD_IN_FROM[1]}h${OUTLINE_FROM[0] - LEAD_IN_FROM[0]}`;
export const OUTLINE = "M28 34h122l26 26v62h-68a14 14 0 0 1-28 0H28Z";
export const HOLES = [
  { cx: 52, cy: 60, r: 9 },
  { cx: 52, cy: 98, r: 9 },
  { cx: 148, cy: 98, r: 11 },
];
export const SLOT = { x: 88, y: 52, width: 40, height: 14, rx: 7 };

/** Pierce points of the interior cuts (hole and slot centres), drawn as small crosses. */
export const PIERCE_POINTS: [number, number][] = [
  [52, 60],
  [52, 98],
  [148, 98],
  [108, 59],
];
export const pierceCross = ([x, y]: [number, number]) => `M${x - 3} ${y}h6M${x} ${y - 3}v6`;
export const PIERCES = PIERCE_POINTS.map(pierceCross).join("");

/** Where the cutting head stands on the outline. */
export const CUTTING_HEAD = { cx: 176, cy: 92, r: 5, ticks: "M176 80v6M176 98v6M164 92h6M182 92h6" };
