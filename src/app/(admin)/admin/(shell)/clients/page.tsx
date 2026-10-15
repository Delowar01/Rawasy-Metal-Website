import type { Metadata } from "next";
import { ContentList, type SearchParams } from "../../_components/cms";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <ContentList
      type="client"
      searchParams={await searchParams}
      intro="Client metadata. A draft record is never a claim of work for a client; logos arrive with the media library (A4)."
    />
  );
}
