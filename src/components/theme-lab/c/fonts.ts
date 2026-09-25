import { DM_Sans, Readex_Pro, Urbanist } from "next/font/google";

/*
 * Option C — Minimal Luxury Commerce.
 * English: Urbanist (display, 500/600 at large sizes) + DM Sans (body and UI).
 * Arabic:  Readex Pro for headings and body (one family, 400–600).
 * Loaded only on Option C pages; the Arabic face is not preloaded on English pages.
 */
export const cDisplay = Urbanist({ subsets: ["latin"], variable: "--font-c-display", display: "swap" });
export const cBody = DM_Sans({ subsets: ["latin"], variable: "--font-c-body", display: "swap" });
export const cAr = Readex_Pro({ subsets: ["arabic"], variable: "--font-c-ar", display: "swap", preload: false });

export const cFontClasses = [cDisplay, cBody, cAr].map((f) => f.variable).join(" ");
