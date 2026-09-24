/**
 * Content models for the public website.
 *
 * Every model is plain, serialisable data with localized fields, so the Phase 2
 * admin panel can take over storage without touching the components. Fields
 * that are unknown today are optional and simply not rendered — never invent
 * values to fill them.
 */
import type { Locale } from "@/i18n/config";
import type { RouteKey } from "@/i18n/routes";
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
  /** Second image for the services overview page. */
  supporting: { media: MediaId; alt: Localized };
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
  /** Larger image for the industries page when `media` is too small to show well. */
  feature?: MediaId;
  /** Service lines that apply to the sector (from the description above). */
  services: ServiceSlug[];
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

/* ---------- Inner pages (stage 1C) ---------- */

/** Opening copy shared by every inner-page hero. */
export interface PageHero {
  eyebrow: Localized;
  title: Localized;
  intro: Localized;
}

/** A fact shown in a hero's technical metadata strip. Sourced facts only. */
export interface MetaItem {
  label: Localized;
  value: Localized;
}

export interface PageLink {
  route: RouteKey;
  label: Localized;
  description?: Localized;
}

/** Closing call to action at the end of an inner page. */
export interface PageCta {
  label: Localized;
  title: Localized;
  body?: Localized;
  links: PageLink[];
}

export interface AboutContent {
  hero: PageHero & { meta: MetaItem[]; media: MediaId; mediaAlt: Localized; caption: Localized; nameplate: Localized };
  overview: { label: Localized; title: Localized; paragraphs: Localized<string[]>; servicesLabel: Localized };
  vision: { label: Localized; aimsLabel: Localized };
  beyond: {
    label: Localized;
    title: Localized;
    intro: Localized;
    items: Localized[];
    media: MediaId;
    mediaAlt: Localized;
    link: Localized;
  };
  process: { label: Localized; title: Localized; intro: Localized; steps: { slug: string; title: Localized; body: Localized }[] };
  why: { label: Localized; title: Localized; intro: Localized };
  cta: PageCta;
}

export interface ServicesPageContent {
  hero: PageHero & { meta: MetaItem[] };
  /** Name of the service plate in the hero (a second, distinct navigation landmark). */
  plateLabel: Localized;
  indexLabel: Localized;
  includesLabel: Localized;
  equipmentLabel: Localized;
  open: Localized;
  cta: PageCta;
}

export interface IndustriesPageContent {
  hero: PageHero & { meta: MetaItem[] };
  listLabel: Localized;
  basis: { profile: Localized; inferred: Localized };
  relatedLabel: Localized;
  note: { label: Localized; title: Localized; paragraphs: Localized<string[]> };
  cta: PageCta;
}

export interface ClientsPageContent {
  hero: PageHero;
  listLabel: Localized;
  note: Localized;
  cta: PageCta;
}

export interface CertificatesPageContent {
  hero: PageHero;
  registerLabel: Localized;
  columns: { number: Localized; document: Localized; issuer: Localized; reference: Localized };
  /** Shown instead of registration numbers, which stay off the site. */
  reference: Localized;
  view: Localized;
  previewLabel: Localized;
  /** Labels for the English and Arabic versions of a bilingual document, in that order. */
  versions: Localized<string[]>;
  dialogNote: Localized;
  redaction: { label: Localized; title: Localized; points: Localized<string[]> };
  cta: PageCta;
}

export type QuoteFieldName =
  | "fullName"
  | "company"
  | "email"
  | "phone"
  | "service"
  | "projectType"
  | "requirement"
  | "location"
  | "message"
  | "files";

export interface QuoteField {
  label: Localized;
  hint?: Localized;
  placeholder?: Localized;
}

export interface QuoteFormContent {
  label: Localized;
  title: Localized;
  intro: Localized;
  /** How sending works. There is no delivery backend: the visitor sends the request. */
  status: Localized;
  steps: Localized<string[]>;
  requiredNote: Localized;
  /** Legends of the three field groups. */
  groups: { details: Localized; project: Localized; message: Localized };
  /** Shown only without JavaScript, when the form falls back to a mailto: submission. */
  noscript: Localized;
  fields: Record<QuoteFieldName, QuoteField>;
  serviceOther: Localized;
  projectTypes: { value: string; label: Localized }[];
  files: {
    accept: string[];
    maxFiles: number;
    maxSizeMb: number;
    choose: Localized;
    drop: Localized;
    remove: Localized;
    units: { kb: Localized; mb: Localized };
    note: Localized;
  };
  submit: Localized;
  errors: {
    summary: Localized;
    fullName: Localized;
    email: Localized;
    emailInvalid: Localized;
    phone: Localized;
    phoneInvalid: Localized;
    service: Localized;
    message: Localized;
    messageShort: Localized;
    fileType: Localized;
    fileSize: Localized;
    fileCount: Localized;
  };
  ready: {
    title: Localized;
    body: Localized;
    email: Localized;
    whatsapp: Localized;
    copy: Localized;
    copied: Localized;
    copyFailed: Localized;
    attach: Localized;
    filesLine: Localized;
    fallback: Localized;
    edit: Localized;
    subject: Localized;
    preview: Localized;
  };
  /** `text` contains a {link} placeholder for the privacy policy link. */
  privacy: { text: Localized; link: Localized };
}

export interface ContactPageContent {
  hero: PageHero;
  actions: { quote: Localized; call: Localized };
  methods: {
    label: Localized;
    phone: Localized;
    whatsapp: Localized;
    chat: Localized;
    send: Localized;
    email: Localized;
    address: Localized;
    name: Localized;
    stepsLabel: Localized;
  };
  form: QuoteFormContent;
}

/** A paragraph, or a bullet list, in a legal document. */
export type LegalBlock = string | { list: string[] };

export interface LegalSection {
  id: string;
  title: Localized;
  body: Localized<LegalBlock[]>;
  /** Shows the company contact details after the text. */
  contact?: boolean;
  /** Point that needs RAWASY (or legal) confirmation before launch; shown on the page. */
  pending?: Localized;
}

export interface LegalDocument {
  slug: "privacy" | "terms";
  hero: PageHero;
  /** ISO date of the last content change. */
  updated: string;
  sections: LegalSection[];
}

export interface LegalChrome {
  updated: Localized;
  appliesTo: Localized;
  appliesToValue: Localized;
  onThisPage: Localized;
  pending: Localized;
  contactLabels: { email: Localized; phone: Localized; address: Localized };
}
