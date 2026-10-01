import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import type { Tone } from "../types";

export interface ContactRowData {
  icon: IconName;
  tone: Tone;
  label: string;
  value: ReactNode;
  href: string;
  /** What the link does: "Call", "Chat", "Send email", "View map". */
  action: string;
  external?: boolean;
  /** Numbers and addresses stay left to right inside Arabic text. */
  ltr?: boolean;
  /** A jump further down the page (the map). */
  down?: boolean;
}

/** An email address that may wrap only after the "@" on a narrow screen (the text itself is unchanged). */
export function breakableEmail(email: string) {
  const at = email.indexOf("@");
  if (at < 0) return email;
  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}

/**
 * One way to reach RAWASY as an actionable row, in the homepage's contact-row language: the tone's icon chip, the label
 * and the value, then what the link does with its arrow. External links open in a new tab and say so. On a narrow row
 * the action's word is left to assistive technology (it stays in the link's name) and the arrow stays.
 */
export function ContactRow({ row, externalLabel, compact = false }: { row: ContactRowData; externalLabel: string; compact?: boolean }) {
  return (
    <a
      href={row.href}
      {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={compact ? "contact-row card-link cp-row cp-row-compact" : "contact-row card-link cp-row"}
      data-tone={row.tone}
    >
      <span className="icon-chip shrink-0">
        <Icon name={row.icon} size={compact ? 18 : 20} />
      </span>
      <span className="cp-row-text">
        <span className="cp-row-label">{row.label}</span>
        <span className="cp-row-value">{row.ltr ? <span dir="ltr">{row.value}</span> : row.value}</span>
      </span>
      <span className="cp-row-action">
        <span className="cp-row-verb">{row.action}</span>
        {row.external && <span className="sr-only"> ({externalLabel})</span>}
        {row.down ? (
          <span className="cp-down">
            <Icon name="arrow" size={15} />
          </span>
        ) : (
          <Icon name={row.external ? "arrow-up-right" : "arrow"} size={15} />
        )}
      </span>
    </a>
  );
}
