import type { CSSProperties } from "react";
import { LineIcon, type LineIconName } from "@/components/ui/LineIcons";

/**
 * How RAWASY works: the six steps as numbered cards in reading order, joined
 * by a rail along their top edge. Teal is the process colour.
 */
export function ProcessCards({ steps }: { steps: { slug: string; icon: LineIconName; title: string; body: string }[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, i) => (
        <li
          key={step.slug}
          className="card relative flex flex-col p-6 sm:p-7"
          data-tone="proc"
          data-reveal
          style={{ ["--d" as string]: (i % 3) * 80 } as CSSProperties}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(to_right,var(--tone)_0_2.5rem,var(--tone-line)_2.5rem)] rtl:bg-[linear-gradient(to_left,var(--tone)_0_2.5rem,var(--tone-line)_2.5rem)]" />
          <div className="flex items-center justify-between gap-4">
            <span className="icon-chip">
              <LineIcon name={step.icon} size={24} />
            </span>
            <span aria-hidden data-n={String(i + 1).padStart(2, "0")} className="outline-num t-stat text-[2.6rem]" dir="ltr" />
          </div>
          <h3 className="t-h3 mt-6 text-ink">{step.title}</h3>
          <p className="t-body mt-2">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
