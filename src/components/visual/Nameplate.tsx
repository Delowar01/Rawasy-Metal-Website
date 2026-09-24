import { cn } from "@/lib/utils";

/**
 * The registered company names on a riveted, brushed-metal plate, as if
 * engraved. Text on the plate uses ink or ink-2 only (contrast).
 */
export function Nameplate({ label, en, ar, className }: { label?: string; en: string; ar: string; className?: string }) {
  return (
    <div className={cn("panel-metal relative inline-flex max-w-full flex-col gap-2.5 px-8 py-6", className)}>
      <span aria-hidden className="rivets" />
      {label && <span className="t-label text-ink-2">{label}</span>}
      <span className="t-label text-ink" lang="en" dir="ltr">
        {en}
      </span>
      <span className="font-display text-[1.05rem] font-medium text-ink" lang="ar" dir="rtl">
        {ar}
      </span>
    </div>
  );
}
