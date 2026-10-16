"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

/**
 * The header's language links inside the preview: the same preview in the other language (the address keeps its theme,
 * screen size and canvas mode). It never stores the visitor's language choice (`remember` is ignored): the preview is
 * not the website.
 */
export function PreviewLanguageLink({
  locale,
  remember: _remember,
  children,
  ...props
}: { locale: "en" | "ar"; remember?: boolean; children: ReactNode } & Omit<ComponentProps<"a">, "href">) {
  void _remember;
  const pathname = usePathname();
  const params = new URLSearchParams(useSearchParams().toString());
  params.set("locale", locale);
  return (
    <a {...props} href={`${pathname}?${params}`} data-preview-locale={locale}>
      {children}
    </a>
  );
}
