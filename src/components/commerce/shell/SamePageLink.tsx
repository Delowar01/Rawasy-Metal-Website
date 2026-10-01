"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/routes";

/**
 * A link to the address being viewed, in the given language — for a page that cannot know its address on the server
 * (the 404, which answers any unknown path). With `remember` it also stores the language choice, as LocaleLink does.
 */
export function SamePageLink({
  locale,
  remember = false,
  children,
  ...props
}: { locale: Locale; remember?: boolean; children: ReactNode } & Omit<React.ComponentProps<"a">, "href">) {
  const pathname = usePathname();
  const onClick = remember
    ? () => {
        document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
      }
    : undefined;
  return (
    <a {...props} href={switchLocalePath(pathname, locale)} onClick={onClick}>
      {children}
    </a>
  );
}
