import type { Metadata } from "next";
import { CompareScreen, type SearchParams } from "../../../../../_components/publishing";

export const metadata: Metadata = { title: "Compare versions" };

export default async function ComparePage({ params, searchParams }: { params: Promise<{ type: string; id: string }>; searchParams: Promise<SearchParams> }) {
  const { type, id } = await params;
  return <CompareScreen rawType={type} rawId={id} searchParams={await searchParams} />;
}
