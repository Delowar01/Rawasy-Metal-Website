import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, path } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd, localizedUrl } from "@/lib/seo";
import { seo } from "@/content/seo";
import { Icon } from "../Icon";
import { ClosingCta } from "../inner/ClosingCta";
import { PageHero, type PageFact } from "../inner/PageHero";
import { serviceTone } from "../tones";
import { delay, serviceIcon } from "../ui";
import { getCapabilitiesView, type CapabilitiesView, type CapabilityMachine } from "./data";
import { FleetPlate } from "./FleetPlate";
import { MachineConsole, type ConsoleLabels } from "./MachineConsole";
import { PowerChart } from "./PowerChart";
import { Register, type RegisterLabels } from "./Register";
import "./capabilities.css";

/** A section's label, title and lead, on a reading zone. */
function Head({ id, label, title, intro, tone = "steel" }: { id: string; label: string; title: string; intro: string; tone?: "steel" | "brand" | "teal" | "brass" }) {
  return (
    <div className="a2-read max-w-[46rem]" data-reveal>
      <p className="eyebrow" data-tone={tone}>
        {label}
      </p>
      <h2 id={id} className="t-h2 mt-4">
        {title}
      </h2>
      <p className="t-lead mt-4">{intro}</p>
    </div>
  );
}

type SectionHead = { label: string; title: string; intro: string };

/** The hero's facts: the machines, the laser cutting systems and the peak rated power (where one is stated). */
export function capabilityFacts(facts: CapabilitiesView["facts"], labels: { machines: string; laser: string; peak: string }): PageFact[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    { label: labels.machines, value: <span dir="ltr">{pad(facts.machines)}</span> },
    { label: labels.laser, value: <span dir="ltr">{pad(facts.laser)}</span> },
    ...(facts.peak
      ? [
          {
            label: labels.peak,
            value: (
              <>
                <span dir="ltr">{facts.peak.value}</span> {facts.peak.unit}
              </>
            ),
          },
        ]
      : []),
  ];
}

/** The hero's actions: down to the console, and the quotation form. */
export function CapabilitiesActions({ explore, quote, quoteLabel }: { explore: string; quote: string; quoteLabel: string }) {
  return (
    <>
      <a href="#console" className="btn btn-steel">
        {explore}
        <span className="cp-down">
          <Icon name="arrow" size={17} />
        </span>
      </a>
      <a href={quote} className="btn btn-primary">
        {quoteLabel}
        <Icon name="arrow" size={17} />
      </a>
    </>
  );
}

/** The rated power of the machines whose power is stated (`#power`). */
export function PowerSection({ head, machines, caption, notStated }: { head: SectionHead; machines: CapabilityMachine[]; caption: string; notStated: string }) {
  return (
    <section id="power" aria-labelledby="power-title" className="sec sec-sheet sec-muted">
      <div className="shell grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="lg:col-span-5">
          <Head id="power-title" label={head.label} title={head.title} intro={head.intro} tone="brand" />
        </div>
        <div className="lg:col-span-7" data-reveal style={delay(100)}>
          <PowerChart machines={machines} caption={caption} notStated={notStated} />
        </div>
      </div>
    </section>
  );
}

/** The machinery console (`#console`): the selector and the stage; each machine's panel is the target of `#<slug>`. */
export function ConsoleSection({ head, machines, quote, labels }: { head: SectionHead; machines: CapabilityMachine[]; quote: string; labels: ConsoleLabels }) {
  return (
    <section id="console" aria-labelledby="console-title" className="sec cm-console-sec">
      <div className="shell">
        <Head id="console-title" label={head.label} title={head.title} intro={head.intro} />
        <div className="mt-10 lg:mt-12">
          <MachineConsole machines={machines} quote={quote} labels={labels} />
        </div>
      </div>
    </section>
  );
}

/** The technical register (`#register`): every machine's facts as rows and columns (cards on phones). */
export function RegisterSection({ head, machines, labels }: { head: SectionHead; machines: CapabilityMachine[]; labels: RegisterLabels }) {
  return (
    <section id="register" aria-labelledby="register-title" className="sec sec-sheet sec-raised">
      <div className="shell">
        <Head id="register-title" label={head.label} title={head.title} intro={head.intro} />
        <div className="mt-10 lg:mt-12" data-reveal>
          <Register machines={machines} labels={labels} />
        </div>
      </div>
    </section>
  );
}

