import { Icon } from "../Icon";
import type { Tone } from "../types";

/** A section's label, heading and lead, with an optional link onwards. */
export function SectionHead({
  id,
  label,
  title,
  intro,
  action,
  tone = "brand",
  className = "",
  read = false,
}: {
  id: string;
  label: string;
  title: string;
  intro?: string;
  action?: { href: string; label: string };
  tone?: Tone;
  className?: string;
  /** On a plain section: a reading zone keeps the ambient out from under the text. */
  read?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-10 gap-y-6 ${className}`}>
      <div className={read ? "a2-read max-w-[44rem]" : "max-w-[44rem]"} data-reveal>
        <p className="eyebrow" data-tone={tone}>
          {label}
        </p>
        <h2 id={id} className="t-h2 mt-4">
          {title}
        </h2>
        {intro && <p className="t-lead mt-4">{intro}</p>}
      </div>
      {action && (
        <a href={action.href} className="btn btn-secondary shrink-0" data-reveal="fade">
          {action.label}
          <Icon name="arrow" size={17} />
        </a>
      )}
    </div>
  );
}
