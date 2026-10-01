import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { ClientsPage as Clients } from "@/components/commerce/clients/ClientsPage";
import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/clients">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("clients", locale);
}

/** Clients in the Modern Commerce design (Stage TM-2.3): the logos from the company profile on one unnumbered wall. */
export default async function ClientsPage({ params }: PageProps<"/[locale]/clients">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "clients", path: "/clients" });
  return (
    <PageShell shell={shell}>
      <Clients locale={locale} />
    </PageShell>
  );
}
