"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Ambient motion (grid drift, scan lines) runs only while its element is on
 * screen: one IntersectionObserver toggles `data-live` on every `[data-live]`
 * element. It also rests while the page is being scrolled (`data-scrolling`
 * on <html>), when the page itself is moving, so scrolling stays smooth.
 * Nothing runs with reduced motion.
 */
export function LiveObserver() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.setAttribute("data-live", entry.isIntersecting ? "on" : "off");
      },
      { rootMargin: "80px 0px" },
    );
    const scan = () =>
      document.querySelectorAll("[data-live]").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    scan();
    // New ambient layers arrive with client navigation; text-only changes
    // (counters, live regions) are ignored, and rescans run once per frame.
    let queued = 0;
    const mo = new MutationObserver((records) => {
      if (queued || !records.some((r) => Array.from(r.addedNodes).some((n) => n.nodeType === Node.ELEMENT_NODE))) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const root = document.documentElement;
    let rest = 0;
    const onScroll = () => {
      if (rest) window.clearTimeout(rest);
      else root.setAttribute("data-scrolling", "");
      rest = window.setTimeout(() => {
        rest = 0;
        root.removeAttribute("data-scrolling");
      }, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(queued);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(rest);
      root.removeAttribute("data-scrolling");
    };
  }, [pathname]);

  return null;
}
