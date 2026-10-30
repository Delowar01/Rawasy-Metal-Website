import type { Metadata } from "next";
import type { SearchParams } from "../../_components/cms";
import { ThemeScreen } from "../../_components/site";

export const metadata: Metadata = { title: "Theme" };

export default async function ThemePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ThemeScreen searchParams={await searchParams} />;
}
