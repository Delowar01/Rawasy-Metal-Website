import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { innerPageMetadata } from "@/lib/inner-page";
import { getShellView } from "@/components/commerce/data";
import { IndustriesPage as Industries } from "@/components/commerce/industries/IndustriesPage";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/industries">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("industries", locale);
}

/** Industries in the Modern Commerce design (Stage TM-2.3): the sectors by source, with their related services. */
export default async function IndustriesPage({ params }: PageProps<"/[locale]/industries">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "industries", path: "/industries" });
  return (
    <PageShell shell={shell}>
      <Industries locale={locale} />
    </PageShell>
  );
}
