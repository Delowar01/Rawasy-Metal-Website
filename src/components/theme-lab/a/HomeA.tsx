import type { ReactNode } from "react";
import { Logo as Brand } from "@/components/brand/Logo";
import type { LabData } from "../data";
import { Icon } from "../Icon";
import { Cutout, LabBar, Logo, Photo, delay, metricIcon, serviceIcon, statementIcon } from "../ui";
import { aFontClasses } from "./fonts";
import "./a.css";

type Props = { data: LabData };

const tones = ["steel", "teal", "brass", "brand"] as const;
const serviceTone = { "laser-cutting": "brand", "cnc-bending": "steel", "steel-structures": "steel", fabrication: "brass", "laser-engraving": "brass", scaffolding: "teal" } as const;

/** Option A — Clean Premium Commerce: homepage preview. */
export function HomeA({ data }: Props) {
  return (
    <>
      <a href="#main" className="skip-link">
        {data.ui.skip}
      </a>
      <LabBar data={data} view="home" />
      <div className={`lab-a ${aFontClasses}`}>
        <div id="top" />
        <HeaderA data={data} />
        <main id="main" tabIndex={-1} className="outline-none">
          <HeroA data={data} />
          <AboutA data={data} />
          <ServicesA data={data} />
          <MachineryA data={data} />
          <ProjectsA data={data} />
          <ClientsA data={data} />
          <ContactA data={data} />
        </main>
        <FooterA data={data} />
      </div>
    </>
  );
}

