import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ArrowIcon } from "@/components/ui/Icons";

/**
 * Interim page for routes built after homepage approval (stages 1C–1G). It is
 * fully routed, localized and indexed-safe (noindex), so navigation, language
 * switching and SEO wiring can be verified end to end today.
 */
export function PagePlaceholder({
  locale,
  title,
  description,
  stage,
  breadcrumb,
  children,
}: {
  locale: Locale;
  title: string;
  description: string;
  stage: string;
  breadcrumb?: { href: string; label: string }[];
  children?: React.ReactNode;
}) {
  const dict = getDictionary(locale);
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,black,transparent_80%)]" />
      <div className="container-x flex min-h-[78svh] flex-col justify-center pb-24 pt-[calc(var(--header-h)+5rem)]">
        {breadcrumb && (
          <nav aria-label={dict.a11y.breadcrumb} className="mb-10">
            <ol className="t-label flex flex-wrap items-center gap-2 text-ink-3">
              {breadcrumb.map((item, i) => (
                <li key={item.href} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden>/</span>}
                  {i < breadcrumb.length - 1 ? (
                    <Link href={item.href} className="hover:text-ink">
                      {item.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-ink-2">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <p className="t-label inline-flex w-fit items-center gap-3 border border-line-strong px-3 py-2 text-ink-2">
          <span className="size-1.5 animate-pulse bg-accent motion-reduce:animate-none" aria-hidden />
          {dict.placeholder.badge} · <span className="t-num">{stage}</span>
        </p>
        <h1 className="t-h1 mt-8 max-w-[18ch] text-ink">{title}</h1>
        <p className="t-lead mt-6 max-w-2xl">{description}</p>
        {children}
        <p className="t-body mt-10 max-w-xl text-ink-3">
          {dict.placeholder.body} <span className="t-num">{stage}</span>.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href={href(locale, "home")} variant="outline" icon={<ArrowIcon size={18} className="-scale-x-100 rtl:scale-x-100" />}>
            {dict.placeholder.back}
          </ButtonLink>
          <ButtonLink href={href(locale, "contact")}>{dict.placeholder.contact}</ButtonLink>
        </div>
      </div>
    </section>
  );
}
