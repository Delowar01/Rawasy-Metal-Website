export const locales = ["en", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie written by the language switcher so `/` resolves to the last choice. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeConfig: Record<
  Locale,
  { dir: "ltr" | "rtl"; label: string; htmlLang: string; ogLocale: string }
> = {
  en: { dir: "ltr", label: "EN", htmlLang: "en", ogLocale: "en_US" },
  ar: { dir: "rtl", label: "عربي", htmlLang: "ar-SA", ogLocale: "ar_SA" },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function getDirection(locale: Locale) {
  return localeConfig[locale].dir;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "ar" : "en";
}
