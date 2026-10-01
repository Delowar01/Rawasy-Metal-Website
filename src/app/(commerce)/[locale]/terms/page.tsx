import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { getShellView } from "@/components/commerce/data";
import { LegalPage } from "@/components/commerce/legal/LegalPage";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("terms", locale);
}

/** The website terms in the Modern Commerce design (Stage TM-2.1). */
export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "terms", path: "/terms" });
  return (
    <PageShell shell={shell}>
      <LegalPage slug="terms" locale={locale} shell={shell} />
    </PageShell>
  );
}
