import type { SchematicKind } from "./data";

/**
 * A process sketch for a machine (Stage 1E): what kind of work it does, drawn as a concept — the cut along a part's
 * contour on a flat sheet (inside an enclosure for the enclosed laser), a cut around a tube, a sheet bent between a punch
 * and a die, a seam welded between two plates. Illustrative only: it shows no geometry, size, travel, angle or capacity
 * of the real machines, carries no figures, and is hidden from assistive technology (the text beside it says everything
 * it shows). The markup is the finished state — the state shown without script or with reduced motion; capabilities.css
 * plays the process once when its machine is shown on screen.
 */
export function Schematic({ kind }: { kind: SchematicKind }) {
  return (
    <svg className="sk" data-kind={kind} viewBox="0 0 240 132" aria-hidden focusable="false">
      {kind === "sheet" && <Sheet />}
      {kind === "enclosed" && <Enclosed />}
      {kind === "tube" && <Tube />}
      {kind === "bend" && <Bend />}
      {kind === "weld" && <Weld />}
    </svg>
  );
}

/** The laser head: a ring and its point, moved along the cut by capabilities.css. */
function Head({ x, y }: { x: number; y: number }) {
  return (
    <g className="sk-head">
      <circle className="sk-head-glow" cx={x} cy={y} r={9} />
      <circle className="sk-head-ring" cx={x} cy={y} r={5} />
      <circle className="sk-head-dot" cx={x} cy={y} r={1.6} />
    </g>
  );
}

/** Flatbed cutting: a part's contour cut from a sheet, beside parts nested on it. */
function Sheet() {
  return (
    <>
      <rect className="sk-plate" x={20} y={18} width={200} height={96} rx={4} />
      <circle className="sk-nested" cx={192} cy={42} r={12} />
      <rect className="sk-nested" x={178} y={64} width={28} height={36} rx={3} />
      <path className="sk-guide" d="M60 38H148L164 54V86L152 98H72L60 86Z" />
      <path className="sk-cut" d="M60 38H148L164 54V86L152 98H72L60 86Z" pathLength={1} />
      <Head x={60} y={38} />
    </>
  );
}

/** The enclosed laser: the same kind of contour cut, in a closed cabin. */
function Enclosed() {
  return (
    <>
      <rect className="sk-cabin" x={14} y={20} width={212} height={100} rx={8} />
      <rect className="sk-window" x={36} y={36} width={150} height={74} rx={4} />
      <path className="sk-seam" d="M196 36V110" />
      <rect className="sk-nested" x={204} y={44} width={12} height={22} rx={2} />
      <path className="sk-guide" d="M70 52H136L148 64V88L140 96H82L70 84Z" />
      <path className="sk-cut" d="M70 52H136L148 64V88L140 96H82L70 84Z" pathLength={1} />
      <Head x={70} y={52} />
    </>
  );
}

/** Tube cutting: a cut around a held tube as it turns. */
function Tube() {
  return (
    <>
      <rect className="sk-plate" x={8} y={38} width={14} height={52} rx={2} />
      <path className="sk-tube" d="M26 46H200M26 82H200" />
      <ellipse className="sk-tube" cx={200} cy={64} rx={7} ry={18} />
      <path className="sk-turn" d="M216 50A20 20 0 0 1 216 78" />
      <path className="sk-turn-tip" d="M211 75L216 80L221 74" />
      <ellipse className="sk-guide" cx={150} cy={64} rx={7} ry={18} />
      <ellipse className="sk-cut" cx={150} cy={64} rx={7} ry={18} pathLength={1} />
      <Head x={150} y={30} />
    </>
  );
}

/** CNC bending: a sheet formed between a punch and a die. */
function Bend() {
  return (
    <>
      <path className="sk-plate" d="M76 84H108L120 98L132 84H164V114H76Z" />
      <g className="sk-punch">
        <path className="sk-tool" d="M106 8H134V28L124 44H116L106 28Z" />
      </g>
      <path className="sk-blank sk-blank-a" d="M120 80H44" />
      <path className="sk-blank sk-blank-b" d="M120 80H196" />
      <circle className="sk-bend-point" cx={120} cy={80} r={3} />
    </>
  );
}

/** Laser welding: a seam joined between two plates. */
function Weld() {
  return (
    <>
      <rect className="sk-plate" x={26} y={22} width={90} height={88} rx={3} />
      <rect className="sk-plate" x={124} y={22} width={90} height={88} rx={3} />
      <path className="sk-guide" d="M120 28V104" />
      <path className="sk-cut sk-bead" d="M120 28q6 3 0 6q-6 3 0 6q6 3 0 6q-6 3 0 6q6 3 0 6q-6 3 0 6q6 3 0 6q-6 3 0 6q6 3 0 6q-6 3 0 6q6 3 0 6q-6 3 0 6q6 2 0 4" pathLength={1} />
      <Head x={120} y={28} />
    </>
  );
}
