import type { Metadata } from "next";
import { ContentNew, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "New — Industries" };

export default async function IndustriesNewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ContentNew type="industry" searchParams={await searchParams} />;
}
