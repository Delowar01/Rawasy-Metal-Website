/**
 * The Core CMS registry (A3): the content types, the collections' orderings, the project flags and their policy, the
 * service icons, the system pages and the limits every form and service checks. Code, not database (A1-CONTENT-MODEL
 * §5.2, §8.2): a change here is a code review, and a new ordering key is a seed migration.
 *
 * Framework-free and import-free: the services, the CLIs (the seed generator) and the unit tests load it.
 */

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_LABELS: Record<Locale, { name: string; native: string; dir: "ltr" | "rtl" }> = {
  en: { name: "English", native: "English", dir: "ltr" },
  ar: { name: "Arabic", native: "العربية", dir: "rtl" },
};

export const ENTITY_TYPES = ["page", "service", "machine", "project", "project_category", "industry", "client", "certificate"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ORDERING_KEYS = ["services", "machines", "projects", "project_categories", "clients", "industries", "certificates"] as const;
export type OrderingKey = (typeof ORDERING_KEYS)[number];

export interface EntityInfo {
  type: EntityType;
  /** The permission resource (registry.ts keys `<resource>.<action>`). */
  resource: "pages" | "services" | "machines" | "projects" | "project_categories" | "industries" | "clients" | "certificates";
  /** Root and translation tables, and the translation table's parent column (fixed names, never from input). */
  table: string;
  trTable: string;
  trParent: string;
  orderingKey: OrderingKey | null;
  one: string;
  many: string;
  /** Where the admin lists them. */
  path: string;
}

export const ENTITIES: Readonly<Record<EntityType, EntityInfo>> = {
  page: { type: "page", resource: "pages", table: "pages", trTable: "page_translations", trParent: "page_id", orderingKey: null, one: "page", many: "Pages", path: "/admin/pages" },
  service: {
    type: "service",
    resource: "services",
    table: "services",
    trTable: "service_translations",
    trParent: "service_id",
    orderingKey: "services",
    one: "service",
    many: "Services",
    path: "/admin/services",
  },
  machine: {
    type: "machine",
    resource: "machines",
    table: "machines",
    trTable: "machine_translations",
    trParent: "machine_id",
    orderingKey: "machines",
    one: "machine",
    many: "Machinery",
    path: "/admin/machinery",
  },
  project: {
    type: "project",
    resource: "projects",
    table: "projects",
    trTable: "project_translations",
    trParent: "project_id",
    orderingKey: "projects",
    one: "project",
    many: "Projects",
    path: "/admin/projects",
  },
  project_category: {
    type: "project_category",
    resource: "project_categories",
    table: "project_categories",
    trTable: "project_category_translations",
    trParent: "category_id",
    orderingKey: "project_categories",
    one: "project category",
    many: "Project categories",
    path: "/admin/projects/categories",
  },
  industry: {
    type: "industry",
    resource: "industries",
    table: "industries",
    trTable: "industry_translations",
    trParent: "industry_id",
    orderingKey: "industries",
    one: "industry",
    many: "Industries",
    path: "/admin/industries",
  },
  client: {
    type: "client",
    resource: "clients",
    table: "clients",
    trTable: "client_translations",
    trParent: "client_id",
    orderingKey: "clients",
    one: "client",
    many: "Clients",
    path: "/admin/clients",
  },
  certificate: {
    type: "certificate",
    resource: "certificates",
    table: "certificates",
    trTable: "certificate_translations",
    trParent: "certificate_id",
    orderingKey: "certificates",
    one: "certificate",
    many: "Certificates",
    path: "/admin/certificates",
  },
};

/** The collections whose order is kept (A1 `entity_orderings`), with the type of their items. */
export const ORDERINGS: Readonly<Record<OrderingKey, EntityType>> = {
  services: "service",
  machines: "machine",
  projects: "project",
  project_categories: "project_category",
  clients: "client",
  industries: "industry",
  certificates: "certificate",
};

// --- Project flags (A1-CONTENT-MODEL §8.2; A3 brief §24) -------------------------------------------------------------

export interface FlagInfo {
  label: string;
  description: string;
  /**
   * A blocking flag keeps the project off the public site (not showcased, no photos) once publishing exists (A8/A9).
   * A1: every flag blocks except `ai_watermark`, whose effect is on the individual photos (A4); an unknown flag blocks.
   */
  blocking: boolean;
}

export const PROJECT_FLAGS = {
  pending_confirmation: { label: "Pending confirmation", description: "Facts or photos await RAWASY's confirmation.", blocking: true },
  authorship_unconfirmed: { label: "Authorship unconfirmed", description: "The work may be someone else's: confirm authorship first.", blocking: true },
  rights_pending: { label: "Rights or copyright pending", description: "Permission to show this work or its photos is not confirmed.", blocking: true },
  product_render: { label: "Render, not a photograph", description: "A catalogue or 3D render rather than a photograph of delivered work.", blocking: true },
  ai_edited: { label: "AI-generated or AI-edited", description: "Images or text were generated or altered with AI.", blocking: true },
  ai_watermark: { label: "AI watermark on a photo", description: "A photo carries an AI-generation watermark (the photo is held back).", blocking: false },
  restricted: { label: "Restricted", description: "Kept off the public site until an Owner or Admin clears it.", blocking: true },
  hidden: { label: "Hidden", description: "Never shown publicly, whatever else is set.", blocking: true },
  internal_only: { label: "Internal only", description: "For the team's reference only.", blocking: true },
} as const satisfies Record<string, FlagInfo>;

export type ProjectFlagKey = keyof typeof PROJECT_FLAGS;
export const PROJECT_FLAG_KEYS = Object.keys(PROJECT_FLAGS) as ProjectFlagKey[];

/** Fail-closed (A1): a flag the code does not know blocks. */
export const isBlockingFlag = (flag: string): boolean => (PROJECT_FLAGS as Record<string, FlagInfo>)[flag]?.blocking ?? true;
export const flagLabel = (flag: string): string => (PROJECT_FLAGS as Record<string, FlagInfo>)[flag]?.label ?? `Unknown flag (${flag})`;
export const isKnownFlag = (flag: string): flag is ProjectFlagKey => Object.hasOwn(PROJECT_FLAGS, flag);

// --- Services: icons and groups ---------------------------------------------------------------------------------------

/** Icon registry keys a service may use (names of the public site's icon set, `src/components/commerce/Icon.tsx`). */
export const SERVICE_ICON_KEYS = [
  "laser-cutting",
  "cnc-bending",
  "steel-structures",
  "fabrication",
  "laser-engraving",
  "scaffolding",
  "precision",
  "machine",
  "factory",
  "construction",
  "infrastructure",
  "installation",
  "layers",
  "shield",
] as const;
export type ServiceIconKey = (typeof SERVICE_ICON_KEYS)[number];

export const SERVICE_GROUP_LABELS = { metal: "Metal section", scaffolding: "Scaffolding section" } as const;
export const INDUSTRY_CLASSIFICATION_LABELS = {
  profile_sector: "Sector named in the company profile",
  website_classification: "Website classification (from the work gallery)",
} as const;
export const SOURCE_BASIS_LABELS = {
  profile: "Company profile",
  licence: "Licence or registration",
  owner: "Confirmed by RAWASY",
  inferred: "Inferred (website classification)",
  other: "Other",
} as const;

// --- Pages -----------------------------------------------------------------------------------------------------------

export type PageType = "home" | "system" | "legal" | "generic" | "template";

/** The system pages of A1-DATABASE-SCHEMA `pages.system_key`: fixed routes, never created as generic pages. */
export const SYSTEM_PAGES = [
  { key: "home", type: "home", label: "Homepage", route: "/" },
  { key: "about", type: "system", label: "About", route: "/about" },
  { key: "services", type: "system", label: "Services overview", route: "/services" },
  { key: "capabilities", type: "system", label: "Capabilities & Machinery", route: "/capabilities" },
  { key: "projects", type: "system", label: "Projects overview", route: "/projects" },
  { key: "industries", type: "system", label: "Industries", route: "/industries" },
  { key: "clients", type: "system", label: "Clients", route: "/clients" },
  { key: "certificates", type: "system", label: "Certificates", route: "/certificates" },
  { key: "contact", type: "system", label: "Contact", route: "/contact" },
  { key: "not_found", type: "system", label: "Page not found (404)", route: null },
  { key: "privacy", type: "legal", label: "Privacy policy", route: "/privacy" },
  { key: "terms", type: "legal", label: "Terms of use", route: "/terms" },
  { key: "project_detail", type: "template", label: "Project page template", route: null },
  { key: "service_detail_default", type: "template", label: "New service page template", route: null },
] as const satisfies readonly { key: string; type: PageType; label: string; route: string | null }[];

export type SystemPageKey = (typeof SYSTEM_PAGES)[number]["key"];
export const systemPage = (key: string) => SYSTEM_PAGES.find((p) => p.key === key);

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  home: "Homepage",
  system: "System page",
  legal: "Legal page",
  generic: "Generic page",
  template: "Template",
};

