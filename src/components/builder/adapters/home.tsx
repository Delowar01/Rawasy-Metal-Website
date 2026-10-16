import type { HomeView } from "@/components/commerce/home/data";
import { About } from "@/components/commerce/home/About";
import { Clients, Compliance } from "@/components/commerce/home/Clients";
import { Contact } from "@/components/commerce/home/Contact";
import { CapabilityStrip, Hero } from "@/components/commerce/home/Hero";
import { Industries } from "@/components/commerce/home/Industries";
import { Machinery } from "@/components/commerce/home/Machinery";
import { Projects } from "@/components/commerce/home/Projects";
import { Services } from "@/components/commerce/home/Services";
import type { MachineItem } from "@/components/commerce/types";
import { serviceIcon } from "@/components/commerce/ui";
import type { ServiceSlug, SupportSlug } from "@/content/types";
import type { LinkTarget } from "@/server/builder/links";
import type { Loc, PreviewMachine, PreviewProject, PreviewService } from "@/server/builder/preview-data";
import { itemsOf, itemText, linesOf, resolveLink, resolveSelection, showcaseNotes, textOf } from "@/server/builder/view";
import type { SelectionValue } from "@/server/builder/fields";
import type { BlockProps, RenderContext } from "../context";
import { InvalidSection } from "../Placeholder";
import { commerceImage, imageProblem, placeholderImage } from "./images";

/*
 * The homepage's blocks (A5 brief §11, §41): each draws the approved component of `src/components/commerce/home/*` from
 * a view built out of the section's data and the working records — the same view type the static homepage builds from the
 * content layer (`getHomeView`), so the component cannot tell the two apart. Nothing is redrawn here. What the preview
 * cannot show (a missing language, media that are not deliverable, a restricted project, a record left out) is a note for
 * the builder; a photo it cannot show is drawn as the admin-only stand-in in its place.
 *
 * Items keep their ids: the homepage's icons follow today's keys (the six service slugs, the pillar and site-support keys),
 * so content brought over with those keys as item ids (A9) shows the same icons, and anything new takes the component's
 * own fallback icon.
 */

type Model = { view: HomeView; notes: string[] };

const LANGUAGE = { en: "English", ar: "Arabic" } as const;

const recordLabel = (value: Loc<string>, slug: string) => value.en ?? value.ar ?? slug;

/** A record's text in the preview's language; a missing one is shown empty, with a note. */
function recordText(value: Loc<string>, ctx: RenderContext, notes: string[], what: string, label: string): string {
  const text = value[ctx.locale];
  if (!text) notes.push(`The ${what} “${label}” has no ${LANGUAGE[ctx.locale]} text yet; it is shown empty.`);
  return text ?? "";
}

/** Every part of the homepage's view, empty: a block fills in the parts its component reads. */
function homeBase(ctx: RenderContext): HomeView {
  const { locale, hrefOf } = ctx;
  const none = placeholderImage("No photo chosen yet");
  return {
    locale,
    links: {
      quote: hrefOf(locale, "contact", { hash: "quote" }),
      about: hrefOf(locale, "about"),
      services: hrefOf(locale, "services"),
      projects: hrefOf(locale, "projects"),
      capabilities: hrefOf(locale, "capabilities"),
      clients: hrefOf(locale, "clients"),
      industries: hrefOf(locale, "industries"),
      certificates: hrefOf(locale, "certificates"),
    },
    hero: { eyebrow: "", headline: [], sub: "", primary: "", secondary: "", location: "", image: none, plate: { part: "", sequence: "" } },
    metrics: [],
    statements: [],
    pillars: [],
    about: {
      label: "",
      statement: "",
      paragraphs: [],
      link: "",
      workshop: none,
      visionLabel: "",
      vision: "",
      servicesLink: "",
      beyond: { label: "", title: "", items: [], link: "", href: "#about" },
      whyLabel: "",
    },
    services: { label: "", title: "", intro: "", open: "", all: "", items: [] },
    machinery: { label: "", title: "", intro: "", power: "", service: "", all: "", items: [] },
    projects: { label: "", title: "", intro: "", all: "", cta: "", items: [] },
    industries: { label: "", title: "", all: "", note: "", items: [], basis: { profile: "", inferred: "" } },
    clients: { label: "", title: "", intro: "", all: "", colours: "", note: "", listLabel: "", items: [] },
    compliance: { label: "", title: "", note: "", all: "", items: [] },
    cta: { label: "", title: "", steps: [], whatsapp: "", image: none },
  };
}

