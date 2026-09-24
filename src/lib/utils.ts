import type { Locale } from "@/i18n/config";
import type { Localized } from "@/content/types";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Resolve a localized field. */
export function t<T>(value: Localized<T>, locale: Locale): T {
  return value[locale];
}

/** Format a wattage for display, e.g. 12000 → "12 kW" / "12 كيلوواط". */
export function formatPower(watts: number, locale: Locale) {
  const kw = watts / 1000;
  return locale === "ar" ? `${kw} كيلوواط` : `${kw} kW`;
}

export const THEME_STORAGE_KEY = "rawasy-theme";
export const INTRO_STORAGE_KEY = "rawasy-intro";
