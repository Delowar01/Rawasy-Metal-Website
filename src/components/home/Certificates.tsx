"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/ui/Icons";
import { PointerLight } from "@/components/visual/PointerLight";
import { FrameMarks } from "@/components/visual/TechnicalFrame";

export interface CertificateView {
  slug: string;
  title: string;
  issuer: string;
  facts: { label: string; value: string }[];
  thumb: { src: string; width: number; height: number; blurDataURL: string };
  previews: { src: string; width: number; height: number; blurDataURL: string }[];
}

/**
 * Registered. Licensed. Accountable. Document cards with blurred thumbnails;
 * "View certificate" opens a native <dialog> with a redacted preview.
 */
export function Certificates({
  certificates,
  labels,
}: {
  certificates: CertificateView[];
  labels: { view: string; close: string; redacted: string };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  const show = (i: number) => {
    setOpen(i);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const current = open === null ? null : certificates[open];

  return (
    <>
      <ul className="grid gap-6 md:grid-cols-3">
        {certificates.map((cert, i) => (
          <li
            key={cert.slug}
            className="cert-card tf-host panel-raised card-edge group relative flex flex-col"
            data-tone="craft"
            data-reveal
            style={{ ["--d" as string]: i * 90 }}
          >
            <button
              type="button"
              onClick={() => show(i)}
              data-cursor="view"
              className="proj-plate relative block aspect-[4/3] overflow-hidden border-b border-line"
              aria-label={`${labels.view}: ${cert.title}`}
            >
              <PointerLight />
              <span aria-hidden className="t-num absolute start-4 top-3.5 text-[0.66rem] tracking-[0.14em] text-ink-2" dir="ltr">
                DOC {String(i + 1).padStart(2, "0")}
              </span>
              <div className="absolute inset-x-[16%] top-[12%] bottom-[-14%] rotate-[-2.5deg] shadow-[var(--shadow-metal)] transition-transform duration-700 ease-out-expo group-hover:-translate-y-2 group-hover:rotate-[-1deg]">
                <Image
                  src={cert.thumb.src}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 22vw, 70vw"
                  placeholder="blur"
                  blurDataURL={cert.thumb.blurDataURL}
                  className="object-cover object-top"
                />
              </div>
              <span className="absolute bottom-4 end-4 grid size-10 place-items-center bg-ink text-background transition-colors group-hover:bg-[var(--craft)] group-hover:text-[#17191a]">
                <PlusIcon size={18} />
              </span>
            </button>
            <div className="flex flex-1 flex-col p-6">
              <p className="t-label tone-ink">{cert.issuer}</p>
              <h3 className="t-h4 mt-3 text-ink">{cert.title}</h3>
              <dl className="mt-5 grid gap-2 text-sm">
                {cert.facts.map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-4 border-t border-line pt-2">
                    <dt className="text-ink-3">{fact.label}</dt>
                    <dd className="text-end font-medium text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <button type="button" onClick={() => show(i)} className="link-arrow mt-6 self-start text-ink">
                <span className="link-line">{labels.view}</span>
                <PlusIcon size={16} className="arrow" />
              </button>
            </div>
            <FrameMarks lines={false} />
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        aria-labelledby="cert-dialog-title"
        className="cert-dialog m-auto max-h-[92dvh] w-[min(64rem,94vw)] overflow-hidden border border-line-strong bg-background p-0 text-ink shadow-[var(--shadow-metal)] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
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
                <h2 id="cert-dialog-title" className="t-h3 mt-2">
                  {current.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="grid size-11 shrink-0 place-items-center border border-line-strong transition-colors hover:border-accent"
                aria-label={labels.close}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="bg-grid-fine grid gap-8 overflow-y-auto bg-surface p-6 sm:p-10 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
              {current.previews.map((preview) => (
                <div key={preview.src} className="tf-host relative mx-auto w-full max-w-2xl shadow-[var(--shadow-metal)]" data-active>
                  <Image
                    src={preview.src}
                    alt={`${current.title} — ${labels.redacted}`}
                    width={preview.width}
                    height={preview.height}
                    sizes="(min-width: 768px) 45vw, 90vw"
                    placeholder="blur"
                    blurDataURL={preview.blurDataURL}
                    className="h-auto w-full"
                  />
                  <FrameMarks lines={false} />
                </div>
              ))}
            </div>
            <p className="t-label flex items-center gap-3 border-t border-line p-5 text-ink-2">
              <span aria-hidden className="redaction-swatch" />
              {labels.redacted}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
