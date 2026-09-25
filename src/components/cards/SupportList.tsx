import type { CSSProperties } from "react";
import { LineIcon } from "@/components/ui/LineIcons";
import type { SupportSlug } from "@/content/types";
import { cn } from "@/lib/utils";

/** Site-support capabilities as small teal tiles, each with its line icon. */
export function SupportList({ items, className }: { items: { slug: SupportSlug; label: string }[]; className?: string }) {
  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {items.map((item, i) => (
        <li
          key={item.slug}
          className="flex items-center gap-3 border border-line bg-elevated py-2 pe-3 ps-2 shadow-[var(--shadow-card)]"
          data-tone="proc"
          data-reveal="fade"
          style={{ ["--d" as string]: 50 * i } as CSSProperties}
        >
          <span className="icon-chip size-10">
            <LineIcon name={item.slug} size={21} />
          </span>
          <span className="text-[0.95rem] font-semibold leading-snug text-ink">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