/** A figure as the homepage shows it: its value (settings) and its label and unit (the preview's language). */
function figure({ section }: BlockProps, repeater: string, index: number, slug: string): HomeView["metrics"][number] {
  const item = itemsOf<{ value?: string }>(section.settings, repeater)[index];
  if (!item) return { slug, value: "", unit: undefined, label: "" };
  return { slug, value: item.value ?? "", unit: itemText(section.content, repeater, item.id, "unit") || undefined, label: itemText(section.content, repeater, item.id, "label") };
}

/** A service as the homepage's cards and strip show it (photos only where `photos`: the strip shows none). */
function serviceItem(record: PreviewService, ctx: RenderContext, notes: string[], photos: boolean): HomeView["services"]["items"][number] {
  const label = recordLabel(record.name, record.slug);
  if (!(record.slug in serviceIcon)) notes.push(`The service “${label}” has no icon, colour or card tag of its own on the homepage: they follow the six services the site was built with.`);
  const name = recordText(record.name, ctx, notes, "service", label);
  const image = (id: string | null, alt: Loc<string>, what: string) => {
    if (!photos || !id) return undefined;
    const problem = imageProblem(id, ctx);
    if (problem) notes.push(`The service “${label}”: its ${what} is shown as a placeholder (${problem}).`);
    return commerceImage(id, ctx, alt[ctx.locale] ?? "");
  };
  return {
    slug: record.slug as ServiceSlug,
    name,
    tagline: record.tagline[ctx.locale] ?? "",
    highlights: record.highlights[ctx.locale] ?? [],
    href: ctx.hrefOf(ctx.locale, "service", { slug: record.slug }),
    image: image(record.cover, record.coverAlt, "cover photo"),
    support: image(record.supporting, record.supportingAlt, "supporting photo"),
  };
}

function heroModel(props: BlockProps): Model {
  const { section, ctx } = props;
  const view = homeBase(ctx);
  const c = section.content;
  view.metrics = [figure(props, "figures", 0, "peak-laser-power"), figure(props, "figures", 1, "service-lines")];
  view.statements = itemsOf(section.settings, "statements")
    .map((item) => ({ title: itemText(c, "statements", item.id, "title"), body: "" }))
    .filter((s) => s.title);
  view.hero = {
    eyebrow: textOf(c, "eyebrow"),
    headline: linesOf(c, "headline"),
    sub: textOf(c, "sub"),
    primary: textOf(c, "primary"),
    secondary: textOf(c, "secondary"),
    location: textOf(c, "location"),
    image: commerceImage(section.settings.media as string | undefined, ctx, textOf(c, "photoAlt")),
    plate: { part: textOf(c, "platePart"), sequence: textOf(c, "plateSequence") },
  };
  return { view, notes: [] };
}

function stripModel({ section, ctx }: BlockProps): Model {
  const view = homeBase(ctx);
  const { items, notes } = resolveSelection("service", section.settings.services as SelectionValue | undefined, ctx.records);
  view.services.label = textOf(section.content, "label");
  view.services.items = items.map((record) => serviceItem(record, ctx, notes, false));
  return { view, notes };
}

