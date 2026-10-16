/**
 * The design inspector's vocabulary (A1-CONTENT-MODEL §6; A5 brief §23–§25): typed values that name the approved design
 * system's tokens, never CSS. A block's registry entry declares which controls it offers (`DesignSpec`); the settings
 * schema accepts exactly those keys and values; the preview maps each value to a class or data attribute defined in
 * `src/components/builder/blocks.css` from the Modern Commerce tokens. No free number, colour, font or CSS text exists.
 *
 * Rules enforced here (A5 brief §24), each with a unit test:
 * - words never fade: a block's motion presets come from what its animated element holds (`motionPresetsFor`) — text
 *   may appear and rise (`reveal`, `slide`, `stagger`), only media and decoration may fade, only media may scale;
 * - no layout-shifting or continuous animation exists to choose (presets are one-time transforms on reveal);
 * - reduced motion always wins (the CSS holds every preset inside `prefers-reduced-motion: no-preference`);
 * - alignment is logical (start / centre / end, mirrored in Arabic); no letter-spacing control exists (Arabic is never
 *   letter-spaced);
 * - every surface and tone combination offered reaches AA (4.5:1) for the tone's text in both themes (`APPEARANCE`);
 *   orange is an accent tone only, never a surface.
 *
 * Pure: the registry, the editor and the unit tests share it.
 */
import { z } from "zod";

export const ROLES = ["display", "h2", "h3", "lead", "body", "small"] as const;
export const ALIGNS = ["start", "center", "end"] as const;
export const MEASURES = ["narrow", "normal", "wide"] as const;
export const GAPS = ["none", "xs", "sm", "md", "lg", "xl"] as const;
export const PADDINGS = ["none", "sm", "md", "lg"] as const;
export const WIDTHS = ["shell", "wide", "full"] as const;
export const MEDIA_POSITIONS = ["start", "end", "top", "bottom"] as const;
export const SURFACES = ["plain", "muted", "raised", "dark"] as const;
export const TONES = ["steel", "teal", "brass", "orange-accent"] as const;
export const BORDERS = ["none", "subtle", "strong"] as const;
export const RADII = ["none", "card", "panel"] as const;
export const SHADOWS = ["none", "card", "raised"] as const;
export const MOTION_PRESETS = ["none", "reveal", "fade", "slide", "scale", "stagger"] as const;
/** The approved durations (`--dur-1` 180 ms … `--dur-4` 900 ms in system.css). */
export const DURATIONS = ["1", "2", "3", "4"] as const;
/** 0–600 ms in 60 ms steps. */
export const DELAYS = [0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600] as const;
export const HEADING_LEVELS = [2, 3, 4] as const;
export const COLUMNS = [1, 2, 3, 4] as const;
/** Responsive overrides: desktop is the base; tablet ≤ 1023 px; mobile ≤ 639 px. */
export const BREAKPOINTS = ["tablet", "mobile"] as const;

export type Role = (typeof ROLES)[number];
export type Align = (typeof ALIGNS)[number];
export type Measure = (typeof MEASURES)[number];
export type Gap = (typeof GAPS)[number];
export type Padding = (typeof PADDINGS)[number];
export type Width = (typeof WIDTHS)[number];
export type MediaPosition = (typeof MEDIA_POSITIONS)[number];
export type Surface = (typeof SURFACES)[number];
export type Tone = (typeof TONES)[number];
export type MotionPreset = (typeof MOTION_PRESETS)[number];
export type Duration = (typeof DURATIONS)[number];

export const LABELS = {
  role: { display: "Display", h2: "Heading 2 size", h3: "Heading 3 size", lead: "Lead", body: "Body", small: "Small" },
  align: { start: "Start", center: "Centre", end: "End" },
  measure: { narrow: "Narrow", normal: "Normal", wide: "Wide" },
  gap: { none: "None", xs: "Extra small", sm: "Small", md: "Medium", lg: "Large", xl: "Extra large" },
  padding: { none: "None", sm: "Small", md: "Medium (standard)", lg: "Large" },
  width: { shell: "Page width", wide: "Wide", full: "Full width" },
  mediaPosition: { start: "Beside, at the start", end: "Beside, at the end", top: "Above", bottom: "Below" },
  surface: { plain: "Plain", muted: "Muted sheet", raised: "Raised sheet", dark: "Dark panel" },
  tone: { steel: "Steel", teal: "Teal", brass: "Brass", "orange-accent": "Orange accent" },
  border: { none: "None", subtle: "Subtle", strong: "Strong" },
  radius: { none: "Square", card: "Card", panel: "Panel" },
  shadow: { none: "None", card: "Card", raised: "Raised" },
  motion: { none: "None", reveal: "Reveal (appears whole, rises)", fade: "Fade (media and decoration only)", slide: "Slide in", scale: "Scale (media only)", stagger: "Stagger (lists)" },
  duration: { "1": "Short (180 ms)", "2": "Standard (320 ms)", "3": "Long (600 ms)", "4": "Slow (900 ms)" },
} as const;

