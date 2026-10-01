"use client";

import { useEffect } from "react";

/**
 * Over an embedded frame (the map) the page stops receiving mouse events, so the Modern Commerce pointer (Cursor.tsx)
 * would stay frozen at the frame's edge. While the mouse is over an iframe this marks the page (`data-cursor-away` on
 * <html>), which hides the pointer; inside, the frame shows its own cursor. Back on the page, the next `pointerover`
 * clears the mark and the pointer follows again. Mouse only. Cursor.tsx itself is unchanged, so the homepage's code stays
 * as approved; this runs only on the pages that embed a frame.
 */
export function FramePointer() {
  useEffect(() => {
    const root = document.documentElement;
    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      root.toggleAttribute("data-cursor-away", event.target instanceof HTMLIFrameElement);
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    return () => {
      document.removeEventListener("pointerover", onOver);
      root.removeAttribute("data-cursor-away");
    };
  }, []);
  return null;
}
