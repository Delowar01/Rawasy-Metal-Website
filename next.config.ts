import type { NextConfig } from "next";
import { join } from "node:path";

/**
 * Static headers of the API namespaces, which stay outside the proxy (A1-SECURITY-RBAC §4): no caching, no indexing, no
 * content. Every endpoint A1 plans lives under `/api/admin/**` (uploads, private files, preview) or `/api/internal/**`
 * (cron). Any other `/api/…` address has no route and keeps Next.js's own 404 as before A2: under this sandbox policy its
 * error page could not run, and an approved public test pins how that page renders.
 */
const API_HEADERS = [
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; sandbox" },
];

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS helper Next.js loads with this file at every start.
const { builtSource, contentSourceFor, markPageCacheConfigured } = require("./src/server/public/release-source.cjs") as {
  builtSource: (distDir: string) => "static" | "database" | null;
  contentSourceFor: (phase: string, asked: string | undefined, readBuilt: () => "static" | "database" | null) => "static" | "database";
  markPageCacheConfigured: () => void;
};

/**
 * The content source (A9.4, A1-MIGRATION-PLAN §9): fixed into a release when it is built. `static` (the default, and the
 * rollback) renders `src/content/*` as before A9. `database` resolves `@/content/load` to the live loader
 * (src/content/live/load.ts): the same modules filled from the published documents, rendered per request, kept by the
 * fail-closed page cache; such a build needs NEXT_PUBLIC_SITE_URL (canonical and share addresses are never taken from the
 * database). A server running a build takes the source that build was made with (src/server/public/release-source.cjs):
 * Next.js evaluates this file again at every start, where `CONTENT_SOURCE` is usually not set.
 */
export default function nextConfig(phase: string): NextConfig {
  // Next.js compiles this file as `<app folder>/next.config.compiled.js`, so `__dirname` is the app's folder.
  const DATABASE_CONTENT = contentSourceFor(phase, process.env.CONTENT_SOURCE, () => builtSource(join(__dirname, ".next"))) === "database";
  // Needed when building (Next.js writes NEXT_PUBLIC_* into the bundles then), not when a server starts.
  if (DATABASE_CONTENT && phase === "phase-production-build" && !process.env.NEXT_PUBLIC_SITE_URL) throw new Error("A database-content build needs NEXT_PUBLIC_SITE_URL.");
  // This process's pages are kept by the fail-closed cache: the live loader requires the mark.
  if (DATABASE_CONTENT) markPageCacheConfigured();
  return config(DATABASE_CONTENT);
}

const config = (DATABASE_CONTENT: boolean): NextConfig => ({
  poweredByHeader: false,
  ...(DATABASE_CONTENT
    ? {
        turbopack: { resolveAlias: { "@/content/load": "./src/content/live/load.ts" } },
        // The fail-closed page cache (src/server/public/cache-handler.cjs), and no second copy in Next's own memory.
        cacheHandler: require.resolve("./src/server/public/cache-handler.cjs"),
        cacheMaxMemorySize: 0,
      }
    : {}),
  // The admin's MariaDB driver stays a Node.js dependency (not bundled); @node-rs/argon2 is external by default.
  serverExternalPackages: ["mysql2"],
  async headers() {
    const api = ["/api/admin/:path*", "/api/internal/:path*"].map((source) => ({ source, headers: API_HEADERS }));
    if (!DATABASE_CONTENT) return api;
    // A database-content release (A9 security review L1): its pages change without a new release, so no shared cache
    // (LiteSpeed's, a CDN's) may keep them; Next.js would otherwise send `s-maxage` of a year with a cached page.
    const pages = ["/en", "/ar", "/en/:path*", "/ar/:path*", "/sitemap.xml"].map((source) => ({ source, headers: [{ key: "Cache-Control", value: "private, no-cache" }] }));
    return [...api, ...pages];
  },
  images: {
    qualities: [75, 85],
    // The image optimizer takes the release's own pictures only (no query string, as before): the six media folders the
    // pages use, the share images and the app icon. Never the uploaded library's public address `/media/u/**` (A4): an
    // item there can be withdrawn at any moment, and the optimizer would keep serving its own copy for as long as that
    // address allows caching (a year). Anything else is refused with 400 (Next.js's answer for an unlisted path).
    localPatterns: [
      ...["certificates", "clients", "machines", "projects", "services", "site"].map((group) => ({ pathname: `/media/${group}/**`, search: "" })),
      { pathname: "/og/**", search: "" },
      { pathname: "/apple-icon.png", search: "" },
    ],
  },
  experimental: {
    // Serves app/global-not-found.tsx for URLs that match no route at all
    // (the localized 404 lives in app/(commerce)/[locale]/(missing)/not-found.tsx).
    globalNotFound: true,
  },
});
