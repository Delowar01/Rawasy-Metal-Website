import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/commerce/Icon";
import { HeroVisual } from "@/components/commerce/services/HeroVisual";
import type { ServiceLook } from "@/components/commerce/services/looks";
import { surfaceAt, SvSection, type SectionAction } from "@/components/commerce/services/parts";
import { Applications, Gallery, Machines, Overview, Process, Projects, Related, Scope, Why, type CaptionedImage, type MachineCard } from "@/components/commerce/services/ServiceBlocks";
import { ServiceCta } from "@/components/commerce/services/ServiceCta";
import { ServiceHero } from "@/components/commerce/services/ServiceHero";
import { serviceTone } from "@/components/commerce/tones";
import type { CommerceImage, Tone } from "@/components/commerce/types";
import { routeLabels } from "@/content/navigation";
import type { ServiceSlug } from "@/content/types";
import { cardImages } from "@/lib/project-cards";
import type { PreviewMachine, PreviewProject, PreviewService } from "@/server/builder/preview-data";
import { itemsOf, itemText, linesOf, textOf } from "@/server/builder/view";
import type { BlockProps, RenderContext } from "../context";
import type { Presence } from "../compose";
import { ICONS } from "../parts";
import { commerceImage, imageProblem, placeholderImage } from "./images";

/*
 * A service page's blocks (A5 brief §11, §41): the approved components of `src/components/commerce/services/*` — the
 * opening and its picture, the numbered sections in their alternating surfaces, the closing call to action — drawn from
 * the section's data and the service's working record (its name, tagline, summary, description, highlights, cover,
 * gallery, machines, related services and featured projects), with the page's look (picture, layouts, rail, icons) from
 * the blocks' own settings. As today, a section whose content is missing shows nothing (machines, applications, gallery,
 * projects); a section's number and surface come from its place among the sections the page shows; every section takes
 * the colour role chosen on the page's opening.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const LANGUAGE = { en: "English", ar: "Arabic" } as const;
const label = (value: { en: string | null; ar: string | null }, slug: string) => value.en ?? value.ar ?? slug;
const iconOf = (value: unknown, fallback: IconName): IconName => (typeof value === "string" && ICONS.has(value) ? (value as IconName) : fallback);

const toneOf = (ctx: RenderContext): Tone => ctx.layout.serviceTone ?? "steel";

/** The service whose page this is (a template is shown with its sample service). */
const NO_SERVICE = "there is no service to show it with (a template is shown with the first service in the collection).";

/** The service's number: its place among the services in the collection's order (as today's "01" … "06"). */
function serviceIndex(service: PreviewService, ctx: RenderContext): string {
  const live = ctx.records.services.filter((s) => !s.archived || s.id === service.id);
  return pad(live.findIndex((s) => s.id === service.id) + 1);
}

/** The service's machines, in the record's order, archived ones left out. */
const machinesOf = (service: PreviewService, ctx: RenderContext) =>
  service.machines.map((id) => ctx.records.machines.find((m) => m.id === id)).filter((m): m is PreviewMachine => m !== undefined && !m.archived);

/** The sectors whose records list the service, in the collection's order. */
const sectorsOf = (service: PreviewService, ctx: RenderContext) => ctx.records.industries.filter((i) => !i.archived && i.services.includes(service.id));

/** The projects the service features that list the service themselves (A3's invariant), archived ones left out. */
const projectsOf = (service: PreviewService, ctx: RenderContext) =>
  service.featured.map((id) => ctx.records.projects.find((p) => p.id === id)).filter((p): p is PreviewProject => p !== undefined && !p.archived && p.services.includes(service.id));

/** A project card's photos as today's cards choose them (one wide enough, a pair of small ones, or one framed). */
function projectPhotos(project: PreviewProject, ctx: RenderContext): CommerceImage[] {
  if (project.restrictions.length) return [placeholderImage(["Restricted", ...project.restrictions].join(", "))];
  const shown = project.media.filter((id) => !imageProblem(id, ctx)).map((id) => commerceImage(id, ctx, ""));
  if (!shown.length) return [placeholderImage(project.media.length ? (imageProblem(project.media[0], ctx) ?? "Not available") : "No photo yet")];
  return cardImages(shown).images;
}

