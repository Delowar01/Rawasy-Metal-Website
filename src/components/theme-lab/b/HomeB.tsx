import type { CSSProperties, ReactNode } from "react";
import { Logo as Brand } from "@/components/brand/Logo";
import type { LabData } from "../data";
import { Icon } from "../Icon";
import { Cutout, LabBar, Logo, Photo, delay, metricIcon, serviceIcon, statementIcon } from "../ui";
import { bFontClasses } from "./fonts";
import "./b.css";

type Props = { data: LabData };
type ServiceItem = LabData["services"]["items"][number];
type MachineItem = LabData["machinery"]["items"][number];
type ProjectItem = LabData["projects"]["items"][number];

const ratio = (w: number, h: number) => ({ ["--ar" as string]: (w / h).toFixed(3) }) as CSSProperties;

/** Option B — Bold Industrial Commerce: homepage preview. */
export function HomeB({ data }: Props) {
  return (
    <>
      <a href="#main" className="skip-link">
        {data.ui.skip}
      </a>
      <LabBar data={data} view="home" />
      <div className={`lab-b ${bFontClasses}`}>
        <div id="top" />
        <HeaderB data={data} />
        <main id="main" tabIndex={-1} className="outline-none">
          <HeroB data={data} />
          <AboutB data={data} />
          <ServicesB data={data} />
          <MachineryB data={data} />
          <ProjectsB data={data} />
          <ClientsB data={data} />
          <ContactB data={data} />
        </main>
        <FooterB data={data} />
      </div>
    </>
  );
}

