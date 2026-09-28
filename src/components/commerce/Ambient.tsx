import type { CSSProperties } from "react";

/*
 * The site-wide ambient background (Modern Commerce; see system.css, "Site-wide ambient"): fixed
 * to the screen behind every section and above the page colour. Two layers,
 * both moved by the compositor in whole-pixel steps (cheap even without a GPU):
 * the surface — the page colour, the micro-dots and the colour (warm orange,
 * steel blue, a touch of teal) in one opaque layer — drifts and breathes; the
 * one precision motif, a band of light made of orange dots on the same grid,
 * crosses it one dot column at a time and drifts with it, so the dots it passes
 * light up. Nothing moves with reduced motion. Decoration: hidden from assistive
 * technology and never in the way of the pointer.
 *
 * `frame` (the theme lab's design-system sheet): the same layers inside a panel, held still at
 * a moment of the animation (seconds); "still" shows them as reduced motion does.
 */
export function Ambient({ frame }: { frame?: number | "still" }) {
  const className = frame === undefined ? "a2-ambient" : `a2-ambient a2-ambient-frame${frame === "still" ? " a2-ambient-still" : ""}`;
  const style =
    typeof frame === "number" ? ({ ["--at" as string]: `${frame}s`, ["--f" as string]: sweepProgress(frame).toFixed(3) } as CSSProperties) : undefined;
  return (
    <div className={className} style={style} aria-hidden>
      <span className="a2-ambient-field" />
      <span className="a2-ambient-sweep" />
    </div>
  );
}

/** Where the light band is at a moment: 0 before it enters, 1 once it has left. Each 26 s it rests 20 %, crosses in 50 %, then rests. */
function sweepProgress(seconds: number) {
  const cycle = (seconds % 26) / 26;
  return Math.min(1, Math.max(0, (cycle - 0.2) / 0.5));
}
