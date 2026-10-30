/**
 * The code registries of the site's global controls (A6): what each menu slot of the approved design may hold, the
 * interface-text keys and their limits, and the design tokens. Plain data and pure functions with explicit `.ts`
 * imports, so the Node-run tests, the seed generator (`scripts/generate-access-seed.mjs` writes the menu slots, the
 * singletons and every interface-text key into `drizzle/0007_seed_site_controls.sql`) and Next.js all load it.
 *
 * The approved Modern Commerce shell is frozen, so the menus follow the shape its components draw (A6 report, item 2):
 * - the header (`Header.tsx`) draws its first two pages as links, its third as the Services dropdown and the rest as
 *   links, in the desktop bar and the phone menu alike — Services stays third, and the first three always show;
 * - the Services dropdown lists the live services (until A8 publishes and A9 switches the source: today's six, with
 *   their icons and colours) and a link to every service, the only label it takes from the menu;
 * - the footer draws a company column (its title is an interface text) and the legal links.
 * Every item of the approved menus is a site page (a route key): no free address, no external link (D-A6, no free URL).
 */
import { contrastRatio } from "../builder/design.ts";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

/** The company's country (company profile: Riyadh, Saudi Arabia); the settings row's fixed country code. */
export const COUNTRY_CODE = "SA";

// --- Site pages --------------------------------------------------------------------------------------------------------

