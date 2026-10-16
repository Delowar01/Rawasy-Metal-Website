/**
 * What a section shows (A5 brief §16, §23–§25, §43, §49–§53): the pure steps between a section's validated data and its
 * renderer — the design inspector's values as the attributes `src/components/builder/blocks.css` styles (with the
 * effective value at every screen size), a record selection resolved against the working records (manual order kept,
 * automatic modes applied, archived and missing records left out with a note), a link target resolved to its address,
 * the texts of one language, and the notes the preview shows about a section (media that cannot be delivered,
 * withheld project photos, archived or missing records, links to them).
 *
 * Pure: the preview's renderers, the bridge's notes and the unit tests share it. Addresses come from a function the
 * caller passes (the site's route table), so this module stays framework-free.
 */
import type { BlockDefinition } from "./block.ts";
import type { DesignSpec, DesignValues, Gap, MediaPosition, Padding, Tone as DesignTone } from "./design.ts";
import type { Content, ItemSettingsField, Locale, SelectableEntity, SelectionValue, Settings, SettingsField } from "./fields.ts";
import { describeTarget, type LinkTarget, type SystemLinkKey } from "./links.ts";
import type { Loc, PreviewMedia, PreviewRecords } from "./preview-data.ts";

// --- Design → attributes -------------------------------------------------------------------------------------------------

/** The MC tone attribute of a design tone (`orange-accent` is the brand's ink, `data-tone="brand"`). */
export const toneAttr = (tone: DesignTone | undefined): "brand" | "steel" | "teal" | "brass" | undefined =>
  tone === "orange-accent" ? "brand" : tone;

export interface DesignView {
  /** `data-*` attributes for the section (padding, alignment, width, measure, tone, columns, gap, media position). */
  attrs: Record<string, string>;
  surface: "plain" | "muted" | "raised" | "dark";
  heading: 2 | 3 | 4;
  /** What the cards and figures carry: `data-border`, `data-radius`, `data-shadow`. */
  frame: Record<string, string>;
  motion: { preset: "none" | "reveal" | "fade" | "slide" | "scale" | "stagger"; duration: "1" | "2" | "3" | "4"; delay: number };
}

const firstOf = <T>(...values: (T | undefined)[]) => values.find((v) => v !== undefined);

/**
 * The effective design of a section at each screen size. Desktop is the base; a tablet (≤ 1023 px) or phone (≤ 639 px)
 * override wins where set; otherwise columns step down (a tablet shows at most two, a phone one), a side-by-side photo
 * goes above the text on a phone, and everything else keeps the larger screen's value.
 */
export function designView(spec: DesignSpec, values: DesignValues | undefined): DesignView {
  const v = values ?? {};
  const r = v.responsive ?? {};
  const attrs: Record<string, string> = {};
  const set = (name: string, desktop: string | number | undefined, tablet: string | number | undefined, mobile: string | number | undefined) => {
    if (desktop === undefined) return;
    attrs[`data-${name}`] = String(desktop);
    attrs[`data-${name}-t`] = String(tablet ?? desktop);
    attrs[`data-${name}-m`] = String(mobile ?? tablet ?? desktop);
  };
  if (spec.columns?.length) {
    const desktop = v.columns ?? Math.max(...spec.columns);
    const tablet = r.tablet?.columns ?? Math.min(desktop, 2);
    const mobile = r.mobile?.columns ?? 1;
    set("cols", desktop, tablet, mobile);
  }
  if (spec.gap) set("gap", v.gap ?? "md", r.tablet?.gap, r.mobile?.gap as Gap | undefined);
  if (spec.padding) set("pad", v.padding ?? "md", r.tablet?.padding, r.mobile?.padding as Padding | undefined);
  if (spec.align) set("align", v.align ?? "start", r.tablet?.align, r.mobile?.align);
  if (spec.mediaPosition?.length) {
    const desktop = v.mediaPosition ?? spec.mediaPosition[0];
    const tablet = r.tablet?.mediaPosition ?? desktop;
    const side = (p: MediaPosition) => p === "start" || p === "end";
    const mobile = r.mobile?.mediaPosition ?? (side(tablet) ? "top" : tablet);
    set("media", desktop, tablet, mobile);
  }
  if (spec.width) attrs["data-width"] = v.width ?? "shell";
  if (spec.measure) attrs["data-measure"] = v.measure ?? "normal";
  const tone = toneAttr(v.tone);
  if (spec.tone && tone) attrs["data-tone"] = tone;
  const frame: Record<string, string> = {};
  if (spec.border) frame["data-border"] = v.border ?? "subtle";
  if (spec.radius) frame["data-radius"] = v.radius ?? "card";
  if (spec.shadow) frame["data-shadow"] = v.shadow ?? "none";
  const motion = spec.motion ? (v.motion ?? { preset: "none" as const, duration: "3" as const, delay: 0 }) : { preset: "none" as const, duration: "3" as const, delay: 0 };
  return {
    attrs,
    surface: firstOf(v.surface, spec.surfaces?.[0]) ?? "plain",
    heading: v.heading ?? 2,
    frame,
    motion: { preset: motion.preset, duration: motion.duration, delay: Number(motion.delay) || 0 },
  };
}

