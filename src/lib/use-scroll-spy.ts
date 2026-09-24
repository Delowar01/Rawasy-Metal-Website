"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which of the given sections is being read: the first one crossing a
 * band a little above the middle of the viewport. Above the first section
 * (back at the page intro), the first entry is marked again.
 */
export function useScrollSpy(ids: string[], rootMargin = "-30% 0px -60% 0px") {
  const key = ids.join("|");
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const targets = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
        else if (targets[0] && targets[0].getBoundingClientRect().top > 0) setActive(targets[0].id);
      },
      { rootMargin },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key, rootMargin]);

  return [active, setActive] as const;
}
