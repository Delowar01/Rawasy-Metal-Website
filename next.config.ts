import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The admin's MariaDB driver stays a Node.js dependency (not bundled); @node-rs/argon2 is external by default.
  serverExternalPackages: ["mysql2"],
  async headers() {
    return ["/api/admin/:path*", "/api/internal/:path*"].map((source) => ({ source, headers: API_HEADERS }));
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
};

export default nextConfig;
