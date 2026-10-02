import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { localeConfig, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { commerceBootScript } from "@/lib/commerce-boot";
import { fontVariables } from "./global-not-found-fonts";
import "./global-not-found.css";

export const metadata: Metadata = {
  title: "404 — RAWASY · رواسي",
  robots: { index: false },
};

/*
 * The fallback 404 for an address outside any language (Next.js renders it in place of the root layouts), in the
 * Modern Commerce look: one page in both languages, each part marked with its language and direction, each with the
 * way home and to contact. Its own stylesheet and faces (no preload), so nothing here reaches another page.
 */
export default function GlobalNotFound() {
  const copy = locales.map((locale) => ({ locale, ...localeConfig[locale], text: getDictionary(locale).notFound }));
  return (
    <html lang="en" dir="ltr" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: commerceBootScript }} />
      </head>
      <body className="g404">
        <main className="g404-sheet">
          <div className="g404-top">
            <Logo className="g404-logo" />
            <p aria-hidden className="g404-code">
              {copy[0].text.code}
            </p>
          </div>
          <h1 className="g404-title">
            {copy.map(({ locale, htmlLang, dir, text }, i) => (
              <span key={locale}>
                {i > 0 && <span aria-hidden> · </span>}
                <span lang={htmlLang} dir={dir}>
                  {text.metaTitle}
                </span>
              </span>
            ))}
          </h1>
          <div className="g404-parts">
            {copy.map(({ locale, htmlLang, dir, text }) => (
              <section key={locale} lang={htmlLang} dir={dir} aria-labelledby={`g404-${locale}`} className="g404-part">
                <p className="g404-note">{text.note}</p>
                <h2 id={`g404-${locale}`} className="g404-heading">
                  {text.title}
                </h2>
                <p className="g404-body">{text.body}</p>
                <p className="g404-actions">
                  <a href={href(locale, "home")} className="g404-btn g404-btn-primary">
                    {text.home}
                  </a>
                  <a href={href(locale, "contact")} className="g404-btn">
                    {text.contact}
                  </a>
                </p>
              </section>
            ))}
          </div>
        </main>
      </body>
    </html>
  );
}
