import type { ReactNode } from "react";
import { Logo as Brand } from "@/components/brand/Logo";
import type { LabData, LabImage } from "../data";
import { Icon } from "../Icon";
import { Cutout, LabBar, Logo, Photo, delay } from "../ui";
import { cFontClasses } from "./fonts";
import "./c.css";

type Props = { data: LabData };
type ServiceItem = LabData["services"]["items"][number];
type MachineItem = LabData["machinery"]["items"][number];
type ProjectItem = LabData["projects"]["items"][number];

/** Each service's tile photo on this page — no photo repeats the hero's. */
function tilePhoto(s: ServiceItem): LabImage | undefined {
  switch (s.slug) {
    case "laser-cutting":
      return s.gallery.find((g) => g.src.includes("laser-cut-components")) ?? s.image;
    case "steel-structures":
      return s.support;
    case "scaffolding":
      return s.gallery[0];
    default:
      return s.image;
  }
}

/** Option C — Minimal Luxury Commerce: homepage preview. */
export function HomeC({ data }: Props) {
  return (
    <>
      <a href="#main" className="skip-link">
        {data.ui.skip}
      </a>
      <LabBar data={data} view="home" />
      <div className={`lab-c ${cFontClasses}`}>
        <div id="top" />
        <HeaderC data={data} />
        <main id="main" tabIndex={-1} className="outline-none">
          <HeroC data={data} />
          <AboutC data={data} />
          <ServicesC data={data} />
          <MachineryC data={data} />
          <ProjectsC data={data} />
          <ClientsC data={data} />
          <ContactC data={data} />
        </main>
        <FooterC data={data} />
      </div>
    </>
  );
}

