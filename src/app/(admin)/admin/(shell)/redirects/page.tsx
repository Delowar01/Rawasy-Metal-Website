import type { Metadata } from "next";
import type { SearchParams } from "../../_components/cms";
import { RedirectsScreen } from "../../_components/site";

export const metadata: Metadata = { title: "Redirects" };

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <RedirectsScreen searchParams={await searchParams} />;
}
