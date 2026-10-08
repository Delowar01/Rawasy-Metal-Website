"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The Modern Commerce pages' one motion and state script. It reveals content as it scrolls into view, marks the page
 * as scrolled and past the hero (the header's shadow), rests the site-wide ambient while the page scrolls
 * (`data-scrolling` on the root) or is hidden (`data-page-hidden`), runs a section's own ambient motion only while it
 * is on screen and the page is visible (`data-live` on `[data-ambient]`: the hero plate's hot points, the machinery
 * console), and drives the header's disclosures — the Services dropdown (`details[data-dropdown]`) and the phone menu
 * sheet (`details[data-menu][data-sheet]`) — and the toggle buttons (`button[data-toggle]`). The signature animations
 * and the hero plate run their own clocks (useSignature), and the pointer is Cursor.tsx. Everything works without it;
 * it only adds motion and state.
 */
export function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const cleanups: (() => void)[] = [];
    const listen = <K extends keyof DocumentEventMap>(type: K, handler: (event: DocumentEventMap[K]) => void) => {
      document.addEventListener(type, handler);
      cleanups.push(() => document.removeEventListener(type, handler));
    };

    const show = (el: Element) => {
      el.setAttribute("data-shown", "");
      reveal.unobserve(el);
    };
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          // A rail that scrolls sideways (phones) shows all its cards with the first ones, so a swipe never lands on a
          // card that is only beginning to appear.
          const rail = entry.target.closest(".rail");
          if (rail && rail.scrollWidth > rail.clientWidth) rail.querySelectorAll("[data-reveal]:not([data-shown])").forEach(show);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => reveal.observe(el));
    cleanups.push(() => reveal.disconnect());

    const scrolled = () => root.toggleAttribute("data-scrolled", window.scrollY > 8);
    scrolled();
    // While the page scrolls, the site-wide ambient rests; it resumes 200 ms after the last scroll event.
    let settle = 0;
    const onScroll = () => {
      scrolled();
      if (!root.hasAttribute("data-scrolling")) root.setAttribute("data-scrolling", "");
      clearTimeout(settle);
      settle = window.setTimeout(() => root.removeAttribute("data-scrolling"), 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(settle);
      root.removeAttribute("data-scrolling");
    });

    const menus = [...document.querySelectorAll<HTMLDetailsElement>("details[data-menu]")];
    const dropdowns = [...document.querySelectorAll<HTMLDetailsElement>("details[data-dropdown]")];
    const close = () => menus.forEach((menu) => (menu.open = false));
    listen("keydown", (event) => {
      if (event.key !== "Escape") return;
      // Escape closes the open panel and returns focus to the control that opened it.
      const open = [...dropdowns, ...menus.filter((m) => m.hasAttribute("data-sheet"))].find((d) => d.open);
      close();
      dropdowns.forEach((d) => (d.open = false));
      open?.querySelector("summary")?.focus();
    });
    listen("click", (event) => {
      const target = event.target as Element;
      if (target.closest("details[data-menu] a")) close();
      dropdowns.forEach((d) => {
        if (!d.contains(target) || target.closest("a")) d.open = false;
      });
    });

    // One dropdown at a time; a dropdown left by keyboard closes.
    dropdowns.forEach((d) => {
      const onToggle = () => d.open && dropdowns.forEach((other) => other !== d && (other.open = false));
      const onFocusOut = (event: FocusEvent) => {
        if (!d.contains(event.relatedTarget as Node | null)) d.open = false;
      };
      d.addEventListener("toggle", onToggle);
      d.addEventListener("focusout", onFocusOut);
      cleanups.push(() => {
        d.removeEventListener("toggle", onToggle);
        d.removeEventListener("focusout", onFocusOut);
      });
    });

    // The phone menu sheet fills the viewport below the header, wherever the header sits. Focus that moves on to
    // something outside it (Tab past its last link) closes it, so the keyboard never lands on content hidden under it.
    menus
      .filter((m) => m.hasAttribute("data-sheet"))
      .forEach((m) => {
        const onToggle = () => {
          const header = m.closest("header");
          if (m.open && header) m.style.setProperty("--menu-top", `${Math.max(header.getBoundingClientRect().bottom, 0)}px`);
        };
        const onFocusOut = (event: FocusEvent) => {
          const next = event.relatedTarget as Node | null;
          if (m.open && next && !m.contains(next)) m.open = false;
        };
        m.addEventListener("toggle", onToggle);
        m.addEventListener("focusout", onFocusOut);
        cleanups.push(() => {
          m.removeEventListener("toggle", onToggle);
          m.removeEventListener("focusout", onFocusOut);
        });
      });

    // Keyboard focus inside a row that scrolls sideways (the machine selectors, the projects' category bar, the phone
    // rails): the row moves at once, as the browser's own focus scroll does, until the focused item shows whole. The
    // browser leaves the row where it is while 32 px of the item already show, which kept a focused item's name off
    // screen (Stage 1J). Only the row moves, never the page.
    listen("focusin", (event) => {
      const item = event.target;
      if (!(item instanceof HTMLElement) || !item.matches(":focus-visible")) return;
      for (let row = item.parentElement; row && row !== document.body; row = row.parentElement) {
        if (row.scrollWidth <= row.clientWidth || !/(auto|scroll)/.test(getComputedStyle(row).overflowX)) continue;
        const card = item.getBoundingClientRect();
        const box = row.getBoundingClientRect();
        const rtl = getComputedStyle(row).direction === "rtl";
        // An item wider than the row shows its start edge.
        const tooWide = card.width > box.width - 16;
        const by =
          (tooWide ? !rtl : card.left < box.left) ? card.left - box.left - 8 : (tooWide ? rtl : card.right > box.right) ? card.right - box.right + 8 : 0;
        if (by) row.scrollBy({ left: by, behavior: "instant" });
        return;
      }
    });

    // Toggle buttons: pressed state on the button, `data-<name>` on the element it controls.
    document.querySelectorAll<HTMLButtonElement>("button[data-toggle]").forEach((button) => {
      const target = document.getElementById(button.getAttribute("aria-controls") ?? "");
      const name = `data-${button.dataset.toggle}`;
      const onClick = () => {
        const on = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(on));
        target?.toggleAttribute(name, on);
      };
      button.addEventListener("click", onClick);
      cleanups.push(() => button.removeEventListener("click", onClick));
    });

    // Past the hero: the header gains its shadow.
    document.querySelectorAll<HTMLElement>("[data-hero]").forEach((hero) => {
      const io = new IntersectionObserver(([entry]) => root.toggleAttribute("data-past-hero", !entry.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
      io.observe(hero);
      cleanups.push(() => io.disconnect());
    });

    // A section's own ambient motion (the hero plate's hot points, the console's scan) runs only while the section is on
    // screen and the page is visible; the site-wide ambient rests while the page is hidden, as it does while it scrolls.
    const onScreen = new Map<Element, boolean>();
    const visible = () => document.visibilityState === "visible";
    const ambient = new IntersectionObserver((entries) =>
      entries.forEach((e) => {
        onScreen.set(e.target, e.isIntersecting);
        e.target.toggleAttribute("data-live", e.isIntersecting && visible());
      }),
    );
    document.querySelectorAll("[data-ambient]").forEach((el) => ambient.observe(el));
    cleanups.push(() => ambient.disconnect());
    const onVisibility = () => {
      root.toggleAttribute("data-page-hidden", !visible());
      onScreen.forEach((seen, el) => el.toggleAttribute("data-live", seen && visible()));
    };
    onVisibility();
    listen("visibilitychange", onVisibility);
    cleanups.push(() => root.removeAttribute("data-page-hidden"));

    return () => cleanups.forEach((fn) => fn());
  }, [pathname]);

  return null;
}
