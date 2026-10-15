/**
 * Addresses the CMS may never hand to content (A1-CONTENT-MODEL §4.4; A3): the one source of truth for reserved slugs,
 * kept beside the route table and checked by the admin on every save. Nothing on the public site imports it.
 *
 * - `RESERVED_PAGE_SLUGS`: a generic page lives at `/{locale}/{slug}`, so its slug may not be a locale, a route of the
 *   site, a file the app or `public/` serves at the top level, a Next.js internal path or a name A1 keeps for later
 *   features. `tests/unit/reserved-slugs.test.ts` proves the list covers every route in `routes.ts`, every folder and
 *   file at the top of `src/app/(commerce)/[locale]`, `src/app` and `public/`, and every locale in `config.ts`.
 * - `RESERVED_ANCHORS`: machines, projects, certificates and industries also use their slug as an in-page anchor
 *   (`/capabilities#<slug>`, `/projects#<slug>`, …), so a slug may not be an id the page already uses for its own parts.
 *
 * Plain data with no imports, so the Node-run tests and command-line tools can load it as well as Next.js.
 */

/** Every locale the site serves (the route prefix), including codes kept for later languages. */
const LOCALE_SEGMENTS = ["en", "ar"];

/** The site's own routes (src/i18n/routes.ts) and top-level files and folders (src/app, public/). */
const SITE_SEGMENTS = [
  "about",
  "services",
  "capabilities",
  "projects",
  "industries",
  "clients",
  "certificates",
  "contact",
  "privacy",
  "terms",
  "admin",
  "api",
  "media",
  "brand",
  "og",
  "sitemap",
  "sitemap.xml",
  "robots",
  "robots.txt",
  "manifest",
  "manifest.webmanifest",
  "icon",
  "icon.svg",
  "apple-icon",
  "apple-icon.png",
  "favicon.ico",
];

/** Next.js internals and error pages. */
const FRAMEWORK_SEGMENTS = ["_next", "_not-found", "not-found", "404", "500", "error", "global-error"];

/** Kept for features A1 plans (media delivery, uploads, search, preview, sign-in). */
const PLANNED_SEGMENTS = ["uploads", "search", "preview", "login", "logout", "account", "static", "assets", "files"];

export const RESERVED_PAGE_SLUGS: ReadonlySet<string> = new Set([...LOCALE_SEGMENTS, ...SITE_SEGMENTS, ...FRAMEWORK_SEGMENTS, ...PLANNED_SEGMENTS]);

/** The shell's and the inner-page kit's own ids, on every page. */
const SHELL_IDS = ["main", "page-title", "page-cta-title", "top"];

/**
 * Ids each page already uses for its parts (the anchors its links land on). A slug used as an anchor on that page must
 * not repeat one of them: machines on /capabilities, projects on /projects, certificates on /certificates (industries
 * and the other collections are not anchored by slug). `tests/unit/reserved-slugs.test.ts` reads the ids out of the
 * pages' components, so a new id there fails the test until it is listed here.
 */
export const RESERVED_ANCHORS = {
  machine: new Set([...SHELL_IDS, "console", "power", "register", "service-lines", "source"]),
  project: new Set([...SHELL_IDS, "gallery", "featured", "highlights", "index"]),
  certificate: new Set([...SHELL_IDS, "redaction", "register", "register-dialog-title"]),
} as const satisfies Record<string, ReadonlySet<string>>;

export type AnchorNamespace = keyof typeof RESERVED_ANCHORS;

/**
 * Generated ids: every section title is `<section>-title`; on /capabilities each machine's name is `<slug>-name` and
 * each service line `line-<service>`. A slug shaped like one of them could repeat another element's id.
 */
const GENERATED: Record<AnchorNamespace, RegExp> = {
  machine: /(-title|-name)$|^line-/,
  project: /-title$/,
  certificate: /-title$/,
};

/** Why a slug is reserved, or null when it is free for a generic page. */
export function reservedPageSlug(slug: string): string | null {
  if (RESERVED_PAGE_SLUGS.has(slug)) return "it is a system route or a reserved address";
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(slug)) return "two-letter addresses are kept for languages";
  return null;
}

/** Whether a slug would repeat an id of the page it anchors on. */
export const reservedAnchor = (namespace: AnchorNamespace, slug: string) =>
  (RESERVED_ANCHORS[namespace] as ReadonlySet<string>).has(slug) || GENERATED[namespace].test(slug);
