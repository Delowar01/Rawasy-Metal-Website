import type { RouteKey } from "@/i18n/routes";

/**
 * Publication state per route — the approval gate of the Phase 1 plan.
 *
 * - `planned`   routed and localized; shows the in-development page (noindex)
 * - `review`    fully built and awaiting the user's approval (noindex, not in the sitemap)
 * - `published` approved: indexed and listed in the sitemap
 *
 * A stage's routes move from `review` to `published` only once the user
 * approves that stage. The Stage 1J brief published every route for the release candidate.
 */
export type PageStatus = "planned" | "review" | "published";

export const pageStatus: Record<RouteKey, PageStatus> = {
  home: "published",
  about: "published",
  services: "published",
  service: "published",
  capabilities: "published",
  projects: "published",
  project: "published",
  industries: "published",
  clients: "published",
  certificates: "published",
  contact: "published",
  privacy: "published",
  terms: "published",
};

export function isPublished(key: RouteKey) {
  return pageStatus[key] === "published";
}
