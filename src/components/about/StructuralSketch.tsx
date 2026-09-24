import { cn } from "@/lib/utils";

/**
 * Elevation of a steel portal frame, drawn in fine line work behind the About
 * hero photograph. Purely decorative: no real dimensions are implied.
 */
export function StructuralSketch({ className }: { className?: string }) {
  const bays = [60, 180, 300, 420, 540];
  return (
    <svg
      viewBox="0 0 600 460"
      className={cn("line-draw", className)}
      data-reveal="fade"
      fill="none"
      stroke="currentColor"
      aria-hidden
      focusable={false}
    >
      <g strokeWidth="1">
        {/* Ground line and columns */}
        <path d="M20 400H580" pathLength={1} />
        {bays.map((x) => (
          <path key={x} d={`M${x} 400V170`} pathLength={1} />
        ))}
        {/* Pitched rafters with haunches */}
        <path d="M60 170L300 70L540 170" pathLength={1} />
        <path d="M60 188L300 88L540 188" pathLength={1} />
        {/* Purlins */}
        {[100, 140, 220, 260, 340, 380, 460, 500].map((x) => {
          const y = x <= 300 ? 170 - ((x - 60) / 240) * 100 : 70 + ((x - 300) / 240) * 100;
          return <path key={x} d={`M${x} ${y}v-9`} pathLength={1} />;
        })}
        {/* Cross bracing in the end bays */}
        <path d="M60 390L180 200M180 390L60 200" strokeDasharray="4 5" opacity="0.7" />
        <path d="M420 390L540 200M540 390L420 200" strokeDasharray="4 5" opacity="0.7" />
        {/* Base plates */}
        {bays.map((x) => (
          <path key={`b${x}`} d={`M${x - 9} 400h18`} strokeWidth="2.5" pathLength={1} />
        ))}
      </g>
      {/* Dimension rules */}
      <g className="text-accent" stroke="currentColor" strokeWidth="1">
        <path d="M60 432H540" />
        <path d="M60 424v16M540 424v16M180 428v8M300 428v8M420 428v8" />
      </g>
      <g strokeWidth="0.75" opacity="0.7">
        <path d="M570 70V400" />
        <path d="M562 70h16M562 400h16" />
      </g>
    </svg>
  );
}
