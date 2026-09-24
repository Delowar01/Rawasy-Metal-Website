"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FrameMarks } from "@/components/visual/TechnicalFrame";

export interface IndustryView {
  slug: string;
  name: string;
  description: string;
  image: { src: string; blurDataURL: string; alt: string };
}

/**
 * Where does RAWASY's work go? A typographic list; on desktop a small photo
 * follows the pointer while a row is hovered.
 */
export function IndustryList({ industries }: { industries: IndustryView[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [fine, setFine] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!fine) return;
    const list = listRef.current;
    const preview = previewRef.current;
    if (!list || !preview) return;
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    const loop = () => {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    const rtl = document.documentElement.dir === "rtl";
    const onMove = (e: PointerEvent) => {
      const r = list.getBoundingClientRect();
      const w = preview.offsetWidth;
      const px = e.clientX - r.left;
      // Sit on the reading-direction side of the cursor, clamped inside the list.
      tx = Math.min(Math.max(rtl ? px - w - 28 : px + 28, 0), r.width - w);
      ty = e.clientY - r.top - 90;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    list.addEventListener("pointermove", onMove);
    return () => {
      list.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [fine]);

  return (
    <div className="relative">
      <ul
        ref={listRef}
        className="relative grid border-t border-line md:grid-cols-2 md:gap-x-12"
        onPointerLeave={() => setHovered(null)}
      >
        {industries.map((industry, i) => (
          <li
            key={industry.slug}
            className="industry-row act-row group relative border-b border-line"
            onPointerEnter={() => setHovered(i)}
            data-reveal
            style={{ ["--d" as string]: (i % 4) * 70 }}
          >
            <div className="relative flex items-center gap-5 py-6 ps-3 md:py-7 md:pe-3 md:ps-4">
              <span className="t-num w-8 shrink-0 text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <h3 className="t-h3 text-ink transition-transform duration-500 ease-out-expo group-hover:translate-x-[calc(var(--dir)*8px)]">
                  {industry.name}
                </h3>
                <p className="mt-1.5 text-[0.92rem] text-ink-2">{industry.description}</p>
              </div>
              <div className="photo relative size-16 shrink-0 md:hidden">
                <Image src={industry.image.src} alt="" fill sizes="64px" className="object-cover" placeholder="blur" blurDataURL={industry.image.blurDataURL} />
              </div>
            </div>
            <span aria-hidden className="absolute inset-x-0 -bottom-px h-px origin-[var(--origin-start)] scale-x-0 bg-accent transition-transform duration-700 ease-out-expo group-hover:scale-x-100" />
          </li>
        ))}
      </ul>

      {fine && (
        <div
          ref={previewRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-10 hidden w-[15rem] md:block"
        >
          <div
            className="tf-host relative transition-[opacity,transform] duration-500 ease-out-expo"
            data-active
            style={{ opacity: hovered === null ? 0 : 1, transform: hovered === null ? "scale(0.92)" : "scale(1)" }}
          >
            <div className="relative aspect-[4/3] overflow-hidden shadow-[var(--shadow-metal)]">
              {industries.map((industry, i) => (
                <Image
                  key={industry.slug}
                  src={industry.image.src}
                  alt=""
                  fill
                  sizes="240px"
                  className="object-cover transition-opacity duration-300"
                  style={{ opacity: hovered === i ? 1 : 0 }}
                />
              ))}
              <span className="reg-marks" />
              {/* Technical caption: the sector's index */}
              <span className="t-num absolute bottom-0 end-0 bg-background/85 px-2 py-1 text-[0.66rem] text-ink" dir="ltr">
                IND {String((hovered ?? 0) + 1).padStart(2, "0")}
              </span>
            </div>
            <FrameMarks lines={false} />
          </div>
        </div>
      )}
    </div>
  );
}
