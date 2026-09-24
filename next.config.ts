import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    qualities: [75, 85],
  },
  experimental: {
    // Serves app/global-not-found.tsx for URLs that match no route at all
    // (the localized 404 lives in app/[locale]/not-found.tsx).
    globalNotFound: true,
  },
};

export default nextConfig;
