import { ConsoleSection, PowerSection, RegisterSection, ServiceLinesSection, SourceSection } from "@/components/commerce/capabilities/CapabilitiesPage";
import { SCHEMATIC, type CapabilitiesView, type CapabilityMachine, type SchematicKind } from "@/components/commerce/capabilities/data";
import { serviceIcon } from "@/components/commerce/ui";
import type { MachineSlug, ServiceSlug } from "@/content/types";
import type { SelectionValue } from "@/server/builder/fields";
import type { Loc, PreviewMachine } from "@/server/builder/preview-data";
import { resolveSelection, textOf } from "@/server/builder/view";
import type { BlockProps, BlockSection, RenderContext } from "../context";
import { commerceImage, imageProblem } from "./images";

/*
 * The Capabilities page's blocks (A5 brief §11, §41): the rated power, the machinery console, the technical register,
 * the service lines and the source note — the approved components of `src/components/commerce/capabilities/*`, drawn
 * from the sections' texts and the working machine records. A machine's number is its place in the machines' collection
 * order (as today's "01" … "06" are its place in the page's order), so every part of the page numbers it alike. The page
 * never states a figure a record does not hold: power only where the record has one.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const label = (value: Loc<string>, slug: string) => value.en ?? value.ar ?? slug;

/** No sketch: an unknown kind draws an empty (aria-hidden) frame. */
const NO_SKETCH = "none" as SchematicKind;

/** A machine as the page's components show it, from its working record (the block's texts give the unit and the source line). */
function machineView(record: PreviewMachine, ctx: RenderContext, texts: { unit: string; sourceLine: string }): CapabilityMachine {
  const { locale } = ctx;
  const live = ctx.records.machines.filter((m) => !m.archived);
  const service = record.service ? ctx.records.services.find((s) => s.id === record.service && !s.archived) : undefined;
  const name = record.name[locale] ?? "";
  return {
    slug: record.slug as MachineSlug,
    index: pad(live.findIndex((m) => m.id === record.id) + 1),
    name,
    shortName: record.shortName[locale] ?? name,
    category: record.category[locale] ?? "",
    capability: record.capability[locale] ?? "",
    power: record.powerWatts ? { value: record.powerWatts.toLocaleString("en-US"), unit: texts.unit } : undefined,
    service: service
      ? { slug: service.slug as ServiceSlug, name: service.name[locale] ?? "", href: ctx.hrefOf(locale, "service", { slug: service.slug }) }
      : { slug: "" as ServiceSlug, name: "", href: ctx.hrefOf(locale, "services") },
    href: ctx.hrefOf(locale, "capabilities", { hash: record.slug }),
    image: commerceImage(record.media, ctx, name, "Machine photo"),
    source: texts.sourceLine && record.sourcePages ? texts.sourceLine.replace("{n}", record.sourcePages) : "",
    schematic: SCHEMATIC[record.slug as MachineSlug] ?? NO_SKETCH,
  };
}

/** The machines a section shows (its `machines` selection), in the selection's order. */
export function machinesOf(section: BlockSection, ctx: RenderContext, texts: { unit: string; sourceLine?: string }): CapabilityMachine[] {
  const { items } = resolveSelection("machine", section.settings.machines as SelectionValue | undefined, ctx.records);
  return items.map((record) => machineView(record, ctx, { unit: texts.unit, sourceLine: texts.sourceLine ?? "" }));
}

/** The hero's facts, from the machines it shows: how many, how many cut by laser, and the peak rated power. */
export function machineFacts(machines: CapabilityMachine[], unit: string): CapabilitiesView["facts"] {
  const peak = Math.max(0, ...machines.map((m) => (m.power ? Number(m.power.value.replace(/,/g, "")) : 0)));
  return {
    machines: machines.length,
    laser: machines.filter((m) => m.service.slug === "laser-cutting").length,
    peak: peak ? { value: peak.toLocaleString("en-US"), unit } : undefined,
  };
}

/** What the preview cannot show of the machines a section names (photos, sketches, services). */
export function machineNotes(section: BlockSection, ctx: RenderContext, sketches: boolean): string[] {
  const { items } = resolveSelection("machine", section.settings.machines as SelectionValue | undefined, ctx.records);
  return items.flatMap((m) => {
    const notes: string[] = [];
    const name = label(m.name, m.slug);
    const problem = imageProblem(m.media, ctx);
    if (problem) notes.push(`The machine “${name}”: its photo is shown as a placeholder (${problem}).`);
    if (!m.name[ctx.locale]) notes.push(`The machine “${name}” has no ${ctx.locale === "ar" ? "Arabic" : "English"} name yet.`);
    if (!m.service || !ctx.records.services.some((s) => s.id === m.service && !s.archived)) notes.push(`The machine “${name}” has no service: its service link opens the services overview.`);
    if (sketches && !(m.slug in SCHEMATIC)) notes.push(`The machine “${name}” has no process sketch of its own (the sketches follow the six machines the site was built with): its stage shows none.`);
    return notes;
  });
}

