import Image from "next/image";
import type { CSSProperties } from "react";

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

/**
 * Client logos on a ruled sheet: seven across on desktop, three on smaller
 * screens (21 logos fill both exactly). Monochrome by default; the original
 * colours appear on hover in the light theme, as on the homepage.
 */
export function ClientGrid({ clients, label }: { clients: ClientGridItem[]; label: string }) {
  return (
    <ul aria-label={label} className="client-grid grid grid-cols-3 border-s border-t border-line lg:grid-cols-7">
      {clients.map((client, i) => (
        <li
          key={client.slug}
          className="client-cell group relative flex aspect-[4/3] flex-col border-b border-e border-line"
          data-reveal="fade"
          style={{ ["--d" as string]: (i % 7) * 50 } as CSSProperties}
        >
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
  );
}
