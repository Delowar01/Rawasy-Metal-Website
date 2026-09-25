import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getLabData } from "@/components/theme-lab/data";
import { labCopy } from "@/components/theme-lab/options";
import { HomeA } from "@/components/theme-lab/a/HomeA";

export async function generateMetadata({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-a">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: labCopy[locale].optionNames.a } : {};
}

/** Theme lab — Option A homepage preview (noindex, outside the sitemap and navigation). */
export default async function ThemeLabAPage({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-a">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomeA data={await getLabData(locale, "a")} />;
}
