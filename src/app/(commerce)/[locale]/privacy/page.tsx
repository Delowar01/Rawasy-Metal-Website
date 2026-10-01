import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { getShellView } from "@/components/commerce/data";
import { LegalPage } from "@/components/commerce/legal/LegalPage";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("privacy", locale);
}

/** The privacy policy in the Modern Commerce design (Stage TM-2.1). */
export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "privacy", path: "/privacy" });
  return (
    <PageShell shell={shell}>
      <LegalPage slug="privacy" locale={locale} shell={shell} />
    </PageShell>
  );
}
