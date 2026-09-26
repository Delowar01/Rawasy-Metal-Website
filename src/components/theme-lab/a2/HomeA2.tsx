import type { ReactNode } from "react";
import { Logo as Brand } from "@/components/brand/Logo";
import type { ServiceSlug } from "@/content/types";
import type { LabData } from "../data";
import { Icon, type IconName } from "../Icon";
import { LaserCut } from "../signature/LaserCut";
import { LaserEngrave } from "../signature/LaserEngrave";
import { LabBar, Logo, Photo, delay, serviceIcon, statementIcon } from "../ui";
import { aFontClasses } from "../a/fonts";
import { CursorA2 } from "./Cursor";
import { HeroPlateA2 } from "./HeroPlate";
import { MachineShowcase } from "./MachineShowcase";
import { ThemeSwitchA2 } from "./ThemeSwitch";
import { themeBoot } from "./theme-boot";
import "./a2.css";

type Props = { data: LabData };
type Tone = "brand" | "steel" | "teal" | "brass";
type ServiceItem = LabData["services"]["items"][number];
type ProjectItem = LabData["projects"]["items"][number];

export const serviceTone: Record<ServiceSlug, Tone> = {
  "laser-cutting": "brand",
  "cnc-bending": "steel",
  "steel-structures": "steel",
  fabrication: "brass",
  "laser-engraving": "brass",
  scaffolding: "teal",
};

/** The one capability tag each standard service card carries (from its own highlights). */
const serviceTag: Record<ServiceSlug, number> = {
  "laser-cutting": 4,
  "cnc-bending": 0,
  "steel-structures": 0,
  fabrication: 0,
  "laser-engraving": 3,
  scaffolding: 0,
};

const industryIcon: Record<string, IconName> = {
  construction: "construction",
  infrastructure: "infrastructure",
  industrial: "factory",
  commercial: "commercial",
  architecture: "architecture",
  "public-realm": "landmark",
  "street-furniture": "shade",
  signage: "signage",
};

const industryTone: Record<string, Tone> = {
  construction: "teal",
  infrastructure: "steel",
  industrial: "steel",
  commercial: "steel",
  architecture: "brass",
  "public-realm": "brass",
  "street-furniture": "teal",
  signage: "brass",
};

const supportIcon: Record<string, IconName> = {
  formwork: "formwork",
  props: "props",
  rental: "rental",
  installation: "installation",
  transport: "truck",
};

const pillarIcon: Record<string, [IconName, Tone]> = {
  precision: ["precision", "steel"],
  technology: ["power", "steel"],
  craftsmanship: ["fabrication", "brass"],
  reliability: ["shield", "teal"],
  "custom-solutions": ["layers", "brass"],
  "project-execution": ["truck", "teal"],
};

/** Option A V2 — Clean Premium Commerce, refined: homepage preview. */
export function HomeA2({ data }: Props) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      <a href="#main" className="skip-link">
        {data.ui.skip}
      </a>
      <LabBar data={data} view="home" />
      <div className={`lab-a2 ${aFontClasses}`}>
        <div id="top" />
        <HeaderA2 data={data} view="home" />
        <main id="main" tabIndex={-1} className="outline-none">
          <HeroA2 data={data} />
          <CapabilityStrip data={data} />
          <AboutA2 data={data} />
          <ServicesA2 data={data} />
          <MachineryA2 data={data} />
          <ProjectsA2 data={data} />
          <IndustriesA2 data={data} />
          {/* Clients and compliance share one sheet. */}
          <div className="sec-sheet sec-muted">
            <ClientsA2 data={data} />
            <ComplianceA2 data={data} />
          </div>
          <ContactA2 data={data} />
        </main>
        <FooterA2 data={data} />
        <CursorA2 />
        </div>
        </>
        );
        }

/* ---------------------------------------------------------------- Header */

