import type { Metadata } from "next";
import type { SearchParams } from "../../_components/cms";
import { NavigationScreen } from "../../_components/site";

export const metadata: Metadata = { title: "Navigation" };

export default async function NavigationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <NavigationScreen searchParams={await searchParams} />;
}
