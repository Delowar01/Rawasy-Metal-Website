import { Icon } from "../Icon";
import { industryIcon, industryTone } from "../tones";
import { delay } from "../ui";
import type { HomeView } from "./data";

/**
 * Industries by source: the company profile's own sectors, then the website's classifications of its work. Below
 * 27 rem the cards stack in one column. A phone card sets its name beside the icon, and two cards side by side hold the
 * longest word ("Manufacturing") only from 26.4 rem in the site's face and from 27 rem in the widest fallback face
 * measured (TM-3 corrections 1 and 2).
 */
export function Industries({ view }: { view: HomeView }) {
  const { industries, links } = view;
  return (
    <section id="industries" className="sec sec-sheet sec-raised" aria-labelledby="industries-title">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5" data-reveal>
          <div className="max-w-[40rem]">
            <p className="eyebrow" data-tone="teal">
              {industries.label}
            </p>
            <h2 id="industries-title" className="t-h2 mt-4">
              {industries.title}
            </h2>
          </div>
          <div className="max-w-[26rem]">
            <p className="t-small">{industries.note}</p>
            <a href={links.industries} className="link-arrow mt-3 text-[0.92rem]">
              {industries.all}
              <Icon name="arrow" size={16} />
            </a>
          </div>
        </div>
        <div className="mt-9 grid grid-cols-1 gap-7">
          {(["profile", "inferred"] as const).map((basis) => (
            <div key={basis}>
              <p className="flex items-center gap-2 text-[0.8rem] font-semibold text-ink-2" data-reveal="fade">
                <Icon name={basis === "profile" ? "check" : "grid"} size={15} className={basis === "profile" ? "text-teal" : "text-brass"} />
                {industries.basis[basis]}
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2.5 max-[27rem]:grid-cols-1 sm:gap-3 lg:grid-cols-4">
                {industries.items
                  .filter((ind) => (basis === "profile" ? ind.basis !== "inferred" : ind.basis === "inferred"))
                  .map((ind, i) => (
                    <li key={ind.slug} data-reveal style={delay(i * 50)}>
                      <div className="a2-ind max-sm:items-center max-sm:gap-2.5 max-sm:p-3" data-tone={industryTone[ind.slug] ?? "steel"} data-basis={ind.basis}>
                        <span className="icon-chip size-10 shrink-0 max-sm:size-9">
                          <Icon name={industryIcon[ind.slug] ?? "factory"} size={20} />
                        </span>
                        <span className="min-w-0">
                          <span className="t-h4 block text-[0.98rem] max-sm:text-[0.86rem] max-sm:leading-snug">{ind.name}</span>
                          <span className="mt-1 block text-[0.84rem] leading-snug text-ink-2 max-sm:hidden">{ind.description}</span>
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
