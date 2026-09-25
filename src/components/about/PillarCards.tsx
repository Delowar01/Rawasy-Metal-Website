import type { CSSProperties } from "react";
import { LineIcon, type LineIconName } from "@/components/ui/LineIcons";
import type { Tone } from "@/lib/tones";

/** Why RAWASY: the pillars as cards with a line icon, each in its tone. */
export function PillarCards({ pillars }: { pillars: { slug: string; icon: LineIconName; tone: Tone; title: string; body: string }[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pillars.map((pillar, i) => (
        <li
          key={pillar.slug}
          className="card card-edge flex gap-5 p-6 sm:p-7"
          data-tone={pillar.tone}
          data-reveal
          style={{ ["--d" as string]: (i % 3) * 80 } as CSSProperties}
        >
          <span className="icon-chip">
            <LineIcon name={pillar.icon} size={24} />
          </span>
          <div className="min-w-0">
            <h3 className="t-h4 text-ink">{pillar.title}</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{pillar.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
