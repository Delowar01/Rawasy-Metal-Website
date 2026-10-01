import { locales, type Locale } from "./config";

/**
 * Complete Phase 1 route architecture. Paths are shared by both locales
 * (`/en/services/laser-cutting` ↔ `/ar/services/laser-cutting`), so switching
 * language always lands on the equivalent page.
 */
export const routes = {
  home: "/",
  about: "/about",
  services: "/services",
  service: "/services/[slug]",
  capabilities: "/capabilities",
  projects: "/projects",
  project: "/projects/[slug]",
  industries: "/industries",
  clients: "/clients",
  certificates: "/certificates",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export type RouteKey = keyof typeof routes;

/** Build stage each page belongs to (see the Phase 1 plan). */
export const routeStage: Record<RouteKey, string> = {
  home: "1B",
  about: "1C",
  services: "1C",
  service: "1D",
  capabilities: "1E",
  projects: "1F",
  project: "1F",
  industries: "1C",
  clients: "1C",
  certificates: "1C",
  contact: "1C",
  privacy: "1C",
  terms: "1C",
};

/** Locale-less path for a route, e.g. path("service", { slug: "laser-cutting" }). */
export function path(key: RouteKey, params?: { slug?: string }): string {
  const template: string = routes[key];
  return params?.slug ? template.replace("[slug]", params.slug) : template;
}

/** Localized href, e.g. href("ar", "contact") → "/ar/contact". */
export function href(locale: Locale, key: RouteKey, params?: { slug?: string; hash?: string }) {
  const p = path(key, params);
  const base = p === "/" ? `/${locale}` : `/${locale}${p}`;
  return params?.hash ? `${base}#${params.hash}` : base;
}

/**
 * Pages in the Modern Commerce design (Stage TM-1: the homepage; TM-2.1: the privacy policy and the website terms).
 * They have their own root layout (src/app/(commerce)), so a link to one from a page in the previous design is always
 * a full page load. Static routes only: a dynamic route (service, project) needs a pattern match here before it moves.
 */
export const commerceRoutes: readonly RouteKey[] = ["home", "privacy", "terms"];

/**
 * Link props for a page in the previous design: never prefetch a page in the Modern Commerce design. The prefetch could
 * not be used (the navigation is a full page load) and it would download that design's fonts on a page without them.
 */
export function crossDesignLink(target: string): { prefetch?: false } {
  const base = target.split(/[?#]/)[0];
  return commerceRoutes.some((key) => locales.some((locale) => href(locale, key) === base)) ? { prefetch: false } : {};
}

/** Swap the locale segment of a pathname: "/en/projects/x" → "/ar/projects/x". */
export function switchLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  if ((locales as readonly string[]).includes(segments[1])) {
    segments[1] = target;
    return segments.join("/") || `/${target}`;
  }
  return `/${target}${pathname === "/" ? "" : pathname}`;
}
