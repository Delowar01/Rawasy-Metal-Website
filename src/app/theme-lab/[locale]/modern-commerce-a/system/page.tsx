import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getLabData } from "@/components/theme-lab/data";
import { labCopy } from "@/components/theme-lab/options";
import { SystemA } from "@/components/theme-lab/a/SystemA";

export async function generateMetadata({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-a/system">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: `${labCopy[locale].optionNames.a} — ${labCopy[locale].system}` } : {};
}

/** Theme lab — Option A design system sheet (noindex, outside the sitemap and navigation). */
export default async function ThemeLabASystemPage({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-a/system">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SystemA data={await getLabData(locale, "a")} />;
}
