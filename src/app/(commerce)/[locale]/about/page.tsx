import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { AboutPage as About } from "@/components/commerce/about/AboutPage";
import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("about", locale);
}

/** About in the Modern Commerce design (Stage TM-2.3): the full company profile in fifteen parts. */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "about", path: "/about" });
  return (
    <PageShell shell={shell}>
      <About locale={locale} />
    </PageShell>
  );
}