const head = (section: BlockSection) => ({ label: textOf(section.content, "label"), title: textOf(section.content, "title"), intro: textOf(section.content, "intro") });

function PowerBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  return <PowerSection head={head(section)} machines={machinesOf(section, ctx, { unit: textOf(c, "unit") })} caption={textOf(c, "chart")} notStated={textOf(c, "notStated")} />;
}

function ConsoleBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  return (
    <ConsoleSection
      head={head(section)}
      machines={machinesOf(section, ctx, { unit: textOf(c, "unit"), sourceLine: textOf(c, "sourceLine") })}
      quote={ctx.hrefOf(ctx.locale, "contact", { hash: "quote" })}
      labels={{
        list: textOf(c, "list"),
        showing: textOf(c, "showing"),
        schematic: textOf(c, "schematic"),
        power: textOf(c, "power"),
        service: textOf(c, "service"),
        source: textOf(c, "source"),
        notStated: textOf(c, "notStated"),
        quote: textOf(c, "quote"),
        serviceLink: textOf(c, "serviceLink"),
      }}
    />
  );
}

function RegisterBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  return (
    <RegisterSection
      head={head(section)}
      machines={machinesOf(section, ctx, { unit: textOf(c, "unit"), sourceLine: textOf(c, "sourceLine") })}
      labels={{
        caption: textOf(c, "caption"),
        number: textOf(c, "number"),
        machine: textOf(c, "machine"),
        type: textOf(c, "type"),
        power: textOf(c, "power"),
        service: textOf(c, "service"),
        source: textOf(c, "source"),
        notStated: textOf(c, "notStated"),
      }}
    />
  );
}

/** The service lines the machines support, in the order the machines first name them (as today). */
function serviceLines(machines: CapabilityMachine[], ctx: RenderContext): CapabilitiesView["services"] {
  const slugs = [...new Set(machines.map((m) => m.service.slug).filter(Boolean))];
  return slugs.flatMap((slug) => {
    const record = ctx.records.services.find((s) => s.slug === slug && !s.archived);
    if (!record) return [];
    return [
      {
        slug,
        name: record.name[ctx.locale] ?? "",
        tagline: record.tagline[ctx.locale] ?? "",
        href: ctx.hrefOf(ctx.locale, "service", { slug }),
        machines: machines.filter((m) => m.service.slug === slug),
      },
    ];
  });
}

function ServiceLinesBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const machines = machinesOf(section, ctx, { unit: "" });
  return <ServiceLinesSection head={head(section)} machinesLabel={textOf(c, "machines")} open={textOf(c, "open")} services={serviceLines(machines, ctx)} />;
}

function SourceBlock({ section }: BlockProps) {
  const c = section.content;
  return <SourceSection label={textOf(c, "label")} title={textOf(c, "title")} body={textOf(c, "body")} />;
}

const NO_MACHINES = "no machines are chosen (or every chosen one is archived).";
const hasMachines = ({ section, ctx }: BlockProps) => resolveSelection("machine", section.settings.machines as SelectionValue | undefined, ctx.records).items.length > 0;

export const CAPABILITIES_RENDERERS = {
  "capabilities.power": PowerBlock,
  "capabilities.console": ConsoleBlock,
  "capabilities.register": RegisterBlock,
  "capabilities.service_lines": ServiceLinesBlock,
  "capabilities.source": SourceBlock,
} as const;

export const CAPABILITIES_ABSENT = {
  "capabilities.power": (props: BlockProps) => (hasMachines(props) ? null : NO_MACHINES),
  "capabilities.console": (props: BlockProps) => (hasMachines(props) ? null : NO_MACHINES),
  "capabilities.register": (props: BlockProps) => (hasMachines(props) ? null : NO_MACHINES),
  "capabilities.service_lines": (props: BlockProps) =>
    serviceLines(machinesOf(props.section, props.ctx, { unit: "" }), props.ctx).length ? null : "none of the chosen machines has a service to list.",
} as const;

export const CAPABILITIES_NOTES = {
  "capabilities.power": ({ section, ctx }: BlockProps) => machineNotes(section, ctx, false).filter((n) => !n.includes("photo")),
  "capabilities.console": ({ section, ctx }: BlockProps) => machineNotes(section, ctx, true),
  "capabilities.register": ({ section, ctx }: BlockProps) => machineNotes(section, ctx, false).filter((n) => !n.includes("photo")),
  "capabilities.service_lines": ({ section, ctx }: BlockProps) =>
    serviceLines(machinesOf(section, ctx, { unit: "" }), ctx).flatMap((s) =>
      s.slug in serviceIcon ? [] : [`The service “${s.name || s.slug}” has no icon or colour of its own here: they follow the six services the site was built with.`],
    ),
} as const;
