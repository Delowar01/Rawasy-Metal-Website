"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { whenIntroDone } from "./Loader";

/**
 * One IntersectionObserver for every `[data-reveal]` element on the page.
 * CSS does the animating (globals.css); elements are only hidden while JS runs.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    let io: IntersectionObserver | undefined;
    let mo: MutationObserver | undefined;

    const cancelIntro = whenIntroDone(() => {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.setAttribute("data-revealed", "");
              io?.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -7% 0px", threshold: 0.08 },
      );
      const scan = () =>
        document.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((el) => io?.observe(el));
      scan();
      mo = new MutationObserver(scan);
      mo.observe(document.body, { childList: true, subtree: true });
    });

    return () => {
      cancelIntro();
      io?.disconnect();
      mo?.disconnect();
    };
  }, [pathname]);

  return null;
}