export function HeaderB({ data }: Props) {
  const { ui, nav, lab, contact, hero } = data;
  return (
    <>
        <aside className="b-util max-md:hidden" aria-label={data.footer.contactTitle}>
          <div className="shell flex h-9 items-center gap-6">
            <a href={contact.phones[0].href} className="flex items-center gap-2" dir="ltr">
              <Icon name="phone" size={14} />
              {contact.phones[0].display}
            </a>
            <a href={contact.emailHref} className="flex items-center gap-2">
              <Icon name="mail" size={14} />
              {contact.email}
            </a>
            <span className="flex items-center gap-2 max-lg:hidden">
              <Icon name="pin" size={14} />
              {hero.location}
            </span>
            <a href={contact.whatsappHref} className="ms-auto flex items-center gap-2 font-semibold text-white">
              <Icon name="chat" size={14} />
              {ui.whatsapp}
            </a>
          </div>
        </aside>
        <header className="b-header">
          <div className="shell relative flex h-[4.75rem] items-center gap-2 sm:gap-4">
            <a href="#top" aria-label={ui.homeLink} className="shrink-0">
              <Brand className="h-8 w-auto text-white min-[400px]:h-9 sm:h-10" title="RAWASY" />
            </a>
            <nav aria-label={ui.mainNav} className="ms-6 hidden xl:block">
              <ul className="flex items-center">
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
              <a href={lab.switchHref(lab.homeHref)} lang={lab.otherLocale} hrefLang={lab.otherLocale} className="ctl max-sm:px-2.5" aria-label={ui.languageSwitch}>
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
              <a href={data.links.quote} className="btn btn-primary max-sm:min-h-[2.75rem] max-sm:px-3 max-sm:text-[0.84rem]">
                {ui.getQuote}
                <Icon name="arrow" size={17} className="max-sm:hidden" />
              </a>
              <details data-menu className="xl:hidden">
                <summary className="ctl max-sm:px-2.5" aria-label={ui.openMenu}>
                  <Icon name="menu" size={20} />
                </summary>
                <div className="b-menu-panel">
                  <nav aria-label={ui.mobileNav} className="shell py-3">
                    <ul className="grid gap-0.5 sm:grid-cols-2">
                      {nav.map((item) => (
                        <li key={item.id}>
                          <a href={`#${item.id}`} className="nav-link" data-spy-link={item.id}>
                            {item.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 grid gap-2 border-t border-[var(--dark-line)] pt-4 text-[0.9rem] text-on-dark-2">
                      <a href={contact.phones[0].href} className="flex items-center gap-2" dir="ltr">
                        <Icon name="phone" size={16} />
                        {contact.phones[0].display}
                      </a>
                      <a href={contact.whatsappHref} className="flex items-center gap-2">
                        <Icon name="chat" size={16} />
                        {ui.whatsapp}
                      </a>
                    </div>
                  </nav>
                </div>
              </details>
            </div>
          </div>
        </header>
    </>
  );
}

function HeroB({ data }: Props) {
  const { hero, metrics, services } = data;
  const photo = services.items.find((s) => s.slug === "steel-structures")!.image!;
  return (
    <>
        <section className="b-hero on-dark" aria-labelledby="hero-title">
          <div className="b-hero-photo max-lg:hidden">
            <Photo image={photo} priority sizes="56vw" />
          </div>
          <div className="shell relative pb-32 pt-14 sm:pt-20 lg:pb-40 lg:pt-24">
            <div className="max-w-[40rem] lg:max-w-[35rem] xl:max-w-[40rem]">
              <p className="eyebrow">{hero.eyebrow}</p>
              <h1 id="hero-title" className="t-display mt-6 text-white">
                {hero.headline.join(" ")}
              </h1>
              <p className="t-lead mt-6 max-w-[33em] !text-on-dark-2">{hero.sub}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#contact" className="btn btn-primary btn-lg">
                  {hero.primary}
                  <Icon name="arrow" size={19} />
                </a>
                <a href="#services" className="btn btn-on-dark btn-lg">
                  {hero.secondary}
                </a>
              </div>
            </div>
            <ul className="b-spec mt-12 grid max-w-[46rem] grid-cols-2 sm:grid-cols-4 lg:mt-16">
              {metrics.map((m) => (
                <li key={m.slug} className="px-4 py-4 first:ps-0 max-sm:[&:nth-child(3)]:border-s-0 max-sm:[&:nth-child(3)]:ps-0 max-sm:[&:nth-child(-n+2)]:border-b max-sm:border-[var(--dark-line)]">
                  <p className="t-stat text-[1.75rem] leading-none text-white" dir="ltr">
                    {m.value}
                    {m.unit && <span className="text-brand">{m.unit === "°" ? "" : " "}{m.unit}</span>}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-[0.82rem] leading-snug text-on-dark-2">
                    <Icon name={metricIcon[m.slug]} size={14} className="shrink-0 text-brand" />
                    {m.label}
                  </p>
                </li>
              ))}
            </ul>
            <div className="relative mt-10 aspect-[16/10] overflow-hidden rounded-[var(--r-panel)] shadow-[var(--sh-dark)] lg:hidden">
              <Photo image={photo} sizes="92vw" />
            </div>
          </div>
        </section>
        <div className="shell relative z-10 -mt-20 lg:-mt-24">
          <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
            {services.items.map((s, i) => (
              <li key={s.slug} data-reveal style={delay(i * 50)}>
                <a href={s.href} className="b-tile max-sm:gap-2.5 max-sm:p-3 max-sm:text-[0.9rem]">
                  <span className="icon-chip shrink-0 max-sm:size-9">
                    <Icon name={serviceIcon[s.slug]} size={21} />
                  </span>
                  {s.name}
                  <Icon name="arrow" size={17} className="go max-sm:hidden" />
                </a>
              </li>
            ))}
          </ul>
        </div>
    </>
  );
}

function SectionHeadB({
  id,
  label,
  title,
  intro,
  action,
  tone = "brand",
  dark,
}: {
  id: string;
  label: string;
  title: string;
  intro?: string;
  action?: { href: string; label: string };
  tone?: string;
  dark?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
      <div className="lg:col-span-7" data-reveal>
        <p className="eyebrow" data-tone={tone}>
          {label}
        </p>
        <h2 id={id} className={`t-h2 mt-4 ${dark ? "text-white" : ""}`}>
          {title}
        </h2>
      </div>
      <div className="lg:col-span-5" data-reveal="fade">
        {intro && <p className="t-lead">{intro}</p>}
        {action && (
          <a href={action.href} className={`btn ${dark ? "btn-on-dark" : "btn-outline"} mt-5`}>
            {action.label}
            <Icon name="arrow" size={18} />
          </a>
        )}
      </div>
    </div>
  );
}

function AboutB({ data }: Props) {
  const { about, statements, compliance } = data;
  const strip = [about.workshop, about.detail, about.beams];
  return (
    <section id="about" className="sec sec-white pt-[calc(var(--sec-y)+1rem)]" aria-labelledby="about-title">
      <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <div data-reveal>
            <p className="eyebrow" data-tone="steel">
              {about.label}
            </p>
            <h2 id="about-title" className="t-h2 mt-5">
              {about.statement}
            </h2>
            <div className="t-body mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {about.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="mt-7">
              <p className="eyebrow" data-tone="teal">
                {data.industries.label}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {data.industries.items.map((ind) => (
                  <li key={ind.slug} className="tag">
                    {ind.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a href={data.links.about} className="btn btn-secondary">
                {about.link}
                <Icon name="arrow" size={18} />
              </a>
              <a href={data.links.industries} className="link-arrow">
                {data.industries.all}
                <Icon name="arrow" size={16} />
              </a>
            </div>
          </div>
          <ul className="b-justify mt-10 [--row-h:9rem] sm:[--row-h:11.5rem]">
            {strip.map((img, i) => (
              <li key={img.src} style={{ ...ratio(img.width, img.height), ...delay(i * 80) }} data-reveal>
                <figure className="card-media relative overflow-hidden rounded-[var(--r-card)] shadow-[var(--sh-card)]" style={{ aspectRatio: `${img.width} / ${img.height}` }}>
                  <Photo image={img} sizes="(min-width: 1024px) 360px, 45vw" />
                </figure>
              </li>
            ))}
          </ul>
        </div>

        <aside className="lg:col-span-5" aria-labelledby="about-capabilities" data-reveal>
          <div className="relative overflow-hidden rounded-[var(--r-panel)] bg-dark p-7 text-on-dark shadow-[var(--sh-raised)] sm:p-8">
            <div aria-hidden className="absolute -end-16 -top-16 size-56 rounded-full bg-[radial-gradient(closest-side,rgb(241_95_34/0.35),transparent)]" />
            <p id="about-capabilities" className="eyebrow relative !text-on-dark">
              {about.capabilitiesLabel}
            </p>
            <ul className="relative mt-6 grid gap-5">
              {statements.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[var(--r-sm)] bg-dark-3 text-white">
                    <Icon name={statementIcon[i]} size={21} />
                  </span>
                  <span>
                    <span className="t-h4 block text-white">{s.title}</span>
                    <span className="mt-0.5 block text-[0.9rem] leading-snug text-on-dark-2">{s.body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="relative mt-7 border-t border-[var(--dark-line)] pt-6">
              <p className="flex items-center gap-2 font-semibold text-white">
                <Icon name="shield" size={18} className="text-brand" />
                {compliance.title}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {compliance.items.map((c) => (
                  <li key={c.slug} className="rounded-[var(--r-xs)] border border-[var(--dark-line)] px-2.5 py-1 text-[0.8rem] text-on-dark-2">
                    {c.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Horizontal feature panel: photo half, content half. */
export function FeatureServiceB({ service: s, open, image }: { service: ServiceItem; open: string; image?: ServiceItem["image"] }) {
  const photo = image ?? s.image;
  return (
    <article className="b-feature card-link h-full grid-cols-1 sm:grid-cols-2">
      <div className="card-media relative min-h-[15rem]">{photo && <Photo image={photo} sizes="(min-width: 1024px) 320px, (min-width: 640px) 46vw, 92vw" />}</div>
      <div className="flex flex-col p-6 sm:p-7">
        <span className="icon-chip icon-chip-lg">
          <Icon name={serviceIcon[s.slug]} size={26} />
        </span>
        <h3 className="t-h3 mt-5">
          <a href={s.href} className="stretch outline-none">
            {s.name}
          </a>
        </h3>
        <p className="t-small mt-2">{s.summary}</p>
        <ul className="mt-4 grid gap-1.5">
          {s.highlights.slice(0, 4).map((h) => (
            <li key={h} className="flex items-center gap-2 text-[0.88rem] font-semibold">
              <Icon name="check" size={16} className="shrink-0 text-brand-ink" />
              {h}
            </li>
          ))}
        </ul>
        <span className="mt-auto flex items-center justify-between gap-3 pt-6 font-bold">
          {open}
          <span className="b-go">
            <Icon name="arrow" size={18} />
          </span>
        </span>
      </div>
    </article>
  );
}

/** Image-overlay service card. */
export function OverlayServiceB({ service: s, image }: { service: ServiceItem; image?: ServiceItem["image"] }) {
  const photo = image ?? s.image;
  return (
    <a href={s.href} className="b-overlay card-link block aspect-[4/5] sm:aspect-[4/3]">
      {photo ? (
        <span className="card-media absolute inset-0">
          <Photo image={photo} sizes="(min-width: 1024px) 310px, (min-width: 640px) 46vw, 92vw" />
        </span>
      ) : (
        <span aria-hidden className="absolute inset-0 grid place-items-center bg-[radial-gradient(80%_80%_at_70%_20%,#3a3f47,var(--dark))] pb-16 text-[#d7c190]">
          <Icon name="laser-engraving" size={84} className="[--icon-stroke:1.25] [--duo-color:#d7c190] [--duo-opacity:0.2]" />
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 z-[2] flex items-end gap-3 p-3.5 sm:p-5">
        <span className="min-w-0 flex-1">
          <span className="t-h4 block text-white">{s.name}</span>
          <span className="mt-1 block text-[0.84rem] leading-snug text-white/80 max-sm:hidden">{s.tagline}</span>
        </span>
        <span className="b-go shrink-0 max-sm:hidden">
          <Icon name="arrow" size={18} />
        </span>
      </span>
    </a>
  );
}

function ServicesB({ data }: Props) {
  const { services } = data;
  const bySlug = (slug: string) => services.items.find((s) => s.slug === slug)!;
  const features = [bySlug("laser-cutting"), bySlug("steel-structures")];
  const others = ["cnc-bending", "fabrication", "laser-engraving", "scaffolding"].map(bySlug);
  return (
    <section id="services" className="sec sec-alt" aria-labelledby="services-title">
      <div className="shell">
        <SectionHeadB
          id="services-title"
          label={services.label}
          title={services.title}
          intro={services.intro}
          action={{ href: data.links.services, label: services.all }}
        />
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {features.map((s, i) => (
            <div key={s.slug} className="h-full" data-reveal style={delay(i * 80)}>
              <FeatureServiceB service={s} open={services.open} image={s.slug === "steel-structures" ? s.support : s.image} />
            </div>
          ))}
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {others.map((s, i) => (
            <li key={s.slug} data-reveal style={delay(i * 70)}>
              <OverlayServiceB service={s} image={s.slug === "fabrication" ? s.support : s.image} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Product card for a machine: cut-out on a lit stage, key figures underneath. */
export function MachineCardB({ machine: m, labels }: { machine: MachineItem; labels: LabData["machinery"] }) {
  return (
    <article className="card card-link flex h-full flex-col overflow-hidden">
      <div className="b-stage aspect-[16/9] px-6 pb-8 pt-6">
        <Cutout image={m.image} sizes="(min-width: 1024px) 360px, 80vw" className="h-auto max-h-[9.5rem] w-auto max-w-[86%]" />
        {m.power && (
          <span className="badge absolute start-3 top-3 font-mono normal-case tracking-normal" dir="ltr">
            <Icon name="power" size={13} />
            {m.power.value} {m.power.unit}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6 pb-5">
        <p className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-steel">{m.category}</p>
        <h3 className="t-h4 mt-1.5">
          <a href={m.href} className="stretch outline-none">
            {m.name}
          </a>
        </h3>
        <p className="t-small mt-2">{m.capability}</p>
      </div>
      <dl className="b-specrow grid grid-cols-2">
        <div className="p-4 ps-6">
          <dt className="text-[0.74rem] font-semibold uppercase tracking-[0.06em] text-ink-2">{labels.power}</dt>
          <dd className="t-stat mt-1 text-[1.05rem]" dir="ltr">
            {m.power ? `${m.power.value} ${m.power.unit}` : labels.notStated}
          </dd>
        </div>
        <div className="border-s border-line-subtle p-4">
          <dt className="text-[0.74rem] font-semibold uppercase tracking-[0.06em] text-ink-2">{labels.service}</dt>
          <dd className="mt-1 font-bold">
            <a href={m.service.href} className="relative z-[2] hover:text-brand-ink">
              {m.service.name}
            </a>
          </dd>
        </div>
      </dl>
    </article>
  );
}

function MachineryB({ data }: Props) {
  const { machinery } = data;
  return (
    <section id="machinery" className="sec sec-dark on-dark overflow-hidden" aria-labelledby="machinery-title">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_85%_0%,rgb(44_101_144/0.35),transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgb(241_95_34/0.12),transparent_70%)]" />
      <div className="shell">
        <SectionHeadB
          id="machinery-title"
          label={machinery.label}
          title={machinery.title}
          intro={machinery.intro}
          tone="steel"
          dark
          action={{ href: data.links.capabilities, label: machinery.all }}
        />
      </div>
      <div className="shell mt-12 max-sm:px-0">
        <ul className="rail flex gap-4 overflow-x-auto px-[var(--gutter)] pb-4 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
          {machinery.items.map((m, i) => (
            <li key={m.slug} className="w-[82%] shrink-0 sm:w-auto" data-reveal style={delay((i % 3) * 70)}>
              <MachineCardB machine={m} labels={machinery} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProjectTileB({ project: p }: { project: ProjectItem }) {
  return (
    <a href={p.href} className="b-overlay card-link block w-full" style={{ aspectRatio: `${p.image.width} / ${p.image.height}` }}>
      <span className="card-media absolute inset-0">
        <Photo image={p.image} alt="" sizes="(min-width: 1024px) 420px, 50vw" />
      </span>
      <span className="absolute inset-x-0 bottom-0 z-[2] flex items-end gap-3 p-3 sm:p-4">
        <span className="min-w-0 flex-1">
          <span className="tag tag-dark text-[0.72rem] max-sm:hidden">{p.categories[0]}</span>
          <span className="t-h4 block text-white max-sm:text-[0.9rem] sm:mt-2">{p.title}</span>
        </span>
        <span className="b-go size-9 shrink-0 max-sm:hidden">
          <Icon name="arrow-up-right" size={16} />
        </span>
      </span>
    </a>
  );
}

function ProjectsB({ data }: Props) {
  const { projects } = data;
  const order = ["tulip-roundabout-sculpture", "clock-tower-landmark", "suspended-lantern", "palm-leaf-shade-canopies", "geometric-lanterns", "wave-form-sculpture"];
  const items = order.map((slug) => projects.items.find((p) => p.slug === slug)!);
  return (
    <section id="projects" className="sec" aria-labelledby="projects-title">
      <div className="shell">
        <SectionHeadB id="projects-title" label={projects.label} title={projects.title} intro={projects.intro} tone="brass" />
        <ul className="b-justify mt-12 [--row-h:10.5rem] sm:[--row-h:13rem] lg:[--row-h:17rem]">
          {items.map((p, i) => (
            <li key={p.slug} style={{ ...ratio(p.image.width, p.image.height), ...delay((i % 4) * 60) }} data-reveal>
              <ProjectTileB project={p} />
            </li>
          ))}
          <li style={{ ...ratio(1, 1), flexGrow: 999 }} data-reveal>
            <a href={data.links.projects} className="card-link group flex h-full min-h-[9.5rem] flex-col justify-between rounded-[var(--r-card)] bg-brand p-5 text-ink shadow-[var(--sh-card)]">
              <Icon name="grid" size={28} className="[--duo-color:var(--ink)] [--duo-opacity:0.15]" />
              <span className="flex items-end justify-between gap-3">
                <span className="t-h3">{projects.all}</span>
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--r-sm)] bg-ink text-white transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
                  <Icon name="arrow" size={18} />
                </span>
              </span>
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}

function ClientsB({ data }: Props) {
  const { clients } = data;
  return (
    <section id="clients" className="sec sec-white" aria-labelledby="clients-title">
      <div className="shell">
        <SectionHeadB id="clients-title" label={clients.label} title={clients.title} intro={clients.intro} tone="teal" action={{ href: data.links.clients, label: clients.all }} />
        <ul className="mt-12 grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5 lg:grid-cols-7">
          {clients.items.map((c, i) => (
            <li key={c.slug} data-reveal="fade" style={delay((i % 7) * 40)}>
              <div className="logo-tile">
                <Logo image={c.logo} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ContactB({ data }: Props) {
  const { cta, contact, ui } = data;
  const rows = [
    { icon: "phone" as const, label: ui.call, value: contact.phones[0].display, href: contact.phones[0].href, ltr: true },
    { icon: "chat" as const, label: ui.whatsapp, value: contact.phones[0].display, href: contact.whatsappHref, ltr: true },
    { icon: "mail" as const, label: ui.email, value: contact.email, href: contact.emailHref, ltr: true },
    { icon: "pin" as const, label: ui.address, value: contact.address.full },
  ];
  return (
    <section id="contact" className="relative isolate overflow-hidden bg-brand py-[var(--sec-y)] text-ink" aria-labelledby="contact-title">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_55%,rgb(0_0_0/0.08)_55%)]" />
      <div className="shell grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6" data-reveal>
          <p className="eyebrow [--tone:var(--ink)]">{cta.label}</p>
          <h2 id="contact-title" className="t-h2 mt-5">
            {cta.title}
          </h2>
          <ol className="mt-8 grid gap-3">
            {cta.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-4 font-bold">
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--r-sm)] bg-ink font-mono text-[0.95rem] text-white" dir="ltr">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href={data.links.quote} className="btn btn-secondary btn-lg">
              {cta.primary}
              <Icon name="arrow" size={19} />
            </a>
            <a href={contact.whatsappHref} className="btn btn-lg border-ink text-ink hover:bg-ink hover:text-white">
              <Icon name="chat" size={19} />
              {cta.whatsapp}
            </a>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-6" data-reveal>
          {rows.map((row, i) => {
            const inner = (
              <>
                <span className="grid size-11 shrink-0 place-items-center rounded-[var(--r-sm)] bg-brand text-ink">
                  <Icon name={row.icon} size={21} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-on-dark-2">{row.label}</span>
                  <span className="mt-0.5 block font-bold break-words text-white" dir={row.ltr ? "ltr" : undefined}>
                    {row.value}
                  </span>
                </span>
              </>
            );
            return (
              <li key={row.label} className={i > 1 ? "sm:col-span-2" : undefined}>
                {row.href ? (
                  <a href={row.href} className="b-contact h-full">
                    {inner}
                  </a>
                ) : (
                  <div className="b-contact h-full">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function FooterB({ data }: Props) {
  const { footer, services, contact, ui } = data;
  return (
    <footer className="b-footer">
      <div className="shell grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:py-16">
        <div className="sm:col-span-2 lg:col-span-4">
          <Brand className="h-12 w-auto text-white" title="RAWASY" />
          <p className="mt-5 max-w-[24em] font-[family-name:var(--ff-display)] text-[1.35rem] font-bold leading-tight text-white">{footer.statement}</p>
          <a href={data.links.quote} className="btn btn-primary mt-6">
            {ui.getQuote}
            <Icon name="arrow" size={18} />
          </a>
        </div>
        <FooterColB title={footer.servicesTitle} className="lg:col-span-3">
          {services.items.map((s) => (
            <li key={s.slug}>
              <a href={s.href}>{s.name}</a>
            </li>
          ))}
        </FooterColB>
        <FooterColB title={footer.company.title} className="lg:col-span-2">
          {footer.company.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </FooterColB>
        <FooterColB title={footer.contactTitle} className="lg:col-span-3">
          {contact.phones.map((p) => (
            <li key={p.href}>
              <a href={p.href} dir="ltr" className="font-mono">
                {p.display}
              </a>
            </li>
          ))}
          <li>
            <a href={contact.emailHref}>{contact.email}</a>
          </li>
          <li className="leading-relaxed">{contact.address.full}</li>
        </FooterColB>
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

function FooterColB({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <h2 className="flex items-center gap-2 text-[0.8rem] font-bold tracking-[0.1em] text-white uppercase">
        <span aria-hidden className="size-2 rounded-[2px] bg-brand" />
        {title}
      </h2>
      <ul className="mt-4 grid gap-2.5 text-[0.95rem]">{children}</ul>
    </div>
  );
}
