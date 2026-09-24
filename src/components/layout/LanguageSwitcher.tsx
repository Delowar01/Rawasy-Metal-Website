"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, localeConfig, locales, type Locale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/routes";
import { cn } from "@/lib/utils";

function remember(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * EN | عربي — links to the equivalent page in the other language (never back
 * to the homepage) and remembers the choice for future visits to "/".
 */
export function LanguageSwitcher({
  locale,
  label,
  className,
  size = "sm",
}: {
  locale: Locale;
  label: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  const pathname = usePathname() || `/${locale}`;
  return (
    <nav aria-label={label} className={cn("flex items-center", className)}>
      {locales.map((code, i) => {
        const active = code === locale;
        return (
          <span key={code} className="flex items-center">
            {i > 0 && (
              <span aria-hidden className="mx-1.5 h-3.5 w-px bg-line-strong" />
            )}
            <Link
              href={switchLocalePath(pathname, code)}
              hrefLang={localeConfig[code].htmlLang}
              lang={localeConfig[code].htmlLang}
              aria-current={active ? "true" : undefined}
              onClick={() => remember(code)}
              scroll={false}
              className={cn(
                "relative px-1.5 py-1 transition-colors",
                size === "lg" ? "text-lg" : "text-[0.8125rem]",
                code === "en" ? "font-mono tracking-[0.08em]" : "font-medium",
                active ? "text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {localeConfig[code].label}
              {active && <span aria-hidden className="absolute inset-x-1.5 -bottom-0.5 h-px bg-accent" />}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
