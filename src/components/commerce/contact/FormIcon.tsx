import type { SVGProps } from "react";

/*
 * The four glyphs the quote form needs beyond the Modern Commerce icon family (Icon.tsx), drawn the same way: 24px grid,
 * round caps and joins, the theme's stroke. They live here, not in Icon.tsx, because Icon.tsx is bundled with the
 * homepage's client components: adding to it would change the frozen homepage's JavaScript. Decorative, like every icon.
 */
const paths = {
  alert: <path d="M12 3.75 21 19.5H3zM12 10v4M12 16.75v.01" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V5.5A1.5 1.5 0 0 0 14 4H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3" />
    </>
  ),
  upload: <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />,
  file: <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5zM13.5 3.5v5h5M9 13h6M9 16.5h4" />,
} as const;

export type FormIconName = keyof typeof paths;

export function FormIcon({ name, size = 20, className, ...props }: { name: FormIconName; size?: number } & SVGProps<SVGSVGElement>) {
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
      className={["mc-icon", className].filter(Boolean).join(" ")}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
