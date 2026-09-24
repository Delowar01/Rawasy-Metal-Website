"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/ui/Icons";

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
          <li key={cert.slug} className="cert-card group flex flex-col border border-line bg-elevated" data-reveal style={{ ["--d" as string]: i * 90 }}>
            <button
              type="button"
              onClick={() => show(i)}
              data-cursor="view"
              className="relative block aspect-[4/3] overflow-hidden border-b border-line bg-strong"
              aria-label={`${labels.view}: ${cert.title}`}
            >
              <div aria-hidden className="bg-perforated absolute inset-0 opacity-60" />
              <div className="absolute inset-x-[16%] top-[12%] bottom-[-14%] rotate-[-2.5deg] shadow-[var(--shadow-soft)] transition-transform duration-700 ease-out-expo group-hover:-translate-y-2 group-hover:rotate-[-1deg]">
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
              <span className="absolute bottom-4 end-4 grid size-10 place-items-center bg-ink text-background transition-colors group-hover:bg-accent group-hover:text-[#17191a]">
                <PlusIcon size={18} />
              </span>
            </button>
            <div className="flex flex-1 flex-col p-6">
              <p className="t-label text-accent-ink">{cert.issuer}</p>
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
        className="cert-dialog m-auto max-h-[92dvh] w-[min(64rem,94vw)] overflow-hidden border border-line-strong bg-background p-0 text-ink backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        {current && (
          <div className="flex max-h-[92dvh] flex-col">
            <div className="flex items-start justify-between gap-6 border-b border-line p-5 sm:p-6">
              <div>
                <p className="t-label text-accent-ink">{current.issuer}</p>
                <h2 id="cert-dialog-title" className="t-h3 mt-2">
                  {current.title}
                </h2>
              </div>
              <button type="button" onClick={close} className="grid size-11 shrink-0 place-items-center border border-line-strong hover:border-accent" aria-label={labels.close}>
                <CloseIcon />
              </button>
            </div>
            <div className="grid gap-6 overflow-y-auto bg-surface p-5 sm:p-8 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
              {current.previews.map((preview) => (
                <div key={preview.src} className="relative mx-auto w-full max-w-2xl shadow-[var(--shadow-soft)]">
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
                </div>
              ))}
            </div>
            <p className="t-label border-t border-line p-5 text-ink-3">{labels.redacted}</p>
          </div>
        )}
      </dialog>
    </>
  );
}
