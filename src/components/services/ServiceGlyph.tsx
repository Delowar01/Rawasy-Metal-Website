import type { ReactNode } from "react";
import type { ServiceSlug } from "@/content/types";

/** Small technical pictograms, one per service line (decorative). */
export function ServiceGlyph({ slug, className }: { slug: ServiceSlug; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="square"
      aria-hidden
      focusable={false}
    >
      {GLYPHS[slug]}
    </svg>
  );
}

const GLYPHS: Record<ServiceSlug, ReactNode> = {
  // Nozzle, beam and a kerf through the sheet.
  "laser-cutting": (
    <>
      <path d="M12 4h8l-2 5h-4Z" />
      <path d="M16 9v10" strokeDasharray="1.6 1.6" />
      <path d="M4 22h10.5M17.5 22H28M4 26h24" />
    </>
  ),
  // Punch over a V-die, with the formed sheet.
  "cnc-bending": (
    <>
      <path d="M16 4v6M13 10h6" />
      <path d="M5 16l11 8 11-8" />
      <path d="M11 28l5-4 5 4" />
    </>
  ),
  // I-beam section.
  "steel-structures": (
    <>
      <path d="M8 5h16M8 27h16M16 5v22" />
      <path d="M8 5v3M24 5v3M8 27v-3M24 27v-3" />
    </>
  ),
  // T-joint with a weld bead.
  fabrication: (
    <>
      <path d="M4 24h24M16 24V7" />
      <path d="M13 21.5c1.2 0 2 .8 2 2M19 21.5c-1.2 0-2 .8-2 2" />
      <path d="M22 9l2.5-2.5M23 13h3M21 5.5V3" />
    </>
  ),
  // Plate with engraved lines.
  "laser-engraving": (
    <>
      <path d="M5 8h22v16H5Z" />
      <path d="M9 13h9M9 17h14M9 21h6" />
      <path d="M24 4l-3 3" />
    </>
  ),
  // Scaffold frame with a diagonal brace.
  scaffolding: (
    <>
      <path d="M8 4v24M24 4v24M8 10h16M8 20h16" />
      <path d="M8 20l16-10" />
      <path d="M5 28h6M21 28h6" />
    </>
  ),
};
