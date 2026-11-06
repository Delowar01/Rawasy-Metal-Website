import type { Metadata } from "next";
import { HistoryScreen, type SearchParams } from "../../../../_components/publishing";

export const metadata: Metadata = { title: "Version history" };

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ type: string; id: string }>; searchParams: Promise<SearchParams> }) {
  const { type, id } = await params;
  return <HistoryScreen rawType={type} rawId={id} searchParams={await searchParams} />;
}
