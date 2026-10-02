import type { ServiceSlug } from "@/content/types";
import type { IconName } from "../Icon";

/** Section keys of a service page, in their order. */
export type SectionKey = "overview" | "scope" | "process" | "machines" | "applications" | "gallery" | "why" | "related" | "projects";

/**
 * The composition of each service page in the Modern Commerce design (Stage TM-2.4). All six share one set of
 * components, as in Stage 1D: the hero picture, the scope, process and gallery layouts and the icons give each page its
 * character, and the sections follow the same order and sourcing rules.
 *
 * - Laser Cutting — the cutting photo with the Laser Cutting signature (the homepage's, unchanged)
 * - CNC Bending — the press-brake drawing with the bending photo at its own size
 * - Steel Structures — the photo on the structural axis plate
 * - Metal Fabrication — two workshop photos on the brass bench plate, joined by the weld seam
 * - Laser Engraving — the Laser Engraving signature alone (no photographs)
 * - Scaffolding — the tower elevation beside the site photo
 */
export interface ServiceLook {
  hero: "cut" | "fold" | "frame" | "workbench" | "plate" | "bays";
  scope: "profiles" | "folds" | "phases" | "photos" | "materials" | "support";
  process: "rail" | "timeline" | "cycle";
  /** The rail's line: a cut path (orange dashes), fold marks (steel) or a fine double line (brass). */
  rail?: "cut" | "fold" | "fine";
  gallery: "mosaic" | "sheet" | "pair";
  /** Icon per scope phase, process step and "why" point, by slug. */
  icons: Record<string, IconName>;
}

export const serviceLooks: Record<ServiceSlug, ServiceLook> = {
  "laser-cutting": {
    hero: "cut",
    scope: "profiles",
    process: "rail",
    rail: "cut",
    gallery: "mosaic",
    icons: { power: "power", bevel: "bevel", range: "laser-cutting", next: "layers" },
  },
  "cnc-bending": {
    hero: "fold",
    scope: "folds",
    process: "rail",
    rail: "fold",
    gallery: "pair",
    icons: { control: "precision", shapes: "cnc-bending", waste: "check", next: "layers" },
  },
  "steel-structures": {
    hero: "frame",
    scope: "phases",
    process: "timeline",
    gallery: "mosaic",
    icons: {
      concept: "precision",
      durable: "shield",
      craft: "fabrication",
      site: "scaffolding",
      requirements: "doc",
      design: "precision",
      manufacture: "fabrication",
      assembly: "installation",
      handover: "check",
    },
  },
  fabrication: {
    hero: "workbench",
    scope: "photos",
    process: "timeline",
    gallery: "sheet",
    icons: {
      scale: "fabrication",
      "laser-welding": "machine",
      strength: "shield",
      custom: "precision",
      understand: "doc",
      prepare: "laser-cutting",
      fabricate: "fabrication",
      assemble: "installation",
      inspect: "check",
      deliver: "truck",
    },
  },
  "laser-engraving": {
    hero: "plate",
    scope: "materials",
    process: "rail",
    rail: "fine",
    gallery: "mosaic",
    icons: { materials: "laser-engraving", lasting: "shield", detail: "precision" },
  },
  scaffolding: {
    hero: "bays",
    scope: "support",
    process: "cycle",
    gallery: "mosaic",
    icons: {
      safety: "shield",
      systems: "scaffolding",
      service: "truck",
      metal: "layers",
      plan: "doc",
      transport: "truck",
      install: "installation",
      use: "scaffolding",
      dismantle: "props",
    },
  },
};
