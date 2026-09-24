import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Decorative section background: an engineering grid, a fine grid or a
 * perforated field. With `drift` the pattern moves almost imperceptibly while
 * it is on screen (never with reduced motion or without JavaScript).
 * Place it inside a positioned, isolated container.
 *
 * Fade a drifting pattern with `--bd-fade` (a gradient towards the section
 * colour) and dim it with `--bd-opacity`, not with a mask or `opacity` on the
 * element: those force the moving layer to be recomposited on every frame.
 */
export function Backdrop({
  kind = "grid",
  drift = false,
  className,
  style,
}: {
  kind?: "grid" | "fine" | "perforated";
  drift?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("backdrop", `backdrop-${kind}`, className)}
      data-drift={drift || undefined}
      data-live={drift ? "off" : undefined}
      style={style}
    />
  );
}

/**
 * A thin scan line that passes slowly through a technical area while it is on
 * screen. Place it inside a positioned container.
 */
export function ScanLine({ className, duration, delay }: { className?: string; duration?: number; delay?: number }) {
  return (
    <span
      aria-hidden
      className={cn("scan", className)}
      data-live="off"
      style={
        {
          ...(duration ? { ["--scan-dur"]: `${duration}s` } : null),
          ...(delay ? { ["--scan-delay"]: `${delay}s` } : null),
        } as CSSProperties
      }
    />
  );
}
