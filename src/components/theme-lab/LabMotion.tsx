"use client";

import { useEffect } from "react";

/**
 * The lab's only shared script: reveals content as it scrolls into view, marks
 * the page as scrolled (header blur and shadow), highlights the nav link of the
 * section in view, and closes the mobile menu after a link is chosen.
 * A V2 adds, through its own attributes (A, B and C do not use them): a pointer
 * parallax (`data-parallax`), a header shadow once past the hero (`data-hero`),
 * ambient motion only while on screen (`data-ambient`), dropdowns
 * (`details[data-dropdown]`), toggle buttons (`data-toggle`) and a full-height
 * menu sheet (`details[data-menu][data-sheet]`).
 * Everything works without it; it only adds motion and state.
 */
export function LabMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const cleanups: (() => void)[] = [];
    const listen = <K extends keyof DocumentEventMap>(type: K, handler: (event: DocumentEventMap[K]) => void) => {
      document.addEventListener(type, handler);
      cleanups.push(() => document.removeEventListener(type, handler));
    };

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "");
          reveal.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => reveal.observe(el));
    cleanups.push(() => reveal.disconnect());

    const onScroll = () => root.toggleAttribute("data-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    const links = new Map<string, HTMLElement[]>();
    document.querySelectorAll<HTMLElement>("[data-spy-link]").forEach((link) => {
      const id = link.dataset.spyLink!;
      links.set(id, [...(links.get(id) ?? []), link]);
    });
    // The section crossing the middle band of the viewport is active; none (e.g. the hero) clears it.
    const inView = new Set<string>();
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inView.add(entry.target.id);
          else inView.delete(entry.target.id);
        }
        const active = [...links.keys()].filter((id) => inView.has(id)).pop();
        links.forEach((group, id) => group.forEach((link) => link.toggleAttribute("data-active", id === active)));
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    links.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    });
    cleanups.push(() => spy.disconnect());

    const menus = [...document.querySelectorAll<HTMLDetailsElement>("details[data-menu]")];
    const dropdowns = [...document.querySelectorAll<HTMLDetailsElement>("details[data-dropdown]")];
    const close = () => menus.forEach((menu) => (menu.open = false));
    listen("keydown", (event) => {
      if (event.key !== "Escape") return;
      // A V2: Escape returns focus to the control that opened the panel.
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

    // A V2 menu sheet: it fills the viewport below the header, wherever the header sits.
    menus
      .filter((m) => m.hasAttribute("data-sheet"))
      .forEach((m) => {
        const onToggle = () => {
          const header = m.closest("header");
          if (m.open && header) m.style.setProperty("--menu-top", `${Math.max(header.getBoundingClientRect().bottom, 0)}px`);
        };
        m.addEventListener("toggle", onToggle);
        cleanups.push(() => m.removeEventListener("toggle", onToggle));
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

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Past the hero: the header gains its shadow.
    document.querySelectorAll<HTMLElement>("[data-hero]").forEach((hero) => {
      const io = new IntersectionObserver(([entry]) => root.toggleAttribute("data-past-hero", !entry.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
      io.observe(hero);
      cleanups.push(() => io.disconnect());
    });

    // Ambient motion (the hero's light) runs only while its section is on screen.
    const ambient = new IntersectionObserver((entries) => entries.forEach((e) => e.target.toggleAttribute("data-live", e.isIntersecting)));
    document.querySelectorAll("[data-ambient]").forEach((el) => ambient.observe(el));
    cleanups.push(() => ambient.disconnect());

    // Pointer parallax: desktop mouse only, never with reduced motion. CSS eases the movement.
    if (!calm && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        let frame = 0;
        const onMove = (event: PointerEvent) => {
          if (event.pointerType !== "mouse" || frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            const r = el.getBoundingClientRect();
            el.style.setProperty("--px", (((event.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
            el.style.setProperty("--py", (((event.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
          });
        };
        const onLeave = () => {
          cancelAnimationFrame(frame);
          frame = 0;
          el.style.setProperty("--px", "0");
          el.style.setProperty("--py", "0");
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          cancelAnimationFrame(frame);
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
        });
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
