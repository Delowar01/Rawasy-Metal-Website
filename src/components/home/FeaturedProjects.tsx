import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/ui/Icons";
import { MediaImage } from "@/components/ui/MediaImage";
import { FrameMarks } from "@/components/visual/TechnicalFrame";
import type { MediaId } from "@/content/types";
import { cn } from "@/lib/utils";

export interface ProjectCardView {
  slug: string;
  href: string;
  title: string;
  categories: string[];
  galleryRef: string;
  media: MediaId;
  alt: string;
}

/**
 * Editorial composition — deliberately not a uniform grid. Each slot pairs an
 * aspect ratio with a column placement and vertical offset; tiles stay close
 * to the photos' native size so the (low-resolution) sources stay crisp.
 */
const SLOTS = [
  { cls: "lg:col-span-5 lg:col-start-1", ratio: "aspect-[4/3]", sizes: "(min-width: 1024px) 40vw, 100vw" },
  { cls: "lg:col-span-3 lg:col-start-7 lg:mt-24", ratio: "aspect-[3/4]", sizes: "(min-width: 1024px) 24vw, 100vw" },
  { cls: "lg:col-span-3 lg:col-start-10 lg:mt-52", ratio: "aspect-[4/3]", sizes: "(min-width: 1024px) 24vw, 100vw" },
  { cls: "lg:col-span-3 lg:col-start-2 lg:-mt-8", ratio: "aspect-[3/4]", sizes: "(min-width: 1024px) 24vw, 100vw" },
  { cls: "lg:col-span-4 lg:col-start-6 lg:mt-10", ratio: "aspect-[16/10]", sizes: "(min-width: 1024px) 32vw, 100vw" },
  { cls: "lg:col-span-3 lg:col-start-10 lg:mt-24", ratio: "aspect-square", sizes: "(min-width: 1024px) 24vw, 100vw" },
];

export function FeaturedProjects({ projects, viewLabel }: { projects: ProjectCardView[]; viewLabel: string }) {
  return (
    <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-y-16">
      {projects.slice(0, SLOTS.length).map((project, i) => {
        const slot = SLOTS[i];
        return (
          <li key={project.slug} className={cn(slot.cls, i === 0 && "sm:col-span-2 lg:col-span-5")}>
            <Link href={project.href} data-cursor="view" className="group block" aria-label={`${project.title} — ${viewLabel}`}>
              {/* Photo on a frame whose corner marks and accent edges appear with the link's hover or focus */}
              <div className="tf-host" data-tf="hover">
                <div
                  className={cn("photo relative shadow-[var(--shadow-medium)] transition-shadow duration-500 group-hover:shadow-[var(--shadow-metal)]", slot.ratio)}
                  data-reveal="clip"
                  style={{ ["--d" as string]: (i % 3) * 90 }}
                >
                  <MediaImage
                    id={project.media}
                    alt={project.alt}
                    fill
                    sizes={slot.sizes}
                    className="object-cover transition-transform duration-[1400ms] ease-out-expo group-hover:scale-[1.045]"
                  />
                  <span className="t-num absolute start-3 top-3 bg-background/85 px-2 py-1 text-[0.7rem] text-ink backdrop-blur-sm">
                    {project.galleryRef}
                  </span>
                </div>
                <FrameMarks lines={false} />
              </div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="t-h4 text-ink">{project.title}</h3>
                  <p className="t-label mt-2 text-ink-3">{project.categories.join(" · ")}</p>
                </div>
                <ArrowUpRightIcon className="mt-1 shrink-0 text-accent-ink opacity-0 transition-[opacity,transform] duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100" />
              </div>
              <span aria-hidden className="mt-4 block h-px origin-[var(--origin-start)] scale-x-0 bg-accent transition-transform duration-700 ease-out-expo group-hover:scale-x-100 group-focus-visible:scale-x-100" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
