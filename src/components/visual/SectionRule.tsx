import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Architectural hairline above a section header: a charcoal lead segment, a
 * rule that draws in the reading direction and measurement ticks at the end.
 */
export function SectionRule({ tone = "default", delay = 0, className }: { tone?: "default" | "band"; delay?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("section-rule", tone === "band" && "on-band", className)}
      data-reveal="rule"
      style={delay ? ({ ["--d" as string]: delay } as CSSProperties) : undefined}
    >
      <span />
    </span>
  );
}