// --- Contrast (WCAG 2.x) -----------------------------------------------------------------------------------------------

/**
 * The tokens the appearance controls use, per theme, as system.css defines them (`tests/unit/builder-tokens.test.ts`
 * reads system.css and blocks.css and fails when they drift). The dark panel is the closing call to action's (`--navy`);
 * on it the tones use their on-dark values (the dark theme's), as blocks.css does.
 */
export const TOKENS = {
  light: {
    surface: { plain: "#f4f4f1", muted: "#ecece8", raised: "#fdfdfb", raised2: "#f7f7f4", dark: "#132039" },
    text: { ink: "#15171a", ink2: "#454a50", onDark: "#f5f7fa", onDark2: "#b8c2d0" },
    tone: { steel: "#2c5e86", teal: "#1b6f65", brass: "#7b5c24", "orange-accent": "#b3410d" },
  },
  dark: {
    surface: { plain: "#131820", muted: "#171d26", raised: "#1c232d", raised2: "#222a35", dark: "#17243b" },
    text: { ink: "#eef1f4", ink2: "#b8c0ca", onDark: "#f5f7fa", onDark2: "#b8c2d0" },
    tone: { steel: "#7fb0d8", teal: "#5cc0b0", brass: "#d7b273", "orange-accent": "#ff9466" },
  },
} as const;

const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** The contrast ratio of two #rrggbb colours, unrounded. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The lowest contrast of a surface and tone in either theme: the tone's text and the body text on that surface. */
export function appearanceContrast(surface: Surface, tone: Tone): number {
  let lowest = Infinity;
  for (const theme of ["light", "dark"] as const) {
    const t = TOKENS[theme];
    const backgrounds = surface === "raised" ? [t.surface.raised, t.surface.raised2] : [t.surface[surface]];
    const toneText = surface === "dark" ? TOKENS.dark.tone[tone] : t.tone[tone];
    const body = surface === "dark" ? [t.text.onDark, t.text.onDark2] : [t.text.ink, t.text.ink2];
    for (const bg of backgrounds) for (const fg of [toneText, ...body]) lowest = Math.min(lowest, contrastRatio(fg, bg));
  }
  return lowest;
}

/** AA for normal text. */
export const AA = 4.5;

/** Every surface × tone the inspector may offer: only those reaching AA in both themes (all do today). */
export const APPEARANCE: ReadonlyMap<string, number> = new Map(
  SURFACES.flatMap((surface) => TONES.map((tone) => [`${surface}/${tone}`, appearanceContrast(surface, tone)] as const)).filter(([, ratio]) => ratio >= AA),
);

export const appearanceAllowed = (surface: Surface, tone: Tone) => APPEARANCE.has(`${surface}/${tone}`);

// --- Motion -------------------------------------------------------------------------------------------------------------

/** What a block's animated element holds: text (words), media (photos, video frames, maps) or decoration (rules, marks). */
export type MotionTarget = "text" | "media" | "decoration";

/**
 * The presets allowed for a target (A1 §6, A5 brief §23–§24): words never fade or scale — text appears whole and rises
 * or slides; media may also fade and scale; decoration may fade; lists may stagger (each item appears in turn, whole).
 */
export function motionPresetsFor(target: MotionTarget, list: boolean): MotionPreset[] {
  const out: MotionPreset[] = ["none", "reveal", "slide"];
  if (target !== "text") out.push("fade");
  if (target === "media") out.push("scale");
  if (list) out.push("stagger");
  return out;
}

// --- The inspector's settings ---------------------------------------------------------------------------------------------

export interface DesignSpec {
  /** Heading levels the block's own heading may take (the page's h1 is never offered). */
  heading?: readonly (2 | 3 | 4)[];
  /** Size roles the block's main text may take. */
  roles?: readonly Role[];
  align?: boolean;
  measure?: boolean;
  /** The block's own layout variants (labels shown in the inspector). */
  variants?: readonly { value: string; label: string }[];
  columns?: readonly (1 | 2 | 3 | 4)[];
  gap?: boolean;
  padding?: boolean;
  width?: boolean;
  mediaPosition?: readonly MediaPosition[];
  surfaces?: readonly Surface[];
  tone?: boolean;
  border?: boolean;
  radius?: boolean;
  shadow?: boolean;
  /** Responsive overrides (tablet, mobile) of the layout keys the block has: columns, gap, padding, alignment, media position. */
  responsive?: boolean;
  /** What the block animates; the presets follow from it. */
  motion?: { target: MotionTarget; list?: boolean };
}

