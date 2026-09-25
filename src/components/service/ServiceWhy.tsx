import type { CSSProperties } from "react";
import { LineIcon, type LineIconName } from "@/components/ui/LineIcons";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";

/**
 * Why RAWASY for this service: sourced points on one panel, divided into
 * cells, each with its line icon. Three or four points.
 */
export function ServiceWhy({ points, tone }: { points: { slug: string; icon: LineIconName; title: string; body?: string }[]; tone: Tone }) {
  return (
    <ul className={cn("card card-edge grid overflow-hidden sm:grid-cols-2", points.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")} data-tone={tone}>
      {points.map((point, i) => (
        <li
          key={point.slug}
          className={cn(
            "relative flex flex-col p-6 sm:p-7 lg:p-8",
            i > 0 && "border-t border-line sm:border-t-0",
            i % 2 === 1 && "sm:border-s sm:border-line",
            i >= 2 && "sm:border-t lg:border-t-0",
            i > 0 && "lg:border-s lg:border-line",
          )}
          data-reveal="fade"
          style={{ ["--d" as string]: 90 * i } as CSSProperties}
        >
          <span className="icon-chip">
            <LineIcon name={point.icon} size={24} />
          </span>
          <h3 className="t-h4 mt-6 text-ink">{point.title}</h3>
          {point.body && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{point.body}</p>}
        </li>
      ))}
    </ul>
  );
}
