import type { LineIconName } from "@/components/ui/LineIcons";
import type { ServiceSlug } from "@/content/types";

/** Section surfaces (see globals.css): base, recessed deep, tinted steel / teal / brass, and the dark slate band. */
export type Surface = "base" | "deep" | "eng" | "proc" | "craft" | "slate";

export const SURFACE_CLASS: Record<Surface, string> = {
  base: "",
  deep: "sec-deep",
  eng: "sec-eng",
  proc: "sec-proc",
  craft: "sec-craft",
  slate: "sec-slate on-band",
};

export type SectionKey = "overview" | "scope" | "process" | "machines" | "applications" | "gallery" | "why" | "related" | "projects";

/**
 * The visual composition of each service page. All six share one set of
 * components; the hero drawing, the scope and process layouts, the gallery
 * layout and the sequence of section surfaces give each page its character:
 *
 * - Laser Cutting — steel blue and orange, cutting paths
 * - CNC Bending — steel blue, fold lines and angles
 * - Steel Structures — deep slate and steel, structural axes and beams
 * - Metal Fabrication — brass and graphite, the workshop bench
 * - Laser Engraving — brass and orange, fine engraved detail
 * - Scaffolding — teal and graphite, modular bays and site systems
 */
export interface ServiceLook {
  hero: { visual: "cut" | "fold" | "frame" | "workbench" | "plate" | "bays"; surface: Surface; backdrop: "grid" | "fine" | "perforated" };
  scope: "profiles" | "folds" | "phases" | "photos" | "materials" | "support";
  process: { layout: "rail" | "timeline" | "cycle"; line?: "cut" | "fold" | "fine" };
  gallery: "mosaic" | "sheet" | "pair";
  surfaces: Record<SectionKey, Surface>;
  /** Line icon per process step and "why" point, by slug. */
  icons: Record<string, LineIconName>;
}

export const serviceLooks: Record<ServiceSlug, ServiceLook> = {
  "laser-cutting": {
    hero: { visual: "cut", surface: "base", backdrop: "grid" },
    scope: "profiles",
    process: { layout: "rail", line: "cut" },
    gallery: "mosaic",
    surfaces: {
      overview: "base",
      scope: "eng",
      process: "base",
      machines: "slate",
      applications: "deep",
      gallery: "base",
      why: "eng",
      related: "deep",
      projects: "base",
    },
    icons: { power: "machinery", bevel: "precision", range: "laser-cutting", next: "integrated" },
  },
  "cnc-bending": {
    hero: { visual: "fold", surface: "eng", backdrop: "fine" },
    scope: "folds",
    process: { layout: "rail", line: "fold" },
    gallery: "pair",
    surfaces: {
      overview: "base",
      scope: "deep",
      process: "eng",
      machines: "base",
      applications: "deep",
      gallery: "base",
      why: "slate",
      related: "deep",
      projects: "base",
    },
    icons: { control: "precision", shapes: "cnc-bending", waste: "quality", next: "integrated" },
  },
  "steel-structures": {
    hero: { visual: "frame", surface: "base", backdrop: "grid" },
    scope: "phases",
    process: { layout: "timeline" },
    gallery: "mosaic",
    surfaces: {
      overview: "base",
      scope: "eng",
      process: "base",
      machines: "base",
      applications: "deep",
      gallery: "slate",
      why: "base",
      related: "eng",
      projects: "deep",
    },
    icons: {
      concept: "engineer",
      durable: "quality",
      craft: "fabrication",
      site: "scaffolding",
      requirements: "understand",
      design: "engineer",
      manufacture: "fabrication",
      assembly: "installation",
      handover: "quality",
    },
  },
  fabrication: {
    hero: { visual: "workbench", surface: "craft", backdrop: "perforated" },
    scope: "photos",
    process: { layout: "timeline" },
    gallery: "sheet",
    surfaces: {
      overview: "base",
      scope: "deep",
      process: "craft",
      machines: "base",
      applications: "deep",
      gallery: "slate",
      why: "base",
      related: "craft",
      projects: "base",
    },
    icons: {
      scale: "fabrication",
      "laser-welding": "machinery",
      strength: "quality",
      custom: "engineer",
      understand: "understand",
      prepare: "laser-cutting",
      fabricate: "fabrication",
      assemble: "installation",
      inspect: "inspect",
      deliver: "transport",
    },
  },
  "laser-engraving": {
    hero: { visual: "plate", surface: "base", backdrop: "fine" },
    scope: "materials",
    process: { layout: "rail", line: "fine" },
    gallery: "mosaic",
    surfaces: {
      overview: "craft",
      scope: "base",
      process: "deep",
      machines: "base",
      applications: "craft",
      gallery: "base",
      why: "base",
      related: "deep",
      projects: "base",
    },
    icons: { materials: "laser-engraving", lasting: "quality", detail: "precision" },
  },
  scaffolding: {
    hero: { visual: "bays", surface: "proc", backdrop: "grid" },
    scope: "support",
    process: { layout: "cycle" },
    gallery: "mosaic",
    surfaces: {
      overview: "deep",
      scope: "base",
      process: "proc",
      machines: "base",
      applications: "base",
      gallery: "slate",
      why: "base",
      related: "deep",
      projects: "base",
    },
    icons: {
      safety: "quality",
      systems: "scaffolding",
      service: "transport",
      metal: "integrated",
      plan: "understand",
      transport: "transport",
      install: "installation",
      use: "scaffolding",
      dismantle: "props",
    },
  },
};
