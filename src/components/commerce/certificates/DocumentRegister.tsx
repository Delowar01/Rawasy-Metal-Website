"use client";

import Image from "next/image";
import { useRef, useState, type MouseEvent } from "react";
import { Icon, type IconName } from "../Icon";
import { useDialogPointer } from "../inner/useDialogPointer";

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
  /** Redacted previews only (public/media/certificates, never re-encoded). The first one is shown on the card. */
  previews: (Picture & { label?: string })[];
}

/** The homepage's compliance icons, in the same order. */
const ICONS: IconName[] = ["doc", "shield", "doc"];

/**
 * The document register: one card per document with its redacted preview, issuer, facts and reference. "View document"
 * opens a native modal dialog (focus moves in, stays in and returns to the trigger; Escape or the backdrop closes it).
 * The triggers are links to the preview file itself, so they work without JavaScript, and a modified click opens the
 * file as usual. The previews are shown as they are: no filter, no zoom beyond the dialog's width, the same sizes as
 * before. While the dialog is open the custom pointer gives way to the system cursor (useDialogPointer).
 */
export function DocumentRegister({
  documents,
  labels,
}: {
  documents: CertificateDocument[];
  labels: { view: string; close: string; preview: string; note: string };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // The last document opened stays in the dialog while it fades out; the next opening replaces it.
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : documents[index];
  useDialogPointer(dialogRef);

  const show = (i: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks open the file in a new tab as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setIndex(i);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      <ol className="ct-docs">
        {documents.map((doc, i) => {
          const [cover] = doc.previews;
          const portrait = cover.height > cover.width;
          return (
            // No reveal on the cards: the register's links land on them, and a reveal would move them after the jump.
            <li key={doc.slug} id={doc.slug} className="card ct-doc" data-tone="brass">
              <figure className="ct-doc-figure">
                <a
                  href={cover.src}
                  onClick={show(i)}
                  aria-haspopup="dialog"
                  aria-label={`${labels.view}: ${doc.title}`}
                  className="ct-plate"
                >
                  <Image
                    src={cover.src}
                    alt=""
                    width={cover.width}
                    height={cover.height}
                    sizes={portrait ? "(min-width: 1024px) 240px, 50vw" : "(min-width: 1024px) 400px, 76vw"}
                    placeholder="blur"
                    blurDataURL={cover.blurDataURL}
                    className="ct-plate-img"
                    // A portrait preview: 82 % of the 4:3 plate's height (61.5 % of its width), set as a width.
                    style={portrait ? { width: `${((61.5 * cover.width) / cover.height).toFixed(2)}%` } : undefined}
                  />
                  <span className="ct-plate-open" aria-hidden>
                    <Icon name="plus" size={18} />
                  </span>
                </a>
                <figcaption className="ct-caption">
                  <span aria-hidden className="ct-swatch" />
                  {labels.preview}
                </figcaption>
              </figure>

              <div className="ct-doc-body">
                <p className="ct-issuer">
                  <span className="icon-chip size-10 shrink-0">
                    <Icon name={ICONS[i] ?? "doc"} size={20} />
                  </span>
                  <span className="ip-index">{String(i + 1).padStart(2, "0")}</span>
                  <span>{doc.issuer}</span>
                </p>
                <h2 className="t-h2 ct-title">{doc.title}</h2>
                <dl className="ct-facts">
                  {doc.facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
                <a href={cover.src} onClick={show(i)} aria-haspopup="dialog" aria-label={`${labels.view}: ${doc.title}`} className="btn btn-secondary ct-view">
                  {labels.view}
                  <Icon name="plus" size={17} />
                </a>
              </div>
            </li>
          );
        })}
      </ol>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        aria-labelledby="register-dialog-title"
        className="ct-dialog"
      >
        {current && (
          <div className="ct-dialog-inner">
            <div className="ct-dialog-head">
              <div className="min-w-0">
                <p className="ct-dialog-issuer">{current.issuer}</p>
                <h2 id="register-dialog-title" className="t-h3 mt-1">
                  {current.title}
                </h2>
              </div>
              <button type="button" onClick={close} autoFocus className="ct-close" aria-label={labels.close}>
                <Icon name="close" size={20} />
              </button>
            </div>
            {/* Focusable, so a tall preview can be scrolled from the keyboard as well. */}
            <div className="ct-dialog-body" role="group" aria-label={labels.preview} tabIndex={0}>
              {current.previews.map((preview) => (
                <figure key={preview.src} className="ct-preview">
                  <Image
                    src={preview.src}
                    alt={`${current.title}${preview.label ? ` (${preview.label})` : ""} — ${labels.note}`}
                    width={preview.width}
                    height={preview.height}
                    sizes="(min-width: 768px) 46vw, 90vw"
                    placeholder="blur"
                    blurDataURL={preview.blurDataURL}
                    className="ct-preview-img"
                  />
                  {preview.label && <figcaption className="ct-preview-label">{preview.label}</figcaption>}
                </figure>
              ))}
            </div>
            <p className="ct-dialog-note">
              <span aria-hidden className="ct-swatch" />
              {labels.note}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
