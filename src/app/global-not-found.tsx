import type { Metadata } from "next";
import { bootScript } from "@/lib/boot-script";
import { NotFoundView } from "@/components/layout/NotFoundView";
import { archivo, geistMono, plexArabic } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "404 — RAWASY · رواسي",
  robots: { index: false },
};

/** Unmatched URLs outside any locale: one page, both languages. */
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr" className={`${archivo.variable} ${plexArabic.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <main className="container-x grid min-h-svh content-center gap-4 py-16 lg:grid-cols-2 lg:gap-16">
          <NotFoundView locale="en" compact />
          <NotFoundView locale="ar" compact />
        </main>
      </body>
    </html>
  );
}
