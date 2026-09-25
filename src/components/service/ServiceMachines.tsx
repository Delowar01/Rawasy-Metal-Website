import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export interface MachineView {
  slug: string;
  /** Name exactly as printed in the company profile. */
  name: string;
  category: string;
  capability: string;
  /** Rated power as stated in the profile; left out when the profile gives none. */
  power?: { value: string; unit: string };
  image: { src: string; width: number; height: number; blurDataURL: string };
  href: string;
}

/**
 * The machines behind the service, from the company profile: photo on a light
 * plate (the originals have white backgrounds), category, the exact machine
 * name, rated power where stated and what it does. Each card leads to the
 * Capabilities & Machinery page. One machine gets a wide specification panel.
 */
export function ServiceMachines({ machines, powerLabel, linkLabel }: { machines: MachineView[]; powerLabel: string; linkLabel: string }) {
  if (machines.length === 1) {
    const [machine] = machines;
    return (
      <div data-reveal>
        <Link href={machine.href} className="card card-edge card-link group grid overflow-hidden md:grid-cols-12" data-tone="eng">
          <div className="relative grid place-items-center border-b border-line bg-[#f4f3ef] p-6 md:col-span-5 md:border-b-0 md:border-e">
            <div className="relative w-full" style={{ maxWidth: machine.image.width, aspectRatio: `${machine.image.width} / ${machine.image.height}` }}>
              <Image src={machine.image.src} alt="" fill sizes="(min-width: 768px) 326px, 80vw" placeholder="blur" blurDataURL={machine.image.blurDataURL} className="object-contain" />
            </div>
            <span aria-hidden className="reg-marks [--m:rgb(30_32_33/0.3)]" />
          </div>
          <div className="flex flex-col p-6 sm:p-8 md:col-span-7">
            <p className="tone-tag self-start">{machine.category}</p>
            <h3 className="t-title mt-5 text-ink">{machine.name}</h3>
            <p className="t-body mt-3 max-w-[32rem]">{machine.capability}</p>
            {machine.power && <Power power={machine.power} label={powerLabel} />}
            <span className="t-label mt-auto flex items-center gap-2 pt-8 text-ink">
              {linkLabel}
              <ArrowIcon size={14} className="card-arrow rtl:-scale-x-100" />
            </span>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {machines.map((machine, i) => (
        <li key={machine.slug} data-reveal style={{ ["--d" as string]: (i % 4) * 80 } as CSSProperties}>
          <Link href={machine.href} className="card card-edge card-link group flex h-full flex-col overflow-hidden" data-tone="eng">
            <div className="relative grid aspect-[2/1] place-items-center border-b border-line bg-[#f4f3ef] px-5 py-4 sm:aspect-[16/10]">
              <div className="relative h-full w-full" style={{ maxWidth: machine.image.width }}>
                <Image src={machine.image.src} alt="" fill sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 88vw" placeholder="blur" blurDataURL={machine.image.blurDataURL} className="object-contain" />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="t-label tone-ink">{machine.category}</p>
              <h3 className="t-h4 mt-2 text-ink">{machine.name}</h3>
              {machine.power && <Power power={machine.power} label={powerLabel} compact />}
              <p className="mt-3 text-[0.93rem] leading-relaxed text-ink-2">{machine.capability}</p>
              <span className="t-label mt-auto flex items-center gap-2 pt-6 text-ink">
                {linkLabel}
                <ArrowIcon size={14} className="card-arrow rtl:-scale-x-100" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Power({ power, label, compact }: { power: { value: string; unit: string }; label: string; compact?: boolean }) {
  return (
    <p className={cn("flex items-baseline gap-3 border-t border-line", compact ? "mt-4 pt-3" : "mt-6 pt-4")}>
      <span className="t-label text-ink-2">{label}</span>
      <span className="ms-auto flex items-baseline gap-1.5" dir="ltr">
        <span className={cn("t-stat text-ink", compact ? "text-[1.6rem]" : "text-[2.2rem]")}>{power.value}</span>
        <span className="text-[0.95rem] font-semibold text-ink-2">{power.unit}</span>
      </span>
    </p>
  );
}
