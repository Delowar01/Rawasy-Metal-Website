import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { isLocale, localeConfig, locales } from "@/i18n/config";
import { SITE_URL } from "@/lib/seo";
import { LabMotion } from "@/components/theme-lab/LabMotion";
import "../lab.css";

/*
 * Root layout of the theme lab — isolated from the website: no site header,
 * footer, loader, cursor or site stylesheet. Every lab page is noindex and is
 * left out of the sitemap and navigation (see src/proxy.ts for X-Robots-Tag).
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Theme lab — RAWASY", template: "%s · Theme lab — RAWASY" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const jsFlag = `document.documentElement.classList.add("js")`;

export default async function ThemeLabLayout({ children, params }: LayoutProps<"/theme-lab/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { dir, htmlLang } = localeConfig[locale];

  return (
    <html lang={htmlLang} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: jsFlag }} />
      </head>
      <body>
        {children}
        <LabMotion />
      </body>
    </html>
  );
}
