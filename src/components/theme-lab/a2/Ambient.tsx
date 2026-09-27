import type { CSSProperties } from "react";

/*
 * A V2's site-wide ambient background (see a2.css, "Site-wide ambient"): fixed
 * to the screen behind every section and above the page colour. Layer A is a
 * sparse micro-dot pattern, drawn as a page-colour sheet perforated with the
 * dots, that drifts a few pixels; layer B is three large, soft colour fields
 * (warm orange, steel blue, muted teal) that move and breathe very slowly;
 * layer C, the one precision motif, is a soft band of light that passes behind
 * the perforation now and then, so the dots it crosses light up. Transform and
 * opacity only; nothing moves with reduced motion. Decoration: hidden from
 * assistive technology and never in the way of the pointer.
 *
 * `frame` (design-system sheet): the same layers inside a panel, held still at
 * a moment of the animation (seconds), so the motion can be shown as frames;
 * "still" shows them as reduced motion does.
 */
export function AmbientA2({ frame }: { frame?: number | "still" }) {
  const className = frame === undefined ? "a2-ambient" : `a2-ambient a2-ambient-frame${frame === "still" ? " a2-ambient-still" : ""}`;
  return (
    <div
      className={className}
      style={typeof frame === "number" ? ({ ["--at" as string]: `${frame}s` } as CSSProperties) : undefined}
      aria-hidden
    >
      <span className="a2-ambient-sweep" />
      <span className="a2-ambient-pattern" />
      <span className="a2-ambient-glow a2-ambient-warm" />
      <span className="a2-ambient-glow a2-ambient-cool" />
      <span className="a2-ambient-glow a2-ambient-teal" />
    </div>
  );
}
