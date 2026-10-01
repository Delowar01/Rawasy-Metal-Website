"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon, type IconName } from "../Icon";
import type { Tone } from "../types";

export interface SectorItem {
  slug: string;
  /** The sector's number in the list ("01"). */
  index: string;
  name: string;
  description: string;
  basis: "profile" | "inferred";
  icon: IconName;
  tone: Tone;
  services: { href: string; label: string }[];
  image: { src: string; width: number; height: number; blurDataURL: string };
}

/**
 * The sectors as a list, each with its source (named in the company profile, or a website classification) and its
 * related services. On large screens a pinned preview beside the list shows the sector under the mouse or holding
 * keyboard focus (a short cross-fade; at once with reduced motion); it never takes focus and is hidden from assistive
 * technology, which reads the list. Phones and tablets show a small photo beside each name instead. Without script the
 * preview shows the first sector and the list is complete. Photos are never shown larger than their source.
 */
export function SectorIndex({
  items,
  labels,
}: {
  items: SectorItem[];
  labels: { basis: { profile: string; inferred: string }; related: string };
}) {
  const [active, setActive] = useState(0);
  const current = items[active];

  return (
    <div className="in-layout">
      <ol className="in-list">
        {items.map((item, i) => (
          <li
            key={item.slug}
            className="in-row"
            data-tone={item.tone}
            data-active={active === i || undefined}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
          >
            <span className="icon-chip in-chip">
              <Icon name={item.icon} size={22} />
            </span>
            <div className="in-thumb">
              <Image src={item.image.src} alt="" fill sizes="80px" placeholder="blur" blurDataURL={item.image.blurDataURL} className="object-cover" />
            </div>
            <div className="in-name">
              <span className="in-index">{item.index}</span>
              <h3 className="t-h3">{item.name}</h3>
            </div>
            <div className="in-body">
              <p className="t-small max-w-[38rem]">{item.description}</p>
              <p className="in-basis" data-basis={item.basis}>
                <Icon name={item.basis === "profile" ? "check" : "grid"} size={15} />
                {labels.basis[item.basis]}
              </p>
              {item.services.length > 0 && (
                <p className="in-services">
                  <span className="sr-only">{labels.related}:</span>
                  {item.services.map((service) => (
                    <a key={service.href} href={service.href} className="in-service">
                      {service.label}
                    </a>
                  ))}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <figure className="in-preview" aria-hidden>
        <div className="in-preview-stage">
          {items.map((item, i) => (
            <div key={item.slug} className="in-preview-layer" data-active={active === i || undefined}>
              <Image
                src={item.image.src}
                alt=""
                width={item.image.width}
                height={item.image.height}
                sizes={`(min-width: 1024px) ${Math.min(item.image.width, 560)}px, 1px`}
                placeholder="blur"
                blurDataURL={item.image.blurDataURL}
                className="in-preview-img"
                style={{ width: `min(100%, ${item.image.width}px)`, height: `min(100%, ${item.image.height}px)` }}
              />
            </div>
          ))}
        </div>
        <figcaption className="in-preview-caption">
          <span className="icon-chip size-9 shrink-0" data-tone={current.tone}>
            <Icon name={current.icon} size={18} />
          </span>
          {current.name}
        </figcaption>
      </figure>
    </div>
  );
}
