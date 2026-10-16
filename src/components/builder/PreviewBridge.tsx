"use client";

import { useEffect, useRef, useState } from "react";
import { isBuilderMessage, type PreviewMapEntry, type PreviewToBuilder } from "@/server/admin/actions/preview-protocol";

/*
 * The preview's side of the page builder (A5 brief §29, §36): it finds each section on the page (`data-section` on the
 * generic blocks; the anchor, or an id the approved component renders, on the bespoke ones; otherwise the elements
 * between its neighbours), outlines the section the builder selects or the pointer is over, and — inside the builder's
 * canvas (`frame`) — tells the builder which section was clicked, and keeps the frame on this page: links do not navigate
 * away (the builder says why), and the header's language and theme controls change the builder's view instead. Opened in
 * a tab of its own, the preview's links work, and the theme control reloads it in the other theme. Nothing it draws is
 * part of the page: one fixed layer, ignored by the pointer and by assistive technology.
 */

type Found = { id: string; elements: Element[] };

function topLevel(el: Element, main: Element): Element {
  let node: Element = el;
  while (node.parentElement && node.parentElement !== main) node = node.parentElement;
  return node.parentElement === main ? node : el;
}

/** Where each section is drawn (top-level elements of `main`, in page order). */
function locate(map: PreviewMapEntry[]): Found[] {
  const main = document.getElementById("main");
  if (!main) return [];
  const direct = (el: Element | null): Element | null => {
    if (!el || !main.contains(el)) return null;
    const section = el.closest("section, .ip-hero, [data-section]");
    return section && main.contains(section) ? section : topLevel(el, main);
  };
  const found: (Found | null)[] = map.map((entry) => {
    const own = main.querySelectorAll(`[data-section="${CSS.escape(entry.id)}"]`);
    if (own.length) return { id: entry.id, elements: [...own] };
    for (const id of [entry.anchor, ...entry.ids]) {
      if (!id) continue;
      const el = direct(document.getElementById(id));
      if (el) return { id: entry.id, elements: [el] };
    }
    return null;
  });
  // A section without an id of its own: the top-level elements between its neighbours.
  const children = [...main.children];
  found.forEach((entry, i) => {
    if (entry) return;
    const before = found
      .slice(0, i)
      .reverse()
      .find((f) => f);
    const after = found.slice(i + 1).find((f) => f);
    const start = before ? children.indexOf(topLevel(before.elements[before.elements.length - 1], main)) + 1 : 0;
    const end = after ? children.indexOf(topLevel(after.elements[0], main)) : children.length;
    const between = children.slice(Math.max(start, 0), end < 0 ? children.length : end).filter((el) => !found.some((f) => f?.elements.includes(el)));
    if (between.length) found[i] = { id: map[i].id, elements: between };
  });
  return found.filter((f): f is Found => f !== null);
}

const rectOf = (elements: Element[]) => {
  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    bottom = Math.max(bottom, r.bottom);
    right = Math.max(right, r.right);
  }
  return top === Infinity ? null : { top, left, width: right - left, height: bottom - top };
};

export function PreviewBridge({ map, frame }: { map: PreviewMapEntry[]; frame: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({});
  const found = useRef<Found[]>([]);

  // Find the sections once the page has drawn, and tell the builder which were found.
  useEffect(() => {
    found.current = locate(map);
    if (frame && window.parent !== window) {
      const ids = new Set(found.current.map((f) => f.id));
      post({ source: "rawasy-preview", type: "ready", found: [...ids], missing: map.filter((m) => !ids.has(m.id)).map((m) => m.id) });
    }
  }, [map, frame]);

  // Keep the outlines on their sections while the page scrolls, resizes or reveals content.
  useEffect(() => {
    const ids = [selected, hovered].filter((v): v is string => Boolean(v));
    if (!ids.length) return;
    let frameId = 0;
    const measure = () => {
      const next: typeof boxes = {};
      for (const id of ids) {
        const entry = found.current.find((f) => f.id === id);
        const rect = entry && rectOf(entry.elements);
        if (rect) next[id] = rect;
      }
      setBoxes(next);
    };
    const schedule = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [selected, hovered]);

  // The builder's messages: select (and scroll to) or point at a section.
  useEffect(() => {
    if (!frame) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin || !isBuilderMessage(event.data)) return;
      const message = event.data;
      if (message.type === "hover") setHovered(message.id);
      if (message.type === "select") {
        setSelected(message.id);
        if (message.id && message.scroll) {
          const entry = found.current.find((f) => f.id === message.id);
          const first = entry?.elements[0];
          if (first) {
            const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
            const top = first.getBoundingClientRect().top + window.scrollY - 88;
            window.scrollTo({ top: Math.max(top, 0), behavior: reduced ? "instant" : "smooth" });
          }
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame]);

  // Clicks: inside the canvas a click picks its section, links stay on this page; the header's language and theme
  // controls change the builder's view. In a tab of its own only the theme control is taken over (the preview's theme).
  useEffect(() => {
    const sectionAt = (target: Element) => found.current.find((f) => f.elements.some((el) => el === target || el.contains(target)))?.id ?? null;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const themeButton = target.closest(".a2-header .seg[role='group'] button, .a2-sheet .seg[role='group'] button");
      if (themeButton) {
        event.preventDefault();
        event.stopPropagation();
        const theme = themeButton.previousElementSibling ? "dark" : "light";
        if (frame) post({ source: "rawasy-preview", type: "theme", theme });
        else {
          const url = new URL(window.location.href);
          url.searchParams.set("theme", theme);
          window.location.assign(url.toString());
        }
        return;
      }
      if (!frame) return;
      const language = target.closest("a[data-preview-locale]");
      if (language) {
        event.preventDefault();
        event.stopPropagation();
        post({ source: "rawasy-preview", type: "locale", locale: language.getAttribute("data-preview-locale") === "ar" ? "ar" : "en" });
        return;
      }
      const link = target.closest("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (link && !href.startsWith("#")) {
        event.preventDefault();
        post({ source: "rawasy-preview", type: "link", href: link instanceof HTMLAnchorElement ? link.href : href });
      }
      const id = sectionAt(target);
      if (id) {
        setSelected(id);
        post({ source: "rawasy-preview", type: "pick", id });
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      if (!frame) return;
      event.preventDefault();
      post({ source: "rawasy-preview", type: "link", href: "form" });
    };
    const onOver = (event: PointerEvent) => {
      if (!frame || event.pointerType !== "mouse") return;
      const target = event.target instanceof Element ? event.target : null;
      setHovered(target ? sectionAt(target) : null);
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("submit", onSubmit, true);
    window.addEventListener("pointerover", onOver, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pointerover", onOver, true);
    };
  }, [frame]);

  const label = (id: string) => map.find((m) => m.id === id);
  const shown = [hovered && hovered !== selected ? { id: hovered, kind: "hover" } : null, selected ? { id: selected, kind: "selected" } : null].filter(
    (v): v is { id: string; kind: string } => v !== null,
  );
  return (
    <div className="gb-bridge" aria-hidden lang="en" dir="ltr">
      {shown.map(({ id, kind }) => {
        const box = boxes[id];
        const entry = label(id);
        if (!box || !entry) return null;
        return (
          <div key={`${kind}-${id}`} className="gb-bridge-box" data-kind={kind} style={{ top: box.top, left: box.left, width: box.width, height: box.height }}>
            <span className="gb-bridge-label">
              {entry.label}
              {entry.notes.length ? ` · ${entry.notes.length} note${entry.notes.length === 1 ? "" : "s"}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function post(message: PreviewToBuilder) {
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
}