// --- Texts ------------------------------------------------------------------------------------------------------------------

/** A text field of the chosen language ("" when the language has no text). */
export const textOf = (content: Content | null | undefined, key: string): string => {
  const value = content?.[key];
  return typeof value === "string" ? value : "";
};

/** A lines field of the chosen language. */
export const linesOf = (content: Content | null | undefined, key: string): string[] => {
  const value = content?.[key];
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === "string" && line !== "") : [];
};

/** A repeated item's text in the chosen language. */
export const itemText = (content: Content | null | undefined, repeater: string, id: string, key: string): string => {
  const map = content?.[repeater] as Record<string, Record<string, unknown>> | undefined;
  const value = map?.[id]?.[key];
  return typeof value === "string" ? value : "";
};

/** A repeated item's raw value in the chosen language (rich text, lines). */
export const itemValue = (content: Content | null | undefined, repeater: string, id: string, key: string): unknown =>
  (content?.[repeater] as Record<string, Record<string, unknown>> | undefined)?.[id]?.[key];

/** The items of a repeater, in their order (settings). */
export const itemsOf = <T extends Record<string, unknown> = Record<string, unknown>>(settings: Settings, key: string): (T & { id: string })[] =>
  ((settings[key] as (T & { id: string })[] | undefined) ?? []).filter((item) => item && typeof item.id === "string");

/** A record's text in the chosen language. */
export const locText = <T>(value: Loc<T>, locale: Locale): T | null => value[locale];

// --- Selections ----------------------------------------------------------------------------------------------------------------

export type EntityRecord<E extends SelectableEntity> = E extends "service"
  ? PreviewRecords["services"][number]
  : E extends "project"
    ? PreviewRecords["projects"][number]
    : E extends "machine"
      ? PreviewRecords["machines"][number]
      : E extends "client"
        ? PreviewRecords["clients"][number]
        : E extends "certificate"
          ? PreviewRecords["certificates"][number]
          : PreviewRecords["industries"][number];

const COLLECTION: Record<SelectableEntity, keyof PreviewRecords> = {
  service: "services",
  project: "projects",
  machine: "machines",
  client: "clients",
  certificate: "certificates",
  industry: "industries",
};

const NOUN: Record<SelectableEntity, string> = {
  service: "service",
  project: "project",
  machine: "machine",
  client: "client",
  certificate: "certificate",
  industry: "industry",
};

/** A record's name as notes give it (English first, then Arabic, then its slug). */
function recordName(record: { slug: string } & Record<string, unknown>): string {
  for (const key of ["name", "title", "label"]) {
    const value = record[key] as Loc<string> | undefined;
    if (value && (value.en || value.ar)) return (value.en ?? value.ar)!;
  }
  return record.slug;
}

export interface Resolved<T> {
  items: T[];
  notes: string[];
}

/**
 * The records a selection shows, in order: a manual list keeps its order (missing ids and archived records are left
 * out, each with a note); an automatic one takes the collection's order (featured only, or one project category) up to
 * its limit, never an archived record.
 */
