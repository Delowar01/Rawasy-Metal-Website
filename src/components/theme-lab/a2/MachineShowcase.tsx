"use client";

import { useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";
import type { LabData } from "../data";
import { Icon } from "../Icon";
import { Cutout } from "../ui";

type Machine = LabData["machinery"]["items"][number];

const subscribe = () => () => {};

/** Where the stage spotlight sits for each machine, so the light glides as the selection changes. */
const SPOT = ["50%", "42%", "58%", "46%", "54%", "40%"];

/**
 * Machinery showcase: one machine on a lit stage, the rest in a selector rail.
 * Choosing a machine crossfades the stage, settles its photo and reveals its
 * spec badges. Without JavaScript the rail links target the panels (`:target`).
 */
export function MachineShowcase({
  items,
  labels,
  quote,
}: {
  items: Machine[];
  labels: { power: string; service: string; list: string; quote: string };
  quote: string;
}) {
  const [active, setActive] = useState(0);
  // False in the server HTML and during hydration, true once the client has taken over.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);

  const choose = (event: MouseEvent<HTMLAnchorElement>, index: number) => {
    event.preventDefault();
    setActive(index);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <div className="a2-mx-stage lg:col-span-8" data-js={ready ? "" : undefined} style={{ "--spot-x": SPOT[active % SPOT.length] } as CSSProperties}>
        {items.map((m, i) => (
          <article key={m.slug} id={`m-${m.slug}`} className={`a2-mx-panel${ready && i === active ? " is-active" : ""}`} aria-hidden={ready && i !== active ? true : undefined}>
            <div className="a2-mx-img">
              <Cutout image={m.image} sizes="(min-width: 1024px) 520px, 88vw" className="h-auto max-h-[15rem] w-auto max-w-[92%] object-contain sm:max-h-[17rem]" />
              <span className="badge badge-light absolute start-4 top-4 z-[2]">
                <Icon name="machine" size={14} />
                {m.category}
              </span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-line-subtle bg-surface/85 p-5 sm:p-6">
              <div className="min-w-0">
                <h3 className="t-h3">
                  <a href={m.href} className="link-arrow no-underline hover:underline" tabIndex={ready && i !== active ? -1 : undefined}>
                    {m.name}
                    <Icon name="arrow" size={17} />
                  </a>
                </h3>
                <p className="t-small mt-1.5 max-w-[34em]">{m.capability}</p>
                <div className="a2-mx-spec mt-4 flex flex-wrap items-center gap-2">
                  {m.power && (
                    <span className="tag tag-tone" data-tone="brand">
                      <Icon name="power" size={14} />
                      <span>
                        {labels.power} · <span dir="ltr">{m.power.value}</span> {m.power.unit}
                      </span>
                    </span>
                  )}
                  <span className="tag" data-tone="steel">
                    <Icon name="layers" size={14} className="text-steel" />
                    {labels.service} · {m.service.name}
                  </span>
                </div>
              </div>
              <a href={quote} className="btn btn-primary" tabIndex={ready && i !== active ? -1 : undefined}>
                {labels.quote}
                <Icon name="arrow" size={17} />
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="lg:col-span-4">
        <ul className="rail -mx-[var(--gutter)] flex gap-2.5 overflow-x-auto px-[var(--gutter)] pb-2 lg:mx-0 lg:grid lg:grid-cols-1 lg:gap-2.5 lg:overflow-visible lg:px-0 lg:pb-0" aria-label={labels.list}>
          {items.map((m, i) => (
            <li key={m.slug} className="w-[16.5rem] shrink-0 lg:w-auto">
              <a href={`#m-${m.slug}`} className="a2-mx-pick" aria-controls={`m-${m.slug}`} aria-current={i === active ? "true" : undefined} onClick={(e) => choose(e, i)}>
                <span className="a2-mx-thumb">
                  <Cutout image={m.image} sizes="84px" className="h-auto max-h-[2.9rem] w-auto max-w-[88%] object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.92rem] font-semibold leading-snug">{m.name}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    {m.power ? (
                      <span className="badge-power tag tag-tone min-h-0 px-1.5 py-0.5 text-[0.74rem]" data-tone="brand">
                        <span dir="ltr">{m.power.value}</span> {m.power.unit}
                      </span>
                    ) : (
                      <span className="truncate text-[0.8rem] text-ink-2">{m.category}</span>
                    )}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
