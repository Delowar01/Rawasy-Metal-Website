import type { NextConfig } from "next";

/** Static headers of `/api/**`, which stays outside the proxy (A1-SECURITY-RBAC §4): no caching, no indexing, no content. */
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
    return [{ source: "/api/:path*", headers: API_HEADERS }];
  },
  images: {
    qualities: [75, 85],
  },
  experimental: {
    // Serves app/global-not-found.tsx for URLs that match no route at all
    // (the localized 404 lives in app/(commerce)/[locale]/(missing)/not-found.tsx).
    globalNotFound: true,
  },
};

export default nextConfig;
