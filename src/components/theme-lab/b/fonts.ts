import { Alexandria, Geist_Mono, Inter, Noto_Sans_Arabic, Outfit } from "next/font/google";

/*
 * Option B — Bold Industrial Commerce.
 * English: Outfit (display, 700/800) + Inter (body and UI) + Geist Mono (machine figures only).
 * Arabic:  Alexandria (headings and bold UI, 600–800) + Noto Sans Arabic (body, 400/600).
 * Loaded only on Option B pages; the Arabic faces are not preloaded on English pages.
 */
export const bDisplay = Outfit({ subsets: ["latin"], variable: "--font-b-display", display: "swap" });
export const bBody = Inter({ subsets: ["latin"], variable: "--font-b-body", display: "swap" });
export const bMono = Geist_Mono({ subsets: ["latin"], variable: "--font-b-mono", display: "swap", preload: false });
export const bDisplayAr = Alexandria({ subsets: ["arabic"], variable: "--font-b-display-ar", display: "swap", preload: false });
export const bBodyAr = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-b-body-ar",
  display: "swap",
  preload: false,
});

export const bFontClasses = [bDisplay, bBody, bMono, bDisplayAr, bBodyAr].map((f) => f.variable).join(" ");
