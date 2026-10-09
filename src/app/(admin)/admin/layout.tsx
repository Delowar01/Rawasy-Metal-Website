import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./admin.css";

/**
 * The admin's own root layout (A1-SECURITY-RBAC §4): no public shell, fonts, ambient or motion. Every admin page is
 * rendered at request time (the session decides what it shows), never indexed and never cached.
 */
export const metadata: Metadata = {
  title: { default: "RAWASY Admin", template: "%s · RAWASY Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "same-origin",
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1217" },
  ],
};

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  await connection();
  return (
    <html lang="en" dir="ltr">
      <body className="adm">{children}</body>
    </html>
  );
}
