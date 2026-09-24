"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CloseIcon, MailIcon, MenuIcon, PhoneIcon, WhatsAppIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSelect, ThemeToggle } from "./ThemeControls";

export interface HeaderNavItem {
  key: string;
  href: string;
  label: string;
}

export interface HeaderProps {
  locale: Locale;
  homeHref: string;
  items: HeaderNavItem[];
  quote: { href: string; label: string };
  contact: { phone: string; phoneHref: string; email: string; whatsappHref: string; whatsappLabel: string };
  labels: {
    mainNav: string;
    mobileNav: string;
    openMenu: string;
    closeMenu: string;
    homeLink: string;
    toDark: string;
    toLight: string;
    language: string;
    theme: string;
    light: string;
    dark: string;
    menu: string;
  };
}

function isActive(pathname: string, href: string, homeHref: string) {
  if (href === homeHref) return pathname === homeHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ locale, homeHref, items, quote, contact, labels }: HeaderProps) {
  const pathname = usePathname() || homeHref;
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Transparent → glass, and tuck away while scrolling down.
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        setHidden(y > 520 && y > last + 2);
        if (y < last - 2) setHidden(false);
        last = y;
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu when the route changes (state adjusted during render,
  // as React recommends, rather than in an effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  // Menu: scroll lock, Escape, focus trap, focus return.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    const menu = menuRef.current;
    const focusables = () =>
      Array.from(menu?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const list = [toggleRef.current, ...focusables()].filter(Boolean) as HTMLElement[];
      const first = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const toggle = toggleRef.current;
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [open]);

  const moveIndicator = useCallback((el: HTMLElement | null) => {
    const indicator = indicatorRef.current;
    if (!indicator) return;
    if (!el) {
      indicator.style.opacity = "0";
      return;
    }
    indicator.style.width = `${el.offsetWidth}px`;
    indicator.style.transform = `translateX(${el.offsetLeft}px)`;
    indicator.style.opacity = "1";
  }, []);

  return (
    <header
      className="site-header fixed inset-x-0 top-0 z-50 transition-transform duration-500 ease-out-expo"
      data-scrolled={scrolled || open ? "" : undefined}
      style={{ transform: hidden && !open ? "translateY(-100%)" : undefined }}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 border-b transition-[background-color,border-color,backdrop-filter] duration-500",
          scrolled && !open
            ? "border-line bg-[var(--glass)] backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-transparent",
        )}
      />
      <div className="container-x relative flex h-[var(--header-h)] items-center gap-6">
        <Link href={homeHref} aria-label={labels.homeLink} className="shrink-0 text-ink transition-opacity hover:opacity-80">
          <Logo className="h-9 w-auto sm:h-10" title={labels.homeLink} />
        </Link>

        <nav aria-label={labels.mainNav} className="mx-auto hidden xl:block">
          <ul ref={listRef} className="relative flex items-center" onMouseLeave={() => moveIndicator(null)}>
            <span
              ref={indicatorRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-1/2 -mt-[1.05rem] h-[2.1rem] bg-accent-soft opacity-0 transition-[transform,width,opacity] duration-500 ease-out-expo"
            />
            {items.map((item) => {
              const active = isActive(pathname, item.href, homeHref);
              return (
                <li key={item.key} className="relative">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={(e) => moveIndicator(e.currentTarget)}
                    onFocus={(e) => moveIndicator(e.currentTarget)}
                    onBlur={() => moveIndicator(null)}
                    className={cn(
                      "relative block px-3.5 py-2 font-display text-[0.84rem] font-medium transition-colors 2xl:px-4",
                      active ? "text-ink" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {item.label}
                    {active && <span aria-hidden className="absolute inset-x-3.5 -bottom-0.5 h-px bg-accent 2xl:inset-x-4" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2 sm:gap-3 xl:ms-0">
          <LanguageSwitcher locale={locale} label={labels.language} className="hidden sm:flex" />
          <ThemeToggle labels={{ toDark: labels.toDark, toLight: labels.toLight }} />
          <ButtonLink href={quote.href} size="sm" className="hidden md:inline-flex">
            {quote.label}
          </ButtonLink>
          <button
            ref={toggleRef}
            type="button"
            className="relative grid size-10 place-items-center text-ink xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? labels.closeMenu : labels.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="absolute inset-1 border border-line" aria-hidden />
            {open ? <CloseIcon /> : <MenuIcon className="rtl:-scale-x-100" />}
          </button>
        </div>
      </div>

      {/* Fullscreen mobile / tablet menu */}
      <div
        id="mobile-menu"
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label={labels.mobileNav}
        hidden={!open}
        className="mobile-menu fixed inset-x-0 bottom-0 top-[var(--header-h)] overflow-y-auto bg-background xl:hidden"
      >
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="container-x relative flex min-h-full flex-col pb-10 pt-6">
          <nav aria-label={labels.mainNav}>
            <ul className="border-t border-line">
              {items.map((item, i) => {
                const active = isActive(pathname, item.href, homeHref);
                return (
                  <li key={item.key} className="border-b border-line" style={{ ["--i" as string]: i }}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="menu-item group flex items-baseline gap-5 py-3.5 sm:py-4"
                    >
                      <span className="t-num w-7 text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      <span
                        className={cn(
                          "t-h3 transition-colors",
                          active ? "text-accent-ink" : "text-ink group-hover:text-accent-ink",
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
            <LanguageSwitcher locale={locale} label={labels.language} size="lg" />
            <ThemeSelect labels={{ legend: labels.theme, light: labels.light, dark: labels.dark }} />
          </div>

          <ButtonLink href={quote.href} className="mt-8 w-full justify-between">
            {quote.label}
          </ButtonLink>

          <div className="mt-auto grid gap-3 pt-10 text-sm text-ink-2">
            <a href={contact.phoneHref} className="flex items-center gap-3">
              <PhoneIcon size={16} className="text-accent-ink" />
              <span className="t-num" dir="ltr">
                {contact.phone}
              </span>
            </a>
            <a href={`mailto:${contact.email}`} className="flex items-center gap-3">
              <MailIcon size={16} className="text-accent-ink" />
              {contact.email}
            </a>
            <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
              <WhatsAppIcon size={16} className="text-accent-ink" />
              {contact.whatsappLabel}
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