export function HeaderA({ data }: Props) {
  const { ui, nav, lab } = data;
  return (
    <header className="a-header">
      <div className="shell relative flex h-[4.5rem] items-center gap-4 lg:gap-8">
        <a href="#top" aria-label={ui.homeLink} className="shrink-0">
          <Brand className="h-9 w-auto text-ink sm:h-10" title="RAWASY" />
        </a>
        <nav aria-label={ui.mainNav} className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {nav.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="nav-link" data-spy-link={item.id}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <a href={lab.switchHref(lab.homeHref)} lang={lab.otherLocale} hrefLang={lab.otherLocale} className="ctl" aria-label={ui.languageSwitch}>
            <Icon name="globe" size={18} />
            <span className="max-sm:hidden">{lab.otherLabel}</span>
          </a>
          <span className="seg max-md:hidden" role="group" aria-label={ui.theme}>
            <button type="button" aria-pressed="true" aria-label={ui.light}>
              <Icon name="sun" size={16} />
            </button>
            <button type="button" aria-pressed="false" aria-label={`${ui.dark} — ${lab.darkLater}`} title={lab.darkLater} disabled>
              <Icon name="moon" size={16} />
            </button>
          </span>
          <a href={data.links.quote} className="btn btn-primary max-sm:hidden">
            {ui.getQuote}
            <Icon name="arrow" size={17} />
          </a>
          <details data-menu className="a-menu xl:hidden">
            <summary className="ctl" aria-label={ui.openMenu}>
              <Icon name="menu" size={20} />
            </summary>
            <div className="a-menu-panel">
              <nav aria-label={ui.mobileNav} className="shell py-4">
                <ul className="grid gap-1 sm:grid-cols-2">
                  {nav.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="nav-link w-full" data-spy-link={item.id}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line-subtle pt-4">
                  <a href={data.links.quote} className="btn btn-primary">
                    {ui.getQuote}
                    <Icon name="arrow" size={17} />
                  </a>
                  <a href={data.contact.whatsappHref} className="btn btn-secondary">
                    <Icon name="chat" size={18} />
                    {ui.whatsapp}
                  </a>
                </div>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function HeroA({ data }: Props) {
  const { hero, metrics, services } = data;
  const machine = data.machinery.items.find((m) => m.slug === "fiber-laser-combo-12kw")!;
  const featured = services.items.slice(0, 3);
  return (
    <section className="a-hero" aria-labelledby="hero-title">
      <div aria-hidden className="a-hero-glow" />
      <div className="shell grid grid-cols-1 items-center gap-12 pb-12 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-10 lg:pb-16 lg:pt-16">
        <div className="lg:col-span-6">
          <p className="eyebrow">
            {hero.eyebrow} · {hero.location}
          </p>
          <h1 id="hero-title" className="t-display mt-6 max-w-[12em]">
            {hero.headline.join(" ")}
          </h1>
          <p className="t-lead mt-5 max-w-[36em]">{hero.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#contact" className="btn btn-primary btn-lg">
              {hero.primary}
              <Icon name="arrow" size={18} />
            </a>
            <a href="#services" className="btn btn-secondary btn-lg">
              {hero.secondary}
            </a>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((m, i) => (
              <li key={m.slug} className="card p-3.5" data-tone={tones[i]}>
                <span className="flex items-center gap-2 text-[var(--tone)]">
                  <Icon name={metricIcon[m.slug]} size={18} />
                </span>
                <p className="t-stat mt-2 text-[1.35rem] leading-none text-ink">
                  {m.value}
                  {m.unit && <span className={`${m.unit === "°" ? "" : "ms-0.5 "}text-[0.95rem] font-bold text-ink-2`}>{m.unit}</span>}
                </p>
                <p className="mt-1.5 text-[0.78rem] leading-snug text-ink-2">{m.label}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative lg:col-span-6">
          <div className="a-hero-media relative mx-auto aspect-[5/4] w-full max-w-[36rem] lg:ms-auto lg:me-0">
            <Photo image={hero.image} priority sizes="(min-width: 1024px) 576px, 92vw" />
          </div>
          <div className="a-float bottom-[-1.25rem] start-3 w-[13.5rem] p-3 sm:bottom-[-1.5rem] sm:start-[-1.5rem] sm:w-[17rem]">
            <div className="a-stage h-24 overflow-hidden rounded-[10px] max-sm:hidden">
              <Cutout image={machine.image} sizes="220px" className="h-auto w-[82%]" />
            </div>
            <p className="t-h4 mt-3 text-[0.92rem]">{machine.name}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="tag tag-tone" data-tone="brand">
                <Icon name="power" size={14} />
                {machine.power!.value} {machine.power!.unit}
              </span>
              <span className="text-[0.78rem] text-ink-2">{machine.service.name}</span>
            </div>
          </div>
          <ul className="a-float a-float-2 end-2 top-[-1rem] hidden gap-1.5 p-3 sm:grid sm:end-[-0.5rem]">
            {featured.map((s) => (
              <li key={s.slug} className="flex items-center gap-2 text-[0.84rem] font-semibold">
                <span className="icon-chip size-7 rounded-lg" data-tone={serviceTone[s.slug]}>
                  <Icon name={serviceIcon[s.slug]} size={15} />
                </span>
                {s.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="shell pb-12 lg:pb-16">
        <ul className="a-quickbar grid grid-cols-1 gap-px overflow-hidden bg-line-subtle min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {services.items.map((s) => (
            <li key={s.slug} className="bg-surface">
              <a href={s.href} className="a-quick h-full" data-tone={serviceTone[s.slug]}>
                <span className="icon-chip size-10">
                  <Icon name={serviceIcon[s.slug]} size={20} />
                </span>
                {s.name}
                <Icon name="arrow" size={16} className="go" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SectionHead({
  id,
  label,
  title,
  intro,
  action,
  tone = "brand",
  center,
}: {
  id: string;
  label: string;
  title: string;
  intro?: string;
  action?: { href: string; label: string };
  tone?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-[44rem] text-center" : "flex flex-wrap items-end justify-between gap-x-10 gap-y-6"}>
      <div className={center ? "" : "max-w-[44rem]"} data-reveal>
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

function AboutA({ data }: Props) {
  const { about, statements, industries } = data;
  return (
    <section id="about" className="sec sec-white" aria-labelledby="about-title">
      <div className="shell grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="relative lg:col-span-5" data-reveal>
          <div className="card relative aspect-[16/11] overflow-hidden p-0 shadow-[var(--sh-image)]">
            <Photo image={about.workshop} sizes="(min-width: 1024px) 460px, 92vw" />
          </div>
          <div className="card absolute -bottom-8 end-[-0.75rem] aspect-[3/4] w-[34%] overflow-hidden border-4 border-surface shadow-[var(--sh-float)] sm:end-[-1.5rem]">
            <Photo image={about.detail} sizes="180px" />
          </div>
          <div className="card absolute -top-5 start-4 flex items-center gap-2.5 px-3.5 py-2.5 shadow-[var(--sh-float)]" data-tone="teal">
            <span className="icon-chip size-8 rounded-lg">
              <Icon name="pin" size={16} />
            </span>
            <span className="text-[0.85rem] font-semibold">{data.hero.location}</span>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div data-reveal>
            <p className="eyebrow" data-tone="steel">
              {about.label}
            </p>
            <h2 id="about-title" className="t-h2 mt-4">
              {about.statement}
            </h2>
            <p className="t-body mt-5 max-w-[42em]">{about.paragraphs[0]}</p>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {statements.map((s, i) => (
              <li key={s.title} className="card flex items-start gap-3.5 p-4" data-tone={tones[i]} data-reveal style={delay(i * 60)}>
                <span className="icon-chip shrink-0">
                  <Icon name={statementIcon[i]} size={20} />
                </span>
                <span>
                  <span className="t-h4 block">{s.title}</span>
                  <span className="t-small mt-0.5 block">{s.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3" data-reveal="fade">
            <a href={data.links.about} className="btn btn-dark">
              {about.link}
              <Icon name="arrow" size={17} />
            </a>
            <a href={data.links.industries} className="link-arrow">
              {industries.all}
              <Icon name="arrow" size={16} />
            </a>
          </div>
        </div>
      </div>

      <div className="shell mt-16 lg:mt-20">
        <div className="card flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6" data-reveal>
          <p className="flex shrink-0 items-center gap-2.5 font-semibold">
            <span className="icon-chip size-9 rounded-[10px]" data-tone="steel">
              <Icon name="factory" size={18} />
            </span>
            {industries.label}
          </p>
          <ul className="flex flex-wrap gap-2">
            {industries.items.map((ind) => (
              <li key={ind.slug} className="tag">
                {ind.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

type ServiceItem = LabData["services"]["items"][number];
type MachineItem = LabData["machinery"]["items"][number];
type ProjectItem = LabData["projects"]["items"][number];

/** Image card: photo (or icon panel), overlapping icon chip, name, tagline, highlights, action. */
export function ServiceCardA({ service: s, open }: { service: ServiceItem; open: string }) {
  return (
    <article className="card card-link flex h-full flex-col overflow-hidden" data-tone={serviceTone[s.slug]}>
      <div className="card-media aspect-[16/10] border-b border-line-subtle">
        {s.image ? (
          <Photo image={s.image} sizes="(min-width: 1024px) 390px, (min-width: 640px) 46vw, 92vw" />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(135deg,var(--brass-soft),#efe4cf)] text-[var(--brass)]">
            <Icon name="laser-engraving" size={72} className="[--icon-stroke:1.25] [--duo-opacity:0.22]" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6 pt-0">
        <span className="icon-chip icon-chip-lg relative -mt-[1.625rem] shadow-[var(--sh-card)] [background:linear-gradient(var(--tone-soft),var(--tone-soft)),var(--surface)]">
          <Icon name={serviceIcon[s.slug]} size={24} />
        </span>
        <h3 className="t-h3 mt-4">
          <a href={s.href} className="stretch outline-none">
            {s.name}
          </a>
        </h3>
        <p className="t-small mt-2">{s.tagline}</p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {s.highlights.slice(0, 3).map((h) => (
            <li key={h} className="tag">
              {h}
            </li>
          ))}
        </ul>
        <span className="mt-auto flex items-center gap-1.5 pt-6 text-[0.9rem] font-semibold text-[var(--tone-ink)]">
          {open}
          <Icon name="arrow" size={16} />
        </span>
      </div>
    </article>
  );
}

/** Horizontal card: product cut-out, name, key figure, related service. */
export function MachineRowA({ machine: m }: { machine: MachineItem }) {
  return (
    <a href={m.href} className="card card-link flex items-center gap-4 p-3 pe-4">
      <span className="a-stage h-[4.5rem] w-28 shrink-0 overflow-hidden rounded-[10px] after:hidden sm:w-32">
        <Cutout image={m.image} sizes="128px" className="h-auto max-h-[3.75rem] w-auto max-w-[88%]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-h4 block truncate">{m.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[0.8rem] text-ink-2">
          {m.power ? (
            <span className="tag tag-tone" data-tone="brand">
              <Icon name="power" size={13} />
              {m.power.value} {m.power.unit}
            </span>
          ) : (
            m.category.toLowerCase() !== m.service.name.toLowerCase() && <span className="tag">{m.category}</span>
          )}
          {m.service.name}
        </span>
      </span>
      <Icon name="arrow" size={18} className="shrink-0 text-ink-3" />
    </a>
  );
}

/** Image-led project card with a floating label panel. */
export function ProjectCardA({ project: p, className = "" }: { project: ProjectItem; className?: string }) {
  return (
    <a href={p.href} className={`card card-link group relative block h-full min-h-[20rem] overflow-hidden lg:min-h-0 ${className}`}>
      <span className="card-media absolute inset-0">
        <Photo image={p.image} alt="" sizes="(min-width: 1024px) 600px, 80vw" />
      </span>
      <span className="absolute inset-x-3 bottom-3 z-[2] flex items-center gap-3 rounded-[12px] border border-white/70 bg-white/92 px-4 py-3 shadow-[var(--sh-float)] backdrop-blur-md">
        <span className="min-w-0 flex-1">
          <span className="t-h4 block">{p.title}</span>
          <span className="mt-0.5 block truncate text-[0.8rem] text-ink-2">{p.categories.join(" · ")}</span>
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-ink transition-transform duration-300 group-hover:scale-110">
          <Icon name="arrow-up-right" size={15} />
        </span>
      </span>
    </a>
  );
}

function ServicesA({ data }: Props) {
  const { services } = data;
  return (
    <section id="services" className="sec sec-alt" aria-labelledby="services-title">
      <div className="shell">
        <SectionHead
          id="services-title"
          label={services.label}
          title={services.title}
          intro={services.intro}
          action={{ href: data.links.services, label: services.all }}
        />
      </div>
      <div className="shell mt-12 max-sm:px-0">
        <ul className="rail flex gap-4 overflow-x-auto px-[var(--gutter)] pb-4 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
          {services.items.map((s, i) => (
            <li key={s.slug} className="w-[82%] shrink-0 sm:w-auto" data-reveal style={delay((i % 3) * 70)}>
              <ServiceCardA service={s} open={services.open} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MachineryA({ data }: Props) {
  const { machinery } = data;
  const [featured, ...rest] = [
    machinery.items.find((m) => m.slug === "fiber-laser-combo-12kw")!,
    ...machinery.items.filter((m) => m.slug !== "fiber-laser-combo-12kw"),
  ];
  return (
    <section id="machinery" className="sec" aria-labelledby="machinery-title">
      <div className="shell">
        <SectionHead
          id="machinery-title"
          label={machinery.label}
          title={machinery.title}
          intro={machinery.intro}
          tone="steel"
          action={{ href: data.links.capabilities, label: machinery.all }}
        />
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7" data-reveal>
          <article className="card card-link flex h-full flex-col overflow-hidden" data-tone="steel">
            <div className="a-stage min-h-[15rem] border-b border-line-subtle px-6 pb-12 pt-10 sm:min-h-[19rem]">
              <Cutout image={featured.image} sizes="(min-width: 640px) 440px, 84vw" className="h-auto w-[88%]" />
              <span className="badge absolute start-4 top-4">
                <Icon name="machine" size={14} />
                {featured.category}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-7">
              <div>
                <h3 className="t-h3">
                  <a href={featured.href} className="stretch outline-none">
                    {featured.name}
                  </a>
                </h3>
                <p className="t-small mt-2 max-w-[34em]">{featured.capability}</p>
                <dl className="mt-5 grid max-w-md grid-cols-2 gap-3">
                  <div className="rounded-[12px] border border-line bg-surface-2 p-3.5">
                    <dt className="text-[0.78rem] font-medium text-ink-2">{machinery.power}</dt>
                    <dd className="t-stat mt-1 text-[1.4rem] leading-none">
                      {featured.power!.value}
                      <span className="ms-1 text-[0.9rem] font-bold text-ink-2">{featured.power!.unit}</span>
                    </dd>
                  </div>
                  <div className="rounded-[12px] border border-line bg-surface-2 p-3.5">
                    <dt className="text-[0.78rem] font-medium text-ink-2">{machinery.service}</dt>
                    <dd className="mt-1 font-semibold leading-snug">
                      <a href={featured.service.href} className="link-arrow relative z-[2]">
                        {featured.service.name}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
              <a href={data.links.quote} className="btn btn-steel relative z-[2]">
                {data.ui.requestQuote}
                <Icon name="arrow" size={17} />
              </a>
            </div>
          </article>
          </div>

          <ul className="grid grid-cols-1 gap-3 lg:col-span-5">
            {rest.map((m, i) => (
              <li key={m.slug} data-reveal style={delay(i * 60)}>
                <MachineRowA machine={m} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ProjectsA({ data }: Props) {
  const { projects } = data;
  const order = ["tulip-roundabout-sculpture", "clock-tower-landmark", "geometric-lanterns", "wave-form-sculpture", "suspended-lantern", "palm-leaf-shade-canopies"];
  const items = order.map((slug) => projects.items.find((p) => p.slug === slug)!).filter(Boolean);
  const layout = [
    "lg:col-span-2 lg:row-span-1",
    "lg:row-span-2",
    "",
    "",
    "",
    "",
  ];
  return (
    <section id="projects" className="sec sec-alt" aria-labelledby="projects-title">
      <div className="shell">
        <SectionHead
          id="projects-title"
          label={projects.label}
          title={projects.title}
          intro={projects.intro}
          tone="brass"
          action={{ href: data.links.projects, label: projects.all }}
        />
      </div>
      <div className="shell mt-12 max-lg:px-0">
        <ul className="rail flex gap-4 overflow-x-auto px-[var(--gutter)] pb-4 lg:grid lg:grid-cols-4 lg:grid-rows-[17rem_17rem] lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
          {items.map((p, i) => (
            <li key={p.slug} className={`w-[78%] shrink-0 sm:w-[44%] lg:w-auto ${layout[i]}`} data-reveal style={delay((i % 4) * 60)}>
              <ProjectCardA project={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ClientsA({ data }: Props) {
  const { clients } = data;
  return (
    <section id="clients" className="sec sec-white" aria-labelledby="clients-title">
      <div className="shell">
        <SectionHead id="clients-title" label={clients.label} title={clients.title} intro={clients.intro} tone="teal" center />
        <ul className="mt-12 grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5 lg:grid-cols-7">
          {clients.items.map((c, i) => (
            <li key={c.slug} data-reveal="fade" style={delay((i % 7) * 40)}>
              <div className="logo-tile">
                <Logo image={c.logo} />
              </div>
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

function ContactA({ data }: Props) {
  const { cta, contact, ui, compliance } = data;
  const rows = [
    { icon: "phone" as const, label: ui.call, value: contact.phones[0].display, href: contact.phones[0].href, ltr: true },
    { icon: "chat" as const, label: ui.whatsapp, value: contact.phones[0].display, href: contact.whatsappHref, ltr: true },
    { icon: "mail" as const, label: ui.email, value: contact.email, href: contact.emailHref, ltr: true },
    { icon: "pin" as const, label: ui.address, value: contact.address.full },
  ];
  return (
    <section id="contact" className="sec" aria-labelledby="contact-title">
      <div className="shell">
        <div className="a-cta grid grid-cols-1 lg:grid-cols-12" data-reveal>
          <div className="a-cta-dark p-7 sm:p-10 lg:col-span-7 lg:p-12">
            <Photo image={cta.image} alt="" sizes="(min-width: 1024px) 720px, 100vw" className="-z-[2] object-cover object-[50%_40%] opacity-60" />
            <p className="eyebrow border-white/20 bg-white/10 text-white shadow-none">{cta.label}</p>
            <h2 id="contact-title" className="t-h2 mt-5 max-w-[18em] text-white">
              {cta.title}
            </h2>
            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {cta.steps.map((step, i) => (
                <li key={step} className="rounded-[12px] border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm">
                  <span className="step-num">{i + 1}</span>
                  <p className="mt-3 text-[0.92rem] font-medium leading-snug text-white">{step}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={data.links.quote} className="btn btn-primary btn-lg">
                {cta.primary}
                <Icon name="arrow" size={18} />
              </a>
              <a href={contact.whatsappHref} className="btn btn-on-dark btn-lg">
                <Icon name="chat" size={19} />
                {cta.whatsapp}
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-3 bg-surface-2 p-5 sm:p-8 lg:col-span-5 lg:p-10">
            {rows.map((row) => {
              const inner = (
                <>
                  <span className="icon-chip shrink-0" data-tone={row.icon === "chat" ? "teal" : row.icon === "pin" ? "brass" : "steel"}>
                    <Icon name={row.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.78rem] font-medium text-ink-2">{row.label}</span>
                    <span className="block font-semibold break-words" dir={row.ltr ? "ltr" : undefined}>
                      {row.value}
                    </span>
                  </span>
                </>
              );
              return row.href ? (
                <a key={row.label} href={row.href} className="contact-row">
                  {inner}
                </a>
              ) : (
                <div key={row.label} className="contact-row">
                  {inner}
                </div>
              );
            })}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
              <span className="icon-chip size-8 rounded-lg" data-tone="brass">
                <Icon name="shield" size={16} />
              </span>
              <span className="text-[0.85rem] font-semibold">{compliance.title}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FooterA({ data }: Props) {
  const { footer, services, contact, ui } = data;
  return (
    <footer className="a-footer">
      <div className="shell grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:py-16">
        <div className="sm:col-span-2 lg:col-span-4">
          <Brand className="h-11 w-auto text-white" title="RAWASY" />
          <p className="mt-5 max-w-[26em] text-[0.95rem] leading-relaxed">{footer.companyStatement}</p>
          <a href={data.links.quote} className="btn btn-primary mt-6">
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
          <ul className="flex gap-5">
            {footer.legal.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
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
