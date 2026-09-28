import { Geist_Mono, IBM_Plex_Sans_Arabic, Manrope, Noto_Kufi_Arabic, Sora } from "next/font/google";

/*
 * The website's fonts (see ./fonts.ts) for global-not-found.tsx, without preloads. With experimental.globalNotFound
 * that page sits in every route's module graph, so its preloads were emitted on every page — including the pages in
 * the Modern Commerce design and the theme lab, which use other fonts. The fallback 404 loads them on demand instead
 * (same files, same CSS variables); the pages in the previous design keep the preloads of their own root layout.
 */
export const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", preload: false });

export const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });

export const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-kufi-arabic",
  display: "swap",
  preload: false,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });
