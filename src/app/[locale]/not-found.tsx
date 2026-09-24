import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { NotFoundView } from "@/components/layout/NotFoundView";

export async function generateMetadata(): Promise<Metadata> {
  const value = await rootLocale();
  const locale = isLocale(value) ? value : defaultLocale;
  return { title: getDictionary(locale).notFound.metaTitle, robots: { index: false } };
}

export default async function NotFound() {
  const value = await rootLocale();
  return <NotFoundView locale={isLocale(value) ? value : defaultLocale} />;
}
