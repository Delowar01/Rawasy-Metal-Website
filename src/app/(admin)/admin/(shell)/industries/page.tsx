import type { Metadata } from "next";
import { ContentList, type SearchParams } from "../../_components/cms";

export const metadata: Metadata = { title: "Industries" };

export default async function IndustriesListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <ContentList
      type="industry"
      searchParams={await searchParams}
      intro="Sectors named in the company profile or classified from the work gallery, with their services and projects."
    />
  );
}
