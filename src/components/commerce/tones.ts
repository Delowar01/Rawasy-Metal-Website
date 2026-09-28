import type { ServiceSlug } from "@/content/types";
import type { IconName } from "./Icon";
import type { Tone } from "./types";

/*
 * Colour roles and icons of the Modern Commerce homepage (the approved A V2 mapping): colour comes through surfaces,
 * edges, tags and icons in each item's role, never through paragraphs.
 */

export const serviceTone: Record<ServiceSlug, Tone> = {
  "laser-cutting": "brand",
  "cnc-bending": "steel",
  "steel-structures": "steel",
  fabrication: "brass",
  "laser-engraving": "brass",
  scaffolding: "teal",
};

/** The one capability tag each standard service card carries (an index into its own highlights). */
export const serviceTag: Record<ServiceSlug, number> = {
  "laser-cutting": 4,
  "cnc-bending": 0,
  "steel-structures": 0,
  fabrication: 0,
  "laser-engraving": 3,
  scaffolding: 0,
};

export const industryIcon: Record<string, IconName> = {
  construction: "construction",
  infrastructure: "infrastructure",
  industrial: "factory",
  commercial: "commercial",
  architecture: "architecture",
  "public-realm": "landmark",
  "street-furniture": "shade",
  signage: "signage",
};

export const industryTone: Record<string, Tone> = {
  construction: "teal",
  infrastructure: "steel",
  industrial: "steel",
  commercial: "steel",
  architecture: "brass",
  "public-realm": "brass",
  "street-furniture": "teal",
  signage: "brass",
};

export const supportIcon: Record<string, IconName> = {
  formwork: "formwork",
  props: "props",
  rental: "rental",
  installation: "installation",
  transport: "truck",
};

export const pillarIcon: Record<string, [IconName, Tone]> = {
  precision: ["precision", "steel"],
  technology: ["power", "steel"],
  craftsmanship: ["fabrication", "brass"],
  reliability: ["shield", "teal"],
  "custom-solutions": ["layers", "brass"],
  "project-execution": ["truck", "teal"],
};
