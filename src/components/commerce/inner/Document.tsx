import type { ReactNode } from "react";
import type { LegalBlock } from "@/content/types";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A numbered section of a long-form document: its number, its heading (an h2 named after the section, which the
 * contents list links to by `id`) and its body at a reading measure. Anchor jumps land below the sticky header (the
 * page's scroll padding is the header height plus a gap).
 */
export function DocSection({ id, index, title, children }: { id: string; index: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="ip-doc-section">
      <div className="ip-doc-head">
        <span className="ip-doc-num">{pad(index + 1)}</span>
        <h2 id={`${id}-title`} className="ip-doc-title">
          {title}
        </h2>
      </div>
      <div className="ip-doc-body">{children}</div>
    </section>
  );
}

/** Reading text: paragraphs and bullet lists, as the content layer stores them. */
export function Prose({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <div className="ip-prose">
      {blocks.map((block, i) =>
        typeof block === "string" ? (
          <p key={i}>{block}</p>
        ) : (
          <ul key={i}>
            {block.list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/** A point that still needs confirmation: named by its label, never by colour alone. */
export function PendingNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="note" className="ip-note">
      <p className="ip-note-label">{label}</p>
      <p className="ip-note-text">{children}</p>
    </div>
  );
}
