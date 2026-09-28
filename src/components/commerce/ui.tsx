import Image from "next/image";
import type { CSSProperties } from "react";
import type { ServiceSlug } from "@/content/types";
import type { IconName } from "./Icon";
import type { CommerceImage } from "./types";

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
  image: CommerceImage;
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
export function Cutout({ image, className, sizes }: { image: CommerceImage; className?: string; sizes: string }) {
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
export function Logo({ image, className }: { image: CommerceImage; className?: string }) {
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
