"use client";

import { useId, useState } from "react";
import { useScrollSpy } from "@/lib/use-scroll-spy";
import { Icon } from "../Icon";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The contents of a long page, as one labelled list: pinned beside the text on large screens (it stays below the
 * header and scrolls on its own if it is taller than the screen), a disclosure above the text on smaller ones (a
 * button with `aria-expanded`). The section being read is marked (`aria-current`). Without script the list is simply
 * open and the toggle is not shown.
 */
export function ContentsNav({ label, items }: { label: string; items: { id: string; title: string }[] }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useScrollSpy(
    items.map((item) => item.id),
    "-18% 0px -70% 0px",
  );

  return (
    <nav aria-label={label} className="ip-toc card">
      <button type="button" className="ip-toc-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)} data-js-only>
        {label}
        <Icon name="chevron" size={18} className="chev" />
      </button>
      <p className="ip-toc-title" aria-hidden>
        {label}
      </p>
      <ol id={listId} className="ip-toc-list" data-collapsed={open ? undefined : ""}>
        {items.map((item, i) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={active === item.id ? "true" : undefined} onClick={() => setActive(item.id)}>
              <span className="ip-toc-n">{pad(i + 1)}</span>
              <span>{item.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
