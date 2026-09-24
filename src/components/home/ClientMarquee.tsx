import Image from "next/image";
import { FrameMarks } from "@/components/visual/TechnicalFrame";

export interface ClientView {
  slug: string;
  name: string;
  logo: { src: string; width: number; height: number };
  mono: { src: string; width: number; height: number };
}

function Row({ clients, reverse, duration }: { clients: ClientView[]; reverse?: boolean; duration: string }) {
  const cells = (duplicate: boolean) => (
    <ul className="flex shrink-0" aria-hidden={duplicate || undefined} data-duplicate={duplicate || undefined}>
      {clients.map((client) => (
        <li
          key={client.slug}
          className="client-cell tf-host relative flex h-28 w-48 shrink-0 items-center justify-center border-e border-line px-7 [--tf-out:-6px] sm:h-32 sm:w-56"
          data-tf="hover"
        >
          <FrameMarks lines={false} />
          <span aria-hidden className="client-line" />
          <span className="relative block">
            <Image
              src={client.mono.src}
              alt={duplicate ? "" : client.name}
              width={client.mono.width}
              height={client.mono.height}
              sizes="176px"
              className="client-mono h-auto max-h-14 w-auto max-w-full object-contain"
            />
            {/* Colour version as a hover-only background: downloaded only when hovered. */}
            <span aria-hidden className="client-color" style={{ ["--logo" as string]: `url(${client.logo.src})` }} />
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee" data-reverse={reverse || undefined} style={{ ["--marquee-duration" as string]: duration }}>
      {cells(false)}
      {cells(true)}
    </div>
  );
}

/**
 * Who has worked with RAWASY? Two slow rows drifting in opposite directions,
 * monochrome until hovered (original colours in the light theme). Pauses on
 * hover/focus; becomes a static wrapped grid with reduced motion.
 */
export function ClientMarquee({ clients }: { clients: ClientView[] }) {
  const half = Math.ceil(clients.length / 2);
  return (
    <div className="marquee-wrap relative overflow-hidden border-y border-line-strong [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      {/* Double rules above and below the rows */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-[2px] h-px bg-line" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[2px] h-px bg-line" />
      <Row clients={clients.slice(0, half)} duration="80s" />
      <div className="border-t border-line">
        <Row clients={clients.slice(half)} duration="90s" reverse />
      </div>
    </div>
  );
}
