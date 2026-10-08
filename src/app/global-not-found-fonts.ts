import { IBM_Plex_Sans_Arabic, Inter, Plus_Jakarta_Sans, Tajawal } from "next/font/google";

/*
 * The Modern Commerce faces (see (commerce)/fonts.ts) for global-not-found.tsx, without preloads. With
 * experimental.globalNotFound that page sits in every route's module graph, so a preload declared here would be
 * emitted on every page. The fallback 404 loads the faces it shows on demand instead.
 */
export const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-mc-display", display: "swap", preload: false });

export const body = Inter({ subsets: ["latin"], variable: "--font-mc-body", display: "swap", preload: false });

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
