import type { CSSProperties } from "react";
import { LineIcon, type LineIconName } from "@/components/ui/LineIcons";

export interface ApproachStat {
  slug: string;
  display: string;
  unit?: string;
  label: string;
}

/**
 * Engineering approach: the source-backed figures as steel stat plates, beside
 * the capability statements, each with its line icon.
 */
export function ApproachPanel({
  stats,
  statements,
}: {
  stats: ApproachStat[];
  statements: { icon: LineIconName; title: string; body: string }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <dl className="grid grid-cols-2 gap-4 lg:col-span-6">
        {stats.map((stat, i) => (
          <div
            key={stat.slug}
            className="card card-edge flex flex-col justify-between gap-6 p-5 sm:p-6"
            data-tone="eng"
            data-reveal
            style={{ ["--d" as string]: i * 70 } as CSSProperties}
          >
            <dt className="t-label text-ink-2">{stat.label}</dt>
            <dd className="t-stat flex items-start gap-1 text-[clamp(2.25rem,1.7rem+2vw,3.4rem)] text-ink" dir="ltr">
              {stat.display}
              {stat.unit && <span className="pt-1 text-[0.4em] font-medium text-[var(--eng-ink)]">{stat.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <ul className="panel-raised grid content-start lg:col-span-6">
        {statements.map((statement, i) => (
          <li
            key={statement.title}
            className="flex gap-5 border-b border-line p-5 last:border-b-0 sm:p-6"
            data-tone={i % 2 === 0 ? "eng" : "proc"}
            data-reveal
            style={{ ["--d" as string]: i * 70 } as CSSProperties}
          >
            <span className="icon-chip">
              <LineIcon name={statement.icon} size={24} />
            </span>
            <div className="min-w-0">
              <h3 className="t-h4 text-ink">{statement.title}</h3>
              <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-2">{statement.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
