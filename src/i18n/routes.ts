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

/** Swap the locale segment of a pathname: "/en/projects/x" → "/ar/projects/x". */
export function switchLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  if ((locales as readonly string[]).includes(segments[1])) {
    segments[1] = target;
    return segments.join("/") || `/${target}`;
  }
  return `/${target}${pathname === "/" ? "" : pathname}`;
}
