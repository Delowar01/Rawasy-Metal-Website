import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getLabData } from "@/components/theme-lab/data";
import { labCopy } from "@/components/theme-lab/options";
import { HomeB } from "@/components/theme-lab/b/HomeB";

export async function generateMetadata({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-b">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: labCopy[locale].optionNames.b } : {};
}

/** Theme lab — Option B homepage preview (noindex, outside the sitemap and navigation). */
export default async function ThemeLabBPage({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-b">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomeB data={await getLabData(locale, "b")} />;
}
