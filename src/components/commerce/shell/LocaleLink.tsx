"use client";

import type { ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

/**
 * A link to the same page in another language that also remembers the choice (the website's locale cookie), so "/"
 * opens in that language next time. A plain link: the other language is a full page load (its own direction and
 * fonts), cross-faded where the browser supports it.
 */
export function LocaleLink({ locale, children, ...props }: { locale: Locale; children: ReactNode } & React.ComponentProps<"a">) {
  const remember = () => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <a {...props} onClick={remember}>
      {children}
    </a>
  );
}
