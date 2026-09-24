import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ArrowIcon } from "@/components/ui/Icons";

/**
 * 404 — Outside the blueprint. An outlined "404" on a drawing grid, sliced by
 * a cut line, with a dimension that points to nothing.
 */
export function NotFoundView({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const dict = getDictionary(locale);
  return (
    <section
      lang={locale === "ar" ? "ar" : "en"}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={compact ? "relative" : "relative isolate overflow-hidden"}
    >
      {!compact && (
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_45%,black,transparent_80%)]" />
      )}
      <div className={compact ? "py-10" : "container-x flex min-h-[86svh] flex-col justify-center pb-24 pt-[calc(var(--header-h)+4rem)]"}>
        <div aria-hidden className="relative w-full max-w-[40rem]" dir="ltr">
          <svg viewBox="0 0 640 250" className="w-full overflow-visible">
            <text
              x="0"
              y="215"
              className="fill-none stroke-ink-3"
              strokeWidth="1.2"
              style={{ font: "600 270px var(--font-archivo), sans-serif", letterSpacing: "-0.04em" }}
            >
              404
            </text>
            <line x1="-20" y1="176" x2="660" y2="96" className="stroke-accent" strokeWidth="1.6" />
            <circle cx="660" cy="96" r="3.5" className="fill-accent" />
            <g className="stroke-ink-3" strokeWidth="0.8" fill="none">
              <path d="M0 238V248M586 238V248M0 243H586" />
            </g>
            <text x="293" y="236" textAnchor="middle" className="fill-ink-3" style={{ font: "500 11px var(--font-geist-mono), monospace", letterSpacing: "0.14em" }}>
              ∅ / N.T.S.
            </text>
          </svg>
        </div>
        <p className="t-label mt-8 text-accent-ink">{dict.notFound.note}</p>
        <h1 className="t-h1 mt-4 text-ink">{dict.notFound.title}</h1>
        <p className="t-lead mt-5 max-w-xl">{dict.notFound.body}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href={href(locale, "home")} icon={<ArrowIcon size={18} className="-scale-x-100 rtl:scale-x-100" />}>
            {dict.notFound.home}
          </ButtonLink>
          <ButtonLink href={href(locale, "contact")} variant="outline">
            {dict.notFound.contact}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
