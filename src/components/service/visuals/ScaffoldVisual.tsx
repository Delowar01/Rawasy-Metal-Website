import type { CSSProperties } from "react";
import { MediaFrame } from "@/components/inner/MediaFrame";
import { Backdrop } from "@/components/visual/Backdrop";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import type { MediaId } from "@/content/types";

/** Lift heights of the drawn tower (viewBox units, from the base up). */
const LIFTS = [300, 220, 140, 60];

/**
 * Scaffolding hero: a tower elevation drawn lift by lift on a teal sheet —
 * sole boards, base plates, standards, ledgers, braces and boards, with ties
 * to the building line — beside the site photograph. A generic drawing, not a
 * specification.
 */
export function ScaffoldVisual({ image, figure, caption }: { image: { id: MediaId; alt: string }; figure: string; caption: string }) {
  return (
    <div className="flex items-end">
      <div className="tf-host panel-raised relative isolate z-0 w-[34%] shrink-0 overflow-hidden" data-tone="proc" data-reveal="frame">
        <Backdrop kind="fine" className="[--grid-line:color-mix(in_srgb,var(--proc)_16%,transparent)]" />
        <svg viewBox="0 0 160 380" className="line-draw relative block w-full" data-reveal="fade" fill="none" aria-hidden focusable={false}>
          {/* Building line and ties */}
          <path d="M152 10v360" stroke="var(--text-tertiary)" strokeWidth="1" strokeDasharray="6 4" />
          <g stroke="var(--text-tertiary)" strokeWidth="1">
            <path d="M130 220h22M130 60h22" />
          </g>
          {/* Sole board and base plates */}
          <path d="M10 366h140" stroke="var(--text-secondary)" strokeWidth="5" pathLength={1} />
          <g stroke="var(--accent)" strokeWidth="2">
            <path d="M22 360h16M122 360h16" />
          </g>
          {/* Standards */}
          <g stroke="var(--proc)" strokeWidth="2.2">
            <path d="M30 360V22" pathLength={1} />
            <path d="M130 360V22" pathLength={1} />
          </g>
          {/* Lifts: ledger, brace and working platform, drawn from the base up */}
          {LIFTS.map((y, i) => (
            <g key={y} style={{ ["--d" as string]: 280 + i * 220 } as CSSProperties}>
              <path d={`M30 ${y}h100`} stroke="var(--proc)" strokeWidth="2" pathLength={1} />
              <path d={i % 2 === 0 ? `M30 ${y + 80}L130 ${y}` : `M130 ${y + 80}L30 ${y}`} stroke="var(--proc)" strokeWidth="1.2" opacity="0.65" pathLength={1} />
              <rect x="31" y={y - 5} width="98" height="4" fill="color-mix(in srgb, var(--proc) 30%, transparent)" stroke="none" />
              <g fill="var(--accent)">
                <rect x="27" y={y - 3} width="6" height="6" />
                <rect x="127" y={y - 3} width="6" height="6" />
              </g>
            </g>
          ))}
          {/* Guardrails and toe board at the top */}
          <g stroke="var(--proc)" strokeWidth="1.6" style={{ ["--d" as string]: 1200 } as CSSProperties}>
            <path d="M30 26h100M30 42h100" pathLength={1} />
            <path d="M31 55h98" stroke="var(--text-secondary)" strokeWidth="3" />
          </g>
        </svg>
        <FrameMarks lines={false} />
      </div>
      <MediaFrame
        id={image.id}
        alt={image.alt}
        figure={figure}
        caption={caption}
        frame="plain"
        raised
        parallax={false}
        preload
        delay={200}
        sizes="(min-width: 1024px) 420px, 64vw"
        className="relative z-10 -ms-[4%] mb-[12%] w-[70%]"
      />
    </div>
  );
}
