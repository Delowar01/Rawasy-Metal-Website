import { Archivo, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";

/** Latin display + text: a grotesque with a width axis for engineered headlines. */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

/** Arabic: modern, highly readable, widely used across Saudi digital services. */
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
  // Arabic glyphs are only requested by Arabic pages (unicode-range), so no preload on EN.
  preload: false,
});

/** Technical labels, coordinates and specification values. */
export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
