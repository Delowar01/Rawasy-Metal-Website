import Image from "next/image";
import type { CSSProperties } from "react";

export interface LogoItem {
  slug: string;
  name: string;
  logo: { src: string; width: number; height: number };
  mono: { src: string; width: number; height: number };
}

/**
 * A short row of client logos from the clients wall (same cells, same colour
 * reveal on hover). Unnumbered, and never presented as a count.
 */
export function LogoStrip({ clients, label }: { clients: LogoItem[]; label: string }) {
  return (
    <ul aria-label={label} className="logo-wall logo-strip">
      {clients.map((client) => (
        <li key={client.slug} className="logo-cell">
          <span aria-hidden className="client-line" />
          <span className="logo-body">
            <span
              className="logo-mark"
              style={{ width: `calc(${Math.min(140, Math.round(52 * (client.mono.width / client.mono.height)))}px * var(--logo-scale))` }}
            >
              <Image src={client.mono.src} alt={client.name} width={client.mono.width} height={client.mono.height} sizes="160px" className="client-mono h-auto w-full" />
              <span aria-hidden className="client-color" style={{ ["--logo" as string]: `url(${client.logo.src})` } as CSSProperties} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
