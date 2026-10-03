"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";
import { MACHINE_EVENT } from "./machine-address";

const subscribe = (onChange: () => void) => {
  const events = ["hashchange", "popstate", MACHINE_EVENT];
  events.forEach((type) => window.addEventListener(type, onChange));
  return () => events.forEach((type) => window.removeEventListener(type, onChange));
};

/** The address's fragment when it names one of the page's machines (#<slug>), otherwise none. */
const machineFragment = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  return id && document.getElementById(id)?.hasAttribute("data-machine") ? `#${id}` : "";
};

/**
 * The Capabilities page's language links (passed to the header as its `sameAddressLink`, so no other page loads this
 * code): the page in the given language, keeping the machine the address names — /en/capabilities#fiber-laser-6kw ↔
 * /ar/capabilities#fiber-laser-6kw; machine slugs are the same in both languages. The page's address comes from the
 * path being viewed with its language swapped (the routes module stays out of this one, as SamePageLink keeps it out of
 * the 404's bundle). From the server and without script the link is the plain page address. With `remember` it also
 * stores the language choice, as LocaleLink does.
 */
export function MachineAddressLink({
  locale,
  remember = false,
  children,
  ...props
}: { locale: Locale; remember?: boolean; children: ReactNode } & Omit<React.ComponentProps<"a">, "href">) {
  const pathname = usePathname();
  const fragment = useSyncExternalStore(subscribe, machineFragment, () => "");
  const [, first, ...rest] = pathname.split("/");
  const page = locales.includes(first as Locale) ? ["", locale, ...rest].join("/") : `/${locale}${pathname}`;
  const onClick = remember
    ? () => {
        document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
      }
    : undefined;
  return (
    <a {...props} href={`${page}${fragment}`} onClick={onClick}>
      {children}
    </a>
  );
}