export function resolveSelection<E extends SelectableEntity>(entity: E, value: SelectionValue | undefined, records: PreviewRecords): Resolved<EntityRecord<E>> {
  const all = records[COLLECTION[entity]] as unknown as (EntityRecord<E> & { id: string; slug: string; archived: boolean })[];
  const notes: string[] = [];
  if (!value) return { items: [], notes };
  if (value.mode === "manual") {
    const items: EntityRecord<E>[] = [];
    for (const id of value.ids) {
      const record = all.find((r) => r.id === id);
      if (!record) {
        notes.push(`A chosen ${NOUN[entity]} no longer exists and is left out.`);
        continue;
      }
      if (record.archived) {
        notes.push(`The ${NOUN[entity]} “${recordName(record as never)}” is archived and is left out.`);
        continue;
      }
      items.push(record);
    }
    return { items, notes };
  }
  let pool = all.filter((r) => !r.archived);
  if (value.source === "featured") pool = pool.filter((r) => (r as { featured?: boolean }).featured === true);
  if (value.source === "category") pool = pool.filter((r) => ((r as { categories?: string[] }).categories ?? []).includes(value.categoryId ?? ""));
  return { items: pool.slice(0, value.limit), notes };
}

/**
 * The machines the homepage's showcase draws, in its order: `src/components/commerce/home/Machinery.tsx`, frozen since
 * TM-1 (a public test pins its bytes), draws only these six — the flagship lasers first, then bending and welding —
 * whatever a selection holds. `tests/unit/builder-renderers.test.ts` keeps this list equal to the component's.
 */
export const HOME_SHOWCASE_MACHINES = ["fiber-laser-combo-12kw", "tube-cutting-12kw", "fiber-laser-6kw", "fiber-laser-3kw", "cnc-press-brake", "laser-welding"] as const;

/** The notes for a homepage machinery selection the frozen showcase draws otherwise: machines it leaves out, an order it does not keep. */
export function showcaseNotes(chosen: readonly { slug: string; label: string }[]): string[] {
  const order: readonly string[] = HOME_SHOWCASE_MACHINES;
  const notes: string[] = [];
  const outside = chosen.filter((machine) => !order.includes(machine.slug));
  if (outside.length) {
    notes.push(`The homepage showcase draws only its six approved machines: ${outside.map((machine) => `“${machine.label}”`).join(", ")} ${outside.length === 1 ? "is" : "are"} not shown.`);
  }
  const inside = chosen.filter((machine) => order.includes(machine.slug)).map((machine) => machine.slug);
  if (inside.join() !== order.filter((slug) => inside.includes(slug)).join()) {
    notes.push("The homepage showcase draws its machines in its approved order (the flagship lasers first, then bending and welding), not in the order chosen.");
  }
  return notes;
}

// --- Links ------------------------------------------------------------------------------------------------------------------------

/** The site's route keys a system link names (`links.ts` keys are the route table's own keys). */
export type RouteHref = (locale: Locale, key: SystemLinkKey | "service" | "project", params?: { slug?: string; hash?: string }) => string;

export interface ResolvedLink {
  href: string;
  external: boolean;
  /** Why the preview warns about this link (an archived or missing target), or null. */
  note: string | null;
}

/**
 * A link target's address in the chosen language: a page of the site by its route, a service or project page by the
 * record's current slug, a machine by its place on Capabilities, a generic page by the address A9 will give it
 * (`/<locale>/<slug>`), a section of this page by its anchor; external, email and phone addresses only from their
 * validated values. A target that no longer exists resolves to nothing (the button or link is left out).
 */
