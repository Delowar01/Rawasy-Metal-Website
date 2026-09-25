import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getLabData } from "@/components/theme-lab/data";
import { labCopy } from "@/components/theme-lab/options";
import { SystemC } from "@/components/theme-lab/c/SystemC";

export async function generateMetadata({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-c/system">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: `${labCopy[locale].optionNames.c} — ${labCopy[locale].system}` } : {};
}

/** Theme lab — Option C design system sheet (noindex, outside the sitemap and navigation). */
export default async function ThemeLabCSystemPage({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-c/system">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SystemC data={await getLabData(locale, "c")} />;
}
