import Link from "next/link";
import type { CSSProperties } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ArrowIcon, PhoneIcon } from "@/components/ui/Icons";
import { LineIcon } from "@/components/ui/LineIcons";
import { Phrases } from "@/components/ui/Phrases";
import { Backdrop, ScanLine } from "@/components/visual/Backdrop";
import { SectionRule } from "@/components/visual/SectionRule";
import type { ServiceSlug } from "@/content/types";
import type { Tone } from "@/lib/tones";

const delay = (ms: number) => ({ ["--d" as string]: ms }) as CSSProperties;

/**
 * Closing band of a service page: the service's own prompt, the quote action
 * (the contact page's request form), a direct call, and a few ways onward.
 * The service's line icon, in its tone, anchors the band.
 */
export function ServiceCTA({
  slug,
  tone,
  label,
  title,
  body,
  quote,
  call,
  explore,
}: {
  slug: ServiceSlug;
  tone: Tone;
  label: string;
  title: string;
  body: string;
  quote: { href: string; label: string };
  call: { href: string; label: string; number: string };
  explore: { label: string; links: { href: string; label: string }[] };
}) {
  return (
    <section aria-labelledby="page-cta-title" className="on-band relative isolate overflow-hidden bg-band text-band-ink [--row-tint:rgb(236_234_229/0.035)]" data-tone={tone}>
      <Backdrop kind="grid" drift className="[--bd-opacity:0.6] [--grid-line:rgb(236_234_229/0.05)]" />
      <ScanLine delay={2} />
      <LineIcon
        name={slug}
        size={420}
        strokeWidth={0.5}
        className="pointer-events-none absolute -bottom-24 -end-20 -z-10 text-[var(--tone)] opacity-[0.16] max-sm:hidden"
      />
      <div className="container-x relative pt-[clamp(4rem,2.8rem+4.5vw,7rem)]">
        <SectionRule tone="band" />
      </div>
      <div className="container-x relative grid gap-x-10 gap-y-14 pb-[clamp(4.5rem,3rem+5vw,8rem)] pt-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-6">
          <p className="t-label eyebrow !text-band-ink-2" data-reveal="fade">
            {label}
          </p>
          <h2 id="page-cta-title" className="t-h2-compact mt-6 max-w-[13em]" data-reveal>
            <Phrases>{title}</Phrases>
          </h2>
          <p className="t-lead mt-6 max-w-[32rem] !text-band-ink-2" data-reveal style={delay(100)}>
            {body}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-5" data-reveal style={delay(160)}>
            <ButtonLink href={quote.href}>{quote.label}</ButtonLink>
            <a href={call.href} className="group inline-flex items-center gap-3 text-band-ink">
              <PhoneIcon size={18} className="text-[var(--accent-on-dark)]" />
              <span className="flex flex-col leading-tight">
                <span className="t-label !text-band-ink-2">{call.label}</span>
                <span className="link-line mt-1 font-display text-[1.05rem] font-semibold" dir="ltr">
                  {call.number}
                </span>
              </span>
            </a>
          </div>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <p className="t-label !text-band-ink-2" data-reveal="fade">
            {explore.label}
          </p>
          <ul className="mt-4 border-t border-band-line">
            {explore.links.map((link, i) => (
              <li key={link.href} className="act-row border-b border-band-line" data-reveal style={delay(80 * i)}>
                <Link href={link.href} className="group flex items-center gap-5 py-5 ps-4 sm:ps-5">
                  <span className="min-w-0 flex-1 font-display text-[1.1rem] font-semibold leading-snug transition-colors group-hover:text-accent sm:text-[1.2rem]">
                    {link.label}
                  </span>
                  <ArrowIcon size={20} className="shrink-0 text-band-ink-2 transition-transform duration-500 ease-out-expo group-hover:translate-x-[calc(var(--dir)*6px)] rtl:-scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
