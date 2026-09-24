"use client";

import { useEffect, type MouseEvent } from "react";
import { useScrollSpy } from "@/lib/use-scroll-spy";

export interface SpyItem {
  id: string;
  index: string;
  name: string;
}

/**
 * Sticky index beside the service rows (desktop): marks the row being read and
 * scrolls to a row when its entry is chosen.
 */
export function ServiceScrollSpy({ items, label }: { items: SpyItem[]; label: string }) {
  const [active, setActive] = useScrollSpy(items.map((item) => item.id));

  // Mark the row being read, so its frame and edge can light up.
  useEffect(() => {
    for (const item of items) document.getElementById(item.id)?.toggleAttribute("data-active", item.id === active);
  }, [active, items]);

  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

  return (
    <nav aria-label={label} className="sticky top-28">
      <p className="t-label text-ink-2">{label}</p>
      <ol className="mt-5 border-s border-line">
        {items.map((item) => {
          const current = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => go(e, item.id)}
                aria-current={current ? "true" : undefined}
                className={`relative flex items-baseline gap-3 py-2.5 ps-5 text-[0.95rem] transition-colors duration-300 ${
                  current ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute -start-px inset-y-1 w-0.5 origin-top bg-accent transition-transform duration-500 ease-out-expo ${
                    current ? "scale-y-100" : "scale-y-0"
                  }`}
                />
                <span className="t-num text-[0.7rem]">{item.index}</span>
                <span className={current ? "font-display font-medium" : ""}>{item.name}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
