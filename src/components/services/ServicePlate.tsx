import type { ServiceSlug } from "@/content/types";
import { ServiceGlyph } from "./ServiceGlyph";

export interface ServicePlateItem {
  slug: ServiceSlug;
  index: string;
  name: string;
}

/**
 * The services index as a laser-cut sample plate: six cut cells on brushed
 * metal, each jumping to its service below.
 */
export function ServicePlate({ items, label }: { items: ServicePlateItem[]; label: string }) {
  return (
    <nav aria-label={label} className="relative" data-reveal="fade" style={{ ["--d" as string]: 180 }}>
      <div className="plate-sheet brushed relative p-3 shadow-[var(--shadow-soft)] sm:p-4">
        <ol className="grid grid-cols-2 gap-px bg-[var(--metal-edge)] sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.slug} className="bg-[color-mix(in_srgb,var(--surface-elevated)_82%,transparent)]">
              <a
                href={`#${item.slug}`}
                className="group flex h-full min-h-[8.5rem] flex-col justify-between gap-5 p-4 transition-colors hover:bg-background sm:min-h-[9.5rem] sm:p-5"
              >
                <span className="flex items-start justify-between gap-3">
                  <ServiceGlyph
                    slug={item.slug}
                    className="size-9 text-ink-2 transition-colors duration-300 group-hover:text-accent-ink sm:size-10"
                  />
                  <span className="t-num text-[0.7rem] text-ink-3">{item.index}</span>
                </span>
                <span className="font-display text-[0.95rem] font-semibold leading-snug text-ink">{item.name}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
      <div aria-hidden className="t-label mt-4 flex items-center gap-4 text-ink-3" dir="ltr">
        <span className="t-num">RW—S</span>
        <span className="h-px flex-1 bg-line-strong" />
        <span className="t-num">01—06</span>
      </div>
    </nav>
  );
}
