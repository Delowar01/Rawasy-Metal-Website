"use client";

import { FilterChips, useProjectFilter, type FilterOption } from "./ProjectFilter";
import { ProjectCard } from "./ProjectCard";
import type { ProjectCardData } from "./types";

/**
 * The full portfolio: a sticky category filter over an image-led masonry
 * wall. Filtering hides cards (the wall re-flows, animated where view
 * transitions are supported) and announces the choice to screen readers.
 * Without JavaScript every project is shown and the filter is hidden.
 */
export function ProjectGallery({
  projects,
  options,
  labels,
}: {
  projects: ProjectCardData[];
  options: FilterOption[];
  labels: { filter: string; all: string; showing: string; ref: string; view: string };
}) {
  const { filter } = useProjectFilter();
  const current = filter === "all" ? labels.all : options.find((o) => o.slug === filter)?.label;

  return (
    <>
      <div className="proj-filterbar js-only sticky top-[var(--header-h)] z-30 -mx-[var(--gutter)] mb-8 px-[var(--gutter)] py-3 lg:mb-10">
        <FilterChips
          options={options}
          allLabel={labels.all}
          label={labels.filter}
          className="-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible"
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {`${labels.showing}: ${current}`}
      </p>
      <ul className="proj-masonry">
        {projects.map((project, i) => {
          const shown = filter === "all" || project.categories.some((c) => c.slug === filter);
          return (
            <li
              key={project.slug}
              hidden={!shown}
              className="proj-item"
              data-categories={project.categories.map((c) => c.slug).join(" ")}
              data-reveal="fade"
              style={{ viewTransitionName: `proj-${project.slug}`, ["--d" as string]: (i % 4) * 70 }}
            >
              <ProjectCard project={project} refLabel={labels.ref} viewLabel={labels.view} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
