"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

export interface ProcessStepView {
  slug: string;
  index: string;
  verb: string;
  title: string;
  body: string;
  href?: string;
}

/** Line-art icon per production step (stroke-drawn when revealed). */
function StepIcon({ slug }: { slug: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.25, pathLength: 1 } as const;
  switch (slug) {
    case "cut":
      return (
        <>
          <path d="M6 34 18 26h24L30 34Z" {...common} />
          <path d="M24 4v17" {...common} className="text-accent" />
          <path d="M20 30h8" {...common} strokeDasharray="2 2" />
          <path d="m19 22 5-3 5 3" {...common} className="text-accent" />
        </>
      );
    case "bend":
      return (
        <>
          <path d="M6 36h16l14-20" {...common} />
          <path d="M6 40h17.5l15-21.5" {...common} />
          <path d="M16 36a7 7 0 0 1 4.5-6" {...common} className="text-accent" />
        </>
      );
    case "weld":
      return (
        <>
          <path d="M5 30h17l-4 10H5ZM43 30H26l4 10h13Z" {...common} />
          <path d="m20 30 2-3 2 3 2-3 2 3" {...common} className="text-accent" />
          <path d="M31 8 24 22" {...common} />
        </>
      );
    case "assemble":
      return (
        <>
          <path d="M8 40V10h32v30M8 10l32 30M8 22h32" {...common} />
          <circle cx="8" cy="10" r="2" {...common} className="text-accent" />
          <circle cx="40" cy="40" r="2" {...common} className="text-accent" />
        </>
      );
    case "finish":
      return (
        <>
          <path d="M6 14h36v24H6Z" {...common} />
          <path d="M12 22h14M12 28h20M12 33h9" {...common} />
          <path d="M36 4v10" {...common} className="text-accent" />
        </>
      );
    default:
      return (
        <>
          <path d="M8 42V14M24 42V14M40 42V14M8 14h32M8 26h32M8 38h32" {...common} />
          <path d="M8 14 24 26 40 14" {...common} className="text-accent" />
        </>
      );
  }
}

/**
 * From flat sheet to finished structure — six steps on a production line.
 * An orange progress line is scrubbed by scroll and lights each station as it
 * passes (runs right-to-left in Arabic via the logical transform origin).
 */
export function ProcessLine({ steps }: { steps: ProcessStepView[] }) {
  const root = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) {
        el?.querySelectorAll("[data-station]").forEach((s) => s.setAttribute("data-lit", ""));
        return;
      }
      const stations = gsap.utils.toArray<HTMLElement>("[data-station]", el);
      const mm = gsap.matchMedia();
      mm.add(
        { desktop: "(min-width: 64rem)", mobile: "(max-width: 63.99rem)" },
        (context) => {
          const desktop = context.conditions?.desktop;
          const bar = el.querySelector<HTMLElement>(desktop ? "[data-progress-x]" : "[data-progress-y]");
          if (!bar) return;
          gsap.fromTo(
            bar,
            desktop ? { scaleX: 0 } : { scaleY: 0 },
            {
              ...(desktop ? { scaleX: 1 } : { scaleY: 1 }),
              ease: "none",
              scrollTrigger: {
                trigger: el,
                start: desktop ? "top 75%" : "top 70%",
                end: desktop ? "bottom 55%" : "bottom 60%",
                scrub: 0.5,
                onUpdate: (self) => {
                  stations.forEach((s, i) => {
                    const lit = self.progress >= i / Math.max(stations.length - 1, 1) - 0.02;
                    if (lit) s.setAttribute("data-lit", "");
                    else s.removeAttribute("data-lit");
                  });
                },
              },
            },
          );
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <ol ref={root} className="process relative grid gap-0 lg:grid-cols-6">
      {/* Desktop rail */}
      <span aria-hidden className="absolute inset-x-0 top-[0.4rem] hidden h-px bg-line-strong lg:block" />
      <span aria-hidden data-progress-x className="absolute inset-x-0 top-[0.4rem] hidden h-px origin-[var(--origin-start)] bg-accent lg:block" />
      {/* Mobile rail */}
      <span aria-hidden className="absolute bottom-6 start-[1.2rem] top-6 w-px bg-line-strong lg:hidden" />
      <span aria-hidden data-progress-y className="absolute bottom-6 start-[1.2rem] top-6 w-px origin-top bg-accent lg:hidden" />

      {steps.map((step) => {
        const content = (
          <>
            <span className="process-icon panel-raised grid size-16 place-items-center text-ink-2 lg:mt-8">
              <svg viewBox="0 0 48 48" className="size-11" aria-hidden>
                {/* A faint outline of the icon waits on the tile until the line reaches the station */}
                <g className="icon-ghost">
                  <StepIcon slug={step.slug} />
                </g>
                <StepIcon slug={step.slug} />
              </svg>
            </span>
            <span className="t-num mt-6 block text-xs text-ink-3">{step.index}</span>
            <span className="t-h3 mt-2 block text-ink">{step.verb}</span>
            <span className="t-label mt-3 block text-accent-ink">{step.title}</span>
            <span className="t-body mt-3 block text-[0.95rem]">{step.body}</span>
          </>
        );
        return (
          <li key={step.slug} data-station className="process-station relative ps-14 pb-8 lg:pe-3 lg:ps-0 lg:pb-0">
            <span aria-hidden className="process-node absolute start-[0.85rem] top-[1.6rem] size-[0.8rem] border border-line-strong bg-background lg:static lg:block" />
            {step.href ? (
              <Link href={step.href} className="act-row group -ms-3 block pb-4 pe-3 ps-3 lg:pb-6">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
