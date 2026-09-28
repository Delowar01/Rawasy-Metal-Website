import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { company } from "@/content/company";
import { siteName } from "@/content/seo";
import { isLocale, localeConfig, locales } from "@/i18n/config";
import { commerceBootScript } from "@/lib/commerce-boot";
import { SITE_URL } from "@/lib/seo";
import { Ambient } from "@/components/commerce/Ambient";
import { Cursor } from "@/components/commerce/Cursor";
import { PAGE_COLORS } from "@/components/commerce/data";
import { Motion } from "@/components/commerce/Motion";
import { fontVariables } from "../fonts";
import "../commerce.css";
import "@/components/commerce/system.css";

/*
 * Root layout of the pages migrated to the Modern Commerce design (Stage TM-1: the homepage). The pages not yet
 * migrated keep the previous design under their own root layout (src/app/[locale]/layout.tsx), so the two design
 * systems — stylesheets, fonts, scripts — never share a document; moving between them is a full page load. The
 * theme (stored under the website's key) and the language cookie are shared by both.
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
