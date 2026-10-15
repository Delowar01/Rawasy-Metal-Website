import type { Metadata } from "next";
import { ContentNew, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "New — Pages" };

export default async function PagesNewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ContentNew type="page" searchParams={await searchParams} />;
}
