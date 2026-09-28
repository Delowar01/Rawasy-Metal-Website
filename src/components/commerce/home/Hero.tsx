import type { ShellView } from "../data";
import { HeroPlate } from "../hero/HeroPlate";
import { Icon } from "../Icon";
import { serviceTone } from "../tones";
import { delay, serviceIcon, statementIcon } from "../ui";
import type { HomeView } from "./data";

type Props = { view: HomeView; shell: ShellView };

/**
 * The hero: the headline, the calls to action, quick contact and the capability statements beside the laser-cut
 * plate on its stage (its cutting sequence repeats every 10 s while on screen; see HeroPlate). The calls to action
 * lead to this page's contact and machinery sections.
 */
export function Hero({ view, shell }: Props) {
  const { hero, metrics, statements } = view;
  const { contact, ui } = shell;
  const power = metrics.find((m) => m.slug === "peak-laser-power")!;
  const lines = metrics.find((m) => m.slug === "service-lines")!;

  return (
    <section id="home" className="a2-hero" aria-labelledby="hero-title" data-hero data-ambient>
      <div aria-hidden className="a2-hero-ambient">
        <span className="a2-glow" />
      </div>
      <div className="shell grid grid-cols-1 items-center gap-12 pb-24 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-12 lg:pb-28 lg:pt-14 2xl:gap-16">
        <div className="a2-read lg:col-span-6">
          <p className="eyebrow" data-enter>
            {hero.eyebrow} · {hero.location}
          </p>
          <h1 id="hero-title" className="t-display mt-6 max-w-[12em]" data-enter style={delay(70)}>
            {hero.headline.join(" ")}
          </h1>
          <p className="t-lead mt-5 max-w-[34em]" data-enter style={delay(140)}>
            {hero.sub}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3" data-enter style={delay(210)}>
            <a href="#contact" className="btn btn-primary btn-lg">
              {hero.primary}
              <Icon name="arrow" size={18} />
            </a>
            <a href="#machinery" className="btn btn-secondary btn-lg">
              {hero.secondary}
            </a>
          </div>
          <p className="a2-hero-talk mt-5 flex flex-wrap items-center gap-x-5 gap-y-2" data-enter style={delay(250)}>
            <a href={contact.phones[0].href} className="a2-talk" data-tone="steel">
              <span className="icon-chip size-8 rounded-full">
                <Icon name="phone" size={15} />
              </span>
              <span className="sr-only">{ui.call}: </span>
              <span dir="ltr">{contact.phones[0].display}</span>
            </a>
            <a href={contact.whatsappHref} className="a2-talk" data-tone="teal">
              <span className="icon-chip size-8 rounded-full">
                <Icon name="chat" size={15} />
              </span>
              {ui.whatsapp}
            </a>
          </p>
          <ul className="a2-trust mt-8 grid grid-cols-1 gap-x-6 gap-y-3 pt-6 min-[480px]:grid-cols-2" data-enter style={delay(300)}>
            {statements.map((s, i) => (
              <li key={s.title} className="flex items-center gap-3 text-[0.92rem] font-medium">
                <span className="icon-chip size-8 shrink-0 rounded-[10px] text-ink-2">
                  <Icon name={statementIcon[i] ?? "check"} size={16} />
                </span>
                {s.title}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-6" data-enter style={delay(120)}>
          <HeroPlate photo={hero.image} labels={hero.plate} className="a2-hero-stage">
            {[
              { icon: "power" as const, tone: "brand" as const, value: power.value, unit: power.unit, label: power.label },
              { icon: "grid" as const, tone: "steel" as const, value: lines.value, unit: undefined, label: lines.label },
            ].map((m) => (
              <p key={m.icon} className="a2-spec-cell" data-tone={m.tone}>
                <span className="icon-chip size-10 shrink-0">
                  <Icon name={m.icon} size={19} />
                </span>
                <span className="min-w-0">
                  <span className="t-stat block text-[1.25rem] leading-none">
                    <span dir="ltr">{m.value}</span>
                    {m.unit && <span className="ms-1 text-[0.9rem] font-bold text-ink-2">{m.unit}</span>}
                  </span>
                  <span className="mt-1 block text-[0.78rem] leading-snug text-ink-2">{m.label}</span>
                </span>
              </p>
            ))}
          </HeroPlate>
        </div>
      </div>
    </section>
  );
}

/** Capability strip: the six services, one tap away, straddling the hero's edge. */
export function CapabilityStrip({ view }: { view: HomeView }) {
  const { services } = view;
  return (
    <div className="shell relative z-[3] -mt-14">
      <nav aria-label={services.label} className="a2-strip" data-enter style={delay(420)}>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[inherit] bg-line-subtle md:grid-cols-3 xl:grid-cols-6">
          {services.items.map((s) => (
            <li key={s.slug} className="bg-surface">
              <a href={s.href} className="a2-quick" data-tone={serviceTone[s.slug]}>
                <span className="icon-chip size-10 shrink-0 max-sm:size-9 xl:size-9">
                  <Icon name={serviceIcon[s.slug]} size={20} />
                </span>
                <span className="min-w-0 max-sm:text-[0.875rem]">{s.name}</span>
                <Icon name="arrow" size={16} className="go max-sm:hidden" />
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