export function HeaderC({ data }: Props) {
  const { ui, nav, lab } = data;
  return (
    <header className="c-header">
      <div className="shell relative flex h-[5rem] items-center gap-4">
        <a href="#top" aria-label={ui.homeLink} className="shrink-0">
          <Brand className="h-9 w-auto text-ink sm:h-10" title="RAWASY" />
        </a>
        <nav aria-label={ui.mainNav} className="absolute start-1/2 hidden -translate-x-1/2 rtl:translate-x-1/2 xl:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="nav-link" data-spy-link={item.id}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          <a href={lab.switchHref(lab.homeHref)} lang={lab.otherLocale} hrefLang={lab.otherLocale} className="ctl" aria-label={ui.languageSwitch}>
            <Icon name="globe" size={18} />
            <span className="max-sm:hidden">{lab.otherLabel}</span>
          </a>
          <span className="seg max-md:hidden" role="group" aria-label={ui.theme}>
            <button type="button" aria-pressed="true" aria-label={ui.light}>
              <Icon name="sun" size={15} />
            </button>
            <button type="button" aria-pressed="false" aria-label={`${ui.dark} — ${lab.darkLater}`} title={lab.darkLater} disabled>
              <Icon name="moon" size={15} />
            </button>
          </span>
          <a href={data.links.quote} className="btn btn-primary btn-sm ms-1 max-sm:hidden">
            {ui.getQuote}
          </a>
          <details data-menu className="xl:hidden">
            <summary className="ctl" aria-label={ui.openMenu}>
              <Icon name="menu" size={22} />
            </summary>
            <div className="c-menu-panel">
              <nav aria-label={ui.mobileNav} className="shell pb-7 pt-2">
                <ul>
                  {nav.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="nav-link" data-spy-link={item.id}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <a href={data.links.quote} className="btn btn-primary mt-6 w-full">
                  {ui.getQuote}
                  <Icon name="arrow" size={17} />
                </a>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function MosaicTile({ image, label, href, className, sizes, priority }: { image: LabImage; label: string; href: string; className?: string; sizes: string; priority?: boolean }) {
  return (
    <a href={href} className={`tile frame group block ${className ?? ""}`}>
      <Photo image={image} sizes={sizes} priority={priority} />
      <span className="absolute bottom-4 start-4 z-[2] inline-flex items-center gap-2 rounded-full bg-white/88 px-4 py-2 text-[0.9rem] font-medium text-ink shadow-[var(--sh-xs)] backdrop-blur-md">
        <span className="tile-name">{label}</span>
        <Icon name="arrow" size={15} />
      </span>
    </a>
  );
}

function HeroC({ data }: Props) {
  const { hero, services } = data;
  const by = (slug: string) => services.items.find((s) => s.slug === slug)!;
  const steel = by("steel-structures");
  const laser = by("laser-cutting");
  const scaffolding = by("scaffolding");
  return (
    <section className="pt-12 sm:pt-20" aria-labelledby="hero-title">
      <div className="shell text-center">
        <p className="eyebrow eyebrow-center">{hero.eyebrow}</p>
        <h1 id="hero-title" className="t-display mx-auto mt-7 max-w-[13em]">
          {hero.headline.join(" ")}
        </h1>
        <p className="t-lead mx-auto mt-7 max-w-[34em]">{hero.sub}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <a href="#contact" className="btn btn-primary btn-lg">
            {hero.primary}
            <Icon name="arrow" size={18} />
          </a>
          <a href="#services" className="link-arrow">
            {hero.secondary}
            <Icon name="arrow" size={16} />
          </a>
        </div>
      </div>
      <div className="shell mt-14 sm:mt-20">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12 lg:grid-rows-[15rem_15rem]">
          <MosaicTile image={steel.image!} label={steel.name} href={steel.href} priority className="aspect-[16/11] lg:col-span-7 lg:row-span-2 lg:aspect-auto" sizes="(min-width: 1024px) 720px, 92vw" />
          <MosaicTile image={laser.image!} label={laser.name} href={laser.href} className="aspect-[16/9] lg:col-span-5 lg:aspect-auto" sizes="(min-width: 1024px) 510px, 92vw" />
          <MosaicTile image={scaffolding.image!} label={scaffolding.name} href={scaffolding.href} className="aspect-[16/9] lg:col-span-5 lg:aspect-auto" sizes="(min-width: 1024px) 510px, 92vw" />
        </div>
      </div>
    </section>
  );
}

function AboutC({ data }: Props) {
  const { about, metrics } = data;
  return (
    <section id="about" className="sec" aria-labelledby="about-title">
      <div className="shell">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16" data-reveal>
          <div className="lg:col-span-5">
            <p className="eyebrow" data-tone="steel">
              {about.label}
            </p>
          </div>
          <div className="lg:col-span-7">
            <h2 id="about-title" className="t-h2">
              {about.statement}
            </h2>
            <div className="t-body mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {about.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="rule mt-9 pt-6">
              <p className="eyebrow" data-tone="teal">
                {data.industries.label}
              </p>
              <p className="mt-3 text-[1rem] leading-relaxed text-ink">{data.industries.items.map((ind) => ind.name).join(" · ")}</p>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-4">
              <a href={data.links.about} className="link-arrow">
                {about.link}
                <Icon name="arrow" size={16} />
              </a>
              <a href={data.links.industries} className="link-arrow">
                {data.industries.all}
                <Icon name="arrow" size={16} />
              </a>
            </div>
          </div>
        </div>
        <dl className="rule mt-16 grid grid-cols-2 gap-y-10 pt-10 lg:mt-24 lg:grid-cols-4" data-reveal>
          {metrics.map((m, i) => (
            <div key={m.slug} className={`flex flex-col border-line pe-6 ${i % 2 ? "max-lg:border-s max-lg:ps-6" : ""} ${i > 0 ? "lg:border-s lg:ps-8" : ""}`}>
              <dt className="order-2 mt-3 text-[0.92rem] leading-snug text-ink-2">{m.label}</dt>
              <dd className="t-stat order-1 text-[clamp(2.6rem,1.8rem+2.4vw,4rem)] leading-none text-ink" dir="ltr">
                {m.value}
                {m.unit && <span className="ms-1 text-[0.45em] font-normal text-ink-2">{m.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Borderless product tile: framed photo, name, tagline, quiet link. */
export function ServiceTileC({ service: s, open }: { service: ServiceItem; open: string }) {
  const photo = tilePhoto(s);
  return (
    <article className="tile relative">
      <div className="frame aspect-[4/3]">
        {photo ? (
          <Photo image={photo} sizes="(min-width: 1024px) 390px, (min-width: 640px) 46vw, 92vw" />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(70%_70%_at_50%_45%,#fbf8f2,var(--brass-soft))] text-[var(--sand)]">
            <Icon name="laser-engraving" size={80} className="[--icon-stroke:1]" />
          </div>
        )}
      </div>
      <h3 className="t-h3 mt-6">
        <a href={s.href} className="stretch">
          <span className="tile-name">{s.name}</span>
        </a>
      </h3>
      <p className="t-small mt-2 max-w-[30em]">{s.tagline}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-[0.92rem] font-medium text-ink">
        {open}
        <Icon name="arrow" size={15} />
      </span>
    </article>
  );
}

function SectionHeadC({ id, label, title, intro, action, tone = "brand" }: { id: string; label: string; title: string; intro?: string; action?: { href: string; label: string }; tone?: string }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-16" data-reveal>
      <div className="lg:col-span-5">
        <p className="eyebrow" data-tone={tone}>
          {label}
        </p>
      </div>
      <div className="lg:col-span-7">
        <h2 id={id} className="t-h2">
          {title}
        </h2>
        {intro && <p className="t-lead mt-5 max-w-[36em]">{intro}</p>}
        {action && (
          <a href={action.href} className="link-arrow mt-7">
            {action.label}
            <Icon name="arrow" size={16} />
          </a>
        )}
      </div>
    </div>
  );
}

function ServicesC({ data }: Props) {
  const { services } = data;
  return (
    <section id="services" className="sec sec-white" aria-labelledby="services-title">
      <div className="shell">
        <SectionHeadC id="services-title" label={services.label} title={services.title} intro={services.intro} action={{ href: data.links.services, label: services.all }} />
      </div>
      <div className="shell mt-14 max-sm:px-0 lg:mt-20">
        <ul className="rail flex gap-5 overflow-x-auto px-[var(--gutter)] pb-6 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-14 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
          {services.items.map((s, i) => (
            <li key={s.slug} className="w-[80%] shrink-0 sm:w-auto" data-reveal style={delay((i % 3) * 120)}>
              <ServiceTileC service={s} open={services.open} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function MachineCardC({ machine: m }: { machine: MachineItem }) {
  return (
    <a href={m.href} className="card card-link flex h-full flex-col overflow-hidden">
      <span className="c-spot h-32 px-5 after:hidden">
        <Cutout image={m.image} sizes="200px" className="h-auto max-h-[5.5rem] w-auto max-w-[85%]" />
      </span>
      <span className="flex flex-1 flex-col gap-1 p-5">
        <span className="t-h4 text-[1rem]">{m.name}</span>
        <span className="text-[0.86rem] text-ink-2" dir={m.power ? "ltr" : undefined}>
          {m.power ? `${m.power.value} ${m.power.unit}` : m.category}
        </span>
      </span>
    </a>
  );
}

function MachineryC({ data }: Props) {
  const { machinery } = data;
  const featured = machinery.items.find((m) => m.slug === "fiber-laser-combo-12kw")!;
  const rest = machinery.items.filter((m) => m !== featured);
  return (
    <section id="machinery" className="sec" aria-labelledby="machinery-title">
      <div className="shell">
        <SectionHeadC id="machinery-title" label={machinery.label} title={machinery.title} intro={machinery.intro} tone="steel" action={{ href: data.links.capabilities, label: machinery.all }} />
        <article className="mt-16 grid grid-cols-1 overflow-hidden rounded-[var(--r-panel)] border border-line bg-surface shadow-[var(--sh-raised)] lg:mt-20 lg:grid-cols-12" data-reveal>
          <div className="c-spot min-h-[16rem] px-8 py-12 sm:min-h-[22rem] lg:col-span-7">
            <Cutout image={featured.image} sizes="(min-width: 640px) 440px, 84vw" className="h-auto w-[86%]" />
          </div>
          <div className="flex flex-col justify-center p-8 sm:p-10 lg:col-span-5 lg:p-12">
            <p className="text-[0.86rem] font-medium text-steel">{featured.category}</p>
            <h3 className="t-h3 mt-3 text-[1.75rem]">{featured.name}</h3>
            <p className="t-small mt-4">{featured.capability}</p>
            <dl className="rule mt-8 grid grid-cols-2 gap-6 pt-6">
              <div>
                <dt className="text-[0.84rem] text-ink-2">{machinery.power}</dt>
                <dd className="t-stat mt-1 text-[2.4rem] leading-none" dir="ltr">
                  {featured.power!.value}
                  <span className="ms-1 text-[0.5em] font-normal text-ink-2">{featured.power!.unit}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[0.84rem] text-ink-2">{machinery.service}</dt>
                <dd className="mt-2">
                  <a href={featured.service.href} className="link-arrow">
                    {featured.service.name}
                    <Icon name="arrow" size={15} />
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </article>
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {rest.map((m, i) => (
            <li key={m.slug} data-reveal style={delay(i * 90)}>
              <MachineCardC machine={m} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProjectTileC({ project: p }: { project: ProjectItem }) {
  return (
    <article className="tile relative">
      <div className="frame aspect-[3/4]">
        <Photo image={p.image} sizes="(min-width: 1024px) 290px, (min-width: 640px) 46vw, 92vw" />
      </div>
      <h3 className="t-h4 mt-5">
        <a href={p.href} className="stretch">
          <span className="tile-name">{p.title}</span>
        </a>
      </h3>
      <p className="mt-1 text-[0.88rem] text-ink-2">{p.categories.join(" · ")}</p>
    </article>
  );
}

function ProjectsC({ data }: Props) {
  const { projects } = data;
  const order = ["tulip-roundabout-sculpture", "clock-tower-landmark", "suspended-lantern", "palm-leaf-shade-canopies"];
  const items = order.map((slug) => projects.items.find((p) => p.slug === slug)!);
  return (
    <section id="projects" className="sec sec-alt" aria-labelledby="projects-title">
      <div className="shell">
        <SectionHeadC id="projects-title" label={projects.label} title={projects.title} intro={projects.intro} tone="brass" action={{ href: data.links.projects, label: projects.all }} />
        <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:mt-20 lg:grid-cols-4">
          {items.map((p, i) => (
            <li key={p.slug} data-reveal style={delay(i * 120)}>
              <ProjectTileC project={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ClientsC({ data }: Props) {
  const { clients } = data;
  return (
    <section id="clients" className="sec sec-white" aria-labelledby="clients-title">
      <div className="shell">
        <div className="mx-auto max-w-[40rem] text-center" data-reveal>
          <p className="eyebrow eyebrow-center" data-tone="teal">
            {clients.label}
          </p>
          <h2 id="clients-title" className="t-h2 mt-6">
            {clients.title}
          </h2>
          <p className="t-lead mt-5">{clients.intro}</p>
        </div>
        <ul className="c-logos mt-14 grid-cols-3 md:grid-cols-5 lg:mt-16 lg:grid-cols-7" data-reveal="fade">
          {clients.items.map((c) => (
            <li key={c.slug}>
              <Logo image={c.mono} />
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <a href={data.links.clients} className="link-arrow">
            {clients.all}
            <Icon name="arrow" size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

function ContactC({ data }: Props) {
  const { cta, contact, ui } = data;
  const cols = [
    { label: ui.call, lines: contact.phones.map((p) => ({ text: p.display, href: p.href, ltr: true })) },
    {
      label: ui.email,
      lines: [
        { text: contact.email, href: contact.emailHref, ltr: true },
        { text: ui.whatsapp, href: contact.whatsappHref, ltr: false },
      ],
    },
    { label: ui.address, lines: contact.address.lines.map((line) => ({ text: line, href: undefined, ltr: false })) },
  ];
  return (
    <section id="contact" className="sec" aria-labelledby="contact-title">
      <div className="shell">
        <div className="mx-auto max-w-[56rem] text-center" data-reveal>
          <p className="eyebrow eyebrow-center">{cta.label}</p>
          <h2 id="contact-title" className="t-h2 mx-auto mt-6 max-w-[16em]">
            {cta.title}
          </h2>
          <ol className="mt-9 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[0.95rem] text-ink-2">
            {cta.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-full border border-line-strong text-[0.8rem] text-ink" dir="ltr">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <a href={data.links.quote} className="btn btn-primary btn-lg">
              {cta.primary}
              <Icon name="arrow" size={18} />
            </a>
            <a href={contact.whatsappHref} className="link-arrow">
              <Icon name="chat" size={17} />
              {cta.whatsapp}
            </a>
          </div>
        </div>
        <div className="rule mt-16 grid grid-cols-1 gap-8 pt-10 sm:grid-cols-3 lg:mt-20" data-reveal>
          {cols.map((col, i) => (
            <div key={col.label} className={i > 0 ? "sm:border-s sm:border-line sm:ps-8" : ""}>
              <p className="eyebrow">{col.label}</p>
              <ul className="mt-4 grid gap-1.5 text-[1.02rem]">
                {col.lines.map((line) => (
                  <li key={line.text}>
                    {line.href ? (
                      <a href={line.href} className="text-ink transition-colors hover:text-brand-ink" dir={line.ltr ? "ltr" : undefined}>
                        {line.text}
                      </a>
                    ) : (
                      <span className="text-ink">{line.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="rule mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 text-[0.92rem] text-ink-2" data-reveal="fade">
          <Icon name="shield" size={17} className="text-ink" />
          <span className="text-ink">{data.compliance.title}</span>
          <span aria-hidden>·</span>
          {data.compliance.items.map((c) => c.title).join(" · ")}
          <a href={data.links.certificates} className="link-arrow ms-auto">
            {data.compliance.all}
            <Icon name="arrow" size={15} />
          </a>
        </p>
      </div>
    </section>
  );
}

export function FooterC({ data }: Props) {
  const { footer, services, ui } = data;
  return (
    <footer className="c-footer">
      <div className="shell grid grid-cols-1 gap-12 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:py-20">
        <div className="sm:col-span-2 lg:col-span-5">
          <Brand className="h-11 w-auto text-ink" title="RAWASY" />
          <p className="mt-6 max-w-[22em] font-[family-name:var(--ff-display)] text-[1.5rem] font-medium leading-snug tracking-[-0.02em] text-ink">{footer.statement}</p>
          <a href={data.links.quote} className="btn btn-dark mt-7">
            {ui.getQuote}
            <Icon name="arrow" size={17} />
          </a>
        </div>
        <FooterColC title={footer.servicesTitle} className="lg:col-span-3">
          {services.items.map((s) => (
            <li key={s.slug}>
              <a href={s.href}>{s.name}</a>
            </li>
          ))}
        </FooterColC>
        <FooterColC title={footer.company.title} className="lg:col-span-2">
          {footer.company.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </FooterColC>
        <FooterColC title={footer.legalTitle} className="lg:col-span-2">
          {footer.legal.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </FooterColC>
      </div>
      <div className="shell">
        <p className="rule py-7 text-[0.86rem]">
          © {new Date().getFullYear()} {footer.legalName}. {footer.rights}
        </p>
      </div>
    </footer>
  );
}

function FooterColC({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <h2 className="eyebrow">{title}</h2>
      <ul className="mt-5 grid gap-3 text-[0.98rem]">{children}</ul>
    </div>
  );
}
