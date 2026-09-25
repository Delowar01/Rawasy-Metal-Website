import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import type { ProjectCardData } from "./types";

/**
 * A portfolio card: the photo leads, with a technical caption (reference,
 * name, categories) underneath. Hover or keyboard focus lifts the card, lights
 * its border, zooms the photo a touch, reveals the category on the photo and
 * brings in the arrow. The whole card is one link, named by the project title.
 */
export function ProjectCard({
  project,
  refLabel,
  viewLabel,
  sizes = "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw",
  className,
  style,
}: {
  project: ProjectCardData;
  refLabel: string;
  viewLabel: string;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [primary] = project.categories;
  return (
    <Link href={project.href} className={cn("proj-card card card-link group block", className)} data-tone={project.tone} style={style}>
      <ProjectMedia
        project={project}
        sizes={sizes}
        flag={
          primary && (
            <span aria-hidden className="proj-flag" data-tone={primary.tone}>
              {primary.label}
            </span>
          )
        }
      />
      <div className="relative px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5">
        <p className="t-label flex items-center gap-2 text-ink-2">
          <span aria-hidden className="size-1.5 bg-[var(--tone)]" />
          <span dir="ltr">
            {refLabel} {project.ref}
          </span>
        </p>
        <h3 className="proj-title t-h4 mt-2 text-ink">{project.title}</h3>
        <p className="t-caption mt-1.5">{project.categories.slice(0, 2).map((c) => c.label).join(" · ")}</p>
        <span className="proj-view t-label mt-3.5 flex items-center gap-2 text-ink">
          {viewLabel}
          <ArrowIcon size={14} className="proj-arrow rtl:-scale-x-100" />
        </span>
      </div>
    </Link>
  );
}

/** The photo (or photos) of a card, laid out to respect the source resolution. */
export function ProjectMedia({ project, sizes, flag }: { project: ProjectCardData; sizes: string; flag?: ReactNode }) {
  const [first, second] = project.images;
  if (project.mode === "photo") {
    return (
      <div className="proj-media zoom-img relative overflow-hidden bg-strong" style={{ aspectRatio: `${first.width} / ${first.height}` }}>
        <Image src={first.src} alt="" fill sizes={sizes} placeholder="blur" blurDataURL={first.blurDataURL} className="object-cover" />
        <span aria-hidden className="proj-shade" />
        {flag}
      </div>
    );
  }
  if (project.mode === "pair" && second) {
    return (
      <div className="proj-media proj-plate relative flex items-start justify-center gap-1.5 p-2.5">
        {[first, second].map((img) => (
          <div
            key={img.src}
            className="zoom-img relative min-w-0 overflow-hidden bg-strong shadow-[var(--shadow-card)]"
            style={{ flex: `${img.width / img.height} 1 0`, aspectRatio: `${img.width} / ${img.height}`, maxWidth: img.width }}
          >
            <Image src={img.src} alt="" fill sizes="(min-width: 640px) 160px, 45vw" placeholder="blur" blurDataURL={img.blurDataURL} className="object-cover" />
          </div>
        ))}
        <span aria-hidden className="proj-shade" />
        {flag}
      </div>
    );
  }
  return (
    <div className="proj-media proj-plate relative grid place-items-center p-5">
      <div className="zoom-img relative w-full overflow-hidden bg-strong shadow-[var(--shadow-image)]" style={{ maxWidth: first.width, aspectRatio: `${first.width} / ${first.height}` }}>
        <Image src={first.src} alt="" fill sizes={`${first.width}px`} placeholder="blur" blurDataURL={first.blurDataURL} className="object-cover" />
      </div>
      <span aria-hidden className="reg-marks [--m:var(--border-strong)] mix-blend-normal" />
      <span aria-hidden className="proj-shade" />
      {flag}
    </div>
  );
}
