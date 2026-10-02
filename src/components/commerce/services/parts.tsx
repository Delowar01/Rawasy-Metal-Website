import type { ReactNode } from "react";
import { Icon } from "../Icon";
import type { Tone } from "../types";

/** The surface of a section: open on the page (its text on reading zones), or a muted or raised sheet. */
export type Surface = "plain" | "muted" | "raised";

/** Sections alternate down the page: open, muted sheet, open, raised sheet … (no two sheets touch). */
export const surfaceAt = (i: number): Surface => (i % 2 === 0 ? "plain" : Math.floor(i / 2) % 2 === 0 ? "muted" : "raised");

export interface SectionAction {
  href: string;
  label: string;
  variant?: "secondary" | "steel";
}

/** A section's head: its number and label, the heading, the lead and a link onwards (the previous design's order). */
export function SvHead({
  id,
  index,
  label,
  title,
  intro,
  tone,
  read,
  action,
}: {
  id: string;
  index: string;
  label: string;
  title: string;
  intro?: string;
  tone: Tone;
  read: boolean;
  action?: SectionAction;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
      <div className={read ? "a2-read max-w-[44rem]" : "max-w-[44rem]"} data-reveal>
        <p className="eyebrow" data-tone={tone}>
          <span className="ip-index">{index}</span>
          {label}
        </p>
        <h2 id={id} className="t-h2 mt-4">
          {title}
        </h2>
        {intro && <p className="t-lead mt-4">{intro}</p>}
      </div>
      {action && (
        <a href={action.href} className={`btn btn-${action.variant ?? "secondary"} shrink-0`} data-reveal="fade">
          {action.label}
          <Icon name="arrow" size={17} />
        </a>
      )}
    </div>
  );
}

/** One section of a service page: its surface, its head and its content. No reveal on the section itself (anchors land on it). */
export function SvSection({
  id,
  surface,
  index,
  label,
  title,
  intro,
  tone,
  action,
  children,
}: {
  id: string;
  surface: Surface;
  index: string;
  label: string;
  title: string;
  intro?: string;
  tone: Tone;
  action?: SectionAction;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={surface === "plain" ? "sec" : `sec sec-sheet sec-${surface}`}>
      <div className="shell">
        <SvHead id={`${id}-title`} index={index} label={label} title={title} intro={intro} tone={tone} read={surface === "plain"} action={action} />
        <div className="sv-body">{children}</div>
      </div>
    </section>
  );
}
