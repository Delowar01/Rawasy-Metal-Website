"use client";
/**
 * Keeps `--adm-bld-bar` on the builder's root at the height of its controls, so the preview (sticky on wide screens)
 * stays just below them however they wrap. Set through the CSS object model: the admin's CSP refuses style attributes.
 */
import { useEffect, type RefObject } from "react";

export function useStickyBar(root: RefObject<HTMLElement | null>, bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const r = root.current;
    const b = bar.current;
    if (!r || !b) return;
    const set = () => r.style.setProperty("--adm-bld-bar", `${Math.ceil(b.getBoundingClientRect().height)}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(b);
    return () => observer.disconnect();
  }, [root, bar]);
}
