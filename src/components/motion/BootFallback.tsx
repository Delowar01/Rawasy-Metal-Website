"use client";

import { useEffect } from "react";
import { boot, hasBooted } from "@/lib/boot-script";
import { INTRO_STORAGE_KEY, THEME_STORAGE_KEY } from "@/lib/utils";
import { INTRO_DONE_EVENT } from "./Loader";

/**
 * Some pages (e.g. a 404 raised during a dynamic render) are rendered on the
 * client, where the inline <head> boot script never executes. Run the same
 * logic once after mount so theme and motion flags are still applied.
 */
export function BootFallback() {
  useEffect(() => {
    if (!hasBooted()) {
      document.documentElement.classList.add("no-loader");
      boot(THEME_STORAGE_KEY, INTRO_STORAGE_KEY);
      window.__rawasyIntroDone = true;
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
    }
  }, []);
  return null;
}
