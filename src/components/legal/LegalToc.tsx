"use client";

import { useScrollSpy } from "@/lib/use-scroll-spy";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Contents beside a legal document (desktop): a recessed rail that marks the
 * section being read and jumps to a section when its entry is chosen.
 */
export function LegalToc({ items, label }: { items: { id: string; title: string }[]; label: string }) {
  const [active, setActive] = useScrollSpy(
    items.map((item) => item.id),
    "-18% 0px -70% 0px",
  );

  return (
    <div className="panel-recessed sticky top-28 hidden p-5 lg:block">
      <p className="t-label border-b border-line pb-4 text-ink-2">{label}</p>
      <ol className="mt-4 border-s border-line">
        {items.map((item, i) => {
          const current = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => setActive(item.id)}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "relative grid grid-cols-[2rem_1fr] gap-x-2 py-1.5 ps-4 text-[0.92rem] leading-snug transition-colors duration-300",
                  current ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute -start-px inset-y-1 w-0.5 origin-top bg-accent transition-transform duration-500 ease-out-expo",
                    current ? "scale-y-100" : "scale-y-0",
                  )}
                />
                <span className={cn("t-num pt-0.5 text-[0.7rem]", current ? "text-ink" : "text-ink-2")}>{pad(i + 1)}</span>
                <span className={current ? "font-medium" : undefined}>{item.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
