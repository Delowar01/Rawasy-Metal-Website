import { Archivo, Geist_Mono, IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from "next/font/google";

/*
 * Font roles (wired to CSS tokens in globals.css):
 *   English display + text  → Archivo
 *   Arabic display / UI     → Noto Kufi Arabic (headings, navigation, buttons)
 *   Arabic body             → IBM Plex Sans Arabic (paragraphs, leads, labels)
 *   Technical labels        → Geist Mono
 *
 * All faces are self-hosted by next/font at build time (no runtime requests to
 * Google). Only each script's own subset is preloaded; because both locales
 * share one root layout, those preloads are emitted on every page.
 */

/** English: a grotesque with a width axis for engineered headlines. */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

/** Arabic display: modern Kufi with an engineered, architectural character (variable weight). */
export const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-kufi-arabic",
  display: "swap",
});

/** Arabic body and supporting text only — regular (400) and medium labels (500). */
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500"],
  variable: "--font-plex-arabic",
  display: "swap",
});

/** Technical labels, coordinates and specification values. */
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