/** A numbered section of the page: its number and surface from its place, its colour role from the opening. */
function section(props: BlockProps, fixed: string, title: string, intro: string | undefined, action: SectionAction | undefined, body: (read: boolean) => ReactNode) {
  const { section: s, ctx } = props;
  const surface = surfaceAt(Math.max(s.ordinal, 0));
  return (
    <SvSection id={s.anchor ?? fixed} surface={surface} index={pad(Math.max(s.ordinal, 0) + 1)} label={textOf(s.content, "label")} title={title} intro={intro || undefined} tone={toneOf(ctx)} action={action}>
      {body(surface === "plain")}
    </SvSection>
  );
}

function ServiceOpening({ section: s, ctx }: BlockProps) {
  const service = ctx.service!;
  const { locale } = ctx;
  const dict = ctx.site.dict;
  const visual = (typeof s.settings.visual === "string" ? s.settings.visual : "frame") as ServiceLook["hero"];
  const c = s.content;
  const name = service.name[locale] ?? "";
  const crumbs = [
    { href: ctx.hrefOf(locale, "home"), label: dict.common.home },
    { href: ctx.hrefOf(locale, "services"), label: routeLabels.services[locale] },
    { href: ctx.hrefOf(locale, "service", { slug: service.slug }), label: name },
  ];
  const workAnchor = ctx.layout.present.has("service.gallery") ? "#gallery" : ctx.layout.present.has("service.projects") ? "#projects" : undefined;
  const cover = visual === "plate" ? undefined : commerceImage(service.cover, ctx, service.coverAlt[locale] ?? "");
  const detailId = s.settings.detail as string | undefined;
  const detail = visual === "workbench" && detailId ? commerceImage(detailId, ctx, textOf(c, "detailCaption")) : undefined;
  return (
    <ServiceHero
      breadcrumb={crumbs}
      breadcrumbLabel={dict.a11y.breadcrumb}
      serviceLabel={textOf(c, "serviceLabel")}
      index={serviceIndex(service, ctx)}
      section={textOf(c, "section")}
      tone={toneOf(ctx)}
      title={name}
      lead={service.tagline[locale] ?? ""}
      intro={service.summary[locale] ?? ""}
      facts={itemsOf(s.settings, "facts")
        .map((item) => ({ label: itemText(c, "facts", item.id, "label"), value: itemText(c, "facts", item.id, "value") }))
        .filter((fact) => fact.label || fact.value)}
      signature={visual === "cut" || visual === "plate"}
      actions={
        <>
          <a href={ctx.hrefOf(locale, "contact", { hash: "quote" })} className="btn btn-primary">
            {textOf(c, "quote")}
            <Icon name="arrow" size={17} />
          </a>
          {workAnchor && (
            <a href={workAnchor} className="btn btn-secondary">
              {textOf(c, "seeWork")}
              <span className="ip-down">
                <Icon name="arrow" size={17} />
              </span>
            </a>
          )}
        </>
      }
      visual={<HeroVisual kind={visual} cover={cover} detail={detail} />}
    />
  );
}

function ServiceOverview(props: BlockProps) {
  const { section: s, ctx } = props;
  const service = ctx.service!;
  const media = s.settings.media as string | undefined;
  const figure: CaptionedImage | undefined = media ? { ...commerceImage(media, ctx, ""), caption: textOf(s.content, "caption") } : undefined;
  return section(props, "overview", textOf(s.content, "title"), undefined, undefined, (read) => (
    <Overview
      paragraphs={service.body[ctx.locale] ?? []}
      includesLabel={textOf(s.content, "includesLabel")}
      includes={service.highlights[ctx.locale] ?? []}
      tone={toneOf(ctx)}
      figure={figure}
      read={read}
    />
  ));
}

function ServiceScope(props: BlockProps) {
  const { section: s, ctx } = props;
  const c = s.content;
  const items = itemsOf<{ icon?: string; media?: string }>(s.settings, "items");
  const layout = (typeof s.settings.layout === "string" ? s.settings.layout : "phases") as ServiceLook["scope"];
  return section(props, "scope", textOf(c, "title"), textOf(c, "intro"), undefined, (read) => (
    <Scope
      layout={layout}
      tone={toneOf(ctx)}
      icons={Object.fromEntries(items.map((item) => [item.id, iconOf(item.icon, "precision")]))}
      read={read}
      items={items.map((item) => ({
        slug: item.id,
        title: itemText(c, "items", item.id, "title"),
        body: itemText(c, "items", item.id, "body") || undefined,
        image: item.media ? commerceImage(item.media, ctx, itemText(c, "items", item.id, "caption")) : undefined,
      }))}
      figures={itemsOf<{ media?: string }>(s.settings, "figures")
        .filter((f) => f.media)
        .map((f) => ({ ...commerceImage(f.media, ctx, ""), caption: itemText(c, "figures", f.id, "caption") }))}
    />
  ));
}

