import type { Metadata } from "next";
import LocalizedNotFound, { generateMetadata as localizedNotFoundMetadata } from "@/app/(commerce)/[locale]/(missing)/not-found";
import { isLiveForRequest } from "./load.ts";

/**
 * The not-found boundary of a fixed page in a database-content release (A9 F-1). In such a release a fixed page that is
 * not live (never published, as the legal pages are until a legal reviewer is named, or taken offline) calls notFound()
 * through `ensureContent(page)`. Without a boundary above it, Next.js answered with its own bare English 404: no language,
 * no header or footer, no way back. Each fixed route therefore has a boundary (`not-found.db.tsx` beside its page) that
 * draws the website's localized 404 — the (missing) group's page itself, unchanged.
 *
 * - **Database releases only.** The files end in `.db.tsx`, an extension next.config.ts adds to `pageExtensions` only when
 *   it builds database content. A static release does not see them (a file named `not-found.db` is no route file there),
 *   so its pages, page data and stylesheets stay exactly as they are.
 * - **Nothing added to a live page.** Next.js renders a segment's not-found boundary into the page data of every page
 *   under it (about 50 KB raw for the 404 with its header and footer, the reason the localized 404 lives in its own route
 *   group). This boundary draws the 404 only while its page is not live in this request's content — the same read the
 *   page decides on — and nothing otherwise.
 * - **Nothing of the working copy.** The 404 is drawn from the published content (header, footer, interface text), as
 *   the catch-all's is; its metadata is the 404's own: "Page not found", `noindex`.
 */
export function fixedPageBoundary(page: string) {
  async function FixedPageNotFound() {
    if (await isLiveForRequest(page)) return null;
    return <LocalizedNotFound />;
  }
  const generateMetadata = (): Promise<Metadata> => localizedNotFoundMetadata();
  return { FixedPageNotFound, generateMetadata };
}
