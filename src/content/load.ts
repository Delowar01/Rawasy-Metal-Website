/**
 * The content source (A9.4, A1-MIGRATION-PLAN §9, T1 Option B): one switch fixed into a release when it is built.
 *
 * This file is the static source — the default, and the rollback: the content is `src/content/*` itself, so every
 * function here does nothing and the pages render exactly as before A9. A build with `CONTENT_SOURCE=database`
 * resolves `@/content/load` to `./live/load.ts` instead (next.config.ts), which fills those same modules from the
 * published documents before a page reads them, and answers 404 for a fixed page that is not published.
 *
 * Every public entry point (the layout, each page and its metadata, the 404s, the sitemap) awaits `ensureContent`
 * before it reads the content.
 */

/** Whether this build renders the static content (no database). */
export const contentIsStatic = true;

/** Makes the content current for this request (static source: it always is). `page`: the fixed page being served. */
export async function ensureContent(page?: string): Promise<void> {
  void page;
}

/** The published redirect of an address no page answers (static source: none; A6's redirects resolve from A9). */
export async function redirectFor(path: string): Promise<null> {
  void path;
  return null;
}

/** Whether a fixed page is published (static source: every page is the release's). */
export function isLivePage(page: string): boolean {
  void page;
  return true;
}