/** Shown on every legal page record (A3 brief §20). */
export const LEGAL_REVIEW_LABEL = "Requires legal review before publication";

// --- Limits (validated on the server; the forms use the same numbers for hints) ---------------------------------------

export const LIMITS = {
  /** Per-field maximum lengths (characters), within the column sizes of A1. */
  text: {
    pageTitle: 200,
    navLabel: 80,
    serviceName: 120,
    tagline: 200,
    summary: 2000,
    paragraph: 4000,
    paragraphs: 50,
    highlight: 120,
    highlights: 8,
    machineName: 160,
    shortName: 80,
    category: 160,
    capability: 2000,
    attrLabel: 80,
    attrValue: 200,
    projectTitle: 200,
    scope: 4000,
    materials: 500,
    location: 200,
    clientName: 200,
    challenge: 4000,
    solution: 4000,
    categoryLabel: 80,
    industryName: 120,
    industryDescription: 2000,
    certificateTitle: 200,
    issuer: 200,
    factLabel: 80,
    factValue: 200,
    seoTitle: 120,
    seoDescription: 320,
    sourceNote: 2000,
    sourcePages: 40,
    flagNote: 500,
    /** A clearing note is kept whole in the audit event (whose strings are clipped at 200). */
    clearNote: 200,
    url: 255,
    galleryRef: 16,
  },
  /** SEO lengths above which the editor warns (A1-CONTENT-MODEL §11). */
  seoWarn: { title: 60, description: 160 },
  relations: {
    machines: 20,
    relatedServices: 10,
    featuredProjects: 12,
    categories: 6,
    projectServices: 6,
    industryServices: 12,
    industryProjects: 24,
  },
  attributes: 20,
  facts: 12,
  powerWatts: { min: 1, max: 100_000 },
  year: { min: 1900, max: 2100 },
  page: { defaultSize: 25, minSize: 10, maxSize: 100 },
  searchQuery: 100,
} as const;
