import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import { Ambient } from "@/components/commerce/Ambient";
import { Cursor } from "@/components/commerce/Cursor";
import { PAGE_COLORS } from "@/components/commerce/data";
import { Motion } from "@/components/commerce/Motion";
import { localeConfig } from "@/i18n/config";
import { PREVIEW_HEADERS } from "@/lib/admin-headers";
import { assertAdminEnabled } from "@/server/admin/context";
import { arabicFontPreloads, fontVariables } from "../../../(commerce)/fonts";
import "../../../(commerce)/commerce.css";
import "@/components/commerce/system.css";
import "@/components/commerce/services/services.css";
import "@/components/commerce/projects/projects.css";
import "@/components/commerce/capabilities/capabilities.css";
import "@/components/commerce/project-detail/project-detail.css";
import "@/components/commerce/signature/signature.css";
import "@/components/builder/blocks.css";

/**
 * The page builder's private preview (A5 brief §36–§39): its own root layout, so a working page is drawn exactly as the
 * website draws it — the Modern Commerce stylesheets, faces, ambient, pointer and motion — in the language and theme the
 * builder asked for (the proxy hands them over from the address: `x-preview-locale`, `x-preview-theme`). Rendered at
 * request time only, never indexed or cached (the proxy's preview headers), and nothing at all with the admin off.
 *
 * Its boot script is the website's without the stored theme: the theme is the preview's, never the visitor's choice.
 */
export const metadata: Metadata = {
  title: { default: "Preview · RAWASY Admin", template: "%s · Preview · RAWASY Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "same-origin",
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PAGE_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: PAGE_COLORS.dark },
  ],
  colorScheme: "light dark",
};

/** Script on, then gliding same-page jumps once the page and its fonts have loaded (as the website's boot script). */
const PREVIEW_BOOT = `(function(){var d=document.documentElement;d.classList.add("js");function g(){document.fonts.ready.then(function(){requestAnimationFrame(function(){requestAnimationFrame(function(){d.setAttribute("data-smooth-scroll","")})})})}if(document.readyState==="complete")g();else addEventListener("load",g)})();`;

export default async function PreviewRootLayout({ children }: { children: ReactNode }) {
  await connection();
  assertAdminEnabled();
  const h = await headers();
  const locale = h.get(PREVIEW_HEADERS.locale) === "ar" ? "ar" : "en";
  const theme = h.get(PREVIEW_HEADERS.theme) === "dark" ? "dark" : "light";
  const nonce = h.get("x-nonce") ?? undefined;
  const { dir, htmlLang } = localeConfig[locale];
  if (locale === "ar") for (const href of arabicFontPreloads) preload(href, { as: "font", type: "font/woff2", crossOrigin: "" });
  return (
    <html lang={htmlLang} dir={dir} className={fontVariables} data-theme={theme} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PREVIEW_BOOT }} />
      </head>
      <body className="mc">
        <Ambient />
        <div id="top" />
        {children}
        <Cursor />
        <Motion />
      </body>
    </html>
  );
}
