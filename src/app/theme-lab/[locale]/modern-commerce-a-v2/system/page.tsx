import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getLabData } from "@/components/theme-lab/data";
import { labCopy } from "@/components/theme-lab/options";
import { SystemA2 } from "@/components/theme-lab/a2/SystemA2";

export async function generateMetadata({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-a-v2/system">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: `${labCopy[locale].optionNames.a2} — ${labCopy[locale].system}` } : {};
}

/** Theme lab — Option A V2 design system sheet (noindex, outside the sitemap and navigation). */
export default async function ThemeLabA2SystemPage({ params }: PageProps<"/theme-lab/[locale]/modern-commerce-a-v2/system">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SystemA2 data={await getLabData(locale, "a2")} />;
}
