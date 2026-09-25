import type { SVGProps } from "react";

/*
 * One icon family for the three Modern Commerce options: 24px grid, round caps
 * and joins, a stroke set by each option (--icon-stroke) and an optional second
 * tone (.duo shapes, shown through --duo-opacity / --duo-color). Decorative:
 * every icon sits beside a visible label and is hidden from assistive tech.
 */

const paths = {
  "laser-cutting": (
    <>
      <path className="duo" d="M8.5 3.5h7V7l-2 3h-3l-2-3z" />
      <path d="M8.5 3.5h7V7l-2 3h-3l-2-3z" />
      <path d="M12 10v4.25M3 18.5h7.25M13.75 18.5H21M9.75 15.25 8.5 14M14.25 15.25 15.5 14" />
    </>
  ),
  "cnc-bending": (
    <>
      <path className="duo" d="M10 3.5h4v7.25L12 15l-2-4.25z" />
      <path d="M10 3.5h4v7.25L12 15l-2-4.25z" />
      <path d="m3 10 9 6 9-6M6.5 20.5h11" />
    </>
  ),
  "steel-structures": (
    <>
      <path className="duo" d="M5 3.5h14V7h-5.25v10H19v3.5H5V17h5.25V7H5z" />
      <path d="M5 3.5h14V7h-5.25v10H19v3.5H5V17h5.25V7H5z" />
    </>
  ),
  fabrication: (
    <>
      <path className="duo" d="M3 14.5h8.25V20H3zM12.75 14.5H21V20h-8.25z" />
      <path d="M3 14.5h8.25V20H3zM12.75 14.5H21V20h-8.25zM18.75 4 13.5 11.25M20.5 5.5l-3.25-3M9.5 11.5 8 10M12 10.25v-2" />
    </>
  ),
  "laser-engraving": (
    <>
      <rect className="duo" x="3" y="12.5" width="18" height="8" rx="2" />
      <rect x="3" y="12.5" width="18" height="8" rx="2" />
      <path d="m6 17.75 2-2 2 2 2-2 2 2 2-2 2 2M12 3v6.5M10 3h4" />
    </>
  ),
  scaffolding: (
    <>
      <path className="duo" d="M6 4.5h12V10H6z" />
      <path d="M6 3v17.5M18 3v17.5M6 4.5h12M6 10h12M6 15.5h12M6 10l12 5.5M4 20.5h16" />
    </>
  ),
  power: (
    <>
      <path className="duo" d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />
      <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />
    </>
  ),
  bevel: (
    <>
      <path className="duo" d="M8.5 15h7L8.5 9.5z" />
      <path d="M20 12a8 8 0 1 1-2.35-5.65M20 4.5V8h-3.5M8.5 15h7L8.5 9.5z" />
    </>
  ),
  layers: (
    <>
      <path className="duo" d="m12 3 8.5 4.5L12 12 3.5 7.5z" />
      <path d="m12 3 8.5 4.5L12 12 3.5 7.5zM3.5 12 12 16.5l8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
    </>
  ),
  grid: (
    <>
      <path className="duo" d="M3.25 6h5v5h-5zM15.75 13h5v5h-5z" />
      <path d="M3.25 6h5v5h-5zM9.5 6h5v5h-5zM15.75 6h5v5h-5zM3.25 13h5v5h-5zM9.5 13h5v5h-5zM15.75 13h5v5h-5z" />
    </>
  ),
  machine: (
    <>
      <path className="duo" d="M3 13.5h18V20H3z" />
      <path d="M3 13.5h18V20H3zM6 13.5v-7h12v7M11 6.5v4h2v-4M5.5 20v1.5M18.5 20v1.5M6.5 16.75h3" />
    </>
  ),
  factory: (
    <>
      <path className="duo" d="M3 20.5V10l5 3v-3l5 3V6.5h8v14z" />
      <path d="M3 20.5V10l5 3v-3l5 3V6.5h8v14zM2 20.5h20M16.5 10.5v2M16.5 15.5v2" />
    </>
  ),
  shield: (
    <>
      <path className="duo" d="m12 3 7.5 3v5.5c0 4.6-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.9-7.5-9.5V6z" />
      <path d="m12 3 7.5 3v5.5c0 4.6-3.2 8.4-7.5 9.5-4.3-1.1-7.5-4.9-7.5-9.5V6zM8.75 12 11 14.25l4.25-4.5" />
    </>
  ),
  precision: (
    <>
      <circle className="duo" cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  truck: (
    <>
      <path className="duo" d="M3 6.5h11v10H3z" />
      <path d="M3 6.5h11v10H3zM14 10h4l3 3.5v3h-7" />
      <circle cx="7" cy="18" r="1.75" />
      <circle cx="17.5" cy="18" r="1.75" />
    </>
  ),
  doc: (
    <>
      <path className="duo" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  phone: (
    <>
      <rect className="duo" x="7" y="2.5" width="10" height="19" rx="2.5" />
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 5.5h3M11.25 18.5h1.5" />
    </>
  ),
  mail: (
    <>
      <rect className="duo" x="3" y="5" width="18" height="14" rx="2.5" />
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.75 7 8.25 6.25L20.25 7" />
    </>
  ),
  chat: (
    <>
      <path className="duo" d="M12 3.5a8.5 8.5 0 0 0-7.4 12.7l-1.1 4.3 4.4-1.1A8.5 8.5 0 1 0 12 3.5z" />
      <path d="M12 3.5a8.5 8.5 0 0 0-7.4 12.7l-1.1 4.3 4.4-1.1A8.5 8.5 0 1 0 12 3.5zM8.5 12h.01M12 12h.01M15.5 12h.01" />
    </>
  ),
  pin: (
    <>
      <path className="duo" d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z" />
    </>
  ),
  sun: (
    <>
      <circle className="duo" cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10" />,
} as const;

export type IconName = keyof typeof paths;

/** Icons that point along the reading direction flip in Arabic. */
const directional = new Set<IconName>(["arrow", "arrow-up-right"]);

export function Icon({ name, size = 22, className, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["lab-icon", directional.has(name) ? "rtl:-scale-x-100" : "", className].filter(Boolean).join(" ")}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export const iconNames = Object.keys(paths) as IconName[];
