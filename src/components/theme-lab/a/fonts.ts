import { IBM_Plex_Sans_Arabic, Inter, Plus_Jakarta_Sans, Tajawal } from "next/font/google";

/*
 * Option A — Clean Premium Commerce.
 * English: Plus Jakarta Sans (display, 600–800) + Inter (body and UI).
 * Arabic:  Tajawal (headings and semibold UI, 500–800) + IBM Plex Sans Arabic (body, 400/500).
 * Loaded only on Option A pages; the Arabic faces are not preloaded on English pages.
 */
export const aDisplay = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-a-display", display: "swap" });
export const aBody = Inter({ subsets: ["latin"], variable: "--font-a-body", display: "swap" });
export const aDisplayAr = Tajawal({
  subsets: ["arabic"],
  weight: ["500", "700", "800"],
  variable: "--font-a-display-ar",
  display: "swap",
  preload: false,
});
export const aBodyAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500"],
  variable: "--font-a-body-ar",
  display: "swap",
  preload: false,
});

export const aFontClasses = [aDisplay, aBody, aDisplayAr, aBodyAr].map((f) => f.variable).join(" ");
