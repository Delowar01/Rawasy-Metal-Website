import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { path } from "@/i18n/routes";
import { innerPageMetadata } from "@/lib/inner-page";
import { CapabilitiesPage as Capabilities } from "@/components/commerce/capabilities/CapabilitiesPage";
import { MachineAddressLink } from "@/components/commerce/capabilities/MachineAddressLink";
import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]/capabilities">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("capabilities", locale);
}

/**
 * Capabilities & Machinery (Stage 1E): the six machines of the company profile in the Modern Commerce design, each at
 * /capabilities#<slug>. The header's language links keep the machine the address names (MachineAddressLink).
 */
export default async function CapabilitiesPage({ params }: PageProps<"/[locale]/capabilities">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const shell = await getShellView(locale, { route: "capabilities", path: path("capabilities") });
  return (
    <PageShell shell={shell} sameAddressLink={MachineAddressLink}>
      <Capabilities locale={locale} />
    </PageShell>
  );
}
