"use client";

import { useEffect, useState, type MouseEvent } from "react";

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
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const targets = items.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

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
      <p className="t-label text-ink-3">{label}</p>
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
                  current ? "text-ink" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute -start-px inset-y-1 w-0.5 origin-top bg-accent transition-transform duration-500 ease-out-expo ${
                    current ? "scale-y-100" : "scale-y-0"
                  }`}
                />
                <span className={`t-num text-[0.7rem] ${current ? "text-accent-ink" : ""}`}>{item.index}</span>
                <span className={current ? "font-display font-medium" : ""}>{item.name}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