export interface DesignValues {
  heading?: 2 | 3 | 4;
  role?: Role;
  align?: Align;
  measure?: Measure;
  variant?: string;
  columns?: 1 | 2 | 3 | 4;
  gap?: Gap;
  padding?: Padding;
  width?: Width;
  mediaPosition?: MediaPosition;
  surface?: Surface;
  tone?: Tone;
  border?: (typeof BORDERS)[number];
  radius?: (typeof RADII)[number];
  shadow?: (typeof SHADOWS)[number];
  responsive?: Partial<Record<(typeof BREAKPOINTS)[number], Overrides>>;
  motion?: { preset: MotionPreset; duration: Duration; delay: (typeof DELAYS)[number] };
}

export interface Overrides {
  columns?: 1 | 2 | 3 | 4;
  gap?: Gap;
  padding?: Padding;
  align?: Align;
  mediaPosition?: MediaPosition;
}

const literalUnion = <T extends readonly (string | number)[]>(values: T) => z.literal(values as unknown as [T[number], ...T[number][]]) as unknown as z.ZodType<T[number]>;

/** The column counts a tablet or phone override may take: one up to the block's widest choice. */
export const narrowerColumns = (columns: readonly (1 | 2 | 3 | 4)[]) => ([1, 2, 3, 4] as const).filter((n) => n <= Math.max(...columns));

/** The settings schema of a block's `design` object: exactly the keys and values its spec offers (strict). */
export function designSchema(spec: DesignSpec) {
  const shape: Record<string, z.ZodType> = {};
  if (spec.heading?.length) shape.heading = literalUnion(spec.heading).optional();
  if (spec.roles?.length) shape.role = z.enum(spec.roles as unknown as [Role, ...Role[]]).optional();
  if (spec.align) shape.align = z.enum(ALIGNS).optional();
  if (spec.measure) shape.measure = z.enum(MEASURES).optional();
  if (spec.variants?.length) shape.variant = z.enum(spec.variants.map((v) => v.value) as [string, ...string[]]).optional();
  if (spec.columns?.length) shape.columns = literalUnion(spec.columns).optional();
  if (spec.gap) shape.gap = z.enum(GAPS).optional();
  if (spec.padding) shape.padding = z.enum(PADDINGS).optional();
  if (spec.width) shape.width = z.enum(WIDTHS).optional();
  if (spec.mediaPosition?.length) shape.mediaPosition = z.enum(spec.mediaPosition as unknown as [MediaPosition, ...MediaPosition[]]).optional();
  if (spec.surfaces?.length) shape.surface = z.enum(spec.surfaces as unknown as [Surface, ...Surface[]]).optional();
  if (spec.tone) shape.tone = z.enum(TONES).optional();
  if (spec.border) shape.border = z.enum(BORDERS).optional();
  if (spec.radius) shape.radius = z.enum(RADII).optional();
  if (spec.shadow) shape.shadow = z.enum(SHADOWS).optional();
  if (spec.responsive) {
    const overrides: Record<string, z.ZodType> = {};
    // Narrower screens may always take fewer columns than the block's widest choice (down to one).
    if (spec.columns?.length) overrides.columns = literalUnion(narrowerColumns(spec.columns)).optional();
    if (spec.gap) overrides.gap = z.enum(GAPS).optional();
    if (spec.padding) overrides.padding = z.enum(PADDINGS).optional();
    if (spec.align) overrides.align = z.enum(ALIGNS).optional();
    if (spec.mediaPosition?.length) overrides.mediaPosition = z.enum(spec.mediaPosition as unknown as [MediaPosition, ...MediaPosition[]]).optional();
    const one = z.object(overrides).strict().optional();
    shape.responsive = z.object({ tablet: one, mobile: one }).strict().optional();
  }
  if (spec.motion) {
    const presets = motionPresetsFor(spec.motion.target, spec.motion.list ?? false);
    shape.motion = z
      .object({ preset: z.enum(presets as [MotionPreset, ...MotionPreset[]]), duration: z.enum(DURATIONS), delay: literalUnion(DELAYS) })
      .strict()
      .optional();
  }
  return z
    .object(shape)
    .strict()
    .superRefine((value, ctx) => {
      const v = value as DesignValues;
      if (v.surface && v.tone && !appearanceAllowed(v.surface, v.tone)) {
        ctx.addIssue({ code: "custom", path: ["tone"], message: "This tone does not reach AA contrast on this surface. Choose another tone or surface." });
      }
    });
}

/** The inspector's controls of a spec, for tests and the editor (which keys it offers). */
export function designKeys(spec: DesignSpec): string[] {
  return Object.keys(designSchema(spec).shape ?? {});
}
