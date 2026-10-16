import {
  AboutApproach,
  AboutBeyond,
  AboutClients,
  AboutCompliance,
  AboutMachinery,
  AboutMetal,
  AboutOverview,
  AboutProcess,
  AboutVision,
  AboutWhat,
  AboutWhy,
  AboutWork,
  AboutWorkshop,
} from "@/components/commerce/about/AboutPage";
import { serviceTone } from "@/components/commerce/tones";
import { serviceIcon } from "@/components/commerce/ui";
import type { ServiceSlug } from "@/content/types";
import type { LinkTarget } from "@/server/builder/links";
import type { SelectionValue } from "@/server/builder/fields";
import type { Loc, PreviewService } from "@/server/builder/preview-data";
import { itemsOf, itemText, linesOf, resolveLink, resolveSelection, textOf } from "@/server/builder/view";
import type { BlockProps, BlockSection, RenderContext } from "../context";
import { commerceImage, imageProblem, placeholderImage } from "./images";
import { clientLogos } from "./pages";

/*
 * The About page's thirteen parts (A5 brief §11, §41): the approved components of
 * `src/components/commerce/about/AboutPage.tsx`, drawn from the sections' texts, items and selections and the working
 * records. A part's number (01–13) is its place among the About parts the page shows, as today. Items keep their ids:
 * the icons and colour roles follow today's keys (the process steps, the pillars, the site-support items, the business's
 * two sections "metal" and "scaffolding"), so content brought over with those ids (A9) shows the same, and anything new
 * takes the component's own fallback.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const label = (value: Loc<string>, slug: string) => value.en ?? value.ar ?? slug;
const LANGUAGE = { en: "English", ar: "Arabic" } as const;

const indexOf = (section: BlockSection) => pad(Math.max(section.ordinal, 0) + 1);
const head = (section: BlockSection) => ({ label: textOf(section.content, "label"), title: textOf(section.content, "title"), intro: textOf(section.content, "intro") });

/** A service's number: its place among the services in the collection's order (as today's "01" … "06"). */
function serviceIndex(service: PreviewService, ctx: RenderContext): string {
  const live = ctx.records.services.filter((s) => !s.archived || s.id === service.id);
  return pad(live.findIndex((s) => s.id === service.id) + 1);
}

/** A repeater's items (their settings) with their texts in the chosen language. */
function texts(section: BlockSection, repeater: string, keys: string[]) {
  return itemsOf(section.settings, repeater).map((item) => {
    const t: Record<string, string> = {};
    for (const key of keys) t[key] = itemText(section.content, repeater, item.id, key);
    return { id: item.id, item, t };
  });
}

function OverviewBlock({ section }: BlockProps) {
  const c = section.content;
  return <AboutOverview index={indexOf(section)} label={textOf(c, "label")} title={textOf(c, "title")} paragraphs={linesOf(c, "paragraphs")} />;
}

function WhatBlock({ section }: BlockProps) {
  return (
    <AboutWhat
      index={indexOf(section)}
      head={head(section)}
      divisions={texts(section, "divisions", ["label", "title", "body", "link"]).map(({ id, t }) => ({ slug: id, label: t.label, title: t.title, body: t.body, link: t.link }))}
    />
  );
}

const metalServices = (section: BlockSection, ctx: RenderContext) => resolveSelection("service", section.settings.services as SelectionValue | undefined, ctx.records).items;

function MetalBlock({ section, ctx }: BlockProps) {
  const { locale } = ctx;
  return (
    <AboutMetal
      index={indexOf(section)}
      head={head(section)}
      explore={textOf(section.content, "explore")}
      services={metalServices(section, ctx).map((s) => ({
        slug: s.slug,
        tone: serviceTone[s.slug as ServiceSlug] ?? "steel",
        icon: serviceIcon[s.slug as ServiceSlug] ?? "layers",
        index: serviceIndex(s, ctx),
        name: s.name[locale] ?? "",
        tagline: s.tagline[locale] ?? "",
        highlights: s.highlights[locale] ?? [],
        href: ctx.hrefOf(locale, "service", { slug: s.slug }),
      }))}
    />
  );
}

function BeyondBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const target = resolveLink((section.settings.target as LinkTarget | null | undefined) ?? null, ctx.locale, ctx.records, ctx.hrefOf);
  return (
    <AboutBeyond
      index={indexOf(section)}
      image={commerceImage(section.settings.media as string | undefined, ctx, textOf(c, "photoAlt"))}
      label={textOf(c, "label")}
      title={textOf(c, "title")}
      intro={textOf(c, "intro")}
      items={texts(section, "items", ["label"]).map(({ id, t }) => ({ slug: id, label: t.label }))}
      link={target ? { href: target.href, label: textOf(c, "link") } : undefined}
    />
  );
}

