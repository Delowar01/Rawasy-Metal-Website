import Image from "next/image";
import type { CSSProperties } from "react";
import { FrameMarks } from "@/components/visual/TechnicalFrame";

export interface ClientGridItem {
  slug: string;
  name: string;
  logo: { src: string; width: number; height: number };
  mono: { src: string; width: number; height: number };
}

/** Optical area every logo is scaled to, so wide and square marks carry equal weight. */
const AREA = 5200;
const MAX_W = 150;
const MAX_H = 60;

function logoWidth({ width, height }: { width: number; height: number }) {
  const ratio = width / height;
  let w = Math.sqrt(AREA * ratio);
  let h = w / ratio;
  if (w > MAX_W) [w, h] = [MAX_W, MAX_W / ratio];
  if (h > MAX_H) w = MAX_H * ratio;
  return Math.round(w);
}

const LETTERS = "ABCDEFG".split("");

/** Column letters and row numbers around the sheet, like a drawing's grid references. */
function Coordinates({ columns, rows, className }: { columns: number; rows: number; className: string }) {
  return (
    <div aria-hidden className={className}>
      <span />
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {LETTERS.slice(0, columns).map((letter) => (
          <span key={letter} className="t-num pb-2 text-center text-[0.62rem] text-ink-3">
            {letter}
          </span>
        ))}
      </div>
      <div className="row-start-2 grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows }, (_, r) => (
          <span key={r} className="t-num flex items-center justify-center pe-2 text-[0.62rem] text-ink-3">
            {r + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Client logos on a precision sheet: a ruled grid with column and row
 * references, seven across on desktop, three on smaller screens (21 logos fill
 * both exactly). Monochrome by default; hovering a cell raises it, shows its
 * corner marks, draws an accent line beneath it and shows the original colours
 * (light theme), as on the homepage.
 */
export function ClientGrid({ clients, label }: { clients: ClientGridItem[]; label: string }) {
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]">
      <Coordinates columns={7} rows={3} className="contents max-lg:hidden" />
      <Coordinates columns={3} rows={7} className="contents lg:hidden" />
      <ul
        aria-label={label}
        className="client-grid col-start-2 row-start-2 grid grid-cols-3 border-s border-t border-line bg-elevated/60 lg:grid-cols-7"
      >
        {clients.map((client, i) => (
          <li
            key={client.slug}
            className="client-cell tf-host group relative flex aspect-[4/3] flex-col border-b border-e border-line"
            data-tf="hover"
            data-reveal="fade"
            style={{ ["--d" as string]: (i % 7) * 50 } as CSSProperties}
          >
            <FrameMarks lines={false} />
            <span aria-hidden className="client-line" />
            <span aria-hidden className="t-num absolute start-2.5 top-2 text-[0.62rem] text-ink-3 sm:start-3 sm:top-2.5">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex flex-1 items-center justify-center px-3 pt-4">
              <span className="relative block" style={{ width: `calc(${logoWidth(client.mono)}px * var(--logo-scale))` }}>
                <Image
                  src={client.mono.src}
                  alt={client.name}
                  width={client.mono.width}
                  height={client.mono.height}
                  sizes="160px"
                  loading={i < 14 ? "eager" : undefined}
                  className="client-mono h-auto w-full"
                />
                <span aria-hidden className="client-color" style={{ ["--logo" as string]: `url(${client.logo.src})` } as CSSProperties} />
              </span>
            </span>
            <span aria-hidden className="line-clamp-2 min-h-[2.4em] px-3 pb-3 text-center text-[0.72rem] leading-tight text-ink-3 max-sm:hidden">
              {client.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
