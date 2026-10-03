import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href, path } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd, localizedUrl } from "@/lib/seo";
import { seo } from "@/content/seo";
import { Icon } from "../Icon";
import { ClosingCta } from "../inner/ClosingCta";
import { PageHero } from "../inner/PageHero";
import { serviceTone } from "../tones";
import { delay, serviceIcon } from "../ui";
import { getCapabilitiesView } from "./data";
import { FleetPlate } from "./FleetPlate";
import { MachineConsole } from "./MachineConsole";
import { PowerChart } from "./PowerChart";
import { Register } from "./Register";
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
  const pad = (n: number) => String(n).padStart(2, "0");

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
        facts={[
          { label: t(page.hero.facts.machines), value: <span dir="ltr">{pad(facts.machines)}</span> },
          { label: t(page.hero.facts.laser), value: <span dir="ltr">{pad(facts.laser)}</span> },
          ...(facts.peak
            ? [
                {
                  label: t(page.hero.facts.peak),
                  value: (
                    <>
                      <span dir="ltr">{facts.peak.value}</span> {facts.peak.unit}
                    </>
                  ),
                },
              ]
            : []),
        ]}
        actions={
          <>
            <a href="#console" className="btn btn-steel">
              {t(page.hero.explore)}
              <span className="cp-down">
                <Icon name="arrow" size={17} />
              </span>
            </a>
            <a href={view.quote} className="btn btn-primary">
              {t(page.quote)}
              <Icon name="arrow" size={17} />
            </a>
          </>
        }
        aside={<FleetPlate machines={machines} label={t(page.hero.fleet)} />}
      />

      <section id="power" aria-labelledby="power-title" className="sec sec-sheet sec-muted">
        <div className="shell grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="lg:col-span-5">
            <Head id="power-title" label={t(page.power.label)} title={t(page.power.title)} intro={t(page.power.intro)} tone="brand" />
          </div>
          <div className="lg:col-span-7" data-reveal style={delay(100)}>
            <PowerChart machines={machines} caption={t(page.power.chart)} notStated={t(page.fields.notStated)} />
          </div>
        </div>
      </section>

      <section id="console" aria-labelledby="console-title" className="sec cm-console-sec">
        <div className="shell">
          <Head id="console-title" label={t(page.console.label)} title={t(page.console.title)} intro={t(page.console.intro)} />
          <div className="mt-10 lg:mt-12">
            <MachineConsole
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
          </div>
        </div>
      </section>

      <section id="register" aria-labelledby="register-title" className="sec sec-sheet sec-raised">
        <div className="shell">
          <Head id="register-title" label={t(page.register.label)} title={t(page.register.title)} intro={t(page.register.intro)} />
          <div className="mt-10 lg:mt-12" data-reveal>
            <Register
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
          </div>
        </div>
      </section>

      <section id="service-lines" aria-labelledby="service-lines-title" className="sec">
        <div className="shell">
          <Head id="service-lines-title" label={t(page.services.label)} title={t(page.services.title)} intro={t(page.services.intro)} tone="teal" />
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
                  <p className="cm-line-label">{t(page.services.machines)}</p>
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
                    {t(page.services.open)}
                    <span className="sr-only">: {s.name}</span>
                    <Icon name="arrow" size={16} />
                  </a>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="source" aria-labelledby="source-title" className="sec pt-0">
        <div className="shell">
          <div className="card cm-source" data-tone="steel" data-reveal>
            <span className="icon-chip">
              <Icon name="doc" size={22} />
            </span>
            <div className="min-w-0">
              <p className="cm-source-label">{t(page.source.label)}</p>
              <h2 id="source-title" className="t-h3 mt-1">
                {t(page.source.title)}
              </h2>
              <p className="cm-source-body">{t(page.source.body)}</p>
            </div>
          </div>
        </div>
      </section>

      <ClosingCta
        label={t(page.cta.label)}
        title={t(page.cta.title)}
        body={page.cta.body && t(page.cta.body)}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route, { hash: link.hash }), label: t(link.label) }))}
      />
    </>
  );
}
