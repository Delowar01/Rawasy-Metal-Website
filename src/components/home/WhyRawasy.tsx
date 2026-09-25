import { FrameMarks } from "@/components/visual/TechnicalFrame";
import type { Pillar } from "@/content/types";

export interface PillarView {
  slug: string;
  icon: Pillar["icon"];
  title: string;
  body: string;
}

function PillarIcon({ icon }: { icon: Pillar["icon"] }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.2, pathLength: 1 } as const;
  switch (icon) {
    case "precision":
      return (
        <>
          <circle cx="28" cy="28" r="18" {...p} />
          <circle cx="28" cy="28" r="6" {...p} />
          <path d="M28 4v12M28 40v12M4 28h12M40 28h12" {...p} className="text-accent" />
        </>
      );
    case "technology":
      return (
        <>
          <path d="M10 44h36M16 44V26h24v18" {...p} />
          <path d="M28 8v14" {...p} className="text-accent" />
          <path d="M22 14h12" {...p} />
        </>
      );
    case "craft":
      return (
        <>
          <path d="M8 40 30 18l8 8-22 22H8Z" {...p} />
          <path d="m34 14 4-4 8 8-4 4" {...p} className="text-accent" />
        </>
      );
    case "reliability":
      return (
        <>
          <path d="M28 6 46 13v14c0 12-8 19-18 23-10-4-18-11-18-23V13Z" {...p} />
          <path d="m20 28 6 6 11-12" {...p} className="text-accent" />
        </>
      );
    case "custom":
      return (
        <>
          <path d="M8 8h18v18H8zM30 30h18v18H30z" {...p} />
          <path d="M26 17h13v13" {...p} className="text-accent" />
        </>
      );
    default:
      return (
        <>
          <path d="M6 46h44M12 46V20l16-12 16 12v26" {...p} />
          <path d="M22 46V32h12v14" {...p} className="text-accent" />
        </>
      );
  }
}

/** Each pillar's colour role: engineering in steel, craft in brass, delivery in teal. */
const TONE: Record<string, string> = {
  precision: "eng",
  technology: "eng",
  craft: "craft",
  reliability: "proc",
  custom: "craft",
  execution: "proc",
};

/**
 * Why RAWASY — six pillars as cards, each with a coloured top edge in its
 * role colour and a line icon that draws itself in. Hovering a card shows its
 * corner marks.
 */
export function WhyRawasy({ pillars }: { pillars: PillarView[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pillars.map((pillar, i) => (
        <li
          key={pillar.slug}
          className="pillar card card-edge tf-host group relative p-7 sm:p-8"
          data-tone={TONE[pillar.icon] ?? "eng"}
          data-tf="hover"
          data-reveal
          style={{ ["--d" as string]: (i % 3) * 90 }}
        >
          <FrameMarks lines={false} />
          <div className="flex items-start justify-between">
            <span className="icon-chip icon-chip-lg">
              <svg viewBox="0 0 56 56" className="pillar-icon size-11" aria-hidden>
                <PillarIcon icon={pillar.icon} />
              </svg>
            </span>
            <span className="t-num text-xs text-ink-2">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <h3 className="t-h4 mt-7 text-ink">{pillar.title}</h3>
          <p className="t-body mt-3 max-w-sm text-[0.975rem]">{pillar.body}</p>
        </li>
      ))}
    </ul>
  );
}
