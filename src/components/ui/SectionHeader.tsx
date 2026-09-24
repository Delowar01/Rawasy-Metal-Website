import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  index: string;
  label: string;
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
  tone?: "default" | "band";
}

/** Shared section opener: technical index + label, headline, optional intro/action. */
export function SectionHeader({ index, label, title, intro, action, id, className, tone = "default" }: SectionHeaderProps) {
  return (
    <div className={cn("grid gap-x-10 gap-y-6 lg:grid-cols-12", className)}>
      <p className={cn("t-label eyebrow lg:col-span-12", tone === "band" && "!text-band-ink-2")} data-reveal="fade">
        <span className="t-num">{index}</span>
        <span aria-hidden>/</span>
        <span>{label}</span>
      </p>
      <h2 id={id} className="t-h2 lg:col-span-7" data-reveal>
        {title}
      </h2>
      {(intro || action) && (
        <div className="flex flex-col items-start gap-6 lg:col-span-4 lg:col-start-9 lg:self-end" data-reveal style={{ ["--d" as string]: 120 }}>
          {intro && <p className={cn("t-lead", tone === "band" && "!text-band-ink-2")}>{intro}</p>}
          {action}
        </div>
      )}
    </div>
  );
}