function VisionBlock({ section }: BlockProps) {
  const c = section.content;
  return (
    <AboutVision
      index={indexOf(section)}
      label={textOf(c, "label")}
      statement={textOf(c, "statement")}
      aimsLabel={textOf(c, "aimsLabel")}
      aims={linesOf(c, "aims")}
      closing={textOf(c, "closing")}
    />
  );
}

function ApproachBlock({ section }: BlockProps) {
  return (
    <AboutApproach
      index={indexOf(section)}
      head={head(section)}
      metrics={texts(section, "figures", ["label", "unit"]).map(({ id, item, t }) => ({ slug: id, label: t.label, display: String(item.value ?? ""), unit: t.unit || undefined }))}
      statements={texts(section, "statements", ["title", "body"]).map(({ id, t }) => ({ key: id, title: t.title, body: t.body }))}
    />
  );
}

function ProcessBlock({ section }: BlockProps) {
  return <AboutProcess index={indexOf(section)} head={head(section)} steps={texts(section, "steps", ["title", "body"]).map(({ id, t }) => ({ slug: id, title: t.title, body: t.body }))} />;
}

function WhyBlock({ section }: BlockProps) {
  return <AboutWhy index={indexOf(section)} head={head(section)} pillars={texts(section, "pillars", ["title", "body"]).map(({ id, t }) => ({ slug: id, title: t.title, body: t.body }))} />;
}

function WorkshopBlock({ section, ctx }: BlockProps) {
  return (
    <AboutWorkshop
      index={indexOf(section)}
      head={head(section)}
      photos={texts(section, "photos", ["caption"]).map(({ id, item, t }) => ({ key: id, image: commerceImage(item.media as string | undefined, ctx, ""), caption: t.caption }))}
    />
  );
}

const machinesOf = (section: BlockSection, ctx: RenderContext) => resolveSelection("machine", section.settings.machines as SelectionValue | undefined, ctx.records).items;

function MachineryBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const { locale } = ctx;
  return (
    <AboutMachinery
      index={indexOf(section)}
      head={head(section)}
      link={{ href: ctx.hrefOf(locale, "capabilities"), label: textOf(c, "link") }}
      columns={{ machine: textOf(c, "machine"), type: textOf(c, "type"), power: textOf(c, "power") }}
      notStated={textOf(c, "notStated")}
      machines={machinesOf(section, ctx).map((m) => ({
        slug: m.slug,
        name: m.name[locale] ?? "",
        category: m.category[locale] ?? "",
        powerWatts: m.powerWatts,
        image: commerceImage(m.media, ctx, "", "Machine photo"),
      }))}
    />
  );
}

const workProjects = (section: BlockSection, ctx: RenderContext) => resolveSelection("project", section.settings.projects as SelectionValue | undefined, ctx.records).items;

function WorkBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const { locale } = ctx;
  const category = (id: string) => ctx.records.categories.find((cat) => cat.id === id && !cat.archived)?.label[locale] ?? "";
  return (
    <AboutWork
      index={indexOf(section)}
      head={head(section)}
      link={{ href: ctx.hrefOf(locale, "projects"), label: textOf(c, "link") }}
      refLabel={textOf(c, "refLabel")}
      cardAction={textOf(c, "cardAction")}
      projects={workProjects(section, ctx).map((p) => {
        // Today's card shows the project's first photo; a restricted project shows none (A3 flags).
        const first = p.media.find((id) => !imageProblem(id, ctx)) ?? p.media[0] ?? null;
        return {
          slug: p.slug,
          href: ctx.hrefOf(locale, "projects", { hash: p.slug }),
          image: p.restrictions.length ? placeholderImage(["Restricted", ...p.restrictions].join(", ")) : commerceImage(first, ctx, ""),
          ref: p.ref ?? "",
          title: p.title[locale] ?? "",
          categories: p.categories.slice(0, 2).map(category).filter(Boolean),
          flag: category(p.categories[0] ?? ""),
        };
      })}
    />
  );
}

function ClientsBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  return (
    <AboutClients
      index={indexOf(section)}
      head={head(section)}
      link={{ href: ctx.hrefOf(ctx.locale, "clients"), label: textOf(c, "link") }}
      logos={clientLogos(section, ctx, []).map((logo) => ({ slug: logo.slug, image: logo.image }))}
    />
  );
}

const documentsOf = (section: BlockSection, ctx: RenderContext) => resolveSelection("certificate", section.settings.certificates as SelectionValue | undefined, ctx.records).items;

function ComplianceBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const { locale } = ctx;
  return (
    <AboutCompliance
      index={indexOf(section)}
      head={head(section)}
      link={{ href: ctx.hrefOf(locale, "certificates"), label: textOf(c, "link") }}
      note={textOf(c, "note")}
      documents={documentsOf(section, ctx).map((cert) => ({
        slug: cert.slug,
        title: cert.title[locale] ?? "",
        issuer: cert.issuer[locale] ?? "",
        thumb: commerceImage(cert.thumb, ctx, "", "Preview"),
      }))}
    />
  );
}

