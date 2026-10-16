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

type PartHead = { label: string; title: string; intro: string };

/** The workshop photo at its own size (it is a small export), with the registered names under it. */
export function AboutHeroAside({ image, caption, nameplate, legalName }: { image: CommerceImage; caption: string; nameplate: string; legalName: { en: string; ar: string } }) {
  return (
    <div className="ab-hero-aside" style={{ maxWidth: image.width }}>
      <Figure image={image} caption={caption} sizes="(min-width: 1024px) 396px, 92vw" priority delay={120} read />
      <div className="ab-name" data-reveal="fade" style={delay(200)}>
        <span className="ab-name-label">{nameplate}</span>
        <span className="ab-name-en" lang="en" dir="ltr">
          {legalName.en}
        </span>
        <span className="ab-name-ar" lang="ar" dir="rtl">
          {legalName.ar}
        </span>
      </div>
    </div>
  );
}

/** Who RAWASY is: the label and title beside the paragraphs (the first one leads). */
export function AboutOverview({ index, label, title, paragraphs }: { index: string; label: string; title: string; paragraphs: string[] }) {
  return (
    <section id="overview" aria-labelledby="overview-title" className="sec">
      <div className="shell grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="a2-read lg:col-span-5" data-reveal>
          <Label index={index} tone="steel">
            {label}
          </Label>
          <h2 id="overview-title" className="t-h2 mt-4">
            {title}
          </h2>
        </div>
        <div className="a2-read ab-prose lg:col-span-7" data-reveal style={delay(80)}>
          {paragraphs.map((paragraph, i) => (
            <p key={i} className={i === 0 ? "ab-lead" : undefined}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

/** What RAWASY does: the business's two sections as cards, each opening its part of the page (the metal services, or scaffolding and site support). */
export function AboutWhat({
  index,
  head,
  divisions,
}: {
  index: string;
  head: PartHead;
  divisions: { slug: string; label: string; title: string; body: string; link: string }[];
}) {
  return (
    <section id="what" aria-labelledby="what-title" className="sec sec-sheet sec-muted">
      <div className="shell">
        <Head id="what-title" index={index} label={head.label} title={head.title} intro={head.intro} tone="steel" />
        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:mt-12 lg:gap-5">
          {divisions.map((d, i) => (
            <li key={d.slug} data-reveal style={delay(i * 80)}>
              <div className="card card-edge ab-division" data-tone={d.slug === "metal" ? "steel" : "teal"}>
                <span className="icon-chip icon-chip-lg">
                  <Icon name={d.slug === "metal" ? "laser-cutting" : "scaffolding"} size={26} />
                </span>
                <p className="ab-kicker mt-5">{d.label}</p>
                <h3 className="t-h3 mt-1">{d.title}</h3>
                <p className="t-small mt-2">{d.body}</p>
                <a href={d.slug === "metal" ? "#metal" : "#beyond"} className="link-arrow mt-auto pt-5 text-[0.92rem]">
                  {d.link}
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
  );
}

/** The core metal services: one card per service (the first two wide, with five highlights; the others three), each opening its page. */
export function AboutMetal({
  index,
  head,
  explore,
  services,
}: {
  index: string;
  head: PartHead;
  explore: string;
  services: { slug: string; tone: Tone | undefined; icon: IconName; index: string; name: string; tagline: string; highlights: string[]; href: string }[];
}) {
  return (
    <section id="metal" aria-labelledby="metal-title" className="sec">
      <div className="shell">
        <Head id="metal-title" index={index} label={head.label} title={head.title} intro={head.intro} read />
        <ul className="ab-services mt-10 lg:mt-12">
          {services.map((s, i) => (
            <li key={s.slug} className={i < 2 ? "ab-svc-wide" : undefined} data-reveal style={delay((i % 3) * 70)}>
              <article className="card card-link card-edge ab-svc" data-tone={s.tone}>
                <div className="flex items-start justify-between gap-4">
                  <span className="icon-chip">
                    <Icon name={s.icon} size={22} />
                  </span>
                  <span className="ab-svc-n" dir="ltr">
                    {s.index}
                  </span>
                </div>
                <h3 className="t-h3 mt-4">
                  <a href={s.href} className="stretch outline-none">
                    {s.name}
                  </a>
                </h3>
                <p className="t-small mt-1.5">{s.tagline}</p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {s.highlights.slice(0, i < 2 ? 5 : 3).map((item) => (
                    <li key={item} className="tag">
                      {item}
                    </li>
                  ))}
                </ul>
                <span className="ab-go mt-auto pt-5">
                  {explore}
                  <Icon name="arrow" size={16} className="go" />
                </span>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Scaffolding and site support: the photo beside the text, the support items and the link onwards. */
export function AboutBeyond({
  index,
  image,
  label,
  title,
  intro,
  items,
  link,
}: {
  index: string;
  image: CommerceImage;
  label: string;
  title: string;
  intro: string;
  items: { slug: string; label: string }[];
  link: { href: string; label: string };
}) {
  return (
    <section id="beyond" aria-labelledby="beyond-title" className="sec sec-sheet sec-raised">
      <div className="shell grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-6">
          <Figure image={image} caption={label} sizes="(min-width: 1024px) 537px, 92vw" className="ab-beyond-figure" />
        </div>
        <div className="lg:col-span-6" data-reveal>
          <Label index={index} tone="teal">
            {label}
          </Label>
          <h2 id="beyond-title" className="t-h2 mt-4">
            {title}
          </h2>
          <p className="t-lead mt-4">{intro}</p>
          <ul className="ab-support mt-6">
            {items.map((item) => (
              <li key={item.slug} className="tag">
                <Icon name={supportIcon[item.slug] ?? "check"} size={16} className="text-teal" />
                {item.label}
              </li>
            ))}
          </ul>
          <a href={link.href} className="btn btn-secondary mt-8">
            {link.label}
            <Icon name="arrow" size={17} />
          </a>
        </div>
      </div>
    </section>
  );
}

/** The vision on the dark panel: the statement, the numbered aims and the closing line. */
export function AboutVision({
  index,
  label,
  statement,
  aimsLabel,
  aims,
  closing,
}: {
  index: string;
  label: string;
  statement: string;
  aimsLabel: string;
  aims: string[];
  closing: string;
}) {
  return (
    <section id="vision" aria-labelledby="vision-title" className="sec">
      <div className="shell">
        <div className="ab-vision" data-reveal>
          <h2 id="vision-title" className="eyebrow eyebrow-dark">
            <span className="ip-index">{index}</span>
            {label}
          </h2>
          <blockquote className="ab-quote">
            <p>{statement}</p>
          </blockquote>
          <p className="ab-aims-label">{aimsLabel}</p>
          <ol className="ab-aims">
            {aims.map((aim, i) => (
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
            {closing}
          </p>
        </div>
      </div>
    </section>
  );
}

/** The engineering approach: the company figures beside the capability statements. */
export function AboutApproach({
  index,
  head,
  metrics,
  statements,
}: {
  index: string;
  head: PartHead;
  metrics: { slug: string; label: string; display: string; unit?: string }[];
  statements: { key: string; title: string; body: string }[];
}) {
  return (
    <section id="approach" aria-labelledby="approach-title" className="sec pt-0">
      <div className="shell">
        <Head id="approach-title" index={index} label={head.label} title={head.title} intro={head.intro} tone="steel" read />
        <div className="mt-10 grid grid-cols-1 gap-4 lg:mt-12 lg:grid-cols-12 lg:gap-5">
          <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-5">
            {metrics.map((m, i) => (
              <div key={m.slug} className="card ab-stat" data-tone="steel" data-reveal style={delay(i * 60)}>
                <dt>{m.label}</dt>
                <dd className="t-stat" dir="ltr">
                  {m.display}
                  {m.unit && <span className="ab-unit">{m.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="card ab-statements lg:col-span-7" data-reveal style={delay(120)}>
            {statements.map((s, i) => (
              <li key={s.key} data-tone={i % 2 === 0 ? "steel" : "teal"}>
                <span className="icon-chip shrink-0">
                  <Icon name={statementIcon[i % statementIcon.length]} size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="t-h4">{s.title}</h3>
                  <p className="t-small mt-1">{s.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** How RAWASY works: the numbered steps as cards. */
export function AboutProcess({ index, head, steps }: { index: string; head: PartHead; steps: { slug: string; title: string; body: string }[] }) {
  return (
    <section id="process" aria-labelledby="process-title" className="sec sec-sheet sec-muted">
      <div className="shell">
        <Head id="process-title" index={index} label={head.label} title={head.title} intro={head.intro} tone="teal" />
        <ol className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:mt-12 lg:grid-cols-3 lg:gap-5">
          {steps.map((step, i) => (
            <li key={step.slug} className="card ab-step" data-tone="teal" data-reveal style={delay((i % 3) * 70)}>
              <div className="flex items-center justify-between gap-3">
                <span className="icon-chip">
                  <Icon name={STEP_ICONS[step.slug] ?? "layers"} size={22} />
                </span>
                <span aria-hidden className="step-num">
                  {pad(i + 1)}
                </span>
              </div>
              <h3 className="t-h3 mt-4">{step.title}</h3>
              <p className="t-small mt-1.5">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Why RAWASY: the pillars. */
export function AboutWhy({ index, head, pillars }: { index: string; head: PartHead; pillars: { slug: string; title: string; body: string }[] }) {
  return (
    <section id="why" aria-labelledby="why-title" className="sec">
      <div className="shell">
        <Head id="why-title" index={index} label={head.label} title={head.title} intro={head.intro} read />
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-4">
          {pillars.map((p, i) => (
            <li key={p.slug} data-reveal style={delay((i % 3) * 70)}>
              <div className="card a2-pillar flex h-full items-start gap-3.5 p-4 sm:p-5" data-tone={pillarIcon[p.slug]?.[1] ?? "steel"}>
                <span className="icon-chip shrink-0">
                  <Icon name={pillarIcon[p.slug]?.[0] ?? "precision"} size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="t-h4">{p.title}</h3>
                  <p className="t-small mt-1">{p.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** In the workshop: each print at most at its source size; its caption names it (so the image's alt is empty, not the same words twice for screen readers). */
export function AboutWorkshop({ index, head, photos }: { index: string; head: PartHead; photos: { key: string; image: CommerceImage; caption: string }[] }) {
  return (
    <section id="workshop" aria-labelledby="workshop-title" className="sec sec-sheet sec-raised">
      <div className="shell">
        <Head id="workshop-title" index={index} label={head.label} title={head.title} intro={head.intro} tone="brass" />
        <ul className="ab-prints mt-10 lg:mt-12">
          {photos.map((photo, i) => (
            <li key={photo.key} style={{ width: photo.image.width }}>
              <Figure image={photo.image} caption={photo.caption} sizes={`${photo.image.width}px`} delay={(i % 4) * 70} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The machinery as a table: each machine's thumbnail, name, type and stated power (never a figure the records do not state). */
export function AboutMachinery({
  index,
  head,
  link,
  columns,
  notStated,
  machines,
}: {
  index: string;
  head: PartHead;
  link: { href: string; label: string };
  columns: { machine: string; type: string; power: string };
  notStated: string;
  machines: { slug: string; name: string; category: string; powerWatts?: number | null; image: CommerceImage }[];
}) {
  return (
    <section id="machinery" aria-labelledby="machinery-title" className="sec">
      <div className="shell grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="a2-read lg:col-span-4" data-reveal>
          <Label index={index} tone="steel">
            {head.label}
          </Label>
          <h2 id="machinery-title" className="t-h2 mt-4">
            {head.title}
          </h2>
          <p className="t-lead mt-4">{head.intro}</p>
          <a href={link.href} className="btn btn-steel mt-8">
            {link.label}
            <Icon name="arrow" size={17} />
          </a>
        </div>
        <div className="card ab-table lg:col-span-8" data-tone="steel" data-reveal style={delay(100)}>
          <table className="ip-table">
            <caption className="sr-only">{head.label}</caption>
            <thead>
              <tr>
                <th scope="col">{columns.machine}</th>
                <th scope="col" className="max-sm:hidden">
                  {columns.type}
                </th>
                <th scope="col" className="ip-table-end">
                  {columns.power}
                </th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.slug}>
                  <th scope="row">
                    <span className="ab-machine">
                      <span className="ab-machine-img">
                        <Image
                          src={m.image.src}
                          alt=""
                          fill
                          sizes="64px"
                          placeholder="blur"
                          blurDataURL={m.image.blurDataURL}
                          className="object-contain"
                          {...(m.image.unoptimized ? { unoptimized: true } : {})}
                        />
                      </span>
                      <span className="ab-machine-name">{m.name}</span>
                    </span>
                  </th>
                  <td className="max-sm:hidden">{m.category}</td>
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
                        <span className="sr-only">{notStated}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** Selected work: each card opens its project's place in the Projects gallery (D4), its photo at most at its own size. */
export function AboutWork({
  index,
  head,
  link,
  refLabel,
  cardAction,
  projects,
}: {
  index: string;
  head: PartHead;
  link: { href: string; label: string };
  refLabel: string;
  cardAction: string;
  projects: { slug: string; href: string; image: CommerceImage; ref: string; title: string; categories: string[]; flag: string }[];
}) {
  return (
    <section id="work" aria-labelledby="work-title" className="sec sec-sheet sec-muted">
      <div className="shell">
        <Head id="work-title" index={index} label={head.label} title={head.title} intro={head.intro} tone="brass" action={link} />
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4 lg:gap-5">
          {projects.map((p, i) => {
            const photo = p.image;
            return (
              <li key={p.slug} data-reveal style={delay((i % 4) * 70)}>
                <a href={p.href} className="card card-link ab-proj">
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
                      {...(photo.unoptimized ? { unoptimized: true } : {})}
                    />
                    <span aria-hidden className="badge badge-light ab-proj-flag">
                      {p.flag}
                    </span>
                  </div>
                  <div className="ab-proj-body">
                    <span className="ab-proj-ref" dir="ltr">
                      {refLabel} {p.ref}
                    </span>
                    <h3 className="t-h3 mt-1.5">{p.title}</h3>
                    <span className="t-small mt-1 block">{p.categories.join(" · ")}</span>
                    <span className="ab-go mt-auto pt-4">
                      {cardAction}
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
  );
}

/** A row of client logos with the link to the Clients page. */
export function AboutClients({ index, head, link, logos }: { index: string; head: PartHead; link: { href: string; label: string }; logos: { slug: string; image: CommerceImage }[] }) {
  return (
    <section id="clients" aria-labelledby="clients-title" className="sec">
      <div className="shell">
        <Head id="clients-title" index={index} label={head.label} title={head.title} intro={head.intro} tone="teal" action={link} read />
        <ul aria-label={head.label} className="ab-logos mt-10 lg:mt-12">
          {logos.map((c, i) => (
            <li key={c.slug} data-reveal="fade" style={delay(i * 40)}>
              <div className="logo-tile">
                <Logo image={c.image} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Compliance: the documents' redacted, blurred thumbnails (the files as they are), titles and issuers, each opening Certificates. */
export function AboutCompliance({
  index,
  head,
  link,
  note,
  documents,
}: {
  index: string;
  head: PartHead;
  link: { href: string; label: string };
  note: string;
  documents: { slug: string; title: string; issuer: string; thumb: CommerceImage }[];
}) {
  return (
    <section id="compliance" aria-labelledby="compliance-title" className="sec py-0">
      <div className="shell">
        <div className="a2-comp ab-comp" data-tone="brass">
          <div className="max-w-[44rem]" data-reveal>
            <Label index={index}>{head.label}</Label>
            <h2 id="compliance-title" className="t-h2 mt-4">
              {head.title}
            </h2>
            <p className="t-lead mt-4">{head.intro}</p>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {documents.map((c, i) => (
              <li key={c.slug} data-reveal style={delay(i * 90)}>
                <a href={link.href} className="card card-link ab-doc">
                  <div className="ab-doc-plate">
                    <div className="ab-doc-sheet">
                      <Image
                        src={c.thumb.src}
                        alt=""
                        fill
                        sizes="180px"
                        placeholder="blur"
                        blurDataURL={c.thumb.blurDataURL}
                        className="object-cover object-top"
                        {...(c.thumb.unoptimized ? { unoptimized: true } : {})}
                      />
                    </div>
                  </div>
                  <div className="ab-doc-body">
                    <span className="ab-doc-issuer">
                      <Icon name={DOC_ICONS[i] ?? "doc"} size={16} />
                      {c.issuer}
                    </span>
                    <h3 className="t-h4 mt-2">{c.title}</h3>
                    <span className="ab-go mt-auto pt-4">
                      {link.label}
                      <Icon name="arrow" size={16} className="go" />
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
          <p className="ab-comp-note">{note}</p>
        </div>
      </div>
    </section>
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
          <AboutHeroAside
            image={hero}
            caption={about.hero.caption[locale]}
            nameplate={about.hero.nameplate[locale]}
            legalName={{ en: company.legalName.en, ar: company.legalName.ar }}
          />
        }
      />

      {/* 01 — Who RAWASY is */}
      <AboutOverview index="01" label={about.overview.label[locale]} title={about.overview.title[locale]} paragraphs={about.overview.paragraphs[locale]} />

      {/* 02 — What RAWASY does */}
      <AboutWhat
        index="02"
        head={{ label: about.what.label[locale], title: about.what.title[locale], intro: about.what.intro[locale] }}
        divisions={about.what.divisions.map((d) => ({ slug: d.slug, label: d.label[locale], title: d.title[locale], body: d.body[locale], link: d.link[locale] }))}
      />

      {/* 03 — Core metal services */}
      <AboutMetal
        index="03"
        head={{ label: about.metal.label[locale], title: about.metal.title[locale], intro: about.metal.intro[locale] }}
        explore={about.metal.explore[locale]}
        services={metal.map((s) => ({ slug: s.slug, tone: serviceTone[s.slug], icon: serviceIcon[s.slug], index: s.index, name: s.name[locale], tagline: s.tagline[locale], highlights: s.highlights[locale], href: href(locale, "service", { slug: s.slug }) }))}
      />

      {/* 04 — Scaffolding and site support */}
      <AboutBeyond
        index="04"
        image={image(about.beyond.media, about.beyond.mediaAlt[locale])}
        label={about.beyond.label[locale]}
        title={about.beyond.title[locale]}
        intro={about.beyond.intro[locale]}
        items={about.beyond.items.map((item) => ({ slug: item.slug, label: item.label[locale] }))}
        link={{ href: href(locale, "service", { slug: "scaffolding" }), label: about.beyond.link[locale] }}
      />

      {/* 05 — Vision */}
      <AboutVision
        index="05"
        label={about.vision.label[locale]}
        statement={company.vision.statement[locale]}
        aimsLabel={about.vision.aimsLabel[locale]}
        aims={company.vision.aims[locale]}
        closing={company.vision.closing[locale]}
      />

      {/* 06 — Engineering approach */}
      <AboutApproach
        index="06"
        head={{ label: about.approach.label[locale], title: about.approach.title[locale], intro: about.approach.intro[locale] }}
        metrics={metricData.metrics.map((m) => ({ slug: m.slug, label: m.label[locale], display: m.display[locale], unit: m.unit?.[locale] }))}
        statements={metricData.statements.map((s) => ({ key: s.title.en, title: s.title[locale], body: s.body[locale] }))}
      />

      {/* 07 — How RAWASY works */}
      <AboutProcess
        index="07"
        head={{ label: about.process.label[locale], title: about.process.title[locale], intro: about.process.intro[locale] }}
        steps={about.process.steps.map((step) => ({ slug: step.slug, title: step.title[locale], body: step.body[locale] }))}
      />

      {/* 08 — Why RAWASY */}
      <AboutWhy
        index="08"
        head={{ label: about.why.label[locale], title: about.why.title[locale], intro: about.why.intro[locale] }}
        pillars={pillars.map((p) => ({ slug: p.slug, title: p.title[locale], body: p.body[locale] }))}
      />

      {/* 09 — In the workshop: each print at most at its source size; its caption names it */}
      <AboutWorkshop
        index="09"
        head={{ label: about.workshop.label[locale], title: about.workshop.title[locale], intro: about.workshop.intro[locale] }}
        photos={about.workshop.photos.map((photo) => ({ key: photo.media, image: image(photo.media, ""), caption: photo.caption[locale] }))}
      />

      {/* 10 — Machinery (Capabilities stays a placeholder until Stage 1E: decision D5) */}
      <AboutMachinery
        index="10"
        head={{ label: about.machinery.label[locale], title: about.machinery.title[locale], intro: about.machinery.intro[locale] }}
        link={{ href: href(locale, "capabilities"), label: about.machinery.link[locale] }}
        columns={{ machine: about.machinery.machine[locale], type: about.machinery.type[locale], power: about.machinery.power[locale] }}
        notStated={about.machinery.notStated[locale]}
        machines={machines.map((m) => ({ slug: m.slug, name: m.name[locale], category: m.category[locale], powerWatts: m.powerWatts, image: { ...getMedia(m.media), alt: "" } }))}
      />

      {/* 11 — Selected work: each card opens its project in the Projects gallery (D4) */}
      <AboutWork
        index="11"
        head={{ label: about.projects.label[locale], title: about.projects.title[locale], intro: about.projects.intro[locale] }}
        link={{ href: href(locale, "projects"), label: about.projects.link[locale] }}
        refLabel={projectsPage.refLabel[locale]}
        cardAction={home.projects.inGallery[locale]}
        projects={projects.map((p) => ({
          slug: p.slug,
          href: inGallery(p.slug),
          image: { ...getMedia(projectImages(p)[0]), alt: "" },
          ref: p.galleryRef,
          title: p.title[locale],
          categories: p.categories.slice(0, 2).map(category),
          flag: category(p.categories[0]),
        }))}
      />

      {/* 12 — Clients */}
      <AboutClients
        index="12"
        head={{ label: about.clients.label[locale], title: about.clients.title[locale], intro: about.clients.intro[locale] }}
        link={{ href: href(locale, "clients"), label: about.clients.link[locale] }}
        logos={clients.slice(0, 6).map((c) => ({ slug: c.slug, image: image(c.logo, c.name[locale]) }))}
      />

      {/* 13 — Compliance: the redacted, blurred thumbnails (the files as they are) */}
      <AboutCompliance
        index="13"
        head={{ label: about.compliance.label[locale], title: about.compliance.title[locale], intro: about.compliance.intro[locale] }}
        link={{ href: href(locale, "certificates"), label: about.compliance.link[locale] }}
        note={about.compliance.note[locale]}
        documents={certificates.map((c) => ({ slug: c.slug, title: c.title[locale], issuer: c.issuer[locale], thumb: { ...getMedia(c.thumb), alt: "" } }))}
      />

      {/* Ways on */}
      <ClosingCta
        label={about.cta.label[locale]}
        title={about.cta.title[locale]}
        links={about.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale], description: link.description?.[locale] }))}
      />
    </>
  );
}
