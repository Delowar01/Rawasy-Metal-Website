import type { ReactNode } from "react";
import { ChevronIcon } from "@/components/ui/Icons";
import type { LegalBlock } from "@/content/types";
import { LegalToc } from "./LegalToc";

export interface LegalSectionView {
  id: string;
  title: string;
  body: LegalBlock[];
  /** Needs RAWASY or legal confirmation before launch. */
  pending?: string;
  /** Rendered after the text (e.g. the company's contact details). */
  extra?: ReactNode;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Long-form legal document: a table of contents (a disclosure on small
 * screens, pinned beside the text on large ones) and numbered sections at a
 * comfortable reading measure. Unconfirmed points carry a visible note.
 */
export function LegalPageLayout({
  sections,
  labels,
}: {
  sections: LegalSectionView[];
  labels: { onThisPage: string; pending: string };
}) {
  const toc = (
    <ol className="grid gap-0.5">
      {sections.map((section, i) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="group grid grid-cols-[2rem_1fr] gap-x-2 py-1.5 text-[0.95rem] leading-snug text-ink-2 transition-colors hover:text-ink"
          >
            <span className="t-num pt-0.5 text-[0.7rem] text-ink-3 transition-colors group-hover:text-accent-ink">{pad(i + 1)}</span>
            <span>{section.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="container-x grid gap-x-10 gap-y-8 pb-[var(--section-y)] pt-4 lg:grid-cols-12 lg:pt-8">
      <nav aria-label={labels.onThisPage} className="lg:col-span-3">
        <details className="group border-y border-line lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
            <span className="t-label text-ink-2">{labels.onThisPage}</span>
            <ChevronIcon size={16} aria-hidden className="rotate-90 text-ink-3 transition-transform group-open:-rotate-90" />
          </summary>
          <div className="pb-5">{toc}</div>
        </details>
        <LegalToc label={labels.onThisPage} items={sections.map((section) => ({ id: section.id, title: section.title }))} />
      </nav>

      <div className="lg:col-span-8 lg:col-start-5">
        {sections.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
            className="relative border-t border-line py-10 first:border-t-0 first:pt-2 sm:py-12 lg:first:pt-0"
          >
            {i > 0 && <span aria-hidden className="absolute -top-px start-0 h-[3px] w-12 bg-line-ink" />}
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
              <span className="t-num grid size-9 place-items-center border border-line-strong bg-elevated text-xs text-accent-ink shadow-[var(--shadow-low)]">
                {pad(i + 1)}
              </span>
              <div className="min-w-0">
                <h2 id={`${section.id}-title`} className="t-h3 pt-1 text-ink">
                  {section.title}
                </h2>
                <div className="legal-prose t-body mt-5 max-w-[42rem]">
                  {section.body.map((block, j) =>
                    typeof block === "string" ? (
                      <p key={j}>{block}</p>
                    ) : (
                      <ul key={j}>
                        {block.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
                {section.extra}
                {section.pending && (
                  <p className="mt-6 flex max-w-[42rem] flex-col gap-1.5 border border-dashed border-line-strong bg-accent-soft px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="t-label flex shrink-0 items-center gap-2 text-ink">
                      <span aria-hidden className="size-1.5 bg-accent" />
                      {labels.pending}
                    </span>
                    <span className="text-[0.92rem] leading-relaxed text-ink-2">{section.pending}</span>
                  </p>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
