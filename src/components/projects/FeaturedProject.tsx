import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Phrases } from "@/components/ui/Phrases";
import { Backdrop } from "@/components/visual/Backdrop";
import { SectionRule } from "@/components/visual/SectionRule";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import type { ProjectCardData, ProjectImage } from "./types";

/** Largest enlargement of a source photo in the feature (the originals are small). */
const MAX_SCALE = 1.3;

/**
 * One project, large: on a deep slate block the main photo leads, framed like a
 * drawing sheet, with a second photo pinned over its corner. Title, categories,
 * the gallery summary and a single "view" action sit beside it.
 */
export function FeaturedProject({
  project,
  label,
  refLabel,
  viewLabel,
  alt,
}: {
  project: ProjectCardData;
  label: string;
  refLabel: string;
  viewLabel: string;
  alt: string;
}) {
  const [main, inset] = project.gallery;
  return (
    <section aria-labelledby="featured-title" className="sec-slate on-band relative isolate overflow-hidden">
      <Backdrop kind="grid" drift className="[--bd-opacity:0.8]" />
      <div className="container-x relative pt-[clamp(4rem,2.8rem+4.5vw,7rem)]">
        <SectionRule tone="band" />
      </div>
      <div className="container-x relative grid gap-x-12 gap-y-14 pb-[clamp(4.5rem,3rem+5vw,8rem)] pt-12 lg:grid-cols-12 lg:items-center">
        <div className="relative lg:col-span-7">
          <Photo image={main} alt={alt} className="w-[88%] sm:w-[84%]" sizes="(min-width: 1024px) 600px, 84vw" />
          {inset && (
            <div className="absolute -bottom-8 end-0 w-[26%] sm:w-[22%]" style={{ maxWidth: inset.width * MAX_SCALE }} data-reveal="clip">
              <div className="bg-elevated p-1.5 shadow-[var(--shadow-floating)]">
                <div className="relative overflow-hidden bg-strong" style={{ aspectRatio: `${inset.width} / ${inset.height}` }}>
                  <Image src={inset.src} alt="" fill sizes="160px" placeholder="blur" blurDataURL={inset.blurDataURL} className="object-cover" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <p className="t-label eyebrow !text-band-ink-2" data-reveal="fade">
            {label}
          </p>
          <p className="t-label mt-6 flex items-center gap-3 text-band-ink-2" dir="ltr" data-reveal="fade">
            <span aria-hidden className="size-1.5 bg-accent" />
            {refLabel} {project.ref}
          </p>
          <h2 id="featured-title" className="t-h2 mt-3" data-reveal>
            <Phrases>{project.title}</Phrases>
          </h2>
          <p className="t-lead mt-6 max-w-[34rem] !text-band-ink-2" data-reveal style={{ ["--d" as string]: 80 }}>
            {project.summary}
          </p>
          <ul className="mt-7 flex flex-wrap gap-2" data-reveal style={{ ["--d" as string]: 120 }}>
            {project.categories.map((c) => (
              <li key={c.slug} className="band-tag" data-tone={c.tone}>
                {c.label}
              </li>
            ))}
          </ul>
          <div className="mt-9" data-reveal style={{ ["--d" as string]: 160 }}>
            <ButtonLink href={project.href}>{viewLabel}</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Photo({ image, alt, className, sizes }: { image: ProjectImage; alt: string; className: string; sizes: string }) {
  return (
    <div className={`tf-host ${className}`} style={{ maxWidth: image.width * MAX_SCALE }} data-reveal="frame">
      <div className="relative overflow-hidden bg-strong shadow-[var(--shadow-floating)]" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
        <Image src={image.src} alt={alt} fill sizes={sizes} placeholder="blur" blurDataURL={image.blurDataURL} className="object-cover" />
        <span aria-hidden className="reg-marks" />
      </div>
      <FrameMarks />
    </div>
  );
}
