import type { CSSProperties } from "react";

/*
 * The four service drawings of Stage 1D that are not signatures (decision D9), restyled in this design's colours:
 * the press brake (CNC Bending), the structural axes (Steel Structures), the weld seam (Metal Fabrication) and the
 * scaffold tower (Scaffolding). Same geometry as before (src/components/service/visuals/); the grid backdrops, frame
 * marks, scan lines and pointer light are retired (D8). Their one motion is the one they had: the line work draws
 * itself once, when revealed (`sv-draw`: the revealed SVG sets `--draw`, which its paths inherit). Finished without
 * script and with reduced motion. Decorative: hidden from assistive technology; the page's text carries the meaning.
 */

const at = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as CSSProperties;

/** CNC Bending: a side elevation of a press brake at the moment of the bend. No angles or sizes are given. */
export function PressBrake() {
  return (
    <svg viewBox="0 0 520 360" className="sv-draw sv-press" data-reveal="fade" fill="none" aria-hidden focusable={false}>
      <defs>
        <pattern id="sv-fold-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0v7" stroke="var(--steel)" strokeWidth="0.8" opacity="0.45" />
        </pattern>
      </defs>
      {/* Centre line */}
      <path d="M260 16v330" stroke="var(--ink-3)" strokeWidth="0.8" strokeDasharray="12 4 2 4" />
      {/* Ram and punch */}
      <g stroke="var(--steel)" strokeWidth="1.4">
        <rect x="178" y="34" width="164" height="40" fill="var(--steel-soft)" pathLength={1} />
        <path d="M236 74h48l-14 182-10 14-10-14Z" fill="var(--surface)" pathLength={1} />
      </g>
      {/* Ram travel */}
      <g stroke="var(--brand)" strokeWidth="1.4">
        <path d="M260 6v20" />
        <path d="m253 19 7 8 7-8" />
      </g>
      {/* V-die, sectioned */}
      <path d="M130 250h92l38 42 38-42h92v54H130Z" fill="url(#sv-fold-hatch)" stroke="var(--steel)" strokeWidth="1.4" pathLength={1} />
      <path d="M148 304h224v18H148Z" stroke="var(--steel)" strokeWidth="1.2" pathLength={1} />
      {/* Flat blank, before the bend */}
      <path d="M92 247h336" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="6 5" />
      {/* Formed part */}
      <path d="M108 172l148 102q4 3 8 0l148-102" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" pathLength={1} />
      {/* Bend arc */}
      <g stroke="var(--brand)" strokeWidth="1">
        <path d="M227 253.4a40 40 0 0 1 66 0" pathLength={1} />
        <path d="m223 249 8 8M297 249l-8 8" />
      </g>
      {/* Back gauge */}
      <g stroke="var(--steel)" strokeWidth="1.2">
        <path d="M444 150h28v34h-28Z" fill="var(--steel-soft)" />
        <path d="M412 172h32" strokeDasharray="3 3" />
        <path d="m420 166-8 6 8 6" />
      </g>
      {/* Overall width, without values */}
      <g stroke="var(--ink-3)" strokeWidth="0.8">
        <path d="M108 180v158M412 180v158" strokeDasharray="2 4" />
        <path d="M108 338h304M108 332v12M412 332v12" />
      </g>
    </svg>
  );
}

/** Steel Structures: grid positions (percent of the plate) of the lettered column axes and the numbered rows. */
const COLUMNS = [
  { x: 9, label: "A" },
  { x: 36, label: "B" },
  { x: 64, label: "C" },
  { x: 91, label: "D" },
];
const ROWS = [
  { y: 13, label: "1" },
  { y: 87, label: "2" },
];

/**
 * Steel Structures: the structural grid of a steel frame drawing — lettered column axes along the top, numbered rows at
 * the side, an I-beam section in the corner — drawn in once (each axis line in turn). A drawing convention, not
 * dimensions; never mirrored in Arabic.
 */
