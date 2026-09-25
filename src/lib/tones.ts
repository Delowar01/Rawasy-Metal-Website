import type { ServiceSlug } from "@/content/types";

/**
 * Semantic colour roles (see the tokens in globals.css): brand = orange, the
 * primary action; eng = steel blue, engineering and machinery; proc = teal,
 * process and capability; craft = brass, craftsmanship and certificates.
 * Set with `data-tone` on a card, chip or tag.
 */
export type Tone = "brand" | "eng" | "proc" | "craft";

/** Service line → tone: machine-led metal services in steel, craft work in brass, site support in teal. */
export const serviceTone: Record<ServiceSlug, Tone> = {
  "laser-cutting": "eng",
  "cnc-bending": "eng",
  "steel-structures": "eng",
  fabrication: "craft",
  "laser-engraving": "craft",
  scaffolding: "proc",
};