function ServiceProcess(props: BlockProps) {
  const { section: s, ctx } = props;
  const c = s.content;
  const steps = itemsOf<{ icon?: string }>(s.settings, "steps");
  const layout = (typeof s.settings.layout === "string" ? s.settings.layout : "timeline") as ServiceLook["process"];
  const rail = s.settings.rail === "cut" || s.settings.rail === "fold" || s.settings.rail === "fine" ? s.settings.rail : undefined;
  return section(props, "process", textOf(c, "title"), textOf(c, "intro"), undefined, (read) => (
    <Process
      layout={layout}
      rail={rail}
      tone={toneOf(ctx)}
      icons={Object.fromEntries(steps.map((step) => [step.id, iconOf(step.icon, "layers")]))}
      note={textOf(c, "note")}
      read={read}
      steps={steps.map((step) => ({ slug: step.id, title: itemText(c, "steps", step.id, "title"), body: itemText(c, "steps", step.id, "body") || undefined }))}
    />
  ));
}

function ServiceMachines(props: BlockProps) {
  const { section: s, ctx } = props;
  const c = s.content;
  const { locale } = ctx;
  const machines = machinesOf(ctx.service!, ctx).map(
    (m): MachineCard => ({
      slug: m.slug,
      name: m.name[locale] ?? "",
      category: m.category[locale] ?? "",
      capability: m.capability[locale] ?? "",
      power: m.powerWatts ? { value: m.powerWatts.toLocaleString("en-US"), unit: locale === "ar" ? "واط" : "W" } : undefined,
      image: commerceImage(m.media, ctx, ""),
      href: ctx.hrefOf(locale, "capabilities", { hash: m.slug }),
    }),
  );
  return section(props, "machinery", textOf(c, "title"), textOf(c, "intro"), { href: ctx.hrefOf(locale, "capabilities"), label: textOf(c, "link"), variant: "steel" }, () => (
    <Machines powerLabel={textOf(c, "powerLabel")} linkLabel={textOf(c, "capabilitiesLabel")} machines={machines} />
  ));
}

function ServiceApplications(props: BlockProps) {
  const { section: s, ctx } = props;
  const c = s.content;
  const { locale } = ctx;
  const service = ctx.service!;
  const sectors = sectorsOf(service, ctx);
  const categories = [...new Set(projectsOf(service, ctx).flatMap((p) => p.categories))]
    .map((id) => ctx.records.categories.find((cat) => cat.id === id))
    .filter((cat) => cat !== undefined)
    .slice(0, 5)
    .map((cat) => ({ slug: cat.slug, label: cat.label[locale] ?? "" }));
  return section(props, "applications", textOf(c, "title"), textOf(c, "intro"), undefined, (read) => (
    <Applications
      tone={toneOf(ctx)}
      read={read}
      labels={{ sectors: textOf(c, "sectorsLabel"), uses: textOf(c, "usesLabel"), work: textOf(c, "workLabel") }}
      sectors={sectors.map((sector) => ({
        slug: sector.slug,
        name: sector.name[locale] ?? "",
        basis: sector.classification === "profile_sector" ? "profile" : "inferred",
        basisLabel: textOf(c, sector.classification === "profile_sector" ? "basisProfile" : "basisInferred"),
      }))}
      uses={linesOf(c, "uses")}
      categories={categories}
      link={sectors.length > 0 ? { href: ctx.hrefOf(locale, "industries"), label: textOf(c, "linkLabel") } : undefined}
    />
  ));
}

function ServiceGallery(props: BlockProps) {
  const { section: s, ctx } = props;
  const c = s.content;
  const layout = (typeof s.settings.layout === "string" ? s.settings.layout : "mosaic") as ServiceLook["gallery"];
  const photos = ctx.service!.gallery.map((item): CaptionedImage => ({ ...commerceImage(item.media, ctx, ""), caption: item.caption[ctx.locale] ?? "" }));
  return section(props, "gallery", textOf(c, "title"), textOf(c, "intro"), undefined, (read) => <Gallery layout={layout} photos={photos} read={read} />);
}

