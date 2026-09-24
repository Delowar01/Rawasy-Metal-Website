import type { RouteKey } from "@/i18n/routes";

/**
 * Publication state per route. Pages are routed and localized from day one,
 * but only published pages are indexed and listed in the sitemap. Flip a
 * route to `true` when its full design ships (approval gate, Phase 1 plan).
 */
export const published: Record<RouteKey, boolean> = {
  home: true,
  about: false,
  services: false,
  service: false,
  capabilities: false,
  projects: false,
  project: false,
  industries: false,
  clients: false,
  certificates: false,
  contact: false,
  privacy: false,
  terms: false,
};
