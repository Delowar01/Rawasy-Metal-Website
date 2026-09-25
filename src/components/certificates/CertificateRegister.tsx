"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { CloseIcon, PlusIcon } from "@/components/ui/Icons";
import { PointerLight } from "@/components/visual/PointerLight";
import { FrameMarks } from "@/components/visual/TechnicalFrame";

interface Picture {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
}

export interface CertificateDocument {
  slug: string;
  title: string;
  issuer: string;
  facts: { label: string; value: string }[];
  /** Redacted previews only. The first one is shown in the register. */
  previews: (Picture & { label?: string })[];
}

/**
 * The compliance register: one ruled entry per document with its redacted
 * preview on a plate. "View document" opens a native modal dialog (focus is
 * kept inside and returned on close; Escape or the backdrop closes it).
 * The triggers are links to the preview image, so they still work without
 * JavaScript.
 */
export function CertificateRegister({
  documents,
  labels,
}: {
  documents: CertificateDocument[];
  labels: { view: string; close: string; preview: string; note: string; figure: string };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : documents[open];

  const show = (i: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks open the image in a new tab as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setOpen(i);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      <ol className="grid gap-6 lg:gap-8">
        {documents.map((doc, i) => {
          const [cover] = doc.previews;
          const portrait = cover.height > cover.width;
          const n = String(i + 1).padStart(2, "0");
          return (
            <li
              key={doc.slug}
              id={doc.slug}
              className="card card-edge grid gap-x-12 gap-y-8 p-6 sm:p-8 lg:grid-cols-12 lg:p-12"
              data-tone="craft"
            >
              <figure className="lg:col-span-5">
                <a
                  href={cover.src}
                  onClick={show(i)}
                  aria-haspopup="dialog"
                  data-cursor="view"
                  aria-label={`${labels.view}: ${doc.title}`}
                  className="proj-plate tf-host group relative block aspect-[4/3] w-full shadow-[var(--shadow-inset)]"
                  data-reveal="frame"
                >
                  {/* The document lies on a perforated fabrication table; a light follows the pointer. */}
                  <span aria-hidden className="absolute inset-0 overflow-hidden">
                    <span className="bg-perforated absolute inset-0 opacity-40" />
                    <PointerLight />
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Image
                      src={cover.src}
                      alt=""
                      width={cover.width}
                      height={cover.height}
                      sizes={portrait ? "(min-width: 1024px) 240px, 50vw" : "(min-width: 1024px) 400px, 76vw"}
                      placeholder="blur"
                      blurDataURL={cover.blurDataURL}
                      className={`${portrait ? "h-[82%] w-auto" : "h-auto w-[78%]"} shadow-[var(--shadow-metal)] transition-transform duration-700 ease-out-expo group-hover:-translate-y-1.5`}
                    />
                  </span>
                  <span aria-hidden className="t-num absolute start-4 top-3.5 text-[0.66rem] tracking-[0.14em] text-ink-2" dir="ltr">
                    DOC {n}
                  </span>
                  <span className="absolute bottom-4 end-4 grid size-10 place-items-center bg-ink text-background transition-colors group-hover:bg-[var(--craft)] group-hover:text-[#17191a]">
                    <PlusIcon size={18} />
                  </span>
                  <FrameMarks />
                </a>
                <figcaption className="t-label mt-5 flex items-center gap-3 text-ink-3">
                  <span className="t-num tone-ink">{`${labels.figure} ${n}`}</span>
                  <span aria-hidden className="redaction-swatch" />
                  {labels.preview}
                </figcaption>
              </figure>

              <div className="lg:col-span-6 lg:col-start-7 lg:self-center">
                <p className="t-label tone-ink flex items-center gap-3" data-reveal="fade">
                  <span className="t-num text-ink-3">{n}</span>
                  {doc.issuer}
                </p>
                <h2 className="t-title mt-4 text-ink" data-reveal>
                  {doc.title}
                </h2>
                <dl className="rule-double mt-8" data-reveal style={{ ["--d" as string]: 100 } as CSSProperties}>
                  {doc.facts.map((fact) => (
                    <div key={fact.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 border-b border-line py-4">
                      <dt className="text-[0.95rem] text-ink-3">{fact.label}</dt>
                      <dd className="text-[0.95rem] font-medium text-ink">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
                <a
                  href={cover.src}
                  onClick={show(i)}
                  aria-haspopup="dialog"
                  aria-label={`${labels.view}: ${doc.title}`}
                  className="link-arrow mt-8 text-ink"
                >
                  <span className="link-line">{labels.view}</span>
                  <PlusIcon size={16} className="arrow" />
                </a>
              </div>
            </li>
          );
        })}
      </ol>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        aria-labelledby="register-dialog-title"
        className="cert-dialog m-auto max-h-[92dvh] w-[min(68rem,94vw)] overflow-hidden border border-line-strong bg-background p-0 text-ink shadow-[var(--shadow-metal)] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        {current && (
          <div className="flex max-h-[92dvh] flex-col">
            <span aria-hidden className="block h-0.5 w-1/3 shrink-0 bg-accent" />
            <div className="flex items-start justify-between gap-6 border-b border-line bg-[image:var(--sheen)] p-5 sm:p-6">
              <div>
                <p className="t-label flex items-center gap-3 text-accent-ink">
                  <span aria-hidden className="t-num text-ink-2" dir="ltr">
                    DOC {String((open ?? 0) + 1).padStart(2, "0")}
                  </span>
                  {current.issuer}
                </p>
                <h2 id="register-dialog-title" className="t-h3 mt-2">
                  {current.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                autoFocus
                className="grid size-11 shrink-0 place-items-center border border-line-strong transition-colors hover:border-accent"
                aria-label={labels.close}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="bg-grid-fine grid gap-10 overflow-y-auto bg-surface p-6 sm:p-10 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
              {current.previews.map((preview) => (
                <figure key={preview.src} className="mx-auto w-full max-w-2xl">
                  <div className="tf-host" data-active>
                    <Image
                      src={preview.src}
                      alt={`${current.title}${preview.label ? ` (${preview.label})` : ""} — ${labels.note}`}
                      width={preview.width}
                      height={preview.height}
                      sizes="(min-width: 768px) 46vw, 90vw"
                      placeholder="blur"
                      blurDataURL={preview.blurDataURL}
                      className="h-auto w-full shadow-[var(--shadow-metal)]"
                    />
                    <FrameMarks lines={false} />
                  </div>
                  {preview.label && <figcaption className="t-label mt-4 text-ink-2">{preview.label}</figcaption>}
                </figure>
              ))}
            </div>
            <p className="t-label flex items-center gap-3 border-t border-line p-5 text-ink-2">
              <span aria-hidden className="redaction-swatch" />
              {labels.note}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
