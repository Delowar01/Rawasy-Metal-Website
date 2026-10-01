import { useEffect, type RefObject } from "react";

/**
 * A modal dialog opens in the top layer, above the custom pointer (Cursor.tsx), and the page hides the system cursor
 * while that pointer is on: without help a mouse user would have no cursor inside the dialog. While the dialog is open
 * this marks the page (`html[data-cursor-modal]`): the custom pointer hides and the system cursor comes back inside the
 * dialog (system.css); when it closes, however it closes, the mark goes and the pointer returns. Touch, pens, keyboard
 * use and reduced motion are unaffected (the custom pointer is never on there).
 */
export function useDialogPointer(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const root = document.documentElement;
    const sync = () => root.toggleAttribute("data-cursor-modal", dialog.open);
    const observer = new MutationObserver(sync);
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    sync();
    return () => {
      observer.disconnect();
      root.removeAttribute("data-cursor-modal");
    };
  }, [ref]);
}