/** The site's own pages and their addresses without the language (src/i18n/routes.ts; a unit test keeps them equal). */
export const SITE_ROUTES = {
  home: "/",
  about: "/about",
  services: "/services",
  capabilities: "/capabilities",
  projects: "/projects",
  industries: "/industries",
  clients: "/clients",
  certificates: "/certificates",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export type SiteRouteKey = keyof typeof SITE_ROUTES;
export const SITE_ROUTE_KEYS = Object.keys(SITE_ROUTES) as SiteRouteKey[];
export const isSiteRoute = (value: unknown): value is SiteRouteKey => typeof value === "string" && Object.hasOwn(SITE_ROUTES, value);

/** A site page's address in a language: `/en`, `/ar/contact`. */
export const routePath = (locale: Locale, route: SiteRouteKey) => (SITE_ROUTES[route] === "/" ? `/${locale}` : `/${locale}${SITE_ROUTES[route]}`);

/** The admin names of the site pages (English admin). */
export const ROUTE_NAMES: Record<SiteRouteKey, string> = {
  home: "Home",
  about: "About",
  services: "Services overview",
  capabilities: "Capabilities & Machinery",
  projects: "Projects",
  industries: "Industries",
  clients: "Clients",
  certificates: "Certificates",
  contact: "Contact",
  privacy: "Privacy Policy",
  terms: "Website Terms",
};

// --- Menus -------------------------------------------------------------------------------------------------------------

export type MenuSlotKey = "header_main" | "header_services" | "footer_company" | "footer_legal";

export interface MenuSlot {
  key: MenuSlotKey;
  name: string;
  description: string;
  /** Items, hidden ones included. */
  minItems: number;
  maxItems: number;
  /** A label's maximum length in characters (both languages). */
  labelMax: number;
  /** The design's fixed place for the Services dropdown (header): this route sits at this position, always shown. */
  pinned?: { position: number; route: SiteRouteKey };
  /** Positions that are always shown (the header's first two links and the dropdown). */
  alwaysShown?: readonly number[];
  /**
   * Leading positions the design draws with the page mark only (the header's first two links: `here`, not `section`):
   * a page that has pages of its own (`SECTION_ROUTES`) goes after them, where the header also marks it on those pages.
   */
  pageMarkOnly?: number;
  /** Fixed items (the Services menu): nothing is added, removed, moved or hidden; only labels change. */
  fixed?: boolean;
}

export const MENU_SLOTS: readonly MenuSlot[] = [
  {
    key: "header_main",
    name: "Header navigation",
    description: "The main pages in the header bar and the phone menu. Services is always third: it opens the Services menu; Projects comes after it.",
    minItems: 3,
    maxItems: 8,
    labelMax: 24,
    pinned: { position: 3, route: "services" },
    alwaysShown: [1, 2, 3],
    pageMarkOnly: 2,
  },
  {
    key: "header_services",
    name: "Services menu",
    description: "The Services dropdown: the live services (from the services themselves) and the link to every service.",
    minItems: 2,
    maxItems: 2,
    labelMax: 40,
    fixed: true,
  },
  {
    key: "footer_company",
    name: "Footer company links",
    description: "The footer's company column. Its title is the interface text “Footer company column title”.",
    minItems: 1,
    maxItems: 8,
    labelMax: 32,
  },
  { key: "footer_legal", name: "Footer legal links", description: "The legal links at the foot of every page.", minItems: 1, maxItems: 4, labelMax: 32 },
];

export const MENU_SLOT_KEYS = MENU_SLOTS.map((s) => s.key);
export const menuSlot = (key: string): MenuSlot | undefined => MENU_SLOTS.find((s) => s.key === key);

/** Site pages that have pages of their own (a service's, a project's): the header marks them as the section on those. */
export const SECTION_ROUTES: readonly SiteRouteKey[] = ["services", "projects"];

/** The Services menu's automatic collection: every live service in the published order (A1 `menu_items.collection`). */
export const SERVICES_COLLECTION = "services";

// --- Interface text ----------------------------------------------------------------------------------------------------

export const UI_GROUPS = [
  { key: "a11y", name: "Accessibility labels", description: "Read by screen readers and shown on focus: skip link, menus, landmarks." },
  { key: "controls", name: "Controls", description: "The theme and language controls and the quote buttons." },
  { key: "common", name: "Common words", description: "Contact actions and short words used across the shell." },
  { key: "footer", name: "Footer", description: "The footer's column titles and the copyright line." },
  { key: "navigation", name: "Navigation", description: "Titles in the navigation that are not page names." },
  { key: "notFound", name: "Page not found", description: "The page shown for an unknown address." },
] as const;

export type UiGroupKey = (typeof UI_GROUPS)[number]["key"];

export interface UiStringDef {
  key: string;
  group: UiGroupKey;
  description: string;
  maxLength: number;
  /** Written in the other language (the language switch's label is read in the language it leads to). */
  otherLanguage?: true;
}

/**
 * The interface-text keys (A1: defined in code, added and removed by migration only): every key of
 * `src/i18n/dictionaries.ts` except `notFound.code` (a status code, not text), plus the footer company column's title
 * (`navigation.ts`, D-A6-5). A unit test keeps this list equal to the dictionary. Maximum length: twice the longest
 * text today, rounded up to ten, at least 24 and at most 200 (the shell's labels sit in fixed places).
 */
export const UI_STRINGS: readonly UiStringDef[] = [
  { key: "a11y.skipToContent", group: "a11y", description: "The skip link, first on every page.", maxLength: 40 },
  { key: "a11y.openMenu", group: "a11y", description: "The phone menu button's name.", maxLength: 30 },
  { key: "a11y.mainNav", group: "a11y", description: "The header navigation's landmark name.", maxLength: 40 },
  { key: "a11y.mobileNav", group: "a11y", description: "The phone menu's landmark name.", maxLength: 30 },
  { key: "a11y.footerNav", group: "a11y", description: "The footer navigation's landmark name.", maxLength: 40 },
  { key: "a11y.breadcrumb", group: "a11y", description: "The breadcrumb trail's landmark name.", maxLength: 30 },
  { key: "a11y.homeLink", group: "a11y", description: "The logo link's name.", maxLength: 50 },
  { key: "a11y.languageSwitch", group: "a11y", description: "The language switch's name, in the language it leads to.", maxLength: 50, otherLanguage: true },
  { key: "a11y.close", group: "a11y", description: "Close buttons (dialogs, menus).", maxLength: 24 },
  { key: "a11y.externalLink", group: "a11y", description: "Added to links that open a new tab.", maxLength: 40 },
  { key: "controls.theme", group: "controls", description: "The theme control's name.", maxLength: 24 },
  { key: "controls.light", group: "controls", description: "The light theme button.", maxLength: 24 },
  { key: "controls.dark", group: "controls", description: "The dark theme button.", maxLength: 24 },
  { key: "controls.language", group: "controls", description: "The language control's name.", maxLength: 24 },
  { key: "controls.getQuote", group: "controls", description: "The header's quote button.", maxLength: 30 },
  { key: "controls.requestQuote", group: "controls", description: "The quote button in the Services menu and the phone menu.", maxLength: 30 },
  { key: "common.home", group: "common", description: "“Home” in breadcrumbs.", maxLength: 24 },
  { key: "common.backToTop", group: "common", description: "The footer's back-to-top link.", maxLength: 30 },
  { key: "common.call", group: "common", description: "Call actions.", maxLength: 24 },
  { key: "common.email", group: "common", description: "Email actions and labels.", maxLength: 40 },
  { key: "common.whatsapp", group: "common", description: "WhatsApp actions and labels.", maxLength: 24 },
  { key: "common.address", group: "common", description: "The address label.", maxLength: 24 },
  { key: "common.phone", group: "common", description: "The phone label.", maxLength: 24 },
  { key: "footer.services", group: "footer", description: "The footer's Services column title.", maxLength: 24 },
  { key: "footer.contact", group: "footer", description: "The footer's Contact column title.", maxLength: 24 },
  { key: "footer.legal", group: "footer", description: "The footer's legal links title.", maxLength: 24 },
  { key: "footer.rights", group: "footer", description: "After the copyright line.", maxLength: 40 },
  { key: "navigation.footerCompanyTitle", group: "navigation", description: "The footer company column's title.", maxLength: 24 },
  { key: "notFound.title", group: "notFound", description: "The page-not-found heading.", maxLength: 50 },
  { key: "notFound.body", group: "notFound", description: "The page-not-found text.", maxLength: 120 },
  { key: "notFound.home", group: "notFound", description: "The link back to the homepage.", maxLength: 40 },
  { key: "notFound.contact", group: "notFound", description: "The link to the contact page.", maxLength: 30 },
  { key: "notFound.note", group: "notFound", description: "The small reference note.", maxLength: 80 },
  { key: "notFound.metaTitle", group: "notFound", description: "The browser tab title.", maxLength: 40 },
];

/** Dictionary keys that are not interface text (left out of the registry on purpose). */
export const UI_STRING_EXCLUSIONS = ["notFound.code"] as const;

export const UI_STRING_KEYS: ReadonlySet<string> = new Set(UI_STRINGS.map((s) => s.key));
export const uiString = (key: string): UiStringDef | undefined => UI_STRINGS.find((s) => s.key === key);

// --- Theme ------------------------------------------------------------------------------------------------------------

export type TokenScheme = "all" | "light" | "dark";

/** A design token the Owner may override: its CSS variable, its kind and the rule its value must meet. */
export interface TokenDef {
  key: string;
  label: string;
  cssVar: `--${string}`;
  type: "color";
  schemes: readonly TokenScheme[];
  /** The colours the token is drawn on, per theme, and the contrast it must keep against each (WCAG: 4.5 text, 3 graphics). */
  against: { light: readonly string[]; dark: readonly string[]; minRatio: number };
}

/**
 * Tokens approved for overriding. Empty: the approved Modern Commerce design applies unchanged (D-A6-3); a token is added
 * here only when the Owner approves it, one by one. The theme service refuses every other key.
 */
export const APPROVED_TOKENS: readonly TokenDef[] = [];

/** The approved design's core tokens, for reference (read-only; `system.css` is the source: a unit test keeps them equal). */
export const REFERENCE_TOKENS = [
  { cssVar: "--brand", label: "Brand orange (accent and primary action)", light: "#f15f22", dark: "#f26a2e" },
  { cssVar: "--steel", label: "Steel (tone)", light: "#2c5e86", dark: "#7fb0d8" },
  { cssVar: "--teal", label: "Teal (tone)", light: "#1b6f65", dark: "#5cc0b0" },
  { cssVar: "--brass", label: "Brass (tone)", light: "#7b5c24", dark: "#d7b273" },
  { cssVar: "--bg", label: "Page", light: "#f4f4f1", dark: "#131820" },
  { cssVar: "--surface", label: "Surface (cards)", light: "#fdfdfb", dark: "#1c232d" },
  { cssVar: "--ink", label: "Text", light: "#15171a", dark: "#eef1f4" },
  { cssVar: "--ink-2", label: "Secondary text", light: "#454a50", dark: "#b8c0ca" },
  { cssVar: "--line", label: "Lines and borders", light: "#d6d6d0", dark: "#2d3642" },
  { cssVar: "--focus", label: "Focus ring", light: "#2c5e86", dark: "#8ebcdf" },
] as const;

const HEX = /^#[0-9a-f]{6}$/;

/** The problem with a token value for a scheme, or null. Values are lower-case #rrggbb; contrast is checked unrounded. */
export function tokenValueProblem(def: TokenDef, scheme: TokenScheme, value: string): string | null {
  if (!def.schemes.includes(scheme)) return "This token can't be set for that theme.";
  if (!HEX.test(value)) return "Enter a colour as #rrggbb (six hexadecimal digits).";
  const themes = scheme === "all" ? (["light", "dark"] as const) : [scheme];
  for (const theme of themes) {
    for (const bg of def.against[theme]) {
      if (contrastRatio(value, bg) < def.against.minRatio) return `This colour does not keep ${def.against.minRatio}:1 contrast on the ${theme} theme's ${bg}.`;
    }
  }
  return null;
}

/** The CSS custom properties of valid overrides for one theme (the `all` value, then the theme's own); unknown keys are skipped. */
export function tokenStyle(
  overrides: readonly { tokenKey: string; scheme: TokenScheme; value: string }[],
  theme: "light" | "dark",
  approved: readonly TokenDef[] = APPROVED_TOKENS,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const scheme of ["all", theme] as const) {
    for (const o of overrides) {
      if (o.scheme !== scheme) continue;
      const def = approved.find((d) => d.key === o.tokenKey);
      if (!def || tokenValueProblem(def, scheme, o.value)) continue;
      out[def.cssVar] = o.value;
    }
  }
  return out;
}

// --- Limits -----------------------------------------------------------------------------------------------------------

export const SETTINGS_LIMITS = {
  phones: { min: 1, max: 4 },
  addressLines: { min: 1, max: 4, length: 80 },
  visionAims: { max: 8, length: 300 },
} as const;