function aboutModel({ section, ctx }: BlockProps): Model {
  const view = homeBase(ctx);
  const notes: string[] = [];
  const { content: c, settings: s } = section;
  const target = s.beyondTarget as LinkTarget | null | undefined;
  const beyond = resolveLink(target, ctx.locale, ctx.records, ctx.hrefOf);
  if (!target) notes.push("The site support link has no target yet.");
  view.hero.location = textOf(c, "location");
  view.about = {
    label: textOf(c, "label"),
    statement: textOf(c, "statement"),
    paragraphs: [textOf(c, "paragraph")],
    link: textOf(c, "link"),
    workshop: commerceImage(s.media as string | undefined, ctx, textOf(c, "workshopCaption")),
    visionLabel: textOf(c, "visionLabel"),
    vision: textOf(c, "vision"),
    servicesLink: textOf(c, "servicesLink"),
    beyond: {
      label: textOf(c, "beyondLabel"),
      title: textOf(c, "beyondTitle"),
      items: itemsOf(s, "beyond")
        .map((item) => ({ slug: item.id as SupportSlug, label: itemText(c, "beyond", item.id, "label") }))
        .filter((item) => item.label),
      link: textOf(c, "beyondLink"),
      href: beyond?.href ?? "#about",
    },
    whyLabel: textOf(c, "whyLabel"),
  };
  view.pillars = itemsOf(s, "pillars")
    .map((item) => ({ slug: item.id, title: itemText(c, "pillars", item.id, "title"), body: itemText(c, "pillars", item.id, "body") }))
    .filter((p) => p.title || p.body);
  return { view, notes };
}

const SIGNATURES = ["laser-cutting", "laser-engraving"] as const;

function servicesModel(props: BlockProps): Model & { missing: string[] } {
  const { section, ctx } = props;
  const view = homeBase(ctx);
  const { items, notes } = resolveSelection("service", section.settings.services as SelectionValue | undefined, ctx.records);
  const c = section.content;
  view.services = {
    label: textOf(c, "label"),
    title: textOf(c, "title"),
    intro: textOf(c, "intro"),
    open: textOf(c, "open"),
    all: textOf(c, "all"),
    items: items.map((record) => serviceItem(record, ctx, notes, true)),
  };
  view.metrics = [figure(props, "specs", 0, "peak-laser-power"), figure(props, "specs", 1, "bevel-cutting")];
  const missing = SIGNATURES.filter((slug) => !view.services.items.some((s) => s.slug === slug));
  if (missing.length) notes.push("The approved composition needs the Laser Cutting and Laser Engraving services among the chosen ones (their signature cards).");
  return { view, notes, missing };
}

function machineItem(record: PreviewMachine, ctx: RenderContext, notes: string[]): MachineItem {
  const label = recordLabel(record.name, record.slug);
  const name = recordText(record.name, ctx, notes, "machine", label);
  const service = record.service ? ctx.records.services.find((s) => s.id === record.service) : undefined;
  if (!service) notes.push(`The machine “${label}” has no service.`);
  else if (service.archived) notes.push(`The machine “${label}” names the archived service “${recordLabel(service.name, service.slug)}”.`);
  const problem = imageProblem(record.media, ctx);
  if (problem) notes.push(`The machine “${label}”: its photo is shown as a placeholder (${problem}).`);
  return {
    slug: record.slug,
    name,
    shortName: record.shortName[ctx.locale] ?? name,
    category: record.category[ctx.locale] ?? "",
    capability: record.capability[ctx.locale] ?? "",
    power: record.powerWatts ? { value: record.powerWatts.toLocaleString("en-US"), unit: ctx.locale === "ar" ? "واط" : "W" } : undefined,
    service: service ? { name: service.name[ctx.locale] ?? "", href: ctx.hrefOf(ctx.locale, "service", { slug: service.slug }) } : { name: "", href: "#machinery" },
    href: ctx.hrefOf(ctx.locale, "capabilities", { hash: record.slug }),
    image: commerceImage(record.media, ctx, name),
  };
}

