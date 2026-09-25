import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getLabData } from "@/components/theme-lab/data";
import { labCopy } from "@/components/theme-lab/options";
import { HomeA2 } from "@/components/theme-lab/a2/HomeA2";

export async function generateMetadata({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-a-v2">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: labCopy[locale].optionNames.a2 } : {};
}

/** Theme lab — Option A V2 homepage preview (noindex, outside the sitemap and navigation). */
export default async function ThemeLabA2Page({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-a-v2">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomeA2 data={await getLabData(locale, "a2")} />;
}
