import type { Metadata } from "next";
import { ContentList, type SearchParams } from "../../_components/cms";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <ContentList
      type="service"
      searchParams={await searchParams}
      intro="Structured service records in English and Arabic, with their machines, related services and featured projects."
    />
  );
}
