import type { Metadata } from "next";
import type { SearchParams } from "../../_components/cms";
import { SettingsScreen } from "../../_components/site";

export const metadata: Metadata = { title: "Company & website" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <SettingsScreen searchParams={await searchParams} />;
}
