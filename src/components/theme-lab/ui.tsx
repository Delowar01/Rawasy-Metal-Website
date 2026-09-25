import Image from "next/image";
import type { CSSProperties } from "react";
import type { ServiceSlug } from "@/content/types";
import type { LabData, LabImage } from "./data";
import type { IconName } from "./Icon";

export const serviceIcon: Record<ServiceSlug, IconName> = {
  "laser-cutting": "laser-cutting",
  "cnc-bending": "cnc-bending",
  "steel-structures": "steel-structures",
  fabrication: "fabrication",
  "laser-engraving": "laser-engraving",
  scaffolding: "scaffolding",
};

export const metricIcon: Record<string, IconName> = {
  "peak-laser-power": "power",
  "bevel-cutting": "bevel",
  "laser-systems": "layers",
  "service-lines": "grid",
};

/** Capability statements (metrics.ts) in order: technology, custom, multi-service, Saudi-based. */
export const statementIcon: IconName[] = ["laser-cutting", "fabrication", "layers", "pin"];

export const delay = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as CSSProperties;

/** A photo filling its (positioned) parent, with the blur placeholder. */
export function Photo({
  image,
  sizes,
  className,
  priority,
  alt,
}: {
  image: LabImage;
  sizes: string;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <Image
      src={image.src}
      alt={alt ?? image.alt}
      fill
      sizes={sizes}
      placeholder="blur"
      blurDataURL={image.blurDataURL}
      priority={priority}
      className={className ?? "object-cover"}
    />
  );
}

/** A cut-out product photo (machines) at its natural proportions. */
export function Cutout({ image, className, sizes }: { image: LabImage; className?: string; sizes: string }) {
  return (
    <Image
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      className={className}
      style={{ maxWidth: image.width }}
    />
  );
}

/** A client logo (transparent background) sized to its box. */
export function Logo({ image, className }: { image: LabImage; className?: string }) {
  return (
    <Image
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes="160px"
      className={className ?? "h-full w-auto object-contain"}
    />
  );
}

/** Preview chrome: switch option, homepage / design system, and language. Not part of any theme. */
export function LabBar({ data, view }: { data: LabData; view: "home" | "system" }) {
  const { lab } = data;
  const here = view === "home" ? lab.homeHref : lab.systemHref;
  return (
    <aside className="lab-bar" aria-label={lab.lab}>
      <p>
        <strong>{lab.lab}</strong> · {lab.preview}
      </p>
      <nav aria-label={`${lab.lab} — ${lab.preview}`}>
        <span className="lab-seg">
          {lab.options.map((o) => (
            <a key={o.key} href={view === "home" ? o.href : `${o.href}/system`} aria-current={o.key === data.option ? "page" : undefined}>
              {o.key.toUpperCase()}
              <span className="lab-long"> · {o.name.split(" · ")[1]}</span>
            </a>
          ))}
        </span>
        <span className="lab-seg">
          <a href={lab.homeHref} aria-current={view === "home" ? "page" : undefined}>
            {lab.homepage}
          </a>
          <a href={lab.systemHref} aria-current={view === "system" ? "page" : undefined}>
            {lab.system}
          </a>
        </span>
        <span className="lab-seg">
          <a href={lab.switchHref(here)} lang={lab.otherLocale} hrefLang={lab.otherLocale}>
            {lab.otherLabel}
          </a>
        </span>
      </nav>
      <p className="lab-note">{lab.note}</p>
    </aside>
  );
}
