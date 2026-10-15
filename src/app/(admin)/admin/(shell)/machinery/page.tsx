import type { Metadata } from "next";
import { ContentList, type SearchParams } from "../../_components/cms";

export const metadata: Metadata = { title: "Machinery" };

export default async function MachineryListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <ContentList
      type="machine"
      searchParams={await searchParams}
      intro="Machines with power only when stated, a primary service and technical attributes."
    />
  );
}
