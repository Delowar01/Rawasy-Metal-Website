import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import { Phrases } from "@/components/ui/Phrases";

export interface CtaLink {
  href: string;
  label: string;
  description?: string;
}

/** Closing band of an inner page: a short prompt and a few numbered ways forward. */
export function InnerCTA({ label, title, body, links }: { label: string; title: string; body?: string; links: CtaLink[] }) {
  return (
    <section aria-labelledby="page-cta-title" className="on-band relative isolate overflow-hidden bg-band text-band-ink">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-40 [--grid-line:rgb(236_234_229/0.05)]" />
      <div className="container-x grid gap-x-10 gap-y-12 py-[clamp(4.5rem,3rem+5vw,8rem)] lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-5">
          <p className="t-label eyebrow !text-band-ink-2" data-reveal="fade">
            {label}
          </p>
          <h2 id="page-cta-title" className="t-h2-compact mt-6 max-w-[13em]" data-reveal>
            <Phrases>{title}</Phrases>
          </h2>
          {body && (
            <p className="t-lead mt-6 max-w-[32rem] !text-band-ink-2" data-reveal style={{ ["--d" as string]: 100 }}>
              {body}
            </p>
          )}
        </div>
        <ul className="border-t border-band-line lg:col-span-6 lg:col-start-7">
          {links.map((link, i) => (
            <li key={link.href} className="border-b border-band-line" data-reveal style={{ ["--d" as string]: 80 * i }}>
              <Link href={link.href} className="group flex items-center gap-5 py-5 sm:gap-6 sm:py-6">
                <span className="t-num w-6 shrink-0 text-xs text-band-ink-2">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[1.15rem] font-semibold leading-snug transition-colors group-hover:text-accent sm:text-[1.3rem]">
                    {link.label}
                  </span>
                  {link.description && <span className="mt-1 block text-sm text-band-ink-2">{link.description}</span>}
                </span>
                <ArrowIcon
                  size={22}
                  className={`shrink-0 transition-transform duration-500 ease-out-expo group-hover:translate-x-[calc(var(--dir)*6px)] rtl:-scale-x-100 ${i === 0 ? "text-accent" : "text-band-ink-2"}`}
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
