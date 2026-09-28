import { IBM_Plex_Sans_Arabic, Inter, Plus_Jakarta_Sans, Tajawal } from "next/font/google";

/*
 * Modern Commerce typography (the approved A V2 direction), wired to the tokens in
 * src/components/commerce/system.css:
 *   English display (headings, figures, buttons) → Plus Jakarta Sans
 *   English body and UI                            → Inter
 *   Arabic display and semibold UI                 → Tajawal (500 / 700 / 800)
 *   Arabic body                                    → IBM Plex Sans Arabic (400 / 500 only)
 *   Technical figures                              → the system monospace stack
 *
 * Self-hosted by next/font at build time (no request to Google at runtime). Both locales share one root layout, so a
 * preload would reach every page: the Latin faces are preloaded, the Arabic faces load on demand (swap).
 */
export const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-mc-display", display: "swap" });

export const body = Inter({ subsets: ["latin"], variable: "--font-mc-body", display: "swap" });

export const displayAr = Tajawal({
  subsets: ["arabic"],
  weight: ["500", "700", "800"],
  variable: "--font-mc-display-ar",
  display: "swap",
  preload: false,
});

export const bodyAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500"],
  variable: "--font-mc-body-ar",
  display: "swap",
  preload: false,
});

export const fontVariables = [display, body, displayAr, bodyAr].map((font) => font.variable).join(" ");
