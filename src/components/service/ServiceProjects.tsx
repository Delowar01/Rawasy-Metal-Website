import type { CSSProperties } from "react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import type { ProjectCardData } from "@/components/projects/types";

/** Largest enlargement of a project photo when a card stands alone (the sources are small). */
const SINGLE_SCALE = 1.25;

/**
 * Work from the gallery whose own record lists this service. Cards link to
 * the project detail routes (stage 1F). A single project sits beside its
 * gallery summary, its card no wider than its photo allows.
 */
export function ServiceProjects({ projects, refLabel, viewLabel }: { projects: ProjectCardData[]; refLabel: string; viewLabel: string }) {
  if (projects.length === 1) {
    const [project] = projects;
    const width = Math.max(300, Math.round(project.images[0].width * SINGLE_SCALE));
    return (
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-14">
        <div className="shrink-0" style={{ width: "100%", maxWidth: width }} data-reveal>
          <ProjectCard project={project} refLabel={refLabel} viewLabel={viewLabel} sizes={`${width}px`} />
        </div>
        <p className="t-lead max-w-[34rem] border-s-2 border-accent ps-5" data-reveal style={{ ["--d" as string]: 100 } as CSSProperties}>
          {project.summary}
        </p>
      </div>
    );
  }
  return (
    <ul className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {projects.map((project, i) => (
        <li key={project.slug} data-reveal style={{ ["--d" as string]: (i % 4) * 70 } as CSSProperties} className={i % 2 === 1 ? "lg:mt-10" : undefined}>
          <ProjectCard project={project} refLabel={refLabel} viewLabel={viewLabel} />
        </li>
      ))}
    </ul>
  );
}
