import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import { cn } from "@/lib/utils";
import type { ProjectCardData } from "./types";

/** Largest enlargement of a source photo (the originals are small). */
const MAX_SCALE = 1.25;

/** Column placement per slot: an asymmetric two-column editorial layout. */
const SLOTS = [
  "lg:col-span-5",
  "lg:col-span-6 lg:col-start-7 lg:mt-32",
  "lg:col-span-6 lg:mt-4",
  "lg:col-span-4 lg:col-start-8 lg:mt-24",
];

/**
 * Highlights: a few projects presented large, in offset pairs. The lead photo
 * sits in a technical frame; further photos of the same piece are pinned over
 * its lower edge at close to their native size. A large outlined reference
 * number gives each piece an editorial marker.
 */
export function ProjectHighlights({
  projects,
  refLabel,
  viewLabel,
}: {
  projects: ProjectCardData[];
  refLabel: string;
  viewLabel: string;
}) {
  return (
    <ul className="grid gap-x-10 gap-y-20 sm:gap-y-24 lg:grid-cols-12 lg:gap-y-16">
      {projects.slice(0, SLOTS.length).map((project, i) => {
        const [main, ...more] = project.gallery;
        const thumbs = more.slice(0, 2);
        // Single column (tablet): alternate sides so the pieces read as an editorial zigzag.
        const side = i % 2 === 1 && "sm:max-lg:ms-auto";
        return (
          <li key={project.slug} className={SLOTS[i]}>
            <Link href={project.href} className="hl-item group block" data-tone={project.tone}>
              <div className={cn("relative", side)} style={{ maxWidth: main.width * MAX_SCALE }}>
                <div className="tf-host" data-tf="hover">
                  <div
                    className="zoom-img relative overflow-hidden bg-strong shadow-[var(--shadow-image)] transition-shadow duration-500 group-hover:shadow-[var(--shadow-floating)]"
                    style={{ aspectRatio: `${main.width} / ${main.height}` }}
                    data-reveal="clip"
                  >
                    {/* The link already carries the project's name. */}
                    <Image
                      src={main.src}
                      alt=""
                      fill
                      sizes={`(min-width: 1024px) ${Math.round(main.width * MAX_SCALE)}px, 92vw`}
                      placeholder="blur"
                      blurDataURL={main.blurDataURL}
                      className="object-cover"
                    />
                    <span aria-hidden className="proj-shade" />
                  </div>
                  <FrameMarks lines={false} />
                </div>
                {thumbs.length > 0 && (
                  <div className="relative z-10 -mt-12 flex justify-end gap-2 pe-3 sm:-mt-14 sm:pe-5">
                    {thumbs.map((img, t) => (
                      <div
                        key={img.src}
                        className="bg-elevated p-1 shadow-[var(--shadow-floating)]"
                        style={{ width: `min(${Math.round(img.width * 0.78)}px, 30%)`, ["--d" as string]: 120 + t * 80 } as CSSProperties}
                        data-reveal="fade"
                      >
                        <div className="zoom-img relative overflow-hidden bg-strong" style={{ aspectRatio: `${img.width} / ${img.height}` }}>
                          <Image src={img.src} alt="" fill sizes="130px" placeholder="blur" blurDataURL={img.blurDataURL} className="object-cover" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "mt-7 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-5 sm:max-lg:max-w-[40rem] sm:gap-x-7",
                  thumbs.length > 0 && "mt-5",
                  side,
                )}
              >
                <span aria-hidden data-n={project.ref} className="outline-num hl-num t-stat text-[2.75rem] sm:text-[3.5rem]" dir="ltr" />
                <div className="min-w-0 pt-1">
                  <p className="t-label tone-ink" dir="ltr">
                    {refLabel} {project.ref}
                  </p>
                  <h3 className="hl-title t-title mt-2 text-ink">{project.title}</h3>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {project.categories.slice(0, 3).map((c) => (
                      <li key={c.slug} className="tone-tag" data-tone={c.tone}>
                        {c.label}
                      </li>
                    ))}
                  </ul>
                  <p className="t-body mt-4 max-w-[34rem]">{project.summary}</p>
                  <span className="proj-view t-label mt-5 flex items-center gap-2 text-ink">
                    {viewLabel}
                    <ArrowIcon size={14} className="proj-arrow rtl:-scale-x-100" />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
