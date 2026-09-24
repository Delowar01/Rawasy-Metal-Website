import type { ReactNode } from "react";
import { Phrases } from "@/components/ui/Phrases";
import { SectionRule } from "@/components/visual/SectionRule";
import { cn } from "@/lib/utils";

/**
 * Inner-page section with a pinned heading column and a content column —
 * a calmer, editorial counterpart to the homepage's full-width headers.
 */
export function EditorialSection({
  id,
  index,
  label,
  title,
  intro,
  note,
  children,
  className,
  headerClassName,
}: {
  id: string;
  index?: string;
  label: string;
  title: string;
  intro?: string;
  /** Extra material under the heading, e.g. a short note or steps. */
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("section-y relative", className)}>
      <div className="container-x">
        <SectionRule className="mb-10 lg:mb-14" />
      </div>
      <div className="container-x grid gap-x-10 gap-y-12 lg:grid-cols-12">
        <header className={cn("lg:sticky lg:top-28 lg:col-span-4 lg:self-start", headerClassName)}>
          <p className="t-label eyebrow" data-reveal="fade">
            {index && (
              <>
                <span className="t-num">{index}</span>
                <span aria-hidden>/</span>
              </>
            )}
            <span>{label}</span>
          </p>
          <h2 id={`${id}-title`} className="t-h2-compact mt-6 max-w-[13em] text-ink" data-reveal>
            <Phrases>{title}</Phrases>
          </h2>
          {intro && (
            <p className="t-lead mt-6 max-w-[30rem]" data-reveal style={{ ["--d" as string]: 100 }}>
              {intro}
            </p>
          )}
          {note}
        </header>
        <div className="lg:col-span-7 lg:col-start-6">{children}</div>
      </div>
    </section>
  );
}

/** A measured rule between sections, with an optional sheet reference. */
export function TechnicalDivider({ label }: { label?: string }) {
  return (
    <div aria-hidden className="container-x">
      <div className="flex items-center gap-4 text-ink-3" data-reveal="fade">
        <span className="h-3 w-px bg-line-strong" />
        <span className="ruler-line h-2.5 flex-1" />
        {label && <span className="t-num shrink-0 text-[0.66rem] tracking-[0.14em]">{label}</span>}
        <span className="h-px w-12 shrink-0 bg-line-strong" />
        <span className="h-3 w-px bg-line-strong" />
      </div>
    </div>
  );
}
