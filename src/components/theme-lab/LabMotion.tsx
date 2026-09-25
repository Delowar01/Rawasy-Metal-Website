"use client";

import { useEffect } from "react";

/**
 * The lab's only script: reveals content as it scrolls into view, marks the
 * page as scrolled (header blur and shadow), highlights the nav link of the
 * section in view, and closes the mobile menu after a link is chosen.
 * Everything works without it; it only adds motion and state.
 */
export function LabMotion() {
  useEffect(() => {
    const root = document.documentElement;

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

    const onScroll = () => root.toggleAttribute("data-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

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

    const menus = [...document.querySelectorAll<HTMLDetailsElement>("details[data-menu]")];
    const close = () => menus.forEach((menu) => (menu.open = false));
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest("details[data-menu] a")) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);

    return () => {
      reveal.disconnect();
      spy.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
