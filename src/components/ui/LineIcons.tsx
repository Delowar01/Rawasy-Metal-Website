import type { ReactNode, SVGProps } from "react";

/**
 * Industrial line icons on a 32-unit grid: square caps, mitred joins, one
 * stroke weight. They sit in `.icon-chip` holders and take the tone colour
 * (currentColor). Always decorative — the text next to them names the thing.
 */
export type LineIconName =
  // Service lines
  | "laser-cutting"
  | "cnc-bending"
  | "steel-structures"
  | "fabrication"
  | "laser-engraving"
  | "scaffolding"
  // Site support
  | "formwork"
  | "props"
  | "new-structures"
  | "rental"
  | "installation"
  | "transport"
  // Process
  | "understand"
  | "engineer"
  | "inspect"
  // Company
  | "vision"
  | "precision"
  | "quality"
  | "certificate"
  | "workshop"
  | "machinery"
  | "projects"
  | "clients"
  | "integrated";

const PATHS: Record<LineIconName, ReactNode> = {
  "laser-cutting": (
    <>
      <path d="M11 3h10v6l-2.5 3h-5L11 9Z" />
      <path d="M16 12v9" />
      <path d="M12.5 19.5 11 18M19.5 19.5 21 18" />
      <path d="M3 27.5 9 22h20l-6 5.5Z" />
      <path d="M13 24.8h7" />
    </>
  ),
  "cnc-bending": (
    <>
      <path d="M10 3h12v5l-6 7-6-7Z" />
      <path d="M3 17h9l4 5 4-5h9" />
      <path d="M8 29v-6h5l3 3.5 3-3.5h5v6Z" />
    </>
  ),
  "steel-structures": (
    <>
      <path d="M3 9h26M3 19h26" />
      <path d="m3 19 5.2-10 5.2 10 5.2-10 5.2 10L29 9" />
      <path d="M6 19v10M26 19v10" />
    </>
  ),
  fabrication: (
    <>
      <path d="M5 28V13h5v10h17v5Z" />
      <path d="m28 4-8 8" />
      <path d="m17.5 14.5 3-3 2 2-3 3Z" />
      <path d="m15 20-2.5 1.2M17 22.5l-.8 2.6M13.8 17.2l-2.6-.6" />
    </>
  ),
  "laser-engraving": (
    <>
      <path d="M4 10h19v18H4Z" />
      <path d="M8 15h8M8 19h11M8 23h6" />
      <path d="M22 3h6v4h-6Z" />
      <path d="M25 7v9" />
      <path d="M23.2 18.5h3.6" />
    </>
  ),
  scaffolding: (
    <>
      <path d="M7 3v26M16 3v26M25 3v26" />
      <path d="M4 10h24M4 19h24M4 28h24" />
      <path d="m7 19 9-9M16 28l9-9" />
    </>
  ),
  formwork: (
    <>
      <path d="M11 4h10v24H11Z" />
      <path d="M7 6v20M25 6v20" />
      <path d="M4 11h24M4 21h24" />
      <path d="m3 29 4-6M29 29l-4-6" />
    </>
  ),
  props: (
    <>
      <path d="M10 3h12M16 3v10" />
      <path d="M13.5 13h5v14h-5Z" />
      <path d="M11 17.5h10" />
      <path d="M9 29h14" />
    </>
  ),
  "new-structures": (
    <>
      <path d="M7 29V3M4 29h8" />
      <path d="M7 5h20l-3 3" />
      <path d="M22 5v6" />
      <path d="M20 11h4v3h-4Z" />
      <path d="M14 29V19h14v10M14 24h14M21 19v10" />
    </>
  ),
  rental: (
    <>
      <path d="M4 7h24v21H4ZM4 13h24" />
      <path d="M10 4v6M22 4v6" />
      <path d="M11.5 20.5a4.5 4.5 0 1 0 1.3-3.2" />
      <path d="M12.8 14.5v2.8h2.8" />
    </>
  ),
  installation: (
    <>
      <path d="M16 3v7" />
      <path d="M16 10a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M16 15 8 22M16 15l8 7" />
      <path d="M5 22h22v4H5Z" />
      <path d="M3 29h26" />
    </>
  ),
  transport: (
    <>
      <path d="M2 21V9h16v12" />
      <path d="M18 13h6l5 5v5h-3" />
      <path d="M2 23h4M12 23h8" />
      <circle cx="9" cy="23.5" r="2.7" />
      <circle cx="23" cy="23.5" r="2.7" />
    </>
  ),
  understand: (
    <>
      <path d="M6 3h13l7 7v19H6Z" />
      <path d="M19 3v7h7" />
      <circle cx="14" cy="18" r="4.2" />
      <path d="m17.2 21.2 4.3 4.3" />
    </>
  ),
  engineer: (
    <>
      <circle cx="16" cy="7" r="2.2" />
      <path d="M16 3v1.8" />
      <path d="m15 9-7 19M17 9l7 19" />
      <path d="M9.6 22.5c4.2 1.8 8.6 1.8 12.8 0" />
    </>
  ),
  inspect: (
    <>
      <path d="M5 26a11 11 0 1 1 22 0" />
      <path d="M3 26h26" />
      <path d="m16 26 6-8" />
      <path d="M16 15v2M8.2 18.2l1.4 1.4M23.8 18.2l-1.4 1.4M5 26h2M25 26h2" />
    </>
  ),
  vision: (
    <>
      <path d="m16 3 3.4 9.6L29 16l-9.6 3.4L16 29l-3.4-9.6L3 16l9.6-3.4Z" />
      <path d="m16 11 1.6 3.4L21 16l-3.4 1.6L16 21l-1.6-3.4L11 16l3.4-1.6Z" />
    </>
  ),
  precision: (
    <>
      <circle cx="16" cy="16" r="9" />
      <circle cx="16" cy="16" r="3" />
      <path d="M16 3v6M16 23v6M3 16h6M23 16h6" />
    </>
  ),
  quality: (
    <>
      <path d="M16 3 27 7.5V16c0 6.5-4.5 10.8-11 13-6.5-2.2-11-6.5-11-13V7.5Z" />
      <path d="m10.5 16 4 4 7.5-8" />
    </>
  ),
  certificate: (
    <>
      <path d="M4 5h24v16H4Z" />
      <path d="M8 10h14M8 14h9" />
      <circle cx="22" cy="21" r="4" />
      <path d="m19.5 24.2-1.5 4.8 4-2 4 2-1.5-4.8" />
    </>
  ),
  workshop: (
    <>
      <path d="M2 29h28" />
      <path d="M4 29V15l6 4v-4l6 4v-4l6 4v10" />
      <path d="M23 29V5h5v24" />
      <path d="M8 24h3M14 24h3" />
    </>
  ),
  machinery: (
    <>
      <path d="M3 8h26v15H3Z" />
      <path d="M7 12h12v7H7Z" />
      <path d="M22 12h4M22 15.5h4M22 19h2" />
      <path d="M6 23v6M26 23v6M3 29h26" />
    </>
  ),
  projects: (
    <>
      <path d="M4 6h24v20H4Z" />
      <path d="m4 22 7-7 5.5 5.5 4-4L28 24" />
      <circle cx="21.5" cy="11.5" r="2" />
    </>
  ),
  clients: (
    <>
      <path d="M3 29h26" />
      <path d="M5 29V12h9v17M14 29V5h13v24" />
      <path d="M8 16h3M8 20h3M8 24h3M18 9h5M18 13h5M18 17h5M18 21h5" />
    </>
  ),
  integrated: (
    <>
      <path d="M4 4h10v10H4ZM18 4h10v10H18ZM4 18h10v10H4Z" />
      <path d="M18 18h10v10H18Z" />
      <path d="M14 9h4M9 14v4M23 14v4M14 23h4" />
    </>
  ),
};

export function LineIcon({ name, size = 26, ...props }: { name: LineIconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      focusable={false}
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