export function resolveLink(target: LinkTarget | null | undefined, locale: Locale, records: PreviewRecords, hrefOf: RouteHref): ResolvedLink | null {
  if (!target) return null;
  const archivedNote = (noun: string, name: string) => `This link opens the archived ${noun} “${name}”.`;
  switch (target.type) {
    case "system":
      return { href: hrefOf(locale, target.key, target.anchor ? { hash: target.anchor } : undefined), external: false, note: null };
    case "page": {
      const page = records.pages.find((p) => p.id === target.id);
      if (!page) return null;
      const base = `/${locale}/${page.slug}`;
      return { href: target.anchor ? `${base}#${target.anchor}` : base, external: false, note: page.archived ? archivedNote("page", page.title.en ?? page.slug) : null };
    }
    case "service": {
      const service = records.services.find((s) => s.id === target.id);
      if (!service) return null;
      return {
        href: hrefOf(locale, "service", { slug: service.slug, ...(target.anchor ? { hash: target.anchor } : {}) }),
        external: false,
        note: service.archived ? archivedNote("service", service.name.en ?? service.slug) : null,
      };
    }
    case "project": {
      const project = records.projects.find((p) => p.id === target.id);
      if (!project) return null;
      return { href: hrefOf(locale, "project", { slug: project.slug }), external: false, note: project.archived ? archivedNote("project", project.title.en ?? project.slug) : null };
    }
    case "machine": {
      const machine = records.machines.find((m) => m.id === target.id);
      if (!machine) return null;
      return { href: hrefOf(locale, "capabilities", { hash: machine.slug }), external: false, note: machine.archived ? archivedNote("machine", machine.name.en ?? machine.slug) : null };
    }
    case "anchor":
      return { href: `#${target.anchor}`, external: false, note: null };
    case "external":
      return { href: target.url, external: true, note: null };
    case "email":
      return { href: `mailto:${target.address}`, external: false, note: null };
    case "phone":
      return { href: `tel:${target.number.replace(/[ -]/g, "")}`, external: false, note: null };
  }
}

// --- Media --------------------------------------------------------------------------------------------------------------------------

/** Why a media item shows as a placeholder in the preview, or null when it is delivered. */
export function mediaProblem(id: string | null | undefined, media: ReadonlyMap<string, PreviewMedia>): string | null {
  if (!id) return null;
  const item = media.get(id);
  if (!item) return "Not available";
  return item.ok ? null : item.reason;
}

// --- Notes ------------------------------------------------------------------------------------------------------------------------

/**
 * The preview's notes about one section, from its declared fields (so every block, bespoke or generic, is covered by
 * one walk): chosen media that cannot be delivered, records left out of a selection, projects whose photos are withheld,
 * links whose target is archived or gone.
 */
export function sectionNotes(def: BlockDefinition, settings: Settings, locale: Locale, ctx: { records: PreviewRecords; media: ReadonlyMap<string, PreviewMedia>; hrefOf: RouteHref }): string[] {
  const notes = new Set<string>();
  const visit = (field: SettingsField | ItemSettingsField, value: unknown, where: string) => {
    if (field.kind === "media" && typeof value === "string") {
      const problem = mediaProblem(value, ctx.media);
      if (problem) notes.add(`${where}: shown as a placeholder (${problem}).`);
    } else if (field.kind === "selection") {
      const resolved = resolveSelection(field.entity, value as SelectionValue | undefined, ctx.records);
      resolved.notes.forEach((note) => notes.add(note));
      if (field.entity === "project") {
        for (const project of resolved.items as PreviewRecords["projects"]) {
          if (project.restrictions.length) notes.add(`The project “${project.title.en ?? project.slug}” is restricted (${project.restrictions.join(", ")}): its photos are not shown.`);
        }
      }
    } else if (field.kind === "link" && value) {
      const target = value as LinkTarget;
      const resolved = resolveLink(target, locale, ctx.records, ctx.hrefOf);
      if (!resolved) notes.add(`${where}: the link's target (${describeTarget(target)}) no longer exists; the link is left out.`);
      else if (resolved.note) notes.add(resolved.note);
    }
  };
  for (const [key, field] of Object.entries(def.settings)) {
    if (field.kind === "items") {
      itemsOf(settings, key).forEach((item, i) => {
        for (const [k, sub] of Object.entries(field.settings)) visit(sub, item[k], `${field.label}, ${field.one} ${i + 1}`);
      });
    } else visit(field, settings[key], field.label ?? key);
  }
  return [...notes];
}
