import Image from "next/image";
import { getMedia } from "@/content/media";
import type { MediaId } from "@/content/media.generated";
import { projectCategories, projectImages } from "@/content/projects";
import {
  getAboutContent,
  getCertificates,
  getClients,
  getCompany,
  getHomeContent,
  getMachines,
  getMetrics,
  getPillars,
  getProjectsPageContent,
  getServices,
  getShowcasedProjects,
} from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { JsonLd, organizationJsonLd } from "@/lib/seo";
import { formatPower } from "@/lib/utils";
import { Icon, type IconName } from "../Icon";
import { ClosingCta } from "../inner/ClosingCta";
import { Figure } from "../inner/Figure";
import { PageHero } from "../inner/PageHero";
import { pillarIcon, serviceTone, supportIcon } from "../tones";
import type { CommerceImage, Tone } from "../types";
import { Logo, delay, serviceIcon, statementIcon } from "../ui";

const pad = (n: number) => String(n).padStart(2, "0");

/** The process steps' icons (the content keeps its own slugs). */
const STEP_ICONS: Record<string, IconName> = {
  understand: "doc",
  engineer: "precision",
  fabricate: "fabrication",
  inspect: "check",
  deliver: "truck",
  install: "installation",
};

/** The homepage's compliance icons, in the same order. */
const DOC_ICONS: IconName[] = ["doc", "shield", "doc"];

/** A part's number and label (the page numbers its thirteen parts, as before). */
function Label({ index, children, tone }: { index: string; children: string; tone?: Tone }) {
  return (
    <p className="eyebrow" data-tone={tone}>
      <span className="ip-index">{index}</span>
      {children}
    </p>
  );
}

