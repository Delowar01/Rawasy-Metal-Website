import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import type { ProjectCardData } from "./types";

/**
 * Secondary navigation at the end of the portfolio: every showcased project by
 * gallery reference, as a compact ruled list in three columns on desktop.
 */
export function ProjectIndex({ projects, label }: { projects: ProjectCardData[]; label: string }) {
  return (
    <ol aria-label={label} className="grid border-t border-line-strong sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.slug} className="border-b border-line" data-tone={project.tone}>
          <Link href={project.href} className="act-row group grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3 ps-3 pe-2">
            <span className="t-num text-xs text-ink-2" dir="ltr">
              {project.ref}
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-ink">{project.title}</span>
              <span className="t-caption block">{project.categories.slice(0, 2).map((c) => c.label).join(" · ")}</span>
            </span>
            <ArrowIcon
              size={14}
              className="self-center text-ink-2 opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-[calc(var(--dir)*3px)] group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100"
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
