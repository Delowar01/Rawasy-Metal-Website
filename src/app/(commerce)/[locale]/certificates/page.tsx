import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { CertificatesPage as Certificates } from "@/components/commerce/certificates/CertificatesPage";
import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/certificates">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("certificates", locale);
}

/**
 * Certificates & compliance in the Modern Commerce design (Stage TM-2.3): the document register, the redacted previews
 * (the files as they are) in a native dialog, and how they were redacted.
 */
export default async function CertificatesPage({ params }: PageProps<"/[locale]/certificates">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "certificates", path: "/certificates" });
  return (
    <PageShell shell={shell}>
      <Certificates locale={locale} />
    </PageShell>
  );
}
