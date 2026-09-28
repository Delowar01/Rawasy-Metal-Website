import { Icon, type IconName } from "../Icon";
import { Logo, delay } from "../ui";
import type { HomeView } from "./data";

/** Client logos: greyscale at rest, original colours on hover, focus or with the switch. No counts or claims. */
export function Clients({ view }: { view: HomeView }) {
  const { clients, links } = view;
  return (
    <section id="clients" className="sec" aria-labelledby="clients-title">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div className="max-w-[44rem]" data-reveal>
            <p className="eyebrow" data-tone="teal">
              {clients.label}
            </p>
            <h2 id="clients-title" className="t-h2 mt-4">
              {clients.title}
            </h2>
            <p className="t-lead mt-4">{clients.intro}</p>
          </div>
          <button type="button" className="a2-toggle" data-toggle="colour" aria-pressed="false" aria-controls="client-wall" data-js-only>
            <span className="knob" aria-hidden />
            <Icon name="colour" size={16} className="text-teal" />
            {clients.colours}
          </button>
        </div>
        {/* A centred wrap: a short last row sits in the middle instead of leaving a lone logo at the start. */}
        <ul id="client-wall" aria-label={clients.listLabel} className="mt-10 flex flex-wrap justify-center gap-2 sm:gap-3">
          {clients.items.map((c, i) => (
            <li
              key={c.slug}
              className="w-[calc((100%-1rem)/3)] sm:w-[calc((100%-2.25rem)/4)] md:w-[calc((100%-3rem)/5)] lg:w-[calc((100%-4.5rem)/7)]"
              data-reveal="fade"
              style={delay((i % 7) * 40)}
            >
              <div className="logo-tile">
                <Logo image={c.logo} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-10 gap-y-4">
          <p className="max-w-[48em] text-[0.82rem] leading-relaxed text-ink-2">{clients.note}</p>
          <a href={links.clients} className="link-arrow text-[0.92rem]">
            {clients.all}
            <Icon name="arrow" size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

/** Compliance: the documents RAWASY holds, as titles and issuers only (numbers and QR codes stay on the page). */
export function Compliance({ view }: { view: HomeView }) {
  const { compliance, links } = view;
  const icons: IconName[] = ["doc", "shield", "doc"];
  return (
    <section className="pb-[var(--sec-y)]" aria-labelledby="compliance-title">
      <div className="shell">
        <div className="a2-comp grid grid-cols-1 gap-6 p-5 sm:p-7 lg:grid-cols-12 lg:items-center lg:gap-8" data-tone="brass" data-reveal>
          <div className="lg:col-span-4">
            <p className="eyebrow">{compliance.label}</p>
            <h2 id="compliance-title" className="t-h3 mt-3 text-[1.35rem]">
              {compliance.title}
            </h2>
            <p className="mt-2 text-[0.86rem] text-ink-2">{compliance.note}</p>
            <a href={links.certificates} className="link-arrow mt-4 text-[0.92rem]">
              {compliance.all}
              <Icon name="arrow" size={16} />
            </a>
          </div>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:col-span-8">
            {compliance.items.map((c, i) => (
              <li key={c.slug} className="flex h-full items-start gap-3 rounded-[14px] border border-[var(--brass-line)] bg-surface p-3.5 shadow-[var(--sh-xs)]">
                <span className="icon-chip size-9 shrink-0">
                  <Icon name={icons[i] ?? "doc"} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.9rem] font-semibold leading-snug">{c.title}</span>
                  <span className="mt-0.5 block text-[0.8rem] leading-snug text-ink-2">{c.issuer}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
