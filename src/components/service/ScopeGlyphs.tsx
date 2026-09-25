import type { ReactNode } from "react";

/**
 * Small technical drawings for the scope cards (64-unit grid, decorative):
 * cross-sections of the profiles laser cutting works on, formed profiles for
 * CNC bending, and engraved motifs for the engraving materials.
 */
function Glyph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden focusable={false}>
      {children}
    </svg>
  );
}

const section = { fill: "var(--tone-surface)" } as const;

/** Profile cross-sections (Laser Cutting). */
export function ProfileGlyph({ slug, className }: { slug: string; className?: string }) {
  switch (slug) {
    case "sheet":
      return (
        <Glyph className={className}>
          <path d="M6 30h52v6H6Z" {...section} />
          <path d="M10 30l4 6M18 30l4 6M26 30l4 6M34 30l4 6M42 30l4 6M50 30l4 6" strokeWidth="0.8" />
          <path d="M6 46h52M6 43v6M58 43v6" strokeWidth="0.8" stroke="var(--text-tertiary)" />
        </Glyph>
      );
    case "tube":
      return (
        <Glyph className={className}>
          <path d="M32 11a21 21 0 1 1 0 42 21 21 0 1 1 0-42Zm0 5a16 16 0 1 0 0 32 16 16 0 1 0 0-32Z" fillRule="evenodd" {...section} />
          <path d="M32 6v6M32 52v6M6 32h6M52 32h6" strokeWidth="0.8" stroke="var(--text-tertiary)" />
        </Glyph>
      );
    case "channel":
      return (
        <Glyph className={className}>
          <path d="M46 12H18v40h28v-7H25V19h21Z" {...section} />
          <path d="M52 12v40M49 12h6M49 52h6" strokeWidth="0.8" stroke="var(--text-tertiary)" />
        </Glyph>
      );
    case "angle":
      return (
        <Glyph className={className}>
          <path d="M18 12v40h32v-7H25V12Z" {...section} />
          <path d="M18 58h32M18 55v6M50 55v6" strokeWidth="0.8" stroke="var(--text-tertiary)" />
        </Glyph>
      );
    case "beam":
      return (
        <Glyph className={className}>
          <path d="M14 12h36v7H35.5v26H50v7H14v-7h14.5V19H14Z" {...section} />
          <path d="M8 12v40M5 12h6M5 52h6" strokeWidth="0.8" stroke="var(--text-tertiary)" />
        </Glyph>
      );
    case "bevel":
      return (
        <Glyph className={className}>
          <path d="M4 34h34l-9 12H4Z" {...section} />
          <path d="M42 6h12l-3 7h-6Z" />
          <ellipse cx="48" cy="9.5" rx="12" ry="4" strokeWidth="0.9" strokeDasharray="2 2.5" stroke="var(--accent)" />
          <path d="M48 13 34 40" stroke="var(--accent)" strokeDasharray="3 2" />
        </Glyph>
      );
    default:
      return null;
  }
}

/** Formed profiles (CNC Bending): the sheet in section, bends in orange. */
export function FoldGlyph({ slug, className }: { slug: string; className?: string }) {
  const sheet = { strokeWidth: 3, strokeLinecap: "butt" as const, strokeLinejoin: "round" as const };
  switch (slug) {
    case "sheet":
      return (
        <Glyph className={className}>
          <path d="M12 12v32q0 8 8 8h34" {...sheet} />
          <path d="M12 44q0 8 8 8" {...sheet} stroke="var(--accent)" />
          <path d="M24 40a10 10 0 0 0-8-8" strokeWidth="0.8" stroke="var(--text-tertiary)" />
        </Glyph>
      );
    case "structural":
      return (
        <Glyph className={className}>
          <path d="M12 14v30q0 8 8 8h24q8 0 8-8V14" {...sheet} />
          <path d="M12 44q0 8 8 8M44 52q8 0 8-8" {...sheet} stroke="var(--accent)" />
          <path d="M6 14h10M48 14h10" strokeWidth="0.8" stroke="var(--text-tertiary)" />
        </Glyph>
      );
    case "complex":
      return (
        <Glyph className={className}>
          <path d="M4 46h10q4 0 4-4V22q0-4 4-4h20q4 0 4 4v20q0 4 4 4h10" {...sheet} />
          <path d="M14 46q4 0 4-4M18 22q0-4 4-4M42 18q4 0 4 4M46 42q0 4 4 4" {...sheet} stroke="var(--accent)" />
        </Glyph>
      );
    case "repeat":
      return (
        <Glyph className={className}>
          {[0, 9, 18].map((o) => (
            <path key={o} d={`M${10 + o} ${10 + o}v18q0 5 5 5h${22 - o * 0.3}`} {...sheet} strokeWidth={2.4} opacity={1 - o / 40} />
          ))}
          <path d="M48 52h10M53 47v10" strokeWidth="0.8" stroke="var(--text-tertiary)" />
        </Glyph>
      );
    default:
      return null;
  }
}

/** Engraved motifs for the material swatches (drawn as groove and highlight). */
export function EngravedMotif({ slug, className }: { slug: string; className?: string }) {
  const motif = (() => {
    switch (slug) {
      case "metal":
        return (
          <>
            <rect x="10" y="14" width="44" height="36" />
            <path d="M16 23h24M16 30h32M16 37h18M16 44h26" />
            <circle cx="50" cy="18" r="1.5" />
          </>
        );
      case "wood":
        return (
          <>
            <path d="M32 10c10 8 14 16 14 22s-6 14-14 22c-8-8-14-16-14-22s4-14 14-22Z" />
            <path d="M32 16v36M32 26l-7-6M32 34l8-7M32 42l-7-6" />
          </>
        );
      case "plastics":
        return (
          <>
            <circle cx="32" cy="32" r="18" />
            <path d="M22 38l10-18 10 18ZM26 32h12" />
          </>
        );
      case "leather":
        return (
          <>
            <rect x="12" y="12" width="40" height="40" strokeDasharray="2.5 2" />
            <rect x="18" y="18" width="28" height="28" />
            <path d="M32 22l10 10-10 10-10-10Z" />
            <path d="M32 28l4 4-4 4-4-4Z" />
          </>
        );
      default:
        return null;
    }
  })();
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" strokeWidth="1.4" aria-hidden focusable={false}>
      <g className="engr-hi" transform="translate(0.6 0.6)">
        {motif}
      </g>
      <g className="engr-cut">{motif}</g>
    </svg>
  );
}
