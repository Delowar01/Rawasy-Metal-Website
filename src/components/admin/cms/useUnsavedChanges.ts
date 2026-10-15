"use client";
/**
 * Warns before unsaved edits are lost (A3 brief §48): while `dirty`, leaving the page through a link inside the admin
 * asks for confirmation, and closing or reloading the tab triggers the browser's own warning. In-page links (the
 * editor's section links), new tabs and modified clicks pass through. Back and forward are not intercepted (Next.js has
 * no supported way to hold them); the browser warning still covers a reload or closing the tab.
 */
import { useEffect } from "react";

export const UNSAVED_MESSAGE = "You have unsaved changes. Leave this page and lose them?";

export function useUnsavedChanges(dirty: boolean, message = UNSAVED_MESSAGE) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers show the warning only when returnValue is set.
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase on the document: runs before Next.js's link handler (on the React root), so a cancelled click never
    // starts a client-side navigation.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
