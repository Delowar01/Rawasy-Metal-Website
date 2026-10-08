import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "@/fonts/arabic.css";
import plexArabic400 from "@/fonts/ibm-plex-sans-arabic-400-arabic.woff2";
import plexLatin400 from "@/fonts/ibm-plex-sans-arabic-400-latin.woff2";
import plexArabic500 from "@/fonts/ibm-plex-sans-arabic-500-arabic.woff2";
import plexLatin500 from "@/fonts/ibm-plex-sans-arabic-500-latin.woff2";
import tajawalArabic700 from "@/fonts/tajawal-700-arabic.woff2";
import tajawalLatin700 from "@/fonts/tajawal-700-latin.woff2";
import tajawalArabic800 from "@/fonts/tajawal-800-arabic.woff2";
import tajawalLatin800 from "@/fonts/tajawal-800-latin.woff2";

/*
 * Modern Commerce typography (the approved A V2 direction), wired to the tokens in
 * src/components/commerce/system.css:
 *   English display (headings, figures, buttons) → Plus Jakarta Sans
 *   English body and UI                            → Inter
 *   Arabic display and semibold UI                 → Tajawal (500 / 700 / 800)
 *   Arabic body                                    → IBM Plex Sans Arabic (400 / 500 only)
 *   Technical figures                              → the system monospace stack
 *
 * Every face is self-hosted (no request to Google at runtime). Both languages share one root layout, and next/font
 * preloads a face on every page its layout serves (its preloads follow the route files, which the two languages share),
 * so:
 *   - the Latin faces come from next/font and are preloaded on every page;
 *   - the Arabic faces are declared in src/fonts/arabic.css (the files next/font used to download, unchanged), and the
 *     root layout preloads `arabicFontPreloads` on the Arabic pages only.
 */
export const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-mc-display", display: "swap" });

export const body = Inter({ subsets: ["latin"], variable: "--font-mc-body", display: "swap" });

/**
 * The Arabic files every Arabic page uses on its first screen, at every width (counted on all 21 page types at 1440,
 * 1024, 834, 390 and 320 px in Stage 1J): Tajawal 700 / 800 and IBM Plex Sans Arabic 400 / 500, each in its Arabic and
 * Latin ranges. Tajawal 500 is not on every page's first screen, so it still loads on demand: a preload that a page
 * does not use is wasted and draws a console warning.
 */
export const arabicFontPreloads: readonly string[] = [
  tajawalArabic800,
  tajawalArabic700,
  plexArabic400,
  plexArabic500,
  tajawalLatin800,
  tajawalLatin700,
  plexLatin400,
  plexLatin500,
];

export const fontVariables = [display, body].map((font) => font.variable).join(" ");