/** A part's head: the homepage's section head (label, title, lead, a link onwards) with the part's number. */
function Head({
  id,
  index,
  label,
  title,
  intro,
  tone = "brand",
  read = false,
  action,
}: {
  id: string;
  index: string;
  label: string;
  title: string;
  intro?: string;
  tone?: Tone;
  read?: boolean;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
      <div className={read ? "a2-read max-w-[44rem]" : "max-w-[44rem]"} data-reveal>
        <Label index={index} tone={tone}>
          {label}
        </Label>
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

/**
 * About in the Modern Commerce design (Stage TM-2.3): the full company profile in fifteen parts, in the previous
 * design's order — the introduction, who RAWASY is, what it does, the metal services, scaffolding and site support, the
 * vision, the engineering approach, how it works, why RAWASY, the workshop, the machinery, selected work, clients,
 * compliance and the ways on. Every sentence and figure is the previous page's (the content layer); nothing is
 * estimated. Photos are never shown larger than their source. The project cards open their project's place in the
 * Projects gallery until the project pages exist (decision D4), and the machinery links keep the Capabilities
 * placeholder (D5).
 */
export async function AboutPage({ locale }: { locale: Locale }) {
  const [about, company, services, pillars, metricData, machines, showcased, clients, certificates, projectsPage, home] = await Promise.all([
    getAboutContent(),
    getCompany(),
    getServices(),
    getPillars(),
    getMetrics(),
    getMachines(),
    getShowcasedProjects(),
    getClients(),
    getCertificates(),
    getProjectsPageContent(),
    getHomeContent(),
  ]);
  const dict = getDictionary(locale);
  const image = (id: MediaId, alt: string): CommerceImage => ({ ...getMedia(id), alt });
  const hero = image(about.hero.media, about.hero.mediaAlt[locale]);
  const metal = services.filter((s) => s.slug !== "scaffolding");
  const category = (slug: string) => projectCategories.find((c) => c.slug === slug)?.label[locale] ?? slug;
  const projects = about.projects.slugs.map((slug) => showcased.find((p) => p.slug === slug)).filter((p) => p !== undefined);
  // Until the project pages exist (Stage 1F), a project card opens the project's place in the Projects gallery, and says
  // so (decision D4).
  const inGallery = (slug: string) => href(locale, "projects", { hash: slug });

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      {innerPageJsonLd("about", locale, "AboutPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      {/* Company introduction */}
      <PageHero
        layout="split"
        breadcrumb={breadcrumbTrail("about", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={about.hero.eyebrow[locale]}
        tone="steel"
        title={about.hero.title[locale]}
        intro={about.hero.intro[locale]}
        facts={about.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
        aside={
          // The workshop photo at its own size (it is a small export), with the registered names under it.
          <div className="ab-hero-aside" style={{ maxWidth: hero.width }}>
            <Figure
              image={hero}
              caption={about.hero.caption[locale]}
              sizes="(min-width: 1024px) 396px, 92vw"
              priority
              delay={120}
              read
            />
            <div className="ab-name" data-reveal="fade" style={delay(200)}>
              <span className="ab-name-label">{about.hero.nameplate[locale]}</span>
              <span className="ab-name-en" lang="en" dir="ltr">
                {company.legalName.en}
              </span>
              <span className="ab-name-ar" lang="ar" dir="rtl">
                {company.legalName.ar}
              </span>
            </div>
          </div>
        }
      />

      {/* 01 — Who RAWASY is */}
      <section id="overview" aria-labelledby="overview-title" className="sec">
        <div className="shell grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="a2-read lg:col-span-5" data-reveal>
            <Label index="01" tone="steel">
              {about.overview.label[locale]}
            </Label>
            <h2 id="overview-title" className="t-h2 mt-4">
              {about.overview.title[locale]}
            </h2>
          </div>
          <div className="a2-read ab-prose lg:col-span-7" data-reveal style={delay(80)}>
            {about.overview.paragraphs[locale].map((paragraph, i) => (
              <p key={i} className={i === 0 ? "ab-lead" : undefined}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* 02 — What RAWASY does */}
      <section id="what" aria-labelledby="what-title" className="sec sec-sheet sec-muted">
        <div className="shell">
          <Head id="what-title" index="02" label={about.what.label[locale]} title={about.what.title[locale]} intro={about.what.intro[locale]} tone="steel" />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:mt-12 lg:gap-5">
            {about.what.divisions.map((d, i) => (
              <li key={d.slug} data-reveal style={delay(i * 80)}>
                <div className="card card-edge ab-division" data-tone={d.slug === "metal" ? "steel" : "teal"}>
                  <span className="icon-chip icon-chip-lg">
                    <Icon name={d.slug === "metal" ? "laser-cutting" : "scaffolding"} size={26} />
                  </span>
                  <p className="ab-kicker mt-5">{d.label[locale]}</p>
                  <h3 className="t-h3 mt-1">{d.title[locale]}</h3>
                  <p className="t-small mt-2">{d.body[locale]}</p>
                  <a href={d.slug === "metal" ? "#metal" : "#beyond"} className="link-arrow mt-auto pt-5 text-[0.92rem]">
                    {d.link[locale]}
                    <span className="ip-down">
                      <Icon name="arrow" size={16} />
                    </span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 03 — Core metal services */}
      <section id="metal" aria-labelledby="metal-title" className="sec">
        <div className="shell">
          <Head id="metal-title" index="03" label={about.metal.label[locale]} title={about.metal.title[locale]} intro={about.metal.intro[locale]} read />
          <ul className="ab-services mt-10 lg:mt-12">
            {metal.map((s, i) => (
              <li key={s.slug} className={i < 2 ? "ab-svc-wide" : undefined} data-reveal style={delay((i % 3) * 70)}>
                <article className="card card-link card-edge ab-svc" data-tone={serviceTone[s.slug]}>
                  <div className="flex items-start justify-between gap-4">
                    <span className="icon-chip">
                      <Icon name={serviceIcon[s.slug]} size={22} />
                    </span>
                    <span className="ab-svc-n" dir="ltr">
                      {s.index}
                    </span>
                  </div>
                  <h3 className="t-h3 mt-4">
                    <a href={href(locale, "service", { slug: s.slug })} className="stretch outline-none">
                      {s.name[locale]}
                    </a>
                  </h3>
                  <p className="t-small mt-1.5">{s.tagline[locale]}</p>
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {s.highlights[locale].slice(0, i < 2 ? 5 : 3).map((item) => (
                      <li key={item} className="tag">
                        {item}
                      </li>
                    ))}
                  </ul>
                  <span className="ab-go mt-auto pt-5">
                    {about.metal.explore[locale]}
                    <Icon name="arrow" size={16} className="go" />
                  </span>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 04 — Scaffolding and site support */}
      <section id="beyond" aria-labelledby="beyond-title" className="sec sec-sheet sec-raised">
        <div className="shell grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6">
            <Figure
              image={image(about.beyond.media, about.beyond.mediaAlt[locale])}
              caption={about.beyond.label[locale]}
              sizes="(min-width: 1024px) 537px, 92vw"
              className="ab-beyond-figure"
            />
          </div>
          <div className="lg:col-span-6" data-reveal>
            <Label index="04" tone="teal">
              {about.beyond.label[locale]}
            </Label>
            <h2 id="beyond-title" className="t-h2 mt-4">
              {about.beyond.title[locale]}
            </h2>
            <p className="t-lead mt-4">{about.beyond.intro[locale]}</p>
            <ul className="ab-support mt-6">
              {about.beyond.items.map((item) => (
                <li key={item.slug} className="tag">
                  <Icon name={supportIcon[item.slug] ?? "check"} size={16} className="text-teal" />
                  {item.label[locale]}
                </li>
              ))}
            </ul>
            <a href={href(locale, "service", { slug: "scaffolding" })} className="btn btn-secondary mt-8">
              {about.beyond.link[locale]}
              <Icon name="arrow" size={17} />
            </a>
          </div>
        </div>
      </section>

      {/* 05 — Vision */}
      <section id="vision" aria-labelledby="vision-title" className="sec">
        <div className="shell">
          <div className="ab-vision" data-reveal>
            <h2 id="vision-title" className="eyebrow eyebrow-dark">
              <span className="ip-index">05</span>
              {about.vision.label[locale]}
            </h2>
            <blockquote className="ab-quote">
              <p>{company.vision.statement[locale]}</p>
            </blockquote>
            <p className="ab-aims-label">{about.vision.aimsLabel[locale]}</p>
            <ol className="ab-aims">
              {company.vision.aims[locale].map((aim, i) => (
                <li key={i}>
                  <span aria-hidden className="ab-aim-n">
                    {pad(i + 1)}
                  </span>
                  <span>{aim}</span>
                </li>
              ))}
            </ol>
            <p className="ab-closing">
              <span aria-hidden className="ab-closing-rule" />
              {company.vision.closing[locale]}
            </p>
          </div>
        </div>
      </section>

      {/* 06 — Engineering approach */}
      <section id="approach" aria-labelledby="approach-title" className="sec pt-0">
        <div className="shell">
          <Head id="approach-title" index="06" label={about.approach.label[locale]} title={about.approach.title[locale]} intro={about.approach.intro[locale]} tone="steel" read />
          <div className="mt-10 grid grid-cols-1 gap-4 lg:mt-12 lg:grid-cols-12 lg:gap-5">
            <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-5">
              {metricData.metrics.map((m, i) => (
                <div key={m.slug} className="card ab-stat" data-tone="steel" data-reveal style={delay(i * 60)}>
                  <dt>{m.label[locale]}</dt>
                  <dd className="t-stat" dir="ltr">
                    {m.display[locale]}
                    {m.unit && <span className="ab-unit">{m.unit[locale]}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="card ab-statements lg:col-span-7" data-reveal style={delay(120)}>
              {metricData.statements.map((s, i) => (
                <li key={s.title.en} data-tone={i % 2 === 0 ? "steel" : "teal"}>
                  <span className="icon-chip shrink-0">
                    <Icon name={statementIcon[i % statementIcon.length]} size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="t-h4">{s.title[locale]}</h3>
                    <p className="t-small mt-1">{s.body[locale]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 07 — How RAWASY works */}
      <section id="process" aria-labelledby="process-title" className="sec sec-sheet sec-muted">
        <div className="shell">
          <Head id="process-title" index="07" label={about.process.label[locale]} title={about.process.title[locale]} intro={about.process.intro[locale]} tone="teal" />
          <ol className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:mt-12 lg:grid-cols-3 lg:gap-5">
            {about.process.steps.map((step, i) => (
              <li key={step.slug} className="card ab-step" data-tone="teal" data-reveal style={delay((i % 3) * 70)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="icon-chip">
                    <Icon name={STEP_ICONS[step.slug] ?? "layers"} size={22} />
                  </span>
                  <span aria-hidden className="step-num">
                    {pad(i + 1)}
                  </span>
                </div>
                <h3 className="t-h3 mt-4">{step.title[locale]}</h3>
                <p className="t-small mt-1.5">{step.body[locale]}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 08 — Why RAWASY */}
      <section id="why" aria-labelledby="why-title" className="sec">
        <div className="shell">
          <Head id="why-title" index="08" label={about.why.label[locale]} title={about.why.title[locale]} intro={about.why.intro[locale]} read />
          <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-4">
            {pillars.map((p, i) => (
              <li key={p.slug} data-reveal style={delay((i % 3) * 70)}>
                <div className="card a2-pillar flex h-full items-start gap-3.5 p-4 sm:p-5" data-tone={pillarIcon[p.slug]?.[1] ?? "steel"}>
                  <span className="icon-chip shrink-0">
                    <Icon name={pillarIcon[p.slug]?.[0] ?? "precision"} size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="t-h4">{p.title[locale]}</h3>
                    <p className="t-small mt-1">{p.body[locale]}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 09 — In the workshop: each print at most at its source size; its caption names it (so the image's alt is empty, not
          the same words twice for screen readers) */}
      <section id="workshop" aria-labelledby="workshop-title" className="sec sec-sheet sec-raised">
        <div className="shell">
          <Head id="workshop-title" index="09" label={about.workshop.label[locale]} title={about.workshop.title[locale]} intro={about.workshop.intro[locale]} tone="brass" />
          <ul className="ab-prints mt-10 lg:mt-12">
            {about.workshop.photos.map((photo, i) => {
              const print = image(photo.media, "");
              return (
                <li key={photo.media} style={{ width: print.width }}>
                  <Figure image={print} caption={photo.caption[locale]} sizes={`${print.width}px`} delay={(i % 4) * 70} />
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 10 — Machinery (Capabilities stays a placeholder until Stage 1E: decision D5) */}
      <section id="machinery" aria-labelledby="machinery-title" className="sec">
        <div className="shell grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="a2-read lg:col-span-4" data-reveal>
            <Label index="10" tone="steel">
              {about.machinery.label[locale]}
            </Label>
            <h2 id="machinery-title" className="t-h2 mt-4">
              {about.machinery.title[locale]}
            </h2>
            <p className="t-lead mt-4">{about.machinery.intro[locale]}</p>
            <a href={href(locale, "capabilities")} className="btn btn-steel mt-8">
              {about.machinery.link[locale]}
              <Icon name="arrow" size={17} />
            </a>
          </div>
          <div className="card ab-table lg:col-span-8" data-tone="steel" data-reveal style={delay(100)}>
            <table className="ip-table">
              <caption className="sr-only">{about.machinery.label[locale]}</caption>
              <thead>
                <tr>
                  <th scope="col">{about.machinery.machine[locale]}</th>
                  <th scope="col" className="max-sm:hidden">
                    {about.machinery.type[locale]}
                  </th>
                  <th scope="col" className="ip-table-end">
                    {about.machinery.power[locale]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => {
                  const media = getMedia(m.media);
                  return (
                    <tr key={m.slug}>
                      <th scope="row">
                        <span className="ab-machine">
                          <span className="ab-machine-img">
                            <Image src={media.src} alt="" fill sizes="64px" placeholder="blur" blurDataURL={media.blurDataURL} className="object-contain" />
                          </span>
                          <span className="ab-machine-name">{m.name[locale]}</span>
                        </span>
                      </th>
                      <td className="max-sm:hidden">{m.category[locale]}</td>
                      <td className="ip-table-end">
                        {m.powerWatts ? (
                          <span className="t-stat ab-power" dir="ltr">
                            {formatPower(m.powerWatts, "en")}
                          </span>
                        ) : (
                          <>
                            <span aria-hidden className="text-ink-2">
                              —
                            </span>
                            <span className="sr-only">{about.machinery.notStated[locale]}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 11 — Selected work: each card opens its project in the Projects gallery (D4) */}
      <section id="work" aria-labelledby="work-title" className="sec sec-sheet sec-muted">
        <div className="shell">
          <Head
            id="work-title"
            index="11"
            label={about.projects.label[locale]}
            title={about.projects.title[locale]}
            intro={about.projects.intro[locale]}
            tone="brass"
            action={{ href: href(locale, "projects"), label: about.projects.link[locale] }}
          />
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4 lg:gap-5">
            {projects.map((p, i) => {
              const photo = getMedia(projectImages(p)[0]);
              return (
                <li key={p.slug} data-reveal style={delay((i % 4) * 70)}>
                  <a href={inGallery(p.slug)} className="card card-link ab-proj">
                    {/* Shown at most at the photo's own size, centred on the stage when the card is wider. */}
                    <div className="ab-proj-stage">
                      <Image
                        src={photo.src}
                        alt=""
                        width={photo.width}
                        height={photo.height}
                        sizes={`(min-width: 640px) ${Math.min(photo.width, 340)}px, 92vw`}
                        placeholder="blur"
                        blurDataURL={photo.blurDataURL}
                        className="ab-proj-img"
                        style={{ width: `min(100%, ${photo.width}px)`, height: `min(100%, ${photo.height}px)` }}
                      />
                      <span aria-hidden className="badge badge-light ab-proj-flag">
                        {category(p.categories[0])}
                      </span>
                    </div>
                    <div className="ab-proj-body">
                      <span className="ab-proj-ref" dir="ltr">
                        {projectsPage.refLabel[locale]} {p.galleryRef}
                      </span>
                      <h3 className="t-h3 mt-1.5">{p.title[locale]}</h3>
                      <span className="t-small mt-1 block">{p.categories.slice(0, 2).map(category).join(" · ")}</span>
                      <span className="ab-go mt-auto pt-4">
                        {home.projects.inGallery[locale]}
                        <Icon name="arrow" size={16} className="go" />
                      </span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 12 — Clients */}
      <section id="clients" aria-labelledby="clients-title" className="sec">
        <div className="shell">
          <Head
            id="clients-title"
            index="12"
            label={about.clients.label[locale]}
            title={about.clients.title[locale]}
            intro={about.clients.intro[locale]}
            tone="teal"
            action={{ href: href(locale, "clients"), label: about.clients.link[locale] }}
            read
          />
          <ul aria-label={about.clients.label[locale]} className="ab-logos mt-10 lg:mt-12">
            {clients.slice(0, 6).map((c, i) => (
              <li key={c.slug} data-reveal="fade" style={delay(i * 40)}>
                <div className="logo-tile">
                  <Logo image={image(c.logo, c.name[locale])} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 13 — Compliance: the redacted, blurred thumbnails (the files as they are) */}
      <section id="compliance" aria-labelledby="compliance-title" className="sec py-0">
        <div className="shell">
          <div className="a2-comp ab-comp" data-tone="brass">
            <div className="max-w-[44rem]" data-reveal>
              <Label index="13">{about.compliance.label[locale]}</Label>
              <h2 id="compliance-title" className="t-h2 mt-4">
                {about.compliance.title[locale]}
              </h2>
              <p className="t-lead mt-4">{about.compliance.intro[locale]}</p>
            </div>
            <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {certificates.map((c, i) => {
                const thumb = getMedia(c.thumb);
                return (
                  <li key={c.slug} data-reveal style={delay(i * 90)}>
                    <a href={href(locale, "certificates")} className="card card-link ab-doc">
                      <div className="ab-doc-plate">
                        <div className="ab-doc-sheet">
                          <Image src={thumb.src} alt="" fill sizes="180px" placeholder="blur" blurDataURL={thumb.blurDataURL} className="object-cover object-top" />
                        </div>
                      </div>
                      <div className="ab-doc-body">
                        <span className="ab-doc-issuer">
                          <Icon name={DOC_ICONS[i] ?? "doc"} size={16} />
                          {c.issuer[locale]}
                        </span>
                        <h3 className="t-h4 mt-2">{c.title[locale]}</h3>
                        <span className="ab-go mt-auto pt-4">
                          {about.compliance.link[locale]}
                          <Icon name="arrow" size={16} className="go" />
                        </span>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="ab-comp-note">{about.compliance.note[locale]}</p>
          </div>
        </div>
      </section>

      {/* Ways on */}
      <ClosingCta
        label={about.cta.label[locale]}
        title={about.cta.title[locale]}
        links={about.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale], description: link.description?.[locale] }))}
      />
    </>
  );
}
