import { Icon } from "../Icon";
import { Photo, delay } from "../ui";
import type { HomeView } from "./data";
import { SectionHead } from "./SectionHead";

type ProjectItem = HomeView["projects"]["items"][number];

/** The homepage selection, in this order (showcased projects only; see projects.ts). */
const ORDER = ["tulip-roundabout-sculpture", "clock-tower-landmark", "geometric-lanterns", "wave-form-sculpture", "suspended-lantern", "palm-leaf-shade-canopies"];
/** Bento on desktop: the first spans two columns, the second two rows. */
const LAYOUT = ["lg:col-span-2", "lg:row-span-2", "", "", "", ""];

function ProjectCard({ project: p, cta, sizes }: { project: ProjectItem; cta: string; sizes: string }) {
  return (
    <a href={p.href} className="card card-link a2-proj">
      <span className="card-media">
        <Photo image={p.image} alt="" sizes={sizes} />
      </span>
      <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <span className="a2-proj-title t-h3 block text-white">{p.title}</span>
        <span className="a2-proj-cta mt-2">
          {cta}
          <Icon name="arrow" size={16} />
        </span>
      </span>
      <span className="badge badge-light absolute start-3 top-3">{p.categories[0]}</span>
      <span className="a2-proj-line" aria-hidden />
    </a>
  );
}

/** Selected work: an image-led bento (a swipe rail on phones and tablets); each card opens the Projects gallery. */
export function Projects({ view }: { view: HomeView }) {
  const { projects, links } = view;
  const items = ORDER.map((slug) => projects.items.find((p) => p.slug === slug)!).filter(Boolean);
  return (
    <section id="projects" className="sec" aria-labelledby="projects-title">
      <div className="shell">
        <SectionHead id="projects-title" label={projects.label} title={projects.title} intro={projects.intro} tone="brass" action={{ href: links.projects, label: projects.all }} read />
      </div>
      <div className="shell mt-10 max-lg:px-0 lg:mt-12">
        <ul className="rail flex gap-3 overflow-x-auto px-[var(--gutter)] pb-3 sm:gap-4 lg:grid lg:grid-cols-4 lg:grid-rows-[16.5rem_16.5rem] lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
          {items.map((p, i) => (
            <li key={p.slug} className={`h-[24rem] w-[78%] shrink-0 sm:h-[26rem] sm:w-[44%] lg:h-auto lg:w-auto ${LAYOUT[i]}`} data-reveal style={delay((i % 4) * 60)}>
              <ProjectCard project={p} cta={projects.cta} sizes={i === 0 ? "(min-width: 1024px) 600px, 80vw" : "(min-width: 1024px) 300px, 80vw"} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
