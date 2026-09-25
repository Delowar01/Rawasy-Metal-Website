import Image from "next/image";
import { Backdrop } from "@/components/visual/Backdrop";
import type { ProjectImage } from "./types";

export interface CollageItem {
  image: ProjectImage;
  alt: string;
  ref: string;
}

/**
 * The projects hero visual: three gallery photos layered like prints pinned
 * over a deep slate drawing plate. Each print keeps close to its source size
 * (the originals are low resolution), and the layers mirror in Arabic.
 */
export function ProjectsCollage({ items, refLabel }: { items: [CollageItem, CollageItem, CollageItem]; refLabel: string }) {
  const [main, tall, square] = items;
  return (
    <div className="relative mx-auto aspect-[1/1.02] w-full max-w-[34rem] sm:aspect-[1.08/1]">
      {/* Drawing plate */}
      <div aria-hidden className="sec-slate absolute inset-y-[7%] end-0 start-[9%] isolate overflow-hidden shadow-[var(--shadow-raised)]">
        <Backdrop kind="grid" />
        <span className="absolute end-0 top-0 h-1 w-1/3 bg-accent" />
        <span className="absolute bottom-0 start-0 top-0 w-1 bg-[var(--c-steel-400)]" />
      </div>
      <Print item={main} refLabel={refLabel} className="end-[4%] top-0 w-[68%]" sizes="(min-width: 1024px) 360px, 64vw" preload />
      <Print item={tall} refLabel={refLabel} className="bottom-[4%] start-0 w-[40%]" sizes="(min-width: 1024px) 220px, 38vw" />
      <Print item={square} refLabel={refLabel} className="bottom-0 end-[10%] w-[38%]" sizes="(min-width: 1024px) 210px, 36vw" />
    </div>
  );
}

function Print({
  item,
  refLabel,
  className,
  sizes,
  preload,
}: {
  item: CollageItem;
  refLabel: string;
  className: string;
  sizes: string;
  preload?: boolean;
}) {
  return (
    <figure className={`absolute ${className}`} style={{ maxWidth: item.image.width }} data-reveal="clip">
      <div className="bg-elevated p-1.5 shadow-[var(--shadow-image)] sm:p-2">
        <div className="relative overflow-hidden bg-strong" style={{ aspectRatio: `${item.image.width} / ${item.image.height}` }}>
          <Image
            src={item.image.src}
            alt={item.alt}
            fill
            sizes={sizes}
            placeholder="blur"
            blurDataURL={item.image.blurDataURL}
            className="object-cover"
            preload={preload}
          />
        </div>
        <figcaption aria-hidden className="t-label mt-1.5 flex items-center justify-between gap-2 px-0.5 text-[0.6rem] text-ink-2" dir="ltr">
          <span>
            {refLabel} {item.ref}
          </span>
          <span className="size-1.5 bg-accent" />
        </figcaption>
      </div>
    </figure>
  );
}