function ServiceWhy(props: BlockProps) {
  const { section: s, ctx } = props;
  const c = s.content;
  const points = itemsOf<{ icon?: string }>(s.settings, "points").map((p) => ({
    slug: p.id,
    icon: iconOf(p.icon, "precision"),
    title: itemText(c, "points", p.id, "title"),
    body: itemText(c, "points", p.id, "body") || undefined,
  }));
  return section(props, "why", textOf(c, "title"), undefined, undefined, () => <Why tone={toneOf(ctx)} points={points} />);
}

function ServiceRelated(props: BlockProps) {
  const { section: s, ctx } = props;
  const c = s.content;
  const { locale } = ctx;
  const services = ctx
    .service!.related.map((id) => ctx.records.services.find((x) => x.id === id))
    .filter((x): x is PreviewService => x !== undefined && !x.archived)
    .map((x) => ({
      slug: x.slug,
      index: serviceIndex(x, ctx),
      name: x.name[locale] ?? "",
      tagline: x.tagline[locale] ?? "",
      href: ctx.hrefOf(locale, "service", { slug: x.slug }),
      tone: serviceTone[x.slug as ServiceSlug] ?? "steel",
      icon: iconOf(x.icon, "layers"),
      highlights: (x.highlights[locale] ?? []).slice(0, 3),
    }));
  return section(props, "related", textOf(c, "title"), undefined, { href: ctx.hrefOf(locale, "services"), label: textOf(c, "allServices") }, () => (
    <Related action={textOf(c, "explore")} services={services} />
  ));
}

function ServiceProjects(props: BlockProps) {
  const { section: s, ctx } = props;
  const c = s.content;
  const { locale } = ctx;
  const projects = projectsOf(ctx.service!, ctx).map((p) => ({
    slug: p.slug,
    href: ctx.hrefOf(locale, "projects", { hash: p.slug }),
    ref: p.ref ?? "",
    title: p.title[locale] ?? "",
    summary: p.summary[locale] ?? "",
    categories: p.categories.map((id) => ctx.records.categories.find((cat) => cat.id === id)?.label[locale] ?? "").filter(Boolean),
    images: projectPhotos(p, ctx),
  }));
  return section(props, "projects", textOf(c, "title"), textOf(c, "intro"), { href: ctx.hrefOf(locale, "projects"), label: textOf(c, "allProjects") }, (read) => (
    <Projects read={read} refLabel={textOf(c, "refLabel")} viewLabel={textOf(c, "viewLabel")} projects={projects} />
  ));
}

function ServiceClosing({ section: s, ctx }: BlockProps) {
  const c = s.content;
  const { locale } = ctx;
  const phone = ctx.shell.contact.phones[0];
  return (
    <ServiceCta
      tone={toneOf(ctx)}
      label={textOf(c, "label")}
      title={textOf(c, "title")}
      body={textOf(c, "body")}
      quote={{ href: ctx.hrefOf(locale, "contact", { hash: "quote" }), label: textOf(c, "quote") }}
      call={{ href: phone.href, label: textOf(c, "call"), number: phone.display }}
      explore={{
        label: textOf(c, "or"),
        links: [
          { href: ctx.hrefOf(locale, "services"), label: textOf(c, "services") },
          { href: ctx.hrefOf(locale, "projects"), label: textOf(c, "projects") },
        ],
      }}
    />
  );
}

export const SERVICE_RENDERERS = {
  "service.hero": ServiceOpening,
  "service.overview": ServiceOverview,
  "service.scope": ServiceScope,
  "service.process": ServiceProcess,
  "service.machines": ServiceMachines,
  "service.applications": ServiceApplications,
  "service.gallery": ServiceGallery,
  "service.why": ServiceWhy,
  "service.related": ServiceRelated,
  "service.projects": ServiceProjects,
  "service.cta": ServiceClosing,
} as const;

const needsService: Presence = ({ ctx }) => (ctx.service ? null : NO_SERVICE);

