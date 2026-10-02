import Image from "next/image";
import { Icon, type IconName } from "../Icon";
import { Figure } from "../inner/Figure";
import { supportIcon } from "../tones";
import type { CommerceImage, Tone } from "../types";
import { delay } from "../ui";
import { EngravedMotif, FoldGlyph, ProfileGlyph } from "./glyphs";
import type { ServiceLook } from "./looks";

/*
 * The content of a service page's sections (Stage TM-2.4), as in Stage 1D: the same parts, in the same layouts per
 * service (looks.ts), with the same sourcing rules — a block is only rendered when its content exists. Text on an open
 * section sits on a reading zone (`read`); cards and sheets are opaque. Photos are never shown wider than their source.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const zone = (read: boolean, className = "") => (read ? `a2-read ${className}` : className).trim() || undefined;

export interface CaptionedImage extends CommerceImage {
  caption: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// Overview: the service in the company's own words, and what it includes
// ---------------------------------------------------------------------------------------------------------------------

export function Overview({
  paragraphs,
  includesLabel,
  includes,
  tone,
  figure,
  read,
}: {
  paragraphs: string[];
  includesLabel: string;
  includes: string[];
  tone: Tone;
  figure?: CaptionedImage;
  read: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-7">
        <div className={zone(read, "sv-prose")} data-reveal>
          {paragraphs.map((paragraph, i) => (
            <p key={i} className={i === 0 ? "sv-lead" : undefined}>
              {paragraph}
            </p>
          ))}
        </div>
        {figure && <Figure image={figure} caption={figure.caption} sizes={`${figure.width}px`} className="sv-overview-figure" read={read} />}
      </div>
      <div className="lg:col-span-5" data-reveal style={delay(120)}>
        <div className="card card-edge sv-includes" data-tone={tone}>
          <p className="sv-label">{includesLabel}</p>
          <ul className="sv-includes-list">
            {includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Scope: "What we provide", in the layout that suits the service
// ---------------------------------------------------------------------------------------------------------------------

export interface ScopeItem {
  slug: string;
  title: string;
  body?: string;
  image?: CommerceImage;
}

export function Scope({
  layout,
  tone,
  items,
  figures = [],
  icons,
  read,
}: {
  layout: ServiceLook["scope"];
  tone: Tone;
  items: ScopeItem[];
  figures?: CaptionedImage[];
  icons: Record<string, IconName>;
  read: boolean;
}) {
  switch (layout) {
    // Profile sections in one row; the featured item (with a description) runs across underneath.
    case "profiles": {
      const plain = items.filter((item) => !item.body);
      return (
        <ul className="sv-profiles" data-count={plain.length}>
          {items.map((item, i) => (
            <li key={item.slug} className={item.body ? "sv-profiles-wide" : undefined} data-reveal style={delay((i % 5) * 60)}>
              <div className="card sv-profile" data-tone={item.body ? "brand" : tone}>
                <ProfileGlyph slug={item.slug} className="sv-glyph" />
                <div className="min-w-0">
                  <h3 className="t-h4">{item.title}</h3>
                  {item.body && <p className="t-small mt-1.5">{item.body}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      );
    }

    // Formed profiles, numbered.
    case "folds":
      return (
        <ol className="sv-folds">
          {items.map((item, i) => (
            <li key={item.slug} className="card sv-fold-card" data-tone={tone} data-reveal style={delay((i % 4) * 70)}>
              <div className="flex items-start justify-between gap-4">
                <FoldGlyph slug={item.slug} className="sv-glyph" />
                <span className="ip-index text-[0.8125rem]" dir="ltr">
                  {pad(i + 1)}
                </span>
              </div>
              <h3 className="t-h4 mt-5">{item.title}</h3>
              {item.body && <p className="t-small mt-1.5">{item.body}</p>}
            </li>
          ))}
        </ol>
      );

    // Linked phases: design → manufacture → assembly.
    case "phases":
      return (
        <ol className="sv-phases">
          {items.map((item, i) => (
            <li key={item.slug} className="sv-phase" data-reveal style={delay(i * 110)}>
              <div className="card card-edge sv-phase-card" data-tone={tone}>
                <div className="flex items-center justify-between gap-4">
                  <span className="icon-chip icon-chip-lg">
                    <Icon name={icons[item.slug] ?? "precision"} size={26} />
                  </span>
                  <span aria-hidden className="sv-phase-n">
                    {pad(i + 1)}
                  </span>
                </div>
                <h3 className="t-h3 mt-6">{item.title}</h3>
                {item.body && <p className="t-small mt-2">{item.body}</p>}
              </div>
              {i < items.length - 1 && (
                <span aria-hidden className="sv-phase-link">
                  <Icon name="arrow" size={16} />
                </span>
              )}
            </li>
          ))}
        </ol>
      );

    // Photo cards: each photo at most at its source size, centred on the card's stage.
    case "photos":
      return (
        <ul className="sv-photo-cards">
          {items.map((item, i) => (
            <li key={item.slug} className="card card-edge sv-photo-card" data-tone={tone} data-reveal style={delay((i % 4) * 70)}>
              {item.image && (
                <div className="sv-stage-photo">
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    width={item.image.width}
                    height={item.image.height}
                    sizes={`(min-width: 640px) ${Math.min(item.image.width, 320)}px, 92vw`}
                    placeholder="blur"
                    blurDataURL={item.image.blurDataURL}
                    className="sv-stage-img"
                    style={{ width: `min(100%, ${item.image.width}px)`, height: `min(100%, ${item.image.height}px)` }}
                  />
                </div>
              )}
              <div className="sv-photo-card-body">
                <span className="ip-index text-[0.8125rem]" dir="ltr">
                  {pad(i + 1)}
                </span>
                <h3 className="t-h4 mt-1.5">{item.title}</h3>
                {item.body && <p className="t-small mt-1.5">{item.body}</p>}
              </div>
            </li>
          ))}
        </ul>
      );

    // Material swatches with an engraved motif (the materials keep their own colours in both themes).
    case "materials":
      return (
        <ul className="sv-materials">
          {items.map((item, i) => (
            <li key={item.slug} className="card sv-material" data-tone={tone} data-reveal style={delay((i % 4) * 70)}>
              <div aria-hidden className={`sv-swatch sv-swatch-${item.slug}`}>
                <EngravedMotif slug={item.slug} className="sv-swatch-motif" />
              </div>
              <h3 className="t-h4 mt-4">{item.title}</h3>
              {item.body && <p className="t-small mt-1.5">{item.body}</p>}
            </li>
          ))}
        </ul>
      );

    // Support tiles beside the site photos (each photo named by its caption).
    case "support":
      return (
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <ul className="sv-support lg:col-span-6">
            {items.map((item, i) => (
              <li key={item.slug} className="card sv-support-tile" data-tone={tone} data-reveal="fade" style={delay(60 * i)}>
                <span className="icon-chip shrink-0">
                  <Icon name={supportIcon[item.slug] ?? "scaffolding"} size={22} />
                </span>
                <h3 className="t-h4">{item.title}</h3>
                <span aria-hidden className="sv-support-n" dir="ltr">
                  {pad(i + 1)}
                </span>
              </li>
            ))}
          </ul>
          {figures.length > 0 && (
            <div className="sv-support-figures lg:col-span-6">
              {figures.map((figure, i) => (
                <Figure
                  key={figure.src}
                  image={figure}
                  caption={figure.caption}
                  sizes={`(min-width: 1024px) ${figure.width}px, 92vw`}
                  delay={i * 160}
                  className={i === 0 ? "sv-support-main" : "sv-support-detail"}
                  read={read}
                />
              ))}
            </div>
          )}
        </div>
      );
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Process: how the work runs — a rail, a timeline or a cycle — always with the general-workflow note
// ---------------------------------------------------------------------------------------------------------------------

export interface ProcessStep {
  slug: string;
  title: string;
  body?: string;
}

export function Process({
  layout,
  rail = "fine",
  tone,
  steps,
  note,
  icons,
  read,
}: {
  layout: ServiceLook["process"];
  rail?: ServiceLook["rail"];
  tone: Tone;
  steps: ProcessStep[];
  note: string;
  icons: Record<string, IconName>;
  read: boolean;
}) {
  const noteNode = (
    <p className={zone(read, "sv-note")} data-reveal="fade">
      {note}
    </p>
  );

  if (layout === "timeline") {
    return (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <ol className={zone(read, "sv-timeline lg:col-span-8")}>
          {steps.map((step, i) => (
            <li key={step.slug} className="sv-tl-step" data-tone={tone} data-reveal="fade" style={delay(60 * i)}>
              <span className="sv-tl-node" dir="ltr">
                {pad(i + 1)}
              </span>
              <div className="sv-tl-body">
                <h3 className="t-h3">{step.title}</h3>
                {step.body && <p className="t-body mt-1.5">{step.body}</p>}
              </div>
            </li>
          ))}
        </ol>
        <aside className="lg:col-span-4">
          <div className="card card-edge sv-tl-aside" data-tone={tone}>
            <div aria-hidden className="relative flex flex-wrap gap-1.5">
              {steps.map((step) => (
                <span key={step.slug} className="icon-chip size-10">
                  <Icon name={icons[step.slug] ?? "layers"} size={20} />
                </span>
              ))}
            </div>
            <p className="sv-note relative mt-6">{note}</p>
          </div>
        </aside>
      </div>
    );
  }

  if (layout === "cycle") {
    return (
      <div>
        <ol className="sv-cycle" data-count={steps.length}>
          {steps.map((step, i) => (
            <li key={step.slug} className="card sv-cycle-card" data-tone={tone} data-reveal style={delay(80 * i)}>
              <div className="flex items-center justify-between gap-3">
                <span className="icon-chip">
                  <Icon name={icons[step.slug] ?? "layers"} size={22} />
                </span>
                <span className="ip-index text-[0.8125rem]" dir="ltr">
                  {pad(i + 1)}
                </span>
              </div>
              <h3 className="t-h4 mt-5">{step.title}</h3>
              {step.body && <p className="t-small mt-1.5">{step.body}</p>}
              {i < steps.length - 1 && (
                <span aria-hidden className="sv-cycle-link">
                  <Icon name="arrow" size={16} />
                </span>
              )}
            </li>
          ))}
        </ol>
        {/* The return: after dismantling, the cycle starts again on the next site. */}
        <div aria-hidden className="sv-cycle-return" data-tone={tone} data-reveal="fade" />
        {noteNode}
      </div>
    );
  }

  // Rail: numbered stations on a line (across on large screens, down on phones); the first station is the way in.
  return (
    <div>
      <ol className={zone(read, `sv-rail sv-rail-${rail}`)} data-count={steps.length}>
        {steps.map((step, i) => (
          <li key={step.slug} className="sv-station" data-tone={tone} data-reveal style={delay(90 * i)}>
            <span className={i === 0 ? "sv-node sv-node-first" : "sv-node"} dir="ltr">
              {pad(i + 1)}
            </span>
            <h3 className="t-h4">{step.title}</h3>
            {step.body && <p className="t-small mt-1.5">{step.body}</p>}
          </li>
        ))}
      </ol>
      {noteNode}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Machinery: the machines the company profile ties to the service; rated power only where the profile states it
// ---------------------------------------------------------------------------------------------------------------------

export interface MachineCard {
  slug: string;
  /** Name exactly as printed in the company profile. */
  name: string;
  category: string;
  capability: string;
  power?: { value: string; unit: string };
  image: CommerceImage;
  href: string;
}

function Power({ power, label }: { power: { value: string; unit: string }; label: string }) {
  return (
    <p className="sv-power">
      <span className="sv-power-label">{label}</span>
      <span className="sv-power-value" dir="ltr">
        <span className="t-stat">{power.value}</span>
        <span className="sv-power-unit">{power.unit}</span>
      </span>
    </p>
  );
}

function MachineStage({ image, sizes }: { image: CommerceImage; sizes: string }) {
  return (
    <div className="sv-machine-stage">
      <Image
        src={image.src}
        alt=""
        width={image.width}
        height={image.height}
        sizes={sizes}
        placeholder="blur"
        blurDataURL={image.blurDataURL}
        className="sv-machine-img"
        style={{ width: `min(100%, ${image.width}px)`, height: `min(100%, ${image.height}px)` }}
      />
    </div>
  );
}

export function Machines({ machines, powerLabel, linkLabel }: { machines: MachineCard[]; powerLabel: string; linkLabel: string }) {
  if (machines.length === 1) {
    const [m] = machines;
    return (
      <div data-reveal>
        <a href={m.href} className="card card-link card-edge sv-machine sv-machine-wide" data-tone="steel">
          <MachineStage image={m.image} sizes={`(min-width: 768px) ${m.image.width}px, 80vw`} />
          <div className="sv-machine-body">
            <p className="tag tag-tone self-start">{m.category}</p>
            <h3 className="t-h3 mt-4">{m.name}</h3>
            <p className="t-body mt-2 max-w-[34rem]">{m.capability}</p>
            {m.power && <Power power={m.power} label={powerLabel} />}
            <span className="ab-go mt-auto pt-6">
              {linkLabel}
              <Icon name="arrow" size={16} className="go" />
            </span>
          </div>
        </a>
      </div>
    );
  }
  return (
    <ul className="sv-machines">
      {machines.map((m, i) => (
        <li key={m.slug} data-reveal style={delay((i % 4) * 80)}>
          <a href={m.href} className="card card-link card-edge sv-machine" data-tone="steel">
            <MachineStage image={m.image} sizes={`(min-width: 1280px) ${Math.min(m.image.width, 300)}px, (min-width: 640px) 45vw, 88vw`} />
            <div className="sv-machine-body">
              <p className="sv-label">{m.category}</p>
              <h3 className="t-h4 mt-1.5">{m.name}</h3>
              {m.power && <Power power={m.power} label={powerLabel} />}
              <p className="t-small mt-3">{m.capability}</p>
              <span className="ab-go mt-auto pt-5">
                {linkLabel}
                <Icon name="arrow" size={16} className="go" />
              </span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Applications: sectors by their source, the uses named in the profile, and the categories of the related work
// ---------------------------------------------------------------------------------------------------------------------

export interface SectorItem {
  slug: string;
  name: string;
  /** "profile": named in the company profile; "inferred": a website classification. */
  basis: "profile" | "inferred";
  basisLabel: string;
}

export function Applications({
  sectors,
  uses,
  categories,
  labels,
  link,
  tone,
  read,
}: {
  sectors: SectorItem[];
  uses: string[];
  categories: { slug: string; label: string }[];
  labels: { sectors: string; uses: string; work: string };
  link?: { href: string; label: string };
  tone: Tone;
  read: boolean;
}) {
  // No sectors (engraving): the uses become the main cards.
  if (sectors.length === 0) {
    return (
      <ul className="sv-uses">
        {uses.map((use, i) => (
          <li key={use} className="card card-edge sv-use" data-tone={tone} data-reveal style={delay(80 * i)}>
            <span aria-hidden className="sv-phase-n">
              {pad(i + 1)}
            </span>
            <h3 className="t-h4">{use}</h3>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-7">
        <p className={zone(read, "sv-label")}>{labels.sectors}</p>
        <ul className="sv-sectors">
          {sectors.map((sector, i) => (
            <li key={sector.slug} className="card sv-sector" data-basis={sector.basis} data-reveal style={delay((i % 2) * 70)}>
              <h3 className="t-h4">{sector.name}</h3>
              <p className="sv-basis">
                <span aria-hidden className="sv-basis-mark" />
                {sector.basisLabel}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-8 lg:col-span-5 lg:ps-6">
        {uses.length > 0 && (
          <div className={zone(read)} data-reveal>
            <p className="sv-label">{labels.uses}</p>
            <ul className="sv-tags" data-tone={tone}>
              {uses.map((use) => (
                <li key={use} className="tag tag-tone">
                  {use}
                </li>
              ))}
            </ul>
          </div>
        )}
        {categories.length > 0 && (
          <div className={zone(read)} data-reveal style={delay(80)}>
            <p className="sv-label">{labels.work}</p>
            <ul className="sv-tags">
              {categories.map((category) => (
                <li key={category.slug} className="tag">
                  {category.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {link && (
          <div data-reveal style={delay(140)}>
            <a href={link.href} className="btn btn-secondary">
              {link.label}
              <Icon name="arrow" size={17} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Gallery: the service's photographs with their captions, never wider than the source
// ---------------------------------------------------------------------------------------------------------------------

/** Print height in the mosaic: a photo shorter than this keeps its own size. */
const ROW = 236;

export function Gallery({ layout, photos, read }: { layout: ServiceLook["gallery"]; photos: CaptionedImage[]; read: boolean }) {
  const width = (photo: CaptionedImage) => (layout === "mosaic" ? Math.min(photo.width, Math.round((photo.width / photo.height) * ROW)) : photo.width);
  return (
    <ul className={`sv-gallery sv-gallery-${layout}`}>
      {photos.map((photo, i) => (
        <li key={photo.src} style={{ width: width(photo), ...delay((i % 4) * 80) }} data-reveal>
          {/* The caption names the photo, so its own alt text stays empty (not the same words twice). */}
          <figure className="sv-print">
            <div className="sv-print-photo" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
              <Image
                src={photo.src}
                alt=""
                fill
                sizes={`(min-width: 640px) ${width(photo)}px, 92vw`}
                placeholder="blur"
                blurDataURL={photo.blurDataURL}
                className="object-cover"
              />
            </div>
            <figcaption className={zone(read, "sv-print-caption")}>{photo.caption}</figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Why RAWASY, related services and the related work
// ---------------------------------------------------------------------------------------------------------------------

export function Why({ points, tone }: { points: { slug: string; icon: IconName; title: string; body?: string }[]; tone: Tone }) {
  return (
    <ul className="card sv-why" data-count={points.length} data-tone={tone}>
      {points.map((point, i) => (
        <li key={point.slug} data-reveal="fade" style={delay(90 * i)}>
          <span className="icon-chip">
            <Icon name={point.icon} size={22} />
          </span>
          <h3 className="t-h4 mt-5">{point.title}</h3>
          {point.body && <p className="t-small mt-1.5">{point.body}</p>}
        </li>
      ))}
    </ul>
  );
}

export interface RelatedService {
  slug: string;
  index: string;
  name: string;
  tagline: string;
  href: string;
  tone: Tone;
  icon: IconName;
  highlights: string[];
}

export function Related({ services, action }: { services: RelatedService[]; action: string }) {
  return (
    <ul className="sv-related" data-count={services.length}>
      {services.map((s, i) => (
        <li key={s.slug} data-reveal style={delay(i * 80)}>
          <article className="card card-link card-edge sv-rel" data-tone={s.tone}>
            <div className="flex items-start justify-between gap-4">
              <span className="icon-chip">
                <Icon name={s.icon} size={22} />
              </span>
              <span className="ip-index text-[0.8125rem]" dir="ltr">
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
              {s.highlights.map((h) => (
                <li key={h} className="tag">
                  {h}
                </li>
              ))}
            </ul>
            <span className="ab-go mt-auto pt-5">
              {action}
              <Icon name="arrow" size={16} className="go" />
            </span>
          </article>
        </li>
      ))}
    </ul>
  );
}

export interface ProjectItem {
  slug: string;
  /** The project's place in the Projects gallery (`/projects#<slug>`) until the project pages exist (Stage 1F, D4). */
  href: string;
  ref: string;
  title: string;
  summary: string;
  categories: string[];
  /** The photo(s) the previous card showed: one, or a pair of small ones. */
  images: CommerceImage[];
}

/**
 * Work from the gallery whose own record lists the service. Until the project pages exist (Stage 1F), every card opens
 * its project's place in the Projects gallery and says so (decision D4): never an unfinished project page.
 */
export function Projects({
  projects,
  refLabel,
  viewLabel,
  read,
}: {
  projects: ProjectItem[];
  refLabel: string;
  viewLabel: string;
  read: boolean;
}) {
  const card = (p: ProjectItem) => (
    <a href={p.href} className="card card-link ab-proj">
      {/* Each photo at most at its own size, centred on the card's stage. */}
      <div className="ab-proj-stage">
        {p.images.length === 1 ? (
          <Image
            src={p.images[0].src}
            alt=""
            width={p.images[0].width}
            height={p.images[0].height}
            sizes={`(min-width: 640px) ${Math.min(p.images[0].width, 340)}px, 92vw`}
            placeholder="blur"
            blurDataURL={p.images[0].blurDataURL}
            className="ab-proj-img"
            style={{ width: `min(100%, ${p.images[0].width}px)`, height: `min(100%, ${p.images[0].height}px)` }}
          />
        ) : (
          <span className="sv-proj-pair">
            {p.images.map((image) => (
              <Image
                key={image.src}
                src={image.src}
                alt=""
                width={image.width}
                height={image.height}
                sizes={`${image.width}px`}
                placeholder="blur"
                blurDataURL={image.blurDataURL}
                className="sv-proj-pair-img"
                style={{ width: `min(100%, ${image.width}px)`, height: `min(100%, ${image.height}px)` }}
              />
            ))}
          </span>
        )}
        {p.categories[0] && (
          <span aria-hidden className="badge badge-light ab-proj-flag">
            {p.categories[0]}
          </span>
        )}
      </div>
      <div className="ab-proj-body">
        <span className="ab-proj-ref" dir="ltr">
          {refLabel} {p.ref}
        </span>
        <h3 className="t-h3 mt-1.5">{p.title}</h3>
        <span className="t-small mt-1 block">{p.categories.slice(0, 2).join(" · ")}</span>
        <span className="ab-go mt-auto pt-4">
          {viewLabel}
          <Icon name="arrow" size={16} className="go" />
        </span>
      </div>
    </a>
  );

  // A single project sits beside its gallery summary.
  if (projects.length === 1) {
    const [p] = projects;
    return (
      <div className="sv-project-single">
        <div className="sv-project-card" data-reveal>
          {card(p)}
        </div>
        <p className={zone(read, "sv-lead")} data-reveal style={delay(100)}>
          {p.summary}
        </p>
      </div>
    );
  }
  return (
    <ul className="sv-projects">
      {projects.map((p, i) => (
        <li key={p.slug} data-reveal style={delay((i % 4) * 70)}>
          {card(p)}
        </li>
      ))}
    </ul>
  );
}
