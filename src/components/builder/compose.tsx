import type { ReactNode } from "react";
import { serviceTone as SERVICE_TONES } from "@/components/commerce/tones";
import type { Tone } from "@/components/commerce/types";
import type { PreviewSection } from "@/server/builder/preview";
import type { BlockProps, BlockSection, LayoutFacts, RenderContext } from "./context";
import { isRenderedBlock, type RenderedBlock } from "./keys";

/*
 * The preview's composition (A5 brief §36, §41): what the approved pages do around their sections, done for a layout of
 * blocks — a section whose content is missing shows nothing (a service without machines has no machinery section), the
 * numbered sections take their numbers and a service page's sections their alternating surfaces from their place among
 * the sections the page shows, and sections that share one approved frame are drawn in it together (the homepage's
 * clients and compliance on one sheet, the legal text in its band, the sectors and their note in one section).
 */

/** Why a block shows nothing on this page (its content is missing), or null. Reads the section's data and the records only. */
export type Presence = (props: BlockProps) => string | null;

/** A section as the page composes it. */
export interface Placed {
  section: PreviewSection;
  /** Why the section shows nothing here (drawn as a note in the preview), or null. */
  absent: string | null;
  ordinal: number;
}

/** The kinds of numbered sections: a service page's sections, the About parts, the legal sections. */
const SERVICE_NUMBERED = new Set(["service.overview", "service.scope", "service.process", "service.machines", "service.applications", "service.gallery", "service.why", "service.related", "service.projects"]);
/** The Projects overview numbers its highlights, gallery and index (01–03); the featured project carries no number. */
const PROJECTS_NUMBERED = new Set(["projects.highlights", "projects.gallery", "projects.index"]);
const family = (blockType: string): string | null =>
  SERVICE_NUMBERED.has(blockType)
    ? "service"
    : PROJECTS_NUMBERED.has(blockType)
      ? "projects"
      : blockType.startsWith("about.")
        ? "about"
        : blockType === "legal.section"
          ? "legal"
          : null;

/** The page openings whose texts other sections of the page may need (`LayoutFacts.opening`). */
const OPENINGS = new Set(["page.hero", "service.hero", "project.hero"]);

const TONES: ReadonlySet<string> = new Set(["brand", "steel", "teal", "brass"]);

/** A block's section as its renderer receives it. */
export const blockSection = (section: PreviewSection, ordinal: number): BlockSection => ({
  id: section.id,
  blockType: section.blockType,
  anchor: section.anchor,
  settings: section.settings,
  content: section.content,
  ordinal,
});

/**
 * The page's composition: each section's presence and number, and the facts the blocks share (which block types the page
 * shows, a service page's colour role — its opening's choice, else the role today's page gives the service).
 */
export function compose(sections: PreviewSection[], base: Omit<RenderContext, "layout">, presence: Partial<Record<RenderedBlock, Presence>>): { placed: Placed[]; layout: LayoutFacts } {
  const hero = sections.find((s) => s.blockType === "service.hero" && s.state === "ok");
  const chosen = hero?.settings.tone;
  const fallback = base.service ? (SERVICE_TONES as Record<string, Tone>)[base.service.slug] : undefined;
  const serviceTone: Tone | null = typeof chosen === "string" && TONES.has(chosen) ? (chosen as Tone) : base.service ? (fallback ?? "steel") : null;
  const opening = sections.find((s) => OPENINGS.has(s.blockType) && s.state === "ok")?.content ?? null;
  const provisional: RenderContext = { ...base, layout: { present: new Set(), serviceTone, opening } };
  const counters = new Map<string, number>();
  const present = new Set<string>();
  const placed = sections.map((section): Placed => {
    let absent: string | null = null;
    if (section.state === "ok" && isRenderedBlock(section.blockType)) {
      const check = presence[section.blockType];
      try {
        absent = check ? check({ section: blockSection(section, -1), ctx: provisional }) : null;
      } catch {
        absent = null;
      }
    }
    const kind = family(section.blockType);
    let ordinal = -1;
    if (kind && section.state === "ok" && !absent) {
      ordinal = counters.get(kind) ?? 0;
      counters.set(kind, ordinal + 1);
    }
    if (section.state === "ok" && !absent) present.add(section.blockType);
    return { section, absent, ordinal };
  });
  return { placed, layout: { present, serviceTone, opening } };
}

/** Sections that share one approved frame when they follow each other. */
const GROUP: Record<string, string> = {
  "home.clients": "home-sheet",
  "home.compliance": "home-sheet",
  "legal.contents": "legal-band",
  "legal.section": "legal-band",
  "industries.sectors": "sectors",
  "industries.index": "sectors",
};

export interface Run {
  group: string | null;
  items: Placed[];
}

/** The page's sections in order, consecutive members of one frame together (a section that shows nothing stands alone). */
export function runs(placed: Placed[]): Run[] {
  const out: Run[] = [];
  for (const item of placed) {
    const group = item.section.state === "ok" && !item.absent ? (GROUP[item.section.blockType] ?? null) : null;
    const last = out[out.length - 1];
    if (group && last?.group === group) last.items.push(item);
    else out.push({ group, items: [item] });
  }
  return out;
}

/** A section that shows nothing on this page: an admin-only note in its place, so the builder can still find and edit it. */
export function AbsentSection({ id, label, reason }: { id: string; label: string; reason: string }): ReactNode {
  return (
    <div className="shell gb-failed gb-absent" data-section={id} lang="en" dir="ltr">
      <div className="gb-missing">
        <span className="gb-note">
          Preview only — “{label}” is not shown on this page: {reason}
        </span>
      </div>
    </div>
  );
}
