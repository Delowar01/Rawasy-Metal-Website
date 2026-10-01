import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { ContactPage as Contact } from "@/components/commerce/contact/ContactPage";
import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("contact", locale);
}

/**
 * Contact / request a quote in the Modern Commerce design (Stage TM-2.2): direct contact, the quotation form (no
 * delivery backend: it prepares the request for the visitor to send by email or WhatsApp, and says so) and the location.
 */
export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "contact", path: "/contact" });
  return (
    <PageShell shell={shell}>
      <Contact locale={locale} />
    </PageShell>
  );
}
