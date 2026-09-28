import { Icon } from "../Icon";
import { pillarIcon, supportIcon } from "../tones";
import { Photo, delay, statementIcon } from "../ui";
import type { HomeView } from "./data";

/** Who RAWASY is: the statement and first paragraph, the workshop and the vision, site support, and why RAWASY. */
export function About({ view }: { view: HomeView }) {
  const { about, pillars, hero, links } = view;
  return (
    <section id="about" className="sec" aria-labelledby="about-title">
      <div className="shell grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="a2-read lg:col-span-5" data-reveal>
          <p className="eyebrow" data-tone="steel">
            {about.label}
          </p>
          <h2 id="about-title" className="t-h2 mt-4">
            {about.statement}
          </h2>
          <p className="t-body mt-5 max-w-[40em]">{about.paragraphs[0]}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={links.about} className="btn btn-dark">
              {about.link}
              <Icon name="arrow" size={17} />
            </a>
            <a href="#services" className="btn btn-secondary">
              {about.servicesLink}
            </a>
          </div>
        </div>

        <div className="lg:col-span-7" data-reveal style={delay(90)}>
          <div className="a2-panel p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="a2-photo aspect-[16/10] sm:aspect-auto sm:min-h-[16.5rem]" data-reveal="clip">
                <Photo image={about.workshop} sizes="(min-width: 1024px) 420px, (min-width: 640px) 56vw, 92vw" />
              </div>
              <figure className="card flex flex-col p-5" data-tone="brand">
                <span className="icon-chip size-10">
                  <Icon name="quote" size={20} />
                </span>
                <figcaption className="mt-4 text-[0.8rem] font-semibold text-brand-ink">{about.visionLabel}</figcaption>
                <blockquote className="t-h4 mt-1.5 font-semibold leading-snug">{about.vision}</blockquote>
                <p className="mt-auto flex items-center gap-2 pt-5 text-[0.84rem] font-medium text-ink-2">
                  <Icon name="pin" size={16} className="text-teal" />
                  {hero.location}
                </p>
              </figure>
            </div>
            <div className="mt-3 rounded-[18px] border border-line bg-surface p-4 sm:p-5" data-tone="teal">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-3">
                  <span className="icon-chip size-10 shrink-0">
                    <Icon name="scaffolding" size={20} />
                  </span>
                  <span>
                    <span className="block text-[0.8rem] font-semibold text-teal">{about.beyond.label}</span>
                    <span className="t-h4 block">{about.beyond.title}</span>
                  </span>
                </p>
                <a href={about.beyond.href} className="link-arrow text-[0.9rem]">
                  {about.beyond.link}
                  <Icon name="arrow" size={16} />
                </a>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2">
                {about.beyond.items.map((item) => (
                  <li key={item.slug} className="tag">
                    <Icon name={supportIcon[item.slug] ?? "check"} size={15} className="text-teal" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="shell mt-12 lg:mt-16">
        <h3 className="a2-read t-h4 flex w-fit items-center gap-2.5" data-reveal="fade">
          <span className="h-px w-6 bg-brand" aria-hidden />
          {about.whyLabel}
        </h3>
        {/* On phones a swipe rail: focusable so it also scrolls from the keyboard. */}
        <ul
          aria-label={about.whyLabel}
          tabIndex={0}
          className="rail -mx-[var(--gutter)] mt-5 flex gap-3 overflow-x-auto px-[var(--gutter)] pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
        >
          {pillars.map((p, i) => (
            <li key={p.slug} className="w-[78%] shrink-0 sm:w-auto" data-reveal style={delay((i % 3) * 70)}>
              <div className="card a2-pillar flex h-full items-start gap-3.5 p-4 sm:p-5" data-tone={pillarIcon[p.slug]?.[1] ?? "steel"}>
                <span className="icon-chip shrink-0">
                  <Icon name={pillarIcon[p.slug]?.[0] ?? statementIcon[0]} size={20} />
                </span>
                <span>
                  <span className="t-h4 block">{p.title}</span>
                  <span className="t-small mt-1 block">{p.body}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