function machineryModel({ section, ctx }: BlockProps): Model {
  const view = homeBase(ctx);
  const { items, notes } = resolveSelection("machine", section.settings.machines as SelectionValue | undefined, ctx.records);
  const c = section.content;
  view.machinery = {
    label: textOf(c, "label"),
    title: textOf(c, "title"),
    intro: textOf(c, "intro"),
    power: textOf(c, "power"),
    service: textOf(c, "service"),
    all: textOf(c, "all"),
    items: items.map((record) => machineItem(record, ctx, notes)),
  };
  // The approved component draws its six machines in its own order (frozen): say where a selection differs.
  notes.push(...showcaseNotes(items.map((record) => ({ slug: record.slug, label: recordLabel(record.name, record.slug) }))));
  return { view, notes };
}

/** A project's card photo: its first photo the preview can show; never a restricted project's (A3 flags). */
function projectPhoto(record: PreviewProject, ctx: RenderContext, notes: string[], label: string) {
  // The section's notes already say a restricted project's photos are not shown (`sectionNotes`).
  if (record.restrictions.length) return placeholderImage(["Restricted", ...record.restrictions].join(", "));
  const shown = record.media.find((id) => !imageProblem(id, ctx));
  if (shown) return commerceImage(shown, ctx, "");
  const reason = record.media.length ? (imageProblem(record.media[0], ctx) ?? "Not available") : "No photo yet";
  notes.push(`The project “${label}”: no photo the preview can show (${reason}).`);
  return placeholderImage(reason);
}

function projectsModel({ section, ctx }: BlockProps): Model {
  const view = homeBase(ctx);
  const { items, notes } = resolveSelection("project", section.settings.projects as SelectionValue | undefined, ctx.records);
  const c = section.content;
  const category = (id: string) => ctx.records.categories.find((cat) => cat.id === id)?.label[ctx.locale] ?? "";
  view.projects = {
    label: textOf(c, "label"),
    title: textOf(c, "title"),
    intro: textOf(c, "intro"),
    all: textOf(c, "all"),
    cta: textOf(c, "cta"),
    items: items.map((record) => {
      const label = recordLabel(record.title, record.slug);
      return {
        slug: record.slug,
        title: recordText(record.title, ctx, notes, "project", label),
        categories: record.categories.slice(0, 2).map(category),
        href: ctx.hrefOf(ctx.locale, "projects", { hash: "gallery" }),
        image: projectPhoto(record, ctx, notes, label),
      };
    }),
  };
  return { view, notes };
}

function industriesModel({ section, ctx }: BlockProps): Model {
  const view = homeBase(ctx);
  const { items, notes } = resolveSelection("industry", section.settings.industries as SelectionValue | undefined, ctx.records);
  const c = section.content;
  view.industries = {
    label: textOf(c, "label"),
    title: textOf(c, "title"),
    all: textOf(c, "all"),
    note: textOf(c, "note"),
    items: items.map((record) => {
      const label = recordLabel(record.name, record.slug);
      return {
        slug: record.slug,
        name: recordText(record.name, ctx, notes, "industry", label),
        description: record.description[ctx.locale] ?? "",
        basis: record.classification === "profile_sector" ? ("profile" as const) : ("inferred" as const),
      };
    }),
    basis: { profile: textOf(c, "basisProfile"), inferred: textOf(c, "basisInferred") },
  };
  return { view, notes };
}

function clientsModel({ section, ctx }: BlockProps): Model {
  const view = homeBase(ctx);
  const { items, notes } = resolveSelection("client", section.settings.clients as SelectionValue | undefined, ctx.records);
  const c = section.content;
  view.clients = {
    label: textOf(c, "label"),
    title: textOf(c, "title"),
    intro: textOf(c, "intro"),
    all: textOf(c, "all"),
    colours: textOf(c, "colours"),
    note: textOf(c, "note"),
    listLabel: textOf(c, "listLabel"),
    // The wall shows logos only: a client whose logo the preview cannot show is left out.
    items: items.flatMap((record) => {
      const label = recordLabel(record.name, record.slug);
      const problem = imageProblem(record.logo, ctx);
      if (problem) {
        notes.push(`The client “${label}” is left out: its logo cannot be shown (${problem === "No photo chosen yet" ? "No logo yet" : problem}).`);
        return [];
      }
      const name = recordText(record.name, ctx, notes, "client", label);
      return [{ slug: record.slug, name, logo: commerceImage(record.logo, ctx, name) }];
    }),
  };
  return { view, notes };
}

