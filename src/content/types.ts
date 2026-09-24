/**
 * Content models for the public website.
 *
 * Every model is plain, serialisable data with localized fields, so the Phase 2
 * admin panel can take over storage without touching the components. Fields
 * that are unknown today are optional and simply not rendered — never invent
 * values to fill them.
 */
import type { Locale } from "@/i18n/config";
import type { MediaId } from "./media.generated";

export type { MediaId };

export type Localized<T = string> = Record<Locale, T>;

/** Where a fact came from. `inferred` = website classification, not a company claim. */
export interface SourceRef {
  basis: "profile" | "licence" | "inferred";
  pages?: number[];
  note?: string;
}

export type ServiceSlug =
  | "laser-cutting"
  | "cnc-bending"
  | "steel-structures"
  | "fabrication"
  | "laser-engraving"
  | "scaffolding";

export interface Service {
  slug: ServiceSlug;
  index: string;
  name: Localized;
  /** One-line positioning, e.g. for cards and the footer. */
  tagline: Localized;
  /** 2–3 sentences for the homepage explorer. */
  summary: Localized;
  /** Longer copy for the service detail page (stage 1D). */
  body: Localized<string[]>;
  highlights: Localized<string[]>;
  cover: MediaId;
  coverAlt: Localized;
  gallery: MediaId[];
  machines: MachineSlug[];
  projects: ProjectSlug[];
  source: SourceRef;
}

export type MachineSlug =
  | "tube-cutting-12kw"
  | "fiber-laser-6kw"
  | "fiber-laser-combo-12kw"
  | "fiber-laser-3kw"
  | "cnc-press-brake"
  | "laser-welding";

export interface Machine {
  slug: MachineSlug;
  /** Name exactly as given in the company profile. */
  name: Localized;
  shortName: Localized;
  category: Localized;
  /** Rated laser power in watts, when stated in the profile. */
  powerWatts?: number;
  capability: Localized;
  service: ServiceSlug;
  media: MediaId;
  source: SourceRef;
}

export type ProjectCategory =
  | "architectural"
  | "structures"
  | "fabrication"
  | "laser-cutting"
  | "public-realm"
  | "decorative"
  | "industrial"
  | "custom";

export type ProjectSlug = string;

export interface Project {
  slug: ProjectSlug;
  /** Reference number in the company-profile work gallery. */
  galleryRef: string;
  title: Localized;
  summary: Localized;
  categories: ProjectCategory[];
  services: ServiceSlug[];
  media: MediaId[];
  featured?: boolean;
  /** Awaiting confirmation from RAWASY — rendered only once provided. */
  scope?: Localized;
  description?: Localized;
  materials?: Localized<string[]>;
  location?: Localized;
  year?: number;
  client?: Localized;
  challenge?: Localized;
  solution?: Localized;
  /** Review flags raised during the asset audit (see docs/ASSET_INVENTORY.md). */
  flags?: ProjectFlag[];
  /** Internal note for the content team (not rendered). */
  note?: string;
}

export type ProjectFlag =
  /** Image carries an AI-generation watermark — confirm before featuring. */
  | "ai-watermark"
  /** Resembles a published artwork by others — confirm authorship. */
  | "confirm-authorship"
  /** Catalogue / 3D render rather than a photograph. */
  | "render";

export interface Industry {
  slug: string;
  name: Localized;
  description: Localized;
  media: MediaId;
  source: SourceRef;
}

export interface Client {
  slug: string;
  name: Localized;
  /** Original colours (background removed). */
  logo: MediaId;
  /** Black silhouette with normalised alpha, recoloured per theme in CSS. */
  logoMono: MediaId;
}

export interface CertificateFact {
  label: Localized;
  value: Localized;
}

export interface Certificate {
  slug: string;
  title: Localized;
  issuer: Localized;
  facts: CertificateFact[];
  previews: MediaId[];
  thumb: MediaId;
  source: SourceRef;
}

export interface Pillar {
  slug: string;
  icon: "precision" | "technology" | "craft" | "reliability" | "custom" | "execution";
  title: Localized;
  body: Localized;
}

export interface Metric {
  slug: string;
  /** Numeric value to count up to. */
  value?: number;
  display: Localized;
  unit?: Localized;
  label: Localized;
  source: SourceRef;
}

export interface ProcessStep {
  slug: string;
  index: string;
  verb: Localized;
  title: Localized;
  body: Localized;
  service?: ServiceSlug;
}

export interface Phone {
  display: string;
  e164: string;
  whatsapp: boolean;
}

export interface CompanyInfo {
  legalName: Localized;
  brandName: Localized;
  statement: Localized;
  address: Localized<{ lines: string[]; full: string }>;
  city: Localized;
  country: Localized;
  postalCode: string;
  geo: { lat: number; lng: number; approximate: true };
  phones: Phone[];
  email: string;
  website: string;
  social: { facebook: string };
  vision: { statement: Localized; aims: Localized<string[]>; closing: Localized };
}

export interface SeoEntry {
  title: Localized;
  description: Localized;
}
