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

/** Why RAWASY — six pillars on a technical sheet (rules, not cards). */
export function WhyRawasy({ pillars }: { pillars: PillarView[] }) {
  return (
    <ul className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-3">
      {pillars.map((pillar, i) => (
        <li
          key={pillar.slug}
          className="pillar group relative border-b border-line p-7 sm:p-8 sm:[&:nth-child(odd)]:border-e lg:border-e lg:[&:nth-child(3n)]:border-e-0 lg:p-10"
          data-reveal
          style={{ ["--d" as string]: (i % 3) * 90 }}
        >
          <div className="flex items-start justify-between">
            <svg viewBox="0 0 56 56" className="pillar-icon size-14 text-ink" aria-hidden>
              <PillarIcon icon={pillar.icon} />
            </svg>
            <span className="t-num text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <h3 className="t-h4 mt-8 text-ink">{pillar.title}</h3>
          <p className="t-body mt-3 max-w-sm text-[0.975rem]">{pillar.body}</p>
          <span aria-hidden className="absolute inset-x-0 top-0 h-px origin-[var(--origin-start)] scale-x-0 bg-accent transition-transform duration-700 ease-out-expo group-hover:scale-x-100" />
        </li>
      ))}
    </ul>
  );
}
