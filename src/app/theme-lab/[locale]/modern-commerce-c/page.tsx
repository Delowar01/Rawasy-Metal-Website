import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getLabData } from "@/components/theme-lab/data";
import { labCopy } from "@/components/theme-lab/options";
import { HomeC } from "@/components/theme-lab/c/HomeC";

export async function generateMetadata({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-c">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: labCopy[locale].optionNames.c } : {};
}

/** Theme lab — Option C homepage preview (noindex, outside the sitemap and navigation). */
export default async function ThemeLabCPage({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-c">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomeC data={await getLabData(locale, "c")} />;
}
