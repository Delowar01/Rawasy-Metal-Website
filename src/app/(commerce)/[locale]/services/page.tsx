import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { getShellView } from "@/components/commerce/data";
import { ServicesPage as Services } from "@/components/commerce/services/ServicesPage";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("services", locale);
}

/** The services overview in the Modern Commerce design (Stage TM-2.4): the six services, each with its way in. */
export default async function ServicesPage({ params }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "services", path: "/services" });
  return (
    <PageShell shell={shell}>
      <Services locale={locale} />
    </PageShell>
  );
}