function LanguageSwitch({ data, here, className = "" }: { data: LabData; here: string; className?: string }) {
  const { lab, locale, ui } = data;
  const href = (target: "en" | "ar") => (target === locale ? here : lab.switchHref(here));
  return (
    <nav aria-label={ui.language} className={`a2-lang ${className}`}>
      <a href={href("en")} lang="en" hrefLang="en" aria-label="English" aria-current={locale === "en" ? "true" : undefined}>
        EN
      </a>
      <a href={href("ar")} lang="ar" hrefLang="ar" aria-label="العربية" aria-current={locale === "ar" ? "true" : undefined}>
        عربي
      </a>
    </nav>
  );
}

export function HeaderA2({ data, view }: Props & { view: "home" | "system" }) {
  const { ui, navFull, lab, services, links, contact } = data;
  const here = view === "home" ? lab.homeHref : lab.systemHref;
  // On the design-system sheet the section links lead to the homepage preview.
  const to = (id: string) => (view === "home" ? `#${id}` : `${lab.homeHref}#${id}`);
  const [home, about, servicesNav, ...rest] = navFull;
  const flat = [home, about];

  return (
    <header className="a2-header">
      <div className="shell relative flex h-[var(--hh)] items-center gap-3 xl:gap-6">
        <a href="#top" aria-label={ui.homeLink} className="shrink-0">
          <Brand className="h-8 w-auto text-ink min-[400px]:h-9 sm:h-10" title="RAWASY" />
        </a>

        <nav aria-label={ui.mainNav} className="a2-nav hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {flat.map((item) => (
              <li key={item.id}>
                <a href={to(item.id)} className="nav-link" data-spy-link={item.id}>
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <details data-dropdown className="a2-dd">
                <summary className="nav-link" data-spy-link="services">
                  {servicesNav.label}
                  <Icon name="chevron" size={16} className="chev" />
                </summary>
                <div className="a2-dd-panel">
                  <ul className="grid grid-cols-2 gap-1">
                    {services.items.map((s) => (
                      <li key={s.slug}>
                        <a href={s.href} className="a2-dd-item" data-tone={serviceTone[s.slug]}>
                          <span className="icon-chip size-10 shrink-0">
                            <Icon name={serviceIcon[s.slug]} size={20} />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold leading-snug">{s.name}</span>
                            <span className="mt-0.5 line-clamp-2 block text-[0.82rem] leading-snug text-ink-2">{s.tagline}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-bg px-4 py-3">
                    <a href={to("services")} className="link-arrow text-[0.92rem]">
                      {services.all}
                      <Icon name="arrow" size={16} />
                    </a>
                    <a href={links.quote} className="btn btn-primary btn-sm">
                      {ui.requestQuote}
                      <Icon name="arrow" size={15} />
                    </a>
                  </div>
                </div>
              </details>
            </li>
            {rest.map((item) => (
              <li key={item.id}>
                <a href={to(item.id)} className="nav-link" data-spy-link={item.id}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitch data={data} here={here} className="max-md:hidden" />
          <a href={lab.switchHref(here)} lang={lab.otherLocale} hrefLang={lab.otherLocale} className="ctl max-[399px]:hidden md:hidden" aria-label={ui.languageSwitch}>
            {lab.otherLocale === "ar" ? "ع" : "EN"}
          </a>
          <ThemeSwitchA2 label={ui.theme} light={ui.light} dark={ui.dark} className="max-lg:hidden" />
          <a href={links.quote} className="a2-head-quote btn btn-primary max-sm:min-h-10 max-sm:px-3 max-sm:text-[0.875rem]">
            {ui.getQuote}
            <Icon name="arrow" size={17} className="max-sm:hidden" />
          </a>

          <details data-menu data-sheet className="xl:hidden">
            <summary className="ctl a2-burger" aria-label={ui.openMenu}>
              <span />
              <span />
              <span />
            </summary>
            <div className="a2-sheet">
              <nav aria-label={ui.mobileNav} className="shell flex-1 pb-6 pt-2">
                <ul>
                  {flat.map((item) => (
                    <li key={item.id}>
                      <a href={to(item.id)} className="a2-sheet-row" data-spy-link={item.id}>
                        {item.label}
                        <Icon name="arrow" size={18} />
                      </a>
                    </li>
                  ))}
                  <li>
                    <details className="a2-sheet-sub">
                      <summary className="a2-sheet-row" data-spy-link="services">
                        {servicesNav.label}
                        <Icon name="chevron" size={20} className="chev" />
                      </summary>
                      <ul className="grid grid-cols-1 gap-2 py-3 min-[480px]:grid-cols-2">
                        {services.items.map((s) => (
                          <li key={s.slug}>
                            <a href={s.href} className="a2-dd-item border border-line-subtle" data-tone={serviceTone[s.slug]}>
                              <span className="icon-chip size-9 shrink-0">
                                <Icon name={serviceIcon[s.slug]} size={18} />
                              </span>
                              <span className="self-center font-semibold leading-snug">{s.name}</span>
                            </a>
                          </li>
                        ))}
                        <li className="min-[480px]:col-span-2">
                          <a href={to("services")} className="link-arrow px-1 py-2 text-[0.95rem]">
                            {services.all}
                            <Icon name="arrow" size={16} />
                          </a>
                        </li>
                      </ul>
                    </details>
                  </li>
                  {rest.map((item) => (
                    <li key={item.id}>
                      <a href={to(item.id)} className="a2-sheet-row" data-spy-link={item.id}>
                        {item.label}
                        <Icon name="arrow" size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[0.8rem] font-semibold text-ink-2">{ui.language}</p>
                    <LanguageSwitch data={data} here={here} className="mt-2 w-full [&>a]:h-11 [&>a]:flex-1 [&>a]:text-[0.95rem]" />
                  </div>
                  <div data-js-only>
                    <p className="text-[0.8rem] font-semibold text-ink-2">{ui.theme}</p>
                    <ThemeSwitchA2 label={ui.theme} light={ui.light} dark={ui.dark} className="mt-2 w-full [&>button]:h-11 [&>button]:flex-1" />
                  </div>
                  <div>
                    <p className="text-[0.8rem] font-semibold text-ink-2">{ui.phone}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <a href={contact.phones[0].href} className="btn btn-secondary">
                        <Icon name="phone" size={17} />
                        {ui.call}
                      </a>
                      <a href={contact.whatsappHref} className="btn btn-secondary">
                        <Icon name="chat" size={17} />
                        {ui.whatsapp}
                      </a>
                    </div>
                  </div>
                </div>
              </nav>
              <div className="a2-sheet-foot">
                <div className="shell py-3">
                  <a href={links.quote} className="btn btn-primary btn-lg w-full">
                    {ui.getQuote}
                    <Icon name="arrow" size={18} />
                  </a>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- Hero */

function HeroA2({ data }: Props) {
  const { hero, metrics, statements, contact, ui } = data;
  const power = metrics.find((m) => m.slug === "peak-laser-power")!;
  const lines = metrics.find((m) => m.slug === "service-lines")!;


  return (
    <section id="home" className="a2-hero" aria-labelledby="hero-title" data-hero data-ambient>
      <div aria-hidden className="a2-hero-ambient">
        <span className="a2-glow" />
      </div>
      <div className="shell grid grid-cols-1 items-center gap-12 pb-24 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-12 lg:pb-28 lg:pt-14 2xl:gap-16">
        <div className="lg:col-span-6">
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
          <HeroPlateA2 photo={hero.image} labels={hero.plate} className="a2-hero-stage">
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
          </HeroPlateA2>
        </div>
      </div>
    </section>
  );
}

/** Trust / capability strip: the six services, one tap away, straddling the hero's edge. */
function CapabilityStrip({ data }: Props) {
  const { services } = data;
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

function SectionHead({
  id,
  label,
  title,
  intro,
  action,
  tone = "brand",
  className = "",
}: {
  id: string;
  label: string;
  title: string;
  intro?: string;
  action?: { href: string; label: string };
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-10 gap-y-6 ${className}`}>
      <div className="max-w-[44rem]" data-reveal>
        <p className="eyebrow" data-tone={tone}>
          {label}
        </p>
        <h2 id={id} className="t-h2 mt-4">
          {title}
        </h2>
        {intro && <p className="t-lead mt-4">{intro}</p>}
      </div>
      {action && (
        <a href={action.href} className="btn btn-secondary shrink-0" data-reveal="fade">
          {action.label}
          <Icon name="arrow" size={17} />
        </a>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- About */

function AboutA2({ data }: Props) {
  const { about, pillars, hero, links } = data;
  return (
    <section id="about" className="sec" aria-labelledby="about-title">
      <div className="shell grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5" data-reveal>
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
        <h3 className="t-h4 flex items-center gap-2.5" data-reveal="fade">
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

/* ---------------------------------------------------------------- Services */

function ServiceLink({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-[0.9rem] font-semibold text-[var(--tone-ink)] ${className}`}>
      {label}
      <Icon name="arrow" size={16} className="go" />
    </span>
  );
}

/** The two laser services carry their signature illustrations. */
const signature: Partial<Record<ServiceSlug, "cut" | "engrave">> = { "laser-cutting": "cut", "laser-engraving": "engrave" };
const signatureStage = { cut: "a2-stage-dark", engrave: "a2-stage-brass a2-stage-engrave" };

/** Featured card: a laser signature (cutting, engraving) on its stage, or a large photo. */
export function ServiceFeatureA2({ service: s, data }: { service: ServiceItem; data: LabData }) {
  const sig = signature[s.slug];
  const specs = s.slug === "laser-cutting" ? data.metrics.filter((m) => m.slug === "peak-laser-power" || m.slug === "bevel-cutting") : [];
  return (
    <article className={`card card-link a2-svc ${sig ? "a2-svc-sig" : "card-edge"}`} data-tone={serviceTone[s.slug]} data-sig-host={sig ? "" : undefined}>
      <div className={`a2-stage ${sig ? `a2-stage-sig ${signatureStage[sig]}` : "card-media aspect-[16/9] lg:aspect-auto lg:min-h-[17rem] lg:flex-1"}`}>
        {sig === "cut" && <LaserCut />}
        {sig === "engrave" && <LaserEngrave />}
        {!sig && s.image && <Photo image={s.image} sizes="(min-width: 1024px) 500px, 92vw" />}
        <span className="badge badge-light absolute start-4 top-4 z-[2]">
          <Icon name={serviceIcon[s.slug]} size={14} />
          {s.highlights[0]}
        </span>
      </div>
      <div className={`flex flex-col p-5 sm:p-6 ${sig ? "flex-1" : ""}`}>
        <div className="flex items-center gap-3">
          <span className="icon-chip shrink-0">
            <Icon name={serviceIcon[s.slug]} size={22} />
          </span>
          <h3 className="t-h3">
            <a href={s.href} className="stretch outline-none">
              {s.name}
            </a>
          </h3>
        </div>
        <p className="t-small mt-3 max-w-[40em]">{s.tagline}</p>
        {specs.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:max-w-[26rem]">
            {specs.map((m) => (
              <div key={m.slug} className="a2-spec">
                <dt className="text-[0.76rem] font-medium leading-snug text-ink-2">{m.label}</dt>
                <dd className="t-stat text-[1.25rem] leading-none">
                  {/* The degree sign stays with its number in Arabic too. */}
                  <span dir="ltr">
                    {m.value}
                    {m.unit === "°" && <span className="text-[0.85rem] font-bold text-ink-2">°</span>}
                  </span>
                  {m.unit && m.unit !== "°" && <span className="ms-1 text-[0.85rem] font-bold text-ink-2">{m.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {s.highlights.slice(1, 4).map((h) => (
            <li key={h} className="tag">
              {h}
            </li>
          ))}
        </ul>
        <ServiceLink label={data.services.open} className={sig ? "mt-auto pt-5" : "pt-5"} />
      </div>
    </article>
  );
}

/** Standard card: photo, icon, name, tagline, one capability tag, link. */
export function ServiceCardA2({ service: s, open }: { service: ServiceItem; open: string }) {
  // Metal Fabrication shows its supporting photo: its cover (the workshop) already leads the About panel.
  const image = s.slug === "fabrication" ? s.support : s.image;
  return (
    <article className="card card-link card-edge a2-svc" data-tone={serviceTone[s.slug]}>
      <div className="a2-stage card-media aspect-[16/11]">{image && <Photo image={image} sizes="(min-width: 1024px) 300px, (min-width: 640px) 46vw, 48vw" />}</div>
      <div className="flex flex-1 flex-col p-3.5 pt-0 sm:p-5 sm:pt-0">
        <span className="icon-chip relative z-[2] -mt-5 size-10 shadow-[var(--sh-card)] [background:linear-gradient(var(--tone-soft),var(--tone-soft)),var(--surface)] sm:-mt-6 sm:size-12">
          <Icon name={serviceIcon[s.slug]} size={22} />
        </span>
        <h3 className="t-h3 mt-3 max-sm:text-[1.02rem]">
          <a href={s.href} className="stretch outline-none">
            {s.name}
          </a>
        </h3>
        <p className="t-small mt-1.5 max-sm:hidden">{s.tagline}</p>
        <p className="mt-3">
          <span className="tag tag-tone max-sm:text-[0.75rem]">{s.highlights[serviceTag[s.slug]]}</span>
        </p>
        <ServiceLink label={open} className="mt-auto pt-4 max-sm:text-[0.84rem]" />
      </div>
    </article>
  );
}

function ServicesA2({ data }: Props) {
  const { services, links } = data;
  // The two laser services lead with their signature illustrations; the other four follow as photo cards.
  const [cutting, engraving] = (["laser-cutting", "laser-engraving"] as const).map((slug) => services.items.find((s) => s.slug === slug)!);
  const rest = services.items.filter((s) => s !== cutting && s !== engraving);
  return (
    <section id="services" className="sec sec-sheet sec-muted" aria-labelledby="services-title">
      <div className="shell">
        <SectionHead id="services-title" label={services.label} title={services.title} intro={services.intro} action={{ href: links.services, label: services.all }} />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:mt-12 lg:grid-cols-12">
          <li className="col-span-2 lg:col-span-7" data-reveal>
            <ServiceFeatureA2 service={cutting} data={data} />
          </li>
          <li className="col-span-2 lg:col-span-5" data-reveal style={delay(80)}>
            <ServiceFeatureA2 service={engraving} data={data} />
          </li>
          {rest.map((s, i) => (
            <li key={s.slug} className="col-span-1 lg:col-span-3" data-reveal style={delay(i * 70)}>
              <ServiceCardA2 service={s} open={services.open} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Machinery */

function MachineryA2({ data }: Props) {
  const { machinery, links, ui } = data;
  const order = ["fiber-laser-combo-12kw", "tube-cutting-12kw", "fiber-laser-6kw", "fiber-laser-3kw", "cnc-press-brake", "laser-welding"];
  const items = order.map((slug) => machinery.items.find((m) => m.slug === slug)!).filter(Boolean);
  return (
    <section id="machinery" className="sec sec-sheet sec-raised" aria-labelledby="machinery-title">
      <div className="shell">
        <SectionHead
          id="machinery-title"
          label={machinery.label}
          title={machinery.title}
          intro={machinery.intro}
          tone="steel"
          action={{ href: links.capabilities, label: machinery.all }}
        />
        <div className="mt-10 lg:mt-12" data-reveal>
          <MachineShowcase items={items} quote={links.quote} labels={{ power: machinery.power, service: machinery.service, list: machinery.label, quote: ui.requestQuote }} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Projects */

export function ProjectCardA2({ project: p, view, sizes, className = "" }: { project: ProjectItem; view: string; sizes: string; className?: string }) {
  return (
    <a href={p.href} className={`card card-link a2-proj ${className}`}>
      <span className="card-media">
        <Photo image={p.image} alt="" sizes={sizes} />
      </span>
      <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <span className="a2-proj-title t-h3 block text-white">{p.title}</span>
        <span className="a2-proj-cta mt-2">
          {view}
          <Icon name="arrow" size={16} />
        </span>
      </span>
      <span className="badge badge-light absolute start-3 top-3">{p.categories[0]}</span>
      <span className="a2-proj-line" aria-hidden />
    </a>
  );
}

function ProjectsA2({ data }: Props) {
  const { projects, links } = data;
  const order = ["tulip-roundabout-sculpture", "clock-tower-landmark", "geometric-lanterns", "wave-form-sculpture", "suspended-lantern", "palm-leaf-shade-canopies"];
  const items = order.map((slug) => projects.items.find((p) => p.slug === slug)!).filter(Boolean);
  const layout = ["lg:col-span-2", "lg:row-span-2", "", "", "", ""];
  return (
    <section id="projects" className="sec" aria-labelledby="projects-title">
      <div className="shell">
        <SectionHead id="projects-title" label={projects.label} title={projects.title} intro={projects.intro} tone="brass" action={{ href: links.projects, label: projects.all }} />
      </div>
      <div className="shell mt-10 max-lg:px-0 lg:mt-12">
        <ul className="rail flex gap-3 overflow-x-auto px-[var(--gutter)] pb-3 sm:gap-4 lg:grid lg:grid-cols-4 lg:grid-rows-[16.5rem_16.5rem] lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
          {items.map((p, i) => (
            <li key={p.slug} className={`h-[24rem] w-[78%] shrink-0 sm:h-[26rem] sm:w-[44%] lg:h-auto lg:w-auto ${layout[i]}`} data-reveal style={delay((i % 4) * 60)}>
              <ProjectCardA2 project={p} view={projects.view} sizes={i === 0 ? "(min-width: 1024px) 600px, 80vw" : "(min-width: 1024px) 300px, 80vw"} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Industries */

function IndustriesA2({ data }: Props) {
  const { industries, links } = data;
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
              <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
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

/* ---------------------------------------------------------------- Clients and compliance */

function ClientsA2({ data }: Props) {
  const { clients, links } = data;
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

function ComplianceA2({ data }: Props) {
  const { compliance, links } = data;
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

/* ---------------------------------------------------------------- Contact */

/** Phone, WhatsApp, email and address as tone-coded rows (links lift and fill their icon on hover). */
export function ContactRowsA2({ data }: Props) {
  const { contact, ui } = data;
  const rows: { icon: IconName; tone: Tone; label: string; value: string; href?: string; ltr?: boolean }[] = [
    { icon: "phone", tone: "steel", label: ui.call, value: contact.phones[0].display, href: contact.phones[0].href, ltr: true },
    { icon: "chat", tone: "teal", label: ui.whatsapp, value: contact.phones[0].display, href: contact.whatsappHref, ltr: true },
    { icon: "mail", tone: "steel", label: ui.email, value: contact.email, href: contact.emailHref, ltr: true },
    { icon: "pin", tone: "brass", label: ui.address, value: contact.address.full },
  ];
  return rows.map((row) => {
    const inner = (
      <>
        <span className="icon-chip shrink-0">
          <Icon name={row.icon} size={20} />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.78rem] font-medium text-ink-2">{row.label}</span>
          <span className="block font-semibold break-words" dir={row.ltr ? "ltr" : undefined}>
            {row.value}
          </span>
        </span>
        {row.href && <Icon name="arrow" size={16} className="go ms-auto shrink-0 text-ink-3 max-sm:hidden lg:max-xl:hidden" />}
      </>
    );
    return row.href ? (
      <a key={row.label} href={row.href} className="contact-row card-link" data-tone={row.tone}>
        {inner}
      </a>
    ) : (
      <div key={row.label} className="contact-row" data-tone={row.tone}>
        {inner}
      </div>
    );
  });
}

function ContactA2({ data }: Props) {
  const { cta, contact, ui, links } = data;
  return (
    <section id="contact" className="sec" aria-labelledby="contact-title">
      <div className="shell">
        <div className="a2-cta grid grid-cols-1 lg:grid-cols-12" data-reveal>
          <div className="a2-cta-dark p-6 sm:p-10 lg:col-span-7 lg:p-12">
            <Photo image={cta.image} alt="" sizes="(min-width: 1024px) 760px, 100vw" className="-z-[2] object-cover object-[50%_40%]" />
            <p className="eyebrow eyebrow-dark">{cta.label}</p>
            <h2 id="contact-title" className="t-h2 mt-5 max-w-[17em] text-white">
              {cta.title}
            </h2>
            <ol className="mt-7 grid gap-2.5 sm:grid-cols-3">
              {cta.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-3 rounded-[14px] border border-white/15 bg-white/[0.07] p-3.5 sm:flex-col sm:gap-2.5">
                  <span className="step-num">{i + 1}</span>
                  <span className="text-[0.9rem] font-medium leading-snug text-white">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={links.quote} className="btn btn-primary btn-lg">
                {ui.requestQuote}
                <Icon name="arrow" size={18} />
              </a>
              <a href={contact.whatsappHref} className="btn btn-on-dark btn-lg">
                <Icon name="chat" size={19} />
                {cta.whatsapp}
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 bg-surface-2 p-5 sm:p-8 lg:col-span-5 lg:p-10">
            <ContactRowsA2 data={data} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Footer */

export function FooterA2({ data }: Props) {
  const { footer, services, contact, ui, links } = data;
  return (
    <footer className="a2-footer">
      <div className="shell grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:py-16">
        <div className="sm:col-span-2 lg:col-span-4">
          <Brand className="h-11 w-auto text-white" title="RAWASY" />
          <p className="mt-5 max-w-[26em] text-[0.95rem] leading-relaxed">{footer.companyStatement}</p>
          <a href={links.quote} className="btn btn-primary mt-6">
            {ui.getQuote}
            <Icon name="arrow" size={17} />
          </a>
        </div>
        <FooterCol title={footer.servicesTitle} className="lg:col-span-3">
          {services.items.map((s) => (
            <li key={s.slug}>
              <a href={s.href}>{s.name}</a>
            </li>
          ))}
        </FooterCol>
        <FooterCol title={footer.company.title} className="lg:col-span-2">
          {footer.company.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </FooterCol>
        <FooterCol title={footer.contactTitle} className="lg:col-span-3">
          {contact.phones.map((p) => (
            <li key={p.href}>
              <a href={p.href} dir="ltr">
                {p.display}
              </a>
            </li>
          ))}
          <li>
            <a href={contact.emailHref}>{contact.email}</a>
          </li>
          <li className="leading-relaxed">{contact.address.full}</li>
        </FooterCol>
      </div>
      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-3 py-6 text-[0.85rem] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {footer.legalName}. {footer.rights}
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {footer.legal.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
            <li>
              <a href="#top" className="inline-flex items-center gap-1.5 font-semibold text-white">
                {ui.backToTop}
                <Icon name="chevron" size={15} className="rotate-180" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <h2 className="text-[0.8rem] font-semibold tracking-[0.04em] text-white uppercase">{title}</h2>
      <ul className="mt-4 grid gap-2.5 text-[0.95rem]">{children}</ul>
    </div>
  );
}
