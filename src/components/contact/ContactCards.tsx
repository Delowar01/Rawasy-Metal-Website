import type { ReactNode } from "react";
import type { Tone } from "@/lib/tones";
import { ArrowIcon, ArrowUpRightIcon } from "@/components/ui/Icons";

export interface ContactLink {
  href: string;
  /** Visible value, e.g. the phone number or email address. */
  value: string;
  /** Short verb shown at the end of the row (Call, Email…). */
  action: string;
  external?: boolean;
  /** Numbers and addresses stay left-to-right inside Arabic text. */
  ltr?: boolean;
  /** Arrow direction for in-page links (down to a section). */
  down?: boolean;
}

/**
 * A contact link row: the value, then the action with an arrow — side by side,
 * or stacked (`stacked`) in narrow cards so every card reads the same way.
 */
export function ContactRow({ link, externalLabel, stacked }: { link: ContactLink; externalLabel: string; stacked?: boolean }) {
  return (
    <a
      href={link.href}
      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={
        stacked
          ? "contact-row group flex flex-col items-start gap-1 border-t border-line py-3"
          : "contact-row group flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-t border-line py-2.5"
      }
    >
      <span
        dir={link.ltr ? "ltr" : undefined}
        className="min-w-0 max-w-full break-words font-display text-[1.04rem] font-semibold text-ink transition-colors group-hover:text-[var(--tone-ink)] sm:text-[1.08rem]"
      >
        {link.value}
      </span>
      <span className="t-label flex shrink-0 items-center gap-1.5 text-ink-2 transition-colors group-hover:text-ink">
        {link.action}
        {link.external && <span className="sr-only"> ({externalLabel})</span>}
        {link.external ? (
          <ArrowUpRightIcon
            size={14}
            className="transition-transform duration-500 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-[calc(var(--dir)*3px)] group-focus-visible:translate-x-[calc(var(--dir)*3px)] rtl:-scale-x-100"
          />
        ) : (
          <ArrowIcon
            size={14}
            className={
              link.down
                ? "rotate-90 transition-transform duration-500 ease-out-expo group-hover:translate-y-0.5"
                : "transition-transform duration-500 ease-out-expo group-hover:translate-x-[calc(var(--dir)*4px)] group-focus-visible:translate-x-[calc(var(--dir)*4px)] rtl:-scale-x-100"
            }
          />
        )}
      </span>
    </a>
  );
}

/** A contact method as a card: an icon chip in the card's tone, a label, then its links or text. */
export function ContactCard({
  tone,
  icon,
  label,
  links,
  externalLabel,
  children,
  className,
}: {
  tone: Tone;
  icon: ReactNode;
  label: string;
  links?: ContactLink[];
  externalLabel: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card card-edge flex flex-col p-5 sm:p-6 ${className ?? ""}`} data-tone={tone}>
      <p className="flex items-center gap-3 pb-4">
        <span className="icon-chip size-10">{icon}</span>
        <span className="t-label tone-ink">{label}</span>
      </p>
      {children && <div className="border-t border-line pb-3 pt-3">{children}</div>}
      {links && (
        <ul className="mt-auto grid">
          {links.map((link) => (
            <li key={link.href}>
              <ContactRow link={link} externalLabel={externalLabel} stacked />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
