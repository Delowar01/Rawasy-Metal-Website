import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { Icon } from "../Icon";

/**
 * The localized 404 in the Modern Commerce design: the page's own copy ("Outside the blueprint"), the two ways on
 * (home and contact) and a quiet numeral, on a raised sheet. The previous design's drawing grid and cut line are not
 * carried over (decision D8); the copy is unchanged.
 */
export function NotFoundView({ locale }: { locale: Locale }) {
  const { notFound } = getDictionary(locale);
  return <NotFoundPanel text={notFound} homeHref={href(locale, "home")} contactHref={href(locale, "contact")} />;
}

/** The 404's panel with its texts (the page builder's preview gives its own section's words). */
export function NotFoundPanel({
  text,
  homeHref,
  contactHref,
}: {
  text: { code: string; note: string; title: string; body: string; home: string; contact: string };
  homeHref: string;
  contactHref: string;
}) {
  return (
    <div className="sec pt-[clamp(1.25rem,0.8rem+1.6vw,2.5rem)]">
      <div className="shell">
        <section aria-labelledby="page-title" className="ip-404 sec-raised rounded-[var(--sheet-r)]">
          <div className="grid items-center gap-x-12 gap-y-6 lg:grid-cols-12">
            <p aria-hidden className="ip-404-code lg:order-last lg:col-span-5 lg:text-end">
              {text.code}
            </p>
            <div className="lg:col-span-7">
              <p className="eyebrow" data-tone="brand">
                {text.note}
              </p>
              <h1 id="page-title" className="t-h1 mt-5">
                {text.title}
              </h1>
              <p className="t-lead mt-4 max-w-[32rem]">{text.body}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={homeHref} className="btn btn-primary btn-lg">
                  {/* Back: the arrow points against the reading direction. */}
                  <span className="inline-flex -scale-x-100">
                    <Icon name="arrow" size={18} />
                  </span>
                  {text.home}
                </a>
                <a href={contactHref} className="btn btn-secondary btn-lg">
                  {text.contact}
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