export function AxisGrid() {
  return (
    <div aria-hidden className="sv-axes" dir="ltr">
      {COLUMNS.map((c, i) => (
        <span key={c.label}>
          <span className="sv-axis sv-axis-v" style={{ left: `${c.x}%`, ...at(120 * i) }} data-reveal="fade" />
          <span className="sv-bubble" style={{ left: `${c.x}%`, top: "5.5%", ...at(120 * i + 500) }} data-reveal="fade">
            {c.label}
          </span>
        </span>
      ))}
      {ROWS.map((r, i) => (
        <span key={r.label}>
          <span className="sv-axis sv-axis-h" style={{ top: `${r.y}%`, ...at(300 + 120 * i) }} data-reveal="fade" />
          <span className="sv-bubble" style={{ left: "3.5%", top: `${r.y}%`, ...at(120 * i + 800) }} data-reveal="fade">
            {r.label}
          </span>
        </span>
      ))}
      <svg viewBox="0 0 64 40" className="sv-axes-section" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M14 6h36M14 34h36M32 6v28" />
        <path d="M14 6v4M50 6v4M14 34v-4M50 34v-4" />
      </svg>
    </div>
  );
}

/** Metal Fabrication: the weld seam that joins the two workshop photos, run in once (mirrored in Arabic). */
export function WeldSeam() {
  return (
    <svg viewBox="0 0 200 40" className="sv-draw sv-seam" data-reveal="fade" fill="none" aria-hidden focusable={false}>
      <path d="M4 20h192" stroke="var(--brass)" strokeWidth="1" strokeDasharray="2 5" />
      <path
        d="M8 20c4-8 8-8 12 0s8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0 8 8 12 0 8-8 12 0"
        stroke="var(--brand)"
        strokeWidth="2"
        pathLength={1}
      />
    </svg>
  );
}

/** Lift heights of the drawn tower (viewBox units, from the base up). */
const LIFTS = [300, 220, 140, 60];

/**
 * Scaffolding: a tower elevation drawn lift by lift from the base up — sole board, base plates, standards, ledgers,
 * braces and boards, ties to the building line, guardrails at the top. A generic drawing, not a specification.
 */
export function ScaffoldTower() {
  return (
    <svg viewBox="0 0 160 380" className="sv-draw sv-tower" data-reveal="fade" fill="none" aria-hidden focusable={false}>
      {/* Building line and ties */}
      <path d="M152 10v360" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="6 4" />
      <g stroke="var(--ink-3)" strokeWidth="1">
        <path d="M130 220h22M130 60h22" />
      </g>
      {/* Sole board and base plates */}
      <path d="M10 366h140" stroke="var(--ink-2)" strokeWidth="5" pathLength={1} />
      <g stroke="var(--brand)" strokeWidth="2">
        <path d="M22 360h16M122 360h16" />
      </g>
      {/* Standards */}
      <g stroke="var(--teal)" strokeWidth="2.2">
        <path d="M30 360V22" pathLength={1} />
        <path d="M130 360V22" pathLength={1} />
      </g>
      {/* Lifts: ledger, brace and working platform, drawn from the base up */}
      {LIFTS.map((y, i) => (
        <g key={y} style={at(280 + i * 220)}>
          <path d={`M30 ${y}h100`} stroke="var(--teal)" strokeWidth="2" pathLength={1} />
          <path d={i % 2 === 0 ? `M30 ${y + 80}L130 ${y}` : `M130 ${y + 80}L30 ${y}`} stroke="var(--teal)" strokeWidth="1.2" opacity="0.65" pathLength={1} />
          <rect x="31" y={y - 5} width="98" height="4" fill="color-mix(in srgb, var(--teal) 30%, transparent)" stroke="none" />
          <g fill="var(--brand)">
            <rect x="27" y={y - 3} width="6" height="6" />
            <rect x="127" y={y - 3} width="6" height="6" />
          </g>
        </g>
      ))}
      {/* Guardrails and toe board at the top */}
      <g stroke="var(--teal)" strokeWidth="1.6" style={at(1200)}>
        <path d="M30 26h100M30 42h100" pathLength={1} />
        <path d="M31 55h98" stroke="var(--ink-2)" strokeWidth="3" />
      </g>
    </svg>
  );
}