/** As today: machinery, applications, gallery and projects only where the service's records hold them. */
export const SERVICE_ABSENT: Record<keyof typeof SERVICE_RENDERERS, Presence> = {
  "service.hero": needsService,
  "service.overview": needsService,
  "service.scope": needsService,
  "service.process": needsService,
  "service.why": needsService,
  "service.related": needsService,
  "service.cta": needsService,
  "service.machines": (props) => needsService(props) ?? (machinesOf(props.ctx.service!, props.ctx).length ? null : "the service lists no machines."),
  "service.applications": (props) =>
    needsService(props) ?? (sectorsOf(props.ctx.service!, props.ctx).length || linesOf(props.section.content, "uses").length ? null : "no sector lists the service and no uses are written."),
  "service.gallery": (props) => needsService(props) ?? (props.ctx.service!.gallery.length ? null : "the service has no gallery photos."),
  "service.projects": (props) => needsService(props) ?? (projectsOf(props.ctx.service!, props.ctx).length ? null : "the service features no project that lists it."),
};

/**
 * The counts today's layouts are drawn for (services.css): a rail or a cycle of five steps across the page, five plain
 * profiles in one row, three or four reasons, two or three related services. Other counts keep the component's own
 * fallback (a rail's stations stack under its line), so the preview says so.
 */
function countNote(what: string, count: number, drawn: readonly number[], layout: string): string[] {
  if (!count || drawn.includes(count)) return [];
  return [`The approved ${layout} is drawn for ${drawn.join(" or ")} ${what}; with ${count} it keeps its fallback arrangement.`];
}

/** What the preview stands in for: the service's photos it cannot show, records without the preview's language. */
export const SERVICE_NOTES = {
  "service.process": ({ section: s }: BlockProps) => {
    const count = itemsOf(s.settings, "steps").length;
    return s.settings.layout === "rail" ? countNote("steps", count, [5], "rail") : s.settings.layout === "cycle" ? countNote("steps", count, [5], "cycle") : [];
  },
  "service.scope": ({ section: s, ctx }: BlockProps) => {
    const items = itemsOf(s.settings, "items");
    const plain = items.filter((item) => !itemText(s.content, "items", item.id, "body")).length;
    const notes = s.settings.layout === "profiles" ? countNote("profiles without a description", plain, [5], "profile row") : [];
    for (const item of itemsOf<{ media?: string }>(s.settings, "items")) {
      const problem = item.media ? imageProblem(item.media, ctx) : null;
      if (problem) notes.push(`A scope photo is shown as a placeholder (${problem}).`);
    }
    return notes;
  },
  "service.why": ({ section: s }: BlockProps) => countNote("reasons", itemsOf(s.settings, "points").length, [3, 4], "reasons card"),
  "service.related": ({ ctx }: BlockProps) =>
    ctx.service ? countNote("services", ctx.service.related.filter((id) => ctx.records.services.some((x) => x.id === id && !x.archived)).length, [2, 3], "related services row") : [],
  "service.hero": ({ section: s, ctx }: BlockProps) => {
    const service = ctx.service;
    if (!service) return [];
    const notes: string[] = [];
    const name = label(service.name, service.slug);
    if (!service.name[ctx.locale]) notes.push(`The service “${name}” has no ${LANGUAGE[ctx.locale]} name yet.`);
    if (s.settings.visual !== "plate") {
      const problem = imageProblem(service.cover, ctx);
      if (problem) notes.push(`The service's cover photo is shown as a placeholder (${problem}).`);
    }
    return notes;
  },
  "service.gallery": ({ ctx }: BlockProps) => {
    const service = ctx.service;
    if (!service) return [];
    return service.gallery.flatMap((item, i) => {
      const problem = imageProblem(item.media, ctx);
      return problem ? [`Gallery photo ${i + 1} is shown as a placeholder (${problem}).`] : [];
    });
  },
  "service.machines": ({ ctx }: BlockProps) =>
    ctx.service ? machinesOf(ctx.service, ctx).flatMap((m) => (imageProblem(m.media, ctx) ? [`The machine “${label(m.name, m.slug)}”: its photo is shown as a placeholder (${imageProblem(m.media, ctx)}).`] : [])) : [],
  "service.projects": ({ ctx }: BlockProps) =>
    ctx.service ? projectsOf(ctx.service, ctx).flatMap((p) => (p.restrictions.length ? [`The project “${label(p.title, p.slug)}” is restricted (${p.restrictions.join(", ")}): its photos are not shown.`] : [])) : [],
} as const;
