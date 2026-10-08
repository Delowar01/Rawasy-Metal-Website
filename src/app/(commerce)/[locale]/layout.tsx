import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { company } from "@/content/company";
import { siteName } from "@/content/seo";
import { isLocale, localeConfig, locales } from "@/i18n/config";
import { commerceBootScript } from "@/lib/commerce-boot";
import { SITE_URL } from "@/lib/seo";
import { Ambient } from "@/components/commerce/Ambient";
import { Cursor } from "@/components/commerce/Cursor";
import { PAGE_COLORS } from "@/components/commerce/data";
import { Motion } from "@/components/commerce/Motion";
import { arabicFontPreloads, fontVariables } from "../fonts";
import "../commerce.css";
import "@/components/commerce/system.css";

/*
 * Root layout of the website's pages, all in the Modern Commerce design since Stage TM-2.6 (TM-1: the homepage; TM-2.1
 * to TM-2.5: the inner pages; TM-2.6: Capabilities and the project pages, both planned). The theme lab keeps its own
 * root layout (src/app/theme-lab) and an address outside any language gets the fallback 404
 * (src/app/global-not-found.tsx); neither shares a document with these pages.
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PAGE_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: PAGE_COLORS.dark },
  ],
  colorScheme: "light dark",
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: siteName[locale], template: `%s | ${siteName[locale]}` },
    applicationName: siteName[locale],
    authors: [{ name: company.legalName[locale] }],
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function CommerceLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { dir, htmlLang } = localeConfig[locale];
  // The Arabic faces' first-screen files, on the Arabic pages only (see fonts.ts): fetched with the page's stylesheet
  // rather than after it, so the Arabic text is set in its own faces before it is first drawn. The same link next/font
  // writes for the Latin faces.
  if (locale === "ar") for (const href of arabicFontPreloads) preload(href, { as: "font", type: "font/woff2", crossOrigin: "" });

  return (
    <html lang={htmlLang} dir={dir} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: commerceBootScript }} />
      </head>
      <body className="mc">
        {/* The site-wide ambient: fixed behind every section, above the page colour. */}
        <Ambient />
        <div id="top" />
        {children}
        <Cursor />
        <Motion />
      </body>
    </html>
  );
}