/** The services the machines support, each with its machines (`#service-lines`). */
export function ServiceLinesSection({ head, machinesLabel, open, services }: { head: SectionHead; machinesLabel: string; open: string; services: CapabilitiesView["services"] }) {
  return (
    <section id="service-lines" aria-labelledby="service-lines-title" className="sec">
      <div className="shell">
        <Head id="service-lines-title" label={head.label} title={head.title} intro={head.intro} tone="teal" />
        <ul className="cm-lines mt-10 lg:mt-12">
          {services.map((s, i) => (
            <li key={s.slug} data-reveal style={delay(i * 80)}>
              <article className="card cm-line" data-tone={serviceTone[s.slug]} aria-labelledby={`line-${s.slug}`}>
                <span className="icon-chip">
                  <Icon name={serviceIcon[s.slug]} size={22} />
                </span>
                <h3 id={`line-${s.slug}`} className="t-h4 mt-4">
                  {s.name}
                </h3>
                <p className="t-small mt-1.5">{s.tagline}</p>
                <p className="cm-line-label">{machinesLabel}</p>
                <ul className="cm-line-machines">
                  {s.machines.map((m) => (
                    <li key={m.slug}>
                      <a href={`#${m.slug}`}>
                        <span className="cm-line-n" aria-hidden dir="ltr">
                          {m.index}
                        </span>
                        <span className="min-w-0 flex-1">{m.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
                <a href={s.href} className="link-arrow cm-line-open">
                  {open}
                  <span className="sr-only">: {s.name}</span>
                  <Icon name="arrow" size={16} />
                </a>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Where the machine facts come from (`#source`). */
export function SourceSection({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <section id="source" aria-labelledby="source-title" className="sec pt-0">
      <div className="shell">
        <div className="card cm-source" data-tone="steel" data-reveal>
          <span className="icon-chip">
            <Icon name="doc" size={22} />
          </span>
          <div className="min-w-0">
            <p className="cm-source-label">{label}</p>
            <h2 id="source-title" className="t-h3 mt-1">
              {title}
            </h2>
            <p className="cm-source-body">{body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Capabilities & Machinery (Stage 1E), in the Modern Commerce design: the six machines of the company profile (p.7), with
 * their records' fields only and no specification beyond the rated power the profile gives the four lasers. In order: the hero (its facts and the equipment stage), the rated power of the four
 * lasers, the machinery console (selector and stage; each machine's panel is the target of /capabilities#<slug>), the
 * technical register, the services the machines support, the source note and the closing invitation. Machine facts come
 * from machines.ts through the content repository; the page's own words from capabilities.ts.
 */
export async function CapabilitiesPage({ locale }: { locale: Locale }) {
  const view = await getCapabilitiesView(locale);
  const { page, machines, services, facts } = view;
  const dict = getDictionary(locale);
  const t = <T,>(value: Record<Locale, T>) => value[locale];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t(page.register.caption),
    numberOfItems: machines.length,
    itemListElement: machines.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.name,
      url: `${localizedUrl(locale, path("capabilities"))}#${m.slug}`,
    })),
  };

  return (
    <>
      {[...innerPageJsonLd("capabilities", locale, "CollectionPage"), itemList].map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <PageHero
        layout="split"
        tone="steel"
        breadcrumb={breadcrumbTrail("capabilities", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={t(page.hero.eyebrow)}
        title={t(seo.capabilities.title)}
        intro={t(seo.capabilities.description)}
        facts={capabilityFacts(facts, { machines: t(page.hero.facts.machines), laser: t(page.hero.facts.laser), peak: t(page.hero.facts.peak) })}
        actions={<CapabilitiesActions explore={t(page.hero.explore)} quote={view.quote} quoteLabel={t(page.quote)} />}
        aside={<FleetPlate machines={machines} label={t(page.hero.fleet)} />}
      />

      <PowerSection head={{ label: t(page.power.label), title: t(page.power.title), intro: t(page.power.intro) }} machines={machines} caption={t(page.power.chart)} notStated={t(page.fields.notStated)} />

      <ConsoleSection
        head={{ label: t(page.console.label), title: t(page.console.title), intro: t(page.console.intro) }}
        machines={machines}
        quote={view.quote}
        labels={{
          list: t(page.console.list),
          showing: t(page.console.showing),
          schematic: t(page.console.schematic),
          power: t(page.fields.power),
          service: t(page.fields.service),
          source: t(page.fields.source),
          notStated: t(page.fields.notStated),
          quote: t(page.quote),
          serviceLink: t(page.serviceLink),
        }}
      />

      <RegisterSection
        head={{ label: t(page.register.label), title: t(page.register.title), intro: t(page.register.intro) }}
        machines={machines}
        labels={{
          caption: t(page.register.caption),
          number: t(page.register.number),
          machine: t(page.register.machine),
          type: t(page.register.type),
          power: t(page.fields.power),
          service: t(page.fields.service),
          source: t(page.fields.source),
          notStated: t(page.fields.notStated),
        }}
      />

      <ServiceLinesSection head={{ label: t(page.services.label), title: t(page.services.title), intro: t(page.services.intro) }} machinesLabel={t(page.services.machines)} open={t(page.services.open)} services={services} />

      <SourceSection label={t(page.source.label)} title={t(page.source.title)} body={t(page.source.body)} />

      <ClosingCta
        label={t(page.cta.label)}
        title={t(page.cta.title)}
        body={page.cta.body && t(page.cta.body)}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route, { hash: link.hash }), label: t(link.label) }))}
      />
    </>
  );
}
