import type { ReactNode } from "react";
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
}

/** One ruled row of the contact sheet: index, label with icon, then links or text. */
export function ContactMethod({
  index,
  label,
  icon,
  links,
  children,
}: {
  index: string;
  label: string;
  icon: ReactNode;
  links?: ContactLink[];
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-line py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
      <span className="t-num pt-0.5 text-xs text-ink-2">{index}</span>
      <div className="min-w-0">
        <p className="t-label flex items-center gap-2.5 text-ink-2">
          <span className="text-accent-ink">{icon}</span>
          {label}
        </p>
        {links && (
          <ul className="mt-2.5 grid gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-1"
                >
                  <span
                    dir={link.ltr ? "ltr" : undefined}
                    className="min-w-0 break-words font-display text-[1.1rem] font-semibold text-ink transition-colors group-hover:text-accent-ink sm:text-[1.2rem]"
                  >
                    {link.value}
                  </span>
                  <span className="t-label flex shrink-0 items-center gap-1.5 text-ink-2 transition-colors group-hover:text-ink">
                    {link.action}
                    {link.external ? (
                      <ArrowUpRightIcon size={14} className="rtl:-scale-x-100" />
                    ) : (
                      <ArrowIcon size={14} className="rtl:-scale-x-100" />
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {children && <div className="mt-2.5">{children}</div>}
      </div>
    </div>
  );
}

/** The contact sheet: a titled, ruled block like a drawing's title block. */
export function ContactSheet({ label, children }: { label: string; children: ReactNode }) {
  return (
    <address className="not-italic">
      <div className="border border-line-strong bg-elevated px-5 sm:px-7">
        <p className="t-label flex items-center gap-3 border-b border-line-strong py-4 text-ink-2">
          <span aria-hidden className="size-1.5 bg-accent" />
          {label}
        </p>
        <div className="[&>*:last-child]:border-b-0">{children}</div>
      </div>
    </address>
  );
}
