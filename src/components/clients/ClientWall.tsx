import Image from "next/image";
import type { CSSProperties } from "react";
import { planSpans } from "@/lib/logo-wall";

export interface ClientWallItem {
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

/** A few cells carry a tinted surface, in a fixed rhythm, so the wall is not one flat sheet. */
const TINTS = [undefined, undefined, "eng", undefined, undefined, "craft", undefined, undefined, "proc", undefined] as const;

/**
 * Client logos as one seamless wall: cells joined by hairline dividers, wide
 * logos in double cells (planned per breakpoint so every row is full, in the
 * profile's order). No numbers, grid references or counts. Logos are
 * monochrome; hovering a cell, or switching on "original colours" (keyboard
 * and touch), shows each logo in its own colours on a paper plate.
 */
export function ClientWall({
  clients,
  label,
  labelId,
  coloursLabel,
}: {
  clients: ClientWallItem[];
  /** The wall's heading (a small label above it). */
  label: string;
  labelId: string;
  coloursLabel: string;
}) {
  const ratios = clients.map((c) => c.mono.width / c.mono.height);
  const spans = { sm: planSpans(ratios, 2, 3), md: planSpans(ratios, 4, 7), lg: planSpans(ratios, 6, 9) };

  return (
    <div className="logo-wall-host">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4">
        <h2 id={labelId} className="t-label flex items-center gap-2.5 text-ink-2">
          <span aria-hidden className="size-1.5 bg-accent" />
          {label}
        </h2>
        <label className="logo-toggle t-caption text-ink-2">
          <input type="checkbox" role="switch" className="logo-toggle-input sr-only" />
          <span aria-hidden className="logo-toggle-track" />
          {coloursLabel}
        </label>
      </div>
      <ul aria-labelledby={labelId} className="logo-wall">
        {clients.map((client, i) => (
          <li
            key={client.slug}
            className="logo-cell"
            data-tint={TINTS[i % TINTS.length]}
            style={{ "--span-sm": spans.sm[i], "--span-md": spans.md[i], "--span-lg": spans.lg[i] } as CSSProperties}
          >
            <span aria-hidden className="client-line" />
            {/* The wall stands from the start; the logos fade in across it. */}
            <span className="logo-body" data-reveal="fade" style={{ ["--d" as string]: (i % 6) * 45 } as CSSProperties}>
              <span className="logo-mark" style={{ width: `calc(${logoWidth(client.mono)}px * var(--logo-scale) * var(--logo-boost))` }}>
                <Image
                  src={client.mono.src}
                  alt={client.name}
                  width={client.mono.width}
                  height={client.mono.height}
                  sizes="200px"
                  loading={i < 12 ? "eager" : undefined}
                  className="client-mono h-auto w-full"
                />
                {/* Colour version as a background, downloaded only once it is revealed. */}
                <span aria-hidden className="client-color" style={{ ["--logo" as string]: `url(${client.logo.src})` } as CSSProperties} />
              </span>
              <span aria-hidden className="logo-name">
                {client.name}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
