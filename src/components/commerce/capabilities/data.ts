import { getMedia } from "@/content/media";
import { getCapabilitiesPageContent, getServices } from "@/content/repository";
import type { CapabilitiesPageContent, Machine, MachineSlug, ServiceSlug } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/routes";
import type { CommerceImage } from "../types";

/**
 * The page's one machine order, in both languages: the homepage machinery showcase's order, so a visitor who comes from
 * it finds the same sequence — the two 12,000 W lasers (the combo first, as the showcase leads with it), then the
 * 6,000 W and 3,000 W lasers, then bending and welding. machines.ts keeps the profile's own order; only the
 * presentation follows this one.
 */
export const MACHINE_ORDER: readonly MachineSlug[] = [
  "fiber-laser-combo-12kw",
  "tube-cutting-12kw",
  "fiber-laser-6kw",
  "fiber-laser-3kw",
  "cnc-press-brake",
  "laser-welding",
];

/**
 * What each machine's process sketch shows, from its own type in machines.ts: an enclosed laser ("fully enclosed
 * cabin"), tube cutting, flatbed sheet cutting, CNC bending and laser welding. Illustrative only: no geometry, sizes or
 * travel of the real machines.
 */
export type SchematicKind = "enclosed" | "tube" | "sheet" | "bend" | "weld";

const SCHEMATIC: Record<MachineSlug, SchematicKind> = {
  "fiber-laser-combo-12kw": "enclosed",
  "tube-cutting-12kw": "tube",
  "fiber-laser-6kw": "sheet",
  "fiber-laser-3kw": "sheet",
  "cnc-press-brake": "bend",
  "laser-welding": "weld",
};

/** A machine as this page shows it: the record's own fields, localized, in the page's order. */
export interface CapabilityMachine {
  slug: MachineSlug;
  /** Its place in the page's order, "01" to "06". */
  index: string;
  name: string;
  shortName: string;
  category: string;
  capability: string;
  /** The rated power, only where the profile states it: "12,000" and "W" / "واط". */
  power?: { value: string; unit: string };
  service: { slug: ServiceSlug; name: string; href: string };
  /** This machine on this page: /<locale>/capabilities#<slug>. */
  href: string;
  image: CommerceImage;
  /** Where the record comes from: "Company profile · p.7". */
  source: string;
  schematic: SchematicKind;
}

export interface CapabilitiesView {
  locale: Locale;
  page: CapabilitiesPageContent;
  machines: CapabilityMachine[];
  /** The service lines the machines support, in the order the machines first name them. */
  services: { slug: ServiceSlug; name: string; tagline: string; href: string; machines: CapabilityMachine[] }[];
  facts: { machines: number; laser: number; peak?: { value: string; unit: string } };
  quote: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export async function getCapabilitiesView(locale: Locale): Promise<CapabilitiesView> {
  const [{ machines, page }, services] = await Promise.all([getCapabilitiesPageContent(), getServices()]);
  const bySlug = new Map(machines.map((m) => [m.slug, m]));
  const ordered = MACHINE_ORDER.map((slug) => bySlug.get(slug)).filter((m): m is Machine => m !== undefined);
  const unit = page.power.unit[locale];
  const power = (watts?: number) => (watts ? { value: watts.toLocaleString("en-US"), unit } : undefined);
  const serviceOf = (slug: ServiceSlug) => services.find((s) => s.slug === slug)!;

  const list: CapabilityMachine[] = ordered.map((m, i) => ({
    slug: m.slug,
    index: pad(i + 1),
    name: m.name[locale],
    shortName: m.shortName[locale],
    category: m.category[locale],
    capability: m.capability[locale],
    power: power(m.powerWatts),
    service: { slug: m.service, name: serviceOf(m.service).name[locale], href: href(locale, "service", { slug: m.service }) },
    href: href(locale, "capabilities", { hash: m.slug }),
    image: { ...getMedia(m.media), alt: m.name[locale] },
    source: `${page.fields.profile[locale]} · ${(m.source.pages ?? []).map((n) => page.fields.page[locale].replace("{n}", String(n))).join(", ")}`,
    schematic: SCHEMATIC[m.slug],
  }));

  const serviceSlugs = [...new Set(list.map((m) => m.service.slug))];
  const peak = Math.max(0, ...ordered.map((m) => m.powerWatts ?? 0));

  return {
    locale,
    page,
    machines: list,
    services: serviceSlugs.map((slug) => {
      const s = serviceOf(slug);
      return {
        slug,
        name: s.name[locale],
        tagline: s.tagline[locale],
        href: href(locale, "service", { slug }),
        machines: list.filter((m) => m.service.slug === slug),
      };
    }),
    facts: {
      machines: list.length,
      laser: list.filter((m) => m.service.slug === "laser-cutting").length,
      peak: power(peak || undefined),
    },
    quote: href(locale, "contact", { hash: "quote" }),
  };
}
