import type { CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { LineIcon, type LineIconName } from "@/components/ui/LineIcons";
import type { Tone } from "@/lib/tones";

export interface Division {
  slug: string;
  label: string;
  title: string;
  body: string;
  link: { href: string; label: string };
  tone: Tone;
  icon: LineIconName;
}

/**
 * The two sections of the business as two large panels, each in its tone,
 * with a faint oversized icon behind the text and a link down to its section.
 */
export function DivisionPanels({ divisions }: { divisions: Division[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {divisions.map((division, i) => (
        <li
          key={division.slug}
          className="card card-edge relative isolate flex flex-col overflow-hidden p-7 sm:p-9"
          data-tone={division.tone}
          data-reveal
          style={{ ["--d" as string]: i * 90 } as CSSProperties}
        >
          <LineIcon
            name={division.icon}
            size={220}
            strokeWidth={0.6}
            className="pointer-events-none absolute -bottom-10 -end-8 -z-10 text-[var(--tone)] opacity-[0.12]"
          />
          <span className="icon-chip icon-chip-lg">
            <LineIcon name={division.icon} size={30} />
          </span>
          <p className="t-label tone-ink mt-7">{division.label}</p>
          <h3 className="t-title mt-2 text-ink">{division.title}</h3>
          <p className="t-body mt-4 max-w-[30rem]">{division.body}</p>
          <a href={division.link.href} className="group mt-8 inline-flex items-center gap-2 self-start text-[0.95rem] font-semibold text-ink">
            <span className="link-line">{division.link.label}</span>
            <ArrowIcon size={16} className="rotate-90 transition-transform duration-500 ease-out-expo group-hover:translate-y-0.5" />
          </a>
        </li>
      ))}
    </ul>
  );
}