function complianceModel({ section, ctx }: BlockProps): Model {
  const view = homeBase(ctx);
  const { items, notes } = resolveSelection("certificate", section.settings.certificates as SelectionValue | undefined, ctx.records);
  const c = section.content;
  view.compliance = {
    label: textOf(c, "label"),
    title: textOf(c, "title"),
    note: textOf(c, "note"),
    all: textOf(c, "all"),
    items: items.map((record) => {
      const label = recordLabel(record.title, record.slug);
      return { slug: record.slug, title: recordText(record.title, ctx, notes, "certificate", label), issuer: record.issuer[ctx.locale] ?? "" };
    }),
  };
  return { view, notes };
}

function contactModel({ section, ctx }: BlockProps): Model {
  const view = homeBase(ctx);
  const c = section.content;
  view.cta = {
    label: textOf(c, "label"),
    title: textOf(c, "title"),
    steps: linesOf(c, "steps"),
    whatsapp: textOf(c, "whatsapp"),
    image: commerceImage(section.settings.media as string | undefined, ctx, ""),
  };
  return { view, notes: [] };
}

export const HOME_RENDERERS = {
  "home.hero": (props: BlockProps) => <Hero view={heroModel(props).view} shell={props.ctx.shell} />,
  "home.capability_strip": (props: BlockProps) => <CapabilityStrip view={stripModel(props).view} />,
  "home.about": (props: BlockProps) => <About view={aboutModel(props).view} />,
  "home.services": (props: BlockProps) => {
    const { view, missing } = servicesModel(props);
    if (missing.length) {
      return (
        <InvalidSection
          id={props.section.id}
          label="Services (homepage)"
          problem="the approved composition needs the Laser Cutting and Laser Engraving services among the chosen ones (their signature cards). Add them to this section's services."
        />
      );
    }
    return <Services view={view} />;
  },
  "home.machinery": (props: BlockProps) => <Machinery view={machineryModel(props).view} quote={textOf(props.section.content, "quote")} />,
  "home.projects": (props: BlockProps) => <Projects view={projectsModel(props).view} />,
  "home.industries": (props: BlockProps) => <Industries view={industriesModel(props).view} />,
  "home.clients": (props: BlockProps) => <Clients view={clientsModel(props).view} />,
  "home.compliance": (props: BlockProps) => <Compliance view={complianceModel(props).view} />,
  "home.contact": (props: BlockProps) => <Contact view={contactModel(props).view} shell={props.ctx.shell} />,
} as const;

/** What each homepage block's preview leaves out or stands in for (the builder lists them beside the section). */
export const HOME_NOTES = {
  "home.hero": (props: BlockProps) => heroModel(props).notes,
  "home.capability_strip": (props: BlockProps) => stripModel(props).notes,
  "home.about": (props: BlockProps) => aboutModel(props).notes,
  "home.services": (props: BlockProps) => servicesModel(props).notes,
  "home.machinery": (props: BlockProps) => machineryModel(props).notes,
  "home.projects": (props: BlockProps) => projectsModel(props).notes,
  "home.industries": (props: BlockProps) => industriesModel(props).notes,
  "home.clients": (props: BlockProps) => clientsModel(props).notes,
  "home.compliance": (props: BlockProps) => complianceModel(props).notes,
  "home.contact": (props: BlockProps) => contactModel(props).notes,
} as const;
