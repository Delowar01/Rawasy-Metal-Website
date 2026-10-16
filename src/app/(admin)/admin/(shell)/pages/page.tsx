import type { Metadata } from "next";
import { ContentList, type SearchParams } from "../../_components/cms";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <ContentList
      type="page"
      searchParams={await searchParams}
      intro="Page records: their type, address, titles and SEO. Their sections are composed in the page builder (Edit page layout)."
    />
  );
}
