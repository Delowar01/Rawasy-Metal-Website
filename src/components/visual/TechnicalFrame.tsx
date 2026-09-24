import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Decorative layers of a technical frame, for any element that has the
 * `tf-host` class: base rules, an accent highlight that draws on hover, focus
 * or `data-active`, corner marks and a marker that runs the top edge (once on
 * reveal, then on hover or focus). Hidden from assistive technology.
 */
export function FrameMarks({ lines = true, corners = true }: { lines?: boolean; corners?: boolean }) {
  return (
    <>
      {lines && <span aria-hidden className="tf" />}
      <span aria-hidden className="tf-hl" />
      {corners && <span aria-hidden className="tf-c" />}
      <span aria-hidden className="tf-m" />
    </>
  );
}

/**
 * A container drawn like a technical sheet. With `reveal` the rules draw in
 * as it scrolls into view (horizontal, then vertical) and a marker runs the
 * top edge once; hovering or focusing inside draws the accent edges.
 */
export function TechnicalFrame({
  as: Tag = "div",
  reveal = false,
  delay = 0,
  lines = "full",
  active,
  className,
  style,
  children,
  id,
}: {
  as?: ElementType;
  reveal?: boolean;
  delay?: number;
  /** "full": rules and corner marks; "corners": corner marks only; "hover": corner marks only while hovered, focused or active. */
  lines?: "full" | "corners" | "hover";
  active?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn("tf-host", className)}
      data-tf={lines === "full" ? undefined : lines}
      data-reveal={reveal ? "frame" : undefined}
      data-active={active || undefined}
      style={{ ...(delay ? { ["--d" as string]: delay } : null), ...style }}
    >
      {children}
      <FrameMarks />
    </Tag>
  );
}
