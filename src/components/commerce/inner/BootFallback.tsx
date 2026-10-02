"use client";

import { useEffect } from "react";
import { commerceBoot } from "@/lib/commerce-boot";
import { THEME_STORAGE_KEY } from "@/lib/utils";

/**
 * A page built in the browser (Next.js renders a 404 raised during a dynamic render on the client) never runs the
 * inline boot script in <head>, and its tab shows the layout's default title instead of the one the server sent. This
 * runs the same boot once after mount, so the visitor's theme and the script-only controls still apply, and restores
 * the page's title. It changes nothing on a page the server rendered (the script already ran, the title is right).
 */
export function BootFallback({ title }: { title?: string }) {
  useEffect(() => {
    if (!document.documentElement.classList.contains("js")) commerceBoot(THEME_STORAGE_KEY);
    if (title && document.title !== title) document.title = title;
  }, [title]);
  return null;
}