export const ABOUT_RENDERERS = {
  "about.overview": OverviewBlock,
  "about.what": WhatBlock,
  "about.metal": MetalBlock,
  "about.beyond": BeyondBlock,
  "about.vision": VisionBlock,
  "about.approach": ApproachBlock,
  "about.process": ProcessBlock,
  "about.why": WhyBlock,
  "about.workshop": WorkshopBlock,
  "about.machinery": MachineryBlock,
  "about.work": WorkBlock,
  "about.clients": ClientsBlock,
  "about.compliance": ComplianceBlock,
} as const;

const none = (what: string) => `no ${what} yet.`;

export const ABOUT_ABSENT = {
  "about.what": ({ section }: BlockProps) => (itemsOf(section.settings, "divisions").length ? null : none("sections of the business are listed")),
  "about.metal": ({ section, ctx }: BlockProps) => (metalServices(section, ctx).length ? null : "no services are chosen (or every chosen one is archived)."),
  "about.approach": ({ section }: BlockProps) => (itemsOf(section.settings, "figures").length || itemsOf(section.settings, "statements").length ? null : none("figures or statements are listed")),
  "about.process": ({ section }: BlockProps) => (itemsOf(section.settings, "steps").length ? null : none("steps are listed")),
  "about.why": ({ section }: BlockProps) => (itemsOf(section.settings, "pillars").length ? null : none("pillars are listed")),
  "about.workshop": ({ section }: BlockProps) => (itemsOf(section.settings, "photos").length ? null : none("photos are chosen")),
  "about.machinery": ({ section, ctx }: BlockProps) => (machinesOf(section, ctx).length ? null : "no machines are chosen (or every chosen one is archived)."),
  "about.work": ({ section, ctx }: BlockProps) => (workProjects(section, ctx).length ? null : "no projects are chosen (or every chosen one is archived)."),
  "about.clients": ({ section, ctx }: BlockProps) => (clientLogos(section, ctx, []).length ? null : "no client with a logo that may be shown is chosen."),
  "about.compliance": ({ section, ctx }: BlockProps) => (documentsOf(section, ctx).length ? null : "no documents are chosen (or every chosen one is archived)."),
} as const;

export const ABOUT_NOTES = {
  "about.what": ({ section }: BlockProps) =>
    itemsOf(section.settings, "divisions")
      .filter((d) => d.id !== "metal" && d.id !== "scaffolding")
      .map((d) => `The card “${itemText(section.content, "divisions", d.id, "title") || d.id}” is drawn as the site-support card and opens that part (#beyond): only the card brought over as “metal” opens the metal services.`),
  "about.metal": ({ section, ctx }: BlockProps) =>
    metalServices(section, ctx).flatMap((s) => {
      const notes: string[] = [];
      if (!(s.slug in serviceIcon)) notes.push(`The service “${label(s.name, s.slug)}” has no icon or colour of its own here: they follow the six services the site was built with.`);
      if (!s.name[ctx.locale]) notes.push(`The service “${label(s.name, s.slug)}” has no ${LANGUAGE[ctx.locale]} name yet.`);
      return notes;
    }),
  "about.beyond": ({ section, ctx }: BlockProps) =>
    resolveLink((section.settings.target as LinkTarget | null | undefined) ?? null, ctx.locale, ctx.records, ctx.hrefOf) ? [] : ["The link has no target yet, so it is not shown."],
  "about.machinery": ({ section, ctx }: BlockProps) =>
    machinesOf(section, ctx).flatMap((m) => (imageProblem(m.media, ctx) ? [`The machine “${label(m.name, m.slug)}”: its photo is shown as a placeholder (${imageProblem(m.media, ctx)}).`] : [])),
  "about.work": ({ section, ctx }: BlockProps) =>
    workProjects(section, ctx).flatMap((p) =>
      !p.restrictions.length && !p.media.some((id) => !imageProblem(id, ctx))
        ? [`The project “${label(p.title, p.slug)}”: no photo the preview can show (${p.media.length ? (imageProblem(p.media[0], ctx) ?? "Not available") : "No photo yet"}).`]
        : [],
    ),
  "about.clients": ({ section, ctx }: BlockProps) => {
    const notes: string[] = [];
    clientLogos(section, ctx, notes);
    return notes;
  },
  "about.compliance": ({ section, ctx }: BlockProps) =>
    documentsOf(section, ctx).flatMap((cert) => (imageProblem(cert.thumb, ctx) ? [`The document “${label(cert.title, cert.slug)}”: its thumbnail is shown as a placeholder (${imageProblem(cert.thumb, ctx)}).`] : [])),
} as const;
